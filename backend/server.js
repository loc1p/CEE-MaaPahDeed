const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fetch = require('node-fetch');
const User = require('./models/User');
const SongSearch = require('./models/SongSearch');

dotenv.config();

const app = express();
const SECRET = process.env.JWT_SECRET || 'maapah-dev-secret';
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '30mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/maapah')
  .then(() => console.log('MongoDB connected'))
  .catch(e => console.error(e));

const LOCAL_CHORDS = [
  { name: 'C major', notes: ['C', 'E', 'G'], type: 'Major' },
  { name: 'D major', notes: ['D', 'F#', 'A'], type: 'Major' },
  { name: 'E major', notes: ['E', 'G#', 'B'], type: 'Major' },
  { name: 'F major', notes: ['F', 'A', 'C'], type: 'Major' },
  { name: 'G major', notes: ['G', 'B', 'D'], type: 'Major' },
  { name: 'A major', notes: ['A', 'C#', 'E'], type: 'Major' },
  { name: 'B major', notes: ['B', 'D#', 'F#'], type: 'Major' },
  { name: 'A minor', notes: ['A', 'C', 'E'], type: 'Minor' },
  { name: 'B minor', notes: ['B', 'D', 'F#'], type: 'Minor' },
  { name: 'C minor', notes: ['C', 'D#', 'G'], type: 'Minor' },
  { name: 'D minor', notes: ['D', 'F', 'A'], type: 'Minor' },
  { name: 'E minor', notes: ['E', 'G', 'B'], type: 'Minor' },
  { name: 'G minor', notes: ['G', 'A#', 'D'], type: 'Minor' },
  { name: 'C7', notes: ['C', 'E', 'G', 'A#'], type: 'Dominant 7' },
  { name: 'D7', notes: ['D', 'F#', 'A', 'C'], type: 'Dominant 7' },
  { name: 'E7', notes: ['E', 'G#', 'B', 'D'], type: 'Dominant 7' },
  { name: 'G7', notes: ['G', 'B', 'D', 'F'], type: 'Dominant 7' },
  { name: 'A7', notes: ['A', 'C#', 'E', 'G'], type: 'Dominant 7' }
];

const FALLBACK_SONG_CHORDS = {
  'tyler-the-creator/are-we-still-friends': ['Fmaj7', 'Em7', 'Am7', 'Dm7', 'G7'],
  'maroon-5/this-love': ['Cm', 'Fm', 'Bb', 'Eb', 'G7', 'Ab'],
  'maroon-five/this-love': ['Cm', 'Fm', 'Bb', 'Eb', 'G7', 'Ab']
};

function auth(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = (req.headers.authorization || '').split(' ')[1];
  if (!token) return next();

  try {
    req.user = jwt.verify(token, SECRET);
  } catch {}
  next();
}

