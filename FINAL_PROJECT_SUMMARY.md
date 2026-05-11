# 1-Page Summary: MaaPahDeed

## App Name

MaaPahDeed - Guitar Learning RPG

## What It Does

MaaPahDeed is a web application for guitar learners who want to practice chords in a more interactive way. The app combines an RPG-style Battle mode, chord detection, real song chord lookup, a guitar fretboard guide, saved song libraries, and a camera-based Chord Cam mode to make guitar practice more visual and engaging.

Users can create their own account, search for a real song, load its chords into Battle mode, and practice those chords while seeing where to press on the guitar fretboard. The fretboard guide uses built-in local chord shapes first, then fetches missing chord shapes from All Guitar Chords. During Battle mode, the app listens through the microphone, detects chord tones, and shows the chord that was hit in the Chord readout.

## Features Built

- User registration, login, session restore, and logout
- Guitar Battle mode with chord targets and local chord hit detection
- Fretboard guide showing chord finger positions, open strings, and red muted-string markers from local shapes and All Guitar Chords fallback lookup
- Song Chord Quest using external song/chord API data
- Chord Cam using camera-based hand/gesture tracking
- Saved Songs library with create, read, update, and delete functionality
- Song Library Dashboard showing recent songs, saved songs, and top searched songs
- Light/Dark theme toggle with saved preference
- Backend API with MongoDB persistence
- Environment-variable based secret management using `.env`
- Correct chord display formatting for mixed-case chord input such as `DM` -> `Dm`, `BB` -> `Bb`, and `BMAJ7` -> `Bmaj7`

## Optional Tier Chosen

Primary claimed tier:

- Tier S - Computer Vision

Chord Cam uses the user's camera and computer vision hand/face tracking to interpret live visual input. The camera input is part of the app's core guitar interaction, not only decoration.

Additional implemented features:

- Tier B - Saved / Favorites
- Tier B - Dashboard & Data Visualization
- Tier C - Dark Mode / Theme Toggle

The challenging requirement score is capped at 20 points, so Tier S is enough to reach the maximum for this section.

## Live URL

https://project-5101d58b-03f9-4d7e-a71.web.app/

## Backend URL

https://maapahdeed-8597.onrender.com/api

## GitHub URL

https://github.com/loc1p/CEE-MaaPahDeed

## Deployment Status

Firebase Hosting is updated from the current `main` codebase and serves the frontend from the `frontend/` folder. The live frontend calls the Render backend API at the backend URL above.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB, Mongoose
- Authentication: JWT, bcryptjs
- APIs / Libraries: external song/chord lookup, All Guitar Chords shape lookup, MusicBrainz/Cover Art metadata, Chords API fallback, lv-chordia, MediaPipe Hands, MediaPipe Face Mesh, Web Audio API, Pitchy
- Deployment: Firebase Hosting for the frontend, Render web service for the backend API, and MongoDB Atlas for the database

## Team Members

- Supphanat Thanaphon
- Wiramorn Ounruan
- Prompassorn Piriyavinit
