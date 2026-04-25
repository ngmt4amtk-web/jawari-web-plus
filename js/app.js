// ドローンサウンド Plus by 川越バイオリン教室 — Web 版
// メトロノーム中心 UI。音律ロジック/音声エンジン/Progression は本家と共通。

// ========================================
// Model: pitch classes, scales, tunings, chords
// ========================================

const PITCH_CLASSES = [
  { id: 0,  name: "C"  }, { id: 1,  name: "C♯" }, { id: 2,  name: "D"  },
  { id: 3,  name: "E♭" }, { id: 4,  name: "E"  }, { id: 5,  name: "F"  },
  { id: 6,  name: "F♯" }, { id: 7,  name: "G"  }, { id: 8,  name: "A♭" },
  { id: 9,  name: "A"  }, { id: 10, name: "B♭" }, { id: 11, name: "B"  }
];

const SCALE_FORMS = {
  major:         { label: "長調",          pattern: [0, 2, 4, 5, 7, 9, 11], degrees: ["Ⅰ","Ⅱ","Ⅲ","Ⅳ","Ⅴ","Ⅵ","Ⅶ"] },
  naturalMinor:  { label: "短調(自然)",    pattern: [0, 2, 3, 5, 7, 8, 10], degrees: ["ⅰ","ⅱ","♭Ⅲ","ⅳ","ⅴ","♭Ⅵ","♭Ⅶ"] },
  harmonicMinor: { label: "短調(和声)",    pattern: [0, 2, 3, 5, 7, 8, 11], degrees: ["ⅰ","ⅱ","♭Ⅲ","ⅳ","Ⅴ","♭Ⅵ","Ⅶ"] }
};

const TUNINGS = {
  equalTemperament: "平均律",
  pythagorean:      "ピタゴラス",
  justIntonation:   "純正律"
};

const TUNING_HINTS = {
  equalTemperament: "1オクターブを12等分した現代標準。どの調でも響きが同じ代わりに協和音がわずかに濁る。",
  pythagorean: "主音から純5度の連鎖。5度・4度は澄むが長3度(81:64)は平均律より+7.8¢広い。旋律向け。",
  justIntonation: "3度5:4, 5度3:2, 6度5:3 の整数比。長3度は-13.7¢、和音のハモリ密度が段違い。合奏向け。"
};

const TONIC_TUNING_HINTS = {
  pythagoreanFromA: "基準Aから純5度連鎖。G-D-A-Eが開放弦調弦と一致。無伴奏・独奏・スケール練習の標準。",
  equalTemperament: "基準Aから平均律。ピアノ・鍵盤・管楽器と合わせる標準。開放弦との間に5〜8¢の差が残る。",
  temperedFifthChain: "基準Aから5度を-2¢狭めた連鎖。コンマを12箇所に分散した折衷調弦。弦楽四重奏向け。",
  customHz: "主音の絶対周波数をHzで直接指定。指定Hzがⅰ度(主音)として、そこから音律で音程を積む。"
};

// includesThird: true → 長調/短調の切替で M3/m3 が切り替わる (quality-sensitive)
// 固定インターバル (sus / dim / aug) は quality 無視
const CHORD_PRESETS = {
  // 単音・完全系
  root:             { label: "単音",         includesThird: false, intervals: (_q) => [0] },
  rootFifth:        { label: "1+5",         includesThird: false, intervals: (_q) => [0, 7] },
  rootOctave:       { label: "1+8",         includesThird: false, intervals: (_q) => [0, 12] },
  rootFifthOctave:  { label: "1+5+8",       includesThird: false, intervals: (_q) => [0, 7, 12] },
  // 三和音系
  triad:            { label: "三和音",       includesThird: true,  intervals: (q) => [0, q === "major" ? 4 : 3, 7] },
  triadOctave:      { label: "三和音+8",     includesThird: true,  intervals: (q) => [0, q === "major" ? 4 : 3, 7, 12] },
  sus2:             { label: "sus2",        includesThird: false, intervals: (_q) => [0, 2, 7] },
  sus4:             { label: "sus4",        includesThird: false, intervals: (_q) => [0, 5, 7] },
  // 7th 系
  // seventh = 常に♭7 (長調で V7 型 / 短調で m7 型)
  seventh:          { label: "7",           includesThird: true,  intervals: (q) => [0, q === "major" ? 4 : 3, 7, 10] },
  // maj7 = 常に自然7 (長調で Maj7 / 短調で m(maj7))
  maj7:             { label: "Maj7",        includesThird: true,  intervals: (q) => [0, q === "major" ? 4 : 3, 7, 11] },
  halfDim7:         { label: "m7♭5",        includesThird: false, intervals: (_q) => [0, 3, 6, 10] },
  diminishedSeventh:{ label: "dim7",        includesThird: false, intervals: (_q) => [0, 3, 6, 9] },
  // 拡張・特殊
  add6:             { label: "add6",        includesThird: true,  intervals: (q) => [0, q === "major" ? 4 : 3, 7, 9] },
  add9:             { label: "add9",        includesThird: true,  intervals: (q) => [0, q === "major" ? 4 : 3, 7, 14] },
  diminished:       { label: "dim",         includesThird: false, intervals: (_q) => [0, 3, 6] },
  augmented:        { label: "aug",         includesThird: false, intervals: (_q) => [0, 4, 8] }
};

const TIMBRES = {
  pureSine:     { label: "Pure Sine" },
  warmPad:      { label: "Warm Pad" },
  brightOrgan:  { label: "Bright Organ" },
  tambura:      { label: "Tambura" },
  celloEnsemble:{ label: "Cello" }
};

// ========================================
// DroneMath — 音律ロジック（iOS版と完全等価）
// ========================================

const PYTH_RATIOS = [
  1,          256/243,    9/8,        32/27,
  81/64,      4/3,        729/512,    3/2,
  128/81,     27/16,      16/9,       243/128
];

const JI_RATIOS = [
  1,          16/15,      9/8,        6/5,
  5/4,        4/3,        45/32,      3/2,
  8/5,        5/3,        9/5,        15/8
];

function mod12(x) { return ((x % 12) + 12) % 12; }

function ratio(semitones, tuning) {
  const s = mod12(semitones);
  switch (tuning) {
    case "equalTemperament": return Math.pow(2, s / 12);
    case "pythagorean":      return PYTH_RATIOS[s];
    case "justIntonation":   return JI_RATIOS[s];
    default: return 1;
  }
}

const ENSEMBLE_FIFTH_NARROW_CENTS = 2.0;

function fifthCircleDistanceFromA(semitoneInOctave) {
  const rawN = (semitoneInOctave * 7) % 12;
  return rawN > 6 ? rawN - 12 : rawN;
}

function normalizeToOctave(ratio) {
  let r = ratio;
  while (r < 1.0) r *= 2.0;
  while (r >= 2.0) r /= 2.0;
  return r;
}

function tonicFrequency(tonicPc, referenceA, tonicTuning, customTonicHz = 256) {
  if (tonicTuning === "customHz") {
    return Math.max(1, customTonicHz);
  }
  const targetMidi = 48 + tonicPc;
  const semitoneDiff = targetMidi - 69;
  const octaves = Math.floor(semitoneDiff / 12);
  const mod = mod12(semitoneDiff);

  switch (tonicTuning) {
    case "pythagoreanFromA":
      return referenceA * PYTH_RATIOS[mod] * Math.pow(2, octaves);
    case "temperedFifthChain": {
      const fifthSteps = fifthCircleDistanceFromA(mod);
      const narrowedFifth = 1.5 * Math.pow(2, -ENSEMBLE_FIFTH_NARROW_CENTS / 1200);
      const raw = Math.pow(narrowedFifth, fifthSteps);
      return referenceA * normalizeToOctave(raw) * Math.pow(2, octaves);
    }
    case "equalTemperament":
    default:
      return referenceA * Math.pow(2, semitoneDiff / 12);
  }
}

function droneSemitoneFromTonic(scaleForm, degree) {
  const pattern = SCALE_FORMS[scaleForm].pattern;
  const i = Math.max(0, Math.min(degree, pattern.length - 1));
  return pattern[i];
}

function droneRootFrequency(cfg) {
  const t = tonicFrequency(cfg.tonicPitchClass, cfg.referenceA, cfg.tonicTuning, cfg.customTonicHz);
  const s = droneSemitoneFromTonic(cfg.scaleForm, cfg.droneScaleDegree);
  return t * ratio(s, cfg.tuningSystem);
}

