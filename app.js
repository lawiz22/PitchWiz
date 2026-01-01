/**
 * Main Application Controller
 */

// Global state
let pitchDetector = null;
let visualizer = null;
let isListening = false;
let tuningThreshold = 5; // cents
const pitchBuffer = [];
const pitchBufferSize = 30; // ~1.5 seconds at typical update rate
const minBufferSize = 10; // Minimum samples before showing stable reading

// DOM Elements
const startBtn = document.getElementById('startBtn');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const noteDisplay = document.getElementById('noteDisplay');
const noteName = document.getElementById('noteName');
const octave = document.getElementById('octave');
const frequency = document.getElementById('frequency');
const centsMarker = document.getElementById('centsMarker');
const centsValue = document.getElementById('centsValue');
const detectionStatus = document.getElementById('detectionStatus');
const a4Reference = document.getElementById('a4Reference');
const canvas = document.getElementById('visualizationCanvas');
const modeBtns = document.querySelectorAll('.mode-btn');

// Settings
const a4FrequencyInput = document.getElementById('a4Frequency');
const smoothingInput = document.getElementById('smoothing');
const minNoteSelect = document.getElementById('minNoteSelect');
const maxNoteSelect = document.getElementById('maxNoteSelect');
const detectionModeBtns = document.querySelectorAll('[data-detection-mode]');
const zoomLevelInput = document.getElementById('zoomLevel');
const zoomValue = document.getElementById('zoomValue');
const scanSpeedInput = document.getElementById('scanSpeed');
const scanSpeedValue = document.getElementById('scanSpeedValue');
const tuningThresholdInput = document.getElementById('tuningThreshold');
const tuningThresholdValue = document.getElementById('tuningThresholdValue');

/**
 * Initialize application
 */
