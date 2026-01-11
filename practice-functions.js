/**
 * Practice Mode Functions for PitchWiz
 */

// ===== PRACTICE MODE FUNCTIONS =====


function initPracticeMode() {
    console.log('Initializing practice mode...');
    if (typeof ToneGenerator !== 'undefined' && !window.toneGenerator) {
        window.toneGenerator = new ToneGenerator();
    }
}

async function openPracticeView() {
    console.log('Opening practice view...');

    if (!window.toneGenerator) {
        initPracticeMode();
    }

    // Check for stored singer name in localStorage
    let storedSinger = localStorage.getItem('pitchWizSinger');

    // If no singer name, prompt for it
    if (!storedSinger) {
        storedSinger = prompt('👋 Welcome to Practice Mode!\n\nPlease enter your name:');

        if (!storedSinger || storedSinger.trim() === '') {
            alert('A singer name is required to use Practice Mode.');
            return;
        }

        // Save to localStorage
        localStorage.setItem('pitchWizSinger', storedSinger.trim());
    }

    currentSinger = storedSinger;

    // Update the singer name input if it exists
    const singerInput = document.getElementById('singerName');
    if (singerInput && !singerInput.value) {
        singerInput.value = currentSinger;
    }

    // Check if singer has a calibrated range
    try {
        const profile = await dbManager.getSingerProfile(currentSinger);

        if (profile) {
            displayRangeSummary(profile);
        } else {
            alert(`👋 Hi ${currentSinger}!\n\nLet's calibrate your vocal range.\n\nYou'll sing your lowest and highest comfortable notes.`);
            openRangeCalibration();
        }
    } catch (error) {
        console.error('Error opening practice view:', error);
    }
}

function displayRangeSummary(profile) {
    const card = document.getElementById('rangeSummaryCard');
    if (!card) return;

    card.style.display = 'block';

    document.getElementById('rangeLowest').textContent = profile.lowestNote;
    document.getElementById('rangeHighest').textContent = profile.highestNote;
    document.getElementById('rangeNoteCount').textContent = profile.range.length;
    document.getElementById('rangeDate').textContent = new Date(profile.dateCalibrated).toLocaleDateString();

    document.getElementById('intuneTotal').textContent = profile.range.length;

    // Fix: Ensure range is cached for the grid logic
    if (profile.lowestNote && profile.highestNote) {
        localStorage.setItem('pitchWizRange', JSON.stringify({
            min: profile.lowestNote,
            max: profile.highestNote
        }));
    }

    // Use the new puck grid logic
    if (typeof updateDashboardProgress === 'function') {
        updateDashboardProgress();
    } else {
        // Fallback or legacy (removed to prevent error)
    }
}

function openRangeCalibration() {
    const modal = document.getElementById('rangeCalibrationModal');
    if (!modal) return;

    modal.style.display = 'flex';

    if (typeof calibrationState !== 'undefined') {
        calibrationState = { lowest: null, highest: null };
    }

    // Reset displays
    document.getElementById('detectedLowest').textContent = '--';
    document.getElementById('detectedHighest').textContent = '--';
    document.getElementById('btnRecordHighest').disabled = true;
    document.getElementById('rangeResult').style.display = 'none';

    // Populate manual note selection dropdowns
    populateNoteDropdowns();
}

function closeRangeCalibration() {
    const modal = document.getElementById('rangeCalibrationModal');
    if (!modal) return;

    modal.style.display = 'none';

    if (typeof isCalibrating !== 'undefined' && isCalibrating && pitchDetector) {
        pitchDetector.stop();
        isCalibrating = false;
    }
}