function renderVoices(cfg) {
  const root = droneRootFrequency(cfg);
  const preset = CHORD_PRESETS[cfg.chordPreset];
  const intervals = preset.intervals(cfg.quality);
  return intervals.map((interval, index) => {
    const octaves = Math.floor(interval / 12);
    const s = mod12(interval);
    const freq = root * ratio(s, cfg.tuningSystem) * Math.pow(2, octaves);
    let amplitude;
    if (interval === 0) amplitude = 0.92;
    else if (interval === 3 || interval === 4) amplitude = 0.58;
    else if (interval === 7) amplitude = 0.76;
    else if (interval === 12) amplitude = 0.52;
    else amplitude = 0.5;
    let pan;
    if (intervals.length === 1) pan = 0;
    else pan = (index / (intervals.length - 1)) * 1.2 - 0.6;
    return { frequency: freq, amplitude, pan, index };
  });
}

function defaultQualityForDegree(scaleForm, degree) {
  const pattern = SCALE_FORMS[scaleForm].pattern;
  if (degree >= pattern.length) return "major";
  const root = pattern[degree];
  const thirdPc = pattern[(degree + 2) % pattern.length];
  let diff = thirdPc - root;
  if (diff < 0) diff += 12;
  return diff === 4 ? "major" : "minor";
}

// ========================================
// Harmonic profiles
// ========================================

const HARMONIC_PROFILES = {
  pureSine:    { weights: [[1, 1.00]], gain: 0.46 },
  warmPad:     { weights: [[1, 1.00], [2, 0.40], [3, 0.30], [4, 0.20], [5, 0.15], [6, 0.10], [7, 0.05], [8, 0.03]], gain: 0.42 },
  brightOrgan: { weights: [[1, 1.00], [3, 0.50], [5, 0.40], [7, 0.30], [9, 0.20], [11, 0.15], [13, 0.10], [15, 0.10]], gain: 0.36 },
  tambura:     { weights: [[1, 0.50], [2, 0.26], [3, 0.22], [4, 0.16], [5, 0.11], [6, 0.14], [7, 0.09], [9, 0.07]], gain: 0.40 },
  celloEnsemble:{ weights: [[1, 1.00], [2, 0.35], [3, 0.24], [4, 0.18], [5, 0.10]], gain: 0.45 }
};

function buildPeriodicWave(ctx, profile) {
  const maxH = Math.max(...profile.weights.map(w => w[0])) + 1;
  const real = new Float32Array(maxH);
  const imag = new Float32Array(maxH);
  for (const [h, w] of profile.weights) {
    imag[h] = w * profile.gain;
  }
  return ctx.createPeriodicWave(real, imag, { disableNormalization: true });
}

function buildClickBuffer(ctx, frequency, durationMs, peak) {
  const sr = ctx.sampleRate;
  const frameCount = Math.floor((durationMs / 1000) * sr);
  const buffer = ctx.createBuffer(1, frameCount, sr);
  const data = buffer.getChannelData(0);
  const tau = 0.012;
  const attackFrames = Math.floor(0.002 * sr);
  for (let i = 0; i < frameCount; i++) {
    const t = i / sr;
    const env = Math.exp(-t / tau);
    const attack = i < attackFrames ? i / attackFrames : 1;
    data[i] = peak * Math.sin(2 * Math.PI * frequency * t) * env * attack;
  }
  return buffer;
}

// ========================================
// Audio Engine
// ========================================

class DroneEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.voices = [];
    this.periodicWaves = null;
    this.strongClick = null;
    this.weakClick = null;
    this.isPlaying = false;
    this.configuration = null;
    this.scheduledClickSources = [];
  }

  ctxOrEnsure() {
    this._ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    return this.ctx;
  }

  _ensureContext() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(this.ctx.destination);
    this.periodicWaves = {};
    for (const [key, profile] of Object.entries(HARMONIC_PROFILES)) {
      this.periodicWaves[key] = buildPeriodicWave(this.ctx, profile);
    }
    this.strongClick = buildClickBuffer(this.ctx, 1600, 60, 0.55);
    this.weakClick   = buildClickBuffer(this.ctx, 900,  50, 0.30);
  }

  _makeVoice(cfg, voiceData) {
    const osc = this.ctx.createOscillator();
    osc.setPeriodicWave(this.periodicWaves[cfg.timbre]);
    osc.frequency.value = voiceData.frequency;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    const panner = this.ctx.createStereoPanner();
    panner.pan.value = voiceData.pan;

    osc.connect(panner).connect(gain).connect(this.master);
    osc.start();
    return { osc, gain, panner };
  }

  updateConfiguration(cfg) {
    this._ensureContext();
    this.configuration = cfg;

    const voiceData = renderVoices(cfg);
    const normalizer = 1 / Math.sqrt(Math.max(voiceData.length, 1));

    while (this.voices.length > voiceData.length) {
      const v = this.voices.pop();
      v.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      v.osc.stop(this.ctx.currentTime + 0.1);
    }
    while (this.voices.length < voiceData.length) {
      const vd = voiceData[this.voices.length];
      this.voices.push(this._makeVoice(cfg, vd));
    }

    const now = this.ctx.currentTime;
    for (let i = 0; i < this.voices.length; i++) {
      const v = this.voices[i];
      const vd = voiceData[i];
      v.osc.setPeriodicWave(this.periodicWaves[cfg.timbre]);
      v.osc.frequency.setTargetAtTime(vd.frequency, now, 0.01);
      v.panner.pan.setTargetAtTime(vd.pan, now, 0.02);
      const targetGain = this.isPlaying ? vd.amplitude * normalizer : 0;
      v.gain.gain.setTargetAtTime(targetGain, now, 0.03);
    }

    const masterTarget = this.isPlaying ? cfg.volume : 0;
    this.master.gain.setTargetAtTime(masterTarget, now, 0.03);
  }

  setPlaying(playing) {
    this._ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    this.isPlaying = playing;
    if (this.configuration) {
      this.updateConfiguration(this.configuration);
    }
  }

  setVolume(vol) {
    if (!this.ctx || !this.configuration) return;
    this.configuration.volume = vol;
    if (this.isPlaying) {
      this.master.gain.setTargetAtTime(vol, this.ctx.currentTime, 0.03);
    }
  }

  playClick(accent) {
    this.playClickAt(accent, 0);
  }

  playClickAt(accent, when) {
    this._ensureContext();
    if (this.ctx.state === "suspended") this.ctx.resume();
    const src = this.ctx.createBufferSource();
    src.buffer = accent ? this.strongClick : this.weakClick;
    src.connect(this.ctx.destination);
    const startTime = when > 0 ? when : 0;
    src.start(startTime);
    this.scheduledClickSources.push(src);
    src.onended = () => {
      const idx = this.scheduledClickSources.indexOf(src);
      if (idx >= 0) this.scheduledClickSources.splice(idx, 1);
    };
  }

  cancelScheduledClicks() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const src of this.scheduledClickSources) {
      try { src.stop(now); } catch (_) { /* already stopped */ }
    }
    this.scheduledClickSources = [];
  }
}

// ========================================
// Progression (drift-free look-ahead scheduler)
// ========================================

class Progression {
  constructor(engine, onStatusChange, onBarChange) {
    this.engine = engine;
    this.onStatusChange = onStatusChange;
    this.onBarChange = onBarChange;
    this.running = false;
    this.timer = null;
  }

