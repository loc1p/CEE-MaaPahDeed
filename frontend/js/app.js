const App = {
  baseUrl: 'http://localhost:5001/api',
  user: null,
  token: localStorage.getItem('maapah_token'),
  currentMenu: 'battle',

  // 1. ฟังก์ชันปลดล็อกเสียง (สำคัญมากเพื่อให้เสียงดัง)
  unlockAudio() {
    if (typeof AudioEngine !== 'undefined') {
      AudioEngine.init();
    }
  },

  switchMenu(menuId) {
    this.unlockAudio(); 
    console.log("Switching to:", menuId);

    // 1. จัดการ UI: ซ่อนทุก Section และลบ Active ที่ปุ่ม
    document.querySelectorAll('.menu-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

    // 2. แสดงหน้าส่วนที่เลือก
    const activeSection = document.getElementById(`menu-${menuId}`);
    if (activeSection) {
      activeSection.classList.add('active');
      this.currentMenu = menuId;
    }

    // 3. ไฮไลท์ปุ่มใน Nav ให้เป็นสีทอง
    const activeBtn = document.querySelector(`[data-menu="${menuId}"]`);
    if (activeBtn) {
      activeBtn.classList.add('active');
    }

    // --- ตรรกะพิเศษรายเมนู ---
    
    // ถ้าเข้าหน้า Guitar ให้วาด Fretboard
    if (menuId === 'guitar' && typeof Guitar !== 'undefined') {
      Guitar.renderFretboard();
    }

    // ถ้ากดออกจากเมนู Game ให้สั่งหยุดโน้ตหล่นทันที
    if (menuId !== 'game' && typeof Game !== 'undefined' && Game.rgStop) {
      Game.rgStop();
    }
  },

  // 3. ระบบ Authentication
  async handleAuth(e) {
    e.preventDefault();
    this.unlockAudio(); // ปลดล็อกเสียงเมื่อกดปุ่มเข้า Studio

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
        this.user = data.user;
        this.showApp();
      } else {
        alert(data.error || "Authentication failed");
      }
    } catch (err) {
      console.error("Auth Error:", err);
      // Fallback สำหรับกรณีรันแบบไม่มี Backend (เพื่อทดสอบ UI)
      this.user = { username: username || "Guest" };
      this.showApp();
    }
  },

  // 4. แสดงหน้าแอปหลักหลัง Login
  showApp() {
    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('nav-bar').classList.remove('hidden');
    document.getElementById('app').classList.remove('hidden');
    document.getElementById('nav-user').textContent = `◆ ${this.user.username.toUpperCase()}`;
    
    // เริ่มต้นที่หน้า Battle
    this.switchMenu('battle');
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
    location.reload();
  }
};

// สั่งให้พร้อมทำงานเมื่อโหลดหน้าเว็บ
window.addEventListener('load', () => {
  console.log("MaaPahDeed Ready");
});