// 環境音與儀式音效（Web Audio 即時合成，不需要音檔；預設關閉）
export function createAudio() {
  let ac = null, master = null, on = false, amb = null;
  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    // 切到別的 App、鎖螢幕或換分頁時整個靜音（暫停音訊），回來再接著響
    const pause = () => { if (ac.state === "running") ac.suspend(); };
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); else if (on) ac.resume(); });
    addEventListener("pagehide", pause);
    // 殿內的底聲：極低的地鳴（兩個正弦）＋一層很輕、經低通濾過的褐噪音（像殿內的氣流，不是白噪音的嘶嘶聲），音量緩緩起伏
    const drone = ac.createOscillator(), dg = ac.createGain(); drone.type = "sine"; drone.frequency.value = 55; dg.gain.value = 0.035;
    const drone2 = ac.createOscillator(); drone2.type = "sine"; drone2.frequency.value = 82.4; const dg2 = ac.createGain(); dg2.gain.value = 0.016;
    drone.connect(dg).connect(master); drone2.connect(dg2).connect(master); drone.start(); drone2.start();
    const len = ac.sampleRate * 4, buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; } // 褐噪音
    const n = ac.createBufferSource(); n.buffer = buf; n.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 320; lp.Q.value = 0.3;
    const ng = ac.createGain(); ng.gain.value = 0.05; n.connect(lp).connect(ng).connect(master); n.start();
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 0.025; lfo.connect(lg).connect(ng.gain); lfo.start();
    // 木柴的劈啪：不規則地、稀疏地響一兩聲，短而乾，帶一點高頻
    (function crackle() {
      if (on && ac.state === "running") {
        const t = ac.currentTime, k = 1 + (Math.random() < 0.3 ? 1 : 0);
        for (let j = 0; j < k; j++) {
          const L = Math.floor(ac.sampleRate * (0.012 + Math.random() * 0.02)), b = ac.createBuffer(1, L, ac.sampleRate), x = b.getChannelData(0);
          for (let i = 0; i < L; i++) x[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 3);
          const src = ac.createBufferSource(); src.buffer = b;
          const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1400 + Math.random() * 2600; bp.Q.value = 1.4;
          const g = ac.createGain(); g.gain.value = 0.05 + Math.random() * 0.07;
          src.connect(bp).connect(g).connect(master); src.start(t + j * (0.04 + Math.random() * 0.08));
        }
      }
      setTimeout(crackle, 350 + Math.random() * 2600);
    })();
    amb = { dg, ng };
  }
  function env(node, t, a, peak, rel) { node.gain.setValueAtTime(0, t); node.gain.linearRampToValueAtTime(peak, t + a); node.gain.exponentialRampToValueAtTime(0.0001, t + a + rel); }
  function noiseHit(freq, peak, rel, q = 1) {
    if (!on) return; const t = ac.currentTime;
    const b = ac.createBuffer(1, ac.sampleRate * (rel + 0.1), ac.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = ac.createBufferSource(); s.buffer = b; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
    const g = ac.createGain(); s.connect(f).connect(g).connect(master); env(g, t, 0.01, peak, rel); s.start(t);
  }
  function tone(freq, peak, rel, type = "sine") {
    if (!on) return; const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; o.connect(g).connect(master); env(g, t, 0.02, peak, rel); o.start(t); o.stop(t + rel + 0.1);
  }
  return {
    get on() { return on; },
    toggle() { init(); on = !on; if (ac.state === "suspended") ac.resume(); master.gain.setTargetAtTime(on ? 0.8 : 0, ac.currentTime, 0.3); return on; },
    // 封印蓄力：低鳴隨進度升高
    charge(p) {
      if (!on || !ac) return;
      if (!this._ch && p > 0) { const o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(); o.type = "sawtooth"; o2.type = "sine"; const lp = ac.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 500; g.gain.value = 0; o.connect(lp); o2.connect(lp); lp.connect(g).connect(master); o.start(); o2.start(); this._ch = { o, o2, g, lp }; }
      if (!this._ch) return; const c = this._ch, t = ac.currentTime;
      c.o.frequency.setTargetAtTime(48 + p * 70, t, 0.05); c.o2.frequency.setTargetAtTime(96 + p * 210, t, 0.05); c.lp.frequency.setTargetAtTime(300 + p * 1400, t, 0.05); c.g.gain.setTargetAtTime(p * 0.12, t, 0.05);
      if (p <= 0) { const k = c; this._ch = null; setTimeout(() => { k.o.stop(); k.o2.stop(); }, 400); }
    },
    strike() { tone(49, 0.6, 1.8); tone(73.4, 0.18, 2.2); noiseHit(300, 0.32, 0.6, 0.6); noiseHit(1800, 0.06, 1.1, 0.4); },
    drum() { tone(62, 0.5, 0.9); noiseHit(120, 0.25, 0.4, 0.8); },
    rustle() { noiseHit(3200, 0.08, 0.25, 0.7); },
    hiss() { noiseHit(5200, 0.12, 1.6, 0.4); },
    land() { noiseHit(900, 0.12, 0.15, 1.2); },
    // 翻牌：紙面掠過空氣的一聲「唰」（濾波噪音由低往高掃）＋一記很輕的低沉落定聲；不用任何音高旋律
    flip() {
      if (!on) return; const t = ac.currentTime, L = Math.floor(ac.sampleRate * 0.42), b = ac.createBuffer(1, L, ac.sampleRate), x = b.getChannelData(0);
      for (let i = 0; i < L; i++) x[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * i / L);
      const src = ac.createBufferSource(); src.buffer = b; const f = ac.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 0.7;
      f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.36);
      const g = ac.createGain(); g.gain.value = 0.09; src.connect(f).connect(g).connect(master); src.start(t);
      const o = ac.createOscillator(), og = ac.createGain(); o.type = "sine"; o.frequency.setValueAtTime(90, t + 0.3); o.frequency.exponentialRampToValueAtTime(52, t + 0.6);
      o.connect(og).connect(master); env(og, t + 0.3, 0.01, 0.12, 0.35); o.start(t + 0.3); o.stop(t + 0.8);
    },
    // 神諭降下：一聲低沉的頌缽——非諧和的泛音緩緩升起、長長散去，底下墊一陣氣流聲；不是叮叮叮的旋律
    chime() { this.bowl(98, 0.16); },
    bowl(f0 = 98, peak = 0.12) {
      if (!on) return; const t = ac.currentTime;
      [[1, 1], [2.76, 0.42], [5.4, 0.16], [8.93, 0.06]].forEach(([m, a], i) => {
        const o = ac.createOscillator(), g = ac.createGain(); o.type = "sine"; o.frequency.value = f0 * m * (1 + (Math.random() - 0.5) * 0.004);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak * a, t + 0.35 + i * 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5 - i * 0.8);
        o.connect(g).connect(master); o.start(t); o.stop(t + 6);
      });
      noiseHit(260, 0.06, 2.2, 0.5);
    }
  };
}
