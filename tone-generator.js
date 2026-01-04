/**
 * Tone Generator for PitchWiz
 * Generates reference tones using Web Audio API for practice exercises
 */

class ToneGenerator {
    constructor(audioContext) {
        this.audioContext = audioContext || null;
        this.oscillator = null;
        this.gainNode = null;
        this.isPlaying = false;
    }

    /**
     * Set external audio context (e.g. from PitchDetector)
     */
    setContext(context) {
        this.audioContext = context;
    }

    /**
     * Initialize audio context (call on user interaction)
     */
    init() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        return this.audioContext;
    }

    /**
     * Convert note name to frequency (e.g., "A4" -> 440 Hz)
     */
    noteToFrequency(noteName) {
        const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

        // Parse note
        const match = noteName.match(/^([A-G]#?)(\d+)$/);
        if (!match) {
            throw new Error(`Invalid note format: ${noteName}`);
        }

        const note = match[1];
        const octave = parseInt(match[2]);

        // Calculate semitones from A4
        const noteIndex = notes.indexOf(note);
        const a4Index = notes.indexOf('A');

        // Semitones from C0
        const semitonesFromC0 = (octave * 12) + noteIndex;
        const a4SemitonesFromC0 = (4 * 12) + a4Index;
        const semitonesFromA4 = semitonesFromC0 - a4SemitonesFromC0;

        // Calculate frequency: f = 440 * 2^(semitones/12)
        const frequency = 440 * Math.pow(2, semitonesFromA4 / 12);

        return frequency;
    }

    /**
     * Play a note for a specified duration
     * @param {string} noteName - Note to play (e.g., "A4", "C#3")
     * @param {number} duration - Duration in seconds
     * @param {number} volume - Volume (0 to 1), default 0.3
     */
    async playNote(noteName, duration = 5, volume = 0.3) {
        // Stop any currently playing tone
        this.stop();

        // Initialize context if needed
        this.init();

        // Resume context if suspended (required for autoplay policies)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        try {
            const frequency = this.noteToFrequency(noteName);

            // Create oscillator
            this.oscillator = this.audioContext.createOscillator();
            this.gainNode = this.audioContext.createGain();

            // Configure oscillator
            this.oscillator.type = 'sine'; // Pure sine wave for reference tone
            this.oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

            // Configure gain (volume)
            this.gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
            this.gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.05); // Fade in
            this.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime + duration - 0.05);
            this.gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration); // Fade out

            // Connect nodes
            this.oscillator.connect(this.gainNode);
            this.gainNode.connect(this.audioContext.destination);

            // Start and schedule stop
            this.oscillator.start(this.audioContext.currentTime);
            this.oscillator.stop(this.audioContext.currentTime + duration);

            this.isPlaying = true;

            // Clean up when done
            this.oscillator.onended = () => {
                this.isPlaying = false;
                this.oscillator = null;
                this.gainNode = null;
            };

            return { frequency, duration };

        } catch (error) {
            console.error('Error playing tone:', error);
            throw error;
        }
    }

    /**
     * Stop currently playing tone
     */
    stop() {
        if (this.oscillator && this.isPlaying) {
            try {
                this.oscillator.stop();
                this.oscillator.disconnect();
                this.gainNode.disconnect();
            } catch (e) {
                // Already stopped or disconnected
            }
            this.isPlaying = false;
            this.oscillator = null;
            this.gainNode = null;
        }
    }

    /**
     * Check if a tone is currently playing
     */
    getIsPlaying() {
        return this.isPlaying;
    }

    /**
     * Clean up audio context
     */
    destroy() {
        this.stop();
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}
