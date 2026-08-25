#!/bin/bash
#
# 02-install-tart.sh — 安裝 Tart 並準備基礎 VM 映像(以 `runner` 帳號執行,不要 sudo)
#
# 用法:  bash 02-install-tart.sh
#
# 做的事:
#   1. 安裝 Homebrew(如果還沒裝)
#   2. 安裝 Tart(Apple Virtualization.framework 的 VM 管理工具)
#   3. 從 Cirrus Labs 官方 registry 拉一份含 Xcode 的 macOS 基礎映像,
#      存成本地映像 `base`(之後每個 CI job 都從它 clone 出全新 VM)
#
# 注意:
#   - 映像 50GB+,確認磁碟空間與網路(第一次拉要一段時間)
#   - Tart 對單機小規模使用免費;上架收費前到 https://tart.run 確認當下授權條款
#   - 映像版本清單見 https://github.com/cirruslabs/macos-image-templates
#     依客戶需要的 Xcode 版本挑選 tag

set -euo pipefail

# 依客戶需求換 tag(例:macos-sequoia-xcode:16.4)
BASE_IMAGE="${BASE_IMAGE:-ghcr.io/cirruslabs/macos-sequoia-xcode:latest}"

# --- 1. Homebrew ------------------------------------------------------------
if ! command -v brew &>/dev/null; then
  echo "==> 安裝 Homebrew"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  eval "$(/opt/homebrew/bin/brew shellenv)"
fi

# --- 2. Tart ----------------------------------------------------------------
echo "==> 安裝 Tart"
brew install cirruslabs/cli/tart

# --- 3. 基礎映像 ------------------------------------------------------------
if tart list | grep -q '^local[[:space:]]*base[[:space:]]'; then
  echo "==> 本地映像 'base' 已存在,略過(要更新請先 tart delete base)"
else
  echo "==> 拉取基礎映像:$BASE_IMAGE(50GB+,請耐心等)"
  tart clone "$BASE_IMAGE" base
fi

echo
echo "==> 驗證:啟動一次 base VM 確認能開機(Ctrl+C 結束)"
echo "    tart run base --no-graphics"
echo
echo "完成。下一步:設定 03-runner-loop.sh 的環境檔並啟動。"
