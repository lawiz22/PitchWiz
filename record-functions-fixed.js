async function recordLowestNote() {
    const btn = document.getElementById('btnRecordLowest');
    const display = document.getElementById('detectedLowest');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Listening...';
    display.textContent = 'Sing now...';

    isCalibrating = true;

    // Ensure pitch detector is initialized
    if (!pitchDetector) {
        console.error('Pitch detector not available');
        alert('Error: Pitch detector not initialized. Please start listening first.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Lowest Note';
        return;
    }

    // Check if microphone is active
    if (!isListening) {
        alert('⚠️ Please start the microphone first!\n\nClick the microphone button at the top, then try again.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Lowest Note';
        isCalibrating = false;
        return;
    }

    // Collect pitch data for 3 seconds
    const detectedNotes = [];
    const duration = 3000;
    const startTime = Date.now();

    // Collect notes in real-time
    const collectInterval = setInterval(() => {
        if (pitchDetector && pitchDetector.lastPitchData) {
            const data = pitchDetector.lastPitchData;
            if (data.note && data.frequency) {
                detectedNotes.push({
                    note: data.note,
                    frequency: data.frequency
                });
                display.textContent = data.note;
            }
        }

        if (Date.now() - startTime >= duration) {
            clearInterval(collectInterval);
            finishLowestNote(detectedNotes, btn, display);
        }
    }, 100);
}

async function recordHighestNote() {
    const btn = document.getElementById('btnRecordHighest');
    const display = document.getElementById('detectedHighest');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Listening...';
    display.textContent = 'Sing now...';

    isCalibrating = true;

    // Ensure pitch detector is initialized
    if (!pitchDetector) {
        console.error('Pitch detector not available');
        alert('Error: Pitch detector not initialized. Please start listening first.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Highest Note';
        return;
    }

    // Check if microphone is active
    if (!isListening) {
        alert('⚠️ Please start the microphone first!\n\nClick the microphone button at the top, then try again.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Highest Note';
        isCalibrating = false;
        return;
    }

    // Collect pitch data for 3 seconds
    const detectedNotes = [];
    const duration = 3000;
    const startTime = Date.now();

    // Collect notes in real-time
    const collectInterval = setInterval(() => {
        if (pitchDetector && pitchDetector.lastPitchData) {
            const data = pitchDetector.lastPitchData;
            if (data.note && data.frequency) {
                detectedNotes.push({
                    note: data.note,
                    frequency: data.frequency
                });
                display.textContent = data.note;
            }
        }

        if (Date.now() - startTime >= duration) {
            clearInterval(collectInterval);
            finishHighestNote(detectedNotes, btn, display);
        }
    }, 100);
}
