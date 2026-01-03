/**
 * Progress Tracker Module
 * analyzing session metrics and accuracy
 */

class ProgressTracker {
    constructor(dbManager) {
        this.dbManager = dbManager;
    }

    /**
     * Analyze a recording session to calculate accuracy metrics
     * @param {Array} pitchData - Array of {timestamp, note, cents, frequency}
     * @param {String} targetNote - Optional target note if in training mode
     */
    analyzeSession(pitchData, targetNote = null) {
        if (!pitchData || pitchData.length === 0) return null;

        let totalSamples = pitchData.length;
        let inTuneSamples = 0;
        let totalDeviation = 0;
        let notestability = 0; // Simple variance check needed

        // Tuning threshold from window global or default to 10 cents
        const threshold = window.tuningThreshold || 10;

        pitchData.forEach(point => {
            if (!point) return;

            // Calculate deviation
            const deviation = Math.abs(point.cents);
            totalDeviation += deviation;

            // Check if in tune
            if (deviation <= threshold) {
                inTuneSamples++;
            }
        });

        const accuracy = (inTuneSamples / totalSamples) * 100;
        const avgDeviation = totalDeviation / totalSamples;

        return {
            accuracy: parseFloat(accuracy.toFixed(1)),
            avgDeviation: parseFloat(avgDeviation.toFixed(1)),
            totalSamples,
            inTuneSamples,
            duration: (pitchData[pitchData.length - 1].timestamp - pitchData[0].timestamp) / 1000
        };
    }

    /**
     * Get aggregated stats for a user (singer)
     */
    async getSingerStats(singerName) {
        if (!singerName) return null;
        // This will require a DB query we haven't written yet, 
        // but acts as placeholder for Phase 3
        return {
            name: singerName,
            sessions: 0,
            avgAccuracy: 0
        };
    }
}
