const Guitar = {
  SCALES: {
    'pentatonic-minor': [0, 3, 5, 7, 10],
    'major': [0, 2, 4, 5, 7, 9, 11],
    'blues': [0, 3, 5, 6, 7, 10],
    'dorian': [0, 2, 3, 5, 7, 9, 10],
    'lydian': [0, 2, 4, 6, 7, 9, 11]
  },
  NOTE_NAMES: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'],

  renderFretboard() {
    const container = document.getElementById('fretboard-container');
    const scaleKey = document.getElementById('fb-scale').value;
    const rootNote = document.getElementById('fb-root').value;
    
    const rootIdx = this.NOTE_NAMES.indexOf(rootNote);
    const scaleIntervals = this.SCALES[scaleKey] || this.SCALES['major'];
    const scaleNotes = scaleIntervals.map(i => (rootIdx + i) % 12);
    
    const openMidi = [64, 59, 55, 50, 45, 40]; // E4, B3, G3, D3, A2, E2
    const openNames = ['E', 'B', 'G', 'D', 'A', 'E'];
    
    let html = "";
    for (let s = 0; s < 6; s++) {
      html += `<div class="string-row s${s+1}">`;
      html += `<span class="string-label">${openNames[s]}</span>`;
      
      for (let f = 0; f <= 15; f++) {
        const midi = openMidi[s] + f;
        const noteIdx = midi % 12;
        const noteName = this.NOTE_NAMES[noteIdx];
        const freq = 440 * Math.pow(2, (midi - 69) / 12);
        
        const inScale = scaleNotes.includes(noteIdx);
        const isRoot = noteIdx === rootIdx;
        
        let cls = "fret-cell";
        if (isRoot) cls += " fret-root";
        else if (inScale) cls += " fret-played";
        
        html += `
          <div class="${cls}" onclick="Battle.hit(${freq}, this)">
          <div class="string-line"></div>
          <span>${inScale || isRoot ? noteName : ''}</span>
          </div>`;
      }
      html += `</div>`;
    }
    container.innerHTML = html;
  }
};

window.addEventListener('load', () => {
  if (document.getElementById('fretboard-container')) Guitar.renderFretboard();
});