function init() {
    // Create visualizer
    visualizer = new Visualizer(canvas);

    // Create pitch detector
    pitchDetector = new PitchDetector({
        a4Frequency: parseInt(a4FrequencyInput.value),
        smoothingFactor: parseInt(smoothingInput.value) / 100,
        onPitchDetected: handlePitchDetected,
        onError: handleError
    });

    // Event listeners
    startBtn.addEventListener('click', toggleListening);
    settingsBtn.addEventListener('click', openSettings);
    closeSettings.addEventListener('click', closeSettingsModal);

    // Mode toggle
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;
            visualizer.setMode(mode);
        });
    });

    // Settings inputs
    a4FrequencyInput.addEventListener('change', (e) => {
        const freq = parseInt(e.target.value);
        pitchDetector.setA4Frequency(freq);
        a4Reference.textContent = `${freq} Hz`;
    });

    smoothingInput.addEventListener('input', (e) => {
        const smoothing = parseInt(e.target.value);
        pitchDetector.setSmoothingFactor(smoothing);
    });

    // Tuning threshold slider
    tuningThresholdInput.addEventListener('input', (e) => {
        tuningThreshold = parseInt(e.target.value);
        tuningThresholdValue.textContent = tuningThreshold;
    });

    // Spectrogram note labels checkbox
    const showSpectrogramNotesCheckbox = document.getElementById('showSpectrogramNotes');
    showSpectrogramNotesCheckbox.addEventListener('change', (e) => {
        visualizer.showSpectrogramNotes = e.target.checked;
    });


    // Populate note range selectors (C0 to C8)
    const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
    for (let octave = 0; octave <= 8; octave++) {
        for (let noteIndex = 0; noteIndex < 12; noteIndex++) {
            const midiNote = (octave + 1) * 12 + noteIndex;
            const noteName = `${noteNames[noteIndex]}${octave}`;

            // Add to min selector
            const minOption = document.createElement('option');
            minOption.value = midiNote;
            minOption.textContent = noteName;
            if (midiNote === 24) minOption.selected = true; // C1 default
            minNoteSelect.appendChild(minOption);

            // Add to max selector
            const maxOption = document.createElement('option');
            maxOption.value = midiNote;
            maxOption.textContent = noteName;
            if (midiNote === 72) maxOption.selected = true; // C5 default
            maxNoteSelect.appendChild(maxOption);
        }
    }

    // Note range change listeners
    minNoteSelect.addEventListener('change', () => {
        const minNote = parseInt(minNoteSelect.value);
        const maxNote = parseInt(maxNoteSelect.value);
        if (minNote < maxNote) {
            visualizer.setNoteRange(minNote, maxNote);
        } else {
            alert('Minimum note must be lower than maximum note');
            minNoteSelect.value = visualizer.minNote;
        }
    });

    maxNoteSelect.addEventListener('change', () => {
        const minNote = parseInt(minNoteSelect.value);
        const maxNote = parseInt(maxNoteSelect.value);
        if (maxNote > minNote) {
            visualizer.setNoteRange(minNote, maxNote);
        } else {
            alert('Maximum note must be higher than minimum note');
            maxNoteSelect.value = visualizer.maxNote;
        }
    });

    // Detection mode toggle
    detectionModeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            detectionModeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.detectionMode;
            visualizer.setDetectionMode(mode);
        });
    });

    // Zoom level slider
    zoomLevelInput.addEventListener('input', (e) => {
        const zoom = parseInt(e.target.value) / 100;
        visualizer.setZoomLevel(zoom);
        zoomValue.textContent = `${zoom.toFixed(1)}x`;
    });

    // Scan speed slider
    scanSpeedInput.addEventListener('input', (e) => {
        const speed = parseInt(e.target.value) / 100;
        visualizer.setScanSpeed(speed);
        scanSpeedValue.textContent = `${speed.toFixed(1)}x`;
    });

    // Mouse drag: vertical = vertical zoom, horizontal = horizontal zoom
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startVZoom = 1.0;
    let startHZoom = 1.0;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startVZoom = visualizer.zoomLevel;
        startHZoom = visualizer.horizontalZoom;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            // Vertical drag = vertical zoom (pitch range)
            const vZoomDelta = -deltaY / 100;
            const newVZoom = Math.max(0.5, Math.min(3.0, startVZoom + vZoomDelta));
            visualizer.setZoomLevel(newVZoom);
            zoomValue.textContent = `${newVZoom.toFixed(1)}x`;
            zoomLevelInput.value = Math.round(newVZoom * 100);

            // Horizontal drag = horizontal zoom (time axis)
            const hZoomDelta = deltaX / 100;
            const newHZoom = Math.max(0.5, Math.min(3.0, startHZoom + hZoomDelta));
            visualizer.setHorizontalZoom(newHZoom);
        }
    });

    canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    canvas.addEventListener('mouseleave', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
    });

    // Set cursor style
    canvas.style.cursor = 'grab';

    // Close modal on outside click
    settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
            closeSettingsModal();
        }
    });

    console.log('PitchWiz initialized');
}

/**
 * Toggle listening state
 */
async function toggleListening() {
    if (!isListening) {
        // Start listening
        const success = await pitchDetector.start();

        if (success) {
            isListening = true;
            startBtn.classList.add('active');
            startBtn.innerHTML = `
                <svg class="icon-mic" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="2"/>
                    <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
                <span>Stop Listening</span>
            `;

            // Start visualizer
            // Pass analyser and audioContext to visualizer for spectrogram
            visualizer.analyser = pitchDetector.getAnalyser();
            visualizer.audioContext = pitchDetector.audioContext;
            visualizer.start();

            detectionStatus.textContent = 'Listening...';
            detectionStatus.classList.add('pulsing');
        }
    } else {
        // Stop listening
        pitchDetector.stop();
        visualizer.stop();

        isListening = false;
        startBtn.classList.remove('active');
        startBtn.innerHTML = `
            <svg class="icon-mic" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" stroke-width="2"/>
                <path d="M5 10v2a7 7 0 0014 0v-2M12 19v3m-4 0h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <span>Start Listening</span>
        `;

        // Reset display
        resetDisplay();
        detectionStatus.textContent = 'Stopped';
        detectionStatus.classList.remove('pulsing');
    }
}

/**
 * Handle pitch detection callback
 */
