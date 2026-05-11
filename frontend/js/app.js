const App = {
  baseUrl: location.protocol === 'file:'
    ? 'http://localhost:5001/api'
    : location.hostname.endsWith('.web.app') || location.hostname.endsWith('.firebaseapp.com')
      ? 'https://maapahdeed-8597.onrender.com/api'
      : `${location.origin}/api`,
  user: null,
  token: localStorage.getItem('maapah_token'),
  cachedUser: JSON.parse(localStorage.getItem('maapah_user') || 'null'),
  currentMenu: 'battle',
  currentSongResult: null,
  theme: localStorage.getItem('maapah_theme') || 'dark',

  unlockAudio() {
    if (typeof AudioEngine !== 'undefined') {
      AudioEngine.init();
    }
  },

  applyTheme() {
    document.body.classList.toggle('theme-light', this.theme === 'light');
    document.body.classList.toggle('theme-dark', this.theme !== 'light');

    const toggle = document.getElementById('theme-toggle');
    if (toggle) {
      toggle.textContent = this.theme === 'light' ? 'Dark' : 'Light';
      toggle.setAttribute('aria-label', `Switch to ${this.theme === 'light' ? 'dark' : 'light'} mode`);
    }
  },

  toggleTheme() {
    this.theme = this.theme === 'light' ? 'dark' : 'light';
    localStorage.setItem('maapah_theme', this.theme);
    this.applyTheme();
  },

  switchMenu(menuId) {
    this.unlockAudio();
    console.log("Switching to:", menuId);

    document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    const activeSection = document.getElementById(`menu-${menuId}`);
    if (activeSection) {
      activeSection.classList.add('active');
      this.currentMenu = menuId;
    }

    const activeBtn = document.querySelector(`[data-menu="${menuId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

  },

  async handleAuth(e) {
    e.preventDefault();
    this.unlockAudio();

    const isLogin = document.getElementById('tab-login').classList.contains('active');
    const usernameInput = document.getElementById('auth-username');
    const passwordInput = document.getElementById('auth-password');
    const submit = document.getElementById('auth-submit');
    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    this.setAuthMessage('', '');
    if (submit) submit.disabled = true;

    try {
      const res = await fetch(`${this.baseUrl}/auth/${isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (!res.ok || !data.token) {
        throw new Error(data.error || 'Authentication failed');
      }

      if (!isLogin) {
        localStorage.removeItem('maapah_token');
        localStorage.removeItem('maapah_user');
        this.token = null;
        this.user = null;
        usernameInput.value = '';
        passwordInput.value = '';
        this.showAuthTab('login', { keepValues: true });
        this.setAuthMessage('Register complete. Please sign in with your new account.', 'success');
        return;
      }

      localStorage.setItem('maapah_token', data.token);
      localStorage.setItem('maapah_user', JSON.stringify(data.user));
      this.token = data.token;
      this.user = data.user;
      this.showApp();
    } catch (err) {
      console.error("Auth Error:", err);
      this.setAuthMessage(err.message || 'Authentication failed', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  },

  showApp() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('nav-bar').classList.remove('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('nav-user').textContent = `◆ ${this.user.username.toUpperCase()}`;
    this.syncBattleUser();

    this.switchMenu('battle');
    this.loadMusicDashboard();
  },

  syncBattleUser() {
    const username = this.user && this.user.username ? this.user.username : 'Player';
    const level = this.user && this.user.level ? this.user.level : 1;
    const battleUsername = document.getElementById('battle-username');
    const battleLevel = document.getElementById('battle-level');
    if (battleUsername) battleUsername.textContent = username;
    if (battleLevel) battleLevel.textContent = level;
  },

  async restoreSession() {
    if (!this.token) return;

    if (this.cachedUser) {
      this.user = this.cachedUser;
      this.showApp();
    }

    try {
      const res = await fetch(`${this.baseUrl}/auth/me`, {
        headers: { Authorization: `Bearer ${this.token}` }
      });
      const data = await res.json();

      if (!res.ok || !data.user) {
        throw new Error(data.error || 'Session expired');
      }

      this.user = data.user;
      localStorage.setItem('maapah_user', JSON.stringify(data.user));
      this.showApp();
    } catch (err) {
      console.warn('Could not restore session:', err);
      localStorage.removeItem('maapah_token');
      localStorage.removeItem('maapah_user');
      this.token = null;
      this.user = null;
    }
  },

  authHeaders(extra = {}) {
    return this.token ? { ...extra, Authorization: `Bearer ${this.token}` } : extra;
  },

  formatChordSymbol(symbol) {
    const clean = String(symbol || '')
      .replace(/\s+/g, '')
      .replace(/\u266f/g, '#')
      .replace(/\u266d/g, 'b')
      .trim();
    return clean.replace(/^([A-Ga-g])([#bB]?)(.*)$/, (_, root, accidental, suffix) => {
      const fixedAccidental = accidental === '#' ? '#' : accidental ? 'b' : '';
      const fixedSuffix = this.formatChordSuffix(suffix);
      return `${root.toUpperCase()}${fixedAccidental}${fixedSuffix}`;
    });
  },

  formatChordSuffix(suffix) {
    return String(suffix || '')
      .replace(/minor/ig, 'm')
      .replace(/major/ig, 'maj')
      .replace(/[A-Za-z]+/g, part => part.toLowerCase())
      .replace(/^min/, 'm')
      .replace(/\/([a-g])([#b]?)/g, (_, root, accidental) => `/${root.toUpperCase()}${accidental}`);
  },

  async searchMusic() {
    const artist = document.getElementById('song-artist').value.trim();
    const song = document.getElementById('song-title').value.trim();
    const results = document.getElementById('mb-results');

    if (!artist || !song) {
      results.innerHTML = '<div class="chord-analysis-meta">Enter both artist and song name.</div>';
      return;
    }

    results.innerHTML = '<div class="chord-analysis-meta">Loading song chords...</div>';

    try {
      const params = new URLSearchParams({ artist, song });
      const res = await fetch(`${this.baseUrl}/music/chords?${params}`, {
        headers: this.authHeaders()
      });
      const data = await this.readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Song chord lookup failed');

      if (!data.chords || data.chords.length === 0) {
        this.currentSongResult = null;
        document.getElementById('song-save-btn')?.classList.add('hidden');
        results.innerHTML = '<div class="chord-analysis-meta">No playable chords found for this song.</div>';
        return;
      }

      Battle.loadSongChords(data.chords, data);
      this.currentSongResult = data;
      const sourceNote = data.fallback
        ? `<div class="chord-analysis-meta">Fallback loaded: ${this.escapeHtml(data.externalApiError || 'external source unavailable')}</div>`
        : `<div class="chord-analysis-meta">Source: ${this.escapeHtml(data.source || 'Song chord API')}</div>`;
      results.innerHTML = `
        ${data.coverUrl ? `<img class="song-result-cover" src="${this.escapeHtml(data.coverUrl)}" alt="">` : ''}
        <div class="chord-analysis-title">${this.escapeHtml(data.song)} <span>${this.escapeHtml(data.key || 'key ?')}</span></div>
        <div class="chord-analysis-meta">${this.escapeHtml(data.artist)} - ${this.escapeHtml(data.chords.length)} chords loaded</div>
        <div class="chord-analysis-meta">Powered by E-Chords</div>
        ${sourceNote}
        <div class="chord-analysis-meta">${data.chords.map(chord => this.escapeHtml(this.formatChordSymbol(chord.symbol))).join(' - ')}</div>
      `;
      document.getElementById('song-save-btn')?.classList.remove('hidden');
      this.loadMusicDashboard();
    } catch (err) {
      console.error('Song chord search error:', err);
      results.innerHTML = `<div class="chord-analysis-title">"${song}"</div><div class="chord-analysis-meta"></div><div class="chord-analysis-title">song lookup failed</div><div class="chord-analysis-meta">${this.escapeHtml(err.message)}</div>`;
    }
  },

  async loadMusicDashboard() {
    if (!this.token) return;
    try {
      const [libraryRes, chartRes] = await Promise.all([
        fetch(`${this.baseUrl}/music/library`, { headers: this.authHeaders() }),
        fetch(`${this.baseUrl}/music/charts/top-searches`, { headers: this.authHeaders() })
      ]);
      const library = await this.readJsonResponse(libraryRes);
      const chart = await this.readJsonResponse(chartRes);
      if (!libraryRes.ok) throw new Error(library.error || 'Library failed');
      if (!chartRes.ok) throw new Error(chart.error || 'Chart failed');

      this.renderSongList('song-recent-list', library.recentSongs || [], { recent: true });
      this.renderSongList('song-saved-list', library.savedSongs || [], { saved: true });
      this.renderSongChart(chart.songs || []);
    } catch (err) {
      console.warn('Music dashboard failed:', err);
    }
  },

  renderSongList(id, songs, options = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    if (!songs.length) {
      el.innerHTML = '<div class="song-empty">No songs yet.</div>';
      return;
    }
    el.innerHTML = songs.map(song => `
      <div class="song-mini-card">
        ${song.coverUrl ? `<img class="song-cover" src="${this.escapeHtml(song.coverUrl)}" alt="">` : '<div class="song-cover song-cover-empty">♪</div>'}
        <div class="song-card-main">
          <button class="song-link" onclick="App.loadSongFromLibrary('${encodeURIComponent(song.artist)}', '${encodeURIComponent(song.song)}')">${this.escapeHtml(song.song)}</button>
          <div class="song-meta">${this.escapeHtml(song.artist)} · ${this.escapeHtml(song.chordsCount || 0)} chords</div>
          ${options.saved ? `<input class="song-note" value="${this.escapeHtml(song.note || '')}" placeholder="Personal note" onchange="App.updateSavedSong('${encodeURIComponent(song.songKey)}', this.value)">` : ''}
        </div>
        ${options.saved ? `<button class="song-delete" onclick="App.deleteSavedSong('${encodeURIComponent(song.songKey)}')" title="Delete saved song">×</button>` : ''}
      </div>
    `).join('');
  },

  renderSongChart(songs) {
    const el = document.getElementById('song-chart');
    if (!el) return;
    if (!songs.length) {
      el.innerHTML = '<div class="song-empty">No searches yet.</div>';
      return;
    }
    const max = Math.max(...songs.map(song => song.count || 0), 1);
    el.innerHTML = songs.map((song, index) => `
      <div class="song-chart-row">
        <span class="song-rank">#${index + 1}</span>
        ${song.coverUrl ? `<img class="song-cover song-cover-sm" src="${this.escapeHtml(song.coverUrl)}" alt="">` : '<div class="song-cover song-cover-sm song-cover-empty">♪</div>'}
        <div class="song-chart-main">
          <div class="song-chart-label" tabindex="0" data-full-name="${this.escapeHtml(`${song.song}, ${song.artist}`)}">${this.escapeHtml(song.song)}, <span>${this.escapeHtml(song.artist)}</span></div>
          <div class="song-chart-track"><div class="song-chart-fill" style="width:${Math.max(8, Math.round((song.count || 0) / max * 100))}%"></div></div>
        </div>
        <span class="song-count">${song.count || 0}</span>
      </div>
    `).join('');
  },

  async saveCurrentSong() {
    if (!this.currentSongResult) return;
    try {
      const res = await fetch(`${this.baseUrl}/music/library`, {
        method: 'POST',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(this.currentSongResult)
      });
      const data = await this.readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Save failed');
      this.loadMusicDashboard();
    } catch (err) {
      alert(err.message);
    }
  },

  async updateSavedSong(encodedSongKey, note) {
    try {
      const res = await fetch(`${this.baseUrl}/music/library/${encodedSongKey}`, {
        method: 'PATCH',
        headers: this.authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ note })
      });
      const data = await this.readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Update failed');
    } catch (err) {
      alert(err.message);
    }
  },

  async deleteSavedSong(encodedSongKey) {
    try {
      const res = await fetch(`${this.baseUrl}/music/library/${encodedSongKey}`, {
        method: 'DELETE',
        headers: this.authHeaders()
      });
      const data = await this.readJsonResponse(res);
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      this.loadMusicDashboard();
    } catch (err) {
      alert(err.message);
    }
  },

  loadSongFromLibrary(encodedArtist, encodedSong) {
    document.getElementById('song-artist').value = decodeURIComponent(encodedArtist);
    document.getElementById('song-title').value = decodeURIComponent(encodedSong);
    this.searchMusic();
  },

  showAuthTab(type, options = {}) {
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');

    const username = document.getElementById('auth-username');
    const password = document.getElementById('auth-password');
    if (!options.keepValues) {
      username.value = '';
      password.value = '';
    }

    this.setAuthMessage('', '');

    const note = document.getElementById('auth-note');
    if (type === 'register') {
      note.textContent = "Already have an account? Switch to Sign In above.";
    } else {
      note.textContent = "Don't have an account? Switch to Register above.";
    }
  },

  setAuthMessage(message, type = 'error') {
    const el = document.getElementById('auth-error');
    if (!el) return;

    el.textContent = message;
    el.classList.toggle('hidden', !message);
    el.classList.toggle('success', type === 'success');
  },

  logout() {
    localStorage.removeItem('maapah_token');
    localStorage.removeItem('maapah_user');
    location.reload();
  }
};

App.readJsonResponse = async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned ${response.status || 'a non-JSON response'}: ${response.statusText || text.slice(0, 80) || 'Unexpected response'}`);
  }
};

App.escapeHtml = function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
};

window.addEventListener('load', () => {
  console.log("MaaPahDeed Ready");
  App.applyTheme();
  App.restoreSession();
});
