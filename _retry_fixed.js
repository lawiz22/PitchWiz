function retryInterval() {
    if (intervalState.visualizer && intervalState.visualizer.pitchHistory) {
        intervalState.visualizer.pitchHistory = [];
    }
    updateIntervalUI();
    playReference();
}
