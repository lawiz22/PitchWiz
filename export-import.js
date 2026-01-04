// Export/Import Logic

// DOM Elements
const exportImportModal = document.getElementById('exportImportModal');
const exportImportTitle = document.getElementById('exportImportTitle');
const exportImportStatus = document.getElementById('exportImportStatus');
const exportImportProgress = document.getElementById('exportImportProgress');
const btnCloseExportImport = document.getElementById('btnCloseExportImport');
const importFileInput = document.getElementById('importFileInput');
const btnExportLibrary = document.getElementById('btnExportLibrary');
const btnImportLibrary = document.getElementById('btnImportLibrary');

// Initialize Event Listeners
document.addEventListener('DOMContentLoaded', () => {
    if (btnExportLibrary) btnExportLibrary.addEventListener('click', exportLibrary);
    if (btnImportLibrary) btnImportLibrary.addEventListener('click', () => importFileInput.click());
    if (importFileInput) importFileInput.addEventListener('change', handleFileSelect);
});

// Update Progress UI
function updateProgress(percent, message) {
    if (exportImportModal.style.display !== 'flex') {
        exportImportModal.style.display = 'flex';
        btnCloseExportImport.style.display = 'none';
    }
    exportImportProgress.style.width = `${percent}%`;
    if (message) exportImportStatus.textContent = message;
}

// Show Completion
function showComplete(title, message, isSuccess = true) {
    exportImportTitle.textContent = title;
    exportImportStatus.textContent = message;
    exportImportProgress.style.width = '100%';
    exportImportProgress.style.backgroundColor = isSuccess ? '#10B981' : '#EF4444';
    btnCloseExportImport.style.display = 'block';
}

// Check for JSZip
function checkJSZip() {
    if (typeof JSZip === 'undefined') {
        alert('JSZip library not loaded. Please check your internet connection and reload.');
        return false;
    }
    return true;
}

// --- EXPORT FUNCTIONALITY ---

async function exportLibrary() {
    if (!checkJSZip()) return;

    try {
        updateProgress(0, 'Preparing library export...');

        // 1. Get all data from IndexedDB
        updateProgress(10, 'Fetching recordings from database...');
        const recordings = await dbManager.getAllRecordings();

        updateProgress(20, 'Fetching profiles...');
        const profiles = await dbManager.getAllProfiles();

        // 2. Get scores from localStorage
        updateProgress(30, 'Exporting local settings...');
        const scores = {};
        for (let key in localStorage) {
            if (key.startsWith('pitchWiz_scores_')) {
                scores[key] = localStorage.getItem(key);
            }
        }

        // 3. Create manifest
        const manifest = {
            exportDate: new Date().toISOString(),
            version: '1.0',
            singer: localStorage.getItem('pitchWizSinger'),
            recordingCount: recordings.length
        };

        // 4. Create ZIP
        const zip = new JSZip();
        zip.file('manifest.json', JSON.stringify(manifest, null, 2));
        zip.file('library.json', JSON.stringify({ recordings, profiles, scores }, null, 2));

        // 5. Add audio files
        const recordingsFolder = zip.folder('recordings');
        let processed = 0;

        if (recordings.length > 0) {
            for (let i = 0; i < recordings.length; i++) {
                const recording = recordings[i];
                updateProgress(30 + Math.round((i / recordings.length) * 40), `Compressing audio: ${recording.name}...`);

                try {
                    const blob = await dbManager.getRecordingBlob(recording.id);
                    if (blob) {
                        recordingsFolder.file(`${recording.id}.wav`, blob);
                    }
                } catch (e) {
                    console.warn(`Failed to export audio for ${recording.name}`, e);
                }
                processed++;
            }
        }

        // 6. Generate and download ZIP
        updateProgress(80, 'Finalizing ZIP file...');
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        }, (metadata) => {
            updateProgress(80 + (metadata.percent * 0.2), `Generating ZIP: ${metadata.percent.toFixed(0)}%`);
        });

        // Trigger download
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        a.download = `pitchwiz-library-${dateStr}.zip`;
        a.click();

        setTimeout(() => URL.revokeObjectURL(url), 1000); // Cleanup

        showComplete('Export Complete! 📦', `Successfully exported ${processed} recordings.`);

    } catch (error) {
        console.error('Export failed:', error);
        showComplete('Export Failed', `Error: ${error.message}`, false);
    }
}

