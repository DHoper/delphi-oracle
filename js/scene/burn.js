// 逆位燃燒：金框牌面從幾處火點不規則燒開——前緣一圈由白轉橙的餘燼光、外側一圈焦痕——燒過之處露出逆位牌面
// 逐像素在畫布上計算（分形雜訊＋火點距離決定燃燒的先後），各瀏覽器都能跑；結束後移除畫布，交回牌面本身
const cache = {};
const loadImg = src => (cache[src] ||= new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));

function noiseField(W, H) {
  // 兩層數值雜訊（粗＋細）＋三個火點：離火點越近、雜訊越低，越早燒穿
  const grid = (gx, gy) => { const g = new Float32Array((gx + 1) * (gy + 1)); for (let i = 0; i < g.length; i++) g[i] = Math.random(); return { g, gx, gy }; };
  const L1 = grid(7, 12), L2 = grid(18, 30);
  const sample = ({ g, gx, gy }, u, v) => {
    const x = u * gx, y = v * gy, x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), w = gx + 1;
    const a = g[y0 * w + x0], b = g[y0 * w + Math.min(gx, x0 + 1)], c = g[Math.min(gy, y0 + 1) * w + x0], d = g[Math.min(gy, y0 + 1) * w + Math.min(gx, x0 + 1)];
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  const pts = [[0.3 + Math.random() * 0.4, 0.35 + Math.random() * 0.3], [Math.random() * 0.3, 0.75 + Math.random() * 0.2], [0.7 + Math.random() * 0.3, 0.05 + Math.random() * 0.3]];
  const N = new Float32Array(W * H); let lo = 9, hi = -9;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / W, v = y / H; let dmin = 9;
    for (const [px, py] of pts) dmin = Math.min(dmin, Math.hypot((u - px) * 0.6, v - py));
    const n = 0.42 * (sample(L1, u, v) * 0.7 + sample(L2, u, v) * 0.3) + 0.58 * Math.min(1, dmin * 1.35);
    N[y * W + x] = n; if (n < lo) lo = n; if (n > hi) hi = n;
  }
  for (let i = 0; i < N.length; i++) N[i] = (N[i] - lo) / (hi - lo);
  return N;
}

/** 在 faceEl 上燒：from 圖 → to 圖；onFrame(p) 每格呼叫一次（給火星用）；回傳結束時的 Promise */
export async function burnCard(faceEl, fromSrc, toSrc, ms, onFrame) {
  const [A0, B0] = await Promise.all([loadImg(fromSrc), loadImg(toSrc)]);
  const dpr = Math.min(2, devicePixelRatio || 1), W = Math.max(60, Math.round(faceEl.clientWidth * dpr)), H = Math.max(100, Math.round(faceEl.clientHeight * dpr));
  const cv = document.createElement("canvas"); cv.className = "burnfx"; cv.width = W; cv.height = H; faceEl.appendChild(cv);
  const ctx = cv.getContext("2d");
  const grab = img => { const o = document.createElement("canvas"); o.width = W; o.height = H; const x = o.getContext("2d"); const s = Math.max(W / img.width, H / img.height); x.drawImage(img, (W - img.width * s) / 2, (H - img.height * s) / 2, img.width * s, img.height * s); return x.getImageData(0, 0, W, H).data; };
  const A = grab(A0), B = grab(B0), N = noiseField(W, H), out = ctx.createImageData(W, H), O = out.data;
  const EDGE = 0.07, SCORCH = 0.05;
  await new Promise(res => {
    const t0 = performance.now();
    (function f(now) {
      const p = Math.min(1, (now - t0) / ms), q = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, T = q * (1 + EDGE + SCORCH) - EDGE;
      for (let i = 0, j = 0; i < N.length; i++, j += 4) {
        const n = N[i];
        if (n < T) { // 已燒穿：逆位牌面
          O[j] = B[j]; O[j + 1] = B[j + 1]; O[j + 2] = B[j + 2];
        } else if (n < T + EDGE) { // 燃燒的前緣：越靠前越亮（白→金→橙），疊在原牌面上
          const g = 1 - (n - T) / EDGE, hot = g * g;
          O[j] = Math.min(255, A[j] * (1 - g) + 255 * g + 40 * hot); O[j + 1] = Math.min(255, A[j + 1] * (1 - g) + (120 + 120 * hot) * g); O[j + 2] = Math.min(255, A[j + 2] * (1 - g) + (30 + 150 * hot * hot) * g);
        } else if (n < T + EDGE + SCORCH) { // 焦痕：原牌面被烤得發黑發褐
          const k = 1 - (n - T - EDGE) / SCORCH, dk = 1 - 0.75 * k;
          O[j] = A[j] * dk + 30 * k; O[j + 1] = A[j + 1] * dk + 14 * k; O[j + 2] = A[j + 2] * dk;
        } else { O[j] = A[j]; O[j + 1] = A[j + 1]; O[j + 2] = A[j + 2]; }
        O[j + 3] = 255;
      }
      ctx.putImageData(out, 0, 0); onFrame && onFrame(q);
      if (p < 1) requestAnimationFrame(f); else res();
    })(t0);
  });
  return () => cv.remove();
}