function handlePitchDetected(pitchData) {
    // Always pass data to visualizer (for live mode support)
    visualizer.addPitchData(pitchData);

    if (pitchData) {
        // Add to pitch buffer for averaging
        pitchBuffer.push(pitchData);
        if (pitchBuffer.length > pitchBufferSize) {
            pitchBuffer.shift();
        }

        // Only display if we have enough samples for stable reading
        if (pitchBuffer.length < minBufferSize) {
            detectionStatus.textContent = 'Detecting...';
            return;
        }

        // Calculate average pitch from buffer
        const avgFrequency = pitchBuffer.reduce((sum, p) => sum + p.frequency, 0) / pitchBuffer.length;
        const avgCents = pitchBuffer.reduce((sum, p) => sum + p.cents, 0) / pitchBuffer.length;

        // Use most recent note/octave (they should be stable if frequency is stable)
        const displayNote = pitchData.note;
        const displayOctave = pitchData.octave;

        // Update note display
        noteName.textContent = displayNote;
        octave.textContent = displayOctave;
        frequency.textContent = `${avgFrequency.toFixed(1)} Hz`;

        // Get note color
        const noteColor = getNoteColor(displayNote);
        noteName.style.color = noteColor;
        noteName.style.textShadow = `0 0 20px ${noteColor}`;

        // Update cents indicator
        const centsPercent = ((avgCents + 50) / 100) * 100;
        centsMarker.style.left = `${centsPercent}%`;
        centsValue.textContent = `${avgCents > 0 ? '+' : ''}${Math.round(avgCents)}¢`;

        // Update tuner color and background based on accuracy
        const isInTune = Math.abs(avgCents) < tuningThreshold;

        if (isInTune) {
            centsValue.style.color = noteColor;
            noteDisplay.classList.add('active');
            // Color the entire tuner box with note color when in tune
            noteDisplay.style.background = `linear-gradient(135deg, ${noteColor}20, ${noteColor}05)`;
            noteDisplay.style.borderColor = noteColor + '60';
        } else if (Math.abs(avgCents) < tuningThreshold * 3) {
            centsValue.style.color = 'var(--color-warning)';
            noteDisplay.classList.remove('active');
            noteDisplay.style.background = '';
            noteDisplay.style.borderColor = '';
        } else {
            centsValue.style.color = 'var(--color-danger)';
            noteDisplay.classList.remove('active');
            noteDisplay.style.background = '';
            noteDisplay.style.borderColor = '';
        }

        detectionStatus.textContent = `${displayNote}${displayOctave} detected`;
    } else {
        // Clear buffer when no sound
        pitchBuffer.length = 0;
        // No pitch detected
        noteDisplay.classList.remove('active');
        noteDisplay.style.background = '';
        noteDisplay.style.borderColor = '';
        detectionStatus.textContent = 'Listening...';
    }
}

/**
 * Get color for a note name (chromatic color scheme)
 */
function getNoteColor(noteName) {
    const noteColors = {
        'C': '#ff4757',
        'C♯': '#ff6348',
        'D': '#ffa502',
        'D♯': '#c8d600',
        'E': '#26de81',
        'F': '#20bf6b',
        'F♯': '#0fb9b1',
        'G': '#4b7bec',
        'G♯': '#a55eea',
        'A': '#8854d0',
        'A♯': '#fd79a8',
        'B': '#eb3b5a'
    };

    return noteColors[noteName] || 'var(--color-accent-primary)';
}

/**
 * Handle errors
 */
function handleError(error) {
    console.error('Error:', error);
    alert(error);

    if (isListening) {
        toggleListening();
    }
}

/**
 * Reset display
 */
function resetDisplay() {
    noteName.textContent = '--';
    noteName.style.color = 'var(--color-accent-primary)';
    noteName.style.textShadow = '0 0 20px var(--color-accent-glow)';
    octave.textContent = '';
    frequency.textContent = '-- Hz';
    centsMarker.style.left = '50%';
    centsValue.textContent = '0¢';
    centsValue.style.color = 'var(--color-text-secondary)';
    noteDisplay.classList.remove('active');
}

/**
 * Open settings modal
 */
function openSettings() {
    settingsModal.classList.add('active');
}

/**
 * Close settings modal
 */
function closeSettingsModal() {
    settingsModal.classList.remove('active');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', init);
