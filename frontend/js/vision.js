const Vision = {
  active: false,
  
  async startCamera() {
    const video = document.getElementById('cam-video');
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    this.active = true;
    document.getElementById('cam-start-btn').disabled = true;
    document.getElementById('cam-stop-btn').disabled = false;
    document.getElementById('cam-status').textContent = "Vision System Active";
  },

  stopCamera() {
    const video = document.getElementById('cam-video');
    video.srcObject.getTracks().forEach(track => track.stop());
    this.active = false;
    document.getElementById('cam-start-btn').disabled = false;
    document.getElementById('cam-stop-btn').disabled = true;
  }
};
