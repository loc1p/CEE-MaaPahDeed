const AudioEngine = {
  ctx: null,
  
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },

  playTone(freq, type = 'sawtooth', dur = 1.0, vol = 0.2) {
    this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
    
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    const now = this.ctx.currentTime;
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(vol, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    
    osc.connect(g).connect(this.ctx.destination);
    osc.start();
    osc.stop(now + dur);
  }
};
