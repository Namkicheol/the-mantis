// Chiptune-style audio synth (Web Audio API, no external files).
// Provides: SFX (click/feed/train/rest/hit/crit/win/lose/evolve/levelup)
// and short BGM loops (main / battle).

const Audio8 = {
  ctx: null,
  master: null,
  bgmGain: null,
  sfxGain: null,
  muted: false,
  enabled: false,
  bgmTimer: null,
  bgmStep: 0,
  bgmPattern: null,
  bgmNextTime: 0,
  bgmName: null,

  ensure() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    this.master.connect(this.ctx.destination);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.18;
    this.bgmGain.connect(this.master);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.7;
    this.sfxGain.connect(this.master);

    this.enabled = true;
  },

  resumeIfNeeded() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },

  setMuted(m) {
    this.muted = !!m;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.55;
    try { localStorage.setItem('the-mantis:muted', this.muted ? '1' : '0'); } catch {}
  },

  // ---- note helpers ----
  noteFreq(name) {
    // e.g. "C4", "F#5", "Bb3"
    const NOTES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 440;
    let semi = NOTES[m[1]];
    if (m[2] === '#') semi += 1;
    if (m[2] === 'b') semi -= 1;
    const octave = parseInt(m[3], 10);
    // A4 = 440
    const semiFromA4 = (octave - 4) * 12 + (semi - 9);
    return 440 * Math.pow(2, semiFromA4 / 12);
  },

  // play one tone with ADSR-ish envelope
  tone(freq, dur, opts = {}) {
    if (!this.enabled) return;
    const t0 = opts.when || this.ctx.currentTime;
    const type = opts.type || 'square';
    const vol = opts.vol == null ? 0.25 : opts.vol;
    const attack = opts.attack || 0.005;
    const decay = opts.decay || 0.06;
    const sustain = opts.sustain == null ? 0.5 : opts.sustain;
    const release = opts.release || 0.08;
    const dest = opts.dest || this.sfxGain;

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo) {
      osc.frequency.linearRampToValueAtTime(opts.glideTo, t0 + dur);
    }

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.linearRampToValueAtTime(vol * sustain, t0 + attack + decay);
    g.gain.setValueAtTime(vol * sustain, t0 + dur);
    g.gain.linearRampToValueAtTime(0, t0 + dur + release);

    osc.connect(g);
    g.connect(dest);
    osc.start(t0);
    osc.stop(t0 + dur + release + 0.02);
  },

  // play noise burst (for hits, drums)
  noise(dur, opts = {}) {
    if (!this.enabled) return;
    const t0 = opts.when || this.ctx.currentTime;
    const vol = opts.vol == null ? 0.4 : opts.vol;
    const dest = opts.dest || this.sfxGain;

    // generate short noise buffer
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1);

    const src = this.ctx.createBufferSource();
    src.buffer = buf;

    // bandpass-ish via biquad
    const filter = this.ctx.createBiquadFilter();
    filter.type = opts.filter || 'bandpass';
    filter.frequency.value = opts.freq || 1200;
    filter.Q.value = opts.q || 0.8;

    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  },

  // ---- SFX library ----
  sfx(name) {
    this.ensure();
    if (!this.enabled) return;
    this.resumeIfNeeded();
    const t = this.ctx.currentTime;
    switch (name) {
      case 'click':
        this.tone(880, 0.04, { type: 'square', vol: 0.15, when: t });
        break;
      case 'feed':
        this.tone(523.25, 0.08, { type: 'square', vol: 0.22, when: t });
        this.tone(659.25, 0.08, { type: 'square', vol: 0.22, when: t + 0.07 });
        this.tone(783.99, 0.12, { type: 'triangle', vol: 0.22, when: t + 0.14 });
        break;
      case 'train':
        // grunt-y rising buzz
        this.tone(180, 0.08, { type: 'sawtooth', vol: 0.18, when: t, glideTo: 320 });
        this.noise(0.05, { freq: 1800, when: t + 0.06, vol: 0.25 });
        break;
      case 'rest':
        this.tone(659.25, 0.22, { type: 'sine', vol: 0.25, when: t, glideTo: 392 });
        this.tone(329.63, 0.3,  { type: 'triangle', vol: 0.18, when: t + 0.15, glideTo: 261.63 });
        break;
      case 'hit':
        this.noise(0.08, { freq: 800, when: t, vol: 0.35 });
        this.tone(160, 0.05, { type: 'square', vol: 0.18, when: t, glideTo: 90 });
        break;
      case 'crit':
        this.noise(0.1, { freq: 2400, when: t, vol: 0.4 });
        this.tone(220, 0.08, { type: 'square', vol: 0.25, when: t, glideTo: 110 });
        this.tone(880, 0.15, { type: 'square', vol: 0.18, when: t + 0.08 });
        break;
      case 'enemyHit':
        this.noise(0.07, { freq: 600, when: t, vol: 0.3 });
        this.tone(120, 0.06, { type: 'square', vol: 0.2, when: t, glideTo: 70 });
        break;
      case 'win': {
        const seq = ['C5','E5','G5','C6'];
        for (let i = 0; i < seq.length; i++) {
          this.tone(this.noteFreq(seq[i]), 0.12, { type: 'square', vol: 0.25, when: t + i * 0.1 });
        }
        break;
      }
      case 'lose': {
        const seq = ['E4','D4','C4','A3'];
        for (let i = 0; i < seq.length; i++) {
          this.tone(this.noteFreq(seq[i]), 0.22, { type: 'square', vol: 0.22, when: t + i * 0.18 });
        }
        break;
      }
      case 'evolve': {
        // sparkly arpeggio rising
        const seq = ['C5','E5','G5','C6','E6','G6','C7'];
        for (let i = 0; i < seq.length; i++) {
          this.tone(this.noteFreq(seq[i]), 0.18, { type: 'square', vol: 0.22, when: t + i * 0.08 });
          this.tone(this.noteFreq(seq[i]) * 0.5, 0.18, { type: 'triangle', vol: 0.18, when: t + i * 0.08 });
        }
        break;
      }
      case 'levelup':
        this.tone(this.noteFreq('G5'), 0.09, { type: 'square', vol: 0.22, when: t });
        this.tone(this.noteFreq('C6'), 0.12, { type: 'square', vol: 0.22, when: t + 0.08 });
        this.tone(this.noteFreq('E6'), 0.15, { type: 'square', vol: 0.22, when: t + 0.16 });
        break;
      case 'select':
        this.tone(1200, 0.04, { type: 'square', vol: 0.12, when: t });
        break;
      case 'denied':
        this.tone(220, 0.08, { type: 'square', vol: 0.18, when: t });
        this.tone(180, 0.1, { type: 'square', vol: 0.18, when: t + 0.06 });
        break;
    }
  },

  // ---- BGM ----
  // pattern: { bpm, length, lead:[{n,d}...], bass:[{n,d}...] }
  // n = note name or null (rest), d = duration in 16th-note steps
  playBgm(name) {
    if (this.bgmName === name && this.bgmTimer) return;
    this.ensure();
    if (!this.enabled) return;
    this.resumeIfNeeded();
    this.stopBgm();

    this.bgmPattern = BGM[name];
    if (!this.bgmPattern) return;
    this.bgmName = name;
    this.bgmStep = 0;
    this.bgmNextTime = this.ctx.currentTime + 0.05;

    const beatSec = 60 / this.bgmPattern.bpm;
    const stepSec = beatSec / 4; // 16th notes
    const scheduleAhead = 0.15;

    // expand patterns into step arrays (each entry: note or null)
    const expand = (events) => {
      const arr = [];
      for (const ev of events) {
        const dur = ev.d || 1;
        arr.push({ note: ev.n, dur, head: true });
        for (let i = 1; i < dur; i++) arr.push({ note: null, dur, head: false });
      }
      return arr;
    };
    const lead = expand(this.bgmPattern.lead);
    const bass = expand(this.bgmPattern.bass);

    const tick = () => {
      if (!this.bgmPattern) return;
      while (this.bgmNextTime < this.ctx.currentTime + scheduleAhead) {
        const li = this.bgmStep % lead.length;
        const bi = this.bgmStep % bass.length;
        const le = lead[li];
        const be = bass[bi];
        if (le && le.head && le.note) {
          this.tone(this.noteFreq(le.note), le.dur * stepSec * 0.9, {
            type: this.bgmPattern.leadType || 'square',
            vol: 0.18,
            when: this.bgmNextTime,
            sustain: 0.6,
            release: 0.04,
            dest: this.bgmGain,
          });
        }
        if (be && be.head && be.note) {
          this.tone(this.noteFreq(be.note), be.dur * stepSec * 0.95, {
            type: this.bgmPattern.bassType || 'triangle',
            vol: 0.22,
            when: this.bgmNextTime,
            sustain: 0.7,
            release: 0.05,
            dest: this.bgmGain,
          });
        }
        // simple drum on beats 1 & 3 (every 8 steps) for battle
        if (this.bgmPattern.drum && this.bgmStep % 8 === 0) {
          this.noise(0.06, { freq: 120, filter: 'lowpass', when: this.bgmNextTime, vol: 0.25, dest: this.bgmGain });
        }
        this.bgmNextTime += stepSec;
        this.bgmStep++;
      }
    };

    tick();
    this.bgmTimer = setInterval(tick, 30);
  },

  stopBgm() {
    if (this.bgmTimer) clearInterval(this.bgmTimer);
    this.bgmTimer = null;
    this.bgmName = null;
    this.bgmPattern = null;
  },
};