async function recordLowestNote() {
    const btn = document.getElementById('btnRecordLowest');
    const display = document.getElementById('detectedLowest');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Listening...';
    display.textContent = 'Sing now...';

    isCalibrating = true;

    if (!pitchDetector || !isListening) {
        alert('⚠️ Please start the microphone first!\n\nClick the microphone button at the top, then try again.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Lowest Note';
        isCalibrating = false;
        return;
    }

    const detectedNotes = [];
    const duration = 3000;
    const startTime = Date.now();

    const collectInterval = setInterval(() => {
        if (pitchDetector && pitchDetector.lastPitchData) {
            const data = pitchDetector.lastPitchData;
            if (data.note && data.frequency) {
                const fullNote = `${data.note}${data.octave}`;
                detectedNotes.push({
                    note: fullNote,
                    frequency: data.frequency
                });
                display.textContent = fullNote;
            }
        }

        if (Date.now() - startTime >= duration) {
            clearInterval(collectInterval);
            finishLowestNote(detectedNotes, btn, display);
        }
    }, 100);
}

function finishLowestNote(detectedNotes, btn, display) {
    if (detectedNotes.length === 0) {
        display.textContent = 'No note detected';
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Lowest Note';
        isCalibrating = false;
        alert('No pitch detected. Please try again and sing louder.');
        return;
    }

    const noteCounts = {};
    detectedNotes.forEach(data => {
        noteCounts[data.note] = (noteCounts[data.note] || 0) + 1;
    });

    const mostCommon = Object.keys(noteCounts).reduce((a, b) =>
        noteCounts[a] > noteCounts[b] ? a : b
    );

    calibrationState.lowest = mostCommon;
    display.textContent = mostCommon;

    document.getElementById('btnRecordHighest').disabled = false;

    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Record Lowest Note';
    isCalibrating = false;

    console.log(`Lowest note detected: ${mostCommon} (${detectedNotes.length} samples)`);
}

async function recordHighestNote() {
    const btn = document.getElementById('btnRecordHighest');
    const display = document.getElementById('detectedHighest');

    btn.disabled = true;
    btn.querySelector('.btn-text').textContent = 'Listening...';
    display.textContent = 'Sing now...';

    isCalibrating = true;

    if (!pitchDetector || !isListening) {
        alert('⚠️ Please start the microphone first!\n\nClick the microphone button at the top, then try again.');
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Highest Note';
        isCalibrating = false;
        return;
    }

    const detectedNotes = [];
    const duration = 3000;
    const startTime = Date.now();

    const collectInterval = setInterval(() => {
        if (pitchDetector && pitchDetector.lastPitchData) {
            const data = pitchDetector.lastPitchData;
            if (data.note && data.frequency) {
                const fullNote = `${data.note}${data.octave}`;
                detectedNotes.push({
                    note: fullNote,
                    frequency: data.frequency
                });
                display.textContent = fullNote;
            }
        }

        if (Date.now() - startTime >= duration) {
            clearInterval(collectInterval);
            finishHighestNote(detectedNotes, btn, display);
        }
    }, 100);
}

function finishHighestNote(detectedNotes, btn, display) {
    if (detectedNotes.length === 0) {
        display.textContent = 'No note detected';
        btn.disabled = false;
        btn.querySelector('.btn-text').textContent = 'Record Highest Note';
        isCalibrating = false;
        alert('No pitch detected. Please try again and sing louder.');
        return;
    }

    const noteCounts = {};
    detectedNotes.forEach(data => {
        noteCounts[data.note] = (noteCounts[data.note] || 0) + 1;
    });

    const mostCommon = Object.keys(noteCounts).reduce((a, b) =>
        noteCounts[a] > noteCounts[b] ? a : b
    );

    calibrationState.highest = mostCommon;
    display.textContent = mostCommon;

    btn.disabled = false;
    btn.querySelector('.btn-text').textContent = 'Record Highest Note';
    isCalibrating = false;

    displayCalibrationResult();

    console.log(`Highest note detected: ${mostCommon} (${detectedNotes.length} samples)`);
}

function displayCalibrationResult() {
    const resultDiv = document.getElementById('rangeResult');
    if (!resultDiv) return;

    const { lowest, highest } = calibrationState;

    if (!lowest || !highest) return;

    try {
        const range = dbManager.generateNoteRange(lowest, highest);

        document.getElementById('resultLowest').textContent = lowest;
        document.getElementById('resultHighest').textContent = highest;
        document.getElementById('resultCount').textContent = range.length;

        resultDiv.style.display = 'block';

        console.log(`Range calculated: ${lowest} to ${highest} = ${range.length} notes`);
    } catch (error) {
        console.error('Error generating range:', error);
        alert('Error: Invalid note range. Please make sure highest note is higher than lowest note.');
    }
}

async function saveVocalRange() {
    const { lowest, highest } = calibrationState;

    // Check if we're creating a new user
    const pendingName = window.pendingNewUserName;
    const singerName = pendingName || currentSinger;

    if (!lowest || !highest || !singerName) {
        alert('Missing information. Please complete calibration.');
        return;
    }

    try {
        // Save the profile
        await dbManager.saveSingerProfile(singerName, lowest, highest);
        console.log('Vocal range saved successfully!');

        // If this was a new user, set them as current and clear pending
        if (pendingName) {
            localStorage.setItem('pitchWizSinger', pendingName);
            window.pendingNewUserName = null;
            alert(`✅ New user "${pendingName}" created!\n\nVocal range: ${lowest} to ${highest}\n\nReloading...`);
            window.location.reload();
            return;
        }

        closeRangeCalibration();

        const profile = await dbManager.getSingerProfile(singerName);

        // Cache range for grid
        if (profile && profile.lowestNote && profile.highestNote) {
            localStorage.setItem('pitchWizRange', JSON.stringify({
                min: profile.lowestNote,
                max: profile.highestNote
            }));
        }

        displayRangeSummary(profile);

        alert(`✅ Vocal range saved!\n\n${lowest} to ${highest}\n\nYou can now start practicing!`);
    } catch (error) {
        console.error('Error saving vocal range:', error);
        alert('Failed to save vocal range. Please try again.');
    }
}

// Intune Exercise State
let exerciseState = {
    currentNote: null,
    currentFreq: 0,
    isPlaying: false,
    isRecording: false,
    scores: {} // note -> score (0-100)
};

async function startIntuneExercise() {
    if (!currentSinger) {
        alert('Please set a singer name first!');
        return;
    }

    // Get profile
    try {
        const profile = await dbManager.getSingerProfile(currentSinger);
        if (!profile) {
            alert('Please calibrate your vocal range first!');
            return;
        }

        // Load persisted scores for this singer
        const saved = localStorage.getItem(`pitchWiz_scores_${currentSinger}`);
        if (saved) {
            try {
                exerciseState.scores = JSON.parse(saved);
            } catch (e) {
                console.warn("Failed to parse saved scores", e);
                exerciseState.scores = {};
            }
        } else {
            exerciseState.scores = {};
        }

        // Open Modal
        const modal = document.getElementById('intuneExerciseModal');
        if (modal) {
            modal.style.display = 'flex';

            // Set Header Info
            const headerInfo = document.getElementById('exerciseHeaderInfo');
            if (headerInfo) {
                const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
                headerInfo.textContent = `Singer: ${currentSinger || 'Guest'} • ${dateStr}`;
            }

            renderNoteGrid(profile.range);
        }
    } catch (error) {
        console.error('Error starting exercise:', error);
    }
}

function closeIntuneExercise() {
    const modal = document.getElementById('intuneExerciseModal');
    if (modal) {
        modal.style.display = 'none';

        // Stop tone but KEEP MIC LISTENING for next time
        if (window.toneGenerator) window.toneGenerator.stop();
        // REMOVED: if (pitchDetector && isListening) pitchDetector.stop(); 

        // Refresh summary on close (to update 0/26 count)
        // Robust retrieval of singer name
        let singerName = localStorage.getItem('pitchWizSinger');
        if (typeof currentSinger !== 'undefined' && currentSinger) {
            singerName = currentSinger;
        }

        if (singerName) {
            updateDashboardProgress();
        }
    }
}

// Fix audio context when playing reference tone
// ... (logic handled in playReferenceTone changes)

function generateNoteList(startNote, endNote) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const parse = (n) => {
        const m = n.match(/^([A-G]#?)(\d+)$/);
        return { note: m[1], octave: parseInt(m[2]), index: notes.indexOf(m[1]) };
    };
    const s = parse(startNote), e = parse(endNote);

    // Convert to absolute semitone index from C0
    const startVal = s.octave * 12 + s.index;
    const endVal = e.octave * 12 + e.index;

    const list = [];
    for (let i = startVal; i <= endVal; i++) {
        const oct = Math.floor(i / 12);
        const idx = i % 12;
        list.push(notes[idx] + oct);
    }
    return list;
}

// Populate note selection dropdowns
function populateNoteDropdowns() {
    const lowestSelect = document.getElementById('manualLowestNote');
    const highestSelect = document.getElementById('manualHighestNote');

    if (!lowestSelect || !highestSelect) return;

    // Generate all possible notes from C1 to C6
    const allNotes = generateNoteList('C1', 'C6');

    // Clear existing options (except the first placeholder)
    lowestSelect.innerHTML = '<option value="">Select...</option>';
    highestSelect.innerHTML = '<option value="">Select...</option>';

    // Populate both dropdowns
    allNotes.forEach(note => {
        const optionLow = document.createElement('option');
        optionLow.value = note;
        optionLow.textContent = note;
        lowestSelect.appendChild(optionLow);

        const optionHigh = document.createElement('option');
        optionHigh.value = note;
        optionHigh.textContent = note;
        highestSelect.appendChild(optionHigh);
    });
}

// Handle manual note selection change
function onManualNoteChange() {
    const lowestSelect = document.getElementById('manualLowestNote');
    const highestSelect = document.getElementById('manualHighestNote');

    if (!lowestSelect || !highestSelect) return;

    const lowest = lowestSelect.value;
    const highest = highestSelect.value;

    // Update calibration state
    if (lowest) {
        calibrationState.lowest = lowest;
        document.getElementById('detectedLowest').textContent = lowest;
        document.getElementById('btnRecordHighest').disabled = false;
    }

    if (highest) {
        calibrationState.highest = highest;
        document.getElementById('detectedHighest').textContent = highest;
    }

    // If both are selected, display the result
    if (lowest && highest) {
        displayCalibrationResult();
    }
}


function updateDashboardProgress() {
    const singerName = localStorage.getItem('pitchWizSinger') || (typeof currentSinger !== 'undefined' ? currentSinger : null);
    if (!singerName) return;

    // Get or Inject Grid Container
    let grid = document.getElementById('intunePuckGrid');
    if (!grid) {
        const btn = document.getElementById('btnStartIntune');
        if (btn) {
            const card = btn.closest('.exercise-card');
            const bar = card.querySelector('.progress-bar');
            if (bar) bar.style.display = 'none';
            const txt = card.querySelector('.progress-text');
            if (txt) txt.style.display = 'none';

            grid = card.querySelector('.intune-puck-grid');
            if (!grid) {
                grid = document.createElement('div');
                grid.id = 'intunePuckGrid';
                grid.className = 'intune-puck-grid';
                // Insert before button
                card.insertBefore(grid, btn);
            }
        }
    }
    if (!grid) return;

    grid.innerHTML = '';

    // Determine Range
    let min = 'C3', max = 'C5';
    try {
        const range = JSON.parse(localStorage.getItem('pitchWizRange'));
        if (range && range.min && range.max) { min = range.min; max = range.max; }
    } catch (e) { }

    const allNotes = generateNoteList(min, max);
    const scores = JSON.parse(localStorage.getItem(`pitchWiz_scores_${singerName}`) || '{}');

    // Ensure logic-driven styles are present
    injectPuckGridStyles();

    allNotes.forEach(note => {
        const scoreData = scores[note];
        const score = scoreData ? (scoreData.score !== undefined ? scoreData.score : scoreData) : 0;
        const puck = document.createElement('div');
        puck.className = 'mini-puck';
        puck.textContent = note;

        const noteName = note.match(/[A-G]#?/)[0];
        const hexColor = NOTE_COLORS[noteName] || '#999999';

        // Calculate background opacity based on score (0 to 1)
        // Ensure at least 0.1 for visibility if score > 0 but low? 
        // User asked "0% will be black", so 0 opacity is correct.
        const opacity = Math.max(0, score / 100);

        puck.style.backgroundColor = hexToRgba(hexColor, opacity);

        // Border: Keep faint border for structure
        puck.style.borderColor = hexToRgba(hexColor, 0.5);

        if (score >= 80) {
            puck.classList.add('completed');
            // Ensure full opacity for mastered? Or keep scale?
            // "100% will be 100%". So 80% is 0.8.
            // But .completed adds glow.
            puck.style.boxShadow = `0 0 12px ${hexColor}`;
            puck.title = `${note}: ${score}% (Mastered)`;
        } else {
            puck.title = `${note}: ${score}%`;
        }
        grid.appendChild(puck);
    });

    // Render Accuracy Chart
    renderAccuracyChart(scores);
}

function hexToRgba(hex, alpha) {
    let r = 0, g = 0, b = 0;
    // Remove # if present
    hex = hex.replace('#', '');

    if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const NOTE_COLORS = {
    'C': '#ff5252', 'C#': '#ff793f', 'D': '#ffb142', 'D#': '#ffda79',
    'E': '#fffa65', 'F': '#badc58', 'F#': '#7bed9f', 'G': '#26de81',
    'G#': '#2bcbba', 'A': '#45aaf2', 'A#': '#2d98da', 'B': '#a55eea'
};

function injectPuckGridStyles() {
    if (document.getElementById('puckGridStyles')) {
        // Force update (replace existing)
        document.getElementById('puckGridStyles').remove();
    }
    const style = document.createElement('style');
    style.id = 'puckGridStyles';
    style.textContent = `
        .intune-puck-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin: 15px 0;
            justify-content: center;
            padding: 15px;
            background: rgba(0,0,0,0.2);
            border-radius: 12px;
        }
        .mini-puck {
            width: 28px;
            height: 28px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            background-color: transparent;
            transition: all 0.3s ease;
            
            /* Text Alignment */
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            font-weight: 700;
            color: rgba(255,255,255,0.8);
            user-select: none;
            cursor: pointer; /* Interactive */
        }
        .mini-puck.completed {
            border-color: transparent;
            box-shadow: 0 0 10px currentColor; /* Glow */
            color: #1a1a1a; 
        }

        /* Modal Specific */
        #intuneExerciseModal .modal-content {
            max-width: 800px; /* Wider modal */
            width: 90%;
        }
        #noteGrid {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            justify-content: center;
            margin: 20px 0;
        }
        .note-btn {
            /* Reset button default */
            appearance: none;
            background: none;
            border: none;
            padding: 0;
            
            /* Puck Style */
            width: 42px; /* Bigger for interaction */
            height: 42px;
            border-radius: 50%;
            border: 2px solid rgba(255,255,255,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 14px;
            color: rgba(255,255,255,0.8);
            cursor: pointer;
            transition: all 0.2s ease;
        }
        .note-btn:hover {
            transform: scale(1.1);
        }
        .note-btn.active {
            transform: scale(1.2);
            box-shadow: 0 0 15px currentColor;
            z-index: 10;
        }
    `;
    document.head.appendChild(style);
}

function renderNoteGrid(range) {
    const grid = document.getElementById('noteGrid');
    if (!grid) return;

    grid.innerHTML = '';

    range.forEach(note => {
        const btn = document.createElement('button');
        btn.className = 'note-btn';
        btn.onclick = () => selectExerciseNote(note);

        const noteName = note.match(/[A-G]#?/)[0];
        const hexColor = NOTE_COLORS[noteName] || '#999999';
        const scoreData = exerciseState.scores[note];
        const score = scoreData ? (scoreData.score !== undefined ? scoreData.score : scoreData) : 0;

        // Show note name only (no thumbnails)
        btn.textContent = note;

        // Dynamic styling matching dashboard
        const opacity = Math.max(0, score / 100);
        btn.style.backgroundColor = hexToRgba(hexColor, opacity);
        btn.style.borderColor = hexToRgba(hexColor, 0.5);

        if (score >= 80) {
            btn.classList.add('completed');
            btn.style.boxShadow = `0 0 10px ${hexColor}`;
            btn.style.color = '#1a1a1a'; // Dark text on filled
            btn.title = `${note}: ${score}% (Mastered)`;
        } else {
            btn.style.color = 'rgba(255,255,255,0.9)';
            btn.title = `${note}: ${score}%`;
        }

        grid.appendChild(btn);
    });

    // Select first note by default
    if (range.length > 0) {
        selectExerciseNote(range[0]);
    }
}

function selectExerciseNote(note) {
    exerciseState.currentNote = note;

    // Display saved screenshot if note has been practiced, otherwise clear canvas
    const canvas = document.getElementById('practiceVisualizerCanvas');
    const scoreData = exerciseState.scores[note];

    if (canvas) {
        const ctx = canvas.getContext('2d');

        if (scoreData && scoreData.screenshot) {
            // Load and display the saved screenshot
            const img = new Image();

            // CRITICAL FIX: Set canvas dimensions BEFORE setting img.src
            // Setting canvas.width/height clears the canvas, so do it first
            canvas.width = 700;
            canvas.height = 200;

            // Fill background immediately while image loads
            ctx.fillStyle = '#1a1a2e';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            img.onload = function () {
                // Canvas dimensions already set, just draw the image
                // Draw screenshot to fill entire canvas, scaling if source differs
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            };
            img.onerror = function () {
                console.warn('Failed to load screenshot for note:', note);
                // Keep the background fill already applied
            };
            img.src = scoreData.screenshot;
        } else {
            // No previous attempt, clear canvas
            ctx.fillStyle = '#1a1a2e'; // Dark background
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
    }

    // MIC FIX: Ensure ToneGenerator shares audio context with Pitch Detector
    if (window.toneGenerator) {
        if (typeof pitchDetector !== 'undefined' && pitchDetector && pitchDetector.audioContext) {
            if (typeof window.toneGenerator.setContext === 'function') {
                if (window.toneGenerator.audioContext !== pitchDetector.audioContext) {
                    window.toneGenerator.setContext(pitchDetector.audioContext);
                }
            }
        }
        exerciseState.currentFreq = window.toneGenerator.noteToFrequency(note);
    }

    // Update UI
    document.querySelectorAll('.note-btn').forEach(btn => {
        btn.classList.remove('active');
        const noteName = btn.textContent.match(/[A-G]#?/)[0];
        const hexColor = NOTE_COLORS[noteName] || '#999';

        // Reset Transform
        btn.style.transform = 'scale(1)';

        // completed state style overrides
        if (btn.classList.contains('completed')) {
            btn.style.boxShadow = `0 0 10px ${hexColor}`;
        } else {
            btn.style.boxShadow = 'none';
        }

        if (btn.textContent === note) {
            btn.classList.add('active');
            btn.style.transform = 'scale(1.2)';
            btn.style.boxShadow = `0 0 20px ${hexColor}, 0 0 5px #fff`; // Stronger glow on active

            const targetDisplay = document.getElementById('targetNoteDisplay');
            if (targetDisplay) {
                targetDisplay.style.borderColor = hexColor;
                targetDisplay.style.color = hexColor;
            }
        }
    });

    document.getElementById('targetNoteDisplay').textContent = note;
    document.getElementById('targetFreqDisplay').textContent = `${Math.round(exerciseState.currentFreq)} Hz`;

    // RESTORE SCORE IF AVAILABLE
    const prevScore = scoreData ? (scoreData.score !== undefined ? scoreData.score : scoreData) : undefined;
    const resultDiv = document.getElementById('exerciseResult');

    if (prevScore !== undefined) {
        resultDiv.style.display = 'block';

        let feedback = "Keep trying";
        let color = "#EF4444";
        if (prevScore >= 90) { feedback = "Perfect!"; color = "#10B981"; }
        else if (prevScore >= 70) { feedback = "Good!"; color = "#3B82F6"; }
        else if (prevScore >= 50) { feedback = "Okay"; color = "#F59E0B"; }

        const scoreVal = document.getElementById('scoreValue');
        if (scoreVal) scoreVal.textContent = `${prevScore}%`;

        const scoreFeed = document.getElementById('scoreFeedback');
        if (scoreFeed) scoreFeed.textContent = feedback;

        const scoreCircle = document.querySelector('.score-circle');
        if (scoreCircle) scoreCircle.style.borderColor = color;

        const scoreSpan = document.querySelector('.score-circle span');
        if (scoreSpan) scoreSpan.style.color = color;

        document.getElementById('exerciseStatus').textContent = `Best: ${prevScore}%`;
    } else {
        resultDiv.style.display = 'none';
        document.getElementById('exerciseStatus').textContent = 'Ready to practice';
    }

    document.getElementById('btnPlayTone').disabled = false;
    document.getElementById('btnRecordExercise').disabled = false;

    // Navigation State
    const allBtns = Array.from(document.querySelectorAll('.note-btn'));
    const currentIndex = allBtns.findIndex(b => b.textContent === note);

    const btnPrev = document.getElementById('btnPrevNote');
    if (btnPrev) {
        // Can go Prev if not first note
        btnPrev.disabled = (currentIndex <= 0);
    }

    const btnNext = document.getElementById('btnNextNote');
    if (btnNext) {
        // Can go Next if:
        // 1. Current note has a score (already practiced)
        // 2. AND not last note
        if (prevScore !== undefined) {
            btnNext.disabled = (currentIndex >= allBtns.length - 1);
        } else {
            // If not practiced, must practice (disable Next)
            btnNext.disabled = true;
        }
    }
}


async function playReferenceTone() {
    if (!window.toneGenerator || !exerciseState.currentFreq) return;

    // FIX: Handle closed/suspended context issues
    try {
        if (pitchDetector && pitchDetector.audioContext) {
            if (pitchDetector.audioContext.state === 'closed') {
                console.warn('[Tone] Context closed, re-initializing ToneGenerator context');
                window.toneGenerator.audioContext = null;
                window.toneGenerator.init();
            } else if (pitchDetector.audioContext.state === 'suspended') {
                await pitchDetector.audioContext.resume();
            }

            // Sync contexts if needed
            if (window.toneGenerator.audioContext !== pitchDetector.audioContext && pitchDetector.audioContext.state === 'running') {
                window.toneGenerator.setContext(pitchDetector.audioContext);
            }
        }

        // Final check on generator's own context
        if (window.toneGenerator.audioContext && window.toneGenerator.audioContext.state === 'closed') {
            window.toneGenerator.audioContext = null;
            window.toneGenerator.init();
        }
    } catch (e) {
        console.error('Error fixing audio context:', e);
    }

    const btn = document.getElementById('btnPlayTone');
    btn.disabled = true;
    document.getElementById('btnRecordExercise').disabled = true;

    let countdown = 5;
    document.getElementById('exerciseStatus').textContent = `Listen... (${countdown}s)`;

    // Play tone (5 seconds, 50% volume)
    await window.toneGenerator.playNote(exerciseState.currentNote, 5, 0.5);

    const timer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            document.getElementById('exerciseStatus').textContent = `Listen... (${countdown}s)`;
        } else {
            clearInterval(timer);

            // Ensure silence but keep context alive
            if (window.toneGenerator) window.toneGenerator.stop();

            // CRITICAL: Ensure AudioContext didn't suspend due to silence/inactivity
            if (pitchDetector && pitchDetector.audioContext) {
                if (pitchDetector.audioContext.state === 'suspended') {
                    console.log('AudioContext suspended after tone, forcing resume...');
                    pitchDetector.audioContext.resume();
                }
            }

            document.getElementById('exerciseStatus').textContent = 'Now your turn!';
            btn.disabled = false;
            document.getElementById('btnRecordExercise').disabled = false;

            // Auto click record for smooth flow? Optional.
            // recordExerciseAttempt();
        }
    }, 1000);
}

async function recordExerciseAttempt() {
    if (!pitchDetector) return;

    const btn = document.getElementById('btnRecordExercise');
    btn.disabled = true;
    document.getElementById('btnPlayTone').disabled = true;

    // Ensure mic is on
    if (!isListening) {
        alert('⚠️ Please start the microphone first!');
        btn.disabled = false;
        document.getElementById('btnPlayTone').disabled = false;
        return;
    }

    // MIC FIX: Ensure context is running
    try {
        if (pitchDetector.audioContext && pitchDetector.audioContext.state === 'suspended') {
            await pitchDetector.audioContext.resume();
        }
    } catch (e) { console.warn('Could not resume audio context', e); }

    let countdown = 5;
    const targetFreq = exerciseState.currentFreq;
    const targetNote = exerciseState.currentNote;
    const recordedDiffs = []; // Array of cent differences

    // Initialize practice visualizer
    const canvas = document.getElementById('practiceVisualizerCanvas');
    let practiceVisualizer = null;
    if (canvas && typeof Visualizer !== 'undefined') {
        practiceVisualizer = new Visualizer(canvas, { mode: 'pitch-diagram' });
        practiceVisualizer.resize();

        // Set range around target note (±5 semitones)
        const targetMidi = noteToMidi(targetNote);
        practiceVisualizer.minNote = targetMidi - 5;
        practiceVisualizer.maxNote = targetMidi + 5;
        practiceVisualizer.noteRange = 10;

        // Clear canvas
        practiceVisualizer.ctx.fillStyle = practiceVisualizer.colors.background;
        practiceVisualizer.ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // RECORDING LOGIC
    let mediaRecorder = null;
    let audioChunks = [];

    try {
        if (pitchDetector.microphone && pitchDetector.microphone.mediaStream) {
            const stream = pitchDetector.microphone.mediaStream;
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0) audioChunks.push(event.data);
            };
            mediaRecorder.start();
        }
    } catch (e) {
        console.warn('Recording failed to start:', e);
    }

    document.getElementById('exerciseStatus').textContent = `Sing! (${countdown}s)`;
    const targetDisplay = document.getElementById('targetNoteDisplay');
    targetDisplay.classList.add('recording-pulse');

    const timer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            document.getElementById('exerciseStatus').textContent = `Sing! (${countdown}s)`;
        } else {
            clearInterval(timer);
            targetDisplay.classList.remove('recording-pulse');

            // Capture canvas screenshot
            let canvasScreenshot = null;
            if (practiceVisualizer && canvas) {
                try {
                    // CRITICAL FIX: Ensure canvas is at full resolution before screenshot
                    // CSS scaling on mobile might have changed display size
                    const currentWidth = canvas.width;
                    const currentHeight = canvas.height;

                    // Force canvas to full resolution if it's been scaled down
                    if (currentWidth !== 700 || currentHeight !== 200) {
                        canvas.width = 700;
                        canvas.height = 200;
                        // Redraw the visualizer at full resolution
                        if (practiceVisualizer && typeof practiceVisualizer.drawPitchDiagram === 'function') {
                            practiceVisualizer.drawPitchDiagram();
                        }
                    }

                    canvasScreenshot = canvas.toDataURL('image/png');
                } catch (e) {
                    console.warn('Failed to capture canvas screenshot:', e);
                }
            }

            // Stop recorder and finish
            if (mediaRecorder && mediaRecorder.state !== 'inactive') {
                mediaRecorder.stop();
                mediaRecorder.onstop = () => {
                    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                    // Pass blob, pitchData, and screenshot to finish function
                    finishExerciseAttempt(recordedDiffs, btn, audioBlob, recordedPitchData, canvasScreenshot);
                };
            } else {
                finishExerciseAttempt(recordedDiffs, btn, null, [], canvasScreenshot);
            }
        }
    }, 1000);

    // Collect data frequently
    const startTime = Date.now();
    const recordedPitchData = [];

    const dataTimer = setInterval(() => {
        if (countdown <= 0) {
            clearInterval(dataTimer);
            return;
        }

        // Use exposed data or callback approach
        const data = pitchDetector.lastPitchData;

        if (data && data.frequency) {
            // Capture for playback visualizer
            recordedPitchData.push({
                timestamp: Date.now() - startTime,
                frequency: data.frequency,
                note: data.note,
                confidence: 0.9
            });

            // Update practice visualizer in real-time
            if (practiceVisualizer) {
                const centsDiff = 1200 * Math.log2(data.frequency / targetFreq);
                const color = getAccuracyColor(Math.abs(centsDiff));

                practiceVisualizer.pitchHistory.push({
                    frequency: data.frequency,
                    note: data.note,
                    color: color
                });

                // Keep history manageable
                if (practiceVisualizer.pitchHistory.length > practiceVisualizer.maxHistoryLength) {
                    practiceVisualizer.pitchHistory.shift();
                }

                // Render the visualization
                practiceVisualizer.drawPitchDiagram();
            }

            // Calculate cents difference manually for accuracy
            // 1200 * log2(f1 / f2)
            const centsDiff = 1200 * Math.log2(data.frequency / targetFreq);

            // Relaxed range to 200 cents (2 semitones) to catch more user attempts
            if (Math.abs(centsDiff) < 200) {
                recordedDiffs.push(Math.abs(centsDiff));
            }
        }
    }, 15); // ~60fps for smoother playback visualization
}