  start(plan, onCountInComplete) {
    if (this.running) return;
    this.running = true;
    const beatSec = 60 / plan.bpm;
    const countInBeats = Math.max(0, plan.countInBars) * plan.beatsPerBar;
    const plan_ = plan;
    const done = typeof onCountInComplete === "function" ? onCountInComplete : () => {};

    this.onBarChange({ barIdx: 0, beatIdx: 0, phase: countInBeats > 0 ? "countin" : "main", remaining: countInBeats });
    if (countInBeats === 0) done();

    const ctx = this.engine.ctxOrEnsure();
    const startAudioTime = ctx.currentTime + 0.05;
    let beatCounter = 0;
    const LOOK_AHEAD_SEC = 0.15;
    const SCHEDULER_INTERVAL_MS = 25;
    const totalCountInBeats = countInBeats;

    const scheduleBeat = (beatNum) => {
      const audioTime = startAudioTime + beatNum * beatSec;
      const isCountIn = beatNum < totalCountInBeats;
      const positionInCountIn = beatNum;
      const positionInMain = beatNum - totalCountInBeats;
      const beatInBar = isCountIn
        ? positionInCountIn % plan_.beatsPerBar
        : positionInMain % plan_.beatsPerBar;
      const accent = plan_.accentFirstBeat && beatInBar === 0;

      this.engine.playClickAt(accent, audioTime);

      const uiDelayMs = Math.max(0, (audioTime - ctx.currentTime) * 1000);
      setTimeout(() => {
        if (!this.running) return;
        if (isCountIn) {
          const remaining = totalCountInBeats - positionInCountIn;
          this.onStatusChange({ phase: "countin", remaining, barIdx: 0, beatIdx: beatInBar });
        } else {
          const mainBeatCounter = positionInMain;
          const barIdx = Math.floor(mainBeatCounter / plan_.beatsPerBar) % plan_.bars.length;
          const bIdx = mainBeatCounter % plan_.beatsPerBar;
          if (bIdx === 0) {
            this.onBarChange({ barIdx, beatIdx: 0, phase: "main", remaining: 0 });
            if (barIdx === 0 && mainBeatCounter === 0) done();
          }
          this.onStatusChange({ phase: "main", remaining: 0, barIdx, beatIdx: bIdx });
        }
      }, uiDelayMs);
    };

    const scheduler = () => {
      if (!this.running) return;
      const now = ctx.currentTime;
      while (startAudioTime + beatCounter * beatSec < now + LOOK_AHEAD_SEC) {
        scheduleBeat(beatCounter);
        beatCounter++;
      }
      this.timer = setTimeout(scheduler, SCHEDULER_INTERVAL_MS);
    };

    scheduler();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.engine.cancelScheduledClicks();
    this.onStatusChange({ phase: "idle" });
  }
}

// ========================================
// State
// ========================================

const STORAGE_KEY = "jawari-plus.state";
const TIME_SIG_OPTIONS = ["2-4", "4-4", "3-4", "3-8", "6-8"];

function defaultState() {
  return {
    tonicPitchClass: 9,        // A
    scaleForm: "major",
    droneScaleDegree: 0,
    tonicTuning: "pythagoreanFromA",
    tuningSystem: "justIntonation",
    referenceA: 442,
    customTonicHz: 256,
    chordPreset: "triad",
    quality: "major",
    timbre: "warmPad",
    volume: 0.72,
    syncQualityWithScale: true,
    progression: {
      bpm: 120,
      beatsPerBar: 4,
      beatUnit: 4,
      countInBars: 1,
      accentFirstBeat: true,
      bars: [
        { degree: 0, quality: "major" },
        { degree: 3, quality: "major" },
        { degree: 4, quality: "major" },
        { degree: 0, quality: "major" }
      ]
    }
  };
}

function loadState() {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (!s) return defaultState();
    const parsed = JSON.parse(s);
    const def = defaultState();
    return {
      ...def,
      ...parsed,
      progression: { ...def.progression, ...(parsed.progression || {}) }
    };
  } catch {
    return defaultState();
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function normalizeTimeSig() {
  const key = `${state.progression.beatsPerBar}-${state.progression.beatUnit || 4}`;
  if (!TIME_SIG_OPTIONS.includes(key)) {
    state.progression.beatsPerBar = 4;
    state.progression.beatUnit = 4;
  }
}

// ========================================
// Main app
// ========================================

const state = loadState();
normalizeTimeSig();
const engine = new DroneEngine();
const progression = new Progression(engine, onProgressionStatus, onProgressionBar);

// 小節レベルの override を解決するユーティリティ
// 自分の小節から遡って最初に見つかる keyChange を採用。
// 何も無ければグローバル (state.tonicPitchClass / state.scaleForm)
function effectiveKeyAt(barIdx) {
  const bars = state.progression.bars;
  for (let i = Math.min(barIdx, bars.length - 1); i >= 0; i--) {
    const kc = bars[i] && bars[i].keyChange;
    if (kc) return { tonicPitchClass: kc.tonicPitchClass, scaleForm: kc.scaleForm };
  }
  return { tonicPitchClass: state.tonicPitchClass, scaleForm: state.scaleForm };
}

function effectiveChordPresetOfBar(bar) {
  return (bar && bar.chordPreset) ? bar.chordPreset : state.chordPreset;
}

function configuration(barIdx = null) {
  const bar = (barIdx !== null) ? state.progression.bars[barIdx] : null;
  const key = (barIdx !== null) ? effectiveKeyAt(barIdx) : {
    tonicPitchClass: state.tonicPitchClass,
    scaleForm: state.scaleForm
  };
  return {
    tonicPitchClass: key.tonicPitchClass,
    scaleForm: key.scaleForm,
    droneScaleDegree: state.droneScaleDegree,
    tonicTuning: state.tonicTuning,
    tuningSystem: state.tuningSystem,
    referenceA: state.referenceA,
    customTonicHz: state.customTonicHz,
    chordPreset: effectiveChordPresetOfBar(bar),
    quality: state.quality,
    timbre: state.timbre,
    volume: state.volume
  };
}

function pushConfigToEngine(barIdx = null) {
  engine.updateConfiguration(configuration(barIdx));
}

function onConfigChanged() {
  pushConfigToEngine();
  saveState();
  renderBarsEditor();
}

// ========================================
// DOM refs
// ========================================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const el = {
  bpmNumber: $("#bpm-number"),
  bpmInput: $("#bpm-input"),
  bpmSlider: $("#bpm-slider"),
  tempoMarker: $("#tempo-marker"),
  tapTempo: $("#tap-tempo"),
  timeSigChips: $("#time-sig-chips"),
  beatDots: $("#beat-dots"),
  countInChips: $("#count-in-chips"),
  barsList: $("#bars-list"),
  addBar: $("#add-bar"),
  transportBtn: $("#transport-btn"),
  transportStatus: $("#transport-status"),
  transportLabel: $("#transport-label"),
  playIcon: $(".play-icon"),
  stopIcon: $(".stop-icon"),
  volume: $("#volume"),
  btnSettings: $("#btn-settings"),
  btnInfo: $("#btn-info"),
  backdrop: $("#backdrop"),

  // inline key (main screen)
  tonicPcChips: $("#tonic-pc-chips"),
  scaleMainChips: $("#scale-main-chips"),

  // settings sheet
  syncQuality: $("#sync-quality"),
  tuningChips: $("#tuning-chips"),
  tuningHint: $("#tuning-hint"),
  tonicTuning: $("#tonic-tuning"),
  tonicTuningHint: $("#tonic-tuning-hint"),
  customHzField: $("#custom-hz-field"),
  customHz: $("#custom-hz"),
  referenceA: $("#reference-a"),
  chordChipsBasic: $("#chord-chips-basic"),
  chordChipsTriad: $("#chord-chips-triad"),
  chordChipsSeventh: $("#chord-chips-seventh"),
  chordChipsExtra: $("#chord-chips-extra"),
  timbreChips: $("#timbre-chips"),
  accentFirstBeat: $("#accent-first-beat"),

  // bar edit sheet
  barEditTitle: $("#bar-edit-title"),
  barEditDegreeChips: $("#bar-edit-degree-chips"),
  barEditQualityChips: $("#bar-edit-quality-chips"),
  barEditChordChips: $("#bar-edit-chord-chips"),
  barEditKeyEnabled: $("#bar-edit-key-enabled"),
  barEditKeyFields: $("#bar-edit-key-fields"),
  barEditTonicChips: $("#bar-edit-tonic-chips"),
  barEditScaleChips: $("#bar-edit-scale-chips"),
  barEditDelete: $("#bar-edit-delete"),
};

let editingBarIdx = -1;

// ========================================
// BPM + Tempo marker
// ========================================

function tempoMarkerFor(bpm) {
  if (bpm < 40) return "Grave";
  if (bpm < 60) return "Largo";
  if (bpm < 66) return "Larghetto";
  if (bpm < 76) return "Adagio";
  if (bpm < 108) return "Andante";
  if (bpm < 120) return "Moderato";
  if (bpm < 156) return "Allegro";
  if (bpm < 176) return "Vivace";
  if (bpm < 200) return "Presto";
  return "Prestissimo";
}

function clampBpm(v) {
  if (!Number.isFinite(v)) return state.progression.bpm;
  return Math.min(Math.max(Math.round(v), 20), 300);
}

function updateBpmUI() {
  const bpm = state.progression.bpm;
  el.bpmNumber.textContent = bpm;
  el.bpmSlider.value = bpm;
  el.bpmInput.value = bpm;
  el.tempoMarker.textContent = tempoMarkerFor(bpm);
}

function setBpm(v) {
  state.progression.bpm = clampBpm(v);
  updateBpmUI();
  saveState();
}

// ±buttons
el.bpmSlider.addEventListener("input", (e) => setBpm(Number(e.target.value)));
$$(".bpm-btn").forEach(b => {
  b.addEventListener("click", () => setBpm(state.progression.bpm + Number(b.dataset.delta)));
});

