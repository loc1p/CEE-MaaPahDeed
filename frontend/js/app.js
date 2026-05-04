const App = {
  baseUrl: 'http://localhost:5001/api',
  user: null,
  token: localStorage.getItem('maapah_token'),
  cachedUser: JSON.parse(localStorage.getItem('maapah_user') || 'null'),
  currentMenu: 'battle',

  unlockAudio() {
    if (typeof AudioEngine !== 'undefined') {
      AudioEngine.init();
    }
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
    const username = document.getElementById('auth-username').value;
    const password = document.getElementById('auth-password').value;

    try {
      const res = await fetch(`${this.baseUrl}/auth/${isLogin ? 'login' : 'register'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.token) {
        localStorage.setItem('maapah_token', data.token);
        localStorage.setItem('maapah_user', JSON.stringify(data.user));
        this.token = data.token;
        this.user = data.user;
        this.showApp();
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error("Auth Error:", err);
      this.user = { username: username || "Guest" };
      this.showApp();
    }
  },

  showApp() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('nav-bar').classList.remove('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('nav-user').textContent = `◆ ${this.user.username.toUpperCase()}`;

    this.switchMenu('battle');
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

  showAuthTab(type) {
    document.getElementById('tab-login').classList.toggle('active', type === 'login');
    document.getElementById('tab-register').classList.toggle('active', type === 'register');

    const note = document.getElementById('auth-note');
    if (type === 'register') {
      note.textContent = "Already have an account? Switch to Sign In above.";
    } else {
      note.textContent = "Don't have an account? Switch to Register above.";
    }
  },

  logout() {
    localStorage.removeItem('maapah_token');
    localStorage.removeItem('maapah_user');
    location.reload();
  }
};

window.addEventListener('load', () => {
  console.log("MaaPahDeed Ready");
  App.restoreSession();
});
