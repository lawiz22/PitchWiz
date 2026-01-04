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

    // Update the singer name input if it exists (for consistency)
    const singerInput = document.getElementById('singerName');
    if (singerInput && !singerInput.value) {
        singerInput.value = currentSinger;
    }

    // Check if singer has a calibrated range
    try {
        const profile = await dbManager.getSingerProfile(currentSinger);

        if (profile) {
            // Range exists - show dashboard
            displayRangeSummary(profile);
        } else {
            // No range - start calibration workflow
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

    // Update exercise progress
    document.getElementById('intuneTotal').textContent = profile.range.length;
    document.getElementById('intuneCompleted').textContent = 0;
    document.getElementById('intuneProgress').style.width = '0%';
}

function openRangeCalibration() {
    const modal = document.getElementById('rangeCalibrationModal');
    if (!modal) return;

    modal.style.display = 'flex';

    // Reset state
    if (typeof calibrationState !== 'undefined') {
        calibrationState = { lowest: null, highest: null };
    }

    document.getElementById('detectedLowest').textContent = '--';
    document.getElementById('detectedHighest').textContent = '--';
    document.getElementById('btnRecordHighest').disabled = true;
    document.getElementById('rangeResult').style.display = 'none';
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
