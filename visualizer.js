/**
 * Visualizer - Real-time audio visualization
 */
class Visualizer {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.mode = options.mode || 'pitch-diagram';

        // Configuration
        this.width = 0;
        this.height = 0;
        this.analyser = null;

        // Pitch diagram data
        this.pitchHistory = [];
        this.maxHistoryLength = 800;

        // Spectrogram data
        this.spectrogramData = [];
        this.maxSpectrogramWidth = 500;

        // Pitch diagram settings
        this.minNote = 24; // C1
        this.maxNote = 96; // C7
        this.noteRange = this.maxNote - this.minNote;

        // Animation
        this.animationId = null;
        this.isRunning = false;

        // Colors
        this.colors = {
            background: '#1a1a2e',
            primary: '#6c5ce7',
            secondary: '#a29bfe',
            accent: '#00d4aa',
            grid: 'rgba(255, 255, 255, 0.1)',
            gridStrong: 'rgba(255, 255, 255, 0.2)'
        };

        // Note colors (chromatic)
        this.noteColors = [
            '#ff4757', // C - Red
            '#ff6348', // C# - Orange
            '#ffa502', // D - Yellow
            '#c8d600', // D# - Yellow-Green
            '#26de81', // E - Green
            '#20bf6b', // F - Cyan
            '#0fb9b1', // F# - Teal
            '#4b7bec', // G - Blue
            '#a55eea', // G# - Purple
            '#8854d0', // A - Violet
            '#fd79a8', // A# - Pink
            '#eb3b5a'  // B - Magenta
        ];

        this.noteNames = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Resize canvas to match container
     */
    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.width = rect.width * window.devicePixelRatio;
        this.height = rect.height * window.devicePixelRatio;

        this.canvas.width = this.width;
        this.canvas.height = this.height;

        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    /**
     * Set analyser node
     */
    setAnalyser(analyser) {
        this.analyser = analyser;
    }

    /**
     * Set visualization mode
     */
    setMode(mode) {
        this.mode = mode;
        if (mode === 'tuner') {
            this.spectrogramData = [];
        } else if (mode === 'pitch-diagram') {
            this.pitchHistory = [];
        }
    }

    /**
     * Add pitch data point
     */
    addPitchData(pitchData) {
        if (pitchData && pitchData.frequency) {
            this.pitchHistory.push({
                frequency: pitchData.frequency,
                note: pitchData.note,
                octave: pitchData.octave,
                timestamp: Date.now()
            });

            // Keep history limited
            if (this.pitchHistory.length > this.maxHistoryLength) {
                this.pitchHistory.shift();
            }
        }
    }

    /**
     * Start visualization
     */
    start() {
        if (!this.isRunning) {
            this.isRunning = true;
            this.animate();
        }
    }

    /**
     * Stop visualization
     */
    stop() {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        this.clear();
    }