// Tap on BPM number → edit mode
el.bpmNumber.addEventListener("click", () => {
  el.bpmInput.classList.add("visible");
  el.bpmNumber.style.display = "none";
  el.bpmInput.value = state.progression.bpm;
  el.bpmInput.focus();
  el.bpmInput.select();
});
el.bpmInput.addEventListener("blur", () => {
  const v = Number(el.bpmInput.value);
  if (Number.isFinite(v)) setBpm(v);
  el.bpmInput.classList.remove("visible");
  el.bpmNumber.style.display = "";
});
el.bpmInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") el.bpmInput.blur();
});

// Tap tempo
const tapTimes = [];
el.tapTempo.addEventListener("click", () => {
  const now = performance.now();
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
    tapTimes.length = 0;
  }
  tapTimes.push(now);
  // visual feedback
  el.tapTempo.classList.remove("pulsing");
  // trigger reflow to restart animation
  void el.tapTempo.offsetWidth;
  el.tapTempo.classList.add("pulsing");

  if (tapTimes.length >= 2) {
    const deltas = [];
    for (let i = 1; i < tapTimes.length; i++) deltas.push(tapTimes[i] - tapTimes[i - 1]);
    const recent = deltas.slice(-4);
    const avgMs = recent.reduce((a, b) => a + b, 0) / recent.length;
    const bpm = Math.round(60000 / avgMs);
    if (bpm >= 20 && bpm <= 300) setBpm(bpm);
  }
});

// ========================================
// Time signature chips
// ========================================

function setActiveChip(rowEl, attr, value) {
  rowEl.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("active", c.dataset[attr] === String(value));
  });
}

function renderTimeSigChips() {
  const key = `${state.progression.beatsPerBar}-${state.progression.beatUnit}`;
  setActiveChip(el.timeSigChips, "sig", key);
}

el.timeSigChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    const [n, d] = c.dataset.sig.split("-").map(Number);
    state.progression.beatsPerBar = n;
    state.progression.beatUnit = d;
    renderTimeSigChips();
    renderBeatDots();
    saveState();
  });
});

// ========================================
// Count-in chips
// ========================================

function renderCountInChips() {
  setActiveChip(el.countInChips, "count", state.progression.countInBars);
}

el.countInChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    state.progression.countInBars = Number(c.dataset.count);
    renderCountInChips();
    saveState();
  });
});

// ========================================
// Beat indicator
// ========================================

function renderBeatDots() {
  const n = state.progression.beatsPerBar;
  el.beatDots.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const dot = document.createElement("div");
    dot.className = "beat-dot" + (i === 0 ? " first" : "");
    el.beatDots.appendChild(dot);
  }
}

function pulseBeat(beatIdx) {
  const dots = el.beatDots.querySelectorAll(".beat-dot");
  dots.forEach((d, i) => {
    if (i === beatIdx) {
      d.classList.remove("pulse");
      void d.offsetWidth;  // reflow to restart transition
      d.classList.add("pulse");
      setTimeout(() => d.classList.remove("pulse"), 150);
    }
  });
}

// ========================================
// Bars editor
// ========================================

let currentProgressionBarIdx = 0;

function renderBarsEditor() {
  el.barsList.innerHTML = "";

  state.progression.bars.forEach((bar, idx) => {
    // Per-bar effective key (walks back for keyChange, else global)
    const key = effectiveKeyAt(idx);
    const scalePattern = SCALE_FORMS[key.scaleForm].pattern;
    const degLabels = SCALE_FORMS[key.scaleForm].degrees;

    const row = document.createElement("div");
    row.className = "bar-row" +
      (progression.running && idx === currentProgressionBarIdx ? " active" : "");

    // Inner layout: index, degree, quality, badges, more, remove
    const idxCell = document.createElement("span");
    idxCell.className = "bar-idx";
    idxCell.textContent = (idx + 1);
    row.appendChild(idxCell);

    // Meta column: degree chip + optional badges underneath
    const meta = document.createElement("div");
    meta.className = "bar-row-meta";

    const degWrap = document.createElement("div");
    degWrap.className = "degree-wrap";

    const chip = document.createElement("div");
    chip.className = "bar-degree-chip";
    const pcIdx = mod12(key.tonicPitchClass + scalePattern[bar.degree]);
    chip.innerHTML = `
      <span class="deg-roman">${degLabels[bar.degree]}</span>
      <span class="deg-pitch">${PITCH_CLASSES[pcIdx].name}</span>
    `;
    degWrap.appendChild(chip);

    const sel = document.createElement("select");
    sel.setAttribute("aria-label", `${idx + 1}小節目の度数`);
    degLabels.forEach((lab, di) => {
      const opt = document.createElement("option");
      opt.value = di;
      const p = mod12(key.tonicPitchClass + scalePattern[di]);
      opt.textContent = `${lab}  (${PITCH_CLASSES[p].name})`;
      if (di === bar.degree) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", (e) => {
      bar.degree = Number(e.target.value);
      if (state.syncQualityWithScale) {
        const k = effectiveKeyAt(idx);
        bar.quality = defaultQualityForDegree(k.scaleForm, bar.degree);
      }
      renderBarsEditor();
      saveState();
    });
    degWrap.appendChild(sel);
    meta.appendChild(degWrap);

    // Badges for chord override + key change (if any)
    const badges = [];
    if (bar.chordPreset && CHORD_PRESETS[bar.chordPreset]) {
      badges.push(`<span class="bar-badge chord">${CHORD_PRESETS[bar.chordPreset].label}</span>`);
    }
    if (bar.keyChange) {
      const kcName = PITCH_CLASSES[bar.keyChange.tonicPitchClass].name;
      const kcScale = SCALE_FORMS[bar.keyChange.scaleForm].label;
      badges.push(`<span class="bar-badge modulation">→ ${kcName} ${kcScale}</span>`);
    }
    if (badges.length > 0) {
      const badgeWrap = document.createElement("div");
      badgeWrap.className = "bar-badges";
      badgeWrap.innerHTML = badges.join("");
      meta.appendChild(badgeWrap);
    }
    row.appendChild(meta);

    // Major / minor toggle
    const qt = document.createElement("div");
    qt.className = "bar-quality-toggle";
    ["major", "minor"].forEach(q => {
      const btn = document.createElement("button");
      btn.textContent = q === "major" ? "M" : "m";
      btn.dataset.q = q;
      if (bar.quality === q) btn.classList.add("active");
      btn.addEventListener("click", () => {
        bar.quality = q;
        renderBarsEditor();
        saveState();
      });
      qt.appendChild(btn);
    });
    row.appendChild(qt);

    // More (advanced per-bar settings)
    const more = document.createElement("button");
    more.className = "bar-more";
    more.textContent = "⋯";
    more.setAttribute("aria-label", `${idx + 1}小節目の詳細設定`);
    more.addEventListener("click", () => openBarEditSheet(idx));
    row.appendChild(more);

    // Remove
    const rm = document.createElement("button");
    rm.className = "bar-remove";
    rm.textContent = "×";
    rm.disabled = state.progression.bars.length <= 1;
    rm.addEventListener("click", () => {
      if (state.progression.bars.length <= 1) return;
      state.progression.bars.splice(idx, 1);
      renderBarsEditor();
      saveState();
    });
    row.appendChild(rm);

    el.barsList.appendChild(row);
  });
}

el.addBar.addEventListener("click", () => {
  if (state.progression.bars.length >= 16) return;
  const last = state.progression.bars[state.progression.bars.length - 1] || { degree: 0, quality: "major" };
  state.progression.bars.push({ degree: last.degree, quality: last.quality });
  renderBarsEditor();
  saveState();
});

// ========================================
// Transport
// ========================================

function updateTransportButton() {
  const running = progression.running;
  el.transportBtn.classList.toggle("running", running);
  el.transportLabel.textContent = running ? "STOP" : "START";
  el.playIcon.hidden = running;
  el.stopIcon.hidden = !running;
}

el.transportBtn.addEventListener("click", () => {
  if (progression.running) {
    progression.stop();
    // Plus: STOP は drone も止める
    if (engine.isPlaying) engine.setPlaying(false);
  } else {
    // カウントイン中は drone を鳴らさない仕様
    if (state.progression.countInBars > 0 && engine.isPlaying) {
      engine.setPlaying(false);
    }
    progression.start(state.progression, () => {
      if (!engine.isPlaying) engine.setPlaying(true);
    });
  }
  updateTransportButton();
});

