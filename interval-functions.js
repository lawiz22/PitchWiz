// ============================================
// INTERVAL PRACTICE - CORE LOGIC [RESTORED]
// ============================================

// --- DIFFICULTY LEVELS ---
// --- DIFFICULTY LEVELS ---
const INTERVAL_LEVELS = {
    beginner: {
        name: "Easy",
        intervals: [
            { name: 'Major 2nd', semi: 2 },
            { name: 'Major 3rd', semi: 4 },
            { name: 'Perfect 5th', semi: 7 },
            { name: 'Octave', semi: 12 }
        ],
        description: "Fundamental (Oct, M2, M3, P5)"
    },
    intermediate: {
        name: "Intermediate",
        intervals: [
            // Easy
            { name: 'Major 2nd', semi: 2 }, { name: 'Major 3rd', semi: 4 },
            { name: 'Perfect 5th', semi: 7 }, { name: 'Octave', semi: 12 },
            // Intermediate Adds
            { name: 'Minor 2nd', semi: 1 }, { name: 'Minor 3rd', semi: 3 },
            { name: 'Perfect 4th', semi: 5 }, { name: 'Major 6th', semi: 9 }
        ],
        description: "Basic (+ m2, m3, P4, M6)"
    },
    advanced: {
        name: "Advanced",
        intervals: [
            // Intermediate
            { name: 'Major 2nd', semi: 2 }, { name: 'Major 3rd', semi: 4 },
            { name: 'Perfect 5th', semi: 7 }, { name: 'Octave', semi: 12 },
            { name: 'Minor 2nd', semi: 1 }, { name: 'Minor 3rd', semi: 3 },
            { name: 'Perfect 4th', semi: 5 }, { name: 'Major 6th', semi: 9 },
            // Advanced Adds
            { name: 'Minor 6th', semi: 8 }, { name: 'Tritone', semi: 6 },
            { name: 'Minor 7th', semi: 10 }, { name: 'Major 7th', semi: 11 }
        ],
        description: "Tension (+ TT, m6, 7ths)"
    },
    expert: {
        name: "Expert",
        intervals: [
            // Advanced
            { name: 'Major 2nd', semi: 2 }, { name: 'Major 3rd', semi: 4 },
            { name: 'Perfect 5th', semi: 7 }, { name: 'Octave', semi: 12 },
            { name: 'Minor 2nd', semi: 1 }, { name: 'Minor 3rd', semi: 3 },
            { name: 'Perfect 4th', semi: 5 }, { name: 'Major 6th', semi: 9 },
            { name: 'Minor 6th', semi: 8 }, { name: 'Tritone', semi: 6 },
            { name: 'Minor 7th', semi: 10 }, { name: 'Major 7th', semi: 11 },
            // Expert Adds
            { name: 'Minor 9th', semi: 13 }, { name: 'Major 9th', semi: 14 },
            { name: 'Perfect 11th', semi: 17 }, { name: 'Augmented 11th', semi: 18 },
            { name: 'Major 13th', semi: 21 }
        ],
        description: "Extensions (+ 9th, 11th, 13th)"
    }
};

// --- STATE ---
let intervalState = {
    level: 'intermediate',
    direction: 'asc',
    currentRef: null,
    currentTarget: null,
    currentIntervalName: null,
    isRecording: false,
    audioBlob: null,
    targetHitTimestamp: null,
    autoStopTimer: null,
    visualizer: null
};

// --- SETUP UI ---
function openIntervalSetup() {
    const modal = document.getElementById('intervalConfigModal');
    if (modal) modal.style.display = 'flex';
    selectLevel(intervalState.level);
    selectDirection(intervalState.direction);
}

function closeIntervalConfig() {
    document.getElementById('intervalConfigModal').style.display = 'none';
}

function selectLevel(lvl) {
    intervalState.level = lvl;
    document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
    const card = document.getElementById('lvl_' + lvl);
    if (card) card.classList.add('selected');
}


function selectDirection(dir) {
    intervalState.direction = dir;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('dir_' + dir).classList.add('active');
}

