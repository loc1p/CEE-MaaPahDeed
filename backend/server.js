const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const path = require('path');
const fetch = require('node-fetch');
const User = require('./models/User');

dotenv.config();

const app = express();
const SECRET = process.env.JWT_SECRET || 'maapah-dev-secret';
const PORT = process.env.PORT || 5001;

app.use(cors({ origin: '*', credentials: true }));
app.use(express.json());
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

function responseText(data) {
  if (data.output_text) return data.output_text;

  return (data.output || [])
    .flatMap(item => item.content || [])
    .filter(content => content.type === 'output_text' && content.text)
    .map(content => content.text)
    .join('\n');
}

function geminiText(data) {
  return (data.candidates || [])
    .flatMap(candidate => candidate.content && candidate.content.parts || [])
    .filter(part => part.text)
    .map(part => part.text)
    .join('\n');
}

function parseAiJson(text) {
  const jsonText = String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();

  return JSON.parse(jsonText);
}

function chordPrompt(inputNotes, matches) {
  return `Analyze these detected guitar notes: ${inputNotes.join(', ')}.
Chord candidates: ${matches.map(match => `${match.name} (${match.confidence}%)`).join(', ') || 'none'}.
Return only JSON with keys: chord, confidence, notes, feedback, practiceTip.
Keep feedback and practiceTip under 18 words each.`;
}

function audioChordPrompt(matches) {
  return `Analyze this short guitar recording. The player may strum a full chord.
Chord candidates from the app: ${matches.map(match => `${match.name} (${match.confidence}%)`).join(', ') || 'none'}.
Return only JSON with keys: chord, confidence, notes, feedback, practiceTip.
If the audio is unclear, set chord to "unclear" and explain briefly.
Keep feedback and practiceTip under 18 words each.`;
}

async function fetchGeminiChordFeedback(inputNotes, matches) {
  if (!process.env.GEMINI_API_KEY) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [{ text: chordPrompt(inputNotes, matches) }]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) throw new Error(`Gemini API HTTP ${response.status}`);
  return parseAiJson(geminiText(await response.json()));
}

async function fetchGeminiAudioChordFeedback(audioBase64, mimeType, matches = []) {
  if (!process.env.GEMINI_API_KEY) return null;

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'x-goog-api-key': process.env.GEMINI_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: audioChordPrompt(matches) },
            {
              inline_data: {
                mime_type: mimeType,
                data: audioBase64
              }
            }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) throw new Error(`Gemini audio API HTTP ${response.status}`);
  return parseAiJson(geminiText(await response.json()));
}

async function fetchAiChordFeedback(inputNotes, matches) {
  if (process.env.GEMINI_API_KEY) return fetchGeminiChordFeedback(inputNotes, matches);
  if (!process.env.OPENAI_API_KEY) return null;

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      instructions: 'You are a concise guitar teacher. Return only valid JSON.',
      input: chordPrompt(inputNotes, matches)
    })
  });

  if (!response.ok) throw new Error(`OpenAI API HTTP ${response.status}`);

  return parseAiJson(responseText(await response.json()));
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

  let ai = null;
  let aiError = null;
  try {
    ai = await fetchAiChordFeedback(inputNotes, matches);
  } catch (error) {
    aiError = error.message;
  }

  res.json({ source, externalApiError, inputNotes, matches, ai, aiError });
});

app.post('/api/chords/analyze-audio', async (req, res) => {
  const { audioBase64, mimeType = 'audio/webm', noteHints = [] } = req.body;
  if (!audioBase64) return res.status(400).json({ error: 'audioBase64 required' });
  if (!process.env.GEMINI_API_KEY) return res.status(400).json({ error: 'GEMINI_API_KEY required for audio analysis' });

  const inputNotes = uniqueNotes(noteHints);
  const hintMatches = inputNotes.length >= 2 ? scoreChords(inputNotes, LOCAL_CHORDS) : [];

  try {
    const ai = await fetchGeminiAudioChordFeedback(audioBase64, mimeType, hintMatches);
    res.json({
      source: 'Gemini audio analysis',
      inputNotes,
      matches: hintMatches,
      ai
    });
  } catch (error) {
    res.status(500).json({
      error: 'Gemini audio analysis failed',
      aiError: error.message,
      inputNotes,
      matches: hintMatches
    });
  }
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
