// 分享：神諭連結（把牌陣編進網址）、神諭圖卡（1080×1920，適合 IG／LINE 限時動態）、分享面板
// 網址只帶牌陣、預兆與牌，不帶求問者寫下的問題，也不帶 AI 的細說
import { CARDS, SPREADS, ROMAN, META } from "./tarot/data.js";
import { CONFIG } from "./config.js";
import { artPath, hasArt } from "./tarot/cardface.js";

const SP = ["one", "time", "choice", "mind"], TP = ["auto", "love", "career", "money", "health", "growth", "gen"];
const b36 = (n, len) => n.toString(36).padStart(len, "0");

// ---------------- 神諭連結 ----------------
export function encodeReading({ spread, topic, seed, picked }) {
  return b36(SP.indexOf(spread), 1) + b36(Math.max(0, TP.indexOf(topic)), 1) + b36((seed | 0) % 1296, 2) + picked.map(c => b36(c.i * 2 + (c.rev ? 1 : 0), 2)).join("");
}
export function decodeReading(s) {
  if (!/^[0-9a-z]{6,24}$/.test(s || "")) return null;
  const spread = SP[parseInt(s[0], 36)], topic = TP[parseInt(s[1], 36)], seed = parseInt(s.slice(2, 4), 36), body = s.slice(4);
  if (!spread || !topic || body.length % 2) return null;
  const picked = [];
  for (let k = 0; k < body.length; k += 2) { const v = parseInt(body.slice(k, k + 2), 36), i = v >> 1; if (!CARDS[i]) return null; picked.push({ i, rev: !!(v & 1) }); }
  if (picked.length !== SPREADS[spread].positions.length || new Set(picked.map(c => c.i)).size !== picked.length) return null;
  return { spread, topic, seed, picked };
}
export const siteURL = () => CONFIG.SITE_URL || location.href.split(/[?#]/)[0];
export const readingURL = code => `${siteURL()}?r=${code}`;
export function shareText(R) {
  const cards = R.cards.map(c => `${c.name}${c.rev ? "（逆）" : ""}`).join("、");
  return `吾於神諭塔羅求得「${R.verdict.text}」——${cards}。汝亦來求一諭：`;
}

// ---------------- 神諭圖卡 ----------------
const W = 1080, H = 1920;
const imgCache = {};
const loadImg = src => (imgCache[src] ||= new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }));
const DISP = "'Oracle Display','Noto Serif TC',serif", BODY = "'Noto Serif TC',serif", LATIN = "Cinzel,serif";

