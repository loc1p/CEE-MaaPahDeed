# MaaPahDeed - AI Guitar Ear Training RPG

MaaPahDeed is an AI-powered guitar learning web app. Users can create an account, log in, practice guitar pitch in an RPG battle mode, analyze full guitar chords from microphone audio, and use a camera-based Chord Cam experience for interactive guitar practice.

## Final Project Requirements Covered

- User Login: users can register, log in, restore their session, and log out.
- API Integration: the backend integrates with external APIs including OpenAI audio analysis, MusicBrainz search, and a chords API fallback.
- AI Feature: Battle mode records guitar audio and sends it to AI for chord analysis.
- Computer Vision Feature: Chord Cam uses MediaPipe hand/face tracking from the camera to create an interactive guitar experience.
- Live Deployment Ready: frontend can be deployed as static files, while backend can be deployed as a Node/Express API server.

## Main Features

- Account registration and login with JWT authentication
- Persistent login session using browser storage
- Guitar Battle mode with real-time pitch detection
- AI Full Chord analysis from microphone audio
- Chord matching and feedback using external API/AI integration
- Chord Cam with camera-based gesture interaction
- RPG-style UI with score, XP, streaks, monster HP, and battle log

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Authentication: JWT and bcrypt
- AI/API: OpenAI API, MusicBrainz API, Chords API, optional Gemini fallback
- Camera/Audio Libraries: MediaPipe Hands, MediaPipe Face Mesh, Web Audio API, Meyda, Pitchy

## Project Structure

```text
CEE-MaaPahDeed-main/
  backend/
    server.js
    package.json
    .env.example
  frontend/
    index.html
    css/
      style.css
    js/
      app.js
      battle.js
      vision.js
      audio.js
      game.js
```

## Environment Variables

Create `backend/.env` from `backend/.env.example`.

```env
MONGO_URI=mongodb://127.0.0.1:27017/maapah
JWT_SECRET=change-this-secret
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_AUDIO_MODEL=gpt-audio
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
```

Do not commit `backend/.env`. It contains private API keys.

## Local Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Configure environment variables

Copy the example environment file:

```bash
copy .env.example .env
```

Then edit `backend/.env` and add your MongoDB URI, JWT secret, and API keys.

### 3. Start MongoDB

Use a local MongoDB server or a MongoDB Atlas connection string.

### 4. Run the backend

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5001
```

Health check:

```text
http://localhost:5001/api/health
```

### 5. Open the frontend

Open this file in a browser:

```text
frontend/index.html
```

For microphone and camera features, use `localhost` or HTTPS. Some browsers block camera/microphone access from plain file URLs.

## Frontend API URL

The frontend API base URL is set in:

```text
frontend/js/app.js
```

For local development:

```js
baseUrl: 'http://localhost:5001/api'
```

For deployment, change it to your deployed backend URL, for example:

```js
baseUrl: 'https://your-backend-url.onrender.com/api'
```

## API Endpoints

### Authentication

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### User Data

- `PATCH /api/user/progress`
- `GET /api/leaderboard`

### Music and Chords

- `GET /api/music/search`
- `GET /api/music/key-suggest`
- `POST /api/chords/analyze`
- `POST /api/chords/analyze-audio`

## External API Integration

This project uses external APIs meaningfully in the core guitar learning flow:

- OpenAI API: analyzes recorded guitar chord audio and returns chord feedback.
- MusicBrainz API: searches real music metadata.
- Chords API: provides chord data for matching detected notes to possible chords.

If OpenAI returns HTTP 429, the API key has likely reached a quota or rate limit. Wait for the quota to reset, reduce requests, or use another valid key.

## Deployment Notes

Recommended deployment setup:

- Frontend: Vercel, Netlify, or GitHub Pages
- Backend: Render, Railway, or Fly.io
- Database: MongoDB Atlas

Backend environment variables must be added in the hosting provider dashboard. Do not put API keys directly in frontend code.

After deploying the backend, update `frontend/js/app.js` so `baseUrl` points to the public backend API URL.

## Demo Checklist

For the final project video, demonstrate:

- Open the deployed public URL in a fresh browser tab
- Register a new user
- Log out and log back in
- Start Battle mode
- Allow microphone access
- Play or strum a guitar note/chord
- Show real-time pitch detection
- Use `AI Full Chord 3s`
- Show the AI/API response being used in the app
- Open Chord Cam and demonstrate camera interaction
- Explain the claimed Tier S feature: Speech / Audio AI and Computer Vision

## Team Members

- Add team member 1
- Add team member 2
- Add team member 3

## GitHub and Live URL

- GitHub: https://github.com/loc1p/CEE-MaaPahDeed
- Live URL: add deployed frontend URL here
- Backend URL: add deployed backend URL here
