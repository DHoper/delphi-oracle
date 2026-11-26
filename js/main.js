import { CARDS, SPREADS } from "./tarot/data.js";
import { buildReading, readingParagraphs, readingPlainText, loadExtData } from "./tarot/engine.js";
import { faceSVG, artPath, hasArt } from "./tarot/cardface.js";
import { burnCard } from "./scene/burn.js";
import { createSmoke } from "./scene/smoke.js";
import { CONFIG } from "./config.js";
import { createTemple } from "./scene/temple.js";
import { createFire } from "./scene/fire.js";
import { createSerpent } from "./scene/serpent.js";
import { createAudio } from "./scene/audio.js";
import { createSeal } from "./scene/seal.js";
import { aiAvailable, aiReading, aiQuota } from "./ai.js";
import { MYTH } from "./tarot/myth.js";
import { EPIC } from "./tarot/epic.js";
import { encodeReading, decodeReading, createShareSheet, splitOracle } from "./share.js";
import { createGate, gateImages } from "./scene/gate.js";

const $ = id => document.getElementById(id);
const stage = $("stage"), cardsEl = $("cards"), slotsEl = $("slots"), hint = $("hint"), utterEl = $("utter"), hands = $("hands");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const D = ms => (reduced ? 1 : ms);
const wait = ms => new Promise(r => setTimeout(r, D(ms)));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const tween = (ms, fn) => new Promise(res => { const T = D(ms), t0 = performance.now(); (function f(now) { const p = Math.min(1, (now - t0) / T); fn(p); if (p < 1) requestAnimationFrame(f); else res(); })(t0); });

const smoke = createSmoke($("smoke"), { reduced });
const fire = createFire($("fire"), stage, { reduced });
const serpent = createSerpent($("serpentBack"), $("serpentFront"), stage, { reduced });
const audio = createAudio();
const temple = createTemple($("sceneGL"), { reduced }); // 不支援 WebGL 時為 null，退回靜態圖

// ---------------- 狀態 ----------------
const S = { intro: true, shared: false, phase: "ask", spread: "time", spreadSet: false, topic: "auto", order: [], picked: [], flipped: 0, seed: 0, R: null, cards: [], busy: false };
function setPhase(p) { S.phase = p; stage.dataset.phase = p; if (typeof layout === "function") layout(); applyAtmosphere(); }
// ---------------- 版面：以內殿全景圖為基準 ----------------
// 全景圖以 cover 方式鋪滿畫面，巨蟒雙眼固定在畫面寬的正中、高約 23% 處；
// 牌位放在巨蟒下顎與畫中石桌之間，牌的大小依這段空間推算；其餘文字與封印再依牌位往下排，各尺寸都由這裡算出。
const SCENES = {
  portrait: { plate: "assets/sanctum/temple-portrait-plate.webp", mask: "assets/sanctum/temple-portrait-mask.png", rect: [28.451, 13.081, 38.737, 20.712], pivot: [47.819, 15.879], amp: 0.045, img: "assets/sanctum/temple-portrait.webp", body: "assets/sanctum/body-portrait.png", lids: "assets/sanctum/lids-portrait.webp", ar: 1080 / 1935, eye: [50.13, 23.98], lid: [36.13, 20.82, 27.93], chin: 31, table: 70.5, fire: [[16.3, 56.5], [84, 56.5]], fissure: [50, 64] },
  wide: { plate: "assets/sanctum/temple-wide-plate.webp", mask: "assets/sanctum/temple-wide-mask.png", rect: [43.932, 17.708, 12.427, 17.969], pivot: [50.145, 22.005], amp: 0.055, img: "assets/sanctum/temple-wide.webp", body: "assets/sanctum/body-wide.png", lids: "assets/sanctum/lids-wide.webp", ar: 1920 / 1072, eye: [50.2, 24.22], lid: [44.66, 18.82, 11.05], chin: 29, table: 71, fire: [[39, 55.5], [60.8, 55.5]], fissure: [50, 67] }
};
let sceneKey = "";
function layout() {
  const st = stage.getBoundingClientRect(), H = st.height, W = st.width, css = (k, v) => stage.style.setProperty(k, v);
  const wide = W / H >= 1.1, key = wide ? "wide" : "portrait", SC = SCENES[key];
  if (key !== sceneKey) { sceneKey = key; $("sceneImg").src = SC.img; $("sceneLids").src = SC.lids; if (temple) temple.set(SC); }
  // 全景圖：cover，雙眼對準畫面水平中線、垂直 23%
  const zoom = wide ? 1.12 : 1, sw = Math.max(W, H * SC.ar) * zoom, sh = sw / SC.ar;
  const sx = Math.min(0, Math.max(W - sw, W / 2 - sw * SC.eye[0] / 100)), sy = Math.min(0, Math.max(H - sh, H * 0.23 - sh * SC.eye[1] / 100));
  const scene = $("serpent"); Object.assign(scene.style, { width: sw + "px", height: sh + "px", left: sx + "px", top: sy + "px", marginLeft: 0 });
  const lidsEl = $("sceneLids"); Object.assign(lidsEl.style, { left: SC.lid[0] + "%", top: SC.lid[1] + "%", width: SC.lid[2] + "%" });
  scene.querySelectorAll(".anc").forEach((el, k) => { const pt = k < 2 ? SC.fire[k] : SC.fissure; el.style.left = pt[0] + "%"; el.style.top = pt[1] + "%"; el.style.width = (wide ? 3 : 9) + "%"; });
  const Y = pc => sy + sh * pc / 100, eyeY = Y(SC.eye[1]), chinY = Y(SC.chin), tableY = Y(SC.table);
  css("--eye-y", eyeY + "px"); css("--fissure-y", Y(SC.fissure[1]) / H);
  // 祭壇：畫中石桌的桌面中央；火是粒子拼成的，這裡只定出火的位置與投入範圍
  const bz = $("brazier");
  if (bz) {
    const bw = Math.min(sw * (wide ? 0.1 : 0.26), W * 0.42), bh = bw * 0.22, base = bz.offsetParent ? bz.offsetParent.getBoundingClientRect() : st;
    Object.assign(bz.style, { width: bw + "px", height: bh + "px", left: sx + sw * 0.5 - (base.left - st.left) + "px", top: Y(SC.table + 0.6) - bh * 0.5 - (base.top - st.top) + "px" });
  }
  // 牌位：下顎與石桌之間；牌寬受畫面寬與這段高度限制
  const labH = 30, nmH = 44, regTop = chinY + H * 0.02, regBot = tableY + H * 0.03;
  const cardH = Math.max(90, Math.min((regBot - regTop - labH - nmH) * 0.98, H * (wide ? 0.27 : 0.25), (W * (wide ? 0.1 : 0.25)) / 0.6));
  const cardW = cardH * 0.6; css("--card-w", cardW + "px");
  const groupH = cardH + labH + nmH, slotsTop = regTop + Math.max(0, (regBot - regTop - groupH) / 2);
  const tbH = H * 0.3, tbTop = slotsTop - tbH * 0.3; css("--tb-top", tbTop + "px");
  const spreadNow = S.spread === "choice" || S.spread === "mind" ? (cardH + labH) * 0.24 : 0, spread = S.phase === "ask" ? (cardH + labH) * 0.24 : spreadNow;
  const labBottom = slotsTop + cardH + labH + spread, slotsBottom = labBottom + nmH;
  // 擇牌陣的四枚星徽：排在牌位將出現的地方（下顎與石桌之間）
  const sigS = Math.max(56, Math.min(W * (wide ? 0.075 : 0.19), (regBot - regTop) * 0.42, 128));
  // 緊貼巨蟒下顎之下，避開畫中火盆的火焰
  const sigCY = chinY + H * (wide ? 0.05 : 0.035) + sigS / 2, sigBottom = sigCY + sigS / 2 + 34;
  css("--sig-size", sigS + "px"); css("--sig-top", sigCY + "px");
  // 道出所問：輸入框排在星徽原本的位置
  const qTop = chinY + H * 0.035, qH = Math.max(76, Math.min(104, H * 0.12));
  css("--q-y", qTop + "px"); css("--q-h", qH + "px");
  css("--utter-top", slotsBottom + 8 + "px");
  css("--wh-top", (S.phase === "ask" ? labBottom : slotsBottom) + 6 + "px");
  // 封印：低語之下、說明文字之上；空間不夠就縮小
  const cap = $("stepCap"), capTop = cap && cap.offsetHeight ? cap.getBoundingClientRect().top - st.top : H - 100;
  const seal = $("seal"), sealTopEdge = Math.max(labBottom + 44, sigBottom + 58), sealH = Math.max(52, Math.min(wide ? 100 : 116, W * 0.26, capTop - 10 - sealTopEdge));
  css("--seal-size", sealH + "px");
  const sealBase = seal && seal.offsetParent ? seal.offsetParent.getBoundingClientRect().top - st.top : 0;
  css("--seal-top", sealTopEdge + sealH / 2 - sealBase + "px");
  // 低語：取預兆時貼在步驟說明之上（留出間距）；擇牌陣時在星徽之下；道出所問時在輸入框之下
  css("--wh-bottom", H - capTop + 20 + "px");
  css("--wh-y", (step === 0 ? qTop + qH + 86 : sigBottom + 12) + "px");
  // 解讀時（手機、平板）：牌縮小移到雙眼下方與紙卷之間
  if (!wide || W < 900) {
    const cs = getComputedStyle($("reading")).top, scrollTop = cs.endsWith("%") ? H * parseFloat(cs) / 100 : parseFloat(cs) || H * 0.46;
    const bandTop = eyeY + H * 0.05, bandBottom = scrollTop - 6, hS = cardH + labH + nmH + spreadNow;
    const sc = Math.min(0.72, (bandBottom - bandTop) / hS), tcy = tbTop + tbH / 2, cy0 = slotsTop + hS / 2, ty = (bandTop + bandBottom) / 2 - tcy - (cy0 - tcy) * sc;
    css("--rd-tf", `translateY(${ty.toFixed(1)}px) scale(${sc.toFixed(3)})`);
  }
}
function applyAtmosphere() {
  const tb = $("table").getBoundingClientRect(), H = stage.clientHeight, p = S.phase;
  const fy = parseFloat(stage.style.getPropertyValue("--fissure-y")) || 0.64; // 煙從畫中的地縫升起
  smoke.set({ src: [0.5, fy], mistY: (tb.top + tb.height * 0.55) / H });
  smoke.set({ intensity: { ask: 0, wash: 0, cut: 0, draw: 0, flip: 0, oracle: 0, read: 0, knock: 1.6 }[p], mist: p === "flip" || p === "wash" ? 0.55 : 0 });
  fire.set({ power: { ask: 1, wash: 1.4, cut: 1.2, draw: 1.2, flip: 1.3, oracle: 2, read: 1, knock: 2.2 }[p] });
}

