/**
 * Main Application Controller
 */

// Global state
let pitchDetector = null;
let visualizer = null;
let isListening = false;
let tuningThreshold = 5; // cents
window.tuningThreshold = tuningThreshold; // Make accessible to visualizer
let pitchBuffer = [];
let pitchBufferSize = 30; // Increased for stability
let minBufferSize = 10; // Minimum samples before displaying
let voiceMode = false; // Voice mode for smoother averaging
let voiceModeBufferSize = 50; // ~1 second at 50Hz update rate
let recordingManager = null; // Recording manager instance
let toneGenerator = null; // Tone generator for practice mode

// Practice mode state
let currentSinger = null;
let calibrationState = { lowest: null, highest: null };
let isCalibrating = false;

// DOM Elements
const startBtn = document.getElementById('startBtn');
const recordBtn = document.getElementById('recordBtn');
// const recordingsModal = document.getElementById('recordingsModal'); // Removed
// const closeRecordings = document.getElementById('closeRecordings'); // Removed
// const recordingsList = document.getElementById('recordingsList'); // Removed
const recordingTimer = document.getElementById('recordingTimer');
const settingsBtn = document.getElementById('settingsBtn');
const settingsModal = document.getElementById('settingsModal');
const closeSettings = document.getElementById('closeSettings');
const noteDisplay = document.getElementById('noteDisplay');
const noteName = document.getElementById('noteName');
const octave = document.getElementById('octave');
const frequency = document.getElementById('frequency');
const centsMarker = document.getElementById('centsMarker');
const centsValue = document.getElementById('centsValue');
const a4Reference = document.getElementById('a4Reference');
const canvas = document.getElementById('visualizationCanvas');
const modeBtns = document.querySelectorAll('.nav-tab');

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
const appStatusElement = document.getElementById('appStatus');

// State Management
const AppState = {
    IDLE: 'IDLE',
    LISTENING: 'LISTENING',
    RECORDING: 'RECORDING',
    PLAYBACK: 'PLAYBACK'
};

let currentState = AppState.IDLE;

function updateAppState(newState) {
    console.log(`State transition: ${currentState} -> ${newState}`);
    currentState = newState;

    // Update Status Text
    if (appStatusElement) {
        appStatusElement.textContent = newState;
        appStatusElement.className = 'app-status'; // Reset classes
        appStatusElement.classList.add(newState.toLowerCase());
    }

    // Update UI based on state
    switch (newState) {
        case AppState.IDLE:
            startBtn.classList.remove('active');
            recordBtn.classList.remove('active');
            recordBtn.classList.add('disabled'); // Disable record in IDLE
            recordBtn.title = "Start Listening first to record";
            if (visualizer) visualizer.stop();
            updatePlayPauseIcon(false); // Ensure playback icon is reset
            break;

        case AppState.LISTENING:
            startBtn.classList.add('active');
            recordBtn.classList.remove('active');
            recordBtn.classList.remove('disabled'); // Enable record
            recordBtn.title = "Start Recording";
            if (visualizer) visualizer.start();
            break;

        case AppState.RECORDING:
            startBtn.classList.add('active');
            recordBtn.classList.add('active');
            recordBtn.classList.remove('disabled');
            recordBtn.title = "Stop Recording";
            break;

        case AppState.PLAYBACK:
            startBtn.classList.remove('active'); // Mic is off during playback
            recordBtn.classList.remove('active');
            recordBtn.classList.add('disabled');

            // Ensure mic is stopped
            if (pitchDetector && pitchDetector.isListening) {
                pitchDetector.stop();
                isListening = false;
            }
            break;
    }
}

let isInitialized = false;

/**
 * Initialize application
 */