function onProgressionStatus(ev) {
  if (ev.phase === "idle") {
    el.transportStatus.textContent = "待機中";
    updateTransportButton();
    return;
  }
  if (ev.phase === "countin") {
    el.transportStatus.textContent = `カウントイン 残り ${ev.remaining}`;
  } else {
    el.transportStatus.textContent = `Bar ${ev.barIdx + 1}/${state.progression.bars.length} · Beat ${ev.beatIdx + 1}`;
  }
  pulseBeat(ev.beatIdx);
}

function onProgressionBar(ev) {
  if (ev.phase === "main") {
    currentProgressionBarIdx = ev.barIdx;
    const bar = state.progression.bars[ev.barIdx];
    if (!bar) return;
    state.droneScaleDegree = bar.degree;
    state.quality = bar.quality;
    pushConfigToEngine(ev.barIdx);
    renderBarsEditor();
  } else if (ev.phase === "countin") {
    // count-in 中は drone config だけ bar 0 にセットしておく（音は鳴らない）
    const bar = state.progression.bars[0];
    if (!bar) return;
    state.droneScaleDegree = bar.degree;
    state.quality = bar.quality;
    pushConfigToEngine(0);
  }
}

// ========================================
// Volume
// ========================================

el.volume.addEventListener("input", (e) => {
  state.volume = Number(e.target.value) / 100;
  engine.setVolume(state.volume);
  saveState();
});
el.volume.value = Math.round(state.volume * 100);

// ========================================
// Sheets
// ========================================

const allSheets = ["sheet-settings", "sheet-info", "sheet-bar-edit", "sheet-progression-edit"];

function isAnySheetOpen() {
  return allSheets.some(s => { const e = $("#" + s); return e && !e.hidden; });
}

function openSheet(id) {
  allSheets.forEach(s => { const e = $("#" + s); if (e) e.hidden = s !== id; });
  el.backdrop.hidden = false;
}

function closeAllSheets() {
  allSheets.forEach(s => { const e = $("#" + s); if (e) e.hidden = true; });
  el.backdrop.hidden = true;
  // swipe 中の transform をリセット
  allSheets.forEach(s => { const e = $("#" + s); if (e) e.style.transform = ""; });
}

// イベント委譲: 後から動的に生成された close ボタン含め全部捕捉
document.addEventListener("click", (e) => {
  if (e.target.closest(".close-btn") || e.target.closest("[data-close]")) {
    closeAllSheets();
    return;
  }
  if (e.target === el.backdrop) {
    closeAllSheets();
  }
});

// ESC で閉じる
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && isAnySheetOpen()) {
    closeAllSheets();
  }
});

// 下スワイプで閉じる
allSheets.forEach(id => {
  const sheet = $("#" + id);
  if (!sheet) return;
  const head = sheet.querySelector(".sheet-head");
  if (!head) return;
  let startY = null;
  let currentY = 0;
  head.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    currentY = 0;
    sheet.classList.add("dragging");
  }, { passive: true });
  head.addEventListener("touchmove", (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (dy > 0) {
      currentY = dy;
      sheet.style.transform = `translateY(${dy}px)`;
    }
  }, { passive: true });
  const endDrag = () => {
    if (startY === null) return;
    sheet.classList.remove("dragging");
    if (currentY > 80) {
      closeAllSheets();
    } else {
      sheet.style.transform = "";
    }
    startY = null;
    currentY = 0;
  };
  head.addEventListener("touchend", endDrag);
  head.addEventListener("touchcancel", endDrag);
});

el.btnSettings.addEventListener("click", () => openSheet("sheet-settings"));
el.btnInfo.addEventListener("click", () => openSheet("sheet-info"));

// ========================================
// Inline key chips (main screen)
// ========================================

function renderTonicPcChips() {
  el.tonicPcChips.innerHTML = "";
  PITCH_CLASSES.forEach(pc => {
    const b = document.createElement("button");
    b.className = "chip" + (pc.id === state.tonicPitchClass ? " active" : "");
    b.textContent = pc.name;
    b.addEventListener("click", () => {
      state.tonicPitchClass = pc.id;
      renderTonicPcChips();
      onConfigChanged();
    });
    el.tonicPcChips.appendChild(b);
  });
}

function handleScaleChange(newScale) {
  state.scaleForm = newScale;
  const maxDeg = SCALE_FORMS[state.scaleForm].pattern.length - 1;
  state.progression.bars.forEach(b => {
    if (b.degree > maxDeg) b.degree = 0;
    if (state.syncQualityWithScale) {
      b.quality = defaultQualityForDegree(state.scaleForm, b.degree);
    }
  });
  if (state.droneScaleDegree > maxDeg) state.droneScaleDegree = 0;
  setActiveChip(el.scaleMainChips, "scale", state.scaleForm);
  onConfigChanged();
}

el.scaleMainChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => handleScaleChange(c.dataset.scale));
});

// ========================================
// Settings sheet wiring
// ========================================

// Sync quality toggle
el.syncQuality.addEventListener("change", (e) => {
  state.syncQualityWithScale = e.target.checked;
  if (state.syncQualityWithScale) {
    state.progression.bars.forEach(b => {
      b.quality = defaultQualityForDegree(state.scaleForm, b.degree);
    });
    state.quality = defaultQualityForDegree(state.scaleForm, state.droneScaleDegree);
  }
  onConfigChanged();
});

// Tuning chips
el.tuningChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    state.tuningSystem = c.dataset.tuning;
    setActiveChip(el.tuningChips, "tuning", state.tuningSystem);
    el.tuningHint.textContent = TUNING_HINTS[state.tuningSystem] || "";
    onConfigChanged();
  });
});

// Tonic tuning
el.tonicTuning.addEventListener("change", (e) => {
  state.tonicTuning = e.target.value;
  el.tonicTuningHint.textContent = TONIC_TUNING_HINTS[state.tonicTuning] || "";
  el.customHzField.hidden = state.tonicTuning !== "customHz";
  onConfigChanged();
});

// Custom Hz
el.customHz.addEventListener("input", (e) => {
  const v = Number(e.target.value);
  if (!Number.isFinite(v) || v <= 0) return;
  state.customTonicHz = Math.min(Math.max(v, 20), 8000);
  onConfigChanged();
});

// Reference A
el.referenceA.addEventListener("change", (e) => {
  state.referenceA = Number(e.target.value);
  onConfigChanged();
});

// Chord preset chips (4 groups)
const chordChipGroups = [
  el.chordChipsBasic,
  el.chordChipsTriad,
  el.chordChipsSeventh,
  el.chordChipsExtra
];
function setActiveChordChip() {
  chordChipGroups.forEach(g => setActiveChip(g, "chord", state.chordPreset));
}
chordChipGroups.forEach(group => {
  group.querySelectorAll(".chip").forEach(c => {
    c.addEventListener("click", () => {
      state.chordPreset = c.dataset.chord;
      setActiveChordChip();
      onConfigChanged();
    });
  });
});

// Timbre chips
el.timbreChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    state.timbre = c.dataset.timbre;
    setActiveChip(el.timbreChips, "timbre", state.timbre);
    onConfigChanged();
  });
});

// Accent first beat toggle
el.accentFirstBeat.addEventListener("change", (e) => {
  state.progression.accentFirstBeat = e.target.checked;
  saveState();
});

// ========================================
// Bar edit sheet
// ========================================

function openBarEditSheet(barIdx) {
  editingBarIdx = barIdx;
  const bar = state.progression.bars[barIdx];
  if (!bar) return;
  const key = effectiveKeyAt(barIdx);
  const titleKey = `${PITCH_CLASSES[key.tonicPitchClass].name} ${SCALE_FORMS[key.scaleForm].label}`;
  el.barEditTitle.textContent = `小節 ${barIdx + 1} の設定 · ${titleKey}`;

  renderBarEditDegreeChips();
  setActiveChip(el.barEditQualityChips, "barQ", bar.quality);
  setActiveChip(el.barEditChordChips, "barChord", bar.chordPreset || "");

  el.barEditKeyEnabled.checked = !!bar.keyChange;
  el.barEditKeyFields.hidden = !bar.keyChange;
  renderBarEditTonicChips();
  setActiveChip(el.barEditScaleChips, "barScale",
    bar.keyChange ? bar.keyChange.scaleForm : "");

  openSheet("sheet-bar-edit");
}

