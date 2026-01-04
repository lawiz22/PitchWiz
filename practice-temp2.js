    if (!isListening) {
        await handleStartClick();
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
                // Show current detection
                display.textContent = data.note;
            }
        }

        // Check if time is up
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

    // Find most common note
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

    // Show result
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

    if (!lowest || !highest || !currentSinger) {
        alert('Missing information. Please complete calibration.');
        return;
    }

    try {
        await dbManager.saveSingerProfile(currentSinger, lowest, highest);
        console.log('Vocal range saved successfully!');

        closeRangeCalibration();

        // Reload practice view
        const profile = await dbManager.getSingerProfile(currentSinger);
        displayRangeSummary(profile);

        alert(`✅ Vocal range saved!\n\n${lowest} to ${highest}\n\nYou can now start practicing!`);
    } catch (error) {
        console.error('Error saving vocal range:', error);
        alert('Failed to save vocal range. Please try again.');
    }
}

function startIntuneExercise() {
    alert('🎯 Intune Exercise\n\nThis will:\n1. Let you select a note from your range\n2. Play reference tone (5s)\n3. Record you singing (5s)\n4. Show accuracy stats\n\nFull implementation coming soon!');
}

// Add button to change singer name
function changeSingerName() {
    const newName = prompt('Enter your name:', localStorage.getItem('pitchWizSinger') || '');

    if (newName && newName.trim() !== '') {
        localStorage.setItem('pitchWizSinger', newName.trim());
        currentSinger = newName.trim();

        // Update input if exists
        const singerInput = document.getElementById('singerName');
        if (singerInput) {
            singerInput.value = currentSinger;
        }

        alert(`✅ Singer name updated to: ${currentSinger}\n\nRefresh Practice mode to see changes.`);
    }
}
