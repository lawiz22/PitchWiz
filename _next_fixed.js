function nextInterval() {
    if (intervalState.visualizer && intervalState.visualizer.pitchHistory) {
        intervalState.visualizer.pitchHistory = [];
    }
    generateIntervalProblem();
    initIntervalVisualizer();
    updateIntervalUI();
    playReference();
}