function renderBarEditDegreeChips() {
  const bar = state.progression.bars[editingBarIdx];
  const key = effectiveKeyAt(editingBarIdx);
  const degLabels = SCALE_FORMS[key.scaleForm].degrees;
  const pattern = SCALE_FORMS[key.scaleForm].pattern;
  el.barEditDegreeChips.innerHTML = "";
  degLabels.forEach((lab, di) => {
    const b = document.createElement("button");
    b.className = "chip" + (bar.degree === di ? " active" : "");
    const p = mod12(key.tonicPitchClass + pattern[di]);
    b.innerHTML = `<span style="color:var(--gold);font-weight:800">${lab}</span> <small style="opacity:0.7;margin-left:4px">${PITCH_CLASSES[p].name}</small>`;
    b.addEventListener("click", () => {
      bar.degree = di;
      if (state.syncQualityWithScale) {
        const k = effectiveKeyAt(editingBarIdx);
        bar.quality = defaultQualityForDegree(k.scaleForm, bar.degree);
        setActiveChip(el.barEditQualityChips, "barQ", bar.quality);
      }
      renderBarEditDegreeChips();
      renderBarsEditor();
      saveState();
    });
    el.barEditDegreeChips.appendChild(b);
  });
}

function renderBarEditTonicChips() {
  const bar = state.progression.bars[editingBarIdx];
  const currentPc = bar.keyChange ? bar.keyChange.tonicPitchClass : null;
  el.barEditTonicChips.innerHTML = "";
  PITCH_CLASSES.forEach(pc => {
    const b = document.createElement("button");
    b.className = "chip" + (currentPc === pc.id ? " active" : "");
    b.textContent = pc.name;
    b.addEventListener("click", () => {
      if (!bar.keyChange) bar.keyChange = { tonicPitchClass: pc.id, scaleForm: "major" };
      else bar.keyChange.tonicPitchClass = pc.id;
      renderBarEditTonicChips();
      setActiveChip(el.barEditScaleChips, "barScale", bar.keyChange.scaleForm);
      el.barEditKeyEnabled.checked = true;
      el.barEditKeyFields.hidden = false;
      renderBarsEditor();
      saveState();
    });
    el.barEditTonicChips.appendChild(b);
  });
}

// Quality chips
el.barEditQualityChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    const bar = state.progression.bars[editingBarIdx];
    if (!bar) return;
    bar.quality = c.dataset.barQ;
    setActiveChip(el.barEditQualityChips, "barQ", bar.quality);
    renderBarsEditor();
    saveState();
  });
});

// Chord override chips
el.barEditChordChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    const bar = state.progression.bars[editingBarIdx];
    if (!bar) return;
    const v = c.dataset.barChord;
    bar.chordPreset = v === "" ? null : v;
    setActiveChip(el.barEditChordChips, "barChord", v);
    renderBarsEditor();
    saveState();
  });
});

// Key change enable toggle
el.barEditKeyEnabled.addEventListener("change", (e) => {
  const bar = state.progression.bars[editingBarIdx];
  if (!bar) return;
  if (e.target.checked) {
    if (!bar.keyChange) {
      // Default to current effective key so user can edit from there
      const k = effectiveKeyAt(editingBarIdx);
      bar.keyChange = { tonicPitchClass: k.tonicPitchClass, scaleForm: k.scaleForm };
    }
    el.barEditKeyFields.hidden = false;
    renderBarEditTonicChips();
    setActiveChip(el.barEditScaleChips, "barScale", bar.keyChange.scaleForm);
  } else {
    bar.keyChange = null;
    el.barEditKeyFields.hidden = true;
  }
  renderBarsEditor();
  // Re-render bar-edit internals because effective key may have changed
  renderBarEditDegreeChips();
  saveState();
});

// Key scale chips
el.barEditScaleChips.querySelectorAll(".chip").forEach(c => {
  c.addEventListener("click", () => {
    const bar = state.progression.bars[editingBarIdx];
    if (!bar) return;
    if (!bar.keyChange) {
      const k = effectiveKeyAt(editingBarIdx);
      bar.keyChange = { tonicPitchClass: k.tonicPitchClass, scaleForm: c.dataset.barScale };
    } else {
      bar.keyChange.scaleForm = c.dataset.barScale;
    }
    // Clamp this bar's degree if new scale has fewer steps (it doesn't — all 7 — but safe)
    const maxDeg = SCALE_FORMS[bar.keyChange.scaleForm].pattern.length - 1;
    if (bar.degree > maxDeg) bar.degree = 0;
    setActiveChip(el.barEditScaleChips, "barScale", bar.keyChange.scaleForm);
    el.barEditKeyEnabled.checked = true;
    el.barEditKeyFields.hidden = false;
    renderBarEditDegreeChips();  // effective key changed for this bar
    renderBarsEditor();
    saveState();
  });
});

// Delete bar
el.barEditDelete.addEventListener("click", () => {
  if (state.progression.bars.length <= 1) {
    closeAllSheets();
    return;
  }
  state.progression.bars.splice(editingBarIdx, 1);
  renderBarsEditor();
  saveState();
  closeAllSheets();
});

// ========================================
// Initial render
// ========================================

function renderAll() {
  updateBpmUI();
  renderTonicPcChips();
  setActiveChip(el.scaleMainChips, "scale", state.scaleForm);
  renderTimeSigChips();
  renderCountInChips();
  renderBeatDots();
  renderBarsEditor();
  updateTransportButton();

  // settings sheet initial state
  el.syncQuality.checked = state.syncQualityWithScale;
  setActiveChip(el.tuningChips, "tuning", state.tuningSystem);
  el.tuningHint.textContent = TUNING_HINTS[state.tuningSystem] || "";
  el.tonicTuning.value = state.tonicTuning;
  el.tonicTuningHint.textContent = TONIC_TUNING_HINTS[state.tonicTuning] || "";
  el.customHzField.hidden = state.tonicTuning !== "customHz";
  el.customHz.value = state.customTonicHz;
  el.referenceA.value = state.referenceA;
  setActiveChordChip();
  setActiveChip(el.timbreChips, "timbre", state.timbre);
  el.accentFirstBeat.checked = state.progression.accentFirstBeat;
}

// ========================================
// Progression DSL — parse / emit text notation
// ========================================
//
// 書式例:
//   key: C major
//   bpm: 120
//   time: 4/4
//   count-in: 1
//
//   | I | IV | V | I |
//   | vi | ii | V7@G | Imaj7 |
//
// 度数: I II III IV V VI VII = Major, i ii iii iv v vi vii = minor
// suffix: 7 / maj7 / sus2 / sus4 / add6 / add9 / dim / dim7 / aug / m7b5 / 5
// @key: この小節からその調へ。例 V7@G (G major), @Am (A minor), @Dh (D harmonic)

const ROMAN_MAP = { i: 0, ii: 1, iii: 2, iv: 3, v: 4, vi: 5, vii: 6 };
const ROMAN_NUMS = ["I", "II", "III", "IV", "V", "VI", "VII"];

const CHORD_SUFFIX_PARSE = {
  "": null,
  "7": "seventh",
  "maj7": "maj7",
  "M7": "maj7",
  "Maj7": "maj7",
  "sus2": "sus2",
  "sus4": "sus4",
  "dim": "diminished",
  "dim7": "diminishedSeventh",
  "aug": "augmented",
  "m7b5": "halfDim7",
  "add6": "add6",
  "add9": "add9",
  "5": "rootFifth",
  "oct": "rootOctave",
  "1": "root"
};
const CHORD_SUFFIX_EMIT = {
  root: "1",
  rootFifth: "5",
  rootOctave: "oct",
  rootFifthOctave: "oct5",
  triad: "",
  triadOctave: "",
  sus2: "sus2",
  sus4: "sus4",
  seventh: "7",
  maj7: "maj7",
  halfDim7: "m7b5",
  diminishedSeventh: "dim7",
  add6: "add6",
  add9: "add9",
  diminished: "dim",
  augmented: "aug"
};