// Helper function to convert note name to MIDI number
function noteToMidi(noteName) {
    const noteMap = { 'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5, 'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11 };
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 60; // Default to C4
    const note = match[1];
    const octave = parseInt(match[2]);
    return (octave + 1) * 12 + noteMap[note];
}

// Helper function to get color based on accuracy
function getAccuracyColor(centsDiff) {
    if (centsDiff < 10) return '#4CAF50'; // Green - on pitch
    if (centsDiff < 25) return '#FFC107'; // Yellow - close
    if (centsDiff < 50) return '#FF9800'; // Orange - off
    return '#F44336'; // Red - very off
}


async function finishExerciseAttempt(diffs, btn, audioBlob, pitchData = [], canvasScreenshot = null) {
    document.getElementById('targetNoteDisplay').classList.remove('recording-pulse');
    document.getElementById('btnPlayTone').disabled = false;
    btn.disabled = false;
    document.getElementById('btnNextNote').disabled = false;

    // Calculate Score
    let score = 0;
    let feedback = "Try Again";
    let color = "#EF4444"; // Red

    if (diffs.length > 10) { // Require at least some samples
        // GLIDE ELIMINATION: Ignore the first 30% of the attempt to account for "scoops"
        // At 60fps, 1 second is ~60 samples.
        const samplesToTrim = Math.min(Math.floor(diffs.length * 0.3), 60);
        const validDiffs = diffs.slice(samplesToTrim);

        if (validDiffs.length === 0) {
            // Should not happen unless length was small, fallback to all
            const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;
            score = Math.max(0, Math.round(100 - (avgDiff * 2)));
        } else {
            const avgDiff = validDiffs.reduce((a, b) => a + b, 0) / validDiffs.length;

            // Refined Scoring: Allow 5 cents margin of error for perfect score
            // Then penalize 2 points per cent deviation
            score = Math.max(0, Math.round(100 - (Math.max(0, avgDiff - 5) * 2)));
        }

        if (score >= 90) { feedback = "Perfect!"; color = "#10B981"; }
        else if (score >= 70) { feedback = "Good!"; color = "#3B82F6"; }
        else if (score >= 50) { feedback = "Okay"; color = "#F59E0B"; }
    } else {
        feedback = "No pitch detected";
    }

    // MANUAL SAVE SETUP
    exerciseState.lastRecording = null;

    const saveBtn = document.getElementById('btnSaveResult');
    if (audioBlob) {
        console.log('[Practice] Audio blob captured:', audioBlob.size);
        exerciseState.lastRecording = {
            blob: audioBlob,
            score: score,
            targetNote: exerciseState.currentNote,
            targetFreq: exerciseState.currentFreq,
            pitchData: pitchData
        };

        if (saveBtn) {
            saveBtn.style.display = 'block';
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save to Library';
            // saveBtn.onclick = saveLastRecordingToLibrary; // Assuming global or add here
            // Better to add onclick in HTML or here:
            saveBtn.onclick = () => saveLastRecordingToLibrary();
        }
    } else {
        console.warn('[Practice] No audio blob captured');
        if (saveBtn) saveBtn.style.display = 'none';
    }

    // Display Result
    // Ensure element exists (it's in the modal)
    const resultDiv = document.getElementById('exerciseResult');
    if (resultDiv) {
        resultDiv.style.display = 'block';

        const scoreVal = document.getElementById('scoreValue');
        if (scoreVal) scoreVal.textContent = `${score}%`;

        const scoreFeed = document.getElementById('scoreFeedback');
        if (scoreFeed) scoreFeed.textContent = feedback;

        const scoreCircle = document.querySelector('.score-circle');
        if (scoreCircle) scoreCircle.style.borderColor = color;

        const scoreSpan = document.querySelector('.score-circle span');
        if (scoreSpan) scoreSpan.style.color = color;
    }

    document.getElementById('exerciseStatus').textContent = `Result: ${score}% Accuracy`;

    // Save score and screenshot
    exerciseState.scores[exerciseState.currentNote] = {
        score: score,
        screenshot: canvasScreenshot,
        timestamp: Date.now()
    };

    // PERSIST SCORES
    if (typeof currentSinger !== 'undefined' && currentSinger) {
        try {
            localStorage.setItem(`pitchWiz_scores_${currentSinger}`, JSON.stringify(exerciseState.scores));

            // Force update summary if visible (optional, but good for real-time feedback if dashboard is behind modal)
            // displayRangeSummary(currentProfile?); 
        } catch (e) { console.warn("Failed to persist scores", e); }
    }

    // Mark as completed in grid if good score
    if (score >= 80) {
        // Find button by text
        const gridBtns = document.querySelectorAll('.note-btn');
        gridBtns.forEach(b => {
            if (b.textContent === exerciseState.currentNote) {
                b.classList.add('completed');
                // Ensure color
                const noteName = exerciseState.currentNote.match(/[A-G]#?/)[0];
                const colorVar = `--note-${noteName.replace('#', 's').toLowerCase()}`;
                b.style.backgroundColor = `var(${colorVar})`;
                b.style.color = '#fff';
            }
        });
    }

    // Update dashboard grid for ALL completed notes (not just high scores)
    if (typeof updateDashboardProgress === 'function') {
        updateDashboardProgress();
    }
}

function selectPrevNote() {
    const btns = Array.from(document.querySelectorAll('.note-btn'));
    const currentIndex = btns.findIndex(b => b.textContent === exerciseState.currentNote);

    if (currentIndex > 0) {
        selectExerciseNote(btns[currentIndex - 1].textContent);
        btns[currentIndex - 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function selectNextNote() {
    const btns = Array.from(document.querySelectorAll('.note-btn'));
    const currentIndex = btns.findIndex(b => b.textContent === exerciseState.currentNote);

    if (currentIndex >= 0 && currentIndex < btns.length - 1) {
        selectExerciseNote(btns[currentIndex + 1].textContent);

        // Scroll to button
        btns[currentIndex + 1].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
        alert('Exercise complete! Great job!');
    }
}

function changeSingerName() {
    const newName = prompt('Enter your name:', localStorage.getItem('pitchWizSinger') || '');

    if (newName && newName.trim() !== '') {
        localStorage.setItem('pitchWizSinger', newName.trim());
        currentSinger = newName.trim();

        const singerInput = document.getElementById('singerName');
        if (singerInput) {
            singerInput.value = currentSinger;
        }

        alert(`✅ Singer name updated to: ${currentSinger}`);
    }
}
// ===== NEW SAVE/RESET FUNCTIONS =====

async function saveLastRecordingToLibrary() {
    if (!exerciseState.lastRecording || !exerciseState.lastRecording.blob) {
        alert('No recording available to save.');
        return;
    }

    const rec = exerciseState.lastRecording;
    const saveBtn = document.getElementById('btnSaveResult');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    if (!window.dbManager) {
        alert('Database functionality missing. Check console.');
        if (saveBtn) saveBtn.disabled = false;
        return;
    }

    try {
        const singerName = localStorage.getItem('pitchWizSinger') || 'Guest';
        await window.dbManager.saveRecording({
            date: new Date().toISOString(),
            duration: 5,
            mode: 'practice',
            name: `Practice: ${rec.targetNote}`,
            singer: singerName,
            category: 'intune-exercise',
            metrics: { accuracy: rec.score, note: rec.targetNote },
            audioBlob: rec.blob,
            metadata: {
                targetNote: rec.targetNote,
                targetFreq: rec.targetFreq,
                score: rec.score
            },
            pitchData: rec.pitchData // Save pitch data for visualizer
        });

        if (saveBtn) {
            saveBtn.textContent = '✅ Saved!';
        }
        console.log('Manually saved recording to library');

        // Try to update library UI if present
        if (typeof renderLibrary === 'function') renderLibrary();

    } catch (e) {
        console.error('Manual save failed:', e);
        alert('Failed to save: ' + e.message);
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = '💾 Save to Library';
        }
    }
}

function resetPracticeProgress() {
    const singer = localStorage.getItem('pitchWizSinger');
    if (!singer) {
        alert('No active singer profile found.');
        return;
    }

    if (!confirm(`⚠️ RESET PROGRESS\n\nAre you sure you want to reset all saved scores for "${singer}"?\nThis cannot be undone.`)) {
        return;
    }

    // Clear scores
    exerciseState.scores = {};
    localStorage.removeItem(`pitchWiz_scores_${singer}`);

    // Update UI
    const el = document.getElementById('intuneCompleted');
    if (el) el.textContent = '0';

    const bar = document.getElementById('intuneProgress');
    if (bar) bar.style.width = '0%';

    document.querySelectorAll('.note-btn.completed').forEach(btn => {
        btn.classList.remove('completed');
        btn.style.backgroundColor = '';
        btn.style.boxShadow = '';
        btn.style.opacity = '0.7';
        // restore original color logic if needed, but remove completed class handles most
    });

    alert('✅ Progress has been reset.');

    // Refresh modal if open
    closeIntuneExercise();
    // Re-open? Or just leave closed.
}

// Initialize dashboard progress on load
document.addEventListener('DOMContentLoaded', () => {
    // Allow time for DOM to settle
    setTimeout(() => {
        if (typeof updateDashboardProgress === 'function') {
            updateDashboardProgress();
        }
        // Update header profile name
        updateHeaderProfileName();
    }, 500);

    // Profile button event listener
    const profileBtn = document.getElementById('profileBtn');
    if (profileBtn) {
        profileBtn.addEventListener('click', openProfileModal);
    }

    // Profile modal close button
    const closeProfileModal = document.getElementById('closeProfileModal');
    if (closeProfileModal) {
        closeProfileModal.addEventListener('click', closeProfileModalFunc);
    }

    // Calibration button in profile modal
    const openCalibrationBtn = document.getElementById('openCalibrationBtn');
    if (openCalibrationBtn) {
        openCalibrationBtn.addEventListener('click', () => {
            closeProfileModalFunc();
            openRangeCalibration();
        });
    }

    // Singer dropdown for selecting existing profiles
    const singerListSelect = document.getElementById('singerListSelect');
    if (singerListSelect) {
        singerListSelect.addEventListener('change', (e) => {
            const selectedSinger = e.target.value;
            if (selectedSinger) {
                switchSinger(selectedSinger);
            }
        });
    }

    // Create new profile button
    const createProfileBtn = document.getElementById('createProfileBtn');
    if (createProfileBtn) {
        createProfileBtn.addEventListener('click', () => {
            const profileSingerInput = document.getElementById('profileSingerInput');
            const newSinger = profileSingerInput.value.trim();
            if (newSinger) {
                switchSinger(newSinger);
                profileSingerInput.value = '';
            } else {
                alert('Please enter a singer name.');
            }
        });
    }

    // Singer input for switching/creating profiles (Enter key)
    const profileSingerInput = document.getElementById('profileSingerInput');
    if (profileSingerInput) {
        profileSingerInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const newSinger = profileSingerInput.value.trim();
                if (newSinger) {
                    switchSinger(newSinger);
                    profileSingerInput.value = '';
                }
            }
        });
    }
});