// --- IMPORT FUNCTIONALITY ---

async function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset input so same file can be selected again
    event.target.value = '';

    await importLibrary(file);
}

async function importLibrary(file) {
    if (!checkJSZip()) return;

    try {
        updateProgress(0, 'Reading ZIP file...');

        // 1. Read ZIP file
        const zip = await JSZip.loadAsync(file);

        // 2. Read manifest
        if (!zip.file('manifest.json')) {
            throw new Error('Invalid backup file. manifest.json missing.');
        }
        const manifestText = await zip.file('manifest.json').async('text');
        const manifest = JSON.parse(manifestText);

        // 3. Read library data
        if (!zip.file('library.json')) {
            throw new Error('Invalid backup file. library.json missing.');
        }
        updateProgress(20, 'Parsing library data...');
        const libraryText = await zip.file('library.json').async('text');
        const { recordings, profiles, scores } = JSON.parse(libraryText);

        // 4. Get existing recordings for duplicate detection
        updateProgress(30, 'Checking for duplicates...');
        const existingRecordings = await dbManager.getAllRecordings();
        const existingIds = new Set(existingRecordings.map(r => r.id));

        let imported = 0;
        let skipped = 0;
        let errors = 0;

        // 5. Import recordings (skip duplicates)
        const totalOps = recordings.length + (profiles ? profiles.length : 0);
        let currentOp = 0;

        if (recordings && recordings.length > 0) {
            for (let recording of recordings) {
                currentOp++;
                const progress = 30 + Math.round((currentOp / totalOps) * 50);

                if (existingIds.has(recording.id)) {
                    skipped++;
                    updateProgress(progress, `Skipping duplicate: ${recording.name}`);
                    continue;
                }

                updateProgress(progress, `Importing: ${recording.name}`);

                try {
                    // Get audio blob
                    const audioFile = zip.file(`recordings/${recording.id}.wav`);
                    if (audioFile) {
                        const audioBlob = await audioFile.async('blob');

                        // Import to database
                        await dbManager.saveRecording({
                            ...recording,
                            audioBlob: audioBlob
                        }); // Removed 'true' as saveRecording doesn't accept a second arg

                        imported++;
                    } else {
                        console.warn(`Audio file missing for ${recording.name}`);
                        errors++;
                    }
                } catch (e) {
                    console.error(`Failed to import ${recording.name}`, e);
                    errors++;
                }
            }
        }

        // 6. Import profiles (merge)
        updateProgress(85, 'Importing profiles...');
        if (profiles && profiles.length > 0) {
            for (let profile of profiles) {
                try {
                    const existing = await dbManager.getSingerProfile(profile.singer);
                    if (!existing) {
                        await dbManager.saveSingerProfile(profile.singer, profile.min, profile.max);
                    }
                } catch (e) {
                    console.warn('Profile import error', e);
                }
            }
        }

        // 7. Import scores (merge)
        updateProgress(90, 'Importing progress...');
        if (scores) {
            for (let key in scores) {
                if (!localStorage.getItem(key)) {
                    localStorage.setItem(key, scores[key]);
                } else {
                    // Intelligent merge for scores?
                    // For now, simpler is better: Keep existing if present.
                    // User requested "import only the one who are not already there"
                }
            }
        }

        // Refresh UI
        updateProgress(95, 'Refreshing library...');
        if (typeof loadRecordings === 'function') {
            await loadRecordings();
        }

        showComplete('Import Complete! 📥', `Added: ${imported} | Skipped: ${skipped} | Errors: ${errors}`);

    } catch (error) {
        console.error('Import failed:', error);
        showComplete('Import Failed', `Error: ${error.message}`, false);
    }
}
