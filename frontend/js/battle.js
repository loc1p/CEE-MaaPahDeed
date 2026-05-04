const Battle = {
  targetFreq: null,
  score: 0,

  start() {
    this.score = 0;
    this.nextNote();
    this.updateScore();
  },

  nextNote() {
    const notes = [
      { name: 'A', freq: 440 },
      { name: 'C', freq: 261.63 },
      { name: 'E', freq: 329.63 },
      { name: 'G', freq: 392.00 }
    ];

    const pick = notes[Math.floor(Math.random() * notes.length)];
    this.targetFreq = pick.freq;

    const nameDisplay = document.getElementById('tgt-note');
    if (nameDisplay) {
      nameDisplay.textContent = pick.name;
    }

    // 2. อัปเดตตัวเลขความถี่และอ็อกเทฟ (ต้องใช้ id 'tgt-hz')
    const hzDisplay = document.getElementById('tgt-hz');
    if (hzDisplay) {
      hzDisplay.textContent = `${pick.freq} Hz · Octave ${pick.octave}`;
    }
  },

  hit(freq, el) {
    AudioEngine.playTone(freq);

    const diff = Math.abs(freq - this.targetFreq);

    if (diff < 5) {
      this.score++;
      this.flash(el, 'correct');
      this.nextNote();
    } else {
      this.flash(el, 'wrong');
    }

    this.updateScore();
  },

  flash(el, cls) {
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 300);
  },

  updateScore() {
    const s = document.getElementById('battle-score');
    if (s) s.textContent = `Score: ${this.score}`;
  },
  startGameUI() {
  // ซ่อนหน้าเริ่ม
    document.getElementById('battle-start-screen').classList.add('hidden');

  // โชว์เกม
    document.getElementById('battle-game').classList.remove('hidden');

  // render fretboard
    if (typeof Guitar !== 'undefined') {
      Guitar.renderFretboard();
    }

  // เริ่มเกมจริง
     this.start();
    },
    // ฟังก์ชันสำหรับเล่นเสียงโน้ตเป้าหมายปัจจุบัน
  playTargetNote() {
    if (this.targetFreq) {
      // เรียกใช้ AudioEngine เพื่อเล่นเสียงตามความถี่ (Frequency) ที่สุ่มได้
      AudioEngine.playTone(this.targetFreq); 
    }
  },

  // ฟังก์ชันสำหรับหนีและออกจากเกม
  flee() {
    // ซ่อนหน้าต่างเกมเพลย์
    document.getElementById('battle-game').classList.add('hidden');
    
    // นำหน้าต่างเริ่มต้นกลับมาแสดง
    document.getElementById('battle-start-screen').classList.remove('hidden');
    
    // รีเซ็ตคะแนนกลับเป็น 0
    this.score = 0;
    this.updateScore();
  },

    
};