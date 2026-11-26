// 巨蟒皮同的身軀：單一一條連續的身體，以透視的螺旋盤繞內殿。
// 從頭部後方（遠處，細而暗）接出 → 繞向右側 → 橫過石桌前方（近處，粗而亮）→ 沿左側退向遠處
// → 從頭部後方再繞出來，盤成更大的第二圈，最後游出畫面下緣。遠段畫在頭部後面的畫布，近段畫在前面。
const N = 560;

function placeholderTexture() {
  const c = document.createElement("canvas"), w = 256, h = 128; c.width = w * 2; c.height = h;
  const x = c.getContext("2d"); x.fillStyle = "#3a2c14"; x.fillRect(0, 0, w * 2, h);
  return { img: c, w, h };
}
function resample(pts) {
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const L = cum[cum.length - 1], out = [];
  for (let k = 0, j = 0; k < N; k++) {
    const s = (L * k) / (N - 1);
    while (j < pts.length - 2 && cum[j + 1] < s) j++;
    const t = (s - cum[j]) / (cum[j + 1] - cum[j] || 1), a = pts[j], b = pts[j + 1];
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
  }
  return out;
}

export function createSerpent(far, near, stage, { reduced }) {
  const cF = far.getContext("2d"), cN = near.getContext("2d");
  let W = 0, H = 0, dpr = 1, tex = placeholderTexture();
  const img = new Image();
  img.onload = () => { const c = document.createElement("canvas"); c.width = img.width * 2; c.height = img.height; const x = c.getContext("2d"); x.drawImage(img, 0, 0); x.drawImage(img, img.width, 0); tex = { img: c, w: img.width, h: img.height }; };
  img.src = "assets/serpent/body.webp";

  let mode = "arch", from = null, to = null, cur = null, mt = 1, mdur = 1, offset = 0, speed = 40, speedT = 40;
  const baseTh = () => Math.max(60, Math.min(170, Math.min(W, H) * 0.17));

  function shape(m) {
    const tb = stage.querySelector(".table");
    const cx = tb.offsetLeft + tb.offsetWidth / 2, cy = tb.offsetTop + tb.offsetHeight * 0.42, k = m === "tight" ? 0.9 : 1;
    const rx0 = (tb.offsetWidth / 2 + Math.max(W * 0.07, 46)) * k, ry0 = H * 0.215 * k, P = [];
    // θ：-90° 在正後方（遠），90° 在正前方（近）；順時針繞 1.5 圈，半徑漸增
    const T0 = -Math.PI / 2, T1 = T0 + Math.PI * 3.05, steps = 150;
    for (let i = 0; i <= steps; i++) {
      const u = i / steps, th = T0 + (T1 - T0) * u, grow = Math.max(0, u - 0.3) / 0.7, g = grow * grow;
      const rx = rx0 * (1 + g * 0.75), ry = ry0 * (1 + g * 1.9);
      const wob = Math.sin(th * 2.3 + 0.7) * H * 0.012; // 身體自然的起伏，不是正圓
      P.push({ x: cx + Math.cos(th) * rx + Math.sin(th * 1.7) * W * 0.012, y: cy + Math.sin(th) * ry + wob - g * H * 0.02, z: (Math.sin(th) + 1) / 2 });
    }
    return P;
  }
  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2); W = far.clientWidth; H = far.clientHeight;
    for (const c of [far, near]) { c.width = W * dpr; c.height = H * dpr; }
    cF.setTransform(dpr, 0, 0, dpr, 0, 0); cN.setTransform(dpr, 0, 0, dpr, 0, 0);
    cur = resample(shape(mode)); from = null;
  }
  resize(); new ResizeObserver(resize).observe(far);

  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function go(m, dur = 1.6) { mode = m; from = cur.map(p => ({ ...p })); to = resample(shape(m)); mt = 0; mdur = reduced ? 0.01 : dur; }

  let last = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    speed += (speedT - speed) * 0.05; if (!reduced) offset += speed * dt;
    if (from) {
      mt = Math.min(1, mt + dt / mdur); const e = ease(mt);
      cur = from.map((a, i) => ({ x: a.x + (to[i].x - a.x) * e, y: a.y + (to[i].y - a.y) * e, z: to[i].z }));
      if (mt >= 1) { cur = to; from = null; }
    }
    cF.clearRect(0, 0, W, H); cN.clearRect(0, 0, W, H);
    const b = baseTh() * (1 + (reduced ? 0 : Math.sin(t / 2600) * 0.02));
    let s = 0;
    for (let i = 0; i < N - 1; i++) {
      const a = cur[i], c = cur[i + 1], len = Math.hypot(c.x - a.x, c.y - a.y);
      if (len < 0.01) continue;
      const th = b * (0.42 + 0.95 * a.z), k = tex.h / th; // 透視：遠細近粗
      if (Math.max(a.y, c.y) > -th && Math.min(a.y, c.y) < H + th && Math.max(a.x, c.x) > -th && Math.min(a.x, c.x) < W + th) {
        const ctx = a.z < 0.38 ? cF : cN;
        const sx = ((s + offset * (0.5 + a.z)) * k) % tex.w, sw = Math.min((len + 3) * k, tex.w);
        ctx.globalAlpha = 0.3 + 0.7 * a.z; // 遠處沒入黑暗
        ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(c.y - a.y, c.x - a.x));
        ctx.drawImage(tex.img, sx, 0, sw, tex.h, -1, -th / 2, len + 3, th);
        ctx.restore();
      }
      s += len * (b / th) * 0.9;
    }
  }
  return { frame, go, resize, setSpeed(v) { speedT = v; }, get mode() { return mode; } };
}
