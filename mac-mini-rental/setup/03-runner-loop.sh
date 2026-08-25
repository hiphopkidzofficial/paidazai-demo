#!/bin/bash
#
# 03-runner-loop.sh — ephemeral GitHub Actions runner 主迴圈(以 `runner` 帳號執行)
#
# 每一輪:
#   1. 用客戶提供的 PAT 向 GitHub API 換一個短效 runner registration token
#   2. 從 `base` 映像 clone 一台全新 VM 並開機
#   3. SSH 進 VM,以 --ephemeral 模式註冊 runner 並等待一個 job
#   4. job 跑完(或逾時)→ 整台 VM 刪除 → 回到 1
#
# 設定:在 ~/.runner-env 建立環境檔(chmod 600),內容:
#
#   GH_PAT="ghp_xxx"            # 客戶提供,需 repo/org 的 self-hosted runner 管理權限
#   GH_SCOPE="repos/owner/repo" # repo 級;org 級改成 "orgs/orgname"
#   RUNNER_LABELS="self-hosted,macOS,arm64"
#   HEALTHCHECK_URL=""          # 選填:healthchecks.io 的 ping URL
#
# 手動測試:  bash 03-runner-loop.sh
# 正式部署:  用 com.rental.runner.plist 掛進 launchd(開機自動跑、掛掉自動重啟)
#
# 效能提示:每輪都會在 VM 內下載 runner(~200MB)。上線前建議把 runner 檔案
# 烤進 base 映像一次(tart run base 進去先跑過下方 install 區塊再關機),
# 之後每輪省下下載時間。
#
# VM 內建帳密:cirruslabs 官方映像預設 admin/admin(VM 在 NAT 後面、用完即毀,
# 此為社群標準做法;不要把這組帳密用在 host 上)。

set -uo pipefail

ENV_FILE="$HOME/.runner-env"
[[ -f "$ENV_FILE" ]] || { echo "缺少 $ENV_FILE,見腳本開頭說明" >&2; exit 1; }
# shellcheck source=/dev/null
source "$ENV_FILE"
: "${GH_PAT:?}" "${GH_SCOPE:?}"
RUNNER_LABELS="${RUNNER_LABELS:-self-hosted,macOS,arm64}"
RUNNER_VERSION="${RUNNER_VERSION:-2.327.1}"   # 定期更新:github.com/actions/runner/releases
JOB_TIMEOUT_MIN="${JOB_TIMEOUT_MIN:-120}"     # 單一 job 上限,防吊死

command -v sshpass &>/dev/null || brew install hudochenkov/sshpass/sshpass

SSH_OPTS=(-o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=10)
vm_ssh() { sshpass -p admin ssh "${SSH_OPTS[@]}" "admin@$1" "$2"; }

# runner 註冊時 GitHub 網頁上顯示的 URL 跟 API scope 不同格式
case "$GH_SCOPE" in
  repos/*) RUNNER_URL="https://github.com/${GH_SCOPE#repos/}" ;;
  orgs/*)  RUNNER_URL="https://github.com/${GH_SCOPE#orgs/}" ;;
  *) echo "GH_SCOPE 格式須為 repos/owner/repo 或 orgs/orgname" >&2; exit 1 ;;
esac

echo "==> runner loop 啟動:$RUNNER_URL(labels: $RUNNER_LABELS)"

while true; do
  VM="ci-$(date +%s)"

  # 1. 換短效 registration token(有效期約 1 小時,每輪重新換)
  REG_TOKEN=$(curl -sf -X POST \
    -H "Authorization: Bearer $GH_PAT" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/$GH_SCOPE/actions/runners/registration-token" \
    | /usr/bin/python3 -c 'import sys,json;print(json.load(sys.stdin)["token"])') || {
      echo "!! 取得 registration token 失敗,60 秒後重試"; sleep 60; continue; }

  # 2. 全新 VM
  tart clone base "$VM" || { sleep 30; continue; }
  tart run "$VM" --no-graphics &
  TART_PID=$!

  # 等 VM 拿到 IP、SSH 可連(最多 5 分鐘)
  VM_IP=""
  for _ in $(seq 1 60); do
    VM_IP=$(tart ip "$VM" 2>/dev/null) && [[ -n "$VM_IP" ]] \
      && vm_ssh "$VM_IP" "true" 2>/dev/null && break
    VM_IP=""; sleep 5
  done
  if [[ -z "$VM_IP" ]]; then
    echo "!! VM 開機逾時,銷毀重來"
    kill "$TART_PID" 2>/dev/null; wait "$TART_PID" 2>/dev/null
    tart delete "$VM" 2>/dev/null
    continue
  fi

  # 3. VM 內:安裝(若未烤進映像)→ 註冊(--ephemeral)→ 等一個 job
  echo "==> [$VM] 註冊 runner 並等待 job"
  vm_ssh "$VM_IP" "
    set -e
    if [ ! -x \"\$HOME/actions-runner/run.sh\" ]; then
      mkdir -p \"\$HOME/actions-runner\" && cd \"\$HOME/actions-runner\"
      curl -sfLo runner.tar.gz https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-osx-arm64-${RUNNER_VERSION}.tar.gz
      tar xzf runner.tar.gz
    fi
    cd \"\$HOME/actions-runner\"
    ./config.sh --unattended --ephemeral --replace \
      --url '$RUNNER_URL' --token '$REG_TOKEN' \
      --name '$VM' --labels '$RUNNER_LABELS'
    timeout $((JOB_TIMEOUT_MIN * 60)) ./run.sh || true
  "
  RC=$?
  echo "==> [$VM] job 結束(exit $RC),銷毀 VM"

  # 4. 用完即毀
  kill "$TART_PID" 2>/dev/null; wait "$TART_PID" 2>/dev/null
  tart delete "$VM" 2>/dev/null

  # 心跳(選填)
  [[ -n "${HEALTHCHECK_URL:-}" ]] && curl -sf -m 10 "$HEALTHCHECK_URL" >/dev/null

  sleep 5
done