function initIntervalVisualizer() {
    const canvas = document.getElementById('intervalCanvas');

    // Create visualizer only once
    if (!intervalState.visualizer && canvas && typeof Visualizer !== 'undefined') {
        intervalState.visualizer = new Visualizer(canvas);
        intervalState.visualizer.start();
        console.log('✅ Interval visualizer created');
    }

    // Always update range and zoom for current interval
    if (intervalState.visualizer) {
        const refMidi = noteToMidi(intervalState.currentRef);
        const tgtMidi = noteToMidi(intervalState.currentTarget);
        const intervalSize = Math.abs(tgtMidi - refMidi);

        // Dynamic zoom based on interval size
        let zoom;
        if (intervalSize <= 2) zoom = 5.0;       // Minor 2nd, Major 2nd
        else if (intervalSize <= 3) zoom = 4.0;  // Minor 3rd
        else if (intervalSize <= 7) zoom = 2.5;  // M3, P4, Tritone, P5, m6
        else if (intervalSize <= 11) zoom = 2.0; // Major/Minor 6th/7th
        else zoom = 1.6;                         // Octave or larger

        // Proportional padding based on interval size
        // Small intervals get small padding, large intervals get large padding
        const basePadding = Math.ceil(intervalSize * 0.5) + 2;

        let minMidi, maxMidi;
        if (intervalState.direction === 'asc') {
            // Ascending: reference at bottom, target at top
            minMidi = refMidi - basePadding;
            maxMidi = tgtMidi + basePadding;
        } else {
            // Descending: reference at top, target at bottom
            minMidi = tgtMidi - basePadding;
            maxMidi = refMidi + basePadding;
        }

        console.log('🔍 Interval:', intervalSize, 'semi | Padding:', basePadding, '| Range:', intervalState.currentRef, '-', intervalState.currentTarget, '| MIDI:', minMidi, '-', maxMidi, '| Zoom:', zoom, '| Dir:', intervalState.direction);
        intervalState.visualizer.setNoteRange(minMidi, maxMidi);
        intervalState.visualizer.setZoom(zoom);
    }
}

function startIntervalSession() {
    closeIntervalConfig();
    const practiceModal = document.getElementById('intervalPracticeModal');
    if (practiceModal) practiceModal.style.display = 'flex';
    document.getElementById('intervalLevelBadge').textContent = INTERVAL_LEVELS[intervalState.level].name;
    nextInterval(); // This will generate problem AND init visualizer
}


function closeIntervalPractice() {
    document.getElementById('intervalPracticeModal').style.display = 'none';
    stopIntervalRecordingMetrics(false);
}

function nextInterval() {
    // Clear pitch diagram
    if (intervalState.visualizer && intervalState.visualizer.pitchHistory) {
        intervalState.visualizer.pitchHistory = [];
    }
    generateIntervalProblem();
    initIntervalVisualizer(); // Update visualizer range
    updateIntervalUI();
    playReference();
}

function nextIntervalOLD() {
    generateIntervalProblem();
    updateIntervalUI();
    playReference();
}

function retryInterval() {
    if (intervalState.visualizer && intervalState.visualizer.pitchHistory) {
        intervalState.visualizer.pitchHistory = [];
    }
    updateIntervalUI();
    playReference();
}

function generateIntervalProblem() {
    let minNote = 'C3';
    let maxNote = 'C5';
    try {
        const range = JSON.parse(localStorage.getItem('pitchWizRange'));
        if (range && range.min && range.max) {
            minNote = range.min; maxNote = range.max;
        }
    } catch (e) { }

    const rangeNotes = generateNoteList(minNote, maxNote);
    const pool = INTERVAL_LEVELS[intervalState.level].intervals;
    const intervalObj = pool[Math.floor(Math.random() * pool.length)];
    intervalState.currentIntervalName = intervalObj.name;
    const semitones = intervalObj.semi;

    let dir = intervalState.direction;
    if (dir === 'random') {
        dir = Math.random() > 0.5 ? 'asc' : 'desc';
        intervalState.direction = dir; // Update state with actual direction
    }

    let valid = false;
    let attempts = 0;
    while (!valid && attempts < 50) {
        attempts++;
        const refIndex = Math.floor(Math.random() * rangeNotes.length);
        const refNote = rangeNotes[refIndex];
        let targetIndex = dir === 'asc' ? refIndex + semitones : refIndex - semitones;

        if (targetIndex >= 0 && targetIndex < rangeNotes.length) {
            intervalState.currentRef = refNote;
            intervalState.currentTarget = rangeNotes[targetIndex];
            valid = true;
        }
    }
    if (!valid) {
        console.warn('Could not generate valid interval in range');
        intervalState.currentRef = rangeNotes[0];
        intervalState.currentTarget = rangeNotes[0];
    }
}

