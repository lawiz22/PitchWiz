/**
 * PitchDetector - Real-time pitch detection using autocorrelation
 */
class PitchDetector {
    constructor(options = {}) {
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.scriptProcessor = null;

        // Configuration
        this.bufferSize = options.bufferSize || 4096;
        this.sampleRate = options.sampleRate || 44100;
        this.a4Frequency = options.a4Frequency || 440;
        this.smoothingFactor = options.smoothingFactor || 0.7;

        // State
        this.isListening = false;
        this.lastPitch = null;
        this.lastNote = null;

        // Callbacks
        this.onPitchDetected = options.onPitchDetected || (() => { });
        this.onError = options.onError || console.error;
    }

    /**
     * Start listening to microphone input
     */
    async start() {
        try {
            // Request microphone access
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: false,
                    autoGainControl: false,
                    noiseSuppression: false,
                    latency: 0
                }
            });

            // Create audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: this.sampleRate
            });

            // Create analyser node
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 8192; // Larger FFT for better low-frequency resolution
            this.analyser.smoothingTimeConstant = 0;

            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(stream);

            // Create script processor for real-time analysis
            this.scriptProcessor = this.audioContext.createScriptProcessor(this.bufferSize, 1, 1);

            // Connect nodes
            this.microphone.connect(this.analyser);
            this.analyser.connect(this.scriptProcessor);
            this.scriptProcessor.connect(this.audioContext.destination);

            // Process audio
            this.scriptProcessor.onaudioprocess = (event) => {
                this.processAudio(event.inputBuffer.getChannelData(0));
            };

            this.isListening = true;
            return true;

        } catch (error) {
            this.onError('Microphone access denied or not available: ' + error.message);
            return false;
        }
    }

    /**
     * Stop listening
     */
    stop() {
        if (this.scriptProcessor) {
            this.scriptProcessor.disconnect();
            this.scriptProcessor = null;
        }

        if (this.analyser) {
            this.analyser.disconnect();
            this.analyser = null;
        }

        if (this.microphone) {
            this.microphone.disconnect();
            this.microphone.mediaStream.getTracks().forEach(track => track.stop());
            this.microphone = null;
        }

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isListening = false;
    }

    /**
     * Process audio buffer and detect pitch
     */
    processAudio(buffer) {
        // Calculate RMS to detect silence
        const rms = this.calculateRMS(buffer);
        if (rms < 0.01) {
            this.onPitchDetected(null);
            return;
        }

        // Detect pitch using autocorrelation
        const frequency = this.autoCorrelate(buffer, this.sampleRate);

        if (frequency > 0) {
            // Apply smoothing
            if (this.lastPitch) {
                const smoothed = this.lastPitch * this.smoothingFactor +
                    frequency * (1 - this.smoothingFactor);
                this.lastPitch = smoothed;
            } else {
                this.lastPitch = frequency;
            }

            // Get note information
            const noteInfo = this.frequencyToNote(this.lastPitch);

            this.onPitchDetected({
                frequency: this.lastPitch,
                note: noteInfo.note,
                octave: noteInfo.octave,
                cents: noteInfo.cents,
                confidence: 1.0
            });
        } else {
            this.onPitchDetected(null);
        }
    }

    /**
     * Calculate RMS (Root Mean Square) for volume detection
     */
    calculateRMS(buffer) {
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i] * buffer[i];
        }
        return Math.sqrt(sum / buffer.length);
    }

    /**
     * Autocorrelation algorithm for pitch detection
     * Optimized for bass voices - prefers fundamental over harmonics
     * Uses low-frequency bias for A1-C2 range
     */
    autoCorrelate(buffer, sampleRate) {
        // Extended range for very low bass voices - down to A0 (~27.5Hz)
        const minFrequency = 40;   // E1 - for very low bass voices
        const maxFrequency = 1200; // ~D6

        const minPeriod = Math.floor(sampleRate / maxFrequency);
        const maxPeriod = Math.floor(sampleRate / minFrequency);

        const size = buffer.length;
        const correlations = new Array(maxPeriod + 1).fill(0);

        // Calculate autocorrelation
        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            let sum = 0;
            for (let i = 0; i < size - lag; i++) {
                sum += buffer[i] * buffer[i + lag];
            }
            correlations[lag] = sum;
        }

        // Find the lag with maximum correlation
        let maxCorrelation = -1;
        let maxLag = -1;

        for (let lag = minPeriod; lag <= maxPeriod; lag++) {
            if (correlations[lag] > maxCorrelation) {
                maxCorrelation = correlations[lag];
                maxLag = lag;
            }
        }

        // Parabolic interpolation for better accuracy
        if (maxLag > 0 && maxLag < maxPeriod - 1) {
            const y1 = correlations[maxLag - 1];
            const y2 = correlations[maxLag];
            const y3 = correlations[maxLag + 1];

            if (y2 > 0) {
                const delta = (y3 - y1) / (2 * (2 * y2 - y1 - y3));
                const interpolatedLag = maxLag + delta;

                return sampleRate / interpolatedLag;
            }
        }

        return maxLag > 0 ? sampleRate / maxLag : -1;
    }

    /**
     * Convert frequency to musical note
     */
    frequencyToNote(frequency) {
        const noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

        // Calculate semitones from A4
        const semitonesFromA4 = 12 * Math.log2(frequency / this.a4Frequency);
        const nearestSemitone = Math.round(semitonesFromA4);

        // Calculate cents (deviation from nearest note)
        const cents = Math.round((semitonesFromA4 - nearestSemitone) * 100);

        // Calculate note and octave
        const noteIndex = (nearestSemitone + 9 + 120) % 12; // +9 because A is index 9
        const octave = Math.floor((nearestSemitone + 9 + 120) / 12) - 6; // -6 to center on A4

        return {
            note: noteNames[noteIndex],
            octave: octave,
            cents: cents,
            frequency: frequency
        };
    }

    /**
     * Update A4 reference frequency
     */
    setA4Frequency(frequency) {
        this.a4Frequency = frequency;
    }

    /**
     * Update smoothing factor
     */
    setSmoothingFactor(factor) {
        this.smoothingFactor = Math.max(0, Math.min(1, factor / 100));
    }

    /**
     * Get analyser for visualization
     */
    getAnalyser() {
        return this.analyser;
    }
}
