function checkIntervalPractice(pitchData) {
    if (!pitchData || !pitchData.note) return;
    if (intervalState.visualizer) {
        intervalState.visualizer.addPitchData(pitchData);
    }

    const sungNote = pitchData.note + pitchData.octave;
    
    // 1. Reference Check with COLOR GLOW
    if (sungNote === intervalState.currentRef) {
        const refPuck = document.getElementById('refPuck');
        if (refPuck) {
            refPuck.classList.add('active-glow');
            // Apply note color to glow
            const noteName = intervalState.currentRef.match(/[A-G]#?/)[0];
            const color = (window.NOTE_COLORS && window.NOTE_COLORS[noteName]) || '#999';
            refPuck.style.boxShadow = '0 0 20px ' + color + ', 0 0 40px ' + color;
            clearTimeout(refPuck.glowTimer);
            refPuck.glowTimer = setTimeout(() => {
                refPuck.classList.remove('active-glow');
                refPuck.style.boxShadow = '0 0 10px ' + color + '40';
            }, 500);
        }
    }

    // 2. Target Check (Only if Recording)
    if (intervalState.isRecording && sungNote === intervalState.currentTarget) {
        const targetPuck = document.getElementById('targetPuck');
        
        if (targetPuck) {
            targetPuck.classList.add('active-glow');
            targetPuck.querySelector('.note-val').textContent = sungNote; 
        }

        if (!intervalState.targetHitTimestamp) {
            intervalState.targetHitTimestamp = Date.now();
            document.getElementById('intervalInstruction').textContent = ' Target Hit! Stopping in 3s...';
            
            intervalState.autoStopTimer = setTimeout(() => {
                stopIntervalRecordingMetrics(true);
            }, 3000);
        }
    }
}
