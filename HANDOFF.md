# 神諭塔羅 — 交接文件（2026-11-26 更新）

靜態網站（ES modules，無建置步驟），預計發布到 GitHub Pages（repo：DHoper/delphi-oracle，遠端仍是空的，尚未推送）。
- 預覽：https://claude.ai/artifact/V2teJYKfZhjJE8eUjwQVnx
- 本機：`C:\Users\dhope\delphi-oracle`，`python -m http.server 8765` 後開 `index.html`
- 網站名稱：**神諭塔羅**（不再叫「德爾菲神諭」；場景仍是德爾菲神殿）

---

## 一、需求方指示過的要點（新的在前）

### 11-26
- 名稱改為「神諭塔羅」。
- 要像姊妹站「問名堂」一樣先有進入畫面；進入畫面＝**山巒上的德爾菲神殿，撥開門口的帷幕走進去**，帷幕本身就是開始按鈕。帶著忐忑撥開帷幕 → 走進神殿 → 見證異相 → 領受神諭。
- 入口要有「布景感、臨場感」，不能像卡面；但也不能太寫實——**畫風必須和內殿同一套黑金線刻**（比卡牌簡化）。
- 要有分享功能，比照外面心理測驗／占卜站的 SOP（本質相同，只是美術更精緻）。
- 選牌陣不可再用「空牌框＋滑動」那套 UI。
- UI、美術細節要細修；桌機、平板 RWD 都要顧。
- 文本要有古風：以「汝」稱求問者，避免 AI 用語。
- 設計細節由開發方自行決定，不要丟選擇題給需求方。
- 卡牌素材由需求方匯出（`delphi-tarot-assets.zip`）：0～10 號大牌正逆位、牌框、牌背、神話對應表、提示詞規範。

### 先前（仍有效）
- 主題：德爾菲神殿、巨蟒皮同的凝視。先做塔羅，之後加入其他命理系統。
- 手機為主，各尺寸 RWD；核心畫面是抽牌、翻牌、解讀。
- 巨蟒從中央凝視，頭不能太大；蛇頭與蛇身同一張圖、緩慢擺動。
- 主色金與黑；所有 UI 用生成素材，禁止原生 HTML 外觀；生成圖不手工修改。
- 一般模式不讓使用者輸入文字；只有「叩問神諭」（AI）可以輸入。
- 正逆位是兩張不同的牌圖；78 張都要。
- 解讀口吻像希臘神諭，不要「選項 A/B」等現代字眼，不要「僅供娛樂」之類的話。

---

## 二、目前狀態

### 流程
入口（撥開帷幕）→ 內殿巨蟒睜眼 → 取預兆（拖進火盆）→ 擇牌陣（四枚星徽）→ 按住封印 → 古典洗牌、切牌 → 抽牌 → 翻牌 → 神諭 → 解讀紙卷 → 分享／叩問神諭（AI）。

### 11-26 新增
- **入口**（`js/scene/gate.js`，`assets/gate/`）：直幅、橫幅兩張全景；帷幕沿中縫裁成左右兩片疊回門口，手指撥開或輕觸即拉開，門內的光用 CSS 畫。拉開後鏡頭推近、光吞沒畫面，再現出內殿。載入進度＝標題下的眼紋分隔線點亮。回訪者有「直接入殿」。寬螢幕標題在左、說明在右；平板直式標題移到石階上。
- **擇牌陣**：四枚星徽（`assets/spreads/`）：此刻＝天頂之日、因果＝三相之月、抉擇＝星下岔路、本心＝迷宮之火。選定前牌框不出現、封印不出現。
- **分享**（`js/share.js`）：
  - 神諭連結 `?r=` 編入牌陣、預兆、牌與正逆位（不含問題與 AI 內容）；朋友點開會在入口看到「有人在神殿前留下一則神諭」，可展開那則神諭或自己求一次。
  - 神諭圖卡 1080×1920（限時動態比例），canvas 現場繪製。
  - 分享面板：傳給朋友（Web Share，含圖檔）、存下圖卡、複製連結、LINE、Facebook、Threads。
  - `og.jpg`（1200×630）與 `thumb.jpg`：`tools/og.html` + `tools/make-og.py` 產生。
- **卡牌圖**：0～10 號大牌正逆位接上（`assets/cards/major/NN.webp`、`NN-r.webp`），新牌背；`CONFIG.CARD_ART` 改成牌號陣列，沒圖的牌用暫代牌面。
- **叩問神諭（DeepSeek）上線**：Worker `https://delphi-oracle-ai.oracle-tarot.workers.dev/`，見 `worker/README.md`。模型 `deepseek-flash`，關閉思考直接串流；網站只送解讀依據，系統提示在 `js/oracle-prompt.js`（網站與 Worker 共用，改了要重新部署 Worker）。
- **字體**：`tools/subset-fonts.py <GenRyuMin2TC-B.otf>` 重新子集化（原始字型放在 `~/Downloads/genryu/`）。

### 未完成 / 待處理
1. 11～21 號大牌、56 張小牌的牌圖（需求方繪製中）。
2. 內殿的火盆火焰仍是線刻線條＋SVG 熱氣，需求方要求細緻粒子火焰（先前就未達標）。
3. 抽牌時 78 張的牌列在桌機上太密，像一條帶子，可改成弧形牌扇或分段。
4. 尚未推送 GitHub、未開 GitHub Pages；分享連結與 og 圖網址都以 `https://dhoper.github.io/delphi-oracle/` 為準，部署前點開會是 404。
5. 舊素材可清理：`assets/serpent/*`、`assets/deco/column.webp`、`assets/deco/brazier.webp`、`assets/ui/tablet.webp`、`js/scene/serpent.js`。

---

## 三、技術說明
- `js/main.js` 的 `layout()` 以內殿全景為基準計算牌位、封印、星徽位置；`SCENES` 存眼睛、下顎、石桌、火盆、地縫座標。
- 巨蟒擺動與眨眼：`js/scene/temple.js`（WebGL），用原圖、去頭版 plate、遮罩 mask 三張同源素材。
- 入口座標：`js/scene/gate.js` 的 `SCENES.door`＝帷幕左緣、中縫、右緣、上緣、下緣（佔原圖百分比）。
- 素材原圖：`C:\Users\dhope\delphi-oracle-art\raw\`（入口、星徽）；卡牌素材包解壓在 `delphi-oracle-art\cards-zip\`。
- Recraft 自訂風格「希臘神話塔羅 黑金銅版畫」：`abe88b0f-7fd9-41c2-9900-0bfc8eea9923`。場景類素材用 `nano_banana_pro` 以內殿全景為畫風參考生成，才會與內殿一致。
- 測試：Playwright 全流程截圖（360×640、390×844、768×1024、1366×768、1920×1080）。
