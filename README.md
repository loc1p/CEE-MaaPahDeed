# MaaPahDeed

MaaPahDeed is a guitar learning web application built as a Computer Engineering Essential final project. The app helps guitar learners practice chord recognition through an RPG-style Battle mode, local chord detection, camera-based Chord Cam interaction, real song chord lookup, saved song collections, and a small music dashboard.

## Features

- User registration, login, session restore, and logout
- Battle mode for guitar chord practice with local microphone-based chord hit detection
- Guitar fretboard guide that shows chord finger positions, open strings, and red muted-string markers, using local shapes first and All Guitar Chords when a shape is missing
- Song Chord Quest that loads chords for real songs
- Chord Cam using camera-based hand/gesture tracking
- Saved Songs library with create, read, update, and delete behavior
- Song Library Dashboard with recent songs, saved songs, and top searched songs
- Light/Dark theme toggle with saved user preference
- External API integration for song/chord lookup, guitar chord shapes, and music metadata
- Chord readout that shows the latest successfully hit chord, including normalized chord names such as `Dm`, `Bb`, and `Bmaj7`

## Final Project Requirement Mapping

### Basic Requirements

| Requirement | How MaaPahDeed Meets It |
| --- | --- |
| User Login | Users can register an account, log in, stay signed in across refreshes, and log out. Passwords are hashed in the backend. |
| API Integration | The backend calls external music/chord APIs, including E-Chords/MusicBrainz-style song metadata lookup, All Guitar Chords guitar-shape lookup, and chord analysis endpoints. API responses are used directly in Battle, the fretboard guide, and Song Chord Quest. |
| Deployed & Live | The frontend is deployed on Firebase Hosting and opens from a public HTTPS URL. The production frontend calls the Render backend API for login, saved songs, dashboard data, chord lookup, and health checks. |

### Challenging Requirements

Primary optional tier to claim:

- Tier S - Computer Vision: Chord Cam uses the user's camera and MediaPipe hand/face tracking to understand body/hand movement as interactive guitar input.

Additional implemented features:

- Tier B - Saved / Favorites: users can save songs to their own library, edit notes, reload saved songs, and delete them.
- Tier B - Dashboard & Data Visualization: Song Library Dashboard shows recent songs, saved songs, and top searched songs from real backend data.
- Tier C - Dark Mode / Theme Toggle: users can switch between dark mode and light mode, and the browser remembers the selected theme.

The challenging requirement score is capped at 20 points, so one Tier S feature is enough to reach the maximum for that section.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB with Mongoose
- Authentication: JWT, bcryptjs
- APIs / Libraries: E-Chords style song chord lookup, All Guitar Chords shape lookup, MusicBrainz/Cover Art metadata lookup, Chords API fallback, lv-chordia, MediaPipe Hands, MediaPipe Face Mesh, Web Audio API, Pitchy
- Deployment: Firebase Hosting for the frontend, Render web service for the backend API, and MongoDB Atlas for the database

## Project Structure

```text
CEE-MaaPahDeed-main/
  backend/
    models/
      SongSearch.js
      User.js
    .env.example
    package.json
    server.js
  frontend/
    audio/
    css/
      style.css
    js/
      app.js
      audio.js
      battle.js
      game.js
      vision.js
    index.html
  README.md
```

## Environment Variables

Create a private environment file at:

```text
backend/.env
```

Use `backend/.env.example` as the template:

```env
MONGO_URI=mongodb://127.0.0.1:27017/maapah
JWT_SECRET=change-this-secret
```

Important: do not commit `backend/.env`. Database URLs, JWT secrets, and other private configuration must stay private.

## Local Setup

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Create environment file

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Then edit `backend/.env` and set:

- `MONGO_URI`
- `JWT_SECRET`

### 3. Start MongoDB

Use either:

- local MongoDB at `mongodb://127.0.0.1:27017/maapah`
- MongoDB Atlas connection string in `MONGO_URI`

### 4. Run the backend

