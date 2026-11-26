// 環境音與儀式音效（Web Audio 即時合成，不需要音檔；預設關閉）
export function createAudio() {
  let ac = null, master = null, on = false, amb = null;
  function init() {
    if (ac) return;
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    // 低沉的地鳴＋火盆的劈啪噪音
    const drone = ac.createOscillator(), dg = ac.createGain(); drone.type = "sine"; drone.frequency.value = 55; dg.gain.value = 0.05;
    const drone2 = ac.createOscillator(); drone2.type = "sine"; drone2.frequency.value = 82.4; const dg2 = ac.createGain(); dg2.gain.value = 0.025;
    drone.connect(dg).connect(master); drone2.connect(dg2).connect(master); drone.start(); drone2.start();
    const buf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 1 : 0.06);
    const n = ac.createBufferSource(); n.buffer = buf; n.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.6;
    const ng = ac.createGain(); ng.gain.value = 0.25; n.connect(bp).connect(ng).connect(master); n.start();
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
    strike() { tone(49, 0.6, 1.6); tone(196, 0.12, 2.4, "triangle"); noiseHit(300, 0.35, 0.5, 0.6); noiseHit(4200, 0.1, 0.9, 0.5); },
    drum() { tone(62, 0.5, 0.9); noiseHit(120, 0.25, 0.4, 0.8); },
    rustle() { noiseHit(3200, 0.08, 0.25, 0.7); },
    hiss() { noiseHit(5200, 0.12, 1.6, 0.4); },
    land() { noiseHit(900, 0.12, 0.15, 1.2); },
    flip() { noiseHit(2400, 0.1, 0.3, 0.8); tone(660, 0.06, 1.2, "triangle"); },
    chime() { [523.3, 659.3, 784, 1046.5].forEach((f, i) => setTimeout(() => tone(f, 0.08, 2.2, "triangle"), i * 140)); }
  };
}
