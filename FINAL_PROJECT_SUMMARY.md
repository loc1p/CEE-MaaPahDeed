# 1-Page Summary: MaaPahDeed

## App Name

MaaPahDeed - AI Guitar Learning RPG

## What It Does

MaaPahDeed is a web application for guitar learners who want to practice chords in a more interactive way. The app combines an RPG-style Battle mode, real song chord lookup, a guitar fretboard guide, saved song libraries, and a camera-based Chord Cam mode to make guitar practice more visual and engaging.

Users can create their own account, search for a real song, load its chords into Battle mode, and practice those chords while seeing where to press on the guitar fretboard.

## Features Built

- User registration, login, session restore, and logout
- Guitar Battle mode with chord targets
- Fretboard guide showing chord finger positions
- Song Chord Quest using external song/chord API data
- Chord Cam using camera-based hand/gesture tracking
- Saved Songs library with create, read, update, and delete functionality
- Song Library Dashboard showing recent songs, saved songs, and top searched songs
- Light/Dark theme toggle with saved preference
- Backend API with MongoDB persistence
- Environment-variable based secret management using `.env`

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

TODO: add deployed public URL

## GitHub URL

https://github.com/loc1p/CEE-MaaPahDeed

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express.js
- Database: MongoDB, Mongoose
- Authentication: JWT, bcryptjs
- APIs / Libraries: external song/chord lookup, MusicBrainz/Cover Art metadata, Chords API fallback, MediaPipe Hands, MediaPipe Face Mesh, Web Audio API, Pitchy
- Deployment: TODO, for example Render/Railway/Vercel

## Team Members

- TODO: team member 1
- TODO: team member 2
- TODO: team member 3
