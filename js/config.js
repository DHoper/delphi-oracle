// 網站設定
export const CONFIG = {
  // 正式網址：分享連結、神諭圖卡上的網址都用這個（GitHub Pages）。留空時用目前網址
  SITE_URL: "https://dhoper.github.io/delphi-oracle/",
  // DeepSeek 中繼站網址（Cloudflare Worker，見 worker/README.md）。
  // 留空時：在 Claude 預覽中改用 Claude；在 GitHub Pages 上則不顯示「叩問神諭」。
  AI_ENDPOINT: "https://delphi-oracle-ai.oracle-tarot.workers.dev/",
  // 正式牌面圖：assets/cards/major/NN.webp（正位）與 NN-r.webp（逆位）。
  // true＝78 張都有；陣列＝只有這些牌號有圖，其餘用暫代牌面。目前完成 0～10 號大牌
  CARD_ART: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  // 牌組只用 22 張大阿爾克那（偉特正規牌組是 78 張；需求方決定排除小牌）。設為 false 恢復 78 張
  MAJOR_ONLY: true,
  // 擴充牌義資料（data/frames.json、data/major/NN.json）；有放檔案時才設為 true，免得每次載入都多出幾十個 404 請求
  EXT_DATA: false
};
