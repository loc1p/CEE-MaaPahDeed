const Battle = {
  noteNames: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],
  targets: [
    { symbol: 'C', notes: ['C', 'E', 'G'] },
    { symbol: 'G', notes: ['G', 'B', 'D'] },
    { symbol: 'D', notes: ['D', 'F#', 'A'] },
    { symbol: 'A', notes: ['A', 'C#', 'E'] },
    { symbol: 'E', notes: ['E', 'G#', 'B'] },
    { symbol: 'Am', notes: ['A', 'C', 'E'] },
    { symbol: 'Em', notes: ['E', 'G', 'B'] },
    { symbol: 'Dm', notes: ['D', 'F', 'A'] }
  ],
  guitarStrings: [
    { label: 'E', note: 'E2', open: 'E', octave: 2 },
    { label: 'A', note: 'A2', open: 'A', octave: 2 },
    { label: 'D', note: 'D3', open: 'D', octave: 3 },
    { label: 'G', note: 'G3', open: 'G', octave: 3 },
    { label: 'B', note: 'B3', open: 'B', octave: 3 },
    { label: 'e', note: 'E4', open: 'E', octave: 4 }
  ],
  notePositions: {
    'E2': [{ string: 0, fret: 0, finger: '0' }],
    'A2': [{ string: 1, fret: 0, finger: '0' }],
    'D3': [{ string: 2, fret: 0, finger: '0' }],
    'G3': [{ string: 3, fret: 0, finger: '0' }],
    'B3': [{ string: 4, fret: 0, finger: '0' }],
    'E4': [{ string: 5, fret: 0, finger: '0' }]
  },
  chordShapes: {
    C: [{ string: 1, fret: 3, finger: '3' }, { string: 2, fret: 2, finger: '2' }, { string: 4, fret: 1, finger: '1' }],
    G: [{ string: 0, fret: 3, finger: '2' }, { string: 1, fret: 2, finger: '1' }, { string: 5, fret: 3, finger: '3' }],
    D: [{ string: 3, fret: 2, finger: '1' }, { string: 4, fret: 3, finger: '3' }, { string: 5, fret: 2, finger: '2' }],
    A: [{ string: 2, fret: 2, finger: '1' }, { string: 3, fret: 2, finger: '2' }, { string: 4, fret: 2, finger: '3' }],
    E: [{ string: 2, fret: 2, finger: '2' }, { string: 3, fret: 1, finger: '1' }, { string: 1, fret: 2, finger: '3' }],
    Am: [{ string: 2, fret: 2, finger: '2' }, { string: 3, fret: 2, finger: '3' }, { string: 4, fret: 1, finger: '1' }],
    Em: [{ string: 1, fret: 2, finger: '2' }, { string: 2, fret: 2, finger: '3' }],
    Dm: [{ string: 3, fret: 2, finger: '2' }, { string: 4, fret: 3, finger: '3' }, { string: 5, fret: 1, finger: '1' }],
    F: [{ string: 0, fret: 1, finger: '1' }, { string: 1, fret: 3, finger: '3' }, { string: 2, fret: 3, finger: '4' }, { string: 3, fret: 2, finger: '2' }, { string: 4, fret: 1, finger: '1' }, { string: 5, fret: 1, finger: '1' }]
  },
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
  aiAnalyzeInFlight: false,
  aiChordThreshold: 0.02,
  aiRecordingMs: 3000,
  aiCooldownMs: 5500,
  lastAiAnalyzeAt: 0,
  detectedChordResult: null,

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
    this.setFeedback('Play the target guitar chord near the microphone.');

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
    this.target = null;
    this.targetChord = pick;
    this.matchHeld = 0;
    this.recentPlayedNotes = [];

    this.setText('tgt-note', pick.symbol);
    this.setText('tgt-hz', `Play chord tones: ${pick.notes.join(' - ')}`);
    this.detectedChordResult = null;
    this.setDetectedChordDisplay('-', { muted: false, matched: false });
    this.setText('det-label', 'Chord');
    this.setText('cents-val', '-- cents');
    this.setNeedle(50);
    this.updateGuitarGuide();
    this.setFeedback(`Target chord: ${pick.symbol}. Strum clearly. AI listens when mic level reaches ${this.aiChordThreshold.toFixed(2)}.`);
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
    this.detectedChordResult = null;
    this.setDetectedChordDisplay('-', { muted: false, matched: false });
    this.setText('det-label', 'Chord');
    this.setText('cents-val', '-- cents');
    this.setNeedle(50);
    this.updateGuitarGuide();
    this.setFeedback(`Target chord: ${pick.symbol}. Strum clearly. AI listens when mic level reaches ${this.aiChordThreshold.toFixed(2)}.`);
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

  updateGuitarGuide() {
    const guide = document.getElementById('guitar-guide');
    if (!guide) return;

    const label = this.targetChord
      ? `${this.targetChord.symbol} chord shape`
      : `${this.target.name}${this.target.octave} position`;
    const positions = this.targetChord
      ? this.getChordPositions(this.targetChord.symbol)
      : this.notePositions[`${this.target.name}${this.target.octave}`] || [];
    const positionText = positions.length
      ? positions.map(pos => {
        const stringInfo = this.guitarStrings[pos.string];
        const fretText = pos.fret === 0 ? 'open' : `fret ${pos.fret}`;
        return `${stringInfo.label} string: ${fretText}`;
      }).join(' | ')
      : 'No shape saved for this target yet.';
    const frets = this.getDisplayedFrets(positions);

    guide.innerHTML = `
      <div class="guitar-guide-head">
        <div>
          <div class="slbl">Guitar Position</div>
          <div class="guitar-guide-title">${this.escapeHtml(label)}</div>
        </div>
        <div class="guitar-guide-meta">${this.escapeHtml(positionText)}</div>
      </div>
      <div class="guitar-neck" aria-label="${this.escapeHtml(label)}">
        <div class="guitar-nut"></div>
        ${this.renderFretNumbers(frets)}
        ${this.guitarStrings
          .map((stringInfo, index) => ({ stringInfo, index }))
          .reverse()
          .map(item => this.renderGuideString(item.stringInfo, item.index, positions, frets))
          .join('')}
      </div>
    `;
  },

  getChordPositions(symbol) {
    const clean = this.normalizeChordSymbol(symbol);
    return this.chordShapes[clean]
      || this.chordShapes[clean.replace(/[0-9]/g, '')]
      || this.buildMovableChordShape(clean);
  },

  normalizeChordSymbol(symbol) {
    return String(symbol || '')
      .replace(/\s+/g, '')
      .replace(/\u266f/g, '#')
      .replace(/\u266d/g, 'b')
      .replace(/minor/i, 'm')
      .replace(/major/i, '')
      .replace(/^([A-G])B/, '$1b')
      .trim();
  },

  buildMovableChordShape(symbol) {
    const match = String(symbol || '').match(/^([A-G](?:#|b)?)(.*)$/);
    if (!match) return [];

    const root = match[1];
    const suffix = match[2].toLowerCase();
    const rootPc = this.notePc(root);
    if (rootPc === null) return [];

    const aRootFret = this.fretForRoot(rootPc, 'A');
    const eRootFret = this.fretForRoot(rootPc, 'E');
    const preferAShape = aRootFret >= 1 && aRootFret <= 7;
    const family = preferAShape ? 'A' : 'E';
    const fret = preferAShape ? aRootFret : eRootFret || 12;

    const quality = this.chordQuality(suffix);
    return this.barreShape(family, quality, fret);
  },

  notePc(note) {
    const match = String(note || '').match(/^([A-G])(#|b)?/i);
    if (!match) return null;

    const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()];
    const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
    return (base + accidental + 12) % 12;
  },

  fretForRoot(rootPc, stringName) {
    const openPc = stringName === 'A' ? 9 : 4;
    const fret = (rootPc - openPc + 12) % 12;
    return fret === 0 ? 12 : fret;
  },

  chordQuality(suffix) {
    if (suffix.includes('dim')) return 'dim';
    if (suffix.includes('aug') || suffix.includes('+')) return 'aug';
    if (suffix.includes('sus2')) return 'sus2';
    if (suffix.includes('sus4') || suffix.includes('sus')) return 'sus4';
    if (suffix.includes('maj7')) return 'maj7';
    if (suffix.startsWith('m') && suffix.includes('7')) return 'm7';
    if (suffix.startsWith('m') && suffix.includes('6')) return 'm6';
    if (suffix.startsWith('m')) return 'm';
    if (suffix.includes('7')) return '7';
    if (suffix.includes('6')) return '6';
    return 'maj';
  },

  barreShape(family, quality, fret) {
    const eShapes = {
      maj: [[0, 0, '1'], [1, 2, '3'], [2, 2, '4'], [3, 1, '2'], [4, 0, '1'], [5, 0, '1']],
      m: [[0, 0, '1'], [1, 2, '3'], [2, 2, '4'], [3, 0, '1'], [4, 0, '1'], [5, 0, '1']],
      7: [[0, 0, '1'], [1, 2, '3'], [2, 0, '1'], [3, 1, '2'], [4, 0, '1'], [5, 0, '1']],
      m7: [[0, 0, '1'], [1, 2, '3'], [2, 0, '1'], [3, 0, '1'], [4, 0, '1'], [5, 0, '1']],
      maj7: [[0, 0, '1'], [1, 2, '4'], [2, 1, '2'], [3, 1, '3'], [4, 0, '1'], [5, 0, '1']],
      sus4: [[0, 0, '1'], [1, 2, '2'], [2, 2, '3'], [3, 2, '4'], [4, 0, '1'], [5, 0, '1']]
    };
    const aShapes = {
      maj: [[1, 0, '1'], [2, 2, '2'], [3, 2, '3'], [4, 2, '4'], [5, 0, '1']],
      m: [[1, 0, '1'], [2, 2, '3'], [3, 2, '4'], [4, 1, '2'], [5, 0, '1']],
      7: [[1, 0, '1'], [2, 2, '2'], [3, 0, '1'], [4, 2, '3'], [5, 0, '1']],
      m7: [[1, 0, '1'], [2, 2, '3'], [3, 0, '1'], [4, 1, '2'], [5, 0, '1']],
      maj7: [[1, 0, '1'], [2, 2, '3'], [3, 1, '2'], [4, 2, '4'], [5, 0, '1']],
      sus4: [[1, 0, '1'], [2, 2, '2'], [3, 2, '3'], [4, 3, '4'], [5, 0, '1']],
      dim: [[1, 0, '1'], [2, 1, '2'], [3, 2, '4'], [4, 1, '3']],
      aug: [[1, 0, '1'], [2, 3, '4'], [3, 2, '3'], [4, 2, '2']]
    };

    const shapes = family === 'A' ? aShapes : eShapes;
    const fallbackQuality = quality === '6' || quality === 'm6' || quality === 'sus2' ? (quality.startsWith('m') ? 'm' : 'maj') : quality;
    const template = shapes[fallbackQuality] || shapes.maj;
    return template.map(([string, offset, finger]) => ({ string, fret: fret + offset, finger }));
  },

  getDisplayedFrets(positions) {
    const pressed = positions.map(pos => pos.fret).filter(fret => fret > 0);
    if (!pressed.length) return [1, 2, 3, 4, 5];

    const min = Math.min(...pressed);
    const max = Math.max(...pressed);
    const start = max <= 5 ? 1 : min;
    return [0, 1, 2, 3, 4].map(offset => start + offset);
  },

  renderFretNumbers(frets) {
    return `<div class="guitar-fret-numbers">
      <span></span>${frets.map(fret => `<span>${fret}</span>`).join('')}
    </div>`;
  },

  renderGuideString(stringInfo, stringIndex, positions, frets) {
    const openMarker = positions.find(pos => pos.string === stringIndex && pos.fret === 0);

    return `
      <div class="guitar-string-row">
        <div class="guitar-string-label">${this.escapeHtml(stringInfo.label)}${openMarker ? '<span class="guitar-open-dot">0</span>' : ''}</div>
        ${frets.map(fret => {
          const marker = positions.find(pos => pos.string === stringIndex && pos.fret === fret);
          return `<div class="guitar-fret-cell">
            ${marker ? `<span class="guitar-finger">${this.escapeHtml(marker.finger)}</span>` : ''}
          </div>`;
        }).join('')}
      </div>
    `;
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
    this.maybeStartAutoAiChord(level);

    if (this.chordRecording || this.aiAnalyzeInFlight) {
      this.rafId = requestAnimationFrame(() => this.tick());
      return;
    }

    const detection = this.detectRealtimePitch(this.timeDomain, this.audioCtx.sampleRate, level);
    const freq = detection.freq;

    if (freq > 50 && freq < 1400) {
      this.handleDetectedFrequency(freq, detection.clarity);
    } else {
      if (!this.detectedChordResult) this.setText('det-note', '-');
      this.setText('cents-val', '-- cents');
      this.setNeedle(50);
      this.matchHeld = 0;

      if (level > 0.004) {
        this.lastSignalAt = performance.now();
        const hint = this.targetChord
          ? `AI trigger threshold ${this.aiChordThreshold.toFixed(2)}. Level ${level.toFixed(3)}.`
          : `Mic hears sound. Pick one string clearly. Level ${level.toFixed(3)}.`;
        this.setFeedback(hint);
      } else if (performance.now() - this.lastSignalAt > 1200) {
        this.setFeedback('No guitar signal detected. Check mic input or move closer.');
      }
    }

    this.rafId = requestAnimationFrame(() => this.tick());
  },

  handleDetectedFrequency(freq, clarity = 1) {
    const note = this.frequencyToNote(freq);
    if (this.targetChord) {
      this.handleDetectedChordMonitor(note, freq, clarity);
      return;
    }

    const targetBase = this.target.name;
    const cents = Math.round(1200 * Math.log2(freq / note.freq));
    const absCents = Math.abs(cents);
    const isMatch = note.name === targetBase && absCents <= 23;

    this.setText('det-note', this.detectedChordResult || `${note.name}${note.octave}`);
    this.setText('det-label', 'Chord');
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

    this.setText('cents-val', `${cents >= 0 ? '+' : ''}${cents} cents`);
    this.setNeedle(Math.max(0, Math.min(100, 50 + cents / 2)));
    this.rememberPlayedNote(note.name);

    const played = [...new Set(this.recentPlayedNotes.map(item => item.name))];
    const chordGuess = this.guessChordFromNotes(played);
    this.setText('det-note', this.detectedChordResult || (chordGuess ? chordGuess.symbol : '-'));
    this.setText('det-label', 'Chord');

    const matched = targetNotes.filter(target => played.includes(target));
    const needed = Math.min(3, targetNotes.length);
    const isTargetTone = targetNotes.includes(note.name) && absCents <= 32;

    const detected = document.getElementById('det-note');
    if (detected) detected.classList.toggle('matched', isTargetTone);

    if (matched.length >= needed) {
      this.matchHeld += 1;
      this.setFeedback(`${this.targetChord.symbol}: ${matched.join(' - ')} found. Hold the chord. Clarity ${(clarity * 100).toFixed(0)}%.`);
      if (this.matchHeld >= 9) this.registerHit(false);
      return;
    }

    this.matchHeld = 0;
    this.setFeedback(`${this.targetChord.symbol} needs ${targetNotes.join(' - ')}. Heard: ${played.join(' - ') || note.name}.`);
  },

  handleDetectedChordMonitor(note, freq, clarity = 1) {
    const cents = Math.round(1200 * Math.log2(freq / note.freq));
    this.setText('cents-val', `${cents >= 0 ? '+' : ''}${cents} cents`);
    this.setNeedle(Math.max(0, Math.min(100, 50 + cents / 2)));
    this.rememberPlayedNote(note.name);

    if (!this.detectedChordResult) this.setDetectedChordDisplay('...', { muted: true });
    this.setText('det-label', 'Chord');

    const detected = document.getElementById('det-note');
    if (detected) detected.classList.remove('matched');

    const now = performance.now();
    if (now - this.lastAiAnalyzeAt > 900) {
      this.setFeedback(`AI chord mode. Strum ${this.targetChord.symbol}; capture starts above level ${this.aiChordThreshold.toFixed(2)}. Current ${clarity ? `clarity ${(clarity * 100).toFixed(0)}%` : `level ready`}.`);
    }
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
    this.detectedChordResult = targetLabel;
    this.setDetectedChordDisplay(targetLabel, { matched: true });
    this.setText('det-label', 'Chord');
    this.addLog(`${perfect ? 'Perfect' : 'Hit'} ${targetLabel} +${points}`);

    if (this.monsterHp === 0) {
      this.monstersDefeated += 1;
      this.addLog('Monster defeated.');
      this.loadMonster(this.monsterIndex + 1);
    }

    this.updateStats();
    setTimeout(() => this.nextNote(), 3000);
  },

  detectRealtimePitch(buffer, sampleRate, level) {
    if (this.pitchDetector) {
      const [pitch, clarity] = this.pitchDetector.findPitch(buffer, sampleRate);
      if (level > 0.004 && clarity >= 0.67) {
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

  guessChordFromNotes(notes) {
    const played = [...new Set(notes)];
    if (played.length < 2) return null;

    const candidates = [...this.songChordTargets, ...this.targets];
    return candidates
      .map(chord => {
        const matched = chord.notes.filter(note => played.includes(note)).length;
        const extra = played.filter(note => !chord.notes.includes(note)).length;
        const score = matched / chord.notes.length - extra * 0.2;
        return { chord, matched, score };
      })
      .filter(item => item.matched >= 2)
      .sort((a, b) => b.score - a.score || b.matched - a.matched)[0]?.chord || null;
  },

  maybeStartAutoAiChord(level) {
    if (!this.targetChord || !this.micStream || !this.analyser) return;
    if (this.chordRecording || this.aiAnalyzeInFlight) return;

    const now = performance.now();
    if (now - this.lastAiAnalyzeAt < this.aiCooldownMs) return;
    if (now - this.lastHitAt < 1200) return;
    if (level < this.aiChordThreshold) return;

    this.lastSignalAt = now;
    this.runAiChordCapture('auto', level);
  },

  async recordAndAnalyzeChord() {
    await this.runAiChordCapture('manual');
  },

  async runAiChordCapture(mode = 'manual', triggerLevel = null) {
    const result = document.getElementById('chord-analysis');
    if (!result) return;

    if (!this.micStream || !this.analyser) {
      result.classList.remove('hidden');
      result.innerHTML = '<div class="chord-analysis-title">Start Battle first</div><div class="chord-analysis-meta">Click BEGIN THE QUEST, allow microphone access, then record a chord.</div>';
      return;
    }

    if (this.chordRecording || this.aiAnalyzeInFlight) return;

    this.detectedNotes = [];
    this.chordRecording = true;
    this.aiAnalyzeInFlight = true;
    this.lastAiAnalyzeAt = performance.now();
    this.detectedChordResult = null;
    result.classList.remove('hidden');
    const sourceText = mode === 'auto'
      ? `Sound crossed AI threshold${triggerLevel === null ? '' : ` (${triggerLevel.toFixed(3)})`}.`
      : 'Manual AI chord capture started.';
    result.innerHTML = `<div class="chord-analysis-title">Recording full chord...</div><div class="chord-analysis-meta">${this.escapeHtml(sourceText)} Strum clearly for ${Math.round(this.aiRecordingMs / 1000)} seconds.</div>`;
    this.setFeedback('AI recording chord audio. Let the chord ring.');

    try {
      const recording = await this.recordChordAudio(this.aiRecordingMs);
      this.chordRecording = false;
      await this.analyzeChordAudio(recording);
    } catch (err) {
      console.error('Chord recording error:', err);
      this.chordRecording = false;
      result.innerHTML = '<div class="chord-analysis-title">Recording failed</div><div class="chord-analysis-meta">Check microphone permission and try again.</div>';
    } finally {
      this.chordRecording = false;
      this.aiAnalyzeInFlight = false;
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
        try {
          const wav = await this.blobToWavBase64(blob);
          resolve({ ...wav, audioBase64, originalMimeType: mimeType });
        } catch (err) {
          console.warn('WAV conversion failed, sending original recording:', err);
          resolve({ audioBase64, mimeType });
        }
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

  async blobToWavBase64(blob) {
    const buffer = await blob.arrayBuffer();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const ctx = this.audioCtx || new AudioContextClass();
    const audioBuffer = await ctx.decodeAudioData(buffer.slice(0));
    const mono = this.downmixAudioBuffer(audioBuffer);
    const wavBuffer = this.encodeWav(mono, audioBuffer.sampleRate);
    return {
      audioWavBase64: this.arrayBufferToBase64(wavBuffer),
      mimeType: 'audio/wav',
      sampleRate: audioBuffer.sampleRate,
      duration: Number(audioBuffer.duration.toFixed(2))
    };
  },

  downmixAudioBuffer(audioBuffer) {
    const channels = audioBuffer.numberOfChannels;
    const length = audioBuffer.length;
    const mono = new Float32Array(length);

    for (let channel = 0; channel < channels; channel++) {
      const data = audioBuffer.getChannelData(channel);
      for (let i = 0; i < length; i++) mono[i] += data[i] / channels;
    }

    return mono;
  },

  encodeWav(samples, sampleRate) {
    const bytesPerSample = 2;
    const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
    const view = new DataView(buffer);

    this.writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * bytesPerSample, true);
    this.writeAscii(view, 8, 'WAVE');
    this.writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * bytesPerSample, true);
    view.setUint16(32, bytesPerSample, true);
    view.setUint16(34, 8 * bytesPerSample, true);
    this.writeAscii(view, 36, 'data');
    view.setUint32(40, samples.length * bytesPerSample, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }

    return buffer;
  },

  writeAscii(view, offset, text) {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  },

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const chunkSize = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  },

  async analyzeChordAudio(recording) {
    const result = document.getElementById('chord-analysis');
    const noteHints = [...new Set(this.detectedNotes.map(item => item.name))];

    result.innerHTML = '<div class="chord-analysis-title">Analyzing chord...</div><div class="chord-analysis-meta">Running lv-chordia on the recorded audio.</div>';

    try {
      const apiBase = typeof App !== 'undefined' ? App.baseUrl : `${location.origin}/api`;
      const res = await fetch(`${apiBase}/chords/analyze-audio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...recording, noteHints })
      });
      const data = await this.readJsonResponse(res);

      if (!res.ok) throw new Error(data.error || 'Chord analysis failed');

      const chord = data.chord || {};
      const chordName = chord.chord || 'unclear';
      const isNoChord = this.isNoChordResult(chordName);
      this.detectedChordResult = isNoChord ? null : chordName;
      this.setDetectedChordDisplay(isNoChord ? '...' : chordName, { muted: isNoChord });
      this.setText('det-label', 'Chord');
      this.handleAiChordResult(chord, data);
      result.classList.toggle('is-muted', isNoChord);
      result.innerHTML = this.renderAiChordAnalysis(chord, data, isNoChord);
    } catch (err) {
      console.error('Audio chord analysis error:', err);
      result.classList.add('is-muted');
      result.innerHTML = `<div class="chord-analysis-title">Chord analysis unavailable</div><div class="chord-analysis-meta">${this.escapeHtml(err.message)}</div>`;
    }
  },

  handleAiChordResult(chord, data) {
    if (!this.targetChord || !chord) return;
    if (data.source !== 'lv-chordia') {
      this.matchHeld = 0;
      this.setFeedback(`AI classifier unavailable; target ${this.targetChord.symbol} was not scored.`);
      return;
    }

    const detected = this.normalizeChordForCompare(chord.chord || chord.rawChord);
    const target = this.normalizeChordForCompare(this.targetChord.symbol);
    const confidence = Number(chord.confidence || 0);
    const detectedEl = document.getElementById('det-note');
    const isMatch = detected && target && detected === target && confidence >= 35;

    if (detectedEl) detectedEl.classList.toggle('matched', isMatch);

    if (isMatch) {
      this.setFeedback(`AI detected ${chord.chord} from ${data.source}. Target ${this.targetChord.symbol} matched.`);
      this.registerHit(confidence >= 85);
      return;
    }

    this.matchHeld = 0;
    this.setFeedback(`AI detected ${chord.chord || 'unclear'}; target is ${this.targetChord.symbol}. Strum again when ready.`);
  },

  renderAiChordAnalysis(chord, data, isNoChord) {
    const confidence = this.escapeHtml(String(chord.confidence || '--'));
    const notes = Array.isArray(chord.notes) ? chord.notes.filter(Boolean) : [];
    const title = isNoChord ? 'No stable chord yet' : this.escapeHtml(chord.chord || 'Unclear');
    const feedback = isNoChord
      ? 'Let the strings ring a little longer, then strum again.'
      : this.escapeHtml(chord.feedback || 'AI matched the recorded chord.');
    const notesLine = notes.length
      ? `<div class="chord-analysis-meta">Notes: ${this.escapeHtml(notes.join(' - '))}</div>`
      : '';

    return `
      <div class="chord-analysis-title">${title} <span>${confidence}%</span></div>
      <div class="chord-analysis-meta">${feedback}</div>
      ${notesLine}
      <div class="chord-analysis-meta">Source: ${this.escapeHtml(data.source || 'lv-chordia')}</div>
    `;
  },

  isNoChordResult(value) {
    return /^(no chord|n|unclear)$/i.test(String(value || '').trim());
  },

  normalizeChordForCompare(symbol) {
    const clean = String(symbol || '')
      .trim()
      .replace(/\u266f/g, '#')
      .replace(/\u266d/g, 'b')
      .replace(/\s+/g, '')
      .replace(/major/i, '')
      .replace(/minor/i, 'm');

    if (!clean || /^no(chord)?$/i.test(clean) || clean === 'N') return '';

    const match = clean.match(/^([A-Ga-g])([#b]?)(.*)$/);
    if (!match) return '';

    const rootPc = this.notePc(`${match[1].toUpperCase()}${match[2] || ''}`);
    if (rootPc === null) return '';

    return `${rootPc}:${this.chordQualityForCompare(match[3] || '')}`;
  },

  chordQualityForCompare(suffix) {
    const clean = String(suffix || '')
      .toLowerCase()
      .replace(/^:/, '')
      .replace(/^maj$/, '')
      .replace(/^min/, 'm');

    if (!clean || clean === 'major') return 'maj';
    if (clean.startsWith('m') && !clean.startsWith('maj')) {
      if (clean.includes('7')) return 'm7';
      if (clean.includes('6')) return 'm6';
      return 'm';
    }
    if (clean.includes('maj7')) return 'maj7';
    if (clean.includes('dim')) return 'dim';
    if (clean.includes('aug') || clean.includes('+')) return 'aug';
    if (clean.includes('sus2')) return 'sus2';
    if (clean.includes('sus4') || clean.includes('sus')) return 'sus4';
    if (clean.includes('7')) return '7';
    if (clean.includes('6')) return '6';
    return 'maj';
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
      this.detectedChordResult = best.name;
      this.setText('det-note', best.name);
      this.setText('det-label', 'Chord');
      const image = best.image ? `<img class="chord-analysis-img" src="${best.image}" alt="${this.escapeHtml(best.name)} chord diagram">` : '';
      result.innerHTML = `
        <div class="chord-analysis-title">${this.escapeHtml(best.name)} <span>${this.escapeHtml(String(best.confidence))}%</span></div>
        <div class="chord-analysis-meta">Detected: ${this.escapeHtml(data.inputNotes.join(' - '))}</div>
        <div class="chord-analysis-meta">Chord tones: ${this.escapeHtml(best.notes.join(' - '))}</div>
        <div class="chord-analysis-meta">Source: ${this.escapeHtml(data.source)}</div>
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

  setDetectedChordDisplay(value, options = {}) {
    const el = document.getElementById('det-note');
    if (!el) return;

    el.textContent = value;
    el.classList.toggle('muted', !!options.muted);
    el.classList.toggle('matched', !!options.matched);
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