function init() {
    if (isInitialized) return;
    isInitialized = true;
    console.log('Initializing PitchWiz...');

    // Create visualizer
    visualizer = new Visualizer(canvas);

    // Load auto-zoom range setting immediately after visualizer creation
    const savedAutoZoomRange = localStorage.getItem('pitchWiz_autoZoomRange') || '6';
    visualizer.autoZoomRange = parseInt(savedAutoZoomRange);

    // Create pitch detector
    const a4Input = document.getElementById('a4Frequency');
    const smoothInput = document.getElementById('smoothing');

    pitchDetector = new PitchDetector({
        a4Frequency: parseInt(a4Input?.value || 440),
        smoothingFactor: parseInt(smoothInput?.value || 70) / 100,
        onPitchDetected: handlePitchDetected,
        onError: handleError
    });
    window.pitchDetector = pitchDetector;

    // Initialize database
    dbManager.init().then(() => {
        // Initialize components that depend on dbManager
        recordingManager = new RecordingManager(dbManager);

        // Initialize Progress Tracker
        if (typeof ProgressTracker !== 'undefined') {
            window.progressTracker = new ProgressTracker(dbManager);
        }

        // Setup Audio Context for playback
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        console.log('Database, Recording Manager and Progress Tracker initialized');

        // Initialize Profile UI after DB is ready
        if (typeof window.populateProfileSelector === 'function') {
            window.populateProfileSelector();
        }
    }).catch(error => {
        console.error('Failed to initialize database:', error);
    });

    // Initialize State
    updateAppState(AppState.IDLE);

    // Initialize State
    updateAppState(AppState.IDLE);

    // Event listeners
    startBtn.addEventListener('click', toggleListening);
    // Settings button now handled by navigation tabs
    settingsBtn.addEventListener('click', () => {
        // Simulate clicking the settings nav tab
        const settingsView = document.getElementById('settingsView');
        const visualizationContainer = document.getElementById('visualizationContainer');
        const libraryView = document.getElementById('libraryView');
        const progressView = document.getElementById('progressView');
        const practiceView = document.getElementById('practiceView');

        // Hide all views
        if (visualizationContainer) visualizationContainer.style.display = 'none';
        if (libraryView) libraryView.style.display = 'none';
        if (progressView) progressView.style.display = 'none';
        if (practiceView) practiceView.style.display = 'none';

        // Show settings
        if (settingsView) settingsView.style.display = 'block';

        // Update nav tabs
        modeBtns.forEach(b => b.classList.remove('active'));
    });

    // Mode toggle
    const waveformGainControl = document.getElementById('waveformGainControl');
    const noteDisplay = document.getElementById('noteDisplay');
    modeBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const mode = btn.dataset.mode;

            // Handle Views
            const visualizationContainer = document.getElementById('visualizationContainer');
            const libraryView = document.getElementById('libraryView');
            const progressView = document.getElementById('progressView');
            const settingsView = document.getElementById('settingsView');
            const practiceView = document.getElementById('practiceView');

            // Hide all first
            if (visualizationContainer) visualizationContainer.style.display = 'none';
            if (libraryView) libraryView.style.display = 'none';
            if (progressView) progressView.style.display = 'none';
            if (settingsView) settingsView.style.display = 'none';
            if (practiceView) practiceView.style.display = 'none';

            if (mode === 'library') {
                libraryView.style.display = 'flex';
                if (noteDisplay) noteDisplay.style.display = 'none'; // Hide tuner
                // Stop visualizer if running (except playback logic)
                if (!isPlaybackActive) visualizer.stop();
                await loadRecordings();
            } else if (mode === 'practice') {
                // Validate vocal range before allowing practice
                const currentSinger = localStorage.getItem('pitchWizSinger');
                if (!currentSinger) {
                    alert('Please select or create a user profile first!');
                    // Switch back to view mode
                    document.querySelector('[data-mode="view"]').click();
                    return;
                }

                // Check if user has vocal range calibrated
                try {
                    const profile = await dbManager.getSingerProfile(currentSinger);
                    if (!profile || !profile.lowestNote || !profile.highestNote) {
                        const shouldCalibrate = confirm(`Your vocal range is not calibrated yet.\n\nWould you like to calibrate it now?`);
                        if (shouldCalibrate && typeof openRangeCalibration === 'function') {
                            openRangeCalibration();
                        }
                        // Switch back to view mode
                        document.querySelector('[data-mode="view"]').click();
                        return;
                    }
                } catch (err) {
                    console.error('Error checking vocal range:', err);
                    alert('Error checking your profile. Please try again.');
                    // Switch back to view mode
                    document.querySelector('[data-mode="view"]').click();
                    return;
                }

                practiceView.style.display = 'flex';
                if (noteDisplay) noteDisplay.style.display = 'none'; // Hide tuner
                if (!isPlaybackActive) visualizer.stop();
                // Load Stats
                if (window.progressTracker) {
                    await updateProgressUI();
                }
            } else if (mode === 'progress') {
                progressView.style.display = 'block';
                if (noteDisplay) noteDisplay.style.display = 'none'; // Hide tuner
                if (!isPlaybackActive) visualizer.stop();
                // Load Stats
                if (window.progressTracker) {
                    await updateProgressUI();
                }
            } else if (mode === 'view') {
                // View mode - show visualization with current view mode
                visualizationContainer.style.display = 'block';

                // Apply the current view mode from the switcher
                const currentMode = viewModes[currentViewModeIndex];
                visualizer.setMode(currentMode);

                // Show/hide appropriate UI elements based on current view mode
                if (currentMode === 'tuner') {
                    if (waveformGainControl) waveformGainControl.style.display = 'block';
                    if (noteDisplay) noteDisplay.style.display = 'none';
                } else {
                    if (waveformGainControl) waveformGainControl.style.display = 'none';
                    if (noteDisplay) noteDisplay.style.display = 'block';
                }

                // Start visualizer if listening
                if (isListening) {
                    visualizer.start();
                }
            } else {
                // Visualization Modes
                visualizationContainer.style.display = 'block';

                // If specific visualization mode
                visualizer.setMode(mode);

                // Logic to avoid loop conflict:
                if (isPlaybackActive) {
                    if (mode === 'pitch-diagram') {
                        visualizer.stop(); // Handled by playback loop
                    } else {
                        visualizer.start(); // Spectrogram needs standard loop
                    }
                } else if (isListening) {
                    visualizer.start();
                }

                // Show/hide waveform gain control and tuner box based on mode
                if (mode === 'tuner') {
                    if (waveformGainControl) waveformGainControl.style.display = 'block';
                    if (noteDisplay) noteDisplay.style.display = 'none';
                } else {
                    if (waveformGainControl) waveformGainControl.style.display = 'none';
                    if (mode === 'spectrogram' || mode === 'pitch-diagram') {
                        if (noteDisplay) noteDisplay.style.display = 'block';
                    }
                }
            }
        });
    });

    // View Mode Switcher
    const viewModeSwitcher = document.getElementById('viewModeSwitcher');
    const currentViewModeDisplay = document.getElementById('currentViewMode');
    const viewModes = ['pitch-diagram', 'spectrogram', 'tuner'];
    const viewModeNames = {
        'pitch-diagram': 'Pitch',
        'spectrogram': 'Spectro',
        'tuner': 'Tuner'
    };
    let currentViewModeIndex = 0;

    if (viewModeSwitcher) {
        const handleViewModeSwitch = () => {
            // Cycle to next mode
            currentViewModeIndex = (currentViewModeIndex + 1) % viewModes.length;
            const newMode = viewModes[currentViewModeIndex];

            // Update display
            if (currentViewModeDisplay) {
                currentViewModeDisplay.textContent = viewModeNames[newMode];
            }

            // Switch visualizer mode
            visualizer.setMode(newMode);

            // Show/hide appropriate UI elements
            const noteDisplay = document.getElementById('noteDisplay');
            const waveformGainControl = document.getElementById('waveformGainControl');

            if (newMode === 'tuner') {
                if (noteDisplay) noteDisplay.style.display = 'flex';
                if (waveformGainControl) waveformGainControl.style.display = 'flex';
            } else {
                if (noteDisplay) noteDisplay.style.display = 'none';
                if (waveformGainControl) waveformGainControl.style.display = 'none';
            }
        };

        viewModeSwitcher.addEventListener('click', handleViewModeSwitch);
        viewModeSwitcher.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleViewModeSwitch();
        });
    }

    // Tuning Reference Modal
    const tuningRefBtn = document.getElementById('tuningRefBtn');
    const tuningRefModal = document.getElementById('tuningRefModal');
    const tuningRefInput = document.getElementById('tuningRefInput');
    const tuningRefSave = document.getElementById('tuningRefSave');
    const tuningRefCancel = document.getElementById('tuningRefCancel');
    const closeTuningRef = document.getElementById('closeTuningRef');
    const tuningRefDisplay = document.getElementById('tuningRefDisplay');

    // Function to update tuning reference display
    function updateTuningReferenceDisplay(freq) {
        if (tuningRefDisplay) {
            tuningRefDisplay.textContent = `A4 = ${freq}Hz`;
        }
    }

    // Open tuning reference modal
    if (tuningRefBtn) {
        const handleTuningRefOpen = () => {
            if (tuningRefModal && tuningRefInput) {
                tuningRefInput.value = pitchDetector.referenceFrequency;
                tuningRefModal.classList.add('active');
            }
        };

        tuningRefBtn.addEventListener('click', handleTuningRefOpen);
        tuningRefBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleTuningRefOpen();
        });
    }

    // Save tuning reference
    if (tuningRefSave) {
        tuningRefSave.addEventListener('click', () => {
            const newFreq = parseFloat(tuningRefInput.value);
            if (newFreq >= 400 && newFreq <= 480) {
                pitchDetector.setReferenceFrequency(newFreq);
                updateTuningReferenceDisplay(newFreq);
                // Also update settings modal input
                if (a4FrequencyInput) {
                    a4FrequencyInput.value = newFreq;
                }
                if (tuningRefModal) {
                    tuningRefModal.classList.remove('active');
                }
            }
        });
    }

    // Cancel/Close tuning reference modal
    if (tuningRefCancel) {
        tuningRefCancel.addEventListener('click', () => {
            if (tuningRefModal) tuningRefModal.classList.remove('active');
        });
    }
    if (closeTuningRef) {
        closeTuningRef.addEventListener('click', () => {
            if (tuningRefModal) tuningRefModal.classList.remove('active');
        });
    }

    // Close modal on background click
    if (tuningRefModal) {
        tuningRefModal.addEventListener('click', (e) => {
            if (e.target === tuningRefModal) {
                tuningRefModal.classList.remove('active');
            }
        });
    }

    // Settings inputs
    const a4FrequencyInput = document.getElementById('a4Frequency');
    if (a4FrequencyInput) {
        a4FrequencyInput.addEventListener('change', (e) => {
            const freq = parseInt(e.target.value);
            pitchDetector.setA4Frequency(freq);
            if (a4Reference) a4Reference.textContent = `${freq} Hz`;
            // Update tuning reference display in header
            updateTuningReferenceDisplay(freq);
        });
    }

    // Pitch confidence threshold slider
    const pitchConfidenceInput = document.getElementById('pitchConfidence');
    const pitchConfidenceValue = document.getElementById('pitchConfidenceValue');
    if (pitchConfidenceInput && pitchConfidenceValue) {
        // Load saved setting
        const savedConfidence = localStorage.getItem('pitchWiz_confidenceThreshold') || 90;
        pitchConfidenceInput.value = savedConfidence;
        pitchConfidenceValue.textContent = savedConfidence;
        window.pitchConfidenceThreshold = parseInt(savedConfidence) / 100;

        pitchConfidenceInput.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            pitchConfidenceValue.textContent = value;
            window.pitchConfidenceThreshold = value / 100;
            localStorage.setItem('pitchWiz_confidenceThreshold', value);
        });
    }


    const smoothingInputElement = document.getElementById('smoothing');
    if (smoothingInputElement) {
        smoothingInputElement.addEventListener('input', (e) => {
            const smoothing = parseInt(e.target.value);
            pitchDetector.setSmoothingFactor(smoothing);
        });
    }



    // Tuning threshold slider (removed - using tuningTolerance instead)
    if (tuningThresholdInput) {
        tuningThresholdInput.addEventListener('input', (e) => {
            tuningThreshold = parseInt(e.target.value);
            if (tuningThresholdValue) tuningThresholdValue.textContent = tuningThreshold;
        });
    }

    // Spectrogram note labels checkbox
    const showSpectrogramNotesCheckbox = document.getElementById('showSpectrogramNotes');
    if (showSpectrogramNotesCheckbox) {
        showSpectrogramNotesCheckbox.addEventListener('change', (e) => {
            visualizer.showSpectrogramNotes = e.target.checked;
        });
    }

    // Auto-Zoom toggle
    const autoZoomCheckbox = document.getElementById('autoZoom');
    if (autoZoomCheckbox) {
        // Load saved setting
        const savedAutoZoom = localStorage.getItem('pitchWiz_autoZoom') === 'true';
        autoZoomCheckbox.checked = savedAutoZoom;
        if (visualizer) visualizer.autoZoom = savedAutoZoom;

        autoZoomCheckbox.addEventListener('change', (e) => {
            const isEnabled = e.target.checked;
            if (visualizer) visualizer.autoZoom = isEnabled;
            localStorage.setItem('pitchWiz_autoZoom', isEnabled);
        });
    }

    // Auto-Zoom Speed Slider
    const autoZoomSpeedInput = document.getElementById('autoZoomSpeed');
    const autoZoomSpeedValue = document.getElementById('autoZoomSpeedValue');
    if (autoZoomSpeedInput && autoZoomSpeedValue) {
        // Load saved setting
        const savedSpeed = localStorage.getItem('pitchWiz_autoZoomSpeed') || 20; // Default 2.0s
        autoZoomSpeedInput.value = savedSpeed;
        const speedSec = parseInt(savedSpeed) / 10;
        autoZoomSpeedValue.textContent = `${speedSec.toFixed(1)}s`;
        if (visualizer) visualizer.setAutoZoomSpeed(speedSec);

        autoZoomSpeedInput.addEventListener('input', (e) => {
            const speed = parseInt(e.target.value) / 10;
            autoZoomSpeedValue.textContent = `${speed.toFixed(1)}s`;
            if (visualizer) visualizer.setAutoZoomSpeed(speed);
            localStorage.setItem('pitchWiz_autoZoomSpeed', e.target.value);
        });
    }

    // Auto-Zoom Range Slider
    const autoZoomRangeInput = document.getElementById('autoZoomRange');
    const autoZoomRangeValue = document.getElementById('autoZoomRangeValue');
    if (autoZoomRangeInput && autoZoomRangeValue) {
        // Load saved setting
        const savedRange = localStorage.getItem('pitchWiz_autoZoomRange') || 6; // Default 6 notes
        autoZoomRangeInput.value = savedRange;
        autoZoomRangeValue.textContent = savedRange;
        if (visualizer) visualizer.autoZoomRange = parseInt(savedRange);

        autoZoomRangeInput.addEventListener('input', (e) => {
            const range = parseInt(e.target.value);
            autoZoomRangeValue.textContent = range;
            if (visualizer) visualizer.autoZoomRange = range;
            localStorage.setItem('pitchWiz_autoZoomRange', range);
        });
    }

    // Right-Side Labels Checkbox
    const showRightLabelsCheckbox = document.getElementById('showRightLabels');
    if (showRightLabelsCheckbox) {
        // Load saved
        const savedRightLabels = localStorage.getItem('pitchWiz_showRightLabels') === 'true';
        showRightLabelsCheckbox.checked = savedRightLabels;
        if (visualizer) visualizer.showRightLabels = savedRightLabels;

        showRightLabelsCheckbox.addEventListener('change', (e) => {
            if (visualizer) visualizer.showRightLabels = e.target.checked;
            localStorage.setItem('pitchWiz_showRightLabels', e.target.checked);
        });
    }

    // Waveform gain slider
    const waveformGainInput = document.getElementById('waveformGain');
    const waveformGainValue = document.getElementById('waveformGainValue');
    if (waveformGainInput && waveformGainValue) {
        waveformGainInput.addEventListener('input', (e) => {
            const gain = parseInt(e.target.value) / 100;
            visualizer.waveformGain = gain;
            waveformGainValue.textContent = `${gain.toFixed(1)}x`;
        });
    }

    // Practice Count-in checkbox
    const practiceCountInCheckbox = document.getElementById('practiceCountIn');
    if (practiceCountInCheckbox) {
        const savedCountIn = localStorage.getItem('pitchWiz_practiceCountIn');
        practiceCountInCheckbox.checked = savedCountIn !== 'false'; // Default true

        practiceCountInCheckbox.addEventListener('change', (e) => {
            localStorage.setItem('pitchWiz_practiceCountIn', e.target.checked);
        });
    }

    // Practice Recording Duration slider
    const practiceRecordDurationInput = document.getElementById('practiceRecordDuration');
    const practiceRecordDurationValue = document.getElementById('practiceRecordDurationValue');
    if (practiceRecordDurationInput && practiceRecordDurationValue) {
        const savedDuration = localStorage.getItem('pitchWiz_practiceRecordDuration') || '3';
        practiceRecordDurationInput.value = savedDuration;
        practiceRecordDurationValue.textContent = savedDuration;

        practiceRecordDurationInput.addEventListener('input', (e) => {
            const duration = e.target.value;
            practiceRecordDurationValue.textContent = duration;
            localStorage.setItem('pitchWiz_practiceRecordDuration', duration);
        });
    }


    // Main UI waveform gain slider
    const waveformGainMainInput = document.getElementById('waveformGainMain');
    const waveformGainMainValue = document.getElementById('waveformGainMainValue');
    if (waveformGainMainInput) {
        waveformGainMainInput.addEventListener('input', (e) => {
            const gain = parseInt(e.target.value) / 100;
            visualizer.waveformGain = gain;
            waveformGainMainValue.textContent = `${gain.toFixed(1)}x`;
            // Sync with settings slider
            waveformGainInput.value = e.target.value;
            waveformGainValue.textContent = `${gain.toFixed(1)}x`;
        });
    }

    // Smoothing slider with value display
    const smoothingInput = document.getElementById('smoothing');
    const smoothingValue = document.getElementById('smoothingValue');
    if (smoothingInput && smoothingValue) {
        smoothingInput.addEventListener('input', (e) => {
            smoothingValue.textContent = e.target.value;
        });
    }

    // View mode selector in settings
    const viewModeSelect = document.getElementById('viewModeSelect');
    if (viewModeSelect) {
        viewModeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            visualizer.setMode(mode);
            // Update action bar view switcher
            const currentViewModeDisplay = document.getElementById('currentViewMode');
            const modeNames = {
                'pitch-diagram': 'Pitch',
                'spectrogram': 'Spectro',
                'tuner': 'Tuner'
            };
            if (currentViewModeDisplay) {
                currentViewModeDisplay.textContent = modeNames[mode] || 'Pitch';
            }
        });
    }

    // Detection mode selector in settings
    const detectionModeSelect = document.getElementById('detectionModeSelect');
    if (detectionModeSelect) {
        detectionModeSelect.addEventListener('change', (e) => {
            const mode = e.target.value;
            // Update detection mode logic here if needed
            console.log('Detection mode changed to:', mode);
        });
    }

    // Tuning tolerance slider
    const tuningToleranceInput = document.getElementById('tuningTolerance');
    if (tuningToleranceInput && tuningToleranceValue) {
        tuningToleranceInput.addEventListener('input', (e) => {
            tuningThreshold = parseInt(e.target.value);
            window.tuningThreshold = tuningThreshold; // Update global
            tuningToleranceValue.textContent = `${tuningThreshold}¢`;
        });
    }

    // Populate note range selectors (C0 to C8)
    const minNoteSelect = document.getElementById('minNoteSelect');
    const maxNoteSelect = document.getElementById('maxNoteSelect');

    if (minNoteSelect && maxNoteSelect) {
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
    }

    // Detection mode toggle
    const detectionModeBtns = document.querySelectorAll('.detection-mode-btn');
    if (detectionModeBtns.length > 0) {
        detectionModeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                detectionModeBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.detectionMode;
                if (visualizer) visualizer.setDetectionMode(mode);
            });
        });
    }

    // --- SINGER PROFILE UI ---
    const singerGreeting = document.getElementById('singerGreeting');
    const singerNameDisplay = document.getElementById('singerNameDisplay');
    const profileSelect = document.getElementById('profileSelect');

    // 1. Update Greeting on Load
    function updateSingerGreeting() {
        const currentSinger = localStorage.getItem('pitchWizSinger');
        if (singerGreeting) {
            singerGreeting.style.display = 'block'; // Always show
            if (currentSinger) {
                if (singerNameDisplay) singerNameDisplay.textContent = currentSinger;
            } else {
                if (singerNameDisplay) singerNameDisplay.textContent = 'Guest';
            }
        }
    }

    // 2. Click Greeting to Open Settings
    if (singerGreeting) {
        singerGreeting.addEventListener('click', () => {
            // Simulate settings click
            settingsBtn.click();
        });
    }

    // 3. Populate Profile Selector (Exposed Globally)
    window.populateProfileSelector = async function () {
        if (!profileSelect) return;

        try {
            const profiles = await dbManager.getAllProfiles();
            const currentSinger = localStorage.getItem('pitchWizSinger');

            // Clear except first option
            profileSelect.innerHTML = '<option value="" disabled>Select a profile...</option><option value="guest">Guest (New)</option>';

            profiles.forEach(p => {
                const option = document.createElement('option');
                option.value = p.singer;
                option.textContent = p.singer;
                if (p.singer === currentSinger) option.selected = true;
                profileSelect.appendChild(option);
            });
            console.log(`Populated profile selector with ${profiles.length} profiles.`);
        } catch (e) {
            console.error('Error loading profiles', e);
        }
    };

    // 4. Handle Profile Change

    // 4. Handle Profile Change
    if (profileSelect) {
        profileSelect.addEventListener('change', async (e) => {
            const selectedSinger = e.target.value;

            if (selectedSinger === 'guest') {
                // Clear current singer
                localStorage.removeItem('pitchWizSinger');
                localStorage.removeItem('pitchWizRange');
            } else {
                // Set singer
                localStorage.setItem('pitchWizSinger', selectedSinger);

                // Load range from DB and cache it
                try {
                    const profile = await dbManager.getSingerProfile(selectedSinger);
                    if (profile) {
                        localStorage.setItem('pitchWizRange', JSON.stringify({
                            min: profile.lowestNote,
                            max: profile.highestNote
                        }));
                    }
                } catch (err) {
                    console.warn('Could not load range during switch', err);
                }
            }

            // Reload to apply changes (Simpler than resetting all state manually)
            window.location.reload();
        });
    }

    // 5. Handle Save Profile
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', async () => {
            const profileNameInput = document.getElementById('profileName');
            const name = profileNameInput ? profileNameInput.value.trim() : '';

            if (!name) {
                alert('Please enter a profile name.');
                return;
            }

            try {
                // Save to DB
                const existing = await dbManager.getSingerProfile(name);
                if (!existing) {
                    await dbManager.saveSingerProfile(name, null, null);
                }

                // Set as current
                localStorage.setItem('pitchWizSinger', name);

                // Clear input
                if (profileNameInput) profileNameInput.value = '';

                // Refresh UI
                await populateProfileSelector();
                updateSingerGreeting();

                // Select in dropdown
                if (profileSelect) profileSelect.value = name;

                alert(`Profile "${name}" created/selected!`);
            } catch (e) {
                console.error('Error saving profile:', e);
                alert('Failed to save profile: ' + e.message);
            }
        });
    }

    // Create New User function
    async function createNewUser() {
        const name = prompt('Enter new singer name:');
        if (!name || !name.trim()) {
            return;
        }

        // Check if name already exists
        const profiles = await dbManager.getAllProfiles();
        if (profiles.some(p => p.name === name.trim())) {
            alert('A profile with this name already exists!');
            return;
        }

        // Store the name temporarily
        window.pendingNewUserName = name.trim();

        // Open calibration modal
        if (typeof openRangeCalibration === 'function') {
            openRangeCalibration();
        } else {
            alert('Calibration function not available');
        }
    }

    // Make createNewUser globally available
    window.createNewUser = createNewUser;

    // Reset Practice Progress button in Settings
    const resetProgressBtn = document.getElementById('resetProgressBtn');
    if (resetProgressBtn) {
        resetProgressBtn.addEventListener('click', () => {
            if (typeof resetPracticeProgress === 'function') {
                resetPracticeProgress();
            } else {
                console.error('resetPracticeProgress function not found');
            }
        });
    }

    // Initial calls
    updateSingerGreeting();
    // populateProfileSelector(); // Moved to dbManager.init() callback

    // Zoom level slider
    const zoomLevelInput = document.getElementById('zoomLevel');
    if (zoomLevelInput) {
        zoomLevelInput.addEventListener('input', (e) => {
            const zoom = parseInt(e.target.value) / 100;
            visualizer.setZoomLevel(zoom);
            if (zoomValue) zoomValue.textContent = `${zoom.toFixed(1)}x`;
        });
    }

    // Scan speed slider
    const scanSpeedInput = document.getElementById('scanSpeed');
    if (scanSpeedInput) {
        scanSpeedInput.addEventListener('input', (e) => {
            const speed = parseInt(e.target.value) / 100;
            visualizer.setScanSpeed(speed);
            if (scanSpeedValue) scanSpeedValue.textContent = `${speed.toFixed(1)}x`;
        });
    }

    // Mouse drag: vertical = vertical zoom, horizontal = horizontal zoom
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startVZoom = 1.0;
    let startHZoom = 1.0;
    let startWaveformZoom = 1.0;

    canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startVZoom = visualizer.zoomLevel;
        startHZoom = visualizer.horizontalZoom;
        startWaveformZoom = visualizer.waveformZoom || 1.0;
        canvas.style.cursor = 'grabbing';
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        // Check current mode
        const currentMode = visualizer.mode;

        if (currentMode === 'tuner') {
            // In tuner mode: vertical drag controls waveform zoom
            const vZoomChange = -deltaY / 100;
            const newWaveformZoom = Math.max(0.5, Math.min(3.0, startWaveformZoom + vZoomChange));
            visualizer.waveformZoom = newWaveformZoom;
        } else {
            // In other modes: vertical = vertical zoom, horizontal = horizontal zoom
            const vZoomChange = -deltaY / 100;
            const hZoomChange = deltaX / 100;

            const newVZoom = Math.max(0.5, Math.min(3.0, startVZoom + vZoomChange));
            // Lower min horizontal zoom to 0.01 to allow massive shrinking (viewing long files)
            const newHZoom = Math.max(0.01, Math.min(3.0, startHZoom + hZoomChange));

            visualizer.setZoomLevel(newVZoom);
            zoomValue.textContent = `${newVZoom.toFixed(1)}x`;
            zoomLevelInput.value = Math.round(newVZoom * 100);

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


    // --- Touch Events (Mobile Support with Pinch-Zoom) ---
    let initialPinchDistance = 0;
    let initialPinchZoom = 1.0;
    let touchStartTime = 0;
    let lastTouchX = 0;
    let lastTouchY = 0;

    function getPinchDistance(touch1, touch2) {
        const dx = touch2.clientX - touch1.clientX;
        const dy = touch2.clientY - touch1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    canvas.addEventListener('touchstart', (e) => {
        touchStartTime = Date.now();

        if (e.touches.length === 1) {
            // Single finger - prepare for pan
            e.preventDefault();
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            // Two fingers - pinch zoom
            e.preventDefault();
            initialPinchDistance = getPinchDistance(e.touches[0], e.touches[1]);
            initialPinchZoom = visualizer.zoomLevel || 1.0;
        }
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();

        if (e.touches.length === 2) {
            // Two-finger pinch zoom
            const currentDistance = getPinchDistance(e.touches[0], e.touches[1]);
            const scale = currentDistance / initialPinchDistance;
            const newZoom = Math.max(0.5, Math.min(3.0, initialPinchZoom * scale));

            visualizer.setZoomLevel(newZoom);
            if (zoomValue) zoomValue.textContent = `${newZoom.toFixed(1)}x`;
            if (zoomLevelInput) zoomLevelInput.value = Math.round(newZoom * 100);
        } else if (e.touches.length === 1) {
            // Single-finger drag - horizontal for h-zoom, vertical for pan
            const deltaX = e.touches[0].clientX - lastTouchX;
            const deltaY = e.touches[0].clientY - lastTouchY;

            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;

            // Horizontal drag = horizontal zoom (time compression)
            const currentHZoom = visualizer.horizontalZoom || 1.0;
            const hZoomChange = deltaX * 0.003;
            const newHZoom = Math.max(0.1, Math.min(5.0, currentHZoom + hZoomChange));
            visualizer.setHorizontalZoom(newHZoom);

            // Vertical drag = vertical pan (move up/down to scroll)
            // Calculate natural 1:1 tracking: move content exactly with finger
            const visibleSemitones = visualizer.noteRange / visualizer.zoomLevel;
            const canvasHeight = visualizer.canvas.clientHeight || visualizer.canvas.height; // Use displayed height
            const semitonesPerPixel = visibleSemitones / canvasHeight;

            const currentPan = visualizer.verticalPan || 0;
            // Drag down (positive delta) -> shifts view to higher notes (center increases) -> content moves down
            const panChange = deltaY * semitonesPerPixel;

            const newPan = currentPan + panChange;
            // Limit pan to ±24 semitones to keep diagram visible
            visualizer.verticalPan = Math.max(-24, Math.min(24, newPan));
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        if (e.touches.length === 0) {
            // All fingers lifted
            initialPinchDistance = 0;
        } else if (e.touches.length === 1) {
            // One finger remaining, update tracking
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        }
    });

    canvas.addEventListener('touchcancel', () => {
        initialPinchDistance = 0;
    });

    // Recording functionality
    // Delegated to handleRecordClick using State Machine
    recordBtn.addEventListener('click', handleRecordClick);


    // Set cursor style
    canvas.style.cursor = 'grab';


    // Close modal on outside click (modal removed - now using settings view)
    const settingsModal = document.getElementById('settingsModal');
    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) {
                closeSettingsModal();
            }
        });
    }

    // Reset Library button (Development)
    const resetLibraryBtn = document.getElementById('resetLibraryBtn');
    if (resetLibraryBtn) {
        resetLibraryBtn.addEventListener('click', clearAllRecordings);
    }

    console.log('PitchWiz initialized');
}

