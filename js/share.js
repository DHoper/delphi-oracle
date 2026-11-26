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

// 讖語斷行：整句放不下時，優先在逗號、分號處斷開（兩半都放得下才這樣斷），否則照一般斷行
function byComma(ctx, text, maxW, sp) {
  const fits = t => ctx.measureText(t).width + sp * (t.length - 1) <= maxW;
  if (fits(text)) return Object.assign([text], { clean: true });
  const m = [...text.matchAll(/[，；：]/g)].map(x => x.index + 1).sort((a, b) => Math.abs(a - text.length / 2) - Math.abs(b - text.length / 2));
  for (const k of m) { const a = text.slice(0, k), b = text.slice(k); if (fits(a) && fits(b)) return Object.assign([a, b], { clean: true }); }
  return wrap(ctx, text, maxW, sp);
}
// 女祭司之言：第一段若是一句短讖語就獨立出來，其餘是正文
export function splitOracle(text) {
  const parts = String(text || "").replace(/\r/g, "").replace(/\*\*|__/g, "").split(/\n\s*\n/).map(x => x.replace(/\n+/g, "").trim()).filter(Boolean);
  return parts.length && parts[0].length <= 34 ? { omen: parts[0], body: parts.slice(1) } : { omen: "", body: parts };
}
const cardsLine = R => R.cards.map(c => `${R.cards.length > 1 ? c.position + "・" : ""}${c.name}${c.rev ? "（逆）" : ""}`).join("　");
export function shareText(R, ai) {
  const { omen } = splitOracle(ai);
  return `吾於神諭塔羅求得一諭：「${omen || R.verdict.text}」\n${cardsLine(R)}\n汝亦來求一諭：`;
}
// 摘錄：女祭司之言的第一段（截到約 n 字，句讀處收尾）；沒有 AI 時用古法判斷說明
function excerpt(R, ai, n) {
  const { body } = splitOracle(ai); let t = body[0] || R.verdict.detail || "";
  if (t.length > n) { const cut = t.slice(0, n), k = Math.max(cut.lastIndexOf("。"), cut.lastIndexOf("；"), cut.lastIndexOf("，")); t = (k > n * 0.6 ? cut.slice(0, k) : cut) + "……"; }
  return t;
}
async function fontsReady() {
  await Promise.all([`700 64px ${DISP}`, `600 30px ${LATIN}`, `400 30px ${BODY}`, `600 30px ${BODY}`].map(f => document.fonts.load(f, "神諭塔羅ORACLE汝")).concat(document.fonts.ready)).catch(() => {});
}
function drawCard(ctx, c, art, frame, x, y, cw, ch) {
  ctx.save(); ctx.shadowColor = "rgba(243,212,139,.35)"; ctx.shadowBlur = 40; ctx.fillStyle = "#000"; ctx.fillRect(x, y, cw, ch); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.clip();
  if (art) { const s2 = Math.max(cw / art.width, ch / art.height); ctx.drawImage(art, x + (cw - art.width * s2) / 2, y + (ch - art.height * s2) / 2, art.width * s2, art.height * s2); }
  else { ctx.translate(x, y); ctx.scale(cw / 120, ch / 200); drawPlaceholderFace(ctx, c.id, c.rev); }
  ctx.restore();
  if (frame && !art) ctx.drawImage(frame, x - cw * 0.08, y - ch * 0.06, cw * 1.16, ch * 1.12);
}
function background(ctx, bg, w, h, strength = 1) {
  ctx.fillStyle = "#060508"; ctx.fillRect(0, 0, w, h);
  if (bg) { const s = Math.max(w / bg.width, h / bg.height), dw = bg.width * s, dh = bg.height * s; ctx.drawImage(bg, (w - dw) / 2, (h - dh) * 0.15, dw, dh); }
  let g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, `rgba(6,5,8,${0.8 * strength})`); g.addColorStop(0.18, `rgba(6,5,8,${0.45 * strength})`); g.addColorStop(0.5, `rgba(6,5,8,${0.7 * strength})`); g.addColorStop(1, `rgba(6,5,8,${0.95})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  g = ctx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.3, w / 2, h * 0.45, Math.max(w, h) * 0.75); g.addColorStop(0, "rgba(0,0,0,0)"); g.addColorStop(1, "rgba(0,0,0,.55)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
}

// 直幅圖卡（1080×1920，限時動態）：讖語為主標、正式牌圖、女祭司之言摘錄
export async function renderShareCard(R, { shared = false, ai = "", question = "" } = {}) {
  await fontsReady();
  const [bg, frame, divider, cornerTR, cornerBR] = await Promise.all(["assets/sanctum/temple-portrait.webp", "assets/ui/slot-frame.webp", "assets/ui/divider.webp", "assets/ui/corner-tr.webp", "assets/ui/corner-br.webp"].map(loadImg));
  const arts = await Promise.all(R.cards.map(c => (hasArt(c.id) ? loadImg(artPath(c.id, c.rev)) : null)));
  const cv = document.createElement("canvas"); cv.width = W; cv.height = H; const ctx = cv.getContext("2d");
  background(ctx, bg, W, H);
  const cs = 190;
  if (cornerTR) { ctx.drawImage(cornerTR, W - cs - 26, 26, cs, cs); ctx.save(); ctx.scale(-1, 1); ctx.drawImage(cornerTR, -cs - 26, 26, cs, cs); ctx.restore(); }
  if (cornerBR) { ctx.drawImage(cornerBR, W - cs - 26, H - cs - 26, cs, cs); ctx.save(); ctx.scale(-1, 1); ctx.drawImage(cornerBR, -cs - 26, H - cs - 26, cs, cs); ctx.restore(); }
  ctx.textBaseline = "alphabetic"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 16;
  ctx.font = `700 64px ${DISP}`; ctx.fillStyle = goldFill(ctx, 90, 160); spaced(ctx, "神諭塔羅", W / 2, 150, 30);
  ctx.font = `600 22px ${LATIN}`; ctx.fillStyle = "#b8a582"; spaced(ctx, "ORACLE TAROT · DELPHI", W / 2, 194, 7);
  // 先量好每一塊的高度，整組在標題與頁尾之間垂直置中
  const n = R.cards.length, cw = n === 1 ? 380 : 300, ch = cw * 1252 / 732, gap = 36, total = n * cw + (n - 1) * gap, x0 = (W - total) / 2;
  const { omen } = splitOracle(ai), hero = omen || R.verdict.text;
  ctx.font = `600 32px ${DISP}`; const ql = question ? wrap(ctx, `所問「${question}」`, 900, 2).slice(0, 2) : [];
  ctx.font = `700 58px ${DISP}`; const hl = byComma(ctx, hero, 900, 6).slice(0, 2);
  ctx.font = `400 33px ${BODY}`; const ex = excerpt(R, ai, 190), el = ex ? wrap(ctx, ex, 880, 1).slice(0, 7) : []; const lh = 54;
  const blockH = (ql.length ? ql.length * 46 + 24 : 0) + (n > 1 ? 50 : 10) + ch + 70 + 70 + hl.length * 80 + 10 + (el.length ? el.length * lh + 50 : 0);
  const avail = (H - 280) - 230; let y = 230 + Math.max(0, (avail - blockH) / 2);
  if (ql.length) { ctx.font = `600 32px ${DISP}`; ctx.fillStyle = "#e6d3a6"; ql.forEach((l, k) => spaced(ctx, l, W / 2, y + 32 + k * 46, 2)); y += ql.length * 46 + 24; }
  const top = y + (n > 1 ? 50 : 10);
  R.cards.forEach((c, k) => {
    const x = x0 + k * (cw + gap);
    ctx.shadowBlur = 8; ctx.fillStyle = "#c9b48a"; ctx.font = `600 28px ${DISP}`;
    if (n > 1) spaced(ctx, c.position, x + cw / 2, top - 18, 10);
    drawCard(ctx, c, arts[k], frame, x, top, cw, ch);
    ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 10; ctx.font = `700 ${c.name.length > 4 ? 30 : 34}px ${DISP}`; ctx.fillStyle = "#f3d48b";
    spaced(ctx, c.name + (c.rev ? "・逆" : ""), x + cw / 2, top + ch + 50, 3);
  });
  y = top + ch + 140;
  // 讖語（AI 的第一句；沒有就用古法神諭）
  ctx.font = `700 58px ${DISP}`; ctx.shadowColor = "rgba(0,0,0,.95)"; ctx.shadowBlur = 18;
  hl.forEach((l, k) => { ctx.fillStyle = goldFill(ctx, y + k * 80 - 52, y + k * 80 + 10); spaced(ctx, l, W / 2, y + k * 80, 6); });
  y += hl.length * 80 + 24;
  // 女祭司之言摘錄
  if (el.length) {
    ctx.shadowBlur = 8; ctx.font = `400 33px ${BODY}`; ctx.fillStyle = "#ecdfc2";
    el.forEach((l, k) => spaced(ctx, l, W / 2, y + k * lh, 1));
    y += el.length * lh + 6;
    ctx.font = `600 24px ${DISP}`; ctx.fillStyle = "#a99270"; spaced(ctx, ai ? "——女祭司皮媞亞" : "——古法所示", W / 2 + 300, y + 6, 4, "right");
  }
  // 底
  if (divider) { const dw = 600, dh = dw * divider.height / divider.width; ctx.drawImage(divider, (W - dw) / 2, H - 250, dw, dh); }
  ctx.font = `600 32px ${DISP}`; ctx.fillStyle = "#e9cf91"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 10;
  spaced(ctx, shared ? "在巨蟒的凝視下，汝亦來求一諭" : "在巨蟒的凝視下，抽出汝之牌", W / 2, H - 150, 6);
  ctx.font = `600 24px ${LATIN}`; ctx.fillStyle = "#b8a582"; spaced(ctx, siteURL().replace(/^https?:\/\//, "").replace(/\/$/, ""), W / 2, H - 102, 3);
  return cv;
}

// 橫幅預覽圖（1200×630）：分享連結在 LINE、Facebook、Threads 上顯示的那張圖
export async function renderOG(R, { ai = "" } = {}) {
  await fontsReady();
  const [bg, frame] = await Promise.all(["assets/sanctum/temple-wide.webp", "assets/ui/slot-frame.webp"].map(loadImg));
  const arts = await Promise.all(R.cards.map(c => (hasArt(c.id) ? loadImg(artPath(c.id, c.rev)) : null)));
  const w = 1200, h = 630, cv = document.createElement("canvas"); cv.width = w; cv.height = h; const ctx = cv.getContext("2d");
  background(ctx, bg, w, h, 1.05);
  const n = R.cards.length, ch = n > 1 ? 400 : 440, cw = ch * 732 / 1252, gap = 16, x0 = 48, y0 = (h - ch) / 2 + 10;
  R.cards.forEach((c, k) => {
    const x = x0 + k * (cw + gap) * (n > 1 ? 1 : 1);
    ctx.save(); ctx.translate(x + cw / 2, y0 + ch / 2); ctx.rotate((n > 1 ? (k - 1) * 0.04 : 0)); ctx.translate(-(x + cw / 2), -(y0 + ch / 2));
    drawCard(ctx, c, arts[k], frame, x, y0, cw, ch); ctx.restore();
  });
  const tx = x0 + n * (cw + gap) + 30, tw = w - tx - 50, cxm = tx + tw / 2;
  ctx.textBaseline = "alphabetic"; ctx.shadowColor = "rgba(0,0,0,.9)"; ctx.shadowBlur = 14;
  ctx.font = `700 34px ${DISP}`; ctx.fillStyle = goldFill(ctx, 70, 110); spaced(ctx, "神諭塔羅", cxm, 108, 14);
  const { omen } = splitOracle(ai), hero = omen || R.verdict.text;
  let fs = 44, hl = [];
  for (fs of [44, 40, 36, 33, 30]) { ctx.font = `700 ${fs}px ${DISP}`; hl = byComma(ctx, hero, tw, 3); if (hl.clean) break; }
  hl = hl.slice(0, 3); const lh = fs * 1.45;
  let y = 230 - (hl.length - 1) * lh / 2;
  hl.forEach((l, k) => { ctx.fillStyle = goldFill(ctx, y + k * lh - fs, y + k * lh + 8); spaced(ctx, l, cxm, y + k * lh, 3); });
  y += hl.length * lh + 18;
  ctx.shadowBlur = 6; ctx.font = `400 24px ${BODY}`; ctx.fillStyle = "#e3d4b2";
  wrap(ctx, excerpt(R, ai, 64), tw, 1).slice(0, 3).forEach((l, k) => spaced(ctx, l, cxm, y + k * 38, 1));
  ctx.font = `600 22px ${DISP}`; ctx.fillStyle = "#b8a582"; spaced(ctx, R.cards.map(c => c.name + (c.rev ? "・逆" : "")).join("　"), cxm, h - 58, 3);
  return cv;
}

// ---------------- 分享面板 ----------------
// 按下分享時才把這則神諭存到 Worker、換成短連結（朋友點開能看到完整的女祭司之言；連結在社群上有專屬標題與預覽圖）
export function createShareSheet({ audio, endpoint = CONFIG.AI_ENDPOINT } = {}) {
  const $ = id => document.getElementById(id);
  const sheet = $("share"), img = $("shareImg"), status = $("shareStatus"), qBox = $("shareQ"), qChk = $("shareQChk"), pv = $("sharePreview");
  let blob = null, R = null, code = "", ai = "", question = "", shared = false, blobURL = "", link = null;
  const canShareFiles = f => { try { return !!(navigator.canShare && navigator.canShare({ files: [f] })); } catch (_) { return false; } };
  const say = t => { status.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => (status.textContent = ""), 2600); };
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); return true; }
    catch (_) { const ta = document.createElement("textarea"); ta.value = t; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); return ok; }
  }
  const withQ = () => !!(question && qChk && qChk.checked);
  // 短連結：同一則內容只建立一次；Worker 不通時退回 ?r= 長連結（只含牌陣）
  function getLink() {
    if (link && link.q === withQ()) return link.p;
    const q = withQ();
    const p = (async () => {
      if (!endpoint) return readingURL(code);
      try {
        const og = (await renderOG(R, { ai })).toDataURL("image/jpeg", 0.84);
        const res = await fetch(endpoint + "share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, omen: splitOracle(ai).omen, text: ai, question: q ? question : "", verdict: R.verdict.text, cards: R.cards.map(c => c.name + (c.rev ? "（逆）" : "")).join("、"), og }) });
        if (!res.ok) throw new Error("http " + res.status);
        return (await res.json()).url;
      } catch (_) { return readingURL(code); }
    })();
    link = { q, p }; return p;
  }
  const text = () => shareText(R, ai);
  const open = (u, w = 620, h = 680) => window.open(u, "_blank", `noopener,width=${w},height=${h}`);
  const busy = async fn => { sheet.classList.add("linking"); try { await fn(); } finally { sheet.classList.remove("linking"); } };
  const actions = {
    native: () => busy(async () => {
      const url = await getLink(), file = new File([blob], "oracle-tarot.jpg", { type: "image/jpeg" });
      try { if (canShareFiles(file)) await navigator.share({ files: [file], text: text() + url }); else await navigator.share({ title: "神諭塔羅", text: text(), url }); }
      catch (e) { if (e && e.name !== "AbortError") say("無法開啟分享"); }
    }),
    save: () => { const a = document.createElement("a"); a.href = blobURL; a.download = "oracle-tarot.jpg"; document.body.appendChild(a); a.click(); a.remove(); say("已存下神諭圖卡"); },
    line: () => busy(async () => open(`https://line.me/R/share?text=${encodeURIComponent(text() + (await getLink()))}`)),
    facebook: () => busy(async () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(await getLink())}`)),
    threads: () => busy(async () => open(`https://www.threads.net/intent/post?text=${encodeURIComponent(text() + (await getLink()))}`)),
    link: () => busy(async () => say((await copy(text() + (await getLink()))) ? "已複製神諭與連結" : "無法複製"))
  };
  // 部分瀏覽器擋非同步開窗：先預備好短連結
  sheet.addEventListener("click", e => {
    const b = e.target.closest("[data-act]"); if (b) { actions[b.dataset.act](); return; }
    if (e.target.closest("[data-close]") || e.target === sheet) close();
  });
  async function paint() {
    img.removeAttribute("src"); sheet.classList.add("busy");
    const cv = await renderShareCard(R, { shared, ai, question: withQ() ? question : "" });
    blob = await new Promise(r => cv.toBlob(r, "image/jpeg", 0.9));
    if (blobURL) URL.revokeObjectURL(blobURL); blobURL = URL.createObjectURL(blob); img.src = blobURL;
    sheet.classList.remove("busy");
  }
  if (qChk) qChk.addEventListener("change", () => { paint(); getLink(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sheet.hidden) close(); });
  function close() { sheet.classList.remove("open"); setTimeout(() => (sheet.hidden = true), 350); }
  return {
    async open(reading, c, opts = {}) {
      R = reading; code = c; ai = opts.ai || ""; question = opts.question || ""; shared = !!opts.shared; link = null;
      if (qBox) { qBox.hidden = !question; if (qChk) qChk.checked = false; }
      const { omen } = splitOracle(ai);
      pv.innerHTML = `<b>「${esc(omen || R.verdict.text)}」</b><span>${esc(excerpt(R, ai, 70))}</span>`;
      sheet.hidden = false; requestAnimationFrame(() => sheet.classList.add("open")); status.textContent = "";
      sheet.querySelector('[data-act="native"]').hidden = !navigator.share;
      await paint(); getLink();
      if (audio) audio.rustle();
    }
  };
}
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