// ---------------- 求問：三步，每一步只做一件事 ----------------
// 一、把月桂擲入火盆，自火中取一預兆（所問之事）　二、擇牌陣　三、刻下問題，按住封印獻上
const OMENS = [["love", "愛與情感"], ["career", "事業與學業"], ["money", "財貨與交易"], ["health", "身與心"], ["growth", "自我與修習"], ["gen", "命運的全貌"]];
const TOPIC_LABEL = { auto: "任火自顯" }; OMENS.forEach(o => (TOPIC_LABEL[o[0]] = o[1]));
// 牌陣圖：每張小牌的位置（百分比）、傾角與牌位名
const LAYS = {
  one: { name: "今日之諭", cards: [[50, 50, 0, ""]] },
  time: { name: "往昔・此刻・將臨", cards: [[22, 50, -4, "往昔"], [50, 46, 0, "此刻"], [78, 50, 4, "將臨"]] },
  choice: { name: "兩條路徑", cards: [[26, 36, -14, "左徑"], [74, 36, 14, "右徑"], [50, 74, 0, "神示"]] },
  mind: { name: "身・心・靈", cards: [[50, 30, 0, "靈"], [28, 72, 0, "身"], [72, 72, 0, "心"]] }
};
// 求問三步：0 叩問（道出所問）　1 自火中取預兆　2 命運三女神垂目（擇牌陣）＋封印
const CAPS = ["汝所問何事", "自火中取一預兆", "命運三女神將垂視何處"]; // 擇牌陣選定之後改由 gazeCap() 說出落點
const gazeCap = () => `命運三女神垂視汝之${SPREADS[S.spread].gaze}`;
const askEl = $("ask");
let step = 0;
// 六枚木徽章：從火中升起，排成一道弧浮在火盆上方（位置依火盆實際大小計算）
$("omens").innerHTML = OMENS.map((o, i) => `<button type="button" role="option" data-t="${o[0]}" aria-selected="false" aria-label="${o[1]}" style="--dl:${D(250 + i * 120)}ms"><i style="background-image:url(assets/omens/${o[0]}.webp)"></i></button>`).join("");
function layoutOmens() {
  const rr = askEl.getBoundingClientRect(), br = $("brazier").getBoundingClientRect(), bs = [...$("omens").children];
  if (!br.width) return;
  const cx = br.left + br.width / 2 - rr.left, my = br.top + br.height * 0.16 - rr.top, R = Math.min(Math.max(br.width * 1.15, 120), innerWidth * 0.4, 300);
  bs.forEach((b, i) => {
    const a = Math.PI * (0.94 - 0.88 * i / 5), x = cx + Math.cos(a) * R, y = my - Math.sin(a) * R * 0.62 - br.height * 0.08;
    b.dataset.bx = x + "px"; b.dataset.by = y + "px"; b.style.setProperty("--fx", cx + "px"); b.style.setProperty("--fy", my + "px");
    if (b === focusedOmen) { const p = focusPos(); b.style.setProperty("--x", p.x + "px"); b.style.setProperty("--y", p.y + "px"); }
    else { b.style.setProperty("--x", x + "px"); b.style.setProperty("--y", y + "px"); }
  });
}
$("steps").innerHTML = [0, 1, 2].map(i => `<button type="button" data-go="${i}" aria-label="第 ${i + 1} 步"></button>`).join("");
function markSpread() {}
function showTopic() {
  [...$("omens").children].forEach(x => x.setAttribute("aria-selected", x.dataset.t === S.topic));
  const b = $("steps").children; b[1].style.backgroundImage = S.topic !== "auto" ? `url(assets/omens/${S.topic}.webp)` : ""; b[1].classList.toggle("set", S.topic !== "auto");
}
function showStep(n) {
  step = n; askEl.dataset.step = n; stage.dataset.askstep = n; $("stepCap").textContent = n === 2 && S.spreadSet ? gazeCap() : CAPS[n];
  [...$("steps").children].forEach((b, i) => { if (i === n) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current"); });
  $("steps").children[2].disabled = S.topic === "auto"; layout();
  if (n !== 1) unfocusOmen(true);
  if (n === 0 && !S.qIntro) { S.qIntro = true; setTimeout(() => whisper("將汝之所問刻於石上\n留白亦可，神自知曉"), D(500)); }
  $("omens").classList.remove("chosen");
  requestAnimationFrame(() => { fire.resize(); fire.set({ power: n === 1 ? 1.4 : 1 }); });
  if (n === 2) { showSigils(); if (!S.spreadIntro) { S.spreadIntro = true; setTimeout(() => whisper("命運三女神正自高處垂視\n觸一枚星徽，迎其目光"), D(900)); } }
  if (n === 1) { audio.hiss(); requestAnimationFrame(layoutOmens); [...$("omens").children].forEach(b => { b.style.transform = ""; b.style.visibility = ""; b.style.opacity = ""; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; b.classList.remove("held", "touched"); }); }
}
$("steps").addEventListener("click", e => { const b = e.target.closest("button"); if (b && !b.disabled) showStep(+b.dataset.go); });
// 預兆：點一下，深處傳來低語說出它的意思；拖進火盆才算取用
const WHISPER = {
  love: "鴿子振翅……此兆主情愛", career: "梟在暗處睜眼……此兆主前程", money: "天平輕擺……此兆主財貨",
  health: "蛇攀於杖……此兆主身與心", growth: "月桂成環……此兆主汝自身", gen: "紡錘輕轉……此兆主命運的全貌"
};
let whisperT = null, whisperedOnce = false;
function whisper(text) {
  const w = $("whisper"); clearTimeout(whisperT);
  w.innerHTML = [...text].map((ch, i) => (ch === "\n" ? "<br>" : `<span style="animation-delay:${D(i * 55)}ms">${esc(ch)}</span>`)).join("");
  w.classList.remove("out"); audio.hiss();
  whisperT = setTimeout(() => w.classList.add("out"), D(text.length * 55 + 2200));
}
// 取預兆：點一下，深處低語說出它的意思；把它拖進火盆的盆口放開，木徽章落入火中燃起，就是取了這個預兆
function mouthRect() { const r = $("brazier").getBoundingClientRect(); return { l: r.left - r.width * 0.15, r: r.right + r.width * 0.15, t: r.top - r.width * 0.75, b: r.bottom + r.height, cx: r.left + r.width / 2, cy: r.top + r.height * 0.4 }; }
const overMouth = (x, y) => { const m = mouthRect(); return x > m.l && x < m.r && y > m.t && y < m.b; };
let om = null;
$("omens").addEventListener("pointerdown", e => {
  const b = e.target.closest("button"); if (!b || S.busy || step !== 1) return;
  e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {}
  om = { b, x: e.clientX, y: e.clientY, drag: false };
});
$("omens").addEventListener("pointermove", e => {
  if (!om) return; const dx = e.clientX - om.x, dy = e.clientY - om.y;
  if (!om.drag && Math.hypot(dx, dy) > 8) { om.drag = true; om.b.classList.add("held"); audio.rustle(); }
  if (om.drag) {
    om.b.style.transform = `translate(calc(var(--x) - 50% + ${dx}px),calc(var(--y) - 50% + ${dy}px))`;
    const hot = overMouth(e.clientX, e.clientY);
    if (hot !== askEl.classList.contains("hot")) { askEl.classList.toggle("hot", hot); fire.set({ power: hot ? 3.4 : 1.4 }); if (hot) audio.hiss(); }
  }
});
async function dropOmen(b) {
  S.busy = true; askEl.classList.remove("hot");
  const m = mouthRect(), r = b.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  const dx = m.cx - (r.left + r.width / 2), dy = m.cy - (r.top + r.height / 2);
  b.classList.remove("held");
  await b.animate([{ transform: getComputedStyle(b).transform }, { transform: `${getComputedStyle(b).transform} translate(${dx}px,${dy}px) scale(.35) rotate(40deg)`, filter: "brightness(2.6) sepia(1) saturate(4)", opacity: 0 }], { duration: D(560), easing: "cubic-bezier(.55,0,.8,.5)", fill: "forwards" }).finished;
  b.style.visibility = "hidden";
  fire.set({ power: 5 }); fire.burst(m.cx - sr.left, m.cy - sr.top, 70, { up: 3.2, spread: 3.6, w: (m.r - m.l) * 0.5 }); audio.strike();
  S.topic = b.dataset.t; showTopic();
  whisper("火已收下此兆\n" + WHISPER[S.topic].split("……")[1].replace("此兆主", "汝之所問，關乎"));
  await wait(1500); fire.set({ power: 1 }); S.busy = false; showStep(2);
}
function endOm(e) {
  if (!om) return; const { b, drag } = om; om = null;
  if (!drag) { if (focusedOmen !== b) focusOmen(b); else whisper(WHISPER[b.dataset.t] + "\n投入火中，便取此兆"); return; }
  if (e && e.type === "pointerup" && overMouth(e.clientX, e.clientY)) return dropOmen(b);
  b.classList.remove("held"); askEl.classList.remove("hot"); fire.set({ power: 1.4 });
  b.animate([{ transform: b.style.transform }, { transform: "translate(calc(var(--x) - 50%),calc(var(--y) - 50%))" }], { duration: D(380), easing: "cubic-bezier(.3,.7,.2,1)" }); b.style.transform = "";
}
// 聚焦：點一下徽章，它移到火盆正上方、其他徽章淡去，等求問者把它投入火中；點外側便回到六枚並列
let focusedOmen = null, posT = null;
const posAnim = () => { const o = $("omens"); o.classList.add("pos-anim"); clearTimeout(posT); posT = setTimeout(() => o.classList.remove("pos-anim"), 750); };
function focusPos() { const br = $("brazier").getBoundingClientRect(), rr = askEl.getBoundingClientRect(); return { x: br.left + br.width / 2 - rr.left, y: br.top - rr.top - Math.max(84, br.width * 0.42) }; }
function focusOmen(b) {
  if (focusedOmen && focusedOmen !== b) unfocusOmen(true);
  focusedOmen = b; const p = focusPos();
  b.style.setProperty("--x", p.x + "px"); b.style.setProperty("--y", p.y + "px");
  posAnim(); b.classList.add("focused"); $("omens").classList.add("focusing"); audio.rustle();
  whisper(WHISPER[b.dataset.t] + "\n投入火中，便取此兆");
}
function unfocusOmen(quiet = false) {
  if (!focusedOmen) return; const b = focusedOmen; focusedOmen = null;
  posAnim(); b.classList.remove("focused"); $("omens").classList.remove("focusing");
  if (b.dataset.bx) { b.style.setProperty("--x", b.dataset.bx); b.style.setProperty("--y", b.dataset.by); }
  if (!quiet) $("whisper").classList.add("out");
}
stage.addEventListener("pointerdown", e => { if (focusedOmen && S.phase === "ask" && step === 1 && !e.target.closest("#omens button")) unfocusOmen(); });
// 出場動畫結束就移除它：動畫停在最後一格時，瀏覽器會把當時的位置凍結，之後聚焦、換尺寸都不會跟著動
$("omens").addEventListener("animationend", e => { if (e.animationName === "omenRise" && e.target.matches("#omens button")) { e.target.style.opacity = "1"; e.target.style.animation = "none"; } });
$("omens").addEventListener("pointerup", endOm); $("omens").addEventListener("pointercancel", endOm);
$("omens").addEventListener("keydown", e => { const b = e.target.closest("button"); if (b && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); dropOmen(b); } });

// 牌陣：畫在石桌上。撫過（左右滑動或點一下）石桌換陣形；舊框熄成餘燼，新框逐一燃起
const SP_ORDER = ["one", "time", "choice", "mind"];
const SP_WHISPER = { one: "一牌一諭，照見當下\n按住封印，獻上所問", time: "往昔、此刻、將臨，一線相牽\n按住封印，獻上所問", choice: "左徑、右徑，與一句神示\n按住封印，獻上所問", mind: "身、心、靈，各現一牌\n按住封印，獻上所問" };
let tdown = null;
// 命運女神的目光：金色光暈落在石桌上，光落之處即是牌位。換落點時，光從舊處滑向新處（一分為三，或三合為一）
const gazeEl = $("gaze");
function slotCenters() {
  const tr = $("table").getBoundingClientRect();
  return [...slotsEl.querySelectorAll(".hole")].map(h => { const r = h.getBoundingClientRect(); return { x: r.left - tr.left + r.width / 2, y: r.top - tr.top + r.height / 2, w: r.width, h: r.height }; });
}
function moveGaze(from) {
  const to = slotCenters(), halos = [...gazeEl.children];
  halos.forEach((el, k) => {
    const t = to[Math.min(k, to.length - 1)], f = from ? from[Math.min(k, from.length - 1)] : t, extra = k >= to.length;
    el.style.width = t.w * 1.9 + "px"; el.style.height = t.h * 1.5 + "px";
    const tf = p => `translate(${p.x - t.w * 0.95}px,${p.y - t.h * 0.75}px)`;
    el.style.transform = tf(t); el.style.opacity = extra ? 0 : 1;
    if (from && !reduced) el.animate([{ transform: tf(f), opacity: k >= from.length ? 0 : 1 }, { transform: tf(t), opacity: extra ? 0 : 1 }], { duration: 620, easing: "cubic-bezier(.45,.05,.25,1)" });
  });
}
// 星徽：此刻（天頂之日）、因果（三相之月）、抉擇（星下岔路）、本心（迷宮之火）。觸一枚即選定，封印隨之亮起
const SIGILS = [["one", "此刻"], ["time", "因果"], ["choice", "抉擇"], ["mind", "本心"]];
const sigilsEl = $("sigils");
sigilsEl.innerHTML = SIGILS.map(([id, nm], i) => `<button type="button" role="radio" aria-checked="false" data-sp="${id}" style="--dl:${D(120 + i * 110)}ms"><i style="background-image:url(assets/spreads/${id}.webp)"></i><b>${nm}</b></button>`).join("");
function showSigils() {
  [...sigilsEl.children].forEach(b => { b.setAttribute("aria-checked", S.spreadSet && b.dataset.sp === S.spread); b.tabIndex = (S.spreadSet ? b.dataset.sp === S.spread : b.dataset.sp === "one") ? 0 : -1; b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; });
  $("seal").disabled = !S.spreadSet; stage.classList.toggle("spread-set", S.spreadSet);
}
function chooseSpread(sp, focus = false) {
  if (S.busy || S.phase !== "ask" || step !== 2) return;
  const changed = sp !== S.spread || !S.spreadSet;
  S.spread = sp; S.spreadSet = true; requestAnimationFrame(() => renderSlots());
  [...sigilsEl.children].forEach(b => { const on = b.dataset.sp === sp; b.setAttribute("aria-checked", on); b.tabIndex = on ? 0 : -1; if (on && focus) b.focus(); });
  $("seal").disabled = false; stage.classList.add("spread-set");
  $("stepCap").textContent = gazeCap();
  if (changed) {
    whisper(SP_WHISPER[sp]); audio.rustle(); audio.bowl(147, 0.07); setTimeout(() => placeBeam(true), 30);
    const b = sigilsEl.querySelector(`[data-sp="${sp}"] i`), r = b.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    fire.burst(r.left - sr.left + r.width / 2, r.top - sr.top + r.height * 0.85, 18, { up: 1.2, spread: 1.6, w: r.width * 0.8 });
  }
}
// 神光聚焦：選中的星徽上方垂下一道金色光柱
function placeBeam(restart = false) {
  const beam = $("beam"), i = S.spreadSet && sigilsEl.querySelector(`[data-sp="${S.spread}"] i`); if (!i) return;
  const r = i.getBoundingClientRect(), sr = stage.getBoundingClientRect();
  beam.style.left = r.left - sr.left + r.width / 2 + "px"; beam.style.setProperty("--bh", r.top - sr.top + r.height * 0.6 + "px"); beam.style.setProperty("--bw", r.width * 1.7 + "px");
  if (restart) {
    beam.classList.remove("on"); void beam.offsetWidth; beam.classList.add("on");
    // 目光自巨蟒雙眼垂落：幾縷金色微塵流向選中的星徽
    const ey = parseFloat(stage.style.getPropertyValue("--eye-y")) || sr.height * 0.23, tx = r.left - sr.left + r.width / 2, ty = r.top - sr.top + r.height * 0.45;
    let k = 0; clearInterval(placeBeam.t); placeBeam.t = setInterval(() => { fire.stream(sr.width / 2, ey + 6, tx, ty, 7); if (++k >= 9) clearInterval(placeBeam.t); }, 110);
  }
}
sigilsEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) chooseSpread(b.dataset.sp); });
sigilsEl.addEventListener("keydown", e => {
  const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]; if (!k) return;
  e.preventDefault(); const i = SIGILS.findIndex(x => x[0] === S.spread); chooseSpread(SIGILS[(i + k + SIGILS.length) % SIGILS.length][0], true);
});
askEl.addEventListener("submit", e => e.preventDefault());
const sealFx = createSeal($("seal"), { audio, reduced, onComplete: () => offer() });