// 逐字排出，可加字距；回傳寬度
function spaced(ctx, text, x, y, sp = 0, align = "center") {
  const chars = [...text], ws = chars.map(ch => ctx.measureText(ch).width), total = ws.reduce((a, b) => a + b, 0) + sp * (chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const a0 = ctx.textAlign; ctx.textAlign = "left";
  chars.forEach((ch, k) => { ctx.fillText(ch, cx, y); cx += ws[k] + sp; });
  ctx.textAlign = a0; return total;
}
// 中文斷行：行首不放標點
function wrap(ctx, text, maxW, sp = 0) {
  const NO_HEAD = "，。、；：！？」』）》…—", lines = []; let line = "";
  for (const ch of text) {
    const t = line + ch, w = ctx.measureText(t).width + sp * (t.length - 1);
    if (w > maxW && line && !NO_HEAD.includes(ch)) { lines.push(line); line = ch; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
const goldFill = (ctx, y0, y1) => { const g = ctx.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, "#fbe7b0"); g.addColorStop(0.55, "#d9a64e"); g.addColorStop(1, "#9c6a26"); return g; };

// 暫代牌面：與 cardface.js 的 SVG 同一套幾何（viewBox 120×200），正式牌圖到位後改畫圖
const GLYPH = { wands: "M60 72v48M54 78l6-8 6 8M56 92h8M56 104h8", cups: "M46 76h28c0 14-6 22-14 22s-14-8-14-22zM60 98v14M50 116h20", swords: "M60 68v40M52 108h16M60 108v10M57 68l3-6 3 6" };
function drawPlaceholderFace(ctx, i, rev) {
  const m = META[i], [zh, en] = CARDS[i], edge = rev ? "#9e2f2a" : "#d9ac55";
  ctx.fillStyle = rev ? "#120607" : "#0b0907"; ctx.fillRect(0, 0, 120, 200);
  ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.strokeRect(5, 5, 110, 190);
  ctx.strokeStyle = "#8a6a2e"; ctx.lineWidth = 0.6; ctx.strokeRect(9, 9, 102, 182);
  ctx.beginPath(); ctx.arc(60, 96, 30, 0, Math.PI * 2); ctx.lineWidth = 0.8; ctx.stroke();
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  if (m.arcana === "major") {
    ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.arc(60, 96, 22, 0, Math.PI * 2); ctx.strokeStyle = edge; ctx.lineWidth = 0.6; ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = "#f3d48b"; ctx.font = `600 ${ROMAN[i].length > 3 ? 13 : 17}px ${LATIN}`; ctx.fillText(ROMAN[i], 60, 102);
  } else {
    ctx.save(); if (rev) { ctx.translate(60, 96); ctx.rotate(Math.PI); ctx.translate(-60, -96); }
    ctx.strokeStyle = edge; ctx.lineWidth = 1.4; ctx.lineJoin = "round";
    if (m.suit === "pentacles") { ctx.beginPath(); ctx.arc(60, 96, 16, 0, Math.PI * 2); ctx.stroke(); ctx.stroke(new Path2D("M60 82l8.2 25.3-21.5-15.6h26.6l-21.5 15.6z")); }
    else ctx.stroke(new Path2D(GLYPH[m.suit]));
    ctx.restore();
  }
  ctx.fillStyle = "#f3d48b"; ctx.font = `600 ${zh.length > 4 ? 12 : zh.length > 3 ? 13 : 16}px ${DISP}`; ctx.fillText(zh, 60, 160);
  ctx.fillStyle = "#b8a582"; ctx.font = `${en.length > 16 ? 5.6 : 7}px ${LATIN}`; ctx.fillText(en.toUpperCase(), 60, 177);
}

export async function renderShareCard(R, { shared = false } = {}) {
  await Promise.all([`700 64px ${DISP}`, `600 30px ${LATIN}`, `400 30px ${BODY}`, `600 30px ${BODY}`].map(f => document.fonts.load(f, "神諭塔羅ORACLE")).concat(document.fonts.ready)).catch(() => {});
  const [bg, frame, divider, cornerTR, cornerBR] = await Promise.all(["assets/sanctum/temple-portrait.webp", "assets/ui/slot-frame.webp", "assets/ui/divider.webp", "assets/ui/corner-tr.webp", "assets/ui/corner-br.webp"].map(loadImg));
  const arts = await Promise.all(R.cards.map(c => (hasArt(c.id) ? loadImg(artPath(c.id, c.rev)) : null)));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d");

  // 底：內殿全景（直幅），巨蟒在上方凝視；四周與下半壓暗，讓牌與字讀得清楚
  ctx.fillStyle = "#060508"; ctx.fillRect(0, 0, W, H);
  if (bg) { const s = Math.max(W / bg.width, H / bg.height), dw = bg.width * s, dh = bg.height * s; ctx.drawImage(bg, (W - dw) / 2, 0, dw, dh); }
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "rgba(6,5,8,.78)"); g.addColorStop(0.1, "rgba(6,5,8,.25)"); g.addColorStop(0.3, "rgba(6,5,8,.2)"); g.addColorStop(0.42, "rgba(6,5,8,.72)"); g.addColorStop(1, "rgba(6,5,8,.94)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  g = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.3, W / 2, H * 0.45, W * 0.95); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  // 四角月桂
  const cs = 210;
  if (cornerTR) { ctx.drawImage(cornerTR, W - cs - 28, 28, cs, cs); ctx.save(); ctx.scale(-1, 1); ctx.drawImage(cornerTR, -cs - 28, 28, cs, cs); ctx.restore(); }
  if (cornerBR) { ctx.drawImage(cornerBR, W - cs - 28, H - cs - 28, cs, cs); ctx.save(); ctx.scale(-1, 1); ctx.drawImage(cornerBR, -cs - 28, H - cs - 28, cs, cs); ctx.restore(); }

  // 標題
  ctx.textBaseline = "alphabetic"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 18;
  ctx.font = `700 76px ${DISP}`; ctx.fillStyle = goldFill(ctx, 90, 170); spaced(ctx, "神諭塔羅", W / 2, 168, 34);
  ctx.font = `600 24px ${LATIN}`; ctx.fillStyle = "#b8a582"; spaced(ctx, "ORACLE TAROT · DELPHI", W / 2, 218, 7);

  // 牌：依牌陣橫排，牌框用牌位素材
  const n = R.cards.length, cw = n === 1 ? 360 : 268, ch = cw / 0.6, gap = 52, top = 700;
  const total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
  ctx.font = `600 34px ${DISP}`; ctx.fillStyle = "#b8a582";
  R.cards.forEach((c, k) => {
    const x = x0 + k * (cw + gap);
    ctx.shadowBlur = 0; ctx.fillStyle = "#c9b48a"; ctx.font = `600 32px ${DISP}`;
    if (c.position && n > 1) spaced(ctx, c.position, x + cw / 2, top - 44, 10);
    ctx.shadowColor = "rgba(243,212,139,.35)"; ctx.shadowBlur = 40; ctx.fillStyle = "#000"; ctx.fillRect(x, top, cw, ch); ctx.shadowBlur = 0;
    ctx.save(); ctx.beginPath(); ctx.rect(x, top, cw, ch); ctx.clip();
    if (arts[k]) { const im = arts[k], s2 = Math.max(cw / im.width, ch / im.height); ctx.drawImage(im, x + (cw - im.width * s2) / 2, top + (ch - im.height * s2) / 2, im.width * s2, im.height * s2); }
    else { ctx.translate(x, top); ctx.scale(cw / 120, ch / 200); drawPlaceholderFace(ctx, c.id, c.rev); }
    ctx.restore();
    if (frame) ctx.drawImage(frame, x - cw * 0.08, top - ch * 0.06, cw * 1.16, ch * 1.12);
    ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 10;
    ctx.font = `700 ${c.name.length > 4 ? 34 : 40}px ${DISP}`; ctx.fillStyle = "#f3d48b"; spaced(ctx, c.name, x + cw / 2, top + ch + 96, 4);
    ctx.font = `400 28px ${BODY}`; ctx.fillStyle = c.rev ? "#d0806f" : "#b8a582"; spaced(ctx, c.orientation, x + cw / 2, top + ch + 140, 8);
  });

  // 神諭一句
  let y = top + ch + 250;
  ctx.font = `700 56px ${DISP}`; const lines = wrap(ctx, R.verdict.text, 860, 6);
  ctx.shadowColor = "rgba(0,0,0,.95)"; ctx.shadowBlur = 16;
  lines.slice(0, 3).forEach((l, k) => { ctx.fillStyle = goldFill(ctx, y + k * 80 - 50, y + k * 80 + 10); spaced(ctx, l, W / 2, y + k * 80, 6); });
  y += Math.min(3, lines.length) * 80 + 6;
  ctx.shadowBlur = 0; ctx.font = `400 28px ${BODY}`; ctx.fillStyle = "#b8a582";
  spaced(ctx, `所問　${R.topic.label}　・　目光落於　${SPREADS[R.spread.id].gaze}`, W / 2, y, 2);

  // 底部：分隔線、邀請與網址
  if (divider) { const dw = 640, dh = dw * divider.height / divider.width; ctx.drawImage(divider, (W - dw) / 2, H - 300, dw, dh); }
  ctx.font = `600 34px ${DISP}`; ctx.fillStyle = "#e9cf91"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 10;
  spaced(ctx, shared ? "在巨蟒的凝視下，汝亦來抽一次" : "在巨蟒的凝視下，抽出汝之牌", W / 2, H - 186, 6);
  ctx.font = `600 26px ${LATIN}`; ctx.fillStyle = "#b8a582"; spaced(ctx, siteURL().replace(/^https?:\/\//, "").replace(/\/$/, ""), W / 2, H - 132, 3);
  return cv;
}

// ---------------- 分享面板 ----------------
export function createShareSheet({ audio } = {}) {
  const $ = id => document.getElementById(id);
  const sheet = $("share"), img = $("shareImg"), status = $("shareStatus");
  let blob = null, url = "", R = null, text = "", blobURL = "";
  const canShareFiles = f => { try { return !!(navigator.canShare && navigator.canShare({ files: [f] })); } catch (_) { return false; } };
  const say = t => { status.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => (status.textContent = ""), 2400); };
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (_) { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  }
  const open = (u, w = 620, h = 680) => window.open(u, "_blank", `noopener,width=${w},height=${h}`);
  const actions = {
    native: async () => {
      const file = new File([blob], "oracle-tarot.jpg", { type: "image/jpeg" });
      try {
        if (canShareFiles(file)) await navigator.share({ files: [file], text: text + url });
        else await navigator.share({ title: "神諭塔羅", text, url });
      } catch (e) { if (e && e.name !== "AbortError") say("無法開啟分享"); }
    },
    save: () => { const a = document.createElement("a"); a.href = blobURL; a.download = "oracle-tarot.jpg"; document.body.appendChild(a); a.click(); a.remove(); say("已存下神諭圖卡"); },
    line: () => open(`https://line.me/R/share?text=${encodeURIComponent(text + url)}`),
    facebook: () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`),
    threads: () => open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text + url)}`),
    link: async () => say((await copy(url)) ? "已複製神諭連結" : "無法複製，請長按網址列"),
    text: async () => say((await copy(R.plain)) ? "已抄錄全文" : "無法抄錄")
  };
  sheet.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (b) { actions[b.dataset.act](); return; }
    if (e.target.closest("[data-close]") || e.target === sheet) close();
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) close(); });
  function close() { sheet.classList.remove("open"); setTimeout(() => (sheet.hidden = true), 350); }
  return {
    async open(reading, code, { shared = false, plain = "" } = {}) {
      R = reading; R.plain = plain; url = readingURL(code); text = shareText(R);
      sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add("open"));
      img.removeAttribute("src"); sheet.classList.add("busy"); status.textContent = "";
      const cv = await renderShareCard(R, { shared });
      blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.9));
      if (blobURL) URL.revokeObjectURL(blobURL); blobURL = URL.createObjectURL(blob); img.src = blobURL;
      sheet.classList.remove("busy");
      const file = new File([blob], "oracle-tarot.jpg", { type: "image/jpeg" });
      sheet.querySelector('[data-act="native"]').hidden = !navigator.share;
      sheet.classList.toggle("files", canShareFiles(file));
      if (audio) audio.rustle();
    }
  };
}
