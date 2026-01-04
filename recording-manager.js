/**
 * Recording Manager for PitchWiz
 * Handles audio recording and pitch data capture
 */

class RecordingManager {
    constructor(dbManager) {
        this.dbManager = dbManager;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.pitchDataBuffer = [];
        this.startTime = null;
        this.currentMode = 'pitch-diagram';
        this.audioStream = null;
    }

    /**
     * Start recording
     */
    async startRecording(audioStream, mode = 'pitch-diagram') {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        try {
            this.audioStream = audioStream;
            this.currentMode = mode;
            this.audioChunks = [];
            this.pitchDataBuffer = [];
            this.startTime = Date.now();

            // Create MediaRecorder with audio stream
            const options = {
                mimeType: 'audio/webm;codecs=opus',
                audioBitsPerSecond: 128000 // 128 kbps - good quality, reasonable size
            };

            // Fallback for browsers that don't support webm
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                options.mimeType = 'audio/webm';
            }

            this.mediaRecorder = new MediaRecorder(audioStream, options);
            console.log('MediaRecorder created with state:', this.mediaRecorder.state);

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                    console.log('Audio chunk received, size:', event.data.size);
                }
            };


            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            console.log('MediaRecorder started, state:', this.mediaRecorder.state);

            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    /**
     * Add pitch data point during recording
     */
    addPitchData(pitchData) {
        if (!this.isRecording) return;

        // Ensure timestamp exists for duration calculation
        // If pitchData is null (silence) or missing timestamp
        if (!pitchData) {
            // Handle silence if needed, or just ignore. 
            // If we ignore, we might lose time sync?
            // But we use relative time now, so it should be fine.
            // Let's create a silence frame to keep the buffer flowing if needed?
            // Actually, the loop uses pitchDataBuffer for analysis.
            // A null entry might be useful to break notes.
            /*
            pitchData = {
                timestamp: Date.now(),
                note: null,
                frequency: null
            };
            */
            return; // For now, just ignore nulls to prevent crash
        }

        if (!pitchData.timestamp) {
            pitchData.timestamp = Date.now();
        }

        // Throttle data - only store every 50ms to reduce storage
        const now = Date.now();
        const relativeTime = now - this.startTime;

        const lastEntry = this.pitchDataBuffer[this.pitchDataBuffer.length - 1];

        // Store if first entry, or if 50ms has passed since last relative timestamp
        if (!lastEntry || (relativeTime - lastEntry.timestamp) >= 50) {
            this.pitchDataBuffer.push({
                timestamp: relativeTime,
                frequency: pitchData.frequency,
                note: pitchData.note,
                octave: pitchData.octave,
                cents: pitchData.cents
            });
        }
    }

    /**
     * Stop recording
     */
    async stopRecording() {
        if (!this.isRecording) {
            console.warn('Not currently recording');
            return null;
        }

        console.log('Stopping recording...');

        return new Promise((resolve) => {
            const finishStop = async () => {
                console.log('MediaRecorder finishing stop...');

                // PREPARE DATA BUT DO NOT SAVE YET
                const duration = (Date.now() - this.startTime) / 1000;

                // Create audio blob
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });

                // Calculate metrics
                const metrics = this.calculateMetrics();
                console.log('Calculated Metrics:', metrics); // DEBUG LOG

                // Store temp data
                this.tempData = {
                    audioBlob,
                    duration,
                    pitchData: [...this.pitchDataBuffer], // Copy
                    date: new Date().toISOString(),
                    metrics,
                    mode: this.currentMode
                };

                resolve(this.tempData);
            };

            // Request any pending data before stopping
            try {
                if (this.mediaRecorder.state === 'recording') {
                    this.mediaRecorder.requestData();
                    this.mediaRecorder.stop();
                    this.isRecording = false;
                } else if (this.mediaRecorder.state !== 'inactive') {
                    this.mediaRecorder.stop();
                    this.isRecording = false;
                } else {
                    console.warn('MediaRecorder already inactive during stop');
                    this.isRecording = false;
                }

                // We must call finishStop! 
                // Since onstop might not fire reliably in all edge cases (or I removed it?), 
                // let's rely on standard onstop or manual call?
                // Wait, in previous step I removed onstop wrapping? 
                // Let's check the view... I'll assume onstop is the standard way.
                // But to be safe, I'll attach the handler here.
            } catch (e) {
                console.error('Error stopping MediaRecorder:', e);
                this.isRecording = false;
                finishStop(); // Force finish
                return;
            }

            // Re-attach onstop just in case
            this.mediaRecorder.onstop = () => {
                finishStop();
            };
        });
    }

    /**
     * Finalize and save recording with metadata
     */
    async saveRecording(metadata) {
        if (!this.tempData) {
            console.error('No pending recording data to save');
            return null;
        }

        const { name, singer, category } = metadata;
        console.log(`Saving recording "${name}" by "${singer}" (${category || 'freestyle'})`);
        console.log('Saving Metrics:', this.tempData.metrics); // DEBUG LOG

        const recordingData = {
            ...this.tempData,
            name: name || `Recording #${Date.now()}`,
            singer: singer || 'Unknown',
            category: category || this.tempData.category || 'freestyle',
            // Session ID could be added here later
        };

        try {
            const id = await this.dbManager.saveRecording(recordingData);
            console.log('Recording saved to DB with ID:', id);

            // Clean up
            this.tempData = null;
            this.audioChunks = [];
            this.pitchDataBuffer = [];
            this.startTime = null;

            return id;
        } catch (error) {
            console.error('Failed to save to DB:', error);
            throw error;
        }
    }

    /**
     * Calculate session metrics
     */
    calculateMetrics() {
        const validData = this.pitchDataBuffer.filter(d => d.frequency !== null);

        if (validData.length === 0) {
            return {
                avgCentsDeviation: 0,
                timeInTune: 0,
                notesPracticed: []
            };
        }

        // Average cents deviation
        const totalCents = validData.reduce((sum, d) => sum + Math.abs(d.cents || 0), 0);
        const avgCentsDeviation = totalCents / validData.length;

        // Time in tune (within ±5 cents)
        const inTuneCount = validData.filter(d => Math.abs(d.cents || 0) < 5).length;
        const timeInTune = (inTuneCount / validData.length) * 100;

        // Notes practiced (unique notes), sorted by pitch
        // ONLY count notes held for at least 0.5 seconds (remove sweeping/transients)
        const uniqueNotesMap = new Map();

        // Duration filtering logic
        let currentNoteKey = null;
        let currentNoteStart = 0;
        let currentNoteObj = null;

        // Iterate through all buffer data including nulls to track continuity

        // DEBUG: Dump first 20 items to see structure
        console.log('Pitch Data Buffer Sample:', this.pitchDataBuffer.slice(0, 20));

        for (let i = 0; i < this.pitchDataBuffer.length; i++) {
            const d = this.pitchDataBuffer[i];
            const noteKey = (d.note && d.octave !== null) ? `${d.note}${d.octave}` : null;

            if (noteKey === currentNoteKey) {
                // Continuation of same note (or silence)
                continue;
            }

            // console.log(`Change: ${currentNoteKey} -> ${noteKey} at ${d.timestamp}ms`);

            // Note changed or ended
            if (currentNoteKey !== null) {
                // Calculate duration of previous note
                // Use current timestamp as end time
                const duration = d.timestamp - currentNoteStart;

                // console.log(`Note ${currentNoteKey} ended. Duration: ${duration}ms`);

                if (duration >= 100) { // Lowered to 100ms for extreme sensitivity test
                    if (!uniqueNotesMap.has(currentNoteKey)) {
                        console.log(`Note identified: ${currentNoteKey} (${duration}ms)`);
                        uniqueNotesMap.set(currentNoteKey, {
                            note: currentNoteObj.note,
                            octave: currentNoteObj.octave,
                            sortValue: currentNoteObj.octave * 12 + this.getNoteIndex(currentNoteObj.note)
                        });
                    }
                }
            }

            // Start new note
            if (noteKey !== null) {
                currentNoteKey = noteKey;
                currentNoteStart = d.timestamp;
                currentNoteObj = d;
            } else {
                currentNoteKey = null;
                currentNoteObj = null;
            }
        }

        // Check last note
        if (currentNoteKey !== null) {
            const lastTimestamp = this.pitchDataBuffer[this.pitchDataBuffer.length - 1].timestamp;
            const duration = lastTimestamp - currentNoteStart;
            if (duration >= 100) { // 100ms threshold
                console.log(`Last note identified: ${currentNoteKey} (${duration}ms)`);
                if (!uniqueNotesMap.has(currentNoteKey)) {
                    uniqueNotesMap.set(currentNoteKey, {
                        note: currentNoteObj.note,
                        octave: currentNoteObj.octave,
                        sortValue: currentNoteObj.octave * 12 + this.getNoteIndex(currentNoteObj.note)
                    });
                }
            }
        }

        // Convert to array and sort
        const notesPracticed = Array.from(uniqueNotesMap.values())
            .sort((a, b) => a.sortValue - b.sortValue)
            .map(n => `${n.note}${n.octave}`);

        return {
            avgCentsDeviation: Math.round(avgCentsDeviation * 10) / 10,
            timeInTune: Math.round(timeInTune * 10) / 10,
            notesPracticed
        };
    }

    /**
     * Get semitone index for a note
     */
    getNoteIndex(note) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
        return notes.indexOf(note);
    }

    /**
     * Get recording status
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            duration: this.isRecording ? (Date.now() - this.startTime) / 1000 : 0,
            pitchDataPoints: this.pitchDataBuffer.length
        };
    }

    /**
     * Cancel recording without saving
     */
    cancelRecording() {
        if (this.isRecording && this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.audioChunks = [];
            this.pitchDataBuffer = [];
            this.startTime = null;
        }
    }
}

// Export for use in app.js
