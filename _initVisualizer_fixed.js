function initIntervalVisualizer() {
    const canvas = document.getElementById('intervalCanvas');
    
    if (!intervalState.visualizer && canvas && typeof Visualizer !== 'undefined') {
        // Create visualizer on first call
        intervalState.visualizer = new Visualizer(canvas);
        intervalState.visualizer.start();
    }
    
    // Always update range and zoom for current interval
    if (intervalState.visualizer) {
        const refMidi = noteToMidi(intervalState.currentRef);
        const tgtMidi = noteToMidi(intervalState.currentTarget);
        const minMidi = Math.min(refMidi, tgtMidi) - 2;
        const maxMidi = Math.max(refMidi, tgtMidi) + 2;
        intervalState.visualizer.setNoteRange(minMidi, maxMidi);
        intervalState.visualizer.setZoom(7.0); // Very tight zoom on interval
    }
}
