const mongoose = require('mongoose');

const SongSearchSchema = new mongoose.Schema({
  songKey: { type: String, required: true, unique: true },
  artist: { type: String, required: true },
  song: { type: String, required: true },
  coverUrl: { type: String, default: null },
  count: { type: Number, default: 0 },
  lastSearchedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('SongSearch', SongSearchSchema);
