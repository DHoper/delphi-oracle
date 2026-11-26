// 封印：按住時刻紋轉為熔金，火焰沿邊緣燒滿一圈，火星向中心捲入；燒滿即迸出衝擊光環並獻上問題。
// 進度由每一格動畫推進（按住時增加、放開時消退），火焰與餘燼以粒子繪於封印周圍的畫布。
export function createSeal(btn, { onComplete, audio, reduced }) {
  const cv = document.createElement("canvas"); cv.className = "sealfx"; btn.appendChild(cv);
  const ctx = cv.getContext("2d"), SIZE = 340; let dpr = 1;
  function fit() { dpr = Math.min(devicePixelRatio || 1, 2); cv.width = cv.height = SIZE * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  fit();
  const C = SIZE / 2, flames = [], embers = [], waves = [];
  let p = 0, holding = false, auto = false, running = false, done = false, last = 0, tick = 0;
  const R = () => btn.offsetWidth / 2 + 7;

  function frame(t) {
    const dt = Math.max(0.004, Math.min(0.05, (t - last) / 1000 || 0.016)); last = t;
    if (!done) p = Math.max(0, Math.min(1, p + (holding || auto ? dt / (reduced ? 0.3 : 1.25) : -dt / 0.45)));
    btn.style.setProperty("--p", p.toFixed(3)); audio.charge(done ? 0 : p);
    const q = Math.floor(p * 8); if (q > tick && navigator.vibrate) navigator.vibrate(6); tick = q;
    const r = R(), a0 = -Math.PI / 2, a1 = a0 + p * Math.PI * 2;
    ctx.clearRect(0, 0, SIZE, SIZE); ctx.globalCompositeOperation = "lighter";
    if (p > 0 && !done) {
      // 已燒過的弧：一圈細刻線，外加放射狀的短刻紋（線刻版畫的光芒筆法）
      ctx.lineCap = "round";
      ctx.strokeStyle = "rgba(255,214,140,.9)"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(C, C, r, a0, a1); ctx.stroke();
      ctx.strokeStyle = "rgba(255,190,100,.75)"; ctx.lineWidth = 1;
      ctx.beginPath();
      for (let a = a0; a < a1; a += 0.07) { const L = 4 + 3 * Math.sin(a * 9 + t / 160); ctx.moveTo(C + Math.cos(a) * (r + 2), C + Math.sin(a) * (r + 2)); ctx.lineTo(C + Math.cos(a) * (r + 2 + L), C + Math.sin(a) * (r + 2 + L)); }
      ctx.stroke();
      // 火頭：數條向外捲起的弧線
      const hx = C + Math.cos(a1) * r, hy = C + Math.sin(a1) * r, nx = Math.cos(a1), ny = Math.sin(a1);
      const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, 14); g.addColorStop(0, "rgba(255,240,200,.8)"); g.addColorStop(1, "rgba(255,120,30,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, 14, 0, 7); ctx.fill();
      ctx.strokeStyle = "rgba(255,226,160,.9)"; ctx.lineWidth = 1.1;
      for (let k = -3; k <= 3; k++) {
        const len = 16 + 8 * Math.sin(t / 90 + k * 1.7) - Math.abs(k) * 2.5, side = k * 2.2;
        const bx = hx - ny * side, by = hy + nx * side, tx = bx + nx * len - ny * k * 1.5 + (Math.random() - 0.5) * 2, ty = by + ny * len + nx * k * 1.5 - 6;
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.quadraticCurveTo(bx + nx * len * 0.5 + ny * 4, by + ny * len * 0.5 - nx * 4, tx, ty); ctx.stroke();
      }
      if (!reduced) {
        for (let i = 0; i < 5; i++) { const a = a0 + Math.random() * (a1 - a0), head = Math.random() < 0.35, aa = head ? a1 - Math.random() * 0.15 : a; flames.push({ x: C + Math.cos(aa) * r, y: C + Math.sin(aa) * r, vx: Math.cos(aa) * 0.5 + (Math.random() - 0.5) * 0.5, vy: Math.sin(aa) * 0.5 - 0.6 - Math.random() * 0.9, life: 1, d: 0.025 + Math.random() * 0.03, s: 5 + Math.random() * 8 }); }
        if (Math.random() < p * 0.9) { const a = Math.random() * 7, d = r * (2.1 + Math.random() * 0.6); embers.push({ a, d, life: 1 }); }
      }
    }
    for (let i = flames.length - 1; i >= 0; i--) {
      const f = flames[i]; f.x += f.vx; f.y += f.vy; f.vy -= 0.02; f.life -= f.d; if (f.life <= 0) { flames.splice(i, 1); continue; }
      // 火焰碎片：沿飛行方向的短刻線
      const sp = Math.hypot(f.vx, f.vy) || 1, L = f.s * f.life * 1.1;
      ctx.strokeStyle = `rgba(255,${190 + 50 * f.life | 0},${110 + 60 * f.life | 0},${0.85 * f.life})`; ctx.lineWidth = 0.6 + f.life;
      ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.lineTo(f.x - f.vx / sp * L, f.y - f.vy / sp * L); ctx.stroke();
    }
    for (let i = embers.length - 1; i >= 0; i--) {
      const e = embers[i]; e.d -= 1.6 + (1 - e.life) * 3; e.a += 0.07; e.life -= 0.022; if (e.life <= 0 || e.d < r * 0.5) { embers.splice(i, 1); continue; }
      const ex = C + Math.cos(e.a) * e.d, ey = C + Math.sin(e.a) * e.d;
      ctx.strokeStyle = `rgba(255,200,110,${e.life})`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(C + Math.cos(e.a - 0.08) * (e.d + 7), C + Math.sin(e.a - 0.08) * (e.d + 7)); ctx.stroke();
    }
    for (let i = waves.length - 1; i >= 0; i--) {
      const w = waves[i]; w.t += dt / w.dur; if (w.t >= 1) { waves.splice(i, 1); continue; } if (w.t < 0) continue;
      const rr = r + (SIZE / 2 - r - 6) * (1 - Math.pow(1 - w.t, 3));
      // 衝擊：兩道細環＋放射刻線
      const al = (1 - w.t) * 0.9;
      ctx.strokeStyle = `rgba(255,226,160,${al})`; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(C, C, rr, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(C, C, rr * 0.93, 0, 7); ctx.stroke();
      ctx.lineWidth = 0.8; ctx.beginPath();
      for (let a = 0; a < 6.28; a += 0.105) { const L = 6 + 10 * (1 - w.t) * (0.5 + 0.5 * Math.sin(a * 7)); ctx.moveTo(C + Math.cos(a) * rr, C + Math.sin(a) * rr); ctx.lineTo(C + Math.cos(a) * (rr + L), C + Math.sin(a) * (rr + L)); }
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    if (p >= 1 && !done) {
      done = true; btn.classList.add("struck"); audio.strike(); if (navigator.vibrate) navigator.vibrate([20, 40, 60]);
      waves.push({ t: 0, dur: 0.7 }, { t: -0.25, dur: 0.9 });
      if (!reduced) for (let i = 0; i < 70; i++) { const a = Math.random() * 7, v = 2 + Math.random() * 5; flames.push({ x: C + Math.cos(a) * r, y: C + Math.sin(a) * r, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, d: 0.02 + Math.random() * 0.03, s: 3 + Math.random() * 5 }); }
      setTimeout(() => onComplete(), reduced ? 50 : 650);
    }
    if (p > 0 || holding || auto || flames.length || embers.length || waves.length) requestAnimationFrame(frame); else { running = false; audio.charge(0); }
  }
  function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }
  btn.addEventListener("pointerdown", e => { if (done || btn.disabled) return; e.preventDefault(); try { btn.setPointerCapture(e.pointerId); } catch (_) {} holding = true; btn.classList.add("holding"); start(); });
  const up = () => { holding = false; btn.classList.remove("holding"); };
  btn.addEventListener("pointerup", up); btn.addEventListener("pointercancel", up); btn.addEventListener("lostpointercapture", up);
  btn.addEventListener("contextmenu", e => e.preventDefault());
  btn.addEventListener("keydown", e => { if ((e.key === "Enter" || e.key === " ") && !done) { e.preventDefault(); auto = true; start(); } });
  return { reset() { done = false; auto = false; holding = false; p = 0; tick = 0; btn.classList.remove("struck", "holding"); btn.style.setProperty("--p", 0); }, trigger() { if (!done) { auto = true; start(); } } };
}