function parseKeyText(text) {
  if (!text) return null;
  text = String(text).trim();
  const m = text.match(/^([A-Ga-g])([#♯b♭]?)/);
  if (!m) return null;
  const pcMap = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let pc = pcMap[m[1].toUpperCase()];
  if (pc === undefined) return null;
  const acc = m[2];
  if (acc === "#" || acc === "♯") pc = (pc + 1) % 12;
  else if (acc === "b" || acc === "♭") pc = (pc + 11) % 12;

  const rest = text.slice(m[0].length).trim().toLowerCase();
  let scaleForm = "major";
  // "m" alone or followed by anything that isn't "maj" = minor
  if (rest.startsWith("m") && !rest.startsWith("maj")) scaleForm = "naturalMinor";
  else if (/\bminor\b|\bmin\b/.test(rest)) scaleForm = "naturalMinor";
  // harmonic が含まれていれば強制的に harmonicMinor
  if (rest.includes("h") && (rest.includes("harmonic") || /^h$/.test(rest))) scaleForm = "harmonicMinor";
  else if (rest.includes("harmonic")) scaleForm = "harmonicMinor";
  return { tonicPitchClass: pc, scaleForm };
}

function parseBarToken(token) {
  if (!token) return null;
  token = token.trim();
  if (!token) return null;

  // @key 末尾
  let keyChange = null;
  const atIdx = token.indexOf("@");
  let body = token;
  if (atIdx >= 0) {
    keyChange = parseKeyText(token.slice(atIdx + 1));
    body = token.slice(0, atIdx).trim();
  }

  // roman 抽出 — 長いものから順に
  const m = body.match(/^(b?)(VII|VI|V|IV|III|II|I|vii|vi|v|iv|iii|ii|i)/);
  if (!m) {
    // roman 無しだが @key がある場合は前の bar の度数を維持できないので fallback
    return keyChange ? { degree: 0, quality: "major", chordPreset: null, keyChange } : null;
  }
  const roman = m[2];
  const isUpper = roman === roman.toUpperCase();
  const degree = ROMAN_MAP[roman.toLowerCase()];
  const suffix = body.slice(m[0].length);

  // suffix 解決（case-sensitive first, then insensitive）
  let chordPreset = null;
  if (suffix in CHORD_SUFFIX_PARSE) chordPreset = CHORD_SUFFIX_PARSE[suffix];
  else {
    const lc = suffix.toLowerCase();
    if (lc in CHORD_SUFFIX_PARSE) chordPreset = CHORD_SUFFIX_PARSE[lc];
  }

  return {
    degree,
    quality: isUpper ? "major" : "minor",
    chordPreset,
    keyChange
  };
}

function parseProgressionText(text) {
  const meta = {};
  const bars = [];
  const lines = String(text).split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    // meta line?
    const metaMatch = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*)\s*:\s*(.+)$/);
    if (metaMatch && !/\|/.test(line)) {
      meta[metaMatch[1].toLowerCase()] = metaMatch[2].trim();
      continue;
    }
    // bar tokens (pipe-separated)
    const tokens = line.split("|").map(t => t.trim()).filter(t => t.length > 0);
    for (const tok of tokens) {
      const parsed = parseBarToken(tok);
      if (parsed) bars.push(parsed);
    }
  }
  return { meta, bars };
}

function scaleFormLabel(sf) {
  if (sf === "naturalMinor") return "minor";
  if (sf === "harmonicMinor") return "harmonic minor";
  return "major";
}

function emitProgressionText() {
  const metaLines = [
    `key: ${PITCH_CLASSES[state.tonicPitchClass].name} ${scaleFormLabel(state.scaleForm)}`,
    `bpm: ${state.progression.bpm}`,
    `time: ${state.progression.beatsPerBar}/${state.progression.beatUnit}`,
    `count-in: ${state.progression.countInBars}`
  ];

  const barTokens = state.progression.bars.map(b => {
    let roman = ROMAN_NUMS[Math.min(b.degree, 6)];
    if (b.quality === "minor") roman = roman.toLowerCase();
    const sfx = CHORD_SUFFIX_EMIT[b.chordPreset || "triad"] || "";
    let keyTag = "";
    if (b.keyChange) {
      const n = PITCH_CLASSES[b.keyChange.tonicPitchClass].name;
      const sc = b.keyChange.scaleForm === "major" ? "" :
                 b.keyChange.scaleForm === "naturalMinor" ? "m" : "h";
      keyTag = `@${n}${sc}`;
    }
    return roman + sfx + keyTag;
  });

  // 4 bars per line (or matches time signature numerator if small)
  const perLine = Math.max(4, state.progression.beatsPerBar);
  const barLines = [];
  for (let i = 0; i < barTokens.length; i += perLine) {
    const slice = barTokens.slice(i, i + perLine);
    barLines.push("| " + slice.join(" | ") + " |");
  }

  return metaLines.join("\n") + "\n\n" + (barLines.length > 0 ? barLines.join("\n") : "");
}

function normalizeBars() {
  state.progression.bars.forEach(b => {
    if (b.degree === undefined || b.degree === null) b.degree = 0;
    if (!b.quality) b.quality = "major";
    if (b.chordPreset && !CHORD_PRESETS[b.chordPreset]) b.chordPreset = null;
  });
  if (state.progression.bars.length === 0) {
    state.progression.bars = [{ degree: 0, quality: "major" }];
  }
}

function applyProgression(parsed) {
  if (!parsed) return;
  const meta = parsed.meta || {};
  // key
  if (meta.key) {
    const k = parseKeyText(meta.key);
    if (k) {
      state.tonicPitchClass = k.tonicPitchClass;
      state.scaleForm = k.scaleForm;
    }
  }
  // bpm
  if (meta.bpm) {
    const v = Number(meta.bpm);
    if (!isNaN(v)) state.progression.bpm = clampBpm(v);
  }
  // time
  if (meta.time) {
    const m = meta.time.match(/(\d+)\s*\/\s*(\d+)/);
    if (m) {
      state.progression.beatsPerBar = Number(m[1]);
      state.progression.beatUnit = Number(m[2]);
      normalizeTimeSig();
    }
  }
  // count-in
  if (meta["count-in"] !== undefined) {
    const v = Number(meta["count-in"]);
    if (!isNaN(v) && v >= 0 && v <= 2) state.progression.countInBars = Math.round(v);
  }

  if (parsed.bars && parsed.bars.length > 0) {
    state.progression.bars = parsed.bars.map(b => ({ ...b }));
  }
  normalizeBars();
  saveState();

  // Force a full re-render so every UI piece reflects the new state
  if (progression.running) {
    progression.stop();
    if (engine.isPlaying) engine.setPlaying(false);
  }
  renderAll();
  pushConfigToEngine();
}

// ========================================
// Input normalizer — paste された文字列を平文DSLに戻す
// ========================================
//
// ユーザーがペーストしうる形式:
//   (a) 生DSL (平文)                          — そのまま
//   (b) percent-encoded ("key%3A%20..." 系)    — decodeURIComponent
//   (c) 共有URLまるごと ("...#p=<base64>")      — hash 抽出 → base64 decode
//   (d) bare base64 (hash 無しで base64 だけ)  — base64 decode

function tryDecodeAnyFormat(text) {
  if (!text) return text;
  const trimmed = text.trim();
  if (!trimmed) return text;

  // (c) full URL containing #p= or &p=
  const urlMatch = trimmed.match(/[#&]p=([A-Za-z0-9+/=_\-]+)/);
  if (urlMatch) {
    try {
      const b64 = urlMatch[1].replace(/-/g, "+").replace(/_/g, "/");
      const decoded = decodeURIComponent(escape(atob(b64)));
      if (looksLikeDSL(decoded)) return decoded;
    } catch {}
  }

  // (d) bare base64 — 1行で base64 っぽく、長めで、デコードすると DSL っぽい
  if (/^[A-Za-z0-9+/=_\-]+$/.test(trimmed) && trimmed.length >= 20 && !trimmed.includes(" ")) {
    try {
      const b64 = trimmed.replace(/-/g, "+").replace(/_/g, "/");
      const decoded = decodeURIComponent(escape(atob(b64)));
      if (looksLikeDSL(decoded)) return decoded;
    } catch {}
  }

  // (b) percent-encoded — %XX が含まれ、改行は encode された状態 (\n が無い)
  if (/%[0-9A-Fa-f]{2}/.test(trimmed) && !trimmed.includes("\n")) {
    try {
      const decoded = decodeURIComponent(trimmed);
      if (looksLikeDSL(decoded)) return decoded;
    } catch {}
  }

  // (a) fallback: そのまま
  return text;
}

function looksLikeDSL(s) {
  if (!s) return false;
  // key:, bpm:, time:, count-in: のどれか、あるいは | 区切りの小節があれば DSL とみなす
  return /^\s*(key|bpm|time|count-in)\s*:/m.test(s) || /\|\s*[A-Ga-gIiVv]/.test(s);
}

// ========================================
// Clipboard helper
// ========================================

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {}
  // fallback
  try {
    const t = document.createElement("textarea");
    t.value = text;
    t.style.position = "fixed";
    t.style.opacity = "0";
    document.body.appendChild(t);
    t.focus();
    t.select();
    document.execCommand("copy");
    document.body.removeChild(t);
    return true;
  } catch { return false; }
}

function flashButtonLabel(btn, msg, duration = 1500) {
  const orig = btn.textContent;
  btn.textContent = msg;
  btn.disabled = true;
  setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, duration);
}

