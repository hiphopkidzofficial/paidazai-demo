# 客戶提案模板

用途:貼進社群私訊 / Email。`[]` 內自行替換。發出前先完成 dogfood 週,
把實測數據填進去——真實數字是整封信的說服力來源。

---

## 中文版(台灣 iOS 社群用)

主旨:你們的 iOS CI 每月燒多少 macOS 分鐘?我這邊快 2–3 倍、費用砍半

嗨 [名字],

看到你[在 X 上抱怨 CI 慢 / 在 iOS@Taipei 提到建置時間],想說這個或許幫得上:

我提供 **Apple Silicon 裸金屬的 GitHub Actions self-hosted runner**(M4 Mac mini),
分鐘數吃到飽,月費固定:

- **實測**:[你的 App 名] 完整建置+測試,GitHub 託管 runner 跑 [18] 分鐘,
  我的 M4 runner 跑 [7] 分鐘
- **費用**:單併發 US$[70]/月吃到飽。如果你們現在月燒超過 1,000 macOS 分鐘
  (≈US$80),第一個月就開始省錢
- **安全**:每個 job 跑在用完即毀的乾淨 VM 裡(Tart ephemeral),job 之間零殘留
- **接入**:workflow yaml 改一行 `runs-on: [self-hosted, macOS, arm64]`,
  10 分鐘內可以開始跑

首月半價試用,不滿意隨時停。要不要丟一個 workflow 過來試跑看看?

[你的名字]

---

## English version

Subject: Cut your iOS CI bill in half — bare-metal M4 runners, unlimited minutes

Hi [name],

Saw your post about [slow CI / macOS runner costs]. I run **bare-metal Apple
Silicon GitHub Actions runners** (M4 Mac mini) with flat monthly pricing:

- **Benchmark**: [your app]'s full build+test takes [18] min on GitHub-hosted
  macOS runners, [7] min on my M4 runner
- **Price**: US$[70]/mo for one concurrent runner, unlimited minutes. If you
  burn >1,000 macOS minutes/mo (≈US$80 on GitHub-hosted), you save from day one
- **Isolation**: every job runs in a fresh ephemeral VM (Tart), destroyed after
  each run — no state leaks between jobs
- **Setup**: change one line in your workflow
  (`runs-on: [self-hosted, macOS, arm64]`) and you're running in 10 minutes

First month 50% off, cancel anytime. Want to send over a workflow to test-drive?

[your name]

---

## 客戶上線流程(內部 SOP)

1. 客戶提供:GitHub org/repo 名稱、需要的 Xcode 版本
2. 你確認基礎映像已裝該 Xcode 版本(沒有就重建映像,約 1 小時)
3. 請客戶到 repo/org Settings → Actions → Runners → New self-hosted runner,
   把 registration token 給你(token 有效期短,約好時間即時交換)
4. 在 `03-runner-loop.sh` 的設定檔填入 token 對應的 URL,啟動 loop
5. 客戶改 workflow 的 `runs-on`,跑一個測試 job,雙方確認綠燈
6. 開訂閱連結,收到首款後正式開始計費
7. 把客戶加進 healthchecks 通知名單(可選:給客戶唯讀 status page)
