const Game = {
  rg: {
    running: false,
    score: 0,
    lanes: [ [], [], [], [] ], // เก็บข้อมูลโน้ตในแต่ละเลน
    keys: ['D', 'F', 'J', 'K'],
    speed: 4,
    timer: null
  },

  // เริ่ม/หยุดเกม
  rgToggle() {
    if (this.rg.running) {
      this.rgStop();
    } else {
      this.rgStart();
    }
  },

  rgStart() {
    this.rg.running = true;
    this.rg.score = 0;
    document.getElementById('rg-score').textContent = '0';
    document.getElementById('rg-start-btn').textContent = '■ STOP QUEST';
    this.rgLoop();
  },

  rgStop() {
    this.rg.running = false;
    document.getElementById('rg-start-btn').textContent = '◆ START QUEST';
    cancelAnimationFrame(this.rg.timer);
    // ลบโน้ตที่ค้างอยู่
    document.querySelectorAll('.rg-note').forEach(n => n.remove());
  },

  rgLoop() {
    if (!this.rg.running) return;

    // สุ่มสร้างโน้ต
    if (Math.random() < 0.03) {
      this.spawnNote(Math.floor(Math.random() * 4));
    }

    // เคลื่อนที่โน้ต
    const notes = document.querySelectorAll('.rg-note');
    notes.forEach(note => {
      let top = parseFloat(note.style.top || -20);
      top += this.rg.speed;
      note.style.top = top + 'px';

      // ถ้าหลุดขอบจอ (Miss)
      if (top > 400) {
        note.remove();
      }
    });

    this.rg.timer = requestAnimationFrame(() => this.rgLoop());
  },

  spawnNote(laneIdx) {
    const screen = document.getElementById('rg-screen');
    const note = document.createElement('div');
    note.className = 'rg-note';
    note.dataset.lane = laneIdx;
    
    // คำนวณตำแหน่งเลน
    const laneWidth = screen.offsetWidth / 4;
    note.style.left = (laneIdx * laneWidth + 5) + 'px';
    note.style.width = (laneWidth - 10) + 'px';
    note.style.top = '-20px';
    
    screen.appendChild(note);
  },

  // ตรวจจับการกดปุ่ม (เรียกจาก Event Listener ใน app.js หรือ vision.js)
  handleInput(key) {
    if (!key) return; 
    const laneIdx = this.rg.keys.indexOf(key.toUpperCase());
    if (laneIdx === -1 || !this.rg.running) return;

    const notes = document.querySelectorAll(`.rg-note[data-lane="${laneIdx}"]`);
    notes.forEach(note => {
      const top = parseFloat(note.style.top);
      // ตรวจสอบระยะการกด (Hit Zone อยู่ที่ประมาณ 300px - 360px)
      if (top > 300 && top < 380) {
        this.rg.score += 100;
        document.getElementById('rg-score').textContent = this.rg.score;
        note.remove();
        // เล่นเสียงกลองเวลาตีถูก
        if (typeof AudioEngine !== 'undefined') AudioEngine.playTone(150, 'sine', 0.1);
      }
    });
  }
};

// ดักฟังการกดปุ่มคีย์บอร์ด
window.addEventListener('keydown', (e) => {
  // เช็กชัวร์ว่าส่ง e.key เข้าไปจริงๆ
  if (e && e.key) {
    Game.handleInput(e.key);
  }
});