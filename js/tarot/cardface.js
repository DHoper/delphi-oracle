// 牌面：有正式牌面圖時使用圖；沒有時用黑金的暫代牌面（羅馬數字＋牌名）
import { CARDS, ROMAN, META } from "./data.js";
import { CONFIG } from "../config.js";

const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// 正逆位是兩張不同的牌圖：
//   大牌 assets/cards/major/NN.webp（正位）與 NN-r.webp（逆位）
//   小牌 assets/cards/minor/{wands|cups|swords|pentacles}-NN.webp（NN = 01–14，侍者 11、騎士 12、皇后 13、國王 14）與 -r 版本
export const artPath = (i, rev) => {
  const m = META[i], r = rev ? "-r" : "";
  return m.arcana === "major" ? `assets/cards/major/${String(i).padStart(2, "0")}${r}.webp` : `assets/cards/minor/${m.suit}-${String(m.rank).padStart(2, "0")}${r}.webp`;
};
// 暫代牌面上的花色記號（線刻）
const GLYPH = {
  wands: `<path d="M60 72v48M54 78l6-8 6 8M56 92h8M56 104h8" />`,
  cups: `<path d="M46 76h28c0 14-6 22-14 22s-14-8-14-22zM60 98v14M50 116h20" />`,
  swords: `<path d="M60 68v40M52 108h16M60 108v10M57 68l3-6 3 6" />`,
  pentacles: `<circle cx="60" cy="96" r="16"/><path d="M60 82l8.2 25.3-21.5-15.6h26.6l-21.5 15.6z" />`
};
// 哪些牌已有正式牌圖：CONFIG.CARD_ART 為 true（全部都有）或牌號陣列（只有這些有）
export const hasArt = i => CONFIG.CARD_ART === true || (Array.isArray(CONFIG.CARD_ART) && CONFIG.CARD_ART.includes(i));
export function faceSVG(i, rev = false) {
  const [zh, en] = CARDS[i], m = META[i];
  if (hasArt(i)) {
    return `<svg viewBox="0 0 120 200" role="img" aria-label="${esc(zh)}"><image href="${artPath(i, rev)}" width="120" height="200" preserveAspectRatio="xMidYMid slice"/></svg>`;
  }
  return `<svg viewBox="0 0 120 200" role="img" aria-label="${esc(zh)}">
<rect width="120" height="200" fill="${rev ? "#120607" : "#0b0907"}"/>
<rect x="5" y="5" width="110" height="190" rx="4" fill="none" stroke="${rev ? "#9e2f2a" : "#d9ac55"}" stroke-width="1"/>
<rect x="9" y="9" width="102" height="182" rx="2" fill="none" stroke="#8a6a2e" stroke-width=".6"/>
<text x="60" y="34" text-anchor="middle" font-family="Cinzel,serif" font-size="15" fill="#f3d48b">${ROMAN[i]}</text>
<circle cx="60" cy="96" r="30" fill="none" stroke="#8a6a2e" stroke-width=".8"/>
${m.arcana === "minor" ? `<g fill="none" stroke="${rev ? "#9e2f2a" : "#d9ac55"}" stroke-width="1.4" stroke-linejoin="round"${rev ? ' transform="rotate(180 60 96)"' : ""}>${GLYPH[m.suit]}</g>` : `<circle cx="60" cy="96" r="22" fill="none" stroke="#d9ac55" stroke-width=".6" stroke-dasharray="2 3"/>
<text x="60" y="${ROMAN[i].length > 3 ? 100 : 102}" text-anchor="middle" font-family="Cinzel,serif" font-size="${ROMAN[i].length > 3 ? 11 : 15}" fill="${rev ? "#c25a48" : "#d9ac55"}">${ROMAN[i]}</text>`}
<text x="60" y="160" text-anchor="middle" font-family="'Oracle Display','Noto Serif TC',serif" font-size="${zh.length > 4 ? 12 : zh.length > 3 ? 13 : 16}" font-weight="600" fill="#f3d48b">${esc(zh)}</text>
<text x="60" y="177" text-anchor="middle" font-family="Cinzel,serif" font-size="${en.length > 16 ? 5.6 : 7}" fill="#b8a582">${esc(en.toUpperCase())}</text>
</svg>`;
}