// 封印燒成後，所取的預兆化為火光，升向巨蟒的雙眼
async function offer() {
  if (S.busy || S.phase !== "ask") return; S.busy = true;
  S.question = $("question").value.replace(/\s+/g, " ").trim().slice(0, 60); S.aiText = ""; $("question").blur();
  const sr = $("seal").getBoundingClientRect(), hr = $("head").getBoundingClientRect(), off = $("offering");
  const el = document.createElement("i"); el.className = "omenfly"; el.style.backgroundImage = `url(assets/${S.topic === "auto" ? "ui/seal-lit" : "omens/" + S.topic}.webp)`;
  el.style.left = sr.left + sr.width / 2 + "px"; el.style.top = sr.top + sr.height / 2 + "px"; off.appendChild(el);
  audio.hiss(); setPhase("wash"); renderSlots(true);
  const dx = hr.left + hr.width / 2 - (sr.left + sr.width / 2), dy = hr.top + hr.height * 0.5 - (sr.top + sr.height / 2);
  await el.animate([{ transform: "translate(-50%,-50%) scale(1)", opacity: 1, filter: "brightness(1.6) sepia(1) saturate(3)" }, { transform: `translate(calc(-50% + ${dx * 0.3}px),calc(-50% + ${dy * 0.55}px)) scale(.8)`, opacity: 1, offset: 0.5 }, { transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(.15)`, opacity: 0, filter: "brightness(4) blur(4px)" }], { duration: D(1100), easing: "cubic-bezier(.5,0,.7,1)", fill: "forwards" }).finished;
  off.innerHTML = ""; stage.classList.add("eye-flare"); setTimeout(() => stage.classList.remove("eye-flare"), D(2200));
  await shuffle();
}

function renderSlots(ignite = false) {
  const pos = SPREADS[S.spread].positions; slotsEl.dataset.sp = S.spread;
  slotsEl.innerHTML = pos.map((p, k) => `<div class="slot${ignite ? " ignite" : ""}" data-k="${k}" style="--d:${D(k * 220)}ms"><div class="hole"></div><div class="lab">${p}</div><div class="nm"></div></div>`).join("");
  if (ignite) setTimeout(() => { const sr = stage.getBoundingClientRect(); slotsEl.querySelectorAll(".hole").forEach((h, k) => setTimeout(() => { const r = h.getBoundingClientRect(); fire.burst(r.left - sr.left + r.width / 2, r.top - sr.top + r.height, 14, { up: 1.1, spread: 1.2, w: r.width }); }, D(k * 220))); }, 30);
  layout();
}
renderSlots();

// ---------------- 牌的幾何 ----------------
const cardSize = () => { const h = slotsEl.querySelector(".hole").getBoundingClientRect(); return { w: h.width, h: h.height }; };
function slotCenter(k) { const r = slotsEl.children[k].querySelector(".hole").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, s: r.width / cardsEl.querySelector(".card").offsetWidth }; }
function tableCenter() { const r = $("table").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.55, w: r.width, h: r.height }; }
function put(c, x, y, rot = 0, s = 1) { c.x = x; c.y = y; c.rot = rot; c.s = s; c.el.style.transform = `translate(${x - c.el.offsetWidth / 2}px,${y - c.el.offsetHeight / 2}px) rotate(${rot}deg) scale(${s})`; }
function makeCard(o, k) {
  const el = document.createElement("div"); el.className = "card"; el.style.zIndex = 10 + k;
  el.innerHTML = `<div class="inner"><div class="back"></div><div class="face"><div class="f f-up"></div><div class="f f-rev"></div><div class="burn"></div><div class="veil"></div></div><div class="sheen"></div></div>`;
  cardsEl.appendChild(el); return { el, inner: el.firstChild, face: el.querySelector(".face"), ...o, x: 0, y: 0, rot: 0, s: 1 };
}
function setFaces(c) { c.face.querySelector(".f-up").innerHTML = faceSVG(c.i, false); c.face.querySelector(".f-rev").innerHTML = faceSVG(c.i, true); }

// ---------------- 洗牌（古典）：攤開畫圈 → 收攏 → 切三疊 → 抹成一列 ----------------
async function shuffle() {
  S.seed = Math.floor(Math.random() * 997);
  // 牌組（預設 22 張大牌）；先真正洗亂順序（Fisher–Yates），畫面上的洗牌只是儀式
  S.order = CARDS.slice(0, CONFIG.MAJOR_ONLY ? 22 : CARDS.length).map((_, i) => ({ i, rev: Math.random() < 0.4 }));
  for (let k = S.order.length - 1; k > 0; k--) { const j = Math.floor(Math.random() * (k + 1)); [S.order[k], S.order[j]] = [S.order[j], S.order[k]]; }
  S.picked = []; S.flipped = 0; cardsEl.innerHTML = ""; S.cards = S.order.map(makeCard);
  const tc = tableCenter(), sc = 0.72, rx = Math.min(tc.w * 0.4, 190), ry = Math.min(tc.h * 0.36, 95);
  S.cards.forEach((c, k) => { put(c, tc.x, tc.y - k * 0.4, 0, sc); c.el.style.opacity = 0; });
  await tween(400, p => S.cards.forEach(c => (c.el.style.opacity = p)));
  hands.dataset.pose = "wash"; audio.drum();
  serpent.go("tight", 2.6); serpent.setSpeed(90); if (temple) temple.sway(1.6); // 巨蟒框住整座內殿的身軀緩緩收緊、滑動
  // 洗牌：牌面朝下攤在石桌上，以逆時針緩緩畫圈
  const P = S.cards.map(() => ({ r: 0.25 + Math.random() * 0.75, a: Math.random() * Math.PI * 2, w: 0.55 + Math.random() * 0.5, rot: (Math.random() - 0.5) * 80 }));
  let rustle = 0;
  await tween(3000, p => {
    const out = ease(Math.min(1, p / 0.2)), back = ease(Math.max(0, (p - 0.8) / 0.2)), spin = p * 3.0;
    S.cards.forEach((c, k) => {
      const q = P[k], a = q.a - spin * q.w * 2.2, m = out * (1 - back);
      put(c, tc.x + Math.cos(a) * rx * q.r * m, tc.y + Math.sin(a) * ry * q.r * m - k * 0.4 * (1 - m), (q.rot + a * 18) * m, sc);
    });
    if (p * 14 > rustle) { rustle++; audio.rustle(); }
  });
  serpent.go("arch", 2.2); serpent.setSpeed(40); if (temple) temple.sway(1);
  // 切牌：分成三疊，由求問者選一疊放到最上面
  setPhase("cut"); hands.dataset.pose = "rest";
  const n = S.cards.length, c1 = Math.round(n * (0.28 + Math.random() * 0.1)), c2 = Math.round(n * (0.6 + Math.random() * 0.1)), cut = [0, c1, c2, n], piles = [0, 1, 2].map(j => S.cards.slice(cut[j], cut[j + 1]));
  const px = j => tc.x + (j - 1) * Math.min(tc.w * 0.32, 130);
  await tween(600, p => piles.forEach((pl, j) => pl.forEach((c, k) => put(c, c.x + (px(j) - c.x) * ease(p), c.y + (tc.y - k * 0.6 - c.y) * ease(p), c.rot * (1 - ease(p)), sc))));
  piles.forEach(pl => pl.forEach((c, k) => { c.el.style.zIndex = 20 + k; c.el.classList.add("tappable"); }));
  $("cutHint").hidden = false; S.busy = false;
  const chosen = await new Promise(res => { const h = e => { const j = [0, 1, 2].reduce((b, j) => (Math.abs(px(j) - e.clientX) < Math.abs(px(b) - e.clientX) ? j : b), 0); if (Math.abs(e.clientY - tc.y) < tc.h) { stage.removeEventListener("pointerup", h); res(j); } }; stage.addEventListener("pointerup", h); });
  S.busy = true; $("cutHint").hidden = true; S.cards.forEach(c => c.el.classList.remove("tappable")); audio.land();
  const top = piles[chosen], rest = piles.filter((_, j) => j !== chosen).flat();
  await tween(450, p => top.forEach((c, k) => put(c, c.x, tc.y - k * 0.6 - 40 * Math.sin(p * Math.PI), 0, sc)));
  const stack = [...rest, ...top]; // 選中的那疊放在最上面
  await tween(500, p => stack.forEach((c, k) => put(c, c.x + (tc.x - c.x) * ease(p), c.y + (tc.y - k * 0.4 - c.y) * ease(p), 0, sc)));
  stack.forEach((c, k) => (c.el.style.zIndex = 20 + k));
  S.cards = stack.reverse(); // 由上而下
  // 展牌：一手抹開，排成一列
  await ribbon(); hands.dataset.pose = "deal";
  setPhase("draw"); S.busy = false; updateDrawHint();
}
function ribbonLayout() {
  const W = stage.clientWidth, H = stage.clientHeight, cs = cardSize(), n = S.cards.length;
  // 牌列放在石桌下方；若與牌位之間放不下提示文字，就把牌列縮小（筆電這類矮螢幕）
  const st = stage.getBoundingClientRect(), holes = [...slotsEl.querySelectorAll(".slot")].map(e => e.getBoundingClientRect());
  const mg = Math.max(46, H * 0.06), sb = Math.max(...holes.map(r => r.bottom)) - st.top, room = (H - mg - sb - 58) / cs.h;
  // 矮而寬的螢幕：牌位與牌列之間放不下提示，提示改放到牌位左側
  const side = room < 0.6 && W >= 900;
  hint.classList.toggle("side", side);
  if (side) { const l = Math.min(...holes.map(r => r.left)) - st.left, mid = holes.reduce((a, r) => a + r.top + r.height / 2, 0) / holes.length - st.top; hint.style.setProperty("--hx", l - 36 + "px"); hint.style.setProperty("--hy", mid + "px"); }
  const sc = Math.max(0.5, Math.min(W < 600 ? 0.86 : 0.74, side ? (H - mg - sb - 14) / cs.h : room)), cw = cs.w * sc, ch = cs.h * sc, left = Math.max(10, (W - Math.min(W - 20, n * cw * 0.5 + cw)) / 2), step = (W - 2 * left - cw) / Math.max(1, n - 1);
  const y = H - ch * 0.5 - mg;
  hint.style.bottom = side ? "" : (H - y + ch * 0.5 + 14) + "px";
  // 牌扇：中間拱起、兩端垂下並向外張開；寬螢幕拱得更明顯，避免 78 張排成一條平直的帶子
  const arch = W >= 900 ? ch * 0.32 : 10, tilt = W >= 900 ? 16 : 6;
  return S.cards.map((c, k) => { const u = k / Math.max(1, n - 1); return { c, x: left + cw / 2 + k * step, y: y + arch * 0.35 - Math.sin(u * Math.PI) * arch, rot: (u - 0.5) * tilt, s: sc, z: 100 + k }; });
}
async function ribbon() {
  audio.rustle(); const stepMs = Math.min(26, 1100 / S.cards.length);
  ribbonLayout().forEach(({ c, x, y, rot, s, z }, k) => { c.el.style.transition = `transform ${D(380)}ms cubic-bezier(.2,.7,.2,1) ${D(k * stepMs)}ms`; c.el.style.zIndex = z; put(c, x, y, rot, s); c.fx = x; c.fy = y; c.frot = rot; c.fs = s; });
  await wait(380 + S.cards.length * stepMs + 80); S.cards.forEach(c => (c.el.style.transition = ""));
}
function updateDrawHint() {
  const left = SPREADS[S.spread].positions.length - S.picked.length;
  hint.innerHTML = left ? `隨心取牌，尚須 ${left} 張<small>滑過牌列再放開，或將牌拖上石桌</small>` : "";
}

// ---------------- 抽牌 ----------------
const rowCards = () => S.cards.filter(c => !c.picked && !c.gone);
let lifted = null, pressing = false;
function cardAtPointer(e) {
  const list = rowCards(); if (!list.length) return null;
  const cs = cardSize(); if (e.clientY < list[0].fy - cs.h * 0.8) return null;
  let best = null, d = 1e9; for (const c of list) { const dd = Math.abs(c.fx - e.clientX); if (dd < d) { d = dd; best = c; } }
  return best;
}
function setLift(c) {
  if (c === lifted) return;
  const prev = lifted; lifted = c;
  for (const x of [prev, c]) if (x) { x.el.style.transition = `transform ${D(160)}ms ease`; x.el.classList.toggle("lift", x === c); put(x, x.fx, x.fy - (x === c ? 24 : 0), x.frot, x.fs); }
  if (c) { audio.rustle(); if (navigator.vibrate) navigator.vibrate(4); }
}
// 兩種取牌方式：按住牌列左右滑動、放開即取出；或按住一張牌往上拖到石桌再放開
let drag = null, downY = 0;
stage.addEventListener("pointerdown", e => { if (S.phase !== "draw" || S.busy) return; const c = cardAtPointer(e); if (!c) return; pressing = true; downY = e.clientY; setLift(c); e.preventDefault(); });
stage.addEventListener("pointermove", e => {
  parallax(e);
  if (S.phase !== "draw" || S.busy) return;
  if (pressing && lifted && !drag && downY - e.clientY > 26) { drag = lifted; drag.el.style.transition = ""; drag.el.style.zIndex = 500; drag.el.classList.add("dragging"); }
  if (drag) { const ch = drag.el.offsetHeight * drag.fs; put(drag, e.clientX, e.clientY - ch * 0.25, Math.max(-14, Math.min(14, (e.clientX - drag.fx) * 0.06)), drag.fs * 1.12); stage.classList.toggle("drop-ready", e.clientY < drag.fy - ch * 0.9); return; }
  if (pressing || e.pointerType === "mouse") setLift(cardAtPointer(e));
});
stage.addEventListener("pointerup", e => {
  if (S.phase !== "draw" || !pressing) return; pressing = false; stage.classList.remove("drop-ready");
  if (drag) {
    const c = drag, ch = c.el.offsetHeight * c.fs; drag = null; c.el.classList.remove("dragging");
    if (e.clientY < c.fy - ch * 0.9) return drawCard(c);
    lifted = null; c.el.classList.remove("lift"); c.el.style.transition = `transform ${D(260)}ms cubic-bezier(.3,.7,.2,1)`; put(c, c.fx, c.fy, c.frot, c.fs); return;
  }
  const c = lifted; if (c && cardAtPointer(e) === c) drawCard(c); else setLift(null);
});
stage.addEventListener("pointercancel", () => { pressing = false; if (drag) { const c = drag; drag = null; c.el.classList.remove("dragging"); put(c, c.fx, c.fy, c.frot, c.fs); } setLift(null); });

async function drawCard(c) {
  if (S.busy) return; S.busy = true;
  const k = S.picked.length; c.picked = true; c.el.classList.remove("lift"); lifted = null; S.picked.push({ i: c.i, rev: c.rev }); c.slot = k;
  setFaces(c);
  const to = slotCenter(k), from = { x: c.x, y: c.y, rot: c.rot, s: c.s }, cw = c.el.offsetWidth, ch = c.el.offsetHeight;
  c.el.style.zIndex = 400; c.el.style.transition = "";
  const tf = (x, y, r, s) => `translate(${x - cw / 2}px,${y - ch / 2}px) rotate(${r}deg) scale(${s})`;
  await c.el.animate([{ transform: tf(from.x, from.y, from.rot, from.s) }, { transform: tf((from.x + to.x) / 2, Math.min(from.y, to.y) - 60, -6, 1.04) }, { transform: tf(to.x, to.y, 0, to.s) }], { duration: D(700), easing: "cubic-bezier(.4,.1,.3,1)" }).finished;
  put(c, to.x, to.y, 0, to.s); c.el.style.zIndex = 50 + k;
  slotsEl.children[k].classList.add("filled"); audio.land(); fire.burst(to.x, to.y + ch * to.s * 0.45, 14, { spread: 2.4, up: 0.8, w: cw * to.s });
  updateDrawHint(); S.busy = false;
  if (S.picked.length === SPREADS[S.spread].positions.length) await endDraw();
}
async function endDraw() {
  S.busy = true; hint.style.bottom = "";
  const rest = rowCards(); rest.forEach(c => (c.gone = true));
  const tc = tableCenter();
  await tween(650, p => rest.forEach(c => { put(c, c.fx + (tc.x - c.fx) * ease(p), c.fy + 60 * ease(p), c.frot * (1 - p), c.fs); c.el.style.opacity = 1 - p; }));
  rest.forEach(c => c.el.remove());
  setPhase("flip"); hands.dataset.pose = "reveal";
  hint.textContent = "觸牌翻開，領受神諭"; $("flipAll").hidden = SPREADS[S.spread].positions.length < 2;
  S.cards.filter(c => c.picked).forEach(c => { c.el.classList.add("tappable"); c.el.onclick = () => flip(c); });
  S.busy = false;
}

// ---------------- 翻牌：暗煙揭開 → 正位金光／逆位餘燼燒轉 ----------------
async function flip(c, fast = false) {
  if (c.flipped || S.phase !== "flip") return; c.flipped = true; c.el.classList.remove("tappable"); c.el.onclick = null;
  const k = c.slot, cw = c.el.offsetWidth, ch = c.el.offsetHeight, W = cw * c.s, Hh = ch * c.s;
  const tf = (lift, s) => `translate(${c.x - cw / 2}px,${c.y - ch / 2 - lift}px) scale(${s})`;
  c.el.style.zIndex = 300; c.face.style.setProperty("--v", "0%"); c.face.style.setProperty("--r", "0%");
  c.el.animate([{ transform: tf(0, c.s) }, { transform: tf(20, c.s * 1.12) }], { duration: D(500), easing: "ease-out", fill: "forwards" });
  const turn = c.inner.animate([{ transform: "rotateY(0deg)" }, { transform: "rotateY(180deg)" }], { duration: D(fast ? 600 : 850), easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" });
  setTimeout(() => { audio.flip(); smoke.burst([c.x / stage.clientWidth, c.y / stage.clientHeight], 0.35); }, D(400));
  await turn.finished; c.inner.style.transform = "rotateY(180deg)"; turn.cancel();
  // 暗煙由下往上散去，露出正位牌圖
  fire.burst(c.x, c.y + Hh * 0.45, 20, { up: 1.3, spread: 1.4, w: W * 1.1 });
  await tween(fast ? 500 : 800, p => c.face.style.setProperty("--v", `${p * 110}%`));
  if (!c.rev) {
    c.el.classList.add("sheen-run"); fire.burst(c.x, c.y - Hh * 0.45, 16, { up: 1.8, spread: 1.2, w: W });
  } else {
    // 逆位：巨蟒瞇眼，牌身一震，餘燼從牌心燒開成逆位牌圖，火星下墜
    await wait(fast ? 200 : 450);
    stage.classList.add("eye-narrow"); c.el.classList.add("shudder", "burning"); audio.hiss();
    const sparks = p => { if (Math.random() < 0.55) fire.burst(c.x + (Math.random() - 0.5) * W * (0.3 + p), c.y + (Math.random() - 0.5) * Hh * (0.3 + p), 2, { down: true, spread: 1.2, hue: 12 }); };
    if (hasArt(c.i) && !reduced) {
      // 有正式牌圖：金框正位牌面燒開，露出逆位牌面（黑框素材到位後即為黑殼）
      try { const done = await burnCard(c.face, artPath(c.i, false), artPath(c.i, true), fast ? 1100 : 1700, sparks); c.face.style.setProperty("--r", "125%"); done(); }
      catch (_) { c.face.style.setProperty("--r", "125%"); }
    } else await tween(fast ? 700 : 1100, p => { c.face.style.setProperty("--r", `${ease(p) * 125}%`); sparks(p); });
    c.el.classList.remove("burning", "shudder"); setTimeout(() => stage.classList.remove("eye-narrow"), D(500));
  }
  // 抬起的牌平順降回原位，再收掉動畫（直接取消會讓牌瞬間跳回，看起來像抽搐）
  await c.el.animate([{ transform: tf(20, c.s * 1.12) }, { transform: tf(0, c.s) }], { duration: D(fast ? 260 : 380), easing: "cubic-bezier(.3,.7,.2,1)", fill: "forwards" }).finished;
  c.el.getAnimations().forEach(a => a.cancel()); put(c, c.x, c.y, 0, c.s); c.el.style.zIndex = 50 + k;
  const slot = slotsEl.children[k]; slot.querySelector(".nm").innerHTML = `${esc(CARDS[c.i][0])}<small>${c.rev ? "逆位" : "正位"}</small>`; slot.classList.add("named");
  S.flipped++;
  if (S.flipped === SPREADS[S.spread].positions.length) { $("flipAll").hidden = true; hint.textContent = ""; await oracle(); }
}
$("flipAll").addEventListener("click", async () => { $("flipAll").hidden = true; for (const c of S.cards.filter(c => c.picked && !c.flipped)) { flip(c, true); await wait(450); } });

// ---------------- 神諭：蛇眼亮起、逐字顯現 ----------------
function utter(text, ms = 70) {
  utterEl.innerHTML = [...text].map((ch, i) => `<span style="animation-delay:${D(i * ms)}ms">${esc(ch)}</span>`).join("");
  return wait(text.length * ms + 700);
}
async function oracle() {
  setPhase("oracle");
  S.R = buildReading({ question: (S.question || ""), topicSel: S.topic, spread: S.spread, picked: S.picked, seed: S.seed });
  save(); startAI(S.R);
  await wait(400);
  stage.classList.add("eye-flare"); audio.chime(); serpent.setSpeed(110); if (temple) temple.sway(0.25); smoke.burst([0.5, 0.3], 1); hands.dataset.pose = "offer";
  await wait(800); await utter(S.R.verdict.text); await wait(900);
  stage.classList.remove("eye-flare"); serpent.setSpeed(40); if (temple) temple.sway(1);
  openReading();
}

// ---------------- 解讀紙卷 ----------------
// 主文是女祭司的話（AI）：以古法解讀（規則引擎）為根據，結合求問者的所問；AI 無法開口時，古法解讀直接成為主文
let aiRun = null;
function startAI(R) {
  if (S.shared) return null;
  const run = { R, text: "", done: false, error: null, subs: new Set() }; aiRun = run;
  const ping = () => run.subs.forEach(f => f());
  aiReading(R, t => { run.text = t; ping(); })
    .then(() => { run.done = true; if (aiRun === run && run.text.trim()) { S.aiText = run.text; save(); } ping(); })
    .catch(e => { run.error = e || { code: "http" }; run.done = true; ping(); });
  return run;
}
const cleanAI = t => String(t || "").replace(/\r/g, "").replace(/\*\*|__/g, "").replace(/^#+\s*/gm, "");
// 第一段若是一句短短的讖語，獨立成大字；其餘是正文段落
function splitAI(t) {
  const parts = cleanAI(t).split(/\n\s*\n/).map(x => x.replace(/\n+/g, "").trim()).filter(Boolean);
  if (parts.length && parts[0].length <= 34) return { omen: parts[0], body: parts.slice(1) };
  return { omen: "", body: parts };
}
function paintVoice(text, done) {
  const box = $("oracleText"); if (!box) return;
  const { omen, body } = splitAI(text), om = $("omenLine");
  om.hidden = !omen; if (om.textContent !== omen) om.textContent = omen;
  body.forEach((t, i) => { let p = box.children[i]; if (!p) { p = document.createElement("p"); p.className = "rise"; box.appendChild(p); } if (p.textContent !== t) p.textContent = t; });
  while (box.children.length > body.length) box.lastElementChild.remove();
  $("voice").classList.toggle("speaking", !done); $("voiceWait").hidden = !!text.trim();
  if (done && aiQuota.user != null) $("voiceNote").textContent = `今日神力尚可應汝 ${aiQuota.user} 次`;
}
const QUOTA_MSG = {
  quota_user: n => ["神力耗盡", `今日女祭司已為汝開口 ${n || 5} 次，神力暫竭。\n此殿不收分文，故每位求問者一日以 ${n || 5} 次為限。\n此番改依古法解讀；待子夜過後神力復甦，再來叩問。`],
  quota_site: n => ["神力耗盡", `今日求問者眾，殿中神力已然耗盡。\n此殿不收分文，故全殿眾人一日共以 ${n || 100} 次為限。\n此番改依古法解讀；待子夜過後，再來叩問。`]
};
function voiceFail(e) {
  const v = $("voice"); if (!v || v.classList.contains("silent")) return;
  v.classList.remove("speaking"); v.classList.add("silent"); $("voiceWait").hidden = true; $("omenLine").hidden = true;
  const quota = QUOTA_MSG[e && e.code];
  $("voiceNote").textContent = quota ? "神力已竭，此番依古法解讀。" : e && e.code === "rate_limited" ? "求問者眾，神殿一時難應；此番依古法解讀。" : "今夜神氣稀薄，女祭司未能開口；此番依古法解讀。";
  const deep = $("deep"); deep.open = true; deep.classList.add("lead");
  if (quota) { const n = e.info && (e.info.perUser || e.info.perSite); const [t, b] = quota(n); showNotice(t, b); }
}
function showNotice(title, body) {
  $("noticeTitle").textContent = title; $("noticeBody").textContent = body;
  const n = $("notice"); n.hidden = false; requestAnimationFrame(() => n.classList.add("open")); audio.hiss();
}
document.addEventListener("click", e => {
  const box = e.target.closest("#notice, #lightbox"); if (!box) return;
  if (e.target.closest("[data-close]") || e.target === box || box.id === "lightbox") { box.classList.remove("open"); setTimeout(() => (box.hidden = true), 320); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape") ["notice", "lightbox"].forEach(id => { const b = $(id); if (!b.hidden) { b.classList.remove("open"); setTimeout(() => (b.hidden = true), 320); } }); });
// 看大圖：牌面，旁邊是這張牌所畫的神話故事——以史詩口吻寫成的介紹（依需求方提供的背景故事）與出處
function openCard(k) {
  const c = S.R && S.R.cards[k]; if (!c) return; const m = MYTH[c.id], ep = EPIC[c.id];
  $("lbCard").innerHTML = faceSVG(c.id, c.rev);
  $("lbCap").innerHTML = `<header>${c.position ? `<small>${esc(c.position)}</small>` : ""}<b>${esc(c.name)}<em>${c.orientation}</em></b></header>`
    + (ep ? `<section class="lb-myth"><h4>牌上的故事${m ? `・${esc(m[0])}` : ""}</h4><p>${esc(ep[c.rev ? 1 : 0])}</p>${m ? `<p class="src">出處：${esc(m[3])}</p>` : ""}</section>` : "")
    + `<p class="kw">${esc(c.keywords)}</p>`;
  const lb = $("lightbox"); lb.hidden = false; lb.scrollTop = 0; requestAnimationFrame(() => lb.classList.add("open")); audio.flip();
}
function openReading(instant = false) {
  setPhase("read");
  const R = S.R, paras = readingParagraphs(R), useAI = !S.shared || !!S.aiText; // 朋友分享來的神諭若帶著女祭司之言，照樣呈現
  $("readingIn").innerHTML = `${S.shared ? `<p class="from">友人託付予汝之神諭</p>` : ""}<div class="verdict"><p class="q">所取預兆：${esc(R.topic.label)}　目光落於：${esc(SPREADS[R.spread.id].gaze)}</p>${R.question ? `<p class="asked">汝之所問：「${esc(R.question)}」</p>` : ""}<p class="ans">${esc(R.verdict.text)}</p></div>
<div class="cardstrip">${R.cards.map((c, k) => `<button type="button" class="cs" data-k="${k}" aria-label="看大圖：${esc(c.position)}・${esc(c.name)}${c.orientation}"><span class="cs-face">${faceSVG(c.id, c.rev)}</span>${R.cards.length > 1 ? `<small>${esc(c.position)}</small>` : ""}<b>${esc(c.name)}${c.rev ? "<em>逆</em>" : ""}</b></button>`).join("")}</div>
${useAI ? `<section class="voice" id="voice" aria-live="polite"><h3>女祭司之言</h3><p class="omen-line" id="omenLine" hidden></p><div class="oracle-text" id="oracleText"></div><p class="voice-wait" id="voiceWait">神氣自地縫升起，女祭司正要開口……</p><p class="voice-note" id="voiceNote"></p></section>` : ""}
${S.shared ? "" : `<div class="acts lead"><button type="button" class="primary" data-share>傳出這則神諭</button></div>`}
<details class="basic deep${useAI ? "" : " lead"}" id="deep"${useAI ? "" : " open"}><summary>${useAI ? "古法細解" : "神諭細解"}</summary><p class="detail">${esc(R.verdict.detail)}</p><div class="story">${paras.map(p => p.kind === "h" ? `<h3>${p.html}</h3>` : `<p class="${p.kind}" data-cards="${p.cards.join(",")}">${p.html}</p>`).join("")}</div></details>
<details class="basic"><summary>各牌本義</summary>${R.cards.map(c => `<div class="it"><h4>${esc(c.position)}・${esc(c.name)} <small style="color:var(--mute)">${c.orientation}</small></h4><div class="kw">${esc(c.keywords)}</div><p>${esc(c.rev ? CARDS[c.id][4] : CARDS[c.id][3])}</p></div>`).join("")}</details>
<div class="acts">${S.shared ? `<button type="button" class="primary" id="again">吾亦求問</button><button type="button" data-share>傳出這則神諭</button>` : `<button type="button" class="primary" id="again">再叩一問</button><button type="button" data-share>傳出這則神諭</button><button type="button" id="copy">抄錄全文</button>`}</div>`;
  $("readingIn").scrollTop = 0;
  const sc = $("reading"); sc.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => sc.classList.add("open")));
  followSlots(instant ? 1 : D(900));
  $("readingIn").querySelectorAll(".story p[data-cards]").forEach(p => {
    const ks = p.dataset.cards.split(",").filter(Boolean).map(Number);
    const on = v => { p.classList.toggle("hl", v); S.cards.filter(c => c.picked && ks.includes(c.slot)).forEach(c => c.el.classList.toggle("hl", v)); };
    p.addEventListener("pointerenter", () => on(true)); p.addEventListener("pointerleave", () => on(false));
  });
  $("readingIn").querySelectorAll(".cs").forEach(b => (b.onclick = () => openCard(+b.dataset.k)));
  S.cards.filter(c => c.picked).forEach(c => { c.el.onclick = () => openCard(c.slot); });
  $("again").onclick = again;
  $("readingIn").querySelectorAll("[data-share]").forEach(b => (b.onclick = async () => {
    const run = aiRun && aiRun.R === R ? aiRun : null;
    if (!S.aiText && run && !run.done) {
      const t0 = b.textContent; b.textContent = "待女祭司說完……"; b.disabled = true;
      await new Promise(res => { const f = () => run.done && res(); run.subs.add(f); setTimeout(res, 20000); f(); });
      b.textContent = t0; b.disabled = false;
    }
    shareSheet.open(R, encodeReading({ spread: S.spread, topic: S.topic, seed: S.seed, picked: S.picked }), { shared: S.shared, ai: S.aiText || (run && run.done && !run.error ? run.text : ""), question: S.question || "" });
  }));
  if ($("copy")) $("copy").onclick = async e => {
    const ai = S.aiText ? `【女祭司之言】\n${cleanAI(S.aiText).trim()}\n\n【古法細解】\n` : "";
    try { await navigator.clipboard.writeText(ai + readingPlainText(R)); e.target.textContent = "已抄錄"; } catch (_) { e.target.textContent = "無法抄錄"; }
    setTimeout(() => (e.target.textContent = "抄錄全文"), 1800);
  };
  if (useAI) {
    if (S.aiText) paintVoice(S.aiText, true);
    else {
      const run = aiRun && aiRun.R === R ? aiRun : startAI(R);
      const f = () => { if (!$("voice")) return; if (run.error) voiceFail(run.error); else paintVoice(run.text, run.done); };
      run.subs.add(f); f();
    }
  }
}
function followSlots(ms) {
  const t0 = performance.now();
  (function f(now) { S.cards.filter(c => c.picked).forEach(c => { const p = slotCenter(c.slot); put(c, p.x, p.y, 0, p.s); }); if (now - t0 < ms + 60) requestAnimationFrame(f); })(t0);
}
// 叩問：寫下所問（可留白），按「叩問」或 Enter 進入下一步
const askGo = () => { if (S.phase === "ask" && step === 0) { $("question").blur(); audio.drum(); showStep(1); } };
$("askGo").addEventListener("click", askGo);
// 所問的字數
const updateQCount = () => { const n = [...$("question").value].length; $("qCount").textContent = `${n}／60`; $("qCount").classList.toggle("full", n >= 60); };
$("question").addEventListener("input", updateQCount);
$("question").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); askGo(); } });

async function again() {
  const sc = $("reading"); sc.classList.remove("open"); utter("");
  await wait(500); sc.hidden = true; setPhase("ask"); hands.dataset.pose = "rest";
  const tc = tableCenter();
  await tween(600, p => S.cards.forEach(c => { put(c, c.x + (tc.x - c.x) * ease(p), c.y + (tc.y - c.y) * ease(p), 0, c.s); c.el.style.opacity = 1 - p; }));
  cardsEl.innerHTML = ""; S.cards = []; S.picked = []; renderSlots(); S.busy = false; sealFx.reset(); showStep(0);
  if (S.shared) { S.shared = false; clearShareParam(); }
  S.aiText = ""; aiRun = null; $("question").value = ""; updateQCount();
  try { localStorage.removeItem("delphi-last"); } catch (_) {}
}

// ---------------- 凝視、眨眼、視差 ----------------
// 巨蟒的神情：同一顆頭的五格（閉眼、半睜、睜眼、怒視、吐信）切換
const headEl = $("head"); let eyeBase = "closed", eyeTemp = null, eyeBusy = false;
function eyeSeq(seq) { if (eyeBusy) return; eyeBusy = true; let t = 0; seq.forEach(([f, ms]) => { setTimeout(() => (eyeTemp = f), t); t += ms; }); setTimeout(() => { eyeTemp = null; eyeBusy = false; }, t); }
function eyeFrame() { const f = stage.classList.contains("eye-narrow") ? "glare" : eyeTemp || eyeBase; if (headEl.dataset.eye !== f) headEl.dataset.eye = f; }
// 眼瞼：同一張蛇圖重繪成閉眼版，只取兩眼周圍疊上；以透明度切換——0 睜眼、0.5 瞇眼、1 闔眼
const lids = document.querySelector(".serpent .lids");
function lid(v, ms = 90) { if (temple) return temple.lid(v, D(ms)); lids.style.transition = `opacity ${D(ms)}ms ease`; lids.style.opacity = v; }
const lidNow = () => (temple ? temple.lidValue : +lids.style.opacity || 0);
function blink(double = false) {
  if (stage.classList.contains("eye-flare") || stage.classList.contains("eye-narrow")) return;
  // 巨蟒眨眼要慢：緩緩闔上、停一拍、再緩緩睜開
  lid(1, 260); setTimeout(() => lid(0, 420), D(480));
  if (double) setTimeout(() => { lid(1, 240); setTimeout(() => lid(0, 400), D(440)); }, D(1100));
}
(function blinkLoop() { if (!reduced && !S.intro) blink(Math.random() < 0.1); setTimeout(blinkLoop, 7000 + Math.random() * 7000); })();
new MutationObserver(() => {
  if (stage.classList.contains("eye-narrow")) lid(0.85, 220); // 逆位：巨蟒瞇起眼，只剩一線金光
  else if (stage.classList.contains("eye-flare")) lid(0, 300);
  if (temple) temple.glow(stage.classList.contains("eye-flare") ? 1 : 0, stage.classList.contains("eye-flare") ? 900 : 1600);
  else if (lidNow() > 0 && lidNow() < 1) lid(0, 260);
}).observe(stage, { attributes: true, attributeFilter: ["class"] });
const layers = [...document.querySelectorAll(".layer[data-depth]")];
const par = { x: 0, y: 0, tx: 0, ty: 0 };
function parallax(e) { if (e.pointerType !== "mouse") return; par.tx = e.clientX / innerWidth - 0.5; par.ty = e.clientY / innerHeight - 0.5; }

// ---------------- 工具列 ----------------
$("sound").addEventListener("click", e => { const on = audio.toggle(); e.currentTarget.setAttribute("aria-pressed", on); });

// ---------------- 保存與還原上次的神諭 ----------------
function save() { if (S.shared) return; try { localStorage.setItem("delphi-last", JSON.stringify({ spread: S.spread, q: S.question || "", tp: S.topic, picked: S.picked, seed: S.seed, ai: S.aiText || "" })); } catch (_) {} }
function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem("delphi-last") || "null");
    if (!s || !SPREADS[s.spread] || !Array.isArray(s.picked) || s.picked.length !== SPREADS[s.spread].positions.length || !s.picked.every(c => CARDS[c.i])) return null;
    return { spread: s.spread, topic: s.tp, seed: s.seed | 0, question: s.q || "", ai: typeof s.ai === "string" ? s.ai : "", picked: s.picked.map(c => ({ i: c.i, rev: !!c.rev })) };
  } catch (_) { return null; }
}
// 直接攤開一則已有的神諭（上回的，或朋友分享來的）
function showReading(r, { shared = false } = {}) {
  S.shared = shared; S.spread = r.spread; S.seed = r.seed; S.question = r.question || ""; S.aiText = r.ai || ""; S.topic = TOPIC_LABEL[r.topic] ? r.topic : "auto"; showTopic();
  S.spreadSet = true; renderSlots(); S.picked = r.picked;
  S.cards = S.picked.map((c, k) => { const o = makeCard(c, k); o.picked = o.flipped = true; o.slot = k; setFaces(o); o.inner.style.transform = "rotateY(180deg)"; o.face.style.setProperty("--v", "110%"); o.face.style.setProperty("--r", c.rev ? "125%" : "0%"); return o; });
  S.cards.forEach(c => { slotsEl.children[c.slot].classList.add("filled", "named"); slotsEl.children[c.slot].querySelector(".nm").innerHTML = `${esc(CARDS[c.i][0])}<small>${c.rev ? "逆位" : "正位"}</small>`; });
  S.R = buildReading({ question: S.question, topicSel: S.topic, spread: S.spread, picked: S.picked, seed: S.seed });
  openReading();
}
const clearShareParam = () => { try { history.replaceState(null, "", location.pathname + location.hash); } catch (_) {} };

// ---------------- 主迴圈 ----------------
function loop(t) {
  par.x += (par.tx - par.x) * 0.05; par.y += (par.ty - par.y) * 0.05;
  const drift = reduced ? 0 : Math.sin(t / 7000) * 0.15;
  layers.forEach(l => { const d = +l.dataset.depth; l.style.transform = `translate(${-(par.x + drift) * d * innerWidth}px,${-par.y * d * innerHeight}px)`; });
  if (temple) temple.frame(t);
  smoke.frame(t); fire.frame(t); eyeFrame();
  requestAnimationFrame(loop);
}
new ResizeObserver(() => {
  layout(); applyAtmosphere(); fire.resize(); if (S.phase === "ask" && step === 1) layoutOmens(); if (S.phase === "ask" && step === 2) placeBeam();
  if (S.phase === "draw") ribbonLayout().forEach(({ c, x, y, rot, s }) => { if (!c.picked) { put(c, x, y - (c === lifted ? 24 : 0), rot, s); c.fx = x; c.fy = y; c.frot = rot; c.fs = s; } });
  if (["flip", "oracle", "read", "knock"].includes(S.phase)) followSlots(0);
}).observe(stage);

// 舞台是 overflow:hidden 的固定畫面，但焦點移動或捲入檢視仍可能把它捲走；一律拉回原位
stage.addEventListener("scroll", () => { if (stage.scrollTop || stage.scrollLeft) stage.scrollTo(0, 0); });
layout(); applyAtmosphere();
requestAnimationFrame(loop);
(CONFIG.EXT_DATA ? loadExtData() : Promise.resolve()).then(() => { if (S.R) S.R = buildReading({ question: (S.question || ""), topicSel: S.topic, spread: S.spread, picked: S.picked, seed: S.seed }); });
window.__delphi = { S, flip, drawCard, again, offer, sealFx, chooseSpread };

// ---------------- 進入畫面：山巒上的神殿 → 撥開帷幕 → 內殿見證異相 ----------------
// 等神殿、內殿、巨蟒與字體載好，帷幕才能撥開；第一次觸碰帷幕時開啟聲音（瀏覽器要求聲音由點擊啟動）
const shareSheet = createShareSheet({ audio });
let sharedR = decodeReading(new URLSearchParams(location.search).get("r")); const savedR = loadSaved();
const introEl = $("intro"), enterAlt = $("enterAlt"), skipBtn = $("introSkip");
let visited = false; try { visited = !!localStorage.getItem("oracle-visited"); } catch (_) {}
lid(1, 0); // 巨蟒闔眼，等求問者走進來
const gate = createGate($("gate"), { reduced, onTouch: () => { if (!audio.on) { audio.toggle(); $("sound").setAttribute("aria-pressed", "true"); } audio.rustle(); } });
let mode = sharedR ? "shared" : "new";
// 朋友分享的神諭：?r= 只有牌陣；?s= 是短連結，向 Worker 取回完整內容（讖語、女祭司之言、可能附上的所問）
const sid = new URLSearchParams(location.search).get("s");
const sharedP = sid && /^[0-9a-zA-Z]{8}$/.test(sid) && CONFIG.AI_ENDPOINT
  ? fetch(`${CONFIG.AI_ENDPOINT}s/${sid}.json`).then(r => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null);
function showSharedIntro() {
  const sp = SPREADS[sharedR.spread], cards = sharedR.picked.map((c, k) => `<span class="c">${sp.positions.length > 1 ? `<small>${esc(sp.positions[k])}</small>` : ""}${esc(CARDS[c.i][0])}${c.rev ? "<em>逆</em>" : ""}</span>`).join("");
  const omen = sharedR.ai ? splitOracle(sharedR.ai).omen : "";
  $("introBody").innerHTML = `<p class="intro-line">有人在神殿前留下一則神諭，託付予汝。</p>${omen ? `<p class="intro-omen">「${esc(omen)}」</p>` : ""}${sharedR.question ? `<p class="intro-shared">所問「${esc(sharedR.question)}」</p>` : `<p class="intro-shared">所取預兆　${esc(TOPIC_LABEL[sharedR.topic] || "任火自顯")}　・　垂視　${esc(sp.gaze)}</p>`}<p class="intro-cards">${cards}</p>`;
  enterAlt.textContent = "吾亦求問"; enterAlt.hidden = false; mode = "shared";
}
if (sharedR) showSharedIntro();
else if (savedR) { enterAlt.textContent = "重看上回神諭"; enterAlt.hidden = false; }
const sharedReady = sharedP.then(rec => {
  const r = rec && decodeReading(rec.code); if (!r) return;
  sharedR = Object.assign(r, { ai: rec.text || "", question: rec.question || "" }); showSharedIntro();
});
skipBtn.hidden = !visited;
const loadImg = src => new Promise(r => { const i = new Image(); i.onload = i.onerror = r; i.src = src; });
const wideNow = stage.clientWidth / stage.clientHeight >= 1.1;
const jobs = [...gateImages(wideNow), SCENES[wideNow ? "wide" : "portrait"].img, SCENES[wideNow ? "wide" : "portrait"].lids, "assets/ui/seal.webp", "assets/cards/back.webp", ...OMENS.map(o => `assets/omens/${o[0]}.webp`), ...SIGILS.map(x => `assets/spreads/${x[0]}.webp`)].map(loadImg)
  .concat([document.fonts.load("700 20px 'Oracle Display'", "神諭塔羅撥開帷幕"), document.fonts.load("600 20px Cinzel", "ORACLE")].map(p => p.catch(() => {})));
let doneN = 0;
jobs.forEach(j => j.then(() => { doneN++; const v = Math.round(doneN / jobs.length * 100); $("introBar").style.width = v + "%"; $("introLoad").setAttribute("aria-valuenow", v); }));
Promise.all([...jobs, sharedReady]).then(() => { introEl.classList.add("ready"); gate.arm(); enterAlt.disabled = false; });
// 另一條路（「吾亦求問」「重看上回的神諭」）與「直接入殿」也一樣要穿過帷幕，只是由帷幕自己拉開
enterAlt.onclick = () => { mode = sharedR ? "new" : "saved"; gate.open(); };
skipBtn.onclick = () => gate.open(true);
gate.opened.then(() => enter(mode));
async function enter(m) {
  if (!S.intro) return; S.intro = false;
  try { localStorage.setItem("oracle-visited", "1"); } catch (_) {}
  // 鏡頭穿過門口：神殿往門內推近、門內的光吞沒畫面，再從光裡現出內殿
  audio.hiss(); introEl.classList.add("through");
  await wait(reduced ? 0 : 1250);
  stage.classList.remove("intro-on"); introEl.classList.add("out"); setTimeout(() => introEl.remove(), D(1600));
  fire.set({ power: 3 }); smoke.burst([0.5, 0.62], 0.9); audio.drum();
  await wait(700); lid(0, 900); // 巨蟒睜眼
  await wait(600);
  if (m === "shared") return showReading(sharedR, { shared: true });
  if (sharedR) { clearShareParam(); sharedR = null; }
  if (m === "saved") return showReading(savedR);
  whisper("求問者，汝終於來了"); await wait(1400);
  showStep(0);
}
