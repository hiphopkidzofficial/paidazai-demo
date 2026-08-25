# 出租前安全加固清單

每一項都完成打勾後才能讓第一個客戶的 job 上線。
`setup/01-harden-macos.sh` 會自動處理標記 ⚙️ 的項目,其餘手動完成。

## 機器本體

- [ ] ⚙️ 建立專用標準帳號 `runner`(非管理員),runner 相關程序全部跑在這個帳號下
- [ ] 這台 Mac mini 上**不留任何個人資料**:不登入你自己的 Apple ID、
      不裝密碼管理器、不留 SSH 私鑰、瀏覽器不登入任何帳號
- [ ] ⚙️ 關閉所有共享服務:檔案共享、螢幕共享、遠端管理、AirDrop、AirPlay 接收
- [ ] ⚙️ 開啟 macOS 防火牆,封鎖所有 incoming 連線(runner 只需要 outbound 到 GitHub)
- [ ] 開啟 FileVault 磁碟加密
- [ ] ⚙️ 關閉自動登入圖形介面;runner 由 launchd 以背景程序啟動,不需要桌面登入
- [ ] macOS 自動安全性更新開啟(系統設定 → 一般 → 軟體更新 → 自動安裝安全性回應)

## 網路隔離

- [ ] 路由器上開獨立 VLAN(或至少 guest network),Mac mini 單獨放進去,
      與家中其他設備(NAS、電腦、IoT)完全隔離
- [ ] 路由器**不設任何 port forwarding** 到這台機器——self-hosted runner
      是 outbound polling 架構,完全不需要對外開 port
- [ ] 你自己要遠端管理:用 Tailscale 裝在 Mac mini 上(僅裝在 host,不裝進 VM),
      不要開公網 SSH
- [ ] VM 網路使用 Tart 預設 NAT 模式,不要用 bridged 模式

## Runner / VM 層

- [ ] runner 一律以 `--ephemeral` 註冊:一個 job 用完即解除註冊,配合 VM 刪除
- [ ] 每個 job 結束後 VM 整台刪除,下個 job 從乾淨基礎映像重新 clone
      (`03-runner-loop.sh` 已內建此流程)
- [ ] 基礎 VM 映像裡不放任何 secret;客戶的 secrets 由 GitHub Actions
      在 job 執行時注入,活在 VM 裡、隨 VM 銷毀
- [ ] 客戶 repo 設定確認:**public repo 必須關閉 fork PR 觸發 self-hosted runner**
      (Settings → Actions → 限制 self-hosted runner 只給指定 repo/branch),
      否則任何人發 PR 就能在你機器上跑程式碼。最安全:只接 private repo 客戶
- [ ] Runner group 權限設為只允許客戶指定的 repo,不要開放 org 全部 repo

## 營運

- [ ] 監控:簡單版用 [healthchecks.io](https://healthchecks.io) 免費方案,
      runner loop 每次完成 job ping 一次,超過閾值沒 ping 就發通知給你
- [ ] 電源:系統設定 → 節能 → 「停電後自動啟動」開啟;建議加一顆小 UPS
- [ ] 每月固定重建基礎 VM 映像(更新 Xcode / brew 套件),排在月初低峰時段
- [ ] 記錄每個客戶的 runner token 發放與撤銷日期;合約終止當天撤銷 runner

## 給客戶的承諾邊界(寫進合約)

- 你提供的是「盡力 99% 可用」的單機服務,不是資料中心 SLA
- 賠償上限 = 當月月費
- 你不備份客戶 job 產物;CI artifacts 由 GitHub 端保存
- 排定維護(映像重建)提前 48 小時通知