```bash
npm run dev
```

Backend default URL:

```text
http://localhost:5001
```

Health check:

```text
http://localhost:5001/api/health
```

### 5. Open the frontend

Recommended local URL:

```text
http://localhost:5001
```

The backend serves the frontend from the `frontend/` folder. Camera and microphone features work best on `localhost` or HTTPS.

## Public Deployment

The public demo uses Firebase Hosting for the static frontend and Render for the Express backend API. Firebase serves the files in `frontend/`; when opened from a Firebase domain, the frontend uses the Render API base URL configured in `frontend/js/app.js`. The Firebase target is the default project in `.firebaserc`: `project-5101d58b-03f9-4d7e-a71`.

```text
Live URL: https://project-5101d58b-03f9-4d7e-a71.web.app/
Backend URL: http://maapahdeed-8597.onrender.com/api
Health Check: http://maapahdeed-8597.onrender.com/api/health
```

Frontend deployment steps:

1. Pull the latest code from GitHub.
2. Confirm `.firebaserc` points to project `project-5101d58b-03f9-4d7e-a71`.
3. Deploy the latest `frontend/` files:

```bash
firebase deploy --only hosting
```

Backend deployment steps:

1. Create a MongoDB Atlas database and copy its connection string.
2. In Render, create a new Blueprint from this repo. Render reads `render.yaml`.
3. Add required environment variables in Render:
   - `MONGO_URI`
4. Deploy, then open `/api/health` on the public URL to verify the backend.

## Useful API Routes

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`

### Song / Music

- `GET /api/music/chords?artist=<artist>&song=<song>`
- `GET /api/music/library`
- `POST /api/music/library`
- `PATCH /api/music/library/:songKey`
- `DELETE /api/music/library/:songKey`
- `GET /api/music/charts/top-searches`

### Chords / Battle

- `POST /api/chords/analyze`
- `POST /api/chords/analyze-audio` - local chord matching from detected note hints
- `GET /api/chords/shape?symbol=<chord>` - guitar chord shape lookup from All Guitar Chords when no local shape exists

### Other

- `GET /api/leaderboard`
- `GET /api/health`

## Deployment Notes

Recommended deployment:

- Frontend: Firebase Hosting using `firebase.json`
- Backend: Render Blueprint using `render.yaml`
- Database: MongoDB Atlas
- Environment variables: set `MONGO_URI` in the Render dashboard

Current public links:

- Live URL: https://project-5101d58b-03f9-4d7e-a71.web.app/
- Backend URL: http://maapahdeed-8597.onrender.com/api
- GitHub URL: https://github.com/loc1p/CEE-MaaPahDeed

Deployment status: Firebase Hosting has been updated from the current `main` codebase.

## Demo Checklist

Use this checklist for the final video:

- Open the public live URL from a fresh browser tab
- Register a new user
- Log out
- Log back in
- Search for a real song in Song Chord Quest
- Show the external API result being used as Battle chord targets
- Play Battle mode and show the fretboard chord guide
- Point out the fretboard finger dots, open-string marks, and red muted-string circles/X marks
- Show that uncommon chords can load guitar positions from All Guitar Chords, while common local shapes still load instantly
- Show chord names such as `Dm`, `Bb`, and `Bmaj7` displaying with the correct letter case
- Hit a target chord and show the latest hit chord in the Chord readout
- Open Chord Cam and show camera-based interaction
- Save a song
- Refresh the page and show the saved song still exists
- Edit a saved song note
- Delete a saved song
- Show Song Library Dashboard / top searched songs
- Switch between Light and Dark mode

## Team Members

1. Supphanat Thanaphon
2. Wiramorn Ounruan
3. Prompassorn Piriyavinit

## Links

- GitHub: https://github.com/loc1p/CEE-MaaPahDeed
- Live URL: https://project-5101d58b-03f9-4d7e-a71.web.app/
- Backend URL: http://maapahdeed-8597.onrender.com/api
- Video URL: TODO
