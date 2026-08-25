# Mac mini 出租啟動包

把一台閒置的 Apple Silicon Mac mini 變成穩定月租收入的完整方案。
目標客群:需要 macOS 環境的開發團隊(iOS CI/CD、macOS 建置、遠端 Mac 桌面)。

## 為什麼是這條路,不是算力平台

| 路線 | 2026 年行情 | 結論 |
|---|---|---|
| 掛加密算力平台(io.net 類) | 單台消費級機器分潤極少、代幣計價波動大 | ❌ 不值得 |
| 託管 Mac mini 整台出租 | 市場價 US$85–200/月(nozcloud、Macly、MacStadium 等) | ✅ 可行 |
| macOS CI runner 出租 | Cirrus Runners 收 US$150/月/併發 runner(吃到飽) | ✅ 最佳利基 |

2026 年 Q2 Apple 財報電話會議上 Tim Cook 點名 Mac mini / Mac Studio 因為
agentic AI 工作負載而全面缺貨——macOS 算力是賣方市場。

一台 Apple Silicon Mac mini 用 Virtualization.framework 最多同時跑 2 個 VM,
也就是 2 個併發 runner。定價低於大廠(例如每個 runner US$60–100/月)仍有競爭力:

- **營收上限**:2 runner × US$60–100 ≈ **US$120–200/月**(約 NT$3,800–6,400)
- **成本**:電費(Mac mini 滿載約 40W,24/7 一個月電費不到 NT$150)+ 家用網路
- **回本**:一台 M4 Mac mini 約 NT$20,000,最快 4–6 個月回本

## 目錄結構

```
mac-mini-rental/
├── README.md                 ← 本檔:計畫總覽 + 30 天啟動時程
├── docs/
│   ├── security-checklist.md ← 出租前必做的隔離與加固清單
│   ├── pricing.md            ← 定價策略與市場錨點
│   └── client-offer.md       ← 找客戶用的提案模板(中英文)
└── setup/
    ├── 01-harden-macos.sh    ← macOS 加固:專用帳號、防火牆、24/7 運轉設定
    ├── 02-install-tart.sh    ← 安裝 Tart 虛擬化工具 + 拉基礎 VM 映像
    ├── 03-runner-loop.sh     ← ephemeral GitHub Actions runner 主迴圈
    └── com.rental.runner.plist ← launchd 守護程序,開機自動跑、掛掉自動重啟
```

## 架構:為什麼一定要用 VM

**絕對不要**直接把 self-hosted runner 裝在 macOS 本機上出租。客戶的 CI job
會執行任意程式碼,等於把你的機器和家用網路整個交出去。正確做法:

```
客戶的 GitHub repo
      │  (CI job)
      ▼
GitHub Actions ──► 你的 Mac mini
                     └── Tart ephemeral VM(每個 job 一台全新 VM)
                           ├── job 跑完 → VM 整台刪除
                           └── 下一個 job → 從乾淨映像重新複製
```

- 每個 job 都在**用完即毀**的 VM 裡跑,job 之間零殘留、互不污染
- VM 網路走 NAT,搭配路由器把 Mac mini 放獨立 VLAN,碰不到你家其他設備
- runner 以 `--ephemeral` 模式註冊,跑完一個 job 自動解除註冊

工具選擇:[Tart](https://tart.run)(Cirrus Labs 出品,單機小規模使用免費,
上架前到 tart.run 確認當下授權條款)。同類替代品:Tartelet、Cilicon、sand。

## 30 天啟動時程

**第 1 週:機器就緒**
1. 在 Mac mini 上依序執行 `setup/01` → `02` → `03`(細節見各腳本開頭註解)
2. 過一遍 `docs/security-checklist.md`,路由器設好 VLAN
3. 裝好 launchd plist,重開機驗證 runner 自動上線

**第 2 週:自己當第一個客戶(dogfood)**
1. 拿自己任一個 repo 的 CI 切到 self-hosted runner 跑一週
2. 驗證:連續 job 不互相污染、斷電後自動恢復、Xcode 版本符合需求
3. 記下實測建置速度——M 系列裸金屬通常比 GitHub 託管 macOS runner 快 2–3 倍,這是你的賣點

**第 3 週:找前兩個客戶**
- 目標:有 iOS/macOS App、每月 GitHub Actions macOS 分鐘數爆表的小團隊
  (GitHub 託管 macOS runner 收 US$0.08/分鐘,月燒 2,000 分鐘就是 US$160——你的方案直接省一半以上)
- 管道:台灣 iOS 開發者社群(iOS@Taipei、Swift Taipei)、接案社群、
  Twitter/X 上抱怨 CI 又慢又貴的 iOS 開發者、你自己的人脈
- 用 `docs/client-offer.md` 的模板發提案

**第 4 週:上線收費**
1. 第一個月半價當試用,綁月訂閱(收款:Gumroad/Lemon Squeezy 或直接開發票)
2. 給客戶 runner 註冊:請客戶提供 org 的 runner registration token,你來掛
3. 立 SLA 期望值:寫明「盡力 99%,非資料中心等級」,見 pricing.md 的條款清單

## 風險與合規(務必先讀)

- **安全**:VM 隔離 + VLAN 是底線,security-checklist.md 每一項都要打勾才上線
- **ISP**:多數家用寬頻條款限制商用伺服器;流量其實不大(CI 主要吃 CPU),
  但建議升級商用方案或至少確認條款,並申請固定 IP
- **稅務**:穩定月收入屬應稅所得,記帳並申報
- **macOS 授權**:Apple 軟體授權允許在 Apple 硬體上虛擬化最多 2 份 macOS,
  這也是 2 VM 上限的由來——不要試圖繞過
- **停機賠償**:合約寫清楚賠償上限 = 當月費用,避免無限責任

## 下一步(照順序做)

1. 把 `setup/` 三支腳本 + plist 複製到 Mac mini 上執行(腳本開頭有使用說明)
2. 跑完 security checklist
3. 用自己的 repo 驗一週
4. 發出第一封提案信