// ========================================
// URL hash — share progressions via link
// ========================================

function buildShareUrl() {
  const text = emitProgressionText();
  try {
    // UTF-8 safe base64
    const b64 = btoa(unescape(encodeURIComponent(text)));
    return location.origin + location.pathname + "#p=" + b64;
  } catch {
    return location.href;
  }
}

function loadFromHashIfPresent() {
  const m = location.hash.match(/[#&]p=([^&]+)/);
  if (!m) return false;
  try {
    const decoded = decodeURIComponent(escape(atob(m[1])));
    const parsed = parseProgressionText(decoded);
    if (parsed.bars.length > 0 || Object.keys(parsed.meta).length > 0) {
      applyProgression(parsed);
      // ロード後 hash を消して上書き誘発を防ぐ
      history.replaceState(null, "", location.pathname);
      return true;
    }
  } catch (e) {
    console.warn("progression URL load failed", e);
  }
  return false;
}

// ========================================
// Saved presets (localStorage)
// ========================================

const PRESETS_KEY = "jawari-plus.presets";

function listSavedPresets() {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) || "{}");
  } catch { return {}; }
}

function savePreset(name, text) {
  if (!name) return false;
  const presets = listSavedPresets();
  presets[name] = { text, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return true;
  } catch { return false; }
}

function deletePreset(name) {
  const presets = listSavedPresets();
  delete presets[name];
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

// ========================================
// Built-in templates
// ========================================

const TEMPLATES = {
  "王道 Ⅰ-Ⅳ-Ⅴ-Ⅰ": `key: C major
bpm: 100
time: 4/4
count-in: 1

| I | IV | V | I |`,
  "Pop Ⅰ-Ⅴ-Ⅵ-Ⅳ": `key: C major
bpm: 110
time: 4/4
count-in: 1

| I | V | vi | IV |`,
  "ii-V-I (Jazz)": `key: C major
bpm: 120
time: 4/4
count-in: 1

| ii7 | V7 | Imaj7 | Imaj7 |`,
  "カノン進行": `key: D major
bpm: 80
time: 4/4
count-in: 1

| I | V | vi | iii |
| IV | I | IV | V |`,
  "12小節ブルース C": `key: C major
bpm: 100
time: 4/4
count-in: 1

| I7 | I7 | I7 | I7 |
| IV7 | IV7 | I7 | I7 |
| V7 | IV7 | I7 | V7 |`,
  "和声短調 ⅰ-ⅳ-Ⅴ7-ⅰ": `key: A harmonic
bpm: 80
time: 3/4
count-in: 1

| i | iv | V7 | i |`,
  "自然短調 ⅰ-ⅵ-ⅳ-Ⅴ": `key: A minor
bpm: 90
time: 4/4
count-in: 1

| i | vi | iv | V |`,
  "転調例 C→G": `key: C major
bpm: 100
time: 4/4
count-in: 1

| I | IV | V | I |
| V7@G | I | IV | V |`,
  "重音練習 Ⅰ-Ⅳ-Ⅴ": `key: G major
bpm: 60
time: 4/4
count-in: 1

# sus も混ぜた長い持続用
| I | I | Isus4 | I |
| IV | IV | IVsus4 | IV |
| V | V | V7 | V |
| I | I | I | I |`,
  "付点4分の6/8": `key: D major
bpm: 140
time: 6/8
count-in: 1

| I | V | vi | IV |`
};

// ========================================
// Progression editor sheet wiring
// ========================================

function renderTemplateChips() {
  const container = $("#template-chips");
  if (!container) return;
  container.innerHTML = "";
  for (const name of Object.keys(TEMPLATES)) {
    const c = document.createElement("button");
    c.className = "chip";
    c.textContent = name;
    c.addEventListener("click", () => {
      const text = TEMPLATES[name];
      $("#progression-text").value = text;
      applyProgression(parseProgressionText(text));
    });
    container.appendChild(c);
  }
}

function renderPresetList() {
  const container = $("#preset-list");
  if (!container) return;
  const presets = listSavedPresets();
  const entries = Object.entries(presets).sort((a, b) => {
    return new Date(b[1].updatedAt || 0) - new Date(a[1].updatedAt || 0);
  });
  if (entries.length === 0) {
    container.innerHTML = `<small class="settings-hint">まだ保存された進行はありません。上のテキストを編集して「保存」で名前付き保存できます。</small>`;
    return;
  }
  container.innerHTML = "";
  for (const [name, data] of entries) {
    const row = document.createElement("div");
    row.className = "preset-item";

    const nameEl = document.createElement("span");
    nameEl.className = "preset-name";
    nameEl.textContent = name;
    row.appendChild(nameEl);

    const metaEl = document.createElement("span");
    metaEl.className = "preset-meta";
    try {
      const d = new Date(data.updatedAt);
      metaEl.textContent = `${d.getMonth() + 1}/${d.getDate()}`;
    } catch { metaEl.textContent = ""; }
    row.appendChild(metaEl);

    const loadBtn = document.createElement("button");
    loadBtn.className = "btn btn-secondary";
    loadBtn.textContent = "読込";
    loadBtn.addEventListener("click", () => {
      $("#progression-text").value = data.text;
      applyProgression(parseProgressionText(data.text));
    });
    row.appendChild(loadBtn);

    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-secondary";
    delBtn.textContent = "削除";
    delBtn.addEventListener("click", () => {
      if (confirm(`「${name}」を削除しますか?`)) {
        deletePreset(name);
        renderPresetList();
      }
    });
    row.appendChild(delBtn);

    container.appendChild(row);
  }
}

function openProgressionEditor() {
  const ta = $("#progression-text");
  if (ta) ta.value = emitProgressionText();
  renderTemplateChips();
  renderPresetList();
  openSheet("sheet-progression-edit");
}

$("#btn-progression-edit")?.addEventListener("click", openProgressionEditor);

// 進行エディタ内の「詳しいリファレンスは使い方へ」— 開き直す
$("#open-info-from-editor")?.addEventListener("click", () => {
  openSheet("sheet-info");
  // 使い方シートを開いた後、DSL セクションを自動で展開してあげる
  requestAnimationFrame(() => {
    const folds = $$(".info-fold");
    folds.forEach((f, i) => {
      // "📝 テキスト記法" は 2 番目
      if (i === 1) f.setAttribute("open", "");
    });
  });
});

$("#apply-progression")?.addEventListener("click", () => {
  const raw = $("#progression-text").value;
  const text = tryDecodeAnyFormat(raw);
  if (text !== raw) {
    // 正規化された平文を textarea にも反映しておく
    $("#progression-text").value = text;
  }
  const parsed = parseProgressionText(text);
  if (parsed.bars.length === 0 && Object.keys(parsed.meta).length === 0) {
    flashButtonLabel($("#apply-progression"), "⚠ パースできませんでした");
    return;
  }
  applyProgression(parsed);
  flashButtonLabel($("#apply-progression"), "✓ 反映しました");
});

// paste 直後にも自動で正規化（次に反映を押さなくても見た目が綺麗になる）
$("#progression-text")?.addEventListener("paste", () => {
  // paste イベントの時点では value は未更新、次の tick で処理
  setTimeout(() => {
    const raw = $("#progression-text").value;
    const decoded = tryDecodeAnyFormat(raw);
    if (decoded !== raw) $("#progression-text").value = decoded;
  }, 0);
});

$("#copy-progression")?.addEventListener("click", async () => {
  const text = $("#progression-text").value;
  const ok = await copyToClipboard(text);
  flashButtonLabel($("#copy-progression"), ok ? "✓ コピーしました" : "⚠ コピー失敗");
});

$("#share-progression")?.addEventListener("click", async () => {
  const url = buildShareUrl();
  const ok = await copyToClipboard(url);
  flashButtonLabel($("#share-progression"), ok ? "✓ URLをコピー" : "⚠ コピー失敗");
});

$("#save-preset")?.addEventListener("click", () => {
  const nameInput = $("#preset-name-input");
  const name = nameInput.value.trim();
  if (!name) {
    alert("名前を入力してください");
    nameInput.focus();
    return;
  }
  const text = $("#progression-text").value || emitProgressionText();
  if (savePreset(name, text)) {
    nameInput.value = "";
    renderPresetList();
    flashButtonLabel($("#save-preset"), "✓ 保存");
  }
});

// 起動時に URL hash から読み込み
loadFromHashIfPresent();

requestAnimationFrame(renderAll);