// Update header profile name
function updateHeaderProfileName() {
    const headerName = document.getElementById('headerProfileName');
    if (headerName) {
        const singer = localStorage.getItem('pitchWizSinger') || currentSinger || 'Guest';
        headerName.textContent = singer;
        headerName.style.display = 'inline';
    }
    // Element removed from header - profile now in settings page
}

// Open Profile Modal
async function openProfileModal() {
    const modal = document.getElementById('profileModal');
    const currentNameEl = document.getElementById('currentProfileName');
    const statusEl = document.getElementById('profileCalibrationStatus');
    const singerSelect = document.getElementById('singerListSelect');

    if (!modal) return;

    // Get current singer
    const singer = localStorage.getItem('pitchWizSinger') || 'Guest';
    if (currentNameEl) {
        currentNameEl.textContent = singer;
    }

    // Check calibration status
    const rangeData = localStorage.getItem('pitchWizRange');
    if (statusEl) {
        if (rangeData) {
            try {
                const range = JSON.parse(rangeData);
                statusEl.textContent = `✓ ${range.min} - ${range.max}`;
                statusEl.className = 'status-badge calibrated';
            } catch (e) {
                statusEl.textContent = 'Not Calibrated';
                statusEl.className = 'status-badge';
            }
        } else {
            statusEl.textContent = 'Not Calibrated';
            statusEl.className = 'status-badge';
        }
    }

    // Populate singer list from recordings
    if (singerSelect && typeof dbManager !== 'undefined') {
        try {
            const recordings = await dbManager.getAllRecordings();


            const singers = [...new Set(recordings.map(r => r.singer).filter(Boolean))].sort();


            // Clear and repopulate
            singerSelect.innerHTML = '<option value="">-- Select a singer --</option>';
            singers.forEach(s => {
                const option = document.createElement('option');
                option.value = s;
                option.textContent = s;
                if (s === singer) option.selected = true;
                singerSelect.appendChild(option);
            });
        } catch (e) {
            console.error('Error loading singers:', e);
        }
    }

    modal.style.display = 'flex';
}