    /**
     * Animation loop
     */
    animate() {
        if (!this.isRunning) return;

        if (this.mode === 'pitch-diagram') {
            this.drawPitchDiagram();
        } else if (this.mode === 'spectrogram') {
            this.drawSpectrogram();
        } else if (this.mode === 'tuner') {
            this.drawTuner();
        }

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Draw pitch diagram visualization
     */
    drawPitchDiagram() {
        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;

        // Draw grid and note labels
        this.drawPitchGrid(canvasWidth, canvasHeight);

        // Draw pitch history
        if (this.pitchHistory.length > 1) {
            const pointSpacing = canvasWidth / this.maxHistoryLength;

            for (let i = 1; i < this.pitchHistory.length; i++) {
                const prevPoint = this.pitchHistory[i - 1];
                const currPoint = this.pitchHistory[i];

                const x1 = (i - 1) * pointSpacing;
                const x2 = i * pointSpacing;

                const y1 = this.frequencyToY(prevPoint.frequency, canvasHeight);
                const y2 = this.frequencyToY(currPoint.frequency, canvasHeight);

                // Get color based on note
                const color = this.getNoteColor(currPoint.note);

                // Draw line segment
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = 3;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';

                // Add glow effect
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = color;

                this.ctx.beginPath();
                this.ctx.moveTo(x1, y1);
                this.ctx.lineTo(x2, y2);
                this.ctx.stroke();

                // Draw point
                this.ctx.fillStyle = color;
                this.ctx.beginPath();
                this.ctx.arc(x2, y2, 2, 0, Math.PI * 2);
                this.ctx.fill();
            }

            this.ctx.shadowBlur = 0;
        }
    }

    /**
     * Draw grid and note labels for pitch diagram
     */
    drawPitchGrid(width, height) {
        this.ctx.font = '11px Inter, sans-serif';
        this.ctx.textAlign = 'right';
        this.ctx.textBaseline = 'middle';

        // Draw horizontal lines for each semitone
        for (let note = this.minNote; note <= this.maxNote; note++) {
            const y = this.noteToY(note, height);
            const octave = Math.floor(note / 12) - 1;
            const noteName = this.noteNames[note % 12];

            // Draw stronger line for C notes
            if (note % 12 === 0) {
                this.ctx.strokeStyle = this.colors.gridStrong;
                this.ctx.lineWidth = 1;
            } else {
                this.ctx.strokeStyle = this.colors.grid;
                this.ctx.lineWidth = 0.5;
            }

            this.ctx.beginPath();
            this.ctx.moveTo(50, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();

            // Draw note label for every note (or every octave if too crowded)
            const shouldDrawLabel = (this.maxNote - this.minNote) > 36
                ? (note % 12 === 0) // Only C notes if range > 3 octaves
                : true; // All notes otherwise

            if (shouldDrawLabel) {
                this.ctx.fillStyle = this.colors.grid;
                this.ctx.fillText(`${noteName}${octave}`, 45, y);
            }
        }
    }

    /**
     * Convert frequency to Y coordinate
     */
    frequencyToY(frequency, height) {
        // Convert frequency to MIDI note number (with decimals for microtones)
        const midiNote = 12 * Math.log2(frequency / 440) + 69;
        return this.noteToY(midiNote, height);
    }

    /**
     * Convert MIDI note to Y coordinate
     */
    noteToY(midiNote, height) {
        const normalizedNote = (midiNote - this.minNote) / this.noteRange;
        return height - (normalizedNote * height);
    }

    /**
     * Get color for a note name
     */
    getNoteColor(noteName) {
        // Remove sharp/flat symbols and get base note
        const baseNote = noteName.replace('♯', '#').replace('♭', 'b');

        const noteIndex = {
            'C': 0, 'C#': 1, 'Db': 1,
            'D': 2, 'D#': 3, 'Eb': 3,
            'E': 4,
            'F': 5, 'F#': 6, 'Gb': 6,
            'G': 7, 'G#': 8, 'Ab': 8,
            'A': 9, 'A#': 10, 'Bb': 10,
            'B': 11
        };

        const index = noteIndex[baseNote] || 0;
        return this.noteColors[index];
    }

    /**
     * Draw spectrogram visualization
     */
    drawSpectrogram() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteFrequencyData(dataArray);

        // Add new column to spectrogram
        this.spectrogramData.push(dataArray);
        if (this.spectrogramData.length > this.maxSpectrogramWidth) {
            this.spectrogramData.shift();
        }

        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;

        // Draw spectrogram
        const columnWidth = canvasWidth / this.spectrogramData.length;
        const rowHeight = canvasHeight / bufferLength;

        for (let x = 0; x < this.spectrogramData.length; x++) {
            const column = this.spectrogramData[x];

            for (let y = 0; y < column.length; y++) {
                const value = column[y];
                const intensity = value / 255;

                // Create gradient color based on intensity
                const hue = 260 - (intensity * 60); // Purple to blue
                const saturation = 70 + (intensity * 30);
                const lightness = 20 + (intensity * 60);

                this.ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

                const xPos = x * columnWidth;
                const yPos = canvasHeight - (y * rowHeight);

                this.ctx.fillRect(xPos, yPos, columnWidth + 1, rowHeight + 1);
            }
        }

        // Draw grid
        this.drawGrid(canvasWidth, canvasHeight);
    }

    /**
     * Draw tuner visualization (waveform)
     */
    drawTuner() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.fftSize;
        const dataArray = new Uint8Array(bufferLength);
        this.analyser.getByteTimeDomainData(dataArray);

        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;

        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        // Draw waveform
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = this.colors.primary;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = this.colors.primary;

        this.ctx.beginPath();

        const sliceWidth = canvasWidth / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0;
            const y = (v * canvasHeight) / 2;

            if (i === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }

            x += sliceWidth;
        }

        this.ctx.stroke();
        this.ctx.shadowBlur = 0;

        // Draw center line
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.moveTo(0, canvasHeight / 2);
        this.ctx.lineTo(canvasWidth, canvasHeight / 2);
        this.ctx.stroke();
    }

    /**
     * Draw grid lines
     */
    drawGrid(width, height) {
        this.ctx.strokeStyle = this.colors.grid;
        this.ctx.lineWidth = 1;

        // Horizontal lines
        const numHorizontalLines = 8;
        for (let i = 0; i <= numHorizontalLines; i++) {
            const y = (i / numHorizontalLines) * height;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }

        // Vertical lines
        const numVerticalLines = 10;
        for (let i = 0; i <= numVerticalLines; i++) {
            const x = (i / numVerticalLines) * width;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
    }

    /**
     * Clear canvas
     */
    clear() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);
        this.spectrogramData = [];
        this.pitchHistory = [];
    }
}