/**
 * Toggle listening state
 */
/**
 * Toggle microphone listening
 */
async function toggleListening() {
    // If currently playing back, stop playback first
    if (currentState === AppState.PLAYBACK) {
        closePlayback();
    }

    if (currentState === AppState.LISTENING || currentState === AppState.RECORDING) {
        // STOP Listening
        pitchDetector.stop();
        // Visualizer stop is handled by updateAppState(IDLE) but calling it here is safe too

        // If recording, stop that too
        if (currentState === AppState.RECORDING) {
            await stopRecordingLogic();
        }

        isListening = false;
        updateAppState(AppState.IDLE);
        resetDisplay();

    } else {
        // START Listening
        // Initialize pitch detector
        if (!pitchDetector) {
            pitchDetector = new PitchDetector({
                onPitchDetected: handlePitchDetected,
                onError: (msg) => {
                    console.error(msg);
                    alert(msg);
                    updateAppState(AppState.IDLE);
                }
            });
        }

        const success = await pitchDetector.start();
        if (success) {
            isListening = true;
            updateAppState(AppState.LISTENING);

            // Set visualizer analyser
            visualizer.setAnalyser(pitchDetector.getAnalyser());

            // Resume Audio Context if suspended (browser policy)
            if (pitchDetector.audioContext.state === 'suspended') {
                await pitchDetector.audioContext.resume();
            }
        } else {
            isListening = false;
            updateAppState(AppState.IDLE);
        }
    }
}

