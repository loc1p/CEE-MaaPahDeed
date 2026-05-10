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
  chordMutedStrings: {
    C: [0],
    D: [0, 1],
    A: [0],
    Am: [0],
    Dm: [0, 1]
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
  detectedChordResult: null,
  externalChordShapes: {},
  chordShapeRequests: {},

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

    this.setText('tgt-note', this.formatChordSymbol(pick.symbol));
    this.setText('tgt-hz', `Play chord tones: ${pick.notes.join(' - ')}`);
    if (!this.detectedChordResult) this.setText('det-note', '-');
    this.setText('det-label', 'Chord');
    this.setText('cents-val', '-- cents');
    this.setNeedle(50);
    this.updateGuitarGuide();
    this.setFeedback(`Target chord: ${this.formatChordSymbol(pick.symbol)}. Strum or pick its notes clearly.`);
  },

  nextSongChord() {
    const pick = this.songChordTargets[this.songChordIndex % this.songChordTargets.length];
    this.songChordIndex += 1;
    this.target = null;
    this.targetChord = pick;
    this.matchHeld = 0;
    this.recentPlayedNotes = [];

    this.setText('tgt-note', this.formatChordSymbol(pick.symbol));
    this.setText('tgt-hz', `Play chord tones: ${pick.notes.join(' - ')}`);
    if (!this.detectedChordResult) this.setText('det-note', '-');
    this.setText('det-label', 'Chord');
    this.setText('cents-val', '-- cents');
    this.setNeedle(50);
    this.updateGuitarGuide();
    this.setFeedback(`Target chord: ${this.formatChordSymbol(pick.symbol)}. Strum or pick its notes clearly.`);
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
      ? `${this.formatChordSymbol(this.targetChord.symbol)} chord shape`
      : `${this.target.name}${this.target.octave} position`;
    const localPositions = this.targetChord ? this.getLocalChordPositions(this.targetChord.symbol) : [];
    const chordShape = this.targetChord && !localPositions.length ? this.getExternalChordShape(this.targetChord.symbol) : null;
    const variation = chordShape && chordShape.variations && chordShape.variations[0];
    const externalPositions = variation && variation.positions && variation.positions.length
      ? this.withMutedPositions(variation.positions, variation.mutedStrings)
      : [];
    const positions = this.targetChord
      ? (localPositions.length ? localPositions : externalPositions.length ? externalPositions : this.getChordPositions(this.targetChord.symbol))
      : this.notePositions[`${this.target.name}${this.target.octave}`] || [];
    const positionText = positions.length
      ? positions.filter(pos => !pos.muted).map(pos => {
        const stringInfo = this.guitarStrings[pos.string];
        const fretText = pos.fret === 0 ? 'open' : `fret ${pos.fret}`;
        return `${stringInfo.label} string: ${fretText}`;
      }).join(' | ')
      : 'No shape saved for this target yet.';
    const sourceText = chordShape
      ? `Source: ${chordShape.source}`
      : localPositions.length
        ? 'Source: Local chord shape'
        : this.targetChord
        ? 'Loading All Guitar Chords shape...'
        : '';
    const frets = this.getDisplayedFrets(positions);

    guide.innerHTML = `
      <div class="guitar-guide-head">
        <div>
          <div class="slbl">Guitar Position</div>
          <div class="guitar-guide-title">${this.escapeHtml(label)}</div>
        </div>
        <div class="guitar-guide-meta">${this.escapeHtml(sourceText || positionText)}</div>
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
      <div class="guitar-guide-meta">${this.escapeHtml(positionText)}</div>
    `;

    if (this.targetChord && !localPositions.length && !chordShape) this.loadExternalChordShape(this.targetChord.symbol);
  },

  getLocalChordPositions(symbol) {
    const clean = this.normalizeChordSymbol(symbol);
    const positions = this.chordShapes[clean] || [];
    return positions.length ? this.withMutedPositions(positions, this.chordMutedStrings[clean]) : [];
  },

  withMutedPositions(positions, mutedStrings = []) {
    const muted = Array.isArray(mutedStrings) ? mutedStrings : [];
    return [
      ...positions,
      ...muted
        .filter(string => Number.isInteger(Number(string)))
        .map(string => ({ string: Number(string), muted: true }))
    ];
  },

  getExternalChordShape(symbol) {
    const shape = this.externalChordShapes[this.normalizeChordSymbol(symbol)];
    return shape && !shape.failed ? shape : null;
  },

  async loadExternalChordShape(symbol) {
    const clean = this.normalizeChordSymbol(symbol);
    if (!clean || Object.prototype.hasOwnProperty.call(this.externalChordShapes, clean) || this.chordShapeRequests[clean]) return;

    const apiBase = typeof App !== 'undefined' ? App.baseUrl : `${location.origin}/api`;
    this.chordShapeRequests[clean] = true;
    try {
      const res = await fetch(`${apiBase}/chords/shape?symbol=${encodeURIComponent(symbol)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Chord shape lookup failed');
      this.externalChordShapes[clean] = data;
      if (this.targetChord && this.normalizeChordSymbol(this.targetChord.symbol) === clean) this.updateGuitarGuide();
    } catch (err) {
      console.warn('All Guitar Chords shape unavailable:', err);
      this.externalChordShapes[clean] = { failed: true };
    } finally {
      delete this.chordShapeRequests[clean];
    }
  },

  getChordPositions(symbol) {
    const clean = this.normalizeChordSymbol(symbol);
    const localPositions = this.getLocalChordPositions(clean);
    return localPositions.length ? localPositions : this.buildMovableChordShape(clean);
  },

  normalizeChordSymbol(symbol) {
    const clean = String(symbol || '')
      .replace(/\s+/g, '')
      .replace(/\u266f/g, '#')
      .replace(/\u266d/g, 'b')
      .trim();
    return clean.replace(/^([A-Ga-g])([#bB]?)(.*)$/, (_, root, accidental, suffix) => {
      const fixedAccidental = accidental === '#' ? '#' : accidental ? 'b' : '';
      const fixedSuffix = suffix
        .replace(/minor/ig, 'm')
        .replace(/major/ig, '')
        .replace(/^M(?!aj)/, 'm');
      return `${root.toUpperCase()}${fixedAccidental}${fixedSuffix}`;
    });
  },

  formatChordSymbol(symbol) {
    return this.normalizeChordSymbol(symbol);
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
    const mutedMarker = positions.find(pos => pos.string === stringIndex && pos.muted);

    return `
      <div class="guitar-string-row">
        <div class="guitar-string-label">${this.escapeHtml(stringInfo.label)}${openMarker ? '<span class="guitar-open-dot">0</span>' : ''}</div>
        ${frets.map(fret => {
          const marker = positions.find(pos => pos.string === stringIndex && pos.fret === fret);
          return `<div class="guitar-fret-cell">
            ${mutedMarker && fret === frets[0] ? '<span class="guitar-muted-dot"></span>' : ''}
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
    const isMatch = note.name === targetBase && absCents <= 23;

    this.setText('det-note', this.detectedChordResult || `${note.name}${note.octave}`);
    this.setText('det-label', 'Chord');
    this.setText('cents-val', `${cents >= 0 ? '+' : ''}${cents} cents`);
    this.setNeedle(Math.max(0, Math.min(100, 50 + cents / 2)));
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
    this.setText('det-note', this.detectedChordResult || (chordGuess ? this.formatChordSymbol(chordGuess.symbol) : '-'));
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
    this.setText('det-note', targetLabel);
    this.setText('det-label', 'Chord');
    const detected = document.getElementById('det-note');
    if (detected) detected.classList.add('matched');
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

  async analyzeChord() {
    const result = document.getElementById('chord-analysis');
    if (!result) return;

    const notes = [...new Set(this.recentPlayedNotes.map(item => item.name))];
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
      this.detectedChordResult = this.formatChordSymbol(best.name);
      this.setText('det-note', this.detectedChordResult);
      this.setText('det-label', 'Chord');
      const image = best.image ? `<img class="chord-analysis-img" src="${best.image}" alt="${this.escapeHtml(best.name)} chord diagram">` : '';
      result.innerHTML = `
        <div class="chord-analysis-title">${this.escapeHtml(this.formatChordSymbol(best.name))} <span>${this.escapeHtml(String(best.confidence))}%</span></div>
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