function notePc(note) {
  const match = String(note || '').trim().match(/^([A-Ga-g])([#b]?)/);
  if (!match) return null;

  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[match[1].toUpperCase()];
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  return (base + accidental + 12) % 12;
}

function uniqueNotes(notes) {
  const seen = new Set();
  return (Array.isArray(notes) ? notes : [])
    .map(note => String(note).trim())
    .filter(Boolean)
    .filter(note => {
      const pc = notePc(note);
      if (pc === null || seen.has(pc)) return false;
      seen.add(pc);
      return true;
    });
}

function slugifySongPart(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/['".,!?()[\]{}]/g, '')
    .replace(/&/g, 'and')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function songKeyFor(artist, song) {
  return `${slugifySongPart(artist)}/${slugifySongPart(song)}`;
}

async function fetchSongCover(artist, song) {
  const term = encodeURIComponent(`${artist} ${song}`);
  try {
    const response = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`, {
      headers: { 'User-Agent': 'MaaPahDeed/1.0' }
    });
    if (!response.ok) return null;
    const data = await response.json();
    const artwork = data.results && data.results[0] && data.results[0].artworkUrl100;
    return artwork ? artwork.replace('100x100bb', '300x300bb') : null;
  } catch {
    return null;
  }
}

async function enrichSongResult(result, artistOverride = null, songOverride = null) {
  const artist = String(artistOverride || result.artist || '').trim();
  const song = String(songOverride || result.song || '').trim();
  const coverUrl = result.coverUrl || await fetchSongCover(artist, song);
  return { ...result, artist, song, coverUrl };
}

function songItemFromResult(result) {
  const artist = String(result.artist || '').trim();
  const song = String(result.song || '').trim();
  return {
    songKey: songKeyFor(artist, song),
    artist,
    song,
    key: result.key || null,
    source: result.source || null,
    coverUrl: result.coverUrl || null,
    chordsCount: Array.isArray(result.chords) ? result.chords.length : 0,
    chords: Array.isArray(result.chords) ? result.chords : [],
    updatedAt: new Date(),
    playedAt: new Date()
  };
}

function publicSongItem(item) {
  return {
    songKey: item.songKey,
    artist: item.artist,
    song: item.song,
    key: item.key || null,
    source: item.source || null,
    coverUrl: item.coverUrl || null,
    chordsCount: item.chordsCount || 0,
    chords: item.chords || [],
    note: item.note || '',
    savedAt: item.savedAt,
    updatedAt: item.updatedAt,
    playedAt: item.playedAt
  };
}

async function recordSongSearch(result, userId = null) {
  try {
    const item = songItemFromResult(result);
    if (!item.songKey || item.songKey === '/') return;

    await SongSearch.findOneAndUpdate(
      { songKey: item.songKey },
      {
        $setOnInsert: { artist: item.artist, song: item.song },
        $set: { coverUrl: item.coverUrl, lastSearchedAt: new Date() },
        $inc: { count: 1 }
      },
      { upsert: true }
    );

    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) return;
    user.recentSongs = [
      item,
      ...(user.recentSongs || []).filter(song => song.songKey !== item.songKey)
    ].slice(0, 3);
    user.updatedAt = new Date();
    await user.save();
  } catch (error) {
    console.warn('Song history skipped:', error.message);
  }
}

function normalizeChordSymbol(symbol) {
  return String(symbol || '')
    .replace(/\s+/g, '')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/^([A-G])B/, '$1b')
    .trim();
}

function chordSymbolToNotes(symbol) {
  const clean = normalizeChordSymbol(symbol);
  const match = clean.match(/^([A-G](?:#|b)?)(.*)$/);
  if (!match) return [];

  const root = match[1];
  const suffix = match[2].toLowerCase();
  const rootPc = notePc(root);
  if (rootPc === null) return [];

  let intervals = [0, 4, 7];
  if (suffix.includes('dim')) intervals = [0, 3, 6];
  else if (suffix.includes('aug') || suffix.includes('+')) intervals = [0, 4, 8];
  else if (suffix.includes('sus2')) intervals = [0, 2, 7];
  else if (suffix.includes('sus4') || suffix.includes('sus')) intervals = [0, 5, 7];
  else if (suffix.startsWith('m') && !suffix.startsWith('maj')) intervals = [0, 3, 7];

  if (suffix.includes('6')) intervals.push(9);
  if (suffix.includes('7')) intervals.push(suffix.includes('maj7') ? 11 : 10);
  if (suffix.includes('9')) intervals.push(2);

  const names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  return [...new Set(intervals.map(interval => names[(rootPc + interval) % 12]))];
}

function extractSongMetadata(html) {
  const scriptMatch = String(html).match(/window\.SONG_METADATA\s*=\s*([\s\S]*?);\s*<\/script>/i);
  if (!scriptMatch) return null;

  const scriptText = scriptMatch[1];
  const chordsMatch = scriptText.match(/CHORDS_USED\s*:\s*(\[[\s\S]*?\])/);
  if (!chordsMatch) return null;

  const chordsText = chordsMatch[1]
    .replace(/'/g, '"')
    .replace(/,\s*]/g, ']');

  const field = name => {
    const match = scriptText.match(new RegExp(`${name}\\s*:\\s*(['"])(.*?)\\1`, 'i'));
    return match ? match[2] : null;
  };

  return {
    CHORDS_USED: JSON.parse(chordsText),
    TONALITY: field('TONALITY'),
    KEY: field('KEY')
  };
}

async function fetchEChordsSong(artist, song) {
  const artistSlug = slugifySongPart(artist);
  const songSlug = slugifySongPart(song);
  if (!artistSlug || !songSlug) throw new Error('Artist and song are required');

  const url = `https://www.e-chords.com/chords/${artistSlug}/${songSlug}`;
  const response = await fetch(url, {
    headers: {
      Accept: 'text/html',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
    }
  });

  if (response.status === 403) {
    const error = new Error('E-Chords blocked the automated request');
    error.status = 403;
    throw error;
  }
  if (response.status === 404) {
    const error = new Error('Song not found on E-Chords');
    error.status = 404;
    throw error;
  }
  if (!response.ok) throw new Error(`E-Chords HTTP ${response.status}`);

  const metadata = extractSongMetadata(await response.text());
  if (!metadata) throw new Error('E-Chords metadata not found');

  const rawChords = Array.isArray(metadata.CHORDS_USED) ? metadata.CHORDS_USED : [];
  const chords = rawChords
    .map(chord => normalizeChordSymbol(chord))
    .filter(Boolean)
    .map(symbol => ({ symbol, notes: chordSymbolToNotes(symbol) }))
    .filter(chord => chord.notes.length >= 2);

  return {
    source: 'E-Chords',
    url,
    artist,
    song,
    key: metadata.TONALITY || metadata.KEY || null,
    chords: [...new Map(chords.map(chord => [chord.symbol, chord])).values()]
  };
}

function fallbackSongChords(artist, song, externalApiError = null) {
  const key = `${slugifySongPart(artist)}/${slugifySongPart(song)}`;
  const blocked = /blocked|403|forbidden/i.test(String(externalApiError || ''));
  const symbols = FALLBACK_SONG_CHORDS[key] || (blocked ? ['C', 'G', 'Am', 'F'] : null);
  if (!symbols) return null;

  return {
    source: 'Local fallback chord quest',
    externalApiError,
    artist,
    song,
    key: null,
    fallback: true,
    chords: symbols
      .map(symbol => ({ symbol, notes: chordSymbolToNotes(symbol) }))
      .filter(chord => chord.notes.length >= 2)
  };
}

function scoreChords(inputNotes, chords) {
  const inputPcs = new Set(inputNotes.map(notePc));

  return chords
    .map(chord => {
      const chordNotes = (chord.notes || [])
        .map(note => (note.name && note.name.eng) || note)
        .filter(Boolean);
      const chordPcs = [...new Set(chordNotes.map(notePc).filter(pc => pc !== null))];
      if (!chordPcs.length) return null;

      const matched = chordPcs.filter(pc => inputPcs.has(pc)).length;
      const extra = [...inputPcs].filter(pc => !chordPcs.includes(pc)).length;
      const score = Math.max(0, matched / chordPcs.length - extra * 0.18);

      return {
        name: (chord.name && chord.name.eng) || chord.name || 'Unknown chord',
        notes: chordNotes,
        type: (chord.type && chord.type.name && chord.type.name.eng) || chord.type || '',
        intervals: (chord.type && chord.type.intervals) || [],
        image: chord.images && Object.values(chord.images)[0] || null,
        confidence: Math.round(score * 100),
        matched
      };
    })
    .filter(Boolean)
    .filter(match => match.matched >= 2)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

async function fetchExternalChords() {
  const response = await fetch('https://chords.alday.dev/chords?limit=100', {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'MaaPahDeed/1.0'
    }
  });

  if (!response.ok) throw new Error(`Chord API HTTP ${response.status}`);

  const data = await response.json();
  return Array.isArray(data) ? data : data.data || data.chords || data.results || [];
}

const PROJECT_ROOT = path.resolve(__dirname, '..');
const LV_CHORDIA_VENV = path.join(__dirname, '.venv-lvchordia');
const DEFAULT_LV_CHORDIA_PYTHON_CANDIDATES = [
  path.join(LV_CHORDIA_VENV, 'Scripts', 'python.exe'),
  path.join(LV_CHORDIA_VENV, 'bin', 'python'),
  path.join(PROJECT_ROOT, '.venv-lvchordia', 'Scripts', 'python.exe'),
  path.join(PROJECT_ROOT, '.venv-lvchordia', 'bin', 'python')
];
const LV_CHORDIA_SCRIPT = path.join(__dirname, 'ml', 'lv_chordia_classify.py');

function lvChordiaPythonCommand() {
  if (process.env.LV_CHORDIA_PYTHON) return process.env.LV_CHORDIA_PYTHON;
  const localPython = DEFAULT_LV_CHORDIA_PYTHON_CANDIDATES.find(candidate => fs.existsSync(candidate));
  if (localPython) return localPython;
  return process.env.PYTHON || 'python';
}

function lvChordiaWorkingDirectory() {
  if (process.env.LV_CHORDIA_CWD) return process.env.LV_CHORDIA_CWD;
  return __dirname;
}

function runProcess(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: __dirname,
      windowsHide: true,
      ...options
    });
    let stdout = '';
    let stderr = '';
    let finished = false;
    const timeout = setTimeout(() => {
      if (finished) return;
      finished = true;
      child.kill();
      reject(new Error('lv-chordia timed out while classifying audio'));
    }, Number(process.env.LV_CHORDIA_TIMEOUT_MS || 90000));

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });
    child.on('error', error => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', code => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error((stderr || stdout || `lv-chordia exited with code ${code}`).trim()));
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}

function audioExtensionFromMime(mimeType) {
  if (/wav/i.test(String(mimeType))) return '.wav';
  if (/mpeg|mp3/i.test(String(mimeType))) return '.mp3';
  if (/ogg/i.test(String(mimeType))) return '.ogg';
  if (/webm/i.test(String(mimeType))) return '.webm';
  return '.wav';
}

function normalizeLvChordSymbol(symbol) {
  const raw = String(symbol || 'N').trim();
  if (!raw || raw === 'N') return 'N';

  return raw
    .replace(/:maj7/i, 'maj7')
    .replace(/:min7/i, 'm7')
    .replace(/:maj/i, '')
    .replace(/:min/i, 'm')
    .replace(/:dim/i, 'dim')
    .replace(/:aug/i, 'aug')
    .replace(/:sus4/i, 'sus4')
    .replace(/:sus2/i, 'sus2')
    .replace(/:7/i, '7');
}

function confidenceFromLvSegments(chord, segments) {
  const total = (segments || []).reduce((sum, item) => {
    return sum + Math.max(0, Number(item.end_time) - Number(item.start_time));
  }, 0);
  if (!total) return chord === 'N' ? 0 : 75;

  const chordDuration = (segments || []).reduce((sum, item) => {
    return item.chord === chord
      ? sum + Math.max(0, Number(item.end_time) - Number(item.start_time))
      : sum;
  }, 0);
  return Math.max(1, Math.min(100, Math.round(chordDuration / total * 100)));
}

async function writeRequestAudioFile(body) {
  const audioBase64 = body.audioWavBase64 || body.audioBase64;
  if (!audioBase64) throw new Error('No audio data received');

  const tempDir = path.join(os.tmpdir(), `maapah-lvchordia-${crypto.randomUUID()}`);
  await fs.promises.mkdir(tempDir, { recursive: true });

  const mimeType = body.audioWavBase64 ? 'audio/wav' : body.mimeType;
  const audioPath = path.join(tempDir, `capture${audioExtensionFromMime(mimeType)}`);
  const buffer = Buffer.from(String(audioBase64), 'base64');
  if (!buffer.length) throw new Error('Audio data was empty');
  await fs.promises.writeFile(audioPath, buffer);
  return { tempDir, audioPath };
}

async function classifyWithLvChordia(body) {
  const { tempDir, audioPath } = await writeRequestAudioFile(body);
  try {
    const { stdout, stderr } = await runProcess(lvChordiaPythonCommand(), [
      LV_CHORDIA_SCRIPT,
      audioPath,
      '--chord-dict',
      process.env.LV_CHORDIA_CHORD_DICT || 'submission'
    ], { cwd: lvChordiaWorkingDirectory() });
    const jsonLine = stdout.trim().split(/\r?\n/).filter(Boolean).pop();
    if (!jsonLine) throw new Error((stderr || 'lv-chordia returned no output').trim());

    const result = JSON.parse(jsonLine);
    return {
      ...result,
      rawChord: result.chord || 'N',
      chord: normalizeLvChordSymbol(result.chord)
    };
  } finally {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  }
}

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });
    if (username.length < 3) return res.status(400).json({ error: 'Username min 3 chars' });
    if (password.length < 6) return res.status(400).json({ error: 'Password min 6 chars' });
    if (await User.findOne({ username: username.toLowerCase() })) return res.status(409).json({ error: 'Username taken' });

    const hash = await bcrypt.hash(password, 12);
    const user = await User.create({ username: username.toLowerCase(), password: hash });
    const token = jwt.sign({ id: user._id, username: user.username }, SECRET, { expiresIn: '7d' });

    res.status(201).json({ token, user: { id: user._id, username: user.username, level: user.level, xp: user.xp, score: user.score } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Fields required' });

    const user = await User.findOne({ username: username.toLowerCase() });
    if (!user || !await bcrypt.compare(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id, username: user.username }, SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, level: user.level, xp: user.xp, score: user.score } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/auth/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/user/progress', auth, async (req, res) => {
  try {
    const { xp, level, score, monstersDefeated } = req.body;
    const update = {};
    if (xp !== undefined) update.xp = xp;
    if (level !== undefined) update.level = level;
    if (score !== undefined) update.score = score;
    if (monstersDefeated !== undefined) update.monstersDefeated = monstersDefeated;

    const user = await User.findByIdAndUpdate(req.user.id, { $set: update }, { new: true }).select('-password');
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/leaderboard', async (req, res) => {
  try {
    const users = await User.find({}).sort({ score: -1 }).limit(10).select('username level score monstersDefeated');
    res.json({ leaderboard: users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/music/search', auth, async (req, res) => {
  try {
    const query = encodeURIComponent(req.query.q || '');
    if (!query) return res.status(400).json({ error: 'Query required' });

    const response = await fetch(`https://musicbrainz.org/ws/2/recording/?query=${query}&limit=5&fmt=json`, {
      headers: { 'User-Agent': 'MaaPahDeed/1.0' }
    });
    const data = await response.json();

    res.json({
      results: (data.recordings || []).map(recording => ({
        id: recording.id,
        title: recording.title,
        artist: recording['artist-credit'] && recording['artist-credit'][0] && recording['artist-credit'][0].name || 'Unknown',
        duration: recording.length ? Math.round(recording.length / 1000) : null
      }))
    });
  } catch {
    res.status(500).json({ error: 'MusicBrainz failed' });
  }
});

app.get('/api/music/chords', optionalAuth, async (req, res) => {
  const artist = String(req.query.artist || '').trim();
  const song = String(req.query.song || '').trim();

  try {
    if (!artist || !song) return res.status(400).json({ error: 'Artist and song are required' });

    const result = await enrichSongResult(await fetchEChordsSong(artist, song), artist, song);
    await recordSongSearch(result, req.user && req.user.id);
    res.json(result);
  } catch (error) {
    const fallback = fallbackSongChords(artist, song, error.message);
    if (fallback && fallback.chords.length) {
      const result = await enrichSongResult(fallback, artist, song);
      await recordSongSearch(result, req.user && req.user.id);
      res.json(result);
      return;
    }

    res.status(error.status || 500).json({ error: error.message || 'Song chord lookup failed' });
  }
});

app.get('/api/music/library', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('savedSongs recentSongs');
    res.json({
      savedSongs: (user.savedSongs || []).map(publicSongItem),
      recentSongs: (user.recentSongs || []).slice(0, 3).map(publicSongItem)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/music/library', auth, async (req, res) => {
  try {
    const item = songItemFromResult(req.body);
    if (!item.artist || !item.song || !item.songKey || item.songKey === '/') {
      return res.status(400).json({ error: 'Artist and song are required' });
    }

    const user = await User.findById(req.user.id);
    const existing = (user.savedSongs || []).find(song => song.songKey === item.songKey);
    if (existing) {
      Object.assign(existing, { ...item, note: existing.note || '', savedAt: existing.savedAt || new Date() });
    } else {
      user.savedSongs.unshift({ ...item, savedAt: new Date(), note: '' });
    }
    user.updatedAt = new Date();
    await user.save();
    res.status(existing ? 200 : 201).json({ savedSongs: user.savedSongs.map(publicSongItem) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.patch('/api/music/library/:songKey', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const song = (user.savedSongs || []).find(item => item.songKey === req.params.songKey);
    if (!song) return res.status(404).json({ error: 'Saved song not found' });

    if (req.body.note !== undefined) song.note = String(req.body.note).slice(0, 240);
    if (req.body.artist !== undefined) song.artist = String(req.body.artist).trim() || song.artist;
    if (req.body.song !== undefined) song.song = String(req.body.song).trim() || song.song;
    song.updatedAt = new Date();
    user.updatedAt = new Date();
    await user.save();
    res.json({ savedSongs: user.savedSongs.map(publicSongItem) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.delete('/api/music/library/:songKey', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.savedSongs = (user.savedSongs || []).filter(item => item.songKey !== req.params.songKey);
    user.updatedAt = new Date();
    await user.save();
    res.json({ savedSongs: user.savedSongs.map(publicSongItem) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/music/charts/top-searches', auth, async (req, res) => {
  try {
    const songs = await SongSearch.find({}).sort({ count: -1, lastSearchedAt: -1 }).limit(3);
    res.json({ songs });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/chords/analyze', async (req, res) => {
  const inputNotes = uniqueNotes(req.body.notes);
  if (inputNotes.length < 2) return res.status(400).json({ error: 'Play at least two different notes' });

  let source = 'Chords API';
  let externalApiError = null;
  let matches = [];

  try {
    const externalChords = await fetchExternalChords();
    matches = scoreChords(inputNotes, externalChords);
  } catch (error) {
    source = 'Local fallback after Chords API error';
    externalApiError = error.message;
    matches = scoreChords(inputNotes, LOCAL_CHORDS);
  }

  res.json({ source, externalApiError, inputNotes, matches });
});

app.post('/api/chords/analyze-audio', async (req, res) => {
  const { noteHints = [] } = req.body;
  const inputNotes = uniqueNotes(noteHints);
  const hintMatches = inputNotes.length >= 2 ? scoreChords(inputNotes, LOCAL_CHORDS) : [];
  let lvChordiaError = null;

  if (req.body.audioWavBase64 || req.body.audioBase64) {
    try {
      const lvResult = await classifyWithLvChordia(req.body);
      const rawChord = lvResult.rawChord || lvResult.chord || 'N';
      const chordName = lvResult.chord || 'N';
      const confidence = confidenceFromLvSegments(rawChord, lvResult.segments);

      return res.json({
        source: 'lv-chordia',
        inputNotes,
        matches: hintMatches,
        segments: lvResult.segments || [],
        device: lvResult.device,
        elapsedSeconds: lvResult.elapsedSeconds,
        chord: {
          chord: chordName === 'N' ? 'No chord' : chordName,
          rawChord,
          confidence,
          notes: chordName === 'N' ? [] : chordSymbolToNotes(chordName),
          feedback: chordName === 'N'
            ? 'lv-chordia did not find a stable chord in this recording.'
            : `lv-chordia detected ${chordName}.`,
          practiceTip: 'Strum once clearly and let the chord ring through the recording window.'
        }
      });
    } catch (error) {
      lvChordiaError = error.message;
      console.warn('lv-chordia analysis failed:', error.message);
    }
  }

  if (inputNotes.length < 2) {
    return res.status(400).json({
      error: lvChordiaError || 'Play 2-4 clear notes first',
      inputNotes,
      matches: hintMatches,
      lvChordiaError
    });
  }

  const bestMatch = hintMatches[0] || null;
  res.json({
    source: lvChordiaError ? 'Local chord analysis after lv-chordia error' : 'Local chord analysis',
    lvChordiaError,
    inputNotes,
    matches: hintMatches,
    chord: bestMatch ? {
      chord: bestMatch.name,
      confidence: bestMatch.confidence,
      notes: bestMatch.notes,
      feedback: 'Matched from detected notes.',
      practiceTip: 'Pick each string clearly for a steadier chord match.'
    } : null
  });
});

app.get('/api/music/key-suggest', auth, (req, res) => {
  const notes = (req.query.notes || '').split(',').map(note => note.trim()).filter(Boolean);
  const scales = {
    'C major': ['C', 'D', 'E', 'F', 'G', 'A', 'B'],
    'G major': ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
    'D major': ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'],
    'A minor': ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
    'E minor': ['E', 'F#', 'G', 'A', 'B', 'C', 'D'],
    'D minor': ['D', 'E', 'F', 'G', 'A', 'Bb', 'C']
  };

  const suggestions = Object.entries(scales)
    .map(([key, scale]) => ({
      key,
      score: notes.length ? Math.round(notes.filter(note => scale.includes(note)).length / notes.length * 100) : 0
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  res.json({ suggestions });
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/index.html')));

app.listen(PORT, () => console.log(`MaaPahDeed running on http://localhost:${PORT}`));