/**
 * Handle Record Button Click (Replaces toggleRecording)
 */
async function handleRecordClick() {
    if (currentState === AppState.IDLE || currentState === AppState.PLAYBACK) {
        // Should be blocked by UI but double check
        return;
    }

    if (currentState === AppState.RECORDING) {
        // Stop Recording
        await stopRecordingLogic();
        // Do NOT force back to LISTENING here. stopRecordingLogic sets IDLE and opens modal.
    } else if (currentState === AppState.LISTENING) {
        // Start Recording
        const success = await startRecordingLogic();
        if (success) {
            updateAppState(AppState.RECORDING);
        }
    }
}

// Logic to start recording
async function startRecordingLogic() {
    if (!pitchDetector || !pitchDetector.stream) return false;

    // Use RecordingManager
    const success = await recordingManager.startRecording(
        pitchDetector.stream,
        visualizer.mode
    );

    if (success) {
        startTimer();
        return true;
    }
    return false;
}

// Logic to stop recording
async function stopRecordingLogic() {
    console.log('stopRecordingLogic called');
    try {
        // stopRecording now returns TEMP data, does not save to DB yet
        console.log('Calling recordingManager.stopRecording()...');
        const tempData = await recordingManager.stopRecording();
        console.log('recordingManager.stopRecording() returned', tempData);

        stopTimer();

        // Switch state to IDLE immediately after stopping recording
        updateAppState(AppState.IDLE);

        if (tempData && tempData.duration >= 1) { // Min 1 second
            // Open Save Modal
            console.log('Opening Save Modal');
            openSaveModal();
        } else {
            console.warn('Recording too short, discarding.', tempData);
            alert(`Recording too short (${tempData ? tempData.duration.toFixed(1) : 0}s), discarded.`);
        }
    } catch (error) {
        console.error('Error stopping recording:', error);
        alert('Error stopping: ' + error.message);
    }
}