function updateIntervalUI() {
    document.getElementById('intervalNameDisplay').textContent = intervalState.currentIntervalName;

    // Add direction indicator
    const directionArrow = intervalState.direction === 'asc' ? '↗' : '↘';
    const directionText = intervalState.direction === 'asc' ? 'Ascending' : 'Descending';
    document.getElementById('intervalInstruction').textContent = `${directionArrow} Sing a ${intervalState.currentIntervalName} (${directionText})`;

    const refPuck = document.getElementById('refPuck');
    const targetPuck = document.getElementById('targetPuck');
    refPuck.querySelector('.note-val').textContent = intervalState.currentRef;

    targetPuck.querySelector('.note-val').textContent = '?';
    targetPuck.classList.remove('active-glow');
    targetPuck.style.boxShadow = 'none';
    targetPuck.style.borderColor = 'rgba(255,255,255,0.2)';

    const noteName = intervalState.currentRef.match(/[A-G]#?/)[0];
    const color = (window.NOTE_COLORS && window.NOTE_COLORS[noteName]) || '#999';
    refPuck.style.borderColor = color;
    refPuck.style.boxShadow = '0 0 10px ' + color + '40';

    intervalState.targetHitTimestamp = null;
    clearTimeout(intervalState.autoStopTimer);

    const btnRec = document.getElementById('btnRecordInterval');
    const btnSave = document.getElementById('btnSaveInterval');
    const btnRetry = document.getElementById('btnRetryInterval');

    if (btnRec) {
        btnRec.style.display = 'inline-flex';
        btnRec.textContent = ' Sing';
        btnRec.classList.remove('recording');
    }
    if (btnSave) btnSave.style.display = 'none';
    if (btnRetry) btnRetry.style.display = 'none';
    document.getElementById('intervalScoreDisplay').textContent = '--';
}

function checkIntervalPractice(pitchData) {
    if (!pitchData || !pitchData.note) return;

    if (intervalState.visualizer) {
        intervalState.visualizer.addPitchData(pitchData);
    }

    const sungNote = pitchData.note + pitchData.octave;
    console.log('Interval Practice: Detected', sungNote, '| Ref:', intervalState.currentRef, '| Tgt:', intervalState.currentTarget);

    // 1. Reference Check with COLOR GLOW
    if (sungNote === intervalState.currentRef) {
        console.log(' REF HIT! Applying color glow...');
        const refPuck = document.getElementById('refPuck');
        if (refPuck) {
            refPuck.classList.add('active-glow');
            const noteName = intervalState.currentRef.match(/[A-G]#?/)[0];
            const color = (window.NOTE_COLORS && window.NOTE_COLORS[noteName]) || '#4b7bec';
            console.log('Color for', noteName, ':', color);
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
        console.log(' TARGET HIT!');
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

function playReference() {
    if (intervalState.currentRef && window.toneGenerator) {
        window.toneGenerator.playNote(intervalState.currentRef, 3.0); // Longer duration for better listening
    }
}

function replayReference() {
    playReference();
}

async function toggleIntervalRecording() {
    const btn = document.getElementById('btnRecordInterval');
    if (!intervalState.isRecording) {
        let stream = null;
        if (window.pitchDetector && window.pitchDetector.stream && window.pitchDetector.stream.active) {
            stream = window.pitchDetector.stream;
        } else {
            if (typeof toggleListening === 'function') await toggleListening();
            if (window.pitchDetector && window.pitchDetector.stream && window.pitchDetector.stream.active) {
                stream = window.pitchDetector.stream;
            }
        }

        if (!stream || !stream.active) {
            alert('Microphone is not active.');
            return;
        }

        // Reset pitch diagram when starting to sing
        if (intervalState.visualizer) {
            intervalState.visualizer.pitchHistory = [];
        }

        intervalState.isRecording = true;
        btn.textContent = ' Stop';
        btn.classList.add('recording');

        if (typeof recordingManager !== 'undefined') {
            try {
                await recordingManager.startRecording(stream, 'interval-practice');
            } catch (err) {
                console.error(err);
                intervalState.isRecording = false;
                btn.textContent = ' Sing';
                btn.classList.remove('recording');
            }
        }
    } else {
        stopIntervalRecordingMetrics(true);
    }
}

function stopIntervalRecordingMetrics(save) {
    intervalState.isRecording = false;
    const btn = document.getElementById('btnRecordInterval');
    if (btn) {
        btn.textContent = ' Sing';
        btn.classList.remove('recording');
    }

    if (save && typeof recordingManager !== 'undefined') {
        recordingManager.stopRecording().then(blob => {
            const targetPuck = document.getElementById('targetPuck');
            targetPuck.querySelector('.note-val').textContent = intervalState.currentTarget;
            const noteNameTgt = intervalState.currentTarget.match(/[A-G]#?/)[0];
            const tgtColor = (window.NOTE_COLORS && window.NOTE_COLORS[noteNameTgt]) || '#999';
            targetPuck.style.borderColor = tgtColor;
            targetPuck.style.boxShadow = '0 0 15px ' + tgtColor;

            let feedback = 'Recording Stopped.';
            let details = '';
            let score = 0;

            if (recordingManager.tempData && recordingManager.tempData.metrics) {
                const metrics = recordingManager.tempData.metrics;
                const notes = metrics.notesPracticed || [];
                const hit = notes.includes(intervalState.currentTarget);

                const buffer = recordingManager.pitchDataBuffer || [];
                const targetSamples = buffer.filter(p => (p.note + p.octave) === intervalState.currentTarget);

                let avgCents = 0;
                if (targetSamples.length > 5) {
                    const totalCents = targetSamples.reduce((sum, p) => sum + Math.abs(p.cents || 0), 0);
                    avgCents = Math.round(totalCents / targetSamples.length);
                }

                const totalSamples = buffer.length;
                const refSamples = buffer.filter(p => (p.note + p.octave) === intervalState.currentRef).length;
                const transitionSamples = totalSamples - refSamples - targetSamples.length;
                const glidePercent = totalSamples > 10 ? Math.round((transitionSamples / totalSamples) * 100) : 0;

                if (hit) {
                    feedback = ' Excellent! Target Hit.';
                    score = Math.max(0, 100 - avgCents);
                    details = 'Tuning: ±' + avgCents + 'c | Glide: ' + glidePercent + '%';
                    document.getElementById('intervalScoreDisplay').textContent = score + '%';
                } else {
                    const sortedNotes = [...new Set(notes)];
                    feedback = ' You sang: ' + sortedNotes.slice(0, 3).join(', ') + '. Target: ' + intervalState.currentTarget;
                    score = 0;
                    details = 'Glide: ' + glidePercent + '%';
                    document.getElementById('intervalScoreDisplay').textContent = '0%';
                }
            }

            const infoEl = document.getElementById('intervalInstruction');
            infoEl.innerHTML = '<strong>' + feedback + '</strong><br><span style=\'font-size: 0.9em; opacity: 0.8;\'>' + details + '</span>';

            const btnRec = document.getElementById('btnRecordInterval');
            if (btnRec) btnRec.style.display = 'none';

            const btnSave = document.getElementById('btnSaveInterval');
            const btnRetry = document.getElementById('btnRetryInterval');

            if (btnSave) btnSave.style.display = 'inline-flex';
            if (btnRetry) btnRetry.style.display = 'inline-flex';

            intervalState.audioBlob = blob;
            console.log('Interval recorded. Blob size:', blob.size);
        });
    }
}

function triggerIntervalSave() {
    if (intervalState.audioBlob) {
        saveIntervalAttempt(intervalState.audioBlob);
    }
}

function saveIntervalAttempt(blob) {
    const metadata = {
        category: 'Interval Practice',
        interval: intervalState.currentIntervalName,
        reference: intervalState.currentRef,
        target: intervalState.currentTarget,
        level: intervalState.level
    };

    if (typeof dbManager !== 'undefined' && typeof recordingManager !== 'undefined') {
        if (recordingManager.tempData) {
            recordingManager.tempData.category = metadata.category;
            recordingManager.tempData.intervalData = metadata;
        }

        if (typeof openSaveModal === 'function') {
            openSaveModal();
        } else {
            console.error('openSaveModal not found');
        }
    }
}

// HELPER: Convert note name to MIDI number for visualizer range
function noteToMidi(noteName) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const match = noteName.match(/^([A-G]#?)(\d+)$/);
    if (!match) return 60; // Default to C4
    const note = match[1];
    const octave = parseInt(match[2]);
    const noteIndex = notes.indexOf(note);
    return (octave + 1) * 12 + noteIndex;
}

// HELPER: Generate chromatic note list between two notes
function generateNoteList(minNote, maxNote) {
    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const minMidi = noteToMidi(minNote);
    const maxMidi = noteToMidi(maxNote);
    const result = [];
    for (let midi = minMidi; midi <= maxMidi; midi++) {
        const octave = Math.floor(midi / 12) - 1;
        const noteIndex = midi % 12;
        result.push(notes[noteIndex] + octave);
    }
    return result;
}



// ZOOM CONTROLS
function adjustIntervalZoom(delta) {
    if (!intervalState.visualizer) return;
    const currentZoom = intervalState.visualizer.zoomLevel || 1.0;
    const newZoom = Math.max(0.5, Math.min(3.0, currentZoom + delta));
    intervalState.visualizer.setZoom(newZoom);
    console.log('Interval Zoom adjusted to:', newZoom);
}

setTimeout(() => {
    // Update mouse handler to include horizontal zoom
    const canvas = document.getElementById('intervalCanvas');
    if (canvas) {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let startVZoom = 1.0;
        let startHZoom = 1.0;

        // Mouse Events
        canvas.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            if (intervalState.visualizer) {
                startVZoom = intervalState.visualizer.zoomLevel || 1.0;
                startHZoom = intervalState.visualizer.horizontalZoom || 1.0;
            }
            canvas.style.cursor = 'grabbing';
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging || !intervalState.visualizer) return;

            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;

            // Horizontal = H-Zoom
            const hZoomDelta = deltaX * 0.003;
            const newHZoom = Math.max(0.5, Math.min(3.0, startHZoom + hZoomDelta));
            intervalState.visualizer.horizontalZoom = newHZoom;

            // Vertical = V-Zoom
            const vZoomDelta = -deltaY * 0.005;
            const newVZoom = Math.max(0.5, Math.min(3.0, startVZoom + vZoomDelta));
            intervalState.visualizer.setZoom(newVZoom);
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
        let lastTouchX = 0;
        let lastTouchY = 0;

        function getPinchDistance(touch1, touch2) {
            const dx = touch2.clientX - touch1.clientX;
            const dy = touch2.clientY - touch1.clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                // Single finger - prepare for pan
                e.preventDefault();
                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;
            } else if (e.touches.length === 2) {
                // Two fingers - pinch zoom
                e.preventDefault();
                initialPinchDistance = getPinchDistance(e.touches[0], e.touches[1]);
                initialPinchZoom = intervalState.visualizer?.zoomLevel || 1.0;
            }
        }, { passive: false });

        canvas.addEventListener('touchmove', (e) => {
            if (!intervalState.visualizer) return;
            e.preventDefault();

            if (e.touches.length === 2) {
                // Two-finger pinch zoom
                const currentDistance = getPinchDistance(e.touches[0], e.touches[1]);
                const scale = currentDistance / initialPinchDistance;
                const newZoom = Math.max(0.5, Math.min(3.0, initialPinchZoom * scale));

                intervalState.visualizer.setZoom(newZoom);
            } else if (e.touches.length === 1) {
                // Single-finger drag - horizontal for h-zoom, vertical for pan
                const deltaX = e.touches[0].clientX - lastTouchX;
                const deltaY = e.touches[0].clientY - lastTouchY;

                lastTouchX = e.touches[0].clientX;
                lastTouchY = e.touches[0].clientY;

                // Horizontal drag = horizontal zoom
                const currentHZoom = intervalState.visualizer.horizontalZoom || 1.0;
                const hZoomChange = deltaX * 0.003;
                const newHZoom = Math.max(0.1, Math.min(5.0, currentHZoom + hZoomChange));
                intervalState.visualizer.horizontalZoom = newHZoom;

                // Vertical drag = vertical pan
                const currentPan = intervalState.visualizer.verticalPan || 0;
                const panChange = deltaY * 0.05;
                intervalState.visualizer.verticalPan = currentPan + panChange;
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

        canvas.style.cursor = 'grab';
        console.log('✅ Enhanced drag controls: Mouse + Touch supported');
    }
}, 100);



// Ensure NOTE_COLORS is globally available for interval practice
if (typeof window.NOTE_COLORS === 'undefined') {
    window.NOTE_COLORS = {
        'C': '#ff5252', 'C#': '#ff793f', 'D': '#ffa502',
        'D#': '#f9ca24', 'E': '#6ab04c', 'F': '#badc58',
        'F#': '#2bcbba', 'G': '#4b7bec', 'G#': '#a55eea',
        'A': '#45aaf2', 'A#': '#f368e0', 'B': '#fd79a8'
    };
}













function playTargetTone() {
    if (intervalState.currentTarget && window.toneGenerator) {
        window.toneGenerator.playNote(intervalState.currentTarget, 3.0);
        console.log(' Playing target tone:', intervalState.currentTarget);
    }
}