// Close Profile Modal
function closeProfileModalFunc() {
    const modal = document.getElementById('profileModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Switch Singer Profile
async function switchSinger(newSingerName) {
    if (!newSingerName || newSingerName.trim() === '') {
        alert('Please enter a valid singer name.');
        return;
    }

    const previousSinger = localStorage.getItem('pitchWizSinger');

    // Update current singer
    localStorage.setItem('pitchWizSinger', newSingerName);
    currentSinger = newSingerName;

    console.log(`Switched profile from "${previousSinger}" to "${newSingerName}"`);

    // Update header
    updateHeaderProfileName();

    // Load profile data
    if (typeof dbManager !== 'undefined') {
        const profile = await dbManager.getSingerProfile(newSingerName);
        if (profile) {
            // Update cached range
            if (profile.lowestNote && profile.highestNote) {
                localStorage.setItem('pitchWizRange', JSON.stringify({
                    min: profile.lowestNote,
                    max: profile.highestNote
                }));
            }

            // Update practice view if visible
            if (typeof displayRangeSummary === 'function') {
                displayRangeSummary(profile);
            }
        } else {
            // New profile - clear range
            localStorage.removeItem('pitchWizRange');
        }
    }

    // Reload dashboard and practice UI
    if (typeof updateDashboardProgress === 'function') {
        updateDashboardProgress();
    }

    // Close modal
    closeProfileModalFunc();

    alert(`✓ Switched to profile: ${newSingerName}`);

    // Clear the input
    const input = document.getElementById('profileSingerInput');
    if (input) input.value = '';
}

let accuracyNoteChartInstance = null;

function renderAccuracyChart(scores) {
    const ctx = document.getElementById('accuracyPerNoteChart');
    if (!ctx) return;

    // Filter notes that have actual scores
    const notes = Object.keys(scores).filter(n => {
        const val = scores[n];
        const score = (typeof val === 'object' && val !== null) ? val.score : val;
        return score !== undefined && score !== null;
    }).sort((a, b) => {
        const parseNote = (n) => {
            const match = n.match(/([A-G]#?)(\d)/);
            if (!match) return 0;
            const semi = "C C# D D# E F F# G G# A A# B".split(' ').indexOf(match[1]);
            const octave = parseInt(match[2]);
            return octave * 12 + semi;
        };
        return parseNote(a) - parseNote(b);
    });

    if (notes.length === 0) {
        if (accuracyNoteChartInstance) {
            accuracyNoteChartInstance.destroy();
            accuracyNoteChartInstance = null;
        }
        return;
    }

    const dataValues = notes.map(n => {
        const val = scores[n];
        return (typeof val === 'object' && val !== null) ? val.score : val;
    });

    const backgroundColors = notes.map(n => {
        const noteName = n.match(/[A-G]#?/)[0];
        return NOTE_COLORS[noteName] || '#999';
    });

    // Border colors (slightly lighter/darker)
    const borderColors = notes.map(n => {
        return '#ffffff';
    });

    if (accuracyNoteChartInstance) {
        accuracyNoteChartInstance.destroy();
    }

    if (typeof Chart === 'undefined') return;

    accuracyNoteChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: notes,
            datasets: [{
                label: 'Accuracy (%)',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1,
                barPercentage: 0.8
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
                    ticks: { color: '#a0a0a0' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#a0a0a0' }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Accuracy: ${context.parsed.y}%`;
                        }
                    }
                }
            }
        }
    });
}