// --- SAVE RECORDING MODAL LOGIC ---
const saveModal = document.getElementById('saveModal');

/**
 * Get color for a musical note
 */
function getNoteColor(note) {
    const colors = {
        'C': '#ff5252',  // Red
        'C#': '#ff793f', // Orange-Red
        'D': '#ffb142',  // Orange
        'D#': '#ffda79', // Yellow-Orange
        'E': '#fffa65',  // Yellow
        'F': '#badc58',  // Yellow-Green
        'F#': '#7bed9f', // Green
        'G': '#26de81',  // Green-Cyan
        'G#': '#2bcbba', // Cyan
        'A': '#45aaf2',  // Blue-Cyan
        'A#': '#2d98da', // Blue
        'B': '#a55eea'   // Purple
    };
    return colors[note] || '#d1ccc0'; // Default gray
}

const recordingNameInput = document.getElementById('recordingNameInput');
const singerNameInput = document.getElementById('singerNameInput');
const saveRecordingBtn = document.getElementById('saveRecordingBtn');
const discardBtn = document.getElementById('discardBtn');
const closeSaveModalBtn = document.getElementById('closeSaveModal');

let currentEditingId = null; // Track if we are editing an existing recording

function openSaveModal() {
    currentEditingId = null; // New recording
    // Update Modal Title/Button
    if (saveModal) {
        const title = saveModal.querySelector('h2');
        if (title) title.textContent = 'Save Recording';
        if (discardBtn) discardBtn.style.display = 'block'; // Show discard for new
        if (saveRecordingBtn) saveRecordingBtn.textContent = 'Save Recording';
    }

    // Generate default name
    const id = Date.now().toString().slice(-4);
    if (recordingNameInput) recordingNameInput.value = `Recording #${id}`;

    // Prefill singer if available from previous session
    if (localStorage.getItem('lastSinger') && singerNameInput) {
        singerNameInput.value = localStorage.getItem('lastSinger');
    }

    if (saveModal) saveModal.classList.add('visible');
}

/**
 * Open Modal for Renaming/Editing
 */
function openRenameModal(id, currentName, currentSinger) {
    currentEditingId = id; // Editing mode
    // Update Modal Title/Button
    if (saveModal) {
        const title = saveModal.querySelector('h2');
        if (title) title.textContent = 'Edit Recording Details';
        if (discardBtn) discardBtn.style.display = 'none'; // Hide discard for edit
        if (saveRecordingBtn) saveRecordingBtn.textContent = 'Update';
    }

    if (recordingNameInput) recordingNameInput.value = currentName || '';
    if (singerNameInput) singerNameInput.value = currentSinger !== 'undefined' ? currentSinger : '';

    if (saveModal) saveModal.classList.add('visible');
}

function closeSaveModal() {
    if (saveModal) saveModal.classList.remove('visible');
    currentEditingId = null;
    // Clear inputs
    if (recordingNameInput) recordingNameInput.value = '';
    // Don't clear singer name as it might be reused
}

// Event Listeners for Modal
if (saveRecordingBtn) {
    saveRecordingBtn.addEventListener('click', async () => {
        const name = recordingNameInput.value.trim() || recordingNameInput.placeholder;
        const singer = singerNameInput.value.trim() || 'Unknown';

        try {
            if (currentEditingId) {
                // UPDATE existing
                await dbManager.updateRecordingMetadata(currentEditingId, name, singer);
                alert('Recording updated!');
            } else {
                // SAVE NEW
                await recordingManager.saveRecording({ name, singer });
                localStorage.setItem('lastSinger', singer);
            }

            closeSaveModal();
            await loadRecordings(); // Refresh list

            // OPTIONAL: Switch to Progress View to show it counted
            // document.querySelector('[data-mode="progress"]').click();

        } catch (e) {
            console.error(e);
            alert('Failed to save: ' + e.message);
        }
    });
}

if (discardBtn) {
    discardBtn.addEventListener('click', () => {
        if (confirm('Discard this recording?')) {
            // recordingManager.discardRecording(); // If we had a cleanup method
            recordingManager.tempData = null; // Clear temp data
            closeSaveModal();
        }
    });
}

if (closeSaveModalBtn) {
    closeSaveModalBtn.addEventListener('click', closeSaveModal);
}







/**
 * Handle pitch detection callback
 */
