// Practice Mode Integration Script
// Add this to the end of app.js or include as separate script

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
    console.log('Integrating Practice Mode...');

    // Find all nav tabs
    const navTabs = document.querySelectorAll('.nav-tab');

    navTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            const mode = this.getAttribute('data-mode');

            console.log('Tab clicked:', mode);

            // Hide all views
            document.getElementById('libraryView')?.style && (document.getElementById('libraryView').style.display = 'none');
            document.getElementById('progressView')?.style && (document.getElementById('progressView').style.display = 'none');
            document.getElementById('practiceView')?.style && (document.getElementById('practiceView').style.display = 'none');
            document.getElementById('visualizationContainer')?.style && (document.getElementById('visualizationContainer').style.display = 'block');
            document.getElementById('noteDisplay')?.style && (document.getElementById('noteDisplay').style.display = 'flex');

            // Remove active class from all tabs
            navTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');

            // Show appropriate view
            if (mode === 'library') {
                document.getElementById('libraryView').style.display = 'block';
                document.getElementById('visualizationContainer').style.display = 'none';
                document.getElementById('noteDisplay').style.display = 'none';
                loadRecordings();
            } else if (mode === 'progress') {
                document.getElementById('progressView').style.display = 'block';
                document.getElementById('visualizationContainer').style.display = 'none';
                document.getElementById('noteDisplay').style.display = 'none';
                if (typeof updateProgressUI === 'function') {
                    updateProgressUI();
                }
            } else if (mode === 'practice') {
                document.getElementById('practiceView').style.display = 'block';
                document.getElementById('visualizationContainer').style.display = 'none';
                document.getElementById('noteDisplay').style.display = 'none';
                if (typeof openPracticeView === 'function') {
                    openPracticeView();
                }
            } else {
                // Default / Pitch Diagram View
                // Ensure audio is resumed if it was suspended
                if (typeof window.pitchDetector !== 'undefined' && window.pitchDetector && window.pitchDetector.audioContext) {
                    if (window.pitchDetector.audioContext.state === 'suspended') {
                        console.log('Returning to Pitch Diagram: Resuming suspended AudioContext');
                        window.pitchDetector.audioContext.resume();
                    }
                }
            }
        });
    });

    // Initialize tone generator
    if (typeof ToneGenerator !== 'undefined') {
        window.toneGenerator = new ToneGenerator();
        console.log('✅ Tone Generator initialized');
    }
});
