// 入口：山巒上的德爾菲神殿。門口垂著帷幕——用手指往兩邊撥開（或輕觸一下），帷幕滑向柱後，門內的光湧出
// 全景圖以 cover 鋪滿，門口中心對準畫面水平中線；帷幕是同一張圖沿中縫裁下的左右兩片，疊回門口的位置
const SCENES = {
  portrait: { img: "assets/gate/gate-portrait.webp", l: "assets/gate/curtain-portrait-l.webp", r: "assets/gate/curtain-portrait-r.webp", ar: 1536 / 2752, door: [32.878, 50.13, 67.057, 29.797, 59.775], focusY: 0.46 },
  wide: { img: "assets/gate/gate-wide.webp", l: "assets/gate/curtain-wide-l.webp", r: "assets/gate/curtain-wide-r.webp", ar: 2752 / 1536, door: [44.586, 50.036, 55.487, 30.078, 60.026], focusY: 0.5 }
};
export const gateImages = wide => { const s = SCENES[wide ? "wide" : "portrait"]; return [s.img, s.l, s.r]; };

export function createGate(root, { reduced, onTouch } = {}) {
  const img = root.querySelector(".gate-img"), door = root.querySelector(".door"), cl = door.querySelector(".curtain.l"), cr = door.querySelector(".curtain.r");
  const host = root.closest(".intro") || root; // 狀態 class 與定位變數放在外層，標題、閃光層也讀得到
  let key = "", armed = false, p = 0, opening = false, drag = null, resolveOpen, touched = false;
  const opened = new Promise(r => (resolveOpen = r));
  const ease = t => 1 - Math.pow(1 - t, 3);

  function layout() {
    const W = root.clientWidth, H = root.clientHeight, k = W / H >= 1.1 ? "wide" : "portrait", S = SCENES[k];
    if (k !== key) { key = k; img.src = S.img; cl.style.backgroundImage = `url(${S.l})`; cr.style.backgroundImage = `url(${S.r})`; }
    const sw = Math.max(W, H * S.ar), sh = sw / S.ar, [x0, xs, x1, y0, y1] = S.door;
    const sx = Math.min(0, Math.max(W - sw, W / 2 - sw * xs / 100)), sy = Math.min(0, Math.max(H - sh, H * S.focusY - sh * (y0 + y1) / 200));
    Object.assign(img.style, { width: sw + "px", height: sh + "px", left: sx + "px", top: sy + "px" });
    const L = sx + sw * x0 / 100, T = sy + sh * y0 / 100, DW = sw * (x1 - x0) / 100, DH = sh * (y1 - y0) / 100;
    Object.assign(door.style, { left: L + "px", top: T + "px", width: DW + "px", height: DH + "px" });
    door.style.setProperty("--seam", ((xs - x0) / (x1 - x0)).toFixed(4));
    // 給標題與說明文字排版用：門楣以上、門檻以下各有多少空間
    host.style.setProperty("--door-top", T + "px"); host.style.setProperty("--door-bottom", T + DH + "px");
    host.style.setProperty("--ox", L + DW * (xs - x0) / (x1 - x0) + "px"); host.style.setProperty("--oy", T + DH * 0.55 + "px");
    host.dataset.orient = k; set(p);
  }
  // p：0 闔上、1 全開。兩片帷幕各自往外滑並收攏，門內的光隨之變亮
  function set(v) {
    p = v; const w = door.clientWidth, s = parseFloat(door.style.getPropertyValue("--seam")) || 0.5;
    cl.style.transform = `translateX(${-v * w * s * 0.95}px) scaleX(${1 - 0.42 * v}) skewY(${v * 1.6}deg)`;
    cr.style.transform = `translateX(${v * w * (1 - s) * 0.95}px) scaleX(${1 - 0.42 * v}) skewY(${-v * 1.6}deg)`;
    door.style.setProperty("--g", (0.18 + 0.82 * v).toFixed(3));
  }
  function tweenTo(to, ms) {
    return new Promise(res => {
      const from = p, t0 = performance.now(), T = reduced ? 1 : ms;
      (function f(now) { const k = Math.min(1, (now - t0) / T); set(from + (to - from) * ease(k)); if (k < 1) requestAnimationFrame(f); else res(); })(t0);
    });
  }
  async function open(fast = false) {
    if (opening) return; opening = true; armed = false; host.classList.add("opening");
    if (!touched) { touched = true; onTouch && onTouch(); }
    await tweenTo(1, fast ? 500 : 1100);
    resolveOpen();
  }
  door.addEventListener("pointerdown", e => {
    if (!armed || opening) return; e.preventDefault();
    try { door.setPointerCapture(e.pointerId); } catch (_) {}
    if (!touched) { touched = true; onTouch && onTouch(); }
    drag = { x: e.clientX, p0: p, moved: false }; host.classList.add("held");
  });
  door.addEventListener("pointermove", e => {
    if (!drag) return; const dx = Math.abs(e.clientX - drag.x);
    if (dx > 6) drag.moved = true;
    if (drag.moved) set(Math.min(1, drag.p0 + dx / (door.clientWidth * 0.75)));
  });
  const up = () => {
    if (!drag) return; const { moved } = drag; drag = null; host.classList.remove("held");
    if (!moved || p > 0.28) open(); else tweenTo(0, 380); // 輕觸或撥開超過三成：帷幕自己拉開；撥得太少：垂回原處
  };
  door.addEventListener("pointerup", up); door.addEventListener("pointercancel", up); door.addEventListener("lostpointercapture", up);
  door.addEventListener("keydown", e => { if (armed && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); open(); } });
  new ResizeObserver(layout).observe(root); layout();
  return { layout, open, opened, arm() { armed = true; host.classList.add("armed"); door.tabIndex = 0; }, get progress() { return p; } };
}
