/**
 * Main Application Controller
 */

// Global state
let pitchDetector = null;
let visualizer = null;
let isListening = false;

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
            visualizer.setAnalyser(pitchDetector.getAnalyser());
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
    if (pitchData) {
        // Pass pitch data to visualizer for pitch diagram
        visualizer.addPitchData(pitchData);

        // Update note display
        noteName.textContent = pitchData.note;
        octave.textContent = pitchData.octave;
        frequency.textContent = `${pitchData.frequency.toFixed(1)} Hz`;

        // Color-code the note name based on chromatic color
        const noteColor = getNoteColor(pitchData.note);
        noteName.style.color = noteColor;
        noteName.style.textShadow = `0 0 20px ${noteColor}`;

        // Update cents indicator
        const centsPercent = ((pitchData.cents + 50) / 100) * 100;
        centsMarker.style.left = `${centsPercent}%`;
        centsValue.textContent = `${pitchData.cents > 0 ? '+' : ''}${pitchData.cents}¢`;

        // Color code cents
        if (Math.abs(pitchData.cents) < 5) {
            centsValue.style.color = 'var(--color-success)';
            noteDisplay.classList.add('active');
        } else if (Math.abs(pitchData.cents) < 15) {
            centsValue.style.color = 'var(--color-warning)';
            noteDisplay.classList.remove('active');
        } else {
            centsValue.style.color = 'var(--color-danger)';
            noteDisplay.classList.remove('active');
        }

        detectionStatus.textContent = `${pitchData.note}${pitchData.octave} detected`;
    } else {
        // No pitch detected
        noteDisplay.classList.remove('active');
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
