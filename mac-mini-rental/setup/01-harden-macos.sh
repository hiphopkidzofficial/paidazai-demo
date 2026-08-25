#!/bin/bash
#
# 01-harden-macos.sh — 出租前的 macOS 加固(在 Mac mini 上以管理員身分執行)
#
# 用法:  sudo bash 01-harden-macos.sh
#
# 做的事:
#   1. 建立專用標準帳號 `runner`(跑 CI 的程序全部掛在它底下)
#   2. 關閉所有共享 / 遠端服務(runner 架構只需要 outbound,不需要任何 incoming)
#   3. 開啟防火牆並封鎖 incoming 連線
#   4. 24/7 運轉設定:永不睡眠、停電後自動開機
#   5. 開啟自動安裝安全性更新
#
# 執行完之後,手動完成 docs/security-checklist.md 裡標記為「手動」的項目
# (FileVault、VLAN、Tailscale、不登入個人 Apple ID 等)。

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "請用 sudo 執行:sudo bash $0" >&2
  exit 1
fi

RUNNER_USER="runner"

# --- 1. 專用標準帳號 -------------------------------------------------------
if ! id "$RUNNER_USER" &>/dev/null; then
  echo "==> 建立標準帳號 '$RUNNER_USER'(會提示你設密碼,請用密碼管理器產生強密碼)"
  read -r -s -p "為 $RUNNER_USER 設定密碼: " RUNNER_PASS; echo
  sysadminctl -addUser "$RUNNER_USER" -fullName "CI Runner" -password "$RUNNER_PASS"
  unset RUNNER_PASS
else
  echo "==> 帳號 '$RUNNER_USER' 已存在,略過"
fi

# --- 2. 關閉共享 / 遠端服務 -------------------------------------------------
echo "==> 關閉共享服務"
systemsetup -setremotelogin off 2>/dev/null || true           # SSH(遠端管理改用 Tailscale)
launchctl disable system/com.apple.screensharing 2>/dev/null || true
launchctl bootout system/com.apple.screensharing 2>/dev/null || true
launchctl disable system/com.apple.smbd 2>/dev/null || true    # 檔案共享
launchctl bootout system/com.apple.smbd 2>/dev/null || true
defaults write /Library/Preferences/com.apple.NetworkBrowser DisableAirDrop -bool true

# --- 3. 防火牆:開啟 + 封鎖 incoming ---------------------------------------
echo "==> 開啟應用程式防火牆並封鎖 incoming 連線"
/usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
/usr/libexec/ApplicationFirewall/socketfilterfw --setblockall on
/usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on

# --- 4. 24/7 運轉 -----------------------------------------------------------
echo "==> 設定永不睡眠、停電自動重啟"
pmset -a sleep 0 disksleep 0 displaysleep 5 autorestart 1 womp 0

# --- 5. 自動安全性更新 ------------------------------------------------------
echo "==> 開啟自動安全性更新(大版本升級維持手動,避免半夜打斷客戶 job)"
defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticCheckEnabled -bool true
defaults write /Library/Preferences/com.apple.SoftwareUpdate ConfigDataInstall -bool true
defaults write /Library/Preferences/com.apple.SoftwareUpdate CriticalUpdateInstall -bool true
defaults write /Library/Preferences/com.apple.SoftwareUpdate AutomaticallyInstallMacOSUpdates -bool false

echo
echo "完成。接下來:"
echo "  1. 登出,改用 '$RUNNER_USER' 帳號登入"
echo "  2. 以 $RUNNER_USER 執行 02-install-tart.sh"
echo "  3. 對照 docs/security-checklist.md 完成手動項目"
