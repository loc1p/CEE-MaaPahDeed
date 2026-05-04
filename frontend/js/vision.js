const Vision = (() => {
  const $ = id => document.getElementById(id);

  const chords = [
    { name: 'C', gesture: 'index', hint: 'Point one finger', notes: [130.81, 164.81, 196.00, 261.63, 329.63] },
    { name: 'G', gesture: 'peace', hint: 'Make a V sign', notes: [98.00, 123.47, 146.83, 196.00, 246.94, 392.00] },
    { name: 'Dm', gesture: 'three', hint: 'Raise three fingers', notes: [146.83, 220.00, 293.66, 349.23] },
    { name: 'Am', gesture: 'four', hint: 'Raise four fingers', notes: [110.00, 164.81, 220.00, 261.63, 329.63] },
    { name: 'Em', gesture: 'fist', hint: 'Make a fist', notes: [82.41, 123.47, 164.81, 196.00, 246.94, 329.63] },
    { name: 'F', gesture: 'open', hint: 'Open your hand', notes: [87.31, 130.81, 174.61, 220.00, 261.63, 349.23] }
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
  let drumRoom = null;
  let drumRoomWet = null;
  let drumSampleBuffer = null;
  let drumSamplePromise = null;
  let activeDrumSample = null;
  let domainAudio = null;
  let domainSegmentIndex = 0;
  let domainStopTimer = null;
  let cp52Audio = null;
  let cp52StopTimer = null;
  let cp52FadeFrame = null;
  let cp52Active = false;
  let smileWasActive = false;
  let lastSmileAt = 0;
  let smileHoldFrames = 0;
  let maphadeedMode = false;
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
  let danceMode = false;
  let danceAutoHideTimer = null;
  let blinkWasClosed = false;
  let lastBlinkAt = 0;
  let eyeOpenBaseline = 0.27;
  let eyeOpenReady = false;

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
  const DOG_DROP_COUNT = 12;
  const DRUM_SAMPLE_URL = 'audio/drum-beat-100bpm.mp3';
  const DRUM_SAMPLE_START = 5;
  const DRUM_SAMPLE_END = 15;
  const DOG_COLORS = ['green', 'yellow', 'blue', 'pink', 'yellow', 'red'];
  const DOMAIN_SOUND_URL = 'audio/leat-eq-tokyo.mp3';
  const DOMAIN_SOUND_SEGMENTS = [[31, 34], [92, 96]];
  const DANCE_VISIBLE_MS = 5000;
  const CP52_SOUND_URL = 'audio/cp52-wink.mp3';
  const CP52_TYPE_SPEED = 76;
  const CP52_END_DELAY = 3000;
  const CP52_FADE_DURATION = 2200;
  const CP52_VOLUME = 0.95;
  const SMILE_COOLDOWN = 1800;
  const SMILE_RATIO = 2.7;
  const SMILE_HOLD_FRAMES = 12;
  const CP52_INTRO_TEXT = 'ขอบคุณอาจารย์ทุกท่านที่มอบทั้งความรู้ เวลา และความเชื่อมั่นให้พวกเราได้กล้าลองผิดลองถูก จนความคิดเล็ก ๆ ค่อย ๆ กลายเป็นผลงานชิ้นนี้ ขอบคุณที่เปิดพื้นที่ให้เสียง ดนตรี ภาพ และเทคโนโลยีได้มาพบกันอย่างมีความหมาย ทุกบรรทัดของโค้ด ทุกจังหวะที่เกิดขึ้นบนหน้าจอ และทุกความสนุกที่เราได้สร้าง ล้วนมีรากมาจากแรงบันดาลใจและคำแนะนำของอาจารย์ หากไม่มีการสนับสนุนเหล่านี้ สิ่งนี้คงเป็นเพียงไอเดียที่ยังไม่กล้าเริ่ม วันนี้พวกเราขอมอบโปรเจกต์นี้เป็นคำขอบคุณจากใจ เป็นหลักฐานเล็ก ๆ ว่าการเรียนรู้ที่ดีสามารถทำให้คนธรรมดากล้าสร้างสิ่งที่มีชีวิตขึ้นมาได้จริง\n\nคณะผู้จัดทำ\nกลุ่ม Les King Southern Thailand\nSupphanat Thanaphon\nWiramorn Ounruan\nPrompassorn Piriyavinit';
  const BLINK_CLOSED_RATIO = 0.23;
  const BLINK_COOLDOWN = 950;

  function createRoomImpulse(seconds = 0.62, decay = 3.2) {
    const len = Math.max(1, Math.floor(audioCtx.sampleRate * seconds));
    const impulse = audioCtx.createBuffer(2, len, audioCtx.sampleRate);
    for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const early = i < audioCtx.sampleRate * 0.035 ? 1.35 : 1;
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early;
      }
    }
    return impulse;
  }

  function showToast(message) {
    const toast = $('cc-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 1500);
  }

  function playDomainSound() {
    if (muted) return;
    if (!domainAudio) {
      domainAudio = new Audio(DOMAIN_SOUND_URL);
      domainAudio.preload = 'auto';
      domainAudio.volume = 0.95;
    }
    const [start, end] = DOMAIN_SOUND_SEGMENTS[domainSegmentIndex % DOMAIN_SOUND_SEGMENTS.length];
    domainSegmentIndex += 1;
    try {
      clearTimeout(domainStopTimer);
      domainAudio.pause();
      domainAudio.currentTime = start;
      domainAudio.play().catch(err => console.warn('Domain sound failed:', err));
      domainStopTimer = setTimeout(() => {
        domainAudio.pause();
        domainAudio.currentTime = start;
      }, Math.max(80, (end - start) * 1000));
    } catch (err) {
      console.warn('Domain sound failed:', err);
    }
  }

  function playCp52Sound() {
    if (muted) return;
    if (!cp52Audio) {
      cp52Audio = new Audio(CP52_SOUND_URL);
      cp52Audio.preload = 'auto';
      cp52Audio.volume = CP52_VOLUME;
    }
    try {
      clearTimeout(cp52StopTimer);
      cancelAnimationFrame(cp52FadeFrame);
      cp52Audio.pause();
      cp52Audio.currentTime = 0;
      cp52Audio.volume = CP52_VOLUME;
      cp52Audio.play().catch(err => console.warn('CP52 sound failed:', err));
      cp52Audio.onended = () => endCp52Effect();
    } catch (err) {
      console.warn('CP52 sound failed:', err);
    }
  }

  function fadeOutCp52Sound() {
    if (!cp52Audio) {
      endCp52Effect();
      return;
    }
    const startedAt = performance.now();
    const startVolume = cp52Audio.volume;
    cancelAnimationFrame(cp52FadeFrame);
    const tick = now => {
      const progress = Math.min(1, (now - startedAt) / CP52_FADE_DURATION);
      cp52Audio.volume = startVolume * (1 - progress);
      if (progress < 1) {
        cp52FadeFrame = requestAnimationFrame(tick);
        return;
      }
      cp52Audio.pause();
      cp52Audio.currentTime = 0;
      cp52Audio.volume = CP52_VOLUME;
      endCp52Effect();
    };
    cp52FadeFrame = requestAnimationFrame(tick);
  }

  function loadDrumSample() {
    ensureAudio();
    if (drumSampleBuffer) return Promise.resolve(drumSampleBuffer);
    if (drumSamplePromise) return drumSamplePromise;
    drumSamplePromise = fetch(DRUM_SAMPLE_URL)
      .then(res => {
        if (!res.ok) throw new Error(`Could not load ${DRUM_SAMPLE_URL}`);
        return res.arrayBuffer();
      })
      .then(data => audioCtx.decodeAudioData(data))
      .then(buffer => {
        drumSampleBuffer = buffer;
        return buffer;
      })
      .catch(err => {
        drumSamplePromise = null;
        throw err;
      });
    return drumSamplePromise;
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
    drumRoom = audioCtx.createConvolver();
    drumRoom.buffer = createRoomImpulse();
    drumRoomWet = audioCtx.createGain();
    drumRoomWet.gain.value = 0.22;

    dryBus.connect(compressor);
    delay.connect(delayFeedback);
    delayFeedback.connect(delay);
    delay.connect(delayWet);
    delayWet.connect(compressor);
    drumRoom.connect(drumRoomWet);
    drumRoomWet.connect(compressor);
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

  function connectDrum(node, roomLevel = 0.32) {
    const roomSend = audioCtx.createGain();
    roomSend.gain.value = roomLevel;
    node.connect(compressor);
    node.connect(roomSend);
    roomSend.connect(drumRoom);
  }

  function playKick(start, level = 0.78) {
    const body = audioCtx.createOscillator();
    const bodyGain = audioCtx.createGain();
    const bodyOut = audioCtx.createBiquadFilter();
    body.type = 'sine';
    body.frequency.setValueAtTime(92, start);
    body.frequency.exponentialRampToValueAtTime(48, start + 0.12);
    bodyGain.gain.setValueAtTime(0.0001, start);
    bodyGain.gain.exponentialRampToValueAtTime(level, start + 0.005);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    bodyOut.type = 'lowpass';
    bodyOut.frequency.value = 210;
    body.connect(bodyGain);
    bodyGain.connect(bodyOut);
    connectDrum(bodyOut, 0.18);
    body.start(start);
    body.stop(start + 0.38);

    const click = noiseBurst(0.028);
    const clickHp = audioCtx.createBiquadFilter();
    const clickGain = audioCtx.createGain();
    clickHp.type = 'bandpass';
    clickHp.frequency.value = 2600;
    clickHp.Q.value = 1.8;
    clickGain.gain.setValueAtTime(0.0001, start);
    clickGain.gain.exponentialRampToValueAtTime(level * 0.12, start + 0.002);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.024);
    click.connect(clickHp);
    clickHp.connect(clickGain);
    connectDrum(clickGain, 0.12);
    click.start(start);
    click.stop(start + 0.03);
  }

  function playSnare(start, level = 0.28) {
    const shell = audioCtx.createOscillator();
    const shellGain = audioCtx.createGain();
    const shellFilter = audioCtx.createBiquadFilter();
    shell.type = 'triangle';
    shell.frequency.setValueAtTime(185, start);
    shell.frequency.exponentialRampToValueAtTime(148, start + 0.08);
    shellGain.gain.setValueAtTime(0.0001, start);
    shellGain.gain.exponentialRampToValueAtTime(level * 0.62, start + 0.004);
    shellGain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    shellFilter.type = 'bandpass';
    shellFilter.frequency.value = 240;
    shellFilter.Q.value = 1.1;
    shell.connect(shellGain);
    shellGain.connect(shellFilter);
    connectDrum(shellFilter, 0.38);
    shell.start(start);
    shell.stop(start + 0.18);

    const sn = noiseBurst(0.22);
    const bp = audioCtx.createBiquadFilter();
    const hp = audioCtx.createBiquadFilter();
    const sg = audioCtx.createGain();
    bp.type = 'bandpass';
    bp.frequency.value = 2250;
    bp.Q.value = 0.9;
    hp.type = 'highpass';
    hp.frequency.value = 720;
    sg.gain.setValueAtTime(0.0001, start);
    sg.gain.exponentialRampToValueAtTime(level, start + 0.003);
    sg.gain.exponentialRampToValueAtTime(0.0001, start + 0.19);
    sn.connect(bp);
    bp.connect(hp);
    hp.connect(sg);
    connectDrum(sg, 0.48);
    sn.start(start);
    sn.stop(start + 0.22);
  }

  function playHat(start, level = 0.09) {
    const hat = noiseBurst(0.075);
    const hp = audioCtx.createBiquadFilter();
    const peak = audioCtx.createBiquadFilter();
    const hg = audioCtx.createGain();
    hp.type = 'highpass';
    hp.frequency.value = 5200;
    peak.type = 'peaking';
    peak.frequency.value = 9000;
    peak.Q.value = 1.2;
    peak.gain.value = 5;
    hg.gain.setValueAtTime(0.0001, start);
    hg.gain.exponentialRampToValueAtTime(level, start + 0.002);
    hg.gain.exponentialRampToValueAtTime(0.0001, start + 0.065);
    hat.connect(hp);
    hp.connect(peak);
    peak.connect(hg);
    connectDrum(hg, 0.36);
    hat.start(start);
    hat.stop(start + 0.08);
  }

  function playTom(start, freq = 190, level = 0.26) {
    const tom = audioCtx.createOscillator();
    const tg = audioCtx.createGain();
    const tone = audioCtx.createBiquadFilter();
    tom.type = 'sine';
    tom.frequency.setValueAtTime(freq, start);
    tom.frequency.exponentialRampToValueAtTime(freq * 0.52, start + 0.16);
    tg.gain.setValueAtTime(0.0001, start);
    tg.gain.exponentialRampToValueAtTime(level, start + 0.005);
    tg.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
    tone.type = 'lowpass';
    tone.frequency.value = 720;
    tom.connect(tg);
    tg.connect(tone);
    connectDrum(tone, 0.42);
    tom.start(start);
    tom.stop(start + 0.36);
  }

  function playDogDropGroove() {
    ensureAudio();
    if (muted) return;
    const now = audioCtx.currentTime;
    const beat = 0.12;
    playKick(now, 0.72);
    playHat(now + beat * 0.08, 0.06);
    playHat(now + beat * 0.55, 0.04);
    playSnare(now + beat, 0.3);
    playKick(now + beat * 1.55, 0.42);
    playHat(now + beat * 1.75, 0.05);
    playTom(now + beat * 2.15, 182, 0.2);
    playSnare(now + beat * 2.75, 0.34);
    playKick(now + beat * 3.08, 0.58);
    playTom(now + beat * 3.55, 132, 0.28);
    playHat(now + beat * 3.9, 0.045);
  }

  function stopDrumSample(fadeSeconds = 0.18) {
    if (!activeDrumSample || !audioCtx) return;
    const now = audioCtx.currentTime;
    try {
      activeDrumSample.gain.gain.cancelScheduledValues(now);
      activeDrumSample.gain.gain.setValueAtTime(activeDrumSample.gain.gain.value || 0.001, now);
      activeDrumSample.gain.gain.linearRampToValueAtTime(0.0001, now + fadeSeconds);
      activeDrumSample.source.stop(now + fadeSeconds + 0.02);
    } catch (e) {}
    activeDrumSample = null;
  }

  function playRecordedDrumLoop() {
    ensureAudio();
    if (muted) return false;
    if (activeDrumSample && activeDrumSample.stopAt > audioCtx.currentTime + 0.25) {
      return true;
    }
    if (!drumSampleBuffer) {
      loadDrumSample()
        .then(() => {
          if (!muted) playRecordedDrumLoop();
        })
        .catch(err => {
          console.warn('Falling back to generated drums:', err);
          playDogDropGroove();
        });
      showToast('LOADING DRUM LOOP');
      return true;
    }

    stopDrumSample(0.05);
    const now = audioCtx.currentTime;
    const offset = Math.min(DRUM_SAMPLE_START, Math.max(0, drumSampleBuffer.duration - 0.05));
    const end = Math.min(DRUM_SAMPLE_END, drumSampleBuffer.duration);
    const duration = Math.max(0.05, end - offset);
    const source = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    source.buffer = drumSampleBuffer;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.82, now + 0.04);
    gain.gain.setValueAtTime(0.82, now + Math.max(0.05, duration - 0.55));
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    source.connect(gain);
    gain.connect(compressor);
    source.start(now, offset, duration);
    source.stop(now + duration + 0.02);
    activeDrumSample = { source, gain, stopAt: now + duration };
    source.addEventListener('ended', () => {
      if (activeDrumSample?.source === source) activeDrumSample = null;
    });
    return true;
  }

  function clearDogDance() {
    document.querySelectorAll('.cc-dog-drop').forEach(dog => dog.classList.add('cc-dog-exit'));
    setTimeout(() => {
      document.querySelectorAll('.cc-dog-drop.cc-dog-exit').forEach(dog => dog.remove());
    }, 320);
  }

  function triggerDogRain(durationSeconds = DRUM_SAMPLE_END - DRUM_SAMPLE_START) {
    const stage = document.querySelector('.cc-camera-stage');
    if (!stage) return;
    clearDogDance();
    for (let i = 0; i < DOG_DROP_COUNT; i++) {
      const dog = document.createElement('img');
      const size = 48 + Math.random() * 46;
      const direction = Math.random() > 0.5 ? 1 : -1;
      const color = DOG_COLORS[Math.floor(Math.random() * DOG_COLORS.length)];
      dog.src = 'dog.png';
      dog.alt = '';
      dog.className = `cc-dog-drop cc-dog-${color}`;
      dog.style.left = `${4 + Math.random() * 88}%`;
      dog.style.width = `${size}px`;
      dog.style.setProperty('--dog-delay', `${i * 55 + Math.random() * 120}ms`);
      dog.style.setProperty('--dog-duration', `${durationSeconds * 1000}ms`);
      dog.style.setProperty('--dog-y', `${Math.random() * Math.max(80, stage.clientHeight - 160)}px`);
      dog.style.setProperty('--dog-hop', `${24 + Math.random() * 54}px`);
      dog.style.setProperty('--dog-drift', `${(Math.random() * 150 - 75).toFixed(1)}px`);
      dog.style.setProperty('--dog-wobble', `${direction * (22 + Math.random() * 18)}deg`);
      dog.style.setProperty('--dog-spin', `${direction * (18 + Math.random() * 28)}deg`);
      dog.style.setProperty('--dog-scale', `${0.78 + Math.random() * 0.45}`);
      stage.appendChild(dog);
      const cleanup = () => dog.remove();
      dog.addEventListener('animationend', cleanup, { once: true });
      setTimeout(cleanup, durationSeconds * 1000 + 900);
    }
  }

  function triggerPinkSmoke() {
    const stage = document.querySelector('.cc-camera-stage');
    if (!stage) return;
    const smokeLayer = document.createElement('div');
    smokeLayer.className = 'cc-smoke-layer';
    for (let i = 0; i < 34; i++) {
      const puff = document.createElement('span');
      puff.className = 'cc-smoke-puff';
      puff.style.left = `${Math.random() * 100}%`;
      puff.style.top = `${46 + Math.random() * 46}%`;
      puff.style.setProperty('--smoke-size', `${90 + Math.random() * 190}px`);
      puff.style.setProperty('--smoke-x', `${(Math.random() * 360 - 180).toFixed(1)}px`);
      puff.style.setProperty('--smoke-y', `${(-120 - Math.random() * 360).toFixed(1)}px`);
      puff.style.setProperty('--smoke-delay', `${Math.random() * 220}ms`);
      puff.style.setProperty('--smoke-duration', `${1150 + Math.random() * 800}ms`);
      smokeLayer.appendChild(puff);
    }
    stage.appendChild(smokeLayer);
    setTimeout(() => smokeLayer.remove(), 2500);
  }

  function setDanceMode(enabled) {
    danceMode = enabled;
    clearTimeout(danceAutoHideTimer);
    const stage = document.querySelector('.cc-camera-stage');
    if (!stage) return;
    stage.classList.toggle('cc-dance-mode', danceMode);
    const dancers = stage.querySelectorAll('.cc-dance-avatar');
    if (danceMode) {
      if (!dancers.length) {
        const lights = document.createElement('div');
        lights.className = 'cc-rainbow-spotlights';
        lights.innerHTML = '<span></span><span></span><span></span><span></span><span></span>';
        stage.appendChild(lights);
        const slots = ['left', 'center', 'right'];
        for (const slot of slots) {
          const dancer = document.createElement('img');
          dancer.src = 'anime-dance-cutout.webp';
          dancer.alt = '';
          dancer.className = `cc-dance-avatar cc-dance-${slot}`;
          stage.appendChild(dancer);
        }
      }
      stage.querySelectorAll('.cc-dance-avatar').forEach(dancer => {
        dancer.classList.remove('cc-dance-exit');
        dancer.classList.add('cc-dance-enter');
      });
      danceAutoHideTimer = setTimeout(() => setDanceMode(false), DANCE_VISIBLE_MS);
    } else if (dancers.length) {
      dancers.forEach(dancer => {
        dancer.classList.remove('cc-dance-enter');
        dancer.classList.add('cc-dance-exit');
      });
      stage.querySelector('.cc-rainbow-spotlights')?.classList.add('cc-lights-exit');
      setTimeout(() => {
        stage.querySelectorAll('.cc-dance-avatar.cc-dance-exit').forEach(dancer => dancer.remove());
        stage.querySelector('.cc-rainbow-spotlights.cc-lights-exit')?.remove();
      }, 420);
    }
  }

  function triggerDomainSwap() {
    if (!maphadeedMode) return;
    const nextMode = !danceMode;
    if (nextMode) playDomainSound();
    triggerPinkSmoke();
    const stage = document.querySelector('.cc-camera-stage');
    stage?.classList.add('cc-domain-flash');
    setTimeout(() => setDanceMode(nextMode), 420);
    setTimeout(() => stage?.classList.remove('cc-domain-flash'), 1250);
    showToast(nextMode ? 'DOMAIN DANCE' : 'DOMAIN RELEASED');
  }

  function triggerCp52Effect() {
    if (!maphadeedMode) return;
    const stage = document.querySelector('.cc-camera-stage');
    if (!stage || cp52Active) return;
    cp52Active = true;
    stopDrumSample(0.08);
    clearDogDance();
    setDanceMode(false);
    playCp52Sound();
    stage.classList.add('cc-cp52-hit');
    let intro = stage.querySelector('.cc-cp52-intro');
    if (!intro) {
      intro = document.createElement('div');
      intro.className = 'cc-cp52-intro';
      stage.appendChild(intro);
    }
    intro.textContent = '';
    clearInterval(triggerCp52Effect.typeTimer);
    clearTimeout(triggerCp52Effect.fadeTimer);
    let i = 0;
    triggerCp52Effect.typeTimer = setInterval(() => {
      intro.textContent = CP52_INTRO_TEXT.slice(0, i);
      intro.scrollTop = intro.scrollHeight;
      i += 1;
      if (i > CP52_INTRO_TEXT.length) {
        clearInterval(triggerCp52Effect.typeTimer);
        cp52StopTimer = setTimeout(fadeOutCp52Sound, CP52_END_DELAY);
      }
    }, CP52_TYPE_SPEED);
    showToast('CP52');
  }

  function endCp52Effect() {
    cp52Active = false;
    const stage = document.querySelector('.cc-camera-stage');
    if (!stage) return;
    stage.classList.remove('cc-cp52-hit');
    stage.querySelector('.cc-cp52-intro')?.remove();
    clearInterval(triggerCp52Effect.typeTimer);
    clearTimeout(cp52StopTimer);
    cancelAnimationFrame(cp52FadeFrame);
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
    if (cp52Active) return;
    if (muted) return;
    if (kind === 'mouth') {
      if (maphadeedMode) triggerDogRain();
      playRecordedDrumLoop();
      return;
    }
    const now = audioCtx.currentTime;
    playKick(now, 0.45);
    playSnare(now + 0.055, 0.09);
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
    stopDrumSample(0.08);
    clearDogDance();
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
  function eyeOpenRatio(lm, outer, inner, topA, bottomA, topB, bottomB) {
    const width = Math.max(distance(lm[outer], lm[inner]), 0.0001);
    const openA = distance(lm[topA], lm[bottomA]);
    const openB = distance(lm[topB], lm[bottomB]);
    return (openA + openB) / (2 * width);
  }
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
      blinkWasClosed = false;
      smileWasActive = false;
      smileHoldFrames = 0;
      $('cc-mouth-pill')?.classList.remove('red');
      return;
    }

    const lm = results.multiFaceLandmarks[0];
    const now = performance.now();
    const mouthWidth = Math.max(distance(lm[61], lm[291]), 0.0001);
    const mouthOpen = Math.max(distance(lm[13], lm[14]), 0.0001);
    const faceHeight = Math.max(distance(lm[10], lm[152]), 0.0001);
    const mouthCenterY = (lm[13].y + lm[14].y) / 2;
    const mouthCornersUp = ((mouthCenterY - lm[61].y) + (mouthCenterY - lm[291].y)) / 2;
    if (maphadeedMode) {
      const smileRatio = mouthWidth / mouthOpen;
      const smileCandidate = smileRatio > SMILE_RATIO &&
        mouthWidth > faceHeight * 0.32 &&
        mouthOpen > faceHeight * 0.018 &&
        mouthCornersUp > faceHeight * 0.026 &&
        mouthOpen < mouthWidth * 0.34;
      smileHoldFrames = smileCandidate ? Math.min(smileHoldFrames + 1, SMILE_HOLD_FRAMES) : 0;
      const isSmiling = smileHoldFrames >= SMILE_HOLD_FRAMES;
      if (isSmiling && !smileWasActive && now - lastSmileAt > SMILE_COOLDOWN) {
        lastSmileAt = now;
        triggerCp52Effect();
      }
      smileWasActive = isSmiling;
    } else {
      smileHoldFrames = 0;
      smileWasActive = false;
    }

    if (cp52Active) {
      mouthWasOpen = false;
      blinkWasClosed = false;
      return;
    }

    if (maphadeedMode) {
      const leftEye = eyeOpenRatio(lm, 33, 133, 159, 145, 158, 153);
      const rightEye = eyeOpenRatio(lm, 362, 263, 386, 374, 385, 380);
      const eyeOpen = (leftEye + rightEye) / 2;
      if (eyeOpen > BLINK_CLOSED_RATIO + 0.035) {
        eyeOpenReady = true;
        eyeOpenBaseline = eyeOpenBaseline * 0.88 + eyeOpen * 0.12;
      }
      const blinkLimit = Math.max(BLINK_CLOSED_RATIO, eyeOpenBaseline * 0.72);
      const isBlinking = eyeOpenReady && (
        eyeOpen < blinkLimit ||
        (leftEye < blinkLimit && rightEye < blinkLimit * 1.12)
      );
      if (isBlinking && !blinkWasClosed && now - lastBlinkAt > BLINK_COOLDOWN) {
        lastBlinkAt = now;
        triggerDomainSwap();
      }
      blinkWasClosed = isBlinking;
    } else {
      blinkWasClosed = false;
    }

    const top = lm[13];
    const bottom = lm[14];
    const left = lm[61];
    const right = lm[291];
    const open = Math.hypot(top.x - bottom.x, top.y - bottom.y);
    const width = Math.max(Math.hypot(left.x - right.x, left.y - right.y), 0.0001);
    const isOpen = !cp52Active && open / width > MOUTH_OPEN_RATIO;
    $('cc-mouth-pill')?.classList.toggle('red', isOpen);

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
    $('cc-tracking-text').textContent = `${list.length} ${list.length === 1 ? 'hand' : 'hands'} · ${faceSeen ? 1 : 0} ${faceSeen ? 'face' : 'faces'}`;

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
      $('cc-tips').innerHTML = '<strong>No hands detected:</strong> Add more light and keep your hands clearly inside the frame.';
    } else if (!chordHand || !strumHand) {
      $('cc-tips').innerHTML = '<strong>Hand detected:</strong> Use the left side for chords and the right side for strumming. Close your fingers on the return stroke.';
    } else {
      $('cc-tips').innerHTML = '<strong>Ready to play:</strong> Open fingers while strumming down or up · Close fingers on return · Open your mouth once for a drum hit.';
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
      loadDrumSample().catch(err => console.warn('Drum loop preload failed:', err));
      startBtn.textContent = 'Opening Camera...';
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
      startBtn.textContent = 'Playing Now';
      showToast('READY TO STRUM');
    } catch (err) {
      console.error(err);
      startBtn.disabled = false;
      startBtn.textContent = '◆ Open Camera / Start Playing ◆';
      showToast('CAMERA ERROR');
      $('cc-tips').innerHTML = '<strong>Camera unavailable:</strong> Use localhost or HTTPS, then allow camera access.';
    }
  }

  function setCameraMode(mode = 'normal', silent = false) {
    maphadeedMode = mode === 'maphadeed';
    document.querySelectorAll('[data-cc-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.ccMode === mode);
    });
    document.querySelector('.cc-camera-stage')?.classList.toggle('cc-maphadeed-mode', maphadeedMode);
    if ($('cc-mouth-pill')) $('cc-mouth-pill').textContent = maphadeedMode ? 'MOUTH DOG DRUM' : 'MOUTH DRUM';
    if ($('cc-tips')) {
      $('cc-tips').innerHTML = maphadeedMode
        ? '<strong>Maphadeed mode:</strong> Smile = CP52 intro · Blink = dance GIF · Open mouth = dog drum · Strum and chords still work'
        : '<strong>Normal mode:</strong> Play guitar with gestures · Open mouth = drum only · No special visual effects';
    }
    if (!maphadeedMode) {
      clearTimeout(domainStopTimer);
      domainAudio?.pause();
      cp52Audio?.pause();
      endCp52Effect();
      setDanceMode(false);
      clearDogDance();
      smileHoldFrames = 0;
      smileWasActive = false;
      blinkWasClosed = false;
    }
    if (!silent) showToast(maphadeedMode ? 'MAPHADEED MODE' : 'NORMAL MODE');
  }

  function bindEvents() {
    if (initialized) return;
    initialized = true;
    renderChordMap();
    resizeOverlay();

    document.querySelectorAll('[data-cc-mode]').forEach(btn => {
      btn.addEventListener('click', () => setCameraMode(btn.dataset.ccMode));
    });
    setCameraMode('normal', true);
    $('cc-start-btn')?.addEventListener('click', startCamera);
    $('cc-mute-btn')?.addEventListener('click', () => {
      muted = !muted;
      $('cc-mute-btn').textContent = `Sound: ${muted ? 'Off' : 'On'}`;
      if (master) master.gain.setTargetAtTime(muted ? 0 : 0.95, audioCtx.currentTime, 0.03);
      if (muted) {
        clearTimeout(domainStopTimer);
        domainAudio?.pause();
        cp52Audio?.pause();
        endCp52Effect();
        stopDrumSample(0.08);
        clearDogDance();
      }
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
      if (e.key.toLowerCase() === 'b' && maphadeedMode) triggerDomainSwap();
      if (e.key.toLowerCase() === 'c' && maphadeedMode) triggerCp52Effect();
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
      $('cc-start-btn').textContent = '◆ Open Camera / Start Playing ◆';
      showToast('CAMERA STOPPED');
    }
  };
})();