// ---- BGM patterns ----
// d = duration in 16th-note steps. 1=16th, 2=8th, 4=quarter, 8=half
const BGM = {
  main: {
    bpm: 112,
    leadType: 'square',
    bassType: 'triangle',
    lead: [
      // 4 bar lead loop in C major, peaceful
      { n: 'E5', d: 2 }, { n: 'G5', d: 2 }, { n: 'C6', d: 4 }, { n: 'B5', d: 2 }, { n: 'A5', d: 2 }, { n: 'G5', d: 4 },
      { n: 'F5', d: 2 }, { n: 'A5', d: 2 }, { n: 'C6', d: 4 }, { n: 'B5', d: 4 }, { n: null, d: 4 },
      { n: 'E5', d: 2 }, { n: 'G5', d: 2 }, { n: 'C6', d: 2 }, { n: 'E6', d: 2 }, { n: 'D6', d: 4 }, { n: 'B5', d: 4 },
      { n: 'C6', d: 2 }, { n: 'G5', d: 2 }, { n: 'E5', d: 4 }, { n: 'D5', d: 4 }, { n: 'C5', d: 4 },
    ],
    bass: [
      { n: 'C3', d: 4 }, { n: 'C3', d: 4 }, { n: 'G3', d: 4 }, { n: 'G3', d: 4 },
      { n: 'F3', d: 4 }, { n: 'F3', d: 4 }, { n: 'G3', d: 4 }, { n: 'G3', d: 4 },
      { n: 'C3', d: 4 }, { n: 'C3', d: 4 }, { n: 'A3', d: 4 }, { n: 'A3', d: 4 },
      { n: 'F3', d: 4 }, { n: 'G3', d: 4 }, { n: 'C3', d: 8 },
    ],
  },
  battle: {
    bpm: 150,
    drum: true,
    leadType: 'square',
    bassType: 'sawtooth',
    lead: [
      // tense A minor riff
      { n: 'A4', d: 1 }, { n: 'C5', d: 1 }, { n: 'E5', d: 1 }, { n: 'A5', d: 1 },
      { n: 'G5', d: 1 }, { n: 'E5', d: 1 }, { n: 'C5', d: 1 }, { n: 'A4', d: 1 },
      { n: 'F5', d: 2 }, { n: 'E5', d: 2 }, { n: 'D5', d: 2 }, { n: 'C5', d: 2 },
      { n: 'A4', d: 1 }, { n: 'C5', d: 1 }, { n: 'E5', d: 1 }, { n: 'G5', d: 1 },
      { n: 'F5', d: 1 }, { n: 'E5', d: 1 }, { n: 'D5', d: 1 }, { n: 'C5', d: 1 },
      { n: 'B4', d: 2 }, { n: 'E5', d: 2 }, { n: 'A4', d: 4 },
    ],
    bass: [
      { n: 'A2', d: 2 }, { n: 'A2', d: 2 }, { n: 'E3', d: 2 }, { n: 'E3', d: 2 },
      { n: 'F2', d: 2 }, { n: 'F2', d: 2 }, { n: 'C3', d: 2 }, { n: 'C3', d: 2 },
      { n: 'D2', d: 2 }, { n: 'D2', d: 2 }, { n: 'G2', d: 2 }, { n: 'G2', d: 2 },
      { n: 'A2', d: 2 }, { n: 'E3', d: 2 }, { n: 'A2', d: 4 },
    ],
  },
};

// expose for game.js
window.Audio8 = Audio8;
