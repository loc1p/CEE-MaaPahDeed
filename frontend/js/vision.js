const Vision = (() => {
  const $ = id => document.getElementById(id);

  const chords = [
    { name: 'C', gesture: 'index', hint: 'ชี้นิ้วเดียว', notes: [130.81, 164.81, 196.00, 261.63, 329.63] },
    { name: 'G', gesture: 'peace', hint: 'สองนิ้ว V', notes: [98.00, 123.47, 146.83, 196.00, 246.94, 392.00] },
    { name: 'D', gesture: 'three', hint: 'สามนิ้ว', notes: [146.83, 220.00, 293.66, 369.99] },
    { name: 'Am', gesture: 'four', hint: 'สี่นิ้ว', notes: [110.00, 164.81, 220.00, 261.63, 329.63] },
    { name: 'Em', gesture: 'fist', hint: 'กำมือ', notes: [82.41, 123.47, 164.81, 196.00, 246.94, 329.63] },
    { name: 'F', gesture: 'open', hint: 'แบมือ', notes: [87.31, 130.81, 174.61, 220.00, 261.63, 349.23] }
  ];

  let initialized = false;
  let active = false;
  let camera = null;
  let hands = null;
  let faceMesh = null;
  let audioCtx = null;
  let master = null;
  let compressor = null;
  let dryBus = null;
  let delay = null;
  let delayFeedback = null;
  let delayWet = null;
  let muted = false;
  let currentChord = 'C';
  let lastChord = 'C';
  let lastPlayedAt = 0;
  let activeVoices = [];
  let gestureBuffer = [];
  let lastTip = null;
  let lastTipTime = 0;
  let lastClearSide = null;
  let strumHistory = [];
  let faceSeen = false;
  let mouthWasOpen = false;
  let lastMouthDrumAt = 0;
  let mouseStrum = null;
  let lastCanvasW = 0;
  let lastCanvasH = 0;

  const STRUM_LINE_Y = 0.50;
  const STRUM_ZONE_HALF = 0.12;
  const STRUM_COOLDOWN = 48;
  const VELOCITY_TRIGGER = 0.018;
  const CROSS_HYST = 0.035;
  const MAX_VOICES = 54;
  const CHORD_SUSTAIN = 9.5;
  const RELEASE_ON_NEXT = 0.85;
  const MOUTH_OPEN_RATIO = 0.34;
  const MOUTH_DRUM_COOLDOWN = 230;

  function showToast(message) {
    const toast = $('cc-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function ensureAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    master = audioCtx.createGain();
    master.gain.value = muted ? 0 : 0.95;

    compressor = audioCtx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 3.5;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;

    dryBus = audioCtx.createGain();
    dryBus.gain.value = 1.0;

    delay = audioCtx.createDelay(0.8);
    delay.delayTime.value = 0.105;
    delayFeedback = audioCtx.createGain();
    delayFeedback.gain.value = 0.16;
    delayWet = audioCtx.createGain();
    delayWet.gain.value = 0.12;

    dryBus.connect(compressor);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(compressor);
    compressor.connect(master);
    master.connect(audioCtx.destination);
  }

  function makeDriveCurve(amount = 12) {
    const n = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = i * 2 / n - 1;
      curve[i] = (1 + amount) * x / (1 + amount * Math.abs(x));
    }
    return curve;
  }

  function cleanupVoices() {
    const now = audioCtx.currentTime;
    activeVoices = activeVoices.filter(v => v.stopAt > now);
    while (activeVoices.length > MAX_VOICES) {
      const v = activeVoices.shift();
      try { v.out.gain.setTargetAtTime(0, now, RELEASE_ON_NEXT); } catch (e) {}
    }
  }

  function softenOldVoices() {
    const now = audioCtx.currentTime;
    for (const v of activeVoices) {
      try { v.out.gain.setTargetAtTime(0.18, now, 0.55); } catch (e) {}
    }
  }

  function createStringVoice(freq, start, stringIndex) {
    ensureAudio();
    const tone = $('cc-tone-select')?.value || 'acoustic';
    const isElectric = tone !== 'acoustic';
    const isDrive = tone === 'drive';

    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const osc3 = audioCtx.createOscillator();
    const amp = audioCtx.createGain();
    const hp = audioCtx.createBiquadFilter();
    const body = audioCtx.createBiquadFilter();
    const top = audioCtx.createBiquadFilter();
    const pan = audioCtx.createStereoPanner();
    const out = audioCtx.createGain();
    const drive = audioCtx.createWaveShaper();

    osc1.type = isElectric ? 'triangle' : 'sawtooth';
    osc2.type = isElectric ? 'sine' : 'triangle';
    osc3.type = 'sine';

    const detune = Math.random() * 8 - 4;
    osc1.frequency.setValueAtTime(freq, start);
    osc2.frequency.setValueAtTime(freq * 2.003, start);
    osc3.frequency.setValueAtTime(freq * 3.01, start);
    osc1.detune.setValueAtTime(detune, start);
    osc2.detune.setValueAtTime(-detune * 0.7, start);

    hp.type = 'highpass';
    hp.frequency.value = isElectric ? 76 : 58;
    body.type = 'peaking';
    body.frequency.value = isElectric ? 230 : 165;
    body.Q.value = 0.75;
    body.gain.value = isElectric ? 2.2 : 5.0;
    top.type = 'lowpass';
    top.frequency.value = isDrive ? 4400 : isElectric ? 5600 : 6500;
    drive.curve = makeDriveCurve(isDrive ? 32 : isElectric ? 9 : 4);
    drive.oversample = '2x';

    const level = (isElectric ? 0.18 : 0.20) * (1 - stringIndex * 0.035) * (0.92 + Math.random() * 0.18);
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(level, start + 0.006);
    amp.gain.exponentialRampToValueAtTime(level * 0.62, start + 0.22);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + CHORD_SUSTAIN + Math.random() * 1.2);

    pan.pan.value = -0.24 + (stringIndex / 5) * 0.48;

    osc1.connect(amp);
    osc2.connect(amp);
    osc3.connect(amp);
    amp.connect(hp);
    hp.connect(body);
    body.connect(drive);
    drive.connect(top);
    top.connect(pan);
    pan.connect(out);
    out.connect(dryBus);
    out.connect(delay);

    osc1.start(start);
    osc2.start(start);
    osc3.start(start);
    osc1.stop(start + CHORD_SUSTAIN + 1.4);
    osc2.stop(start + CHORD_SUSTAIN + 1.4);
    osc3.stop(start + CHORD_SUSTAIN + 1.4);

    activeVoices.push({ out, stopAt: start + CHORD_SUSTAIN + 1.4 });
    cleanupVoices();
  }

  function noiseBurst(seconds) {
    ensureAudio();
    const len = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    return src;
  }

  function pickNoise(start, stringIndex) {
    const src = noiseBurst(0.018);
    const hp = audioCtx.createBiquadFilter();
    const gain = audioCtx.createGain();
    const pan = audioCtx.createStereoPanner();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    gain.gain.setValueAtTime(0.018, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.018);
    pan.pan.value = -0.24 + (stringIndex / 5) * 0.48;
    src.connect(hp);
    hp.connect(gain);
    gain.connect(pan);
    pan.connect(dryBus);
    pan.connect(delay);
    src.start(start);
  }

  function playDrum(kind = 'mouth') {
    ensureAudio();
    if (muted) return;
    const now = audioCtx.currentTime;
    const kick = audioCtx.createOscillator();
    const kg = audioCtx.createGain();
    kick.type = 'sine';
    kick.frequency.setValueAtTime(135, now);
    kick.frequency.exponentialRampToValueAtTime(48, now + 0.13);
    kg.gain.setValueAtTime(0.0001, now);
    kg.gain.exponentialRampToValueAtTime(kind === 'mouth' ? 0.75 : 0.45, now + 0.006);
    kg.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    kick.connect(kg);
    kg.connect(compressor);
    kick.start(now);
    kick.stop(now + 0.24);

    const sn = noiseBurst(0.12);
    const hp = audioCtx.createBiquadFilter();
    const sg = audioCtx.createGain();
    hp.type = 'highpass';
    hp.frequency.value = 950;
    sg.gain.setValueAtTime(0.0001, now);
    sg.gain.exponentialRampToValueAtTime(kind === 'mouth' ? 0.16 : 0.09, now + 0.004);
    sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    sn.connect(hp);
    hp.connect(sg);
    sg.connect(compressor);
    sn.start(now);
    sn.stop(now + 0.13);
  }

  function stopAllVoices() {
    ensureAudio();
    const now = audioCtx.currentTime;
    for (const v of activeVoices) {
      try {
        v.out.gain.cancelScheduledValues(now);
        v.out.gain.setTargetAtTime(0.0001, now, 0.025);
      } catch (e) {}
    }
    activeVoices = [];
    lastPlayedAt = 0;
    const strumDir = $('cc-strum-dir');
    if (strumDir) strumDir.textContent = 'CUT';
    showToast('ALL SOUND CUT');
  }

  function playChord(direction = 'down') {
    ensureAudio();
    if (muted) return;
    const nowMs = performance.now();
    if (nowMs - lastPlayedAt < STRUM_COOLDOWN) return;
    lastPlayedAt = nowMs;
    softenOldVoices();

    const chord = chords.find(c => c.name === currentChord) || chords[0];
    const notes = direction === 'up' ? [...chord.notes].reverse() : chord.notes;
    const now = audioCtx.currentTime;
    const spread = direction === 'down' ? 0.014 : 0.012;
    notes.forEach((freq, i) => {
      const idx = direction === 'down' ? i : notes.length - 1 - i;
      createStringVoice(freq, now + i * spread, idx);
      pickNoise(now + i * spread, idx);
    });
  }

  function resizeOverlay() {
    const overlay = $('cc-overlay');
    if (!overlay) return null;
    const ctx = overlay.getContext('2d');
    const r = overlay.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(r.width * dpr);
    const h = Math.floor(r.height * dpr);
    if (w !== lastCanvasW || h !== lastCanvasH) {
      lastCanvasW = w;
      lastCanvasH = h;
      overlay.width = w;
      overlay.height = h;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    return { overlay, ctx, w: overlay.clientWidth, h: overlay.clientHeight };
  }

  function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function palmSize(lm) { return Math.max(distance(lm[0], lm[9]), 0.0001); }
  function getCenter(lm) {
    const sum = lm.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: sum.x / lm.length, y: sum.y / lm.length };
  }
  function mirror(p) { return { x: 1 - p.x, y: p.y, z: p.z || 0 }; }
  function displayCenter(lm) {
    const c = getCenter(lm);
    return { x: 1 - c.x, y: c.y };
  }

  function fingerState(lm) {
    const scale = palmSize(lm);
    const wrist = lm[0];
    const thumbOpen = distance(lm[4], lm[17]) / scale > 1.05 && distance(lm[4], lm[9]) / scale > 0.92;
    const indexOpen = distance(lm[8], wrist) > distance(lm[6], wrist) * 1.10 && distance(lm[8], lm[5]) / scale > 0.72;
    const middleOpen = distance(lm[12], wrist) > distance(lm[10], wrist) * 1.10 && distance(lm[12], lm[9]) / scale > 0.72;
    const ringOpen = distance(lm[16], wrist) > distance(lm[14], wrist) * 1.08 && distance(lm[16], lm[13]) / scale > 0.68;
    const pinkyOpen = distance(lm[20], wrist) > distance(lm[18], wrist) * 1.08 && distance(lm[20], lm[17]) / scale > 0.66;
    const openCount = [thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen].filter(Boolean).length;
    return { thumbOpen, indexOpen, middleOpen, ringOpen, pinkyOpen, openCount };
  }

  function classifyGesture(lm) {
    const f = fingerState(lm);
    if (f.openCount === 0) return 'fist';
    if (f.openCount >= 5) return 'open';
    if (f.indexOpen && !f.middleOpen && !f.ringOpen && !f.pinkyOpen) return 'index';
    if (f.indexOpen && f.middleOpen && !f.ringOpen && !f.pinkyOpen) return 'peace';
    if (f.indexOpen && f.middleOpen && f.ringOpen && !f.pinkyOpen) return 'three';
    if (f.indexOpen && f.middleOpen && f.ringOpen && f.pinkyOpen) return 'four';
    if (f.openCount <= 1) return 'index';
    if (f.openCount === 2) return 'peace';
    if (f.openCount === 3) return 'three';
    if (f.openCount === 4) return 'four';
    return 'open';
  }

  function smoothGesture(g) {
    gestureBuffer.push(g);
    if (gestureBuffer.length > 9) gestureBuffer.shift();
    const counts = {};
    for (const x of gestureBuffer) counts[x] = (counts[x] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }

  function setChord(chord) {
    currentChord = chord.name;
    $('cc-chord-name').textContent = chord.name;
    $('cc-chord-hint').textContent = `${chord.hint} = ${chord.name}`;
    if (lastChord !== chord.name) {
      lastChord = chord.name;
      showToast('CHORD ' + chord.name);
    }
    for (const c of chords) {
      const el = $('cc-map-' + c.name.replace(/[^a-zA-Z0-9]/g, '_'));
      if (el) el.classList.toggle('on', c.name === chord.name);
    }
  }

  function updateChord(lm) {
    const gesture = smoothGesture(classifyGesture(lm));
    setChord(chords.find(c => c.gesture === gesture) || chords[0]);
  }

  function clearStrum() {
    lastTip = null;
    lastTipTime = 0;
    lastClearSide = null;
    strumHistory = [];
  }

  function getStrumPoint(lm) {
    const tip = mirror(lm[8]);
    strumHistory.push(tip);
    if (strumHistory.length > 2) strumHistory.shift();
    return {
      x: strumHistory.reduce((sum, p) => sum + p.x, 0) / strumHistory.length,
      y: strumHistory.reduce((sum, p) => sum + p.y, 0) / strumHistory.length
    };
  }

  function updateStrum(lm) {
    const f = fingerState(lm);
    const gate = f.openCount > 0;
    $('cc-gate-pill')?.classList.toggle('blue', gate);
    if (!gate) {
      $('cc-strum-dir').textContent = 'RETURN SILENT';
      clearStrum();
      return;
    }

    const p = getStrumPoint(lm);
    if (p.x < 0.52) {
      clearStrum();
      return;
    }

    const now = performance.now();
    if (!lastTip) {
      lastTip = p;
      lastTipTime = now;
      return;
    }

    const dt = Math.max(8, now - lastTipTime);
    const speed = (p.y - lastTip.y) / dt * 16.67;
    let direction = null;
    const nearBand = Math.abs(p.y - STRUM_LINE_Y) < STRUM_ZONE_HALF;
    if (nearBand && Math.abs(speed) > VELOCITY_TRIGGER) {
      direction = speed > 0 ? 'down' : 'up';
    }

    const side = p.y < STRUM_LINE_Y - CROSS_HYST ? 'above' : p.y > STRUM_LINE_Y + CROSS_HYST ? 'below' : 'near';
    if (!lastClearSide && side !== 'near') lastClearSide = side;
    if (side !== 'near' && lastClearSide && side !== lastClearSide) {
      direction = lastClearSide === 'above' && side === 'below' ? 'down' : 'up';
      lastClearSide = side;
    } else if (side !== 'near') {
      lastClearSide = side;
    }

    if (direction && now - lastPlayedAt >= STRUM_COOLDOWN) {
      playChord(direction);
      $('cc-strum-dir').textContent = direction.toUpperCase();
      $('cc-down-pill')?.classList.toggle('on', direction === 'down');
      $('cc-up-pill')?.classList.toggle('on', direction === 'up');
    }

    lastTip = p;
    lastTipTime = now;
  }

  function drawZones(ctx, w, h) {
    ctx.fillStyle = 'rgba(212,175,55,.045)';
    ctx.fillRect(0, 0, w / 2, h);
    ctx.fillStyle = 'rgba(0,207,255,.045)';
    ctx.fillRect(w / 2, 0, w / 2, h);
    ctx.strokeStyle = 'rgba(212,175,55,.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,191,0,.95)';
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(w * .54, h * STRUM_LINE_Y);
    ctx.lineTo(w * .95, h * STRUM_LINE_Y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,191,0,.08)';
    ctx.fillRect(w * .54, h * (STRUM_LINE_Y - STRUM_ZONE_HALF), w * .41, h * STRUM_ZONE_HALF * 2);
  }

  function drawHand(ctx, lm, color, label, w, h) {
    const con = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[17,18],[18,19],[19,20],[0,17]];
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 3;
    for (const [a, b] of con) {
      ctx.beginPath();
      ctx.moveTo(lm[a].x * w, lm[a].y * h);
      ctx.lineTo(lm[b].x * w, lm[b].y * h);
      ctx.stroke();
    }
    for (let i = 0; i < lm.length; i++) {
      ctx.beginPath();
      ctx.arc(lm[i].x * w, lm[i].y * h, i === 8 ? 7 : i === 0 ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
    }
    const c = getCenter(lm);
    ctx.shadowBlur = 0;
    ctx.font = '900 13px Cinzel, serif';
    ctx.fillStyle = 'rgba(255,255,255,.95)';
    ctx.fillText(label, c.x * w - 34, c.y * h - 38);
    ctx.restore();
  }

  function drawStrumDot(ctx, lm, w, h) {
    const p = mirror(lm[8]);
    ctx.save();
    ctx.fillStyle = 'rgba(255,191,0,.98)';
    ctx.shadowColor = 'rgba(255,191,0,.9)';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function onFaceResults(results) {
    faceSeen = !!(results.multiFaceLandmarks && results.multiFaceLandmarks.length);
    if (!faceSeen) {
      mouthWasOpen = false;
      $('cc-mouth-pill')?.classList.remove('red');
      return;
    }

    const lm = results.multiFaceLandmarks[0];
    const top = lm[13];
    const bottom = lm[14];
    const left = lm[61];
    const right = lm[291];
    const open = Math.hypot(top.x - bottom.x, top.y - bottom.y);
    const width = Math.max(Math.hypot(left.x - right.x, left.y - right.y), 0.0001);
    const isOpen = open / width > MOUTH_OPEN_RATIO;
    $('cc-mouth-pill')?.classList.toggle('red', isOpen);

    const now = performance.now();
    if (isOpen && !mouthWasOpen && now - lastMouthDrumAt > MOUTH_DRUM_COOLDOWN) {
      lastMouthDrumAt = now;
      playDrum('mouth');
      showToast('MOUTH DRUM');
    }
    mouthWasOpen = isOpen;
  }

  function onResults(results) {
    const canvas = resizeOverlay();
    if (!canvas) return;
    const { ctx, w, h } = canvas;
    ctx.clearRect(0, 0, w, h);
    drawZones(ctx, w, h);

    const list = [];
    if (results.multiHandLandmarks) {
      for (const lm of results.multiHandLandmarks) list.push({ lm, dc: displayCenter(lm) });
    }
    $('cc-tracking-text').textContent = `${list.length} มือ · ${faceSeen ? 1 : 0} หน้า`;

    let chordHand = null;
    let strumHand = null;
    for (const hand of list) {
      if (hand.dc.x < 0.5) chordHand = hand;
      else strumHand = hand;
    }

    if (chordHand) {
      drawHand(ctx, chordHand.lm.map(mirror), 'rgba(212,175,55,.98)', 'CHORD', w, h);
      updateChord(chordHand.lm);
    }
    if (strumHand) {
      drawHand(ctx, strumHand.lm.map(mirror), 'rgba(0,207,255,.98)', 'STRUM', w, h);
      drawStrumDot(ctx, strumHand.lm, w, h);
      updateStrum(strumHand.lm);
    } else {
      clearStrum();
    }

    $('cc-chord-hand-pill')?.classList.toggle('on', !!chordHand);
    $('cc-strum-hand-pill')?.classList.toggle('blue', !!strumHand);
    if (!list.length) {
      $('cc-tips').innerHTML = '<strong>ยังไม่เห็นมือ:</strong> เพิ่มแสง และให้มืออยู่ในเฟรมชัด ๆ';
    } else if (!chordHand || !strumHand) {
      $('cc-tips').innerHTML = '<strong>เห็นมือแล้ว:</strong> ซ้ายจอจับคอร์ด ขวาจอดีด ตอนยกมือกลับให้หุบนิ้ว';
    } else {
      $('cc-tips').innerHTML = '<strong>พร้อมเล่น:</strong> ชูนิ้วตอนดีดลง/ขึ้น · หุบนิ้วตอนยกมือกลับ · อ้าปากหนึ่งครั้ง = กลอง';
    }
  }

  function renderChordMap() {
    const map = $('cc-chord-map');
    if (!map) return;
    map.innerHTML = '';
    for (const chord of chords) {
      const pill = document.createElement('span');
      pill.id = 'cc-map-' + chord.name.replace(/[^a-zA-Z0-9]/g, '_');
      pill.className = 'cc-pill';
      pill.textContent = `${chord.name}: ${chord.hint}`;
      map.appendChild(pill);
    }
    $('cc-map-C')?.classList.add('on');
  }

  async function startCamera() {
    const video = $('cc-video');
    const startBtn = $('cc-start-btn');
    if (!video || active) return;
    try {
      ensureAudio();
      await audioCtx.resume();
      startBtn.textContent = 'กำลังเปิดกล้อง...';
      startBtn.disabled = true;

      if (typeof Hands === 'undefined' || typeof Camera === 'undefined') {
        throw new Error('MediaPipe Hands is not ready');
      }

      hands = new Hands({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}` });
      hands.setOptions({ maxNumHands: 2, modelComplexity: 0, minDetectionConfidence: 0.66, minTrackingConfidence: 0.58 });
      hands.onResults(onResults);

      if (typeof FaceMesh !== 'undefined') {
        faceMesh = new FaceMesh({ locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}` });
        faceMesh.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.55, minTrackingConfidence: 0.52 });
        faceMesh.onResults(onFaceResults);
      }

      camera = new Camera(video, {
        onFrame: async () => {
          if (hands) await hands.send({ image: video });
          if (faceMesh) await faceMesh.send({ image: video });
        },
        width: 640,
        height: 480,
        facingMode: 'user'
      });
      await camera.start();
      active = true;
      video.classList.remove('hidden');
      startBtn.textContent = 'กำลังเล่นอยู่';
      showToast('READY TO STRUM');
    } catch (err) {
      console.error(err);
      startBtn.disabled = false;
      startBtn.textContent = '◆ เปิดกล้อง / เริ่มเล่น ◆';
      showToast('CAMERA ERROR');
      $('cc-tips').innerHTML = '<strong>เปิดกล้องไม่ได้:</strong> ใช้ localhost/https และอนุญาตกล้อง';
    }
  }

  function bindEvents() {
    if (initialized) return;
    initialized = true;
    renderChordMap();
    resizeOverlay();

    $('cc-start-btn')?.addEventListener('click', startCamera);
    $('cc-mute-btn')?.addEventListener('click', () => {
      muted = !muted;
      $('cc-mute-btn').textContent = `เสียง: ${muted ? 'ปิด' : 'เปิด'}`;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.95, audioCtx.currentTime, 0.03);
    });
    $('cc-tone-select')?.addEventListener('change', e => showToast(e.target.options[e.target.selectedIndex].text));
    $('cc-panic-btn')?.addEventListener('click', stopAllVoices);
    $('cc-demo-btn')?.addEventListener('click', () => {
      ensureAudio();
      audioCtx.resume?.();
      playChord('down');
      setTimeout(() => playDrum('demo'), 130);
      showToast('DEMO SOUND');
    });

    window.addEventListener('resize', resizeOverlay);
    window.addEventListener('keydown', e => {
      if (typeof App !== 'undefined' && App.currentMenu !== 'camera') return;
      if (e.repeat) return;
      const n = Number(e.key);
      if (n >= 1 && n <= chords.length) setChord(chords[n - 1]);
      if (e.code === 'Space') {
        e.preventDefault();
        playChord('down');
      }
      if (e.key === 'ArrowDown') playChord('down');
      if (e.key === 'ArrowUp') playChord('up');
      if (e.key.toLowerCase() === 'm') playDrum('mouth');
      if (e.key === 'Escape') stopAllVoices();
    });

    const overlay = $('cc-overlay');
    overlay?.addEventListener('pointerdown', e => {
      ensureAudio();
      audioCtx.resume?.();
      const r = overlay.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      if (x >= 0.5) mouseStrum = { y, t: performance.now() };
    });
    overlay?.addEventListener('pointermove', e => {
      if (!mouseStrum) return;
      const r = overlay.getBoundingClientRect();
      const y = (e.clientY - r.top) / r.height;
      const now = performance.now();
      const dy = y - mouseStrum.y;
      if (Math.abs(dy) > 0.065 && now - lastPlayedAt >= STRUM_COOLDOWN) {
        const dir = dy > 0 ? 'down' : 'up';
        playChord(dir);
        $('cc-strum-dir').textContent = dir.toUpperCase();
        $('cc-down-pill')?.classList.toggle('on', dir === 'down');
        $('cc-up-pill')?.classList.toggle('on', dir === 'up');
        mouseStrum = { y, t: now };
      }
    });
    window.addEventListener('pointerup', () => { mouseStrum = null; });
  }

  window.addEventListener('load', bindEvents);

  return {
    startCamera,
    stopCamera() {
      stopAllVoices();
      if (camera?.stop) camera.stop();
      const video = $('cc-video');
      if (video?.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
      active = false;
      $('cc-start-btn').disabled = false;
      $('cc-start-btn').textContent = '◆ เปิดกล้อง / เริ่มเล่น ◆';
      showToast('CAMERA STOPPED');
    }
  };
})();
