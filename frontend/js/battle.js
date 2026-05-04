const Battle = {
  noteNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  targets: [
    { name: 'E', freq: 82.41, octave: 2 },
    { name: 'A', freq: 110.00, octave: 2 },
    { name: 'D', freq: 146.83, octave: 3 },
    { name: 'G', freq: 196.00, octave: 3 },
    { name: 'B', freq: 246.94, octave: 3 },
    { name: 'E', freq: 329.63, octave: 4 }
  ],
  monsters: [
    { name: 'Dissonant Wraith', icon: 'Eye', lore: 'A creature woven from unresolved tension.', hp: 5 },
    { name: 'Chromatic Specter', icon: 'Moon', lore: 'It shifts between half-steps, never at rest.', hp: 6 },
    { name: 'Tritone Demon', icon: 'Fire', lore: 'The forbidden interval takes shape.', hp: 7 }
  ],

  target: null,
  score: 0,
  streak: 0,
  monstersDefeated: 0,
  monsterIndex: 0,
  monsterHp: 5,
  monsterMaxHp: 5,
  detectedNotes: [],
  recentPlayedNotes: [],
  songChordTargets: [],
  songChordIndex: 0,
  songChordMeta: null,
  targetChord: null,
  chordRecording: false,

  audioCtx: null,
  analyser: null,
  micSource: null,
  micStream: null,
  timeDomain: null,
  freqData: null,
  pitchDetector: null,
  pitchyReady: false,
  rafId: null,
  matchHeld: 0,
  lastHitAt: 0,
  lastSignalAt: 0,

  async startGameUI() {
    this.hide('battle-mic-err');
    this.hide('battle-start-screen');
    this.show('battle-game');

    try {
      await this.startMic();
      this.start();
    } catch (err) {
      console.error('Microphone error:', err);
      this.show('battle-start-screen');
      this.hide('battle-game');
      this.show('battle-mic-err');
    }
  },

  start() {
    this.score = 0;
    this.streak = 0;
    this.detectedNotes = [];
    this.loadMonster(this.monsterIndex);
    this.nextNote();
    this.buildVisualizer(44);
    this.updateStats();
    this.setFeedback('Play one clear guitar note near the microphone.');

    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = requestAnimationFrame(() => this.tick());
  },

  async startMic() {
    if (this.micStream && this.analyser) return;

    AudioEngine.init();
    this.audioCtx = AudioEngine.ctx;
    if (this.audioCtx.state === 'suspended') await this.audioCtx.resume();

    this.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      },
      video: false
    });

    this.micSource = this.audioCtx.createMediaStreamSource(this.micStream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.05;
    this.timeDomain = new Float32Array(this.analyser.fftSize);
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.micSource.connect(this.analyser);

    await this.loadPitchDetector();
  },

  async loadPitchDetector() {
    if (this.pitchyReady || this.pitchDetector) return;

    try {
      const { PitchDetector } = await import('https://esm.sh/pitchy@4');
      this.pitchDetector = PitchDetector.forFloat32Array(this.analyser.fftSize);
      this.pitchyReady = true;
      this.addLog('Real-time pitch engine loaded.', 'info');
    } catch (err) {
      console.warn('Pitchy unavailable, using fallback detector:', err);
      this.pitchDetector = null;
      this.pitchyReady = false;
      this.addLog('Using fallback pitch detector.', 'info');
    }
  },

  loadMonster(index) {
    const monster = this.monsters[index % this.monsters.length];
    this.monsterIndex = index;
    this.monsterHp = monster.hp;
    this.monsterMaxHp = monster.hp;

    this.setText('m-icon', monster.icon);
    this.setText('m-name', monster.name);
    this.setText('m-lore', monster.lore);
    this.setText('sb-monster', monster.name);
    this.setText('sb-weakness', 'Clean pitch');
  },

  nextNote() {
    if (this.songChordTargets.length) {
      this.nextSongChord();
      return;
    }

    const pick = this.targets[Math.floor(Math.random() * this.targets.length)];
    this.target = pick;
    this.targetChord = null;
    this.matchHeld = 0;

    this.setText('tgt-note', pick.name);
    this.setText('tgt-hz', `${pick.freq.toFixed(2)} Hz - Octave ${pick.octave}`);
    this.setText('det-note', '-');
    this.setText('cents-val', '-- cents');
    this.setNeedle(50);
    this.setFeedback(`Target: play ${pick.name}${pick.octave}.`);
  },

  nextSongChord() {
    const pick = this.songChordTargets[this.songChordIndex % this.songChordTargets.length];
    this.songChordIndex += 1;
    this.target = null;
    this.targetChord = pick;
    this.matchHeld = 0;
    this.recentPlayedNotes = [];

    this.setText('tgt-note', pick.symbol);
    this.setText('tgt-hz', `Play chord tones: ${pick.notes.join(' - ')}`);
    this.setText('det-note', '-');
    this.setText('cents-val', '-- cents');
    this.setNeedle(50);
    this.setFeedback(`Target chord: ${pick.symbol}. Strum or pick its notes clearly.`);
  },

  loadSongChords(chords, meta = {}) {
    this.songChordTargets = chords.filter(chord => chord && chord.symbol && Array.isArray(chord.notes) && chord.notes.length >= 2);
    this.songChordIndex = 0;
    this.songChordMeta = meta;
    this.targetChord = null;
    this.recentPlayedNotes = [];

    this.addLog(`Loaded ${this.songChordTargets.length} chords from ${meta.song || 'song'}.`);
    this.setText('sb-weakness', 'Song chord tones');

    if (this.songChordTargets.length) {
      this.nextSongChord();
    }
  },

  async playTargetNote() {
    if (this.targetChord) {
      await this.playTargetChord();
      return;
    }

    if (!this.target) this.nextNote();
    await this.playGuitarTone(this.target.freq);
  },

  async playTargetChord() {
    if (!this.targetChord) return;

    for (const note of this.targetChord.notes) {
      const freq = this.noteNameToFrequency(note, 4);
      if (freq) await this.playGuitarTone(freq, note);
      await new Promise(resolve => setTimeout(resolve, 180));
    }

    this.setFeedback(`Playing ${this.targetChord.symbol} arpeggio.`);
  },

  async playGuitarTone(freq, label = null) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      this.setFeedback('This browser does not support Web Audio.');
      return;
    }

    if (!this.audioCtx) {
      this.audioCtx = AudioEngine && AudioEngine.ctx ? AudioEngine.ctx : new AudioContextClass();
      if (AudioEngine && !AudioEngine.ctx) AudioEngine.ctx = this.audioCtx;
    }

    const ctx = this.audioCtx;
    if (ctx.state === 'suspended') await ctx.resume();
    if (ctx.state !== 'running') {
      this.setFeedback(`Audio is ${ctx.state}. Click Hear Note again or check browser sound permission.`);
      return;
    }

    const now = ctx.currentTime;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.9, now);
    master.connect(ctx.destination);

    const output = ctx.createGain();
    output.gain.setValueAtTime(0.0001, now);
    output.gain.exponentialRampToValueAtTime(0.55, now + 0.012);
    output.gain.exponentialRampToValueAtTime(0.12, now + 0.55);
    output.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);
    output.connect(master);

    [
      { ratio: 1, type: 'triangle', gain: 0.9 },
      { ratio: 2, type: 'sine', gain: 0.26 },
      { ratio: 3, type: 'sine', gain: 0.1 }
    ].forEach(partial => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = partial.type;
      osc.frequency.setValueAtTime(freq * partial.ratio, now);
      gain.gain.setValueAtTime(partial.gain, now);
      osc.connect(gain).connect(output);
      osc.start(now);
      osc.stop(now + 1.9);
    });

    const targetLabel = label || (this.target ? `${this.target.name}${this.target.octave}` : 'target note');
    this.setFeedback(`Playing ${targetLabel}. If silent, check tab/Windows volume.`);
  },

  tick() {
    if (!this.analyser || (!this.target && !this.targetChord)) return;

    this.analyser.getByteFrequencyData(this.freqData);
    this.updateVisualizer();

    this.analyser.getFloatTimeDomainData(this.timeDomain);
    const level = this.getRms(this.timeDomain);
    const detection = this.detectRealtimePitch(this.timeDomain, this.audioCtx.sampleRate, level);
    const freq = detection.freq;

    if (freq > 50 && freq < 1400) {
      this.handleDetectedFrequency(freq, detection.clarity);
    } else {
      this.setText('det-note', '-');
      this.setText('cents-val', '-- cents');
      this.setNeedle(50);
      this.matchHeld = 0;

      if (level > 0.003) {
        this.lastSignalAt = performance.now();
        this.setFeedback(`Mic hears sound. Pick one string clearly. Level ${level.toFixed(3)}.`);
      } else if (performance.now() - this.lastSignalAt > 1200) {
        this.setFeedback('No guitar signal detected. Check mic input or move closer.');
      }
    }

    this.rafId = requestAnimationFrame(() => this.tick());
  },

  handleDetectedFrequency(freq, clarity = 1) {
    const note = this.frequencyToNote(freq);
    if (this.targetChord) {
      this.handleDetectedChordNote(note, freq, clarity);
      return;
    }

    const targetBase = this.target.name;
    const cents = Math.round(1200 * Math.log2(freq / note.freq));
    const absCents = Math.abs(cents);
    const isMatch = note.name === targetBase && absCents <= 25;

    this.setText('det-note', `${note.name}${note.octave}`);
    this.setText('cents-val', `${cents >= 0 ? '+' : ''}${cents} cents`);
    this.setNeedle(Math.max(0, Math.min(100, 50 + cents / 2)));
    this.rememberDetectedNote(note.name);

    const detected = document.getElementById('det-note');
    if (detected) detected.classList.toggle('matched', isMatch);

    if (isMatch) {
      this.matchHeld += 1;
      this.setFeedback(absCents <= 10 ? `Perfect pitch. Hold it. Clarity ${(clarity * 100).toFixed(0)}%.` : `Good note. Hold steady. Clarity ${(clarity * 100).toFixed(0)}%.`);
      if (this.matchHeld >= 16) this.registerHit(absCents <= 10);
    } else {
      this.matchHeld = 0;
      if (note.name === targetBase) {
        this.setFeedback('Right note, but tune closer to center.');
      } else {
        this.setFeedback(`Detected ${note.name}${note.octave}. Target is ${this.target.name}${this.target.octave}.`);
      }
    }
  },

  handleDetectedChordNote(note, freq, clarity = 1) {
    const targetNotes = this.targetChord.notes;
    const cents = Math.round(1200 * Math.log2(freq / note.freq));
    const absCents = Math.abs(cents);

    this.setText('det-note', `${note.name}${note.octave}`);
    this.setText('cents-val', `${cents >= 0 ? '+' : ''}${cents} cents`);
    this.setNeedle(Math.max(0, Math.min(100, 50 + cents / 2)));
    this.rememberPlayedNote(note.name);

    const played = [...new Set(this.recentPlayedNotes.map(item => item.name))];
    const matched = targetNotes.filter(target => played.includes(target));
    const needed = Math.min(3, targetNotes.length);
    const isTargetTone = targetNotes.includes(note.name) && absCents <= 35;

    const detected = document.getElementById('det-note');
    if (detected) detected.classList.toggle('matched', isTargetTone);

    if (matched.length >= needed) {
      this.matchHeld += 1;
      this.setFeedback(`${this.targetChord.symbol}: ${matched.join(' - ')} found. Hold the chord. Clarity ${(clarity * 100).toFixed(0)}%.`);
      if (this.matchHeld >= 8) this.registerHit(false);
      return;
    }

    this.matchHeld = 0;
    this.setFeedback(`${this.targetChord.symbol} needs ${targetNotes.join(' - ')}. Heard: ${played.join(' - ') || note.name}.`);
  },

  registerHit(perfect) {
    const now = performance.now();
    if (now - this.lastHitAt < 900) return;
    this.lastHitAt = now;

    const points = perfect ? 130 : 100;
    this.score += points;
    this.streak += 1;
    this.monsterHp = Math.max(0, this.monsterHp - 1);
    const targetLabel = this.targetChord ? this.targetChord.symbol : `${this.target.name}${this.target.octave}`;
    this.addLog(`${perfect ? 'Perfect' : 'Hit'} ${targetLabel} +${points}`);

    if (this.monsterHp === 0) {
      this.monstersDefeated += 1;
      this.addLog('Monster defeated.');
      this.loadMonster(this.monsterIndex + 1);
    }

    this.updateStats();
    setTimeout(() => this.nextNote(), 450);
  },

  detectRealtimePitch(buffer, sampleRate, level) {
    if (this.pitchDetector) {
      const [pitch, clarity] = this.pitchDetector.findPitch(buffer, sampleRate);
      if (level > 0.003 && clarity >= 0.62) {
        return { freq: pitch, clarity };
      }
      return { freq: -1, clarity };
    }

    return { freq: this.autoCorrelate(buffer, sampleRate), clarity: 0 };
  },

  autoCorrelate(buffer, sampleRate) {
    const rms = this.getRms(buffer);
    if (rms < 0.002) return -1;

    const size = buffer.length;
    const minTau = Math.floor(sampleRate / 1400);
    const maxTau = Math.min(Math.floor(sampleRate / 50), Math.floor(size / 2));
    const difference = new Float32Array(maxTau + 1);
    const cumulative = new Float32Array(maxTau + 1);

    for (let tau = 1; tau <= maxTau; tau++) {
      let sum = 0;
      for (let i = 0; i < size - tau; i++) {
        const delta = buffer[i] - buffer[i + tau];
        sum += delta * delta;
      }
      difference[tau] = sum;
    }

    cumulative[0] = 1;
    let runningSum = 0;
    for (let tau = 1; tau <= maxTau; tau++) {
      runningSum += difference[tau];
      cumulative[tau] = difference[tau] * tau / (runningSum || 1);
    }

    let tauEstimate = -1;
    const threshold = 0.18;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cumulative[tau] < threshold) {
        while (tau + 1 <= maxTau && cumulative[tau + 1] < cumulative[tau]) tau++;
        tauEstimate = tau;
        break;
      }
    }

    if (tauEstimate === -1) {
      let bestTau = -1;
      let bestValue = 1;
      for (let tau = minTau; tau <= maxTau; tau++) {
        if (cumulative[tau] < bestValue) {
          bestValue = cumulative[tau];
          bestTau = tau;
        }
      }
      if (bestTau === -1 || bestValue > 0.35) return -1;
      tauEstimate = bestTau;
    }

    const betterTau = this.parabolicTau(cumulative, tauEstimate);
    return sampleRate / betterTau;
  },

  parabolicTau(values, tau) {
    const prev = values[tau - 1] ?? values[tau];
    const curr = values[tau];
    const next = values[tau + 1] ?? values[tau];
    const denom = 2 * (2 * curr - next - prev);
    if (!denom) return tau;
    const shift = (next - prev) / denom;
    return tau + (Number.isFinite(shift) ? shift : 0);
  },

  frequencyToNote(freq) {
    const midi = Math.round(69 + 12 * Math.log2(freq / 440));
    const name = this.noteNames[((midi % 12) + 12) % 12];
    const octave = Math.floor(midi / 12) - 1;
    const noteFreq = 440 * Math.pow(2, (midi - 69) / 12);
    return { midi, name, octave, freq: noteFreq };
  },

  noteNameToFrequency(name, octave = 4) {
    const idx = this.noteNames.indexOf(String(name || '').toUpperCase());
    if (idx === -1) return null;

    const midi = (octave + 1) * 12 + idx;
    return 440 * Math.pow(2, (midi - 69) / 12);
  },

  getRms(buffer) {
    let sum = 0;
    for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
    return Math.sqrt(sum / buffer.length);
  },

  buildVisualizer(count) {
    const wrap = document.getElementById('battle-viz');
    if (!wrap || wrap.children.length) return;

    for (let i = 0; i < count; i++) {
      const bar = document.createElement('div');
      bar.className = 'vbar';
      wrap.appendChild(bar);
    }
  },

  updateVisualizer() {
    const bars = document.querySelectorAll('#battle-viz .vbar');
    if (!bars.length) return;

    const step = Math.max(1, Math.floor(this.freqData.length / bars.length));
    bars.forEach((bar, index) => {
      const value = this.freqData[index * step] || 0;
      bar.style.height = `${Math.max(4, value * 0.45)}px`;
      bar.style.opacity = String(value / 255 * 0.7 + 0.2);
    });
  },

  rememberDetectedNote(noteName) {
    if (!this.chordRecording) return;

    const now = performance.now();
    const recent = this.detectedNotes[this.detectedNotes.length - 1];
    if (recent && recent.name === noteName && now - recent.time < 450) return;

    this.detectedNotes.push({ name: noteName, time: now });
    this.detectedNotes = this.detectedNotes.filter(item => now - item.time < 8000).slice(-12);
  },

  rememberPlayedNote(noteName) {
    const now = performance.now();
    const recent = this.recentPlayedNotes[this.recentPlayedNotes.length - 1];
    if (recent && recent.name === noteName && now - recent.time < 250) return;

    this.recentPlayedNotes.push({ name: noteName, time: now });
    this.recentPlayedNotes = this.recentPlayedNotes.filter(item => now - item.time < 4500).slice(-16);
  },

  async recordAndAnalyzeChord() {
    const result = document.getElementById('chord-analysis');
    if (!result) return;

    if (!this.micStream || !this.analyser) {
      result.classList.remove('hidden');
      result.innerHTML = '<div class="chord-analysis-title">Start Battle first</div><div class="chord-analysis-meta">Click BEGIN THE QUEST, allow microphone access, then record a chord.</div>';
      return;
    }

    this.detectedNotes = [];
    this.chordRecording = true;
    result.classList.remove('hidden');
    result.innerHTML = '<div class="chord-analysis-title">Recording full chord...</div><div class="chord-analysis-meta">Strum the full chord clearly for 3 seconds.</div>';
    this.setFeedback('Recording full chord audio for Gemini. Strum once or twice clearly.');

    try {
      const recording = await this.recordChordAudio(3000);
      this.chordRecording = false;
      await this.analyzeChordAudio(recording);
    } catch (err) {
      console.error('Chord recording error:', err);
      this.chordRecording = false;
      result.innerHTML = '<div class="chord-analysis-title">Recording failed</div><div class="chord-analysis-meta">Check microphone permission and try again.</div>';
    }
  },

  recordChordAudio(durationMs) {
    return new Promise((resolve, reject) => {
      if (!window.MediaRecorder) {
        reject(new Error('MediaRecorder unsupported'));
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(this.micStream, { mimeType });
      const chunks = [];

      recorder.ondataavailable = event => {
        if (event.data && event.data.size) chunks.push(event.data);
      };
      recorder.onerror = event => reject(event.error || new Error('MediaRecorder error'));
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: mimeType });
        const audioBase64 = await this.blobToBase64(blob);
        resolve({ audioBase64, mimeType });
      };

      recorder.start();
      setTimeout(() => {
        if (recorder.state !== 'inactive') recorder.stop();
      }, durationMs);
    });
  },

  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  },

  async analyzeChordAudio(recording) {
    const result = document.getElementById('chord-analysis');
    const noteHints = [...new Set(this.detectedNotes.map(item => item.name))];

    result.innerHTML = '<div class="chord-analysis-title">AI analyzing audio...</div><div class="chord-analysis-meta">Sending full chord recording to Gemini.</div>';

    try {
      const apiBase = typeof App !== 'undefined' ? App.baseUrl : `${location.origin}/api`;
      const res = await fetch(`${apiBase}/chords/analyze-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...recording, noteHints })
      });
      const data = await this.readJsonResponse(res);

      if (!res.ok) throw new Error(data.aiError || data.error || 'Audio analysis failed');

      const ai = data.ai || {};
      result.innerHTML = `
        <div class="chord-analysis-title">${this.escapeHtml(ai.chord || 'unclear')} <span>${this.escapeHtml(String(ai.confidence || '--'))}%</span></div>
        <div class="chord-analysis-meta">AI: ${this.escapeHtml(ai.feedback || 'No feedback returned.')}</div>
        <div class="chord-analysis-meta">Notes: ${this.escapeHtml(Array.isArray(ai.notes) ? ai.notes.join(' - ') : ai.notes || 'unknown')}</div>
        <div class="chord-analysis-meta">Tip: ${this.escapeHtml(ai.practiceTip || 'Strum slowly and let the chord ring.')}</div>
        <div class="chord-analysis-meta">Source: ${this.escapeHtml(data.source)}</div>
      `;
    } catch (err) {
      console.error('Audio chord analysis error:', err);
      result.innerHTML = `<div class="chord-analysis-title">AI audio analysis unavailable</div><div class="chord-analysis-meta">${this.escapeHtml(err.message)}</div>`;
    }
  },

  async analyzeChord() {
    const result = document.getElementById('chord-analysis');
    if (!result) return;

    const notes = [...new Set(this.detectedNotes.map(item => item.name))];
    result.classList.remove('hidden');

    if (notes.length < 2) {
      result.innerHTML = '<div class="chord-analysis-title">Play 2-4 clear notes first</div><div class="chord-analysis-meta">Pick each string in the chord slowly, then press Analyze Chord.</div>';
      return;
    }

    result.innerHTML = `<div class="chord-analysis-title">Analyzing ${notes.join(' - ')}...</div>`;

    try {
      const apiBase = typeof App !== 'undefined' ? App.baseUrl : `${location.origin}/api`;
      const res = await fetch(`${apiBase}/chords/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });
      const data = await this.readJsonResponse(res);

      if (!res.ok) throw new Error(data.error || 'Chord analysis failed');

      if (!data.matches || data.matches.length === 0) {
        result.innerHTML = `<div class="chord-analysis-title">No chord match</div><div class="chord-analysis-meta">Detected notes: ${this.escapeHtml(data.inputNotes.join(' - '))}</div>`;
        return;
      }

      const best = data.matches[0];
      const image = best.image ? `<img class="chord-analysis-img" src="${best.image}" alt="${this.escapeHtml(best.name)} chord diagram">` : '';
      const aiBlock = data.ai ? `
        <div class="chord-analysis-ai">
          <div class="chord-analysis-meta">AI: ${this.escapeHtml(data.ai.feedback || '')}</div>
          <div class="chord-analysis-meta">Tip: ${this.escapeHtml(data.ai.practiceTip || '')}</div>
        </div>
      ` : data.aiError ? `<div class="chord-analysis-meta">AI unavailable: ${this.escapeHtml(data.aiError)}</div>` : '';
      result.innerHTML = `
        <div class="chord-analysis-title">${this.escapeHtml(data.ai && data.ai.chord || best.name)} <span>${this.escapeHtml(String(data.ai && data.ai.confidence || best.confidence))}%</span></div>
        <div class="chord-analysis-meta">Detected: ${this.escapeHtml(data.inputNotes.join(' - '))}</div>
        <div class="chord-analysis-meta">Chord tones: ${this.escapeHtml(best.notes.join(' - '))}</div>
        <div class="chord-analysis-meta">Source: ${this.escapeHtml(data.source)}</div>
        ${aiBlock}
        ${image}
      `;
    } catch (err) {
      console.error('Chord analysis error:', err);
      result.innerHTML = '<div class="chord-analysis-title">Chord API unavailable</div><div class="chord-analysis-meta">Restart the backend and try again.</div>';
    }
  },

  flee() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    if (this.micStream) this.micStream.getTracks().forEach(track => track.stop());
    this.micStream = null;
    this.micSource = null;
    this.analyser = null;
    this.score = 0;
    this.streak = 0;
    this.updateStats();
    this.show('battle-start-screen');
    this.hide('battle-game');
  },

  updateStats() {
    this.setText('battle-score', this.score);
    this.setText('battle-streak', this.streak);
    this.setText('battle-monsters', this.monstersDefeated);
    this.setText('sb-hp', this.monsterHp);

    const hpBar = document.getElementById('m-hp');
    if (hpBar) hpBar.style.width = `${this.monsterMaxHp ? this.monsterHp / this.monsterMaxHp * 100 : 0}%`;
  },

  addLog(message) {
    const log = document.getElementById('battle-log');
    if (!log) return;
    const row = document.createElement('div');
    row.textContent = message;
    log.prepend(row);
    while (log.children.length > 12) log.removeChild(log.lastChild);
  },

  setFeedback(message) {
    this.setText('battle-fb', message);
  },

  setNeedle(percent) {
    const needle = document.getElementById('cents-needle');
    if (needle) needle.style.left = `${percent}%`;
  },

  setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  async readJsonResponse(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new Error(`Expected JSON, got ${text.slice(0, 80) || response.statusText}`);
    }
  },

  show(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hidden');
  },

  hide(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  },

  escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }
};