function handlePitchDetected(pitchData) {
    // Always pass data to visualizer (for live mode support)
    // Always pass data to visualizer (for live mode support)
    visualizer.addPitchData(pitchData);

    // Initialize practice functions if available
    if (typeof initPracticeFunctions === 'function') {
        initPracticeFunctions();
    }

    // Calibrate Range button in Settings
    const openCalibrateBtn = document.getElementById('openCalibrateBtn');
    if (openCalibrateBtn) {
        openCalibrateBtn.addEventListener('click', () => {
            console.log('[Settings] Calibrate button clicked');
            console.log('[Settings] openRangeCalibration type:', typeof openRangeCalibration);
            if (typeof openRangeCalibration === 'function') {
                console.log('[Settings] Calling openRangeCalibration...');
                openRangeCalibration();
            } else {
                console.error('[Settings] openRangeCalibration is not a function!');
            }
        });
    } else {
        console.error('[Settings] openCalibrateBtn not found!');
    }

    // Create New User button in Settings
    const createNewUserBtn = document.getElementById('createNewUserBtn');
    if (createNewUserBtn) {
        createNewUserBtn.addEventListener('click', () => {
            console.log('[Settings] Create New User button clicked');
            console.log('[Settings] createNewUser type:', typeof createNewUser);
            createNewUser();
        });
    } else {
        console.error('[Settings] createNewUserBtn not found!');
    }

    console.log('PitchWiz initialized successfully');
    // Interval Practice Hook
    if (typeof checkIntervalPractice === 'function') {
        checkIntervalPractice(pitchData);
    }

    // Add to recording if active
    if (recordingManager && recordingManager.isRecording) {
        recordingManager.addPitchData(pitchData);
    }

    if (pitchData) {
        // Add to pitch buffer for averaging
        pitchBuffer.push(pitchData);
        if (pitchBuffer.length > pitchBufferSize) {
            pitchBuffer.shift();
        }

        // Only display if we have enough samples for stable reading
        if (pitchBuffer.length < minBufferSize) {
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

    } else {
        // Clear buffer when no sound
        pitchBuffer.length = 0;
        // No pitch detected
        noteDisplay.classList.remove('active');
        noteDisplay.style.background = '';
        noteDisplay.style.borderColor = '';
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

/**
 * Load and display recordings
 */
async function loadRecordings() {
    try {
        const recordings = await dbManager.getAllRecordings();

        // Target library list instead of recordingsList (modal)
        const libraryList = document.getElementById('libraryList');
        if (!libraryList) return;

        if (recordings.length === 0) {
            libraryList.innerHTML = '<p class="empty-state">No recordings yet. Start recording to save your practice sessions!</p>';
            return;
        }

        // Sort by date (newest first)
        recordings.sort((a, b) => new Date(b.date) - new Date(a.date));

        libraryList.innerHTML = recordings.map(rec => {
            // Generate note chips with colors
            let notesHtml = '';
            // Handle new data structure: notesPracticed is likely in metrics, but check metadata too
            const metrics = rec.metrics || {};
            const metadata = rec.metadata || {};
            const notesPracticed = metrics.notesPracticed || metadata.notesPracticed || [];

            console.log(`Recording ${rec.id} full object:`, rec);
            console.log(`Recording ${rec.id} notes:`, notesPracticed);

            if (notesPracticed && notesPracticed.length > 0) {
                const maxNotes = 4; // Limit to 4 notes on display
                notesHtml = `<div class="recording-notes">
                    ${notesPracticed.slice(0, maxNotes).map(note => {
                    const color = getNoteColor(note.replace(/\d+/, '')); // Remove octave for color
                    return `<div class="note-chip-mini" style="background-color: ${color}; color: #000;">${note}</div>`;
                }).join('')}
                    ${notesPracticed.length > maxNotes ? `<div class="note-chip-mini" style="background: rgba(255,255,255,0.2); color: #fff;">+${notesPracticed.length - maxNotes}</div>` : ''}
                </div>`;
            }

            // Custom render for Intune Exercise (Unified Style)
            if (rec.category === 'intune-exercise') {
                const note = (rec.metadata && rec.metadata.targetNote) || (metrics.note) || '?';
                const score = (metrics.accuracy !== undefined) ? metrics.accuracy : (rec.metadata ? rec.metadata.score : 0);
                const color = getNoteColor(note.replace(/\d+/, '')); // Remove octave for color

                return `
                <div class="recording-item" data-id="${rec.id}">
                    <div class="recording-info">
                        <div class="recording-title" id="title-${rec.id}">
                            ${rec.singer || 'Unknown'} 
                            <span style="font-weight: normal; font-size: 0.9em; opacity: 0.7; margin-left: 8px;">Intune Practice</span>
                        </div>
                        <div class="recording-meta-row">
                            <!-- Small Puck -->
                            <div title="Target Note: ${note}" style="
                                background-color: ${color}; 
                                width: 24px; 
                                height: 24px; 
                                border-radius: 50%; 
                                display: inline-flex; 
                                align-items: center; 
                                justify-content: center; 
                                font-weight: bold; 
                                font-size: 0.75rem;
                                color: #fff;
                                box-shadow: 0 0 5px ${color}80;
                                margin-right: 8px;
                            ">
                                ${note}
                            </div>
                            <span>${new Date(rec.date).toLocaleString()}</span>
                            <span class="meta-separator"></span>
                            <span style="font-weight: bold; color: ${score >= 90 ? '#4CAF50' : score >= 70 ? '#2196F3' : '#FF9800'};">
                                Score: ${score}%
                            </span>
                        </div>
                    </div>
                    
                    <div class="recording-actions">
                        <button class="action-btn play" onclick="playRecording(${rec.id})" title="Play">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"/>
                            </svg>
                        </button>
                        <button class="action-btn" onclick="openRenameModal(${rec.id}, '${(rec.name || '').replace(/'/g, "\\'")}', '${(rec.singer || '').replace(/'/g, "\\'")}')" title="Rename">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <button class="action-btn delete" onclick="deleteRecording(${rec.id})" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </button>
                    </div>
                </div>
                `;
            }

            return `
            <div class="recording-item" data-id="${rec.id}">
                <div class="recording-info">
                    <div class="recording-title" id="title-${rec.id}">${rec.name || (rec.mode.charAt(0).toUpperCase() + rec.mode.slice(1) + ' Session')}</div>
                    <div class="recording-meta-row">
                        <span class="category-badge">${(rec.category || 'freestyle').toUpperCase()}</span>
                        <span class="meta-separator"></span>
                        <span class="recording-date">${new Date(rec.date).toLocaleDateString()}</span>
                        <span class="meta-separator"></span>
                        <span>${formatDuration(rec.duration)}</span>
                        ${(metrics.timeInTune !== undefined || metadata.timeInTune !== undefined) ? `
                        <span class="meta-separator"></span>
                        <span title="Tuning Quality" style="color: ${(metrics.timeInTune || metadata.timeInTune) > 80 ? 'var(--color-success)' : 'var(--color-text-secondary)'}">
                           ${metrics.timeInTune || metadata.timeInTune || 0}% 🎯
                        </span>
                        ` : ''}
                    </div>
                </div>
                
                ${notesHtml}

                <div class="recording-actions">
                    <button class="action-btn play" onclick="playRecording(${rec.id})" title="Play">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                    </button>
                    <button class="action-btn" onclick="openRenameModal(${rec.id}, '${(rec.name || '').replace(/'/g, "\\'")}', '${(rec.singer || '').replace(/'/g, "\\'")}')" title="Rename">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="action-btn delete" onclick="deleteRecording(${rec.id})" title="Delete">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Error loading recordings:', error);
        const libraryList = document.getElementById('libraryList');
        if (libraryList) libraryList.innerHTML = `<p class="error-state">Error loading recordings: ${error.message}</p>`;
    }
}



// Playback state
let audioPlayer = null;
let playbackAnimationId = null;
let currentRecordingData = null;
let isPlaybackActive = false;

// Playback UI Elements
const playbackControls = document.getElementById('playbackControls');
const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.querySelector('.play-icon');
const pauseIcon = document.querySelector('.pause-icon');
const seekBar = document.getElementById('seekBar');
const seekProgress = document.getElementById('seekProgress');
const playbackTime = document.getElementById('playbackTime');
const playbackDuration = document.getElementById('playbackDuration');
const closePlaybackBtn = document.getElementById('closePlaybackBtn');

/**
 * Start Playback
 */
async function playRecording(id) {
    try {
        const recording = await dbManager.getRecording(id);
        if (!recording) return;

        // Stop listening/recording and switch state FIRST
        // This ensures mic is off and context handling is clear
        updateAppState(AppState.PLAYBACK);


        // Setup audio
        if (audioPlayer) {
            audioPlayer.pause();
            audioPlayer = null;
        }

        const audioUrl = URL.createObjectURL(recording.audioBlob);
        audioPlayer = new Audio(audioUrl);

        // --- AUDIO ROUTING FOR VISUALIZER ---
        // Connect playback audio to visualizer's analyser so spectrogram/tuner work
        // --- AUDIO ROUTING FOR VISUALIZER ---
        // Connect playback audio to visualizer's analyser so spectrogram/tuner work

        // CLEANUP: Close previous playback context if it exists
        if (window.activePlaybackContext) {
            try {
                if (window.activePlaybackContext.state !== 'closed') {
                    await window.activePlaybackContext.close();
                }
            } catch (e) { console.warn('Error closing prev context', e); }
            window.activePlaybackContext = null;
        }

        let playbackContext = null;
        let playbackAnalyser = null;

        // ALWAYS create a fresh context for playback to ensure clean state
        // (Reusing pitchDetector context causes issues on mobile after ToneGenerator usage)
        try {
            playbackContext = new (window.AudioContext || window.webkitAudioContext)();
            window.activePlaybackContext = playbackContext; // Store globally for cleanup

            playbackAnalyser = playbackContext.createAnalyser();
            playbackAnalyser.fftSize = 8192;
            playbackAnalyser.smoothingTimeConstant = 0;

            // Update visualizer to use this new analyser
            if (visualizer) visualizer.setAnalyser(playbackAnalyser);

            // Create source from the new audio element
            const source = playbackContext.createMediaElementSource(audioPlayer);

            // Connect to visualizer analyser
            source.connect(playbackAnalyser);

            // Connect to destination (speakers) so we can hear it
            source.connect(playbackContext.destination);

            // Resume context (Mobile requires this after user gesture)
            if (playbackContext.state === 'suspended') {
                await playbackContext.resume();
            }
        } catch (e) {
            console.error("Error setting up playback audio context:", e);
            // Fallback: Play audio without visualizer if context fails
        }
        // ------------------------------------
        // ------------------------------------

        currentRecordingData = recording;
        isPlaybackActive = true;
        // updateAppState(AppState.PLAYBACK); // MOVED TO TOP

        // Initialize UI
        playbackControls.classList.add('active');
        playbackDuration.textContent = formatDuration(recording.duration);
        seekBar.max = recording.duration * 10; // 0.1s resolution
        seekBar.value = 0;
        updateSeekProgress(0);

        // Switch View to Visualization (Pitch Diagram)
        const visualizationContainer = document.getElementById('visualizationContainer');
        const libraryView = document.getElementById('libraryView');
        if (visualizationContainer && libraryView) {
            libraryView.style.display = 'none';
            visualizationContainer.style.display = 'block';
        }

        // Update Nav Tabs
        const modeBtns = document.querySelectorAll('.nav-tab');
        modeBtns.forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === 'pitch-diagram') {
                btn.classList.add('active');
            }
        });

        // Update Header Track Info
        const trackTitle = document.getElementById('trackTitle');
        const trackDate = document.getElementById('trackDate');
        const playbackTrackInfo = document.getElementById('playbackTrackInfo');

        if (trackTitle && trackDate && playbackTrackInfo) {
            trackTitle.textContent = recording.name || 'Untitled';
            trackDate.textContent = new Date(recording.date).toLocaleString();
            playbackTrackInfo.style.display = 'flex';
        }

        // Allow pitch visualizer to handle stored data
        // Update App State to PLAYBACK
        updateAppState(AppState.PLAYBACK);

        // Set visualizer to pitch diagram mode
        visualizer.setMode('pitch-diagram');
        visualizer.clear();

        // Start playback
        audioPlayer.play();

        // Reset/Apply Loop Default
        isLooping = false;
        loopBtn.classList.remove('active');
        audioPlayer.loop = isLooping;

        updatePlayPauseIcon(true);
        startPlaybackLoop();

        // Audio events
        audioPlayer.addEventListener('ended', () => {
            updatePlayPauseIcon(false);
            cancelAnimationFrame(playbackAnimationId);
            // Hide track info when playback ends
            const playbackTrackInfo = document.getElementById('playbackTrackInfo');
            if (playbackTrackInfo) {
                playbackTrackInfo.style.display = 'none';
            }
            // Keep controls open so user can replay
        });

    } catch (error) {
        console.error('Error playing recording:', error);
        alert('Error playing recording');
    }
}

/**
 * Rename a recording
 */
async function renameRecording(id) {
    // Determine the current name
    // Since we don't have the object handy, we can find it in DOM or generic "Recording"
    const currentNameElement = document.getElementById(`title-${id}`);
    const currentName = currentNameElement ? currentNameElement.textContent : 'Recording';

    const newName = prompt('Enter new name for recording:', currentName);
    if (!newName || newName.trim() === '') return;

    try {
        await dbManager.updateRecordingName(id, newName.trim());
        await loadRecordings(); // Refresh list
    } catch (error) {
        console.error('Error renaming recording:', error);
        alert('Error renaming recording');
    }
}

/**
 * Playback Loop (Sync Visualizer)
 */
function startPlaybackLoop() {
    if (!isPlaybackActive || !audioPlayer) return;

    const currentTime = audioPlayer.currentTime;

    // Update visualizer based on mode
    if (currentRecordingData && currentRecordingData.pitchData) {

        if (visualizer.mode === 'pitch-diagram') {
            visualizer.renderPlaybackFrame(currentTime, currentRecordingData.pitchData);
        }
        else if (visualizer.mode === 'tuner') {
            // Find the pitch frame closest to current time
            // binary search equivalent would be faster but simple find is safer for now
            // optimization: since we play forward, we could cache valid index, but for now simple:
            const timeMs = currentTime * 1000;
            // Find last point that is before or at current time
            // Assuming data is sorted by timestamp (it should be)
            // We search for a point within a small window (e.g. 100ms) to ensure sync
            // A simple approach is finding 
            let bestPoint = null;
            // Iterate backwards to find recent
            /* 
              Optimization: Use a binary search or just simple loop if array is not massive.
              Given typical recording size, a quick reverse loop from end is inefficient.
              Let's accept a simple .find() or just use a cached index if we wanted to be fancy.
              Let's use a standard .findLast() if available or filter.
            */
            // Use a helper variable for index if we want, but let's just find closest point
            // Optimization: Assume sample rate ~60fps, we can just math it if constant rate? 
            // No, data is non-uniform.
            // Let's use array.find for now.

            const closest = currentRecordingData.pitchData.reduce((prev, curr) => {
                return (Math.abs(curr.timestamp - timeMs) < Math.abs(prev.timestamp - timeMs) ? curr : prev);
            });

            if (closest && Math.abs(closest.timestamp - timeMs) < 200) { // 200ms tolerance
                // Push to visualizer for drawing
                visualizer.addPitchData(closest);
            }
        }
    }

    // Update UI
    playbackTime.textContent = formatDuration(currentTime);
    if (!isDraggingSeek) {
        seekBar.value = currentTime * 10;
        updateSeekProgress(currentTime / audioPlayer.duration * 100);
    }

    if (!audioPlayer.paused) {
        playbackAnimationId = requestAnimationFrame(startPlaybackLoop);
    }
}

/**
 * Update Play/Pause Icon
 */
function updatePlayPauseIcon(isPlaying) {
    if (isPlaying) {
        playIcon.style.display = 'none';
        pauseIcon.style.display = 'block';
    } else {
        playIcon.style.display = 'block';
        pauseIcon.style.display = 'none';
        // Stop loop if paused
        cancelAnimationFrame(playbackAnimationId);
    }
}

function updateSeekProgress(percent) {
    seekProgress.style.setProperty('--progress', `${percent}%`);
}

// Playback Event Listeners
const loopBtn = document.getElementById('loopBtn');
let isLooping = false;

loopBtn.addEventListener('click', () => {
    isLooping = !isLooping;
    if (audioPlayer) {
        audioPlayer.loop = isLooping;
    }

    if (isLooping) {
        loopBtn.classList.add('active');
    } else {
        loopBtn.classList.remove('active');
    }
});

playPauseBtn.addEventListener('click', () => {
    if (!audioPlayer) return;
    if (audioPlayer.paused) {
        audioPlayer.play();
        updatePlayPauseIcon(true);
        startPlaybackLoop();
    } else {
        audioPlayer.pause();
        updatePlayPauseIcon(false);
    }
});

let isDraggingSeek = false;
seekBar.addEventListener('mousedown', () => isDraggingSeek = true);
seekBar.addEventListener('mouseup', () => {
    isDraggingSeek = false;
    if (audioPlayer) {
        audioPlayer.currentTime = seekBar.value / 10;
    }
});
seekBar.addEventListener('input', () => {
    const percent = (seekBar.value / seekBar.max) * 100;
    updateSeekProgress(percent);
    playbackTime.textContent = formatDuration(seekBar.value / 10);
    // Live seek (optional, might be heavy)
    if (audioPlayer) {
        // audioPlayer.currentTime = seekBar.value / 10; 
        // Better to do on change/mouseup for audio, but we can update visualizer
        if (currentRecordingData && currentRecordingData.pitchData) {
            visualizer.renderPlaybackFrame(seekBar.value / 10, currentRecordingData.pitchData);
        }
    }
});
seekBar.addEventListener('change', () => {
    if (audioPlayer) {
        audioPlayer.currentTime = seekBar.value / 10;
        if (!audioPlayer.paused) {
            // Loop is already running
        } else {
            // Render single frame
            if (currentRecordingData && currentRecordingData.pitchData) {
                visualizer.renderPlaybackFrame(audioPlayer.currentTime, currentRecordingData.pitchData);
            }
        }
    }
});

closePlaybackBtn.addEventListener('click', stopPlayback);

function stopPlayback() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer = null;
    }
    isPlaybackActive = false;
    cancelAnimationFrame(playbackAnimationId);
    playbackControls.classList.remove('active');
    visualizer.clear();
    currentRecordingData = null;

    // Hide track info when closing playback
    const playbackTrackInfo = document.getElementById('playbackTrackInfo');
    if (playbackTrackInfo) {
        playbackTrackInfo.style.display = 'none';
    }

    updateAppState(AppState.IDLE);
}

/**
 * Delete a recording
 */
async function deleteRecording(id) {
    if (!confirm('Delete this recording?')) return;

    try {
        await dbManager.deleteRecording(id);
        await loadRecordings();
    } catch (error) {
        console.error('Error deleting recording:', error);
        alert('Error deleting recording');
    }
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Make functions global for onclick handlers
window.playRecording = playRecording;
window.deleteRecording = deleteRecording;

// Initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

/**
 * Update recording timer
 */
let timerInterval = null;
function startTimer() {
    let seconds = 0;
    if (recordingTimer) {
        recordingTimer.textContent = '00:00';
        recordingTimer.classList.add('visible');
    }

    // Clear any existing timer
    if (timerInterval) clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        seconds++;
        if (recordingTimer) {
            recordingTimer.textContent = formatDuration(seconds);
        }
    }, 1000);
}

function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    if (recordingTimer) {
        recordingTimer.classList.remove('visible');
    }
}

// --- PROGRESS TRACKER UI LOGIC ---
let accuracyChartInstance = null;

async function updateProgressUI() {
    console.log('Updating Progress UI...');

    // Get stats from DB (Mock for now, will implement real query)
    // We can pull all recordings and analyze them on the fly for MVP
    const recordings = await dbManager.getAllRecordings();

    let totalAccuracy = 0;
    let countWithMetrics = 0;
    let totalDuration = 0;

    const dates = [];
    const accuracies = [];
    let totalSessions = 0; // Move here, will count filtered sessions

    // Sort by date
    recordings.sort((a, b) => new Date(a.date) - new Date(b.date));
    const chartData = [];

    // Populate Singer Select
    const singerSelect = document.getElementById('singerSelect');
    const selectedSinger = singerSelect ? singerSelect.value : 'all';
    const singers = new Set();

    // Pass 1: Collect Singers
    if (singerSelect) {
        // Save current selection if re-running
        recordings.forEach(rec => {
            if (rec.singer && rec.singer.trim() !== '') {
                singers.add(rec.singer.trim());
            }
        });

        // Rebuild options only if needed or generic
        if (singerSelect.options.length <= 1 && singers.size > 0) {
            singers.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                singerSelect.appendChild(opt);
            });
            // Re-attach event listener to trigger update
            singerSelect.onchange = () => updateProgressUI();
        }
    }

    recordings.forEach(rec => {
        // FILTER: Check signer
        if (selectedSinger !== 'all') {
            if (!rec.singer || rec.singer.trim() !== selectedSinger) {
                return; // Skip this recording
            }
        }

        // If not skipped, count this session
        totalSessions++;

        const metrics = rec.metrics || (rec.metadata ? rec.metadata : null);

        // Support both old "accuracy" and new "timeInTune"
        let acc = undefined;
        if (metrics) {
            if (metrics.timeInTune !== undefined) acc = metrics.timeInTune;
            else if (metrics.accuracy !== undefined) acc = metrics.accuracy;
        }

        if (acc !== undefined) {
            totalAccuracy += acc;
            countWithMetrics++;

            dates.push(new Date(rec.date).toLocaleDateString());
            accuracies.push(acc);
        }
        if (rec.duration) totalDuration += rec.duration;
    });

    const avgAccuracy = countWithMetrics > 0 ? (totalAccuracy / countWithMetrics).toFixed(1) : 0;
    const hoursPracticed = (totalDuration / 3600).toFixed(2);

    // Update DOM
    const elTotal = document.getElementById('totalSessions');
    if (elTotal) elTotal.textContent = totalSessions;

    const elAvg = document.getElementById('avgAccuracy');
    if (elAvg) elAvg.textContent = `${avgAccuracy}%`;

    const elTime = document.getElementById('timePracticed');
    if (elTime) elTime.textContent = `${hoursPracticed}h`;

    // Update Chart - Group by Singer
    const canvas = document.getElementById('accuracyChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // Update Accuracy per Note Chart (if function exists)
    if (typeof renderAccuracyChart === 'function') {
        const selectedSingerVal = selectedSinger !== 'all' ? selectedSinger : null;
        let scores = {};
        if (selectedSingerVal) {
            try {
                scores = JSON.parse(localStorage.getItem(`pitchWiz_scores_${selectedSingerVal}`) || '{}');
            } catch (e) { console.error('Error loading scores', e); }
        }
        renderAccuracyChart(scores);
    }

    if (accuracyChartInstance) {
        accuracyChartInstance.destroy();
    }

    // Group data by singer
    const singerData = new Map();

    recordings.forEach(rec => {
        // Apply filter
        if (selectedSinger !== 'all') {
            if (!rec.singer || rec.singer.trim() !== selectedSinger) {
                return;
            }
        }

        const singer = rec.singer && rec.singer.trim() !== '' ? rec.singer.trim() : 'Unknown';
        const metrics = rec.metrics || {};
        const acc = metrics.timeInTune ?? metrics.accuracy;

        if (typeof acc === 'number') {
            if (!singerData.has(singer)) {
                singerData.set(singer, []);
            }
            singerData.get(singer).push(acc);
        }
    });

    // Calculate average accuracy per singer
    const singerLabels = [];
    const singerAccuracies = [];
    const singerColors = [
        '#6c5ce7', // Purple
        '#00b894', // Green
        '#fdcb6e', // Yellow
        '#e17055', // Orange
        '#74b9ff', // Blue
        '#a29bfe', // Light Purple
        '#fd79a8', // Pink
        '#00cec9'  // Cyan
    ];

    let colorIndex = 0;
    const datasets = [];

    singerData.forEach((accuracies, singer) => {
        const avgAcc = accuracies.reduce((sum, a) => sum + a, 0) / accuracies.length;
        const color = singerColors[colorIndex % singerColors.length];

        datasets.push({
            label: singer,
            data: [avgAcc],
            backgroundColor: color,
            borderColor: color,
            borderWidth: 2
        });

        colorIndex++;
    });

    // If filtering by singer, show sessions over time for that singer
    if (selectedSinger !== 'all' && datasets.length > 0) {
        // Time series view for selected singer
        const singerSessions = [];
        recordings.forEach(rec => {
            if (rec.singer && rec.singer.trim() === selectedSinger) {
                const metrics = rec.metrics || {};
                const acc = metrics.timeInTune ?? metrics.accuracy;
                if (typeof acc === 'number') {
                    singerSessions.push({
                        date: new Date(rec.date).toLocaleDateString(),
                        accuracy: acc
                    });
                }
            }
        });

        // Group sessions by date and calculate daily averages
        const sessionsByDate = new Map();
        singerSessions.forEach(session => {
            if (!sessionsByDate.has(session.date)) {
                sessionsByDate.set(session.date, []);
            }
            sessionsByDate.get(session.date).push(session.accuracy);
        });

        // Calculate daily averages
        const aggregatedData = Array.from(sessionsByDate.entries()).map(([date, accuracies]) => ({
            date,
            avgAccuracy: Math.round(accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length),
            sessionCount: accuracies.length
        }));

        // Sort by date
        aggregatedData.sort((a, b) => new Date(a.date) - new Date(b.date));

        accuracyChartInstance = new Chart(ctx, {
            type: 'line', // Changed from 'bar' to 'line' for trend visualization
            data: {
                labels: aggregatedData.map(d => d.date),
                datasets: [{
                    label: `${selectedSinger} - Daily Average Accuracy`,
                    data: aggregatedData.map(d => d.avgAccuracy),
                    backgroundColor: 'rgba(162, 155, 254, 0.2)',
                    borderColor: singerColors[0],
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3, // Smooth line
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#a29bfe' },
                        title: {
                            display: true,
                            text: 'Accuracy (%)',
                            color: '#dfe6e9'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a29bfe' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#dfe6e9' }
                    },
                    tooltip: {
                        callbacks: {
                            afterLabel: function (context) {
                                const dataIndex = context.dataIndex;
                                const sessionCount = aggregatedData[dataIndex].sessionCount;
                                return sessionCount > 1 ? `${sessionCount} sessions averaged` : '1 session';
                            }
                        }
                    }
                }
            }
        });
    } else {
        // Comparison view across all singers
        accuracyChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Average Accuracy'],
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { color: '#a29bfe' },
                        title: {
                            display: true,
                            text: 'Accuracy (%)',
                            color: '#dfe6e9'
                        }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#a29bfe' }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: { color: '#dfe6e9' }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0,0,0,0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff'
                    }
                }
            }
        });
    }
}


// Clear all recordings (Development tool)
async function clearAllRecordings() {
    if (!confirm('⚠️ WARNING: Delete ALL Recordings?\n\nThis will permanently delete all recordings from the library.\n\nThis action cannot be undone.\n\nAre you sure?')) {
        return;
    }

    try {
        if (typeof dbManager !== 'undefined' && dbManager.clearAllRecordings) {
            await dbManager.clearAllRecordings();

            // Refresh library view
            await loadRecordings();

            alert('✅ Library has been reset. All recordings deleted.');
        } else {
            alert('❌ Error: Database manager not available.');
        }
    } catch (error) {
        console.error('Error clearing recordings:', error);
        alert(`❌ Error clearing library: ${error.message}`);
    }
}

