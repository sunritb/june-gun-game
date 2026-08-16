export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.reverb = null;
    this.enabled = true;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._impulse(2.2, 2.8);
    this.reverbGain = this.ctx.createGain();
    this.reverbGain.gain.value = 0.4;
    this.reverb.connect(this.reverbGain);
    this.reverbGain.connect(this.master);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _impulse(duration, decay) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noise(duration) {
    const rate = this.ctx.sampleRate;
    const len = Math.floor(rate * duration);
    const buf = this.ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  gunshot(opts = {}) {
    if (!this.ctx) return;
    const type = opts.type || 'rifle';
    const power = opts.power !== undefined ? opts.power : 1;
    const distant = !!opts.distant;
    const delay = opts.delay || 0;
    const t = this.ctx.currentTime + delay;
    const rnd = () => 1 + (Math.random() - 0.5) * 0.12;

    const base = { pistol: 165, smg: 230, rifle: 145, sniper: 95, shotgun: 90 }[type] || 145;
    const dur = { pistol: 0.18, smg: 0.12, rifle: 0.2, sniper: 0.55, shotgun: 0.45 }[type] || 0.2;

    if (distant) {
      const d = this._noise(dur * 2);
      const df = this.ctx.createBiquadFilter();
      df.type = 'lowpass';
      df.frequency.value = 620;
      const dg = this.ctx.createGain();
      dg.gain.setValueAtTime(0.16 * power, t);
      dg.gain.exponentialRampToValueAtTime(0.001, t + dur * 2);
      d.connect(df); df.connect(dg); dg.connect(this.master);
      d.start(t); d.stop(t + dur * 2);
      return;
    }

    const pop = this._noise(dur);
    const pf = this.ctx.createBiquadFilter();
    pf.type = 'bandpass';
    pf.frequency.value = base * 6 * rnd();
    pf.Q.value = 1.1;
    const pg = this.ctx.createGain();
    pg.gain.setValueAtTime(0.9 * power, t);
    pg.gain.exponentialRampToValueAtTime(0.001, t + dur);
    pop.connect(pf); pf.connect(pg); pg.connect(this.master);
    pop.start(t); pop.stop(t + dur);

    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(base, t);
    osc.frequency.exponentialRampToValueAtTime(base * 0.45, t + 0.09);
    const og = this.ctx.createGain();
    og.gain.setValueAtTime(0.75 * power, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    osc.connect(og); og.connect(this.master);
    osc.start(t); osc.stop(t + 0.12);

    for (let i = 0; i < 3; i++) {
      const mt = t + 0.012 + Math.random() * 0.028;
      const click = this._noise(0.015);
      const cf = this.ctx.createBiquadFilter();
      cf.type = 'highpass';
      cf.frequency.value = 2600;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.22 * power, mt);
      cg.gain.exponentialRampToValueAtTime(0.001, mt + 0.015);
      click.connect(cf); cf.connect(cg); cg.connect(this.master);
      click.start(mt); click.stop(mt + 0.02);
    }

    const tail = this._noise(dur * 2.6);
    const tf = this.ctx.createBiquadFilter();
    tf.type = 'lowpass';
    tf.frequency.value = 1700;
    const tg = this.ctx.createGain();
    tg.gain.setValueAtTime(0.26 * power, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + dur * 2.6);
    tail.connect(tf); tf.connect(tg);
    tg.connect(this.reverb);
    tg.connect(this.master);
    tail.start(t); tail.stop(t + dur * 2.6);
  }

  reload() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const rt = t + i * 0.11;
      const c = this._noise(0.01);
      const cf = this.ctx.createBiquadFilter();
      cf.type = 'bandpass';
      cf.frequency.value = 1700 + Math.random() * 900;
      const cg = this.ctx.createGain();
      cg.gain.setValueAtTime(0.3, rt);
      cg.gain.exponentialRampToValueAtTime(0.001, rt + 0.012);
      c.connect(cf); cf.connect(cg); cg.connect(this.master);
      c.start(rt); c.stop(rt + 0.02);
    }
  }

  empty() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const c = this._noise(0.012);
    const cf = this.ctx.createBiquadFilter();
    cf.type = 'highpass';
    cf.frequency.value = 3200;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.14, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.012);
    c.connect(cf); cf.connect(cg); cg.connect(this.master);
    c.start(t); c.stop(t + 0.015);
  }

  hitmarker() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const c = this._noise(0.03);
    const cf = this.ctx.createBiquadFilter();
    cf.type = 'highpass';
    cf.frequency.value = 1500;
    const cg = this.ctx.createGain();
    cg.gain.setValueAtTime(0.12, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    c.connect(cf); cf.connect(cg); cg.connect(this.master);
    c.start(t); c.stop(t + 0.035);
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [660, 880, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const st = t + i * 0.07;
      g.gain.setValueAtTime(0.16, st);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.22);
      o.connect(g); g.connect(this.master);
      o.start(st); o.stop(st + 0.24);
    });
  }

  hurt() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.25);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.connect(f); f.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + 0.3);
  }

  footstep(power = 0.32) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const n = this._noise(0.055);
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 260 + Math.random() * 160;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(power * (0.85 + Math.random() * 0.3), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(f); f.connect(g); g.connect(this.master);
    n.start(t); n.stop(t + 0.08);
  }
}
