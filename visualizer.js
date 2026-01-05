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
        this.minNote = 24; // C1 (default)
        this.maxNote = 72; // C5 (default)
        this.noteRange = this.maxNote - this.minNote;
        this.detectionMode = 'on-sound'; // 'on-sound' or 'live'
        this.zoomLevel = 1.0; // Vertical zoom: 0.5 to 3.0
        this.verticalPan = 0; // Vertical pan offset in semitones
        this.horizontalZoom = 1.0; // Horizontal zoom: 0.5 to 3.0
        this.scanSpeed = 1.0; // 0.5 to 2.0
        this.scrollOffset = 0; // For smooth scrolling
        this.showSpectrogramNotes = true; // Show note labels on spectrogram
        this.waveformZoom = 1.0; // Tuner waveform zoom: 0.5 to 3.0
        this.waveformGain = 2.0; // Tuner waveform amplitude: 0.5 to 5.0

        // Auto-Zoom State
        this.autoZoom = false;
        this.autoZoomSpeed = 2.0; // Seconds to look back (Re-zoom Delay)
        this.autoZoomSilenceTimer = 0;
        this.autoZoomTargetPan = 0;
        this.autoZoomTargetZoom = 1.0;

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
        this.resize();
        window.addEventListener('resize', () => this.resize());

        // Double-click to reset view
        this.canvas.addEventListener('dblclick', () => this.resetView());
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
     * Reset view to default state
     */
    resetView() {
        this.clear(); // Clear data to truly reset the "diagram" and Auto-Zoom state
        this.zoomLevel = 1.0;
        this.verticalPan = 0;
        this.horizontalZoom = 1.0;
        // Keep autoZoom state as is (user request)

        // Also update UI sliders if they exist
        // Actually, if auto-zoom is on, it will fight the reset immediately. 
        // Best to momentarily disable or let it re-converge.
        // User asked: "reset the pitchdiagram". I'll reset values. if Auto-Zoom is ON, it will just zoom back in. That's probably expected behavior (momentary reset).

        // Also update UI sliders if they exist
        const zoomSlider = document.getElementById('zoomLevel');
        const zoomValue = document.getElementById('zoomValue');
        if (zoomSlider) {
            zoomSlider.value = 100;
            if (zoomValue) zoomValue.textContent = '1.0x';
        }
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
     * Set zoom level (1.0 = normal)
     */
    setZoom(zoom) {
        this.zoomLevel = Math.max(0.5, Math.min(3.0, zoom));
    }

    /**
     * Set note range for pitch diagram
     */
    setNoteRange(minNote, maxNote) {
        this.minNote = minNote;
        this.maxNote = maxNote;
        this.noteRange = this.maxNote - this.minNote;
        this.pitchHistory = []; // Clear history to avoid rendering issues
    }

    /**
     * Set detection mode
     */
    setDetectionMode(mode) {
        this.detectionMode = mode; // 'on-sound' or 'live'
        this.pitchHistory = []; // Clear history when switching modes
    }

    /**
     * Set zoom level
     */
    setZoomLevel(zoom) {
        this.zoomLevel = Math.max(0.5, Math.min(3.0, zoom));
    }

    /**
     * Set horizontal zoom level
     */
    setHorizontalZoom(zoom) {
        this.horizontalZoom = Math.max(0.5, Math.min(3.0, zoom));
    }

    /**
     * Set scan speed
     */
    setScanSpeed(speed) {
        this.scanSpeed = Math.max(0.5, Math.min(2.0, speed));
    }

    /**
     * Set Auto-Zoom Speed (Lookback duration)
     */
    setAutoZoomSpeed(seconds) {
        this.autoZoomSpeed = Math.max(0.5, Math.min(5.0, seconds));
    }

    /**
     * Add pitch data point
     */
    addPitchData(pitchData) {
        // In live mode, always add data (even null for silence)
        // In on-sound mode, only add when pitch is detected
        if (this.detectionMode === 'live' || (pitchData && pitchData.frequency)) {
            this.pitchHistory.push({
                frequency: pitchData ? pitchData.frequency : null,
                note: pitchData ? pitchData.note : null,
                octave: pitchData ? pitchData.octave : null,
                cents: pitchData ? pitchData.cents : null,
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
     * Update Auto-Zoom logic
     */
    updateAutoZoom() {
        if (!this.autoZoom) return;

        // 1. Analyze Active Range
        // Use user-defined speed (seconds) converted to frames (approx 60fps)
        const fps = 60;
        const lookbackFrames = Math.floor(this.autoZoomSpeed * fps);
        const recentPitches = this.pitchHistory.slice(-lookbackFrames).filter(p => p.frequency && p.frequency > 0);

        if (recentPitches.length < 10) {
            // Not enough data or silence
            this.autoZoomSilenceTimer++;
            // Only reset if silence lasts longer than the memory window
            if (this.autoZoomSilenceTimer > lookbackFrames) {
                // Could reset here if needed
            }
            return;
        }

        this.autoZoomSilenceTimer = 0;

        // ROBUST RANGE CALCULATION (Glitch Filtering)
        // 1. Calculate MIDI note values for all valid pitches
        const pitchValues = [];
        for (const p of recentPitches) {
            const val = 12 * Math.log2(p.frequency / 440) + 69;
            pitchValues.push(val);
        }

        // 2. Sort values to find percentiles
        pitchValues.sort((a, b) => a - b);

        // 3. Ignore outliers (bottom 5% and top 5%)
        // This filters out momentary glitches/spikes
        const lowIndex = Math.floor(pitchValues.length * 0.05);
        const highIndex = Math.floor(pitchValues.length * 0.95);

        // Safety clamp
        const safeLowIndex = Math.max(0, lowIndex);
        const safeHighIndex = Math.min(pitchValues.length - 1, highIndex);

        const activeMin = pitchValues[safeLowIndex];
        const activeMax = pitchValues[safeHighIndex];

        const currentPitchRange = activeMax - activeMin;
        const currentCenter = (activeMin + activeMax) / 2;

        // 2. Determine Targets
        let targetNoteRange;

        // "Focus Mode": If range is very small (steady note), zoom in tight
        if (currentPitchRange < 4) {
            // Very steady note -> Tight focus
            targetNoteRange = 14;
        } else if (currentPitchRange < 12) {
            // Small melody -> Medium focus
            targetNoteRange = currentPitchRange + 10;
        } else {
            // Wide melody -> Fit range with padding
            targetNoteRange = currentPitchRange + 8;
        }

        // Clamp ranges
        targetNoteRange = Math.max(10, Math.min(48, targetNoteRange));

        // Calculate Target Zoom: ZoomLevel = DefaultNoteRange (48) / TargetNoteRange
        const baseNoteRange = this.maxNote - this.minNote;
        let targetZoom = baseNoteRange / targetNoteRange;

        // Clamp Zoom to valid limits - INCREASED MAX ZOOM to 5.0x
        targetZoom = Math.max(0.5, Math.min(5.0, targetZoom));

        // Calculate Target Pan (Center Offset)
        const defaultCenter = (this.minNote + this.maxNote) / 2;
        let targetPan = currentCenter - defaultCenter;

        // Clamp Pan to valid limits
        targetPan = Math.max(-24, Math.min(24, targetPan));

        // 3. Smooth Interpolation (Lerp)
        const smoothFactor = 0.1; // FASTER! 10% approach per frame

        // Apply smooth zoom
        const zoomDiff = targetZoom - this.zoomLevel;
        if (Math.abs(zoomDiff) > 0.01) {
            this.setZoomLevel(this.zoomLevel + zoomDiff * smoothFactor);
            // Sync UI slider if possible
            const zoomSlider = document.getElementById('zoomLevel');
            const zoomValue = document.getElementById('zoomValue');
            if (zoomSlider && zoomValue) {
                zoomSlider.value = Math.round(this.zoomLevel * 100);
                zoomValue.textContent = `${this.zoomLevel.toFixed(1)}x`;
            }
        }

        // Apply smooth pan
        const panDiff = targetPan - this.verticalPan;
        if (Math.abs(panDiff) > 0.1) {
            this.verticalPan += panDiff * smoothFactor;
            // console.log(`AutoZoom: Range=${currentPitchRange.toFixed(1)} Center=${currentCenter.toFixed(1)} TargetZoom=${targetZoom.toFixed(1)}`);
        }
    }

    /**
     * Draw pitch diagram visualization
     */
    drawPitchDiagram() {
        // Update Auto-Zoom
        this.updateAutoZoom();

        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;

        // Draw grid and note labels
        this.drawPitchGrid(canvasWidth, canvasHeight);

        // Draw pitch history
        if (this.pitchHistory.length > 1) {
            // Apply scan speed and horizontal zoom to point spacing
            const baseSpacing = canvasWidth / this.maxHistoryLength;
            const pointSpacing = baseSpacing * this.scanSpeed * this.horizontalZoom;

            // Calculate scroll offset to make diagram scroll from right to left
            const totalWidth = this.pitchHistory.length * pointSpacing;
            // Keep the "head" of the graph at 90% of the screen width to avoid edge clipping
            const scrollOffset = Math.max(0, totalWidth - (canvasWidth * 0.90));

            for (let i = 1; i < this.pitchHistory.length; i++) {
                const prevPoint = this.pitchHistory[i - 1];
                const currPoint = this.pitchHistory[i];

                // Skip if either point is null (silence in live mode)
                if (!prevPoint.frequency || !currPoint.frequency) {
                    continue;
                }

                const leftMargin = 50; // Align with grid and labels
                const x1 = leftMargin + (i - 1) * pointSpacing - scrollOffset;
                const x2 = leftMargin + i * pointSpacing - scrollOffset;

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
     * Render a single frame based on playback timestamp
     * @param {number} currentTime - Current playback time in seconds
     * @param {Array} pitchData - Full pitch data array for the recording
     */
    renderPlaybackFrame(currentTime, pitchData) {
        if (!pitchData || pitchData.length === 0) return;

        // Clear canvas
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.width, this.height);

        const canvasWidth = this.canvas.width / window.devicePixelRatio;
        const canvasHeight = this.canvas.height / window.devicePixelRatio;

        this.drawPitchGrid(canvasWidth, canvasHeight);

        // Define time window to show based on horizontal zoom
        // Base window: 5 seconds. Max zoom (3x) = ~1.6s, Min zoom (0.01x) = 500s window
        const baseWindow = 5;
        const timeWindow = baseWindow / this.horizontalZoom;

        const endTime = currentTime * 1000; // ms
        const startTime = (currentTime - timeWindow) * 1000; // ms

        // Filter points within view window
        // Optimization: Could use binary search for large datasets
        const visiblePoints = pitchData.filter(p => p.timestamp >= startTime && p.timestamp <= endTime);

        if (visiblePoints.length > 1) {
            const timeScale = canvasWidth / (timeWindow * 1000); // pixels per ms

            for (let i = 1; i < visiblePoints.length; i++) {
                const prevPoint = visiblePoints[i - 1];
                const currPoint = visiblePoints[i];

                if (!prevPoint.frequency || !currPoint.frequency) continue;

                // Calculate X position relative to current time (scrolling left)
                // Right edge is currentTime
                const x1 = canvasWidth - (endTime - prevPoint.timestamp) * timeScale;
                const x2 = canvasWidth - (endTime - currPoint.timestamp) * timeScale;

                const y1 = this.frequencyToY(prevPoint.frequency, canvasHeight);
                const y2 = this.frequencyToY(currPoint.frequency, canvasHeight);

                const color = this.getNoteColor(currPoint.note);

                // Use thicker lines for higher zoom
                this.ctx.lineWidth = 3 * Math.sqrt(this.horizontalZoom);
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
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

            // Draw note label for ALL notes with their color
            const noteColor = this.getNoteColor(noteName);
            this.ctx.fillStyle = noteColor;
            this.ctx.fillText(`${noteName}${octave}`, 45, y);
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
        // Apply zoom level and vertical pan
        const effectiveRange = this.noteRange / this.zoomLevel;
        const centerNote = (this.minNote + this.maxNote) / 2 + this.verticalPan;
        const effectiveMin = centerNote - effectiveRange / 2;
        const effectiveMax = centerNote + effectiveRange / 2;

        const normalizedNote = (midiNote - effectiveMin) / (effectiveMax - effectiveMin);
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

        // Draw spectrogram with zoom support
        // Apply horizontal zoom - controls how much time history to show
        const dataToShow = Math.floor(this.spectrogramData.length / this.horizontalZoom);
        const startIndex = Math.max(0, this.spectrogramData.length - dataToShow);
        const visibleData = this.spectrogramData.slice(startIndex);

        const columnWidth = canvasWidth / visibleData.length;

        // Safety check - wait for audio to initialize
        if (!this.analyser) return;
        const nyquist = this.analyser.context.sampleRate / 2;

        // Apply vertical zoom to frequency range - zoom in = show less frequency range (more detail)
        // Default: 1000Hz, zoom 2x = 500Hz, zoom 0.5x = 2000Hz
        const maxFreqToShow = 1000 / this.zoomLevel;
        const binsToShow = Math.floor((maxFreqToShow / nyquist) * bufferLength);
        const rowHeight = canvasHeight / binsToShow;

        for (let x = 0; x < visibleData.length; x++) {
            const column = visibleData[x];

            // Only draw frequency bins up to maxFreqToShow
            for (let y = 0; y < Math.min(binsToShow, column.length); y++) {
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

        // Draw frequency labels on Y-axis (adjusted for zoom)
        this.ctx.font = '11px Inter, sans-serif';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.textAlign = 'left';

        // Calculate max frequency being shown based on zoom
        const maxFreqShown = 1000 / this.zoomLevel;

        // Draw labels evenly spaced on Y-axis
        for (let i = 0; i <= 5; i++) {
            const freq = Math.round((i / 5) * maxFreqShown);
            const y = canvasHeight - (i / 5) * canvasHeight;

            // Adjust text baseline to prevent cutoff at edges
            if (i === 0) {
                this.ctx.textBaseline = 'bottom'; // Bottom label
            } else if (i === 5) {
                this.ctx.textBaseline = 'top'; // Top label
            } else {
                this.ctx.textBaseline = 'middle'; // Middle labels
            }

            this.ctx.fillText(`${freq}Hz`, 5, y);
        }

        // Draw musical note labels on right side (if enabled)
        if (this.showSpectrogramNotes) {
            this.ctx.textAlign = 'right';

            // Calculate which notes fall within the visible frequency range
            const minFreq = 0;
            const maxFreq = maxFreqShown;

            // Find MIDI notes that fall within this range
            for (let midi = 12; midi <= 108; midi++) { // C0 to C8
                const freq = 440 * Math.pow(2, (midi - 69) / 12); // A4 = 440Hz

                if (freq >= minFreq && freq <= maxFreq) {
                    const noteName = this.noteNames[midi % 12];
                    const octave = Math.floor(midi / 12) - 1;
                    const noteColor = this.getNoteColor(noteName);

                    // Calculate Y position for this frequency
                    const y = canvasHeight - (freq / maxFreqShown * canvasHeight);

                    // Draw note label with color
                    this.ctx.fillStyle = noteColor;
                    this.ctx.fillText(`${noteName}${octave}`, canvasWidth - 5, y);
                }
            }

            // Reset text align
            this.ctx.textAlign = 'left';
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

        // Get current pitch color
        const pitchData = this.pitchHistory.length > 0 ? this.pitchHistory[this.pitchHistory.length - 1] : null;
        const waveformColor = pitchData && pitchData.note ? this.getNoteColor(pitchData.note) : this.colors.primary;

        // Apply waveform zoom - show subset of data for more detail
        const zoomedBufferLength = Math.floor(bufferLength / this.waveformZoom);
        const startIndex = Math.floor((bufferLength - zoomedBufferLength) / 2);

        // Draw waveform with pitch-based color
        this.ctx.lineWidth = 3;
        this.ctx.strokeStyle = waveformColor;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = waveformColor;

        this.ctx.beginPath();

        const sliceWidth = canvasWidth / zoomedBufferLength;
        let x = 0;

        for (let i = 0; i < zoomedBufferLength; i++) {
            const dataIndex = startIndex + i;
            const v = dataArray[dataIndex] / 128.0; // Normalize to -1 to 1 range
            // Center at canvasHeight/2 and apply gain
            const y = canvasHeight / 2 + ((v - 1) * canvasHeight / 2 * this.waveformGain);

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

        // Draw pitch info overlay
        if (pitchData && pitchData.note && pitchData.frequency) {
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;

            // Draw background glow when in tune
            if (pitchData.cents !== undefined && pitchData.cents !== null) {
                // Use the tuning threshold from app.js (passed via window or global)
                const threshold = window.tuningThreshold || 5;
                const isInTune = Math.abs(pitchData.cents) < threshold;
                if (isInTune) {
                    // Draw glowing background
                    const gradient = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, canvasWidth / 2);
                    gradient.addColorStop(0, waveformColor + '30');
                    gradient.addColorStop(0.5, waveformColor + '10');
                    gradient.addColorStop(1, 'transparent');
                    this.ctx.fillStyle = gradient;
                    this.ctx.fillRect(0, 0, canvasWidth, canvasHeight);
                }
            }

            // Draw note name (large)
            this.ctx.font = 'bold 72px Inter, sans-serif';
            this.ctx.fillStyle = waveformColor;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.shadowBlur = 20;
            this.ctx.shadowColor = waveformColor;
            this.ctx.fillText(pitchData.note, centerX, centerY - 80);

            // Draw frequency (medium)
            this.ctx.font = '32px Inter, sans-serif';
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowColor = waveformColor;
            this.ctx.fillText(`${pitchData.frequency.toFixed(1)} Hz`, centerX, centerY - 20);

            // Draw cents indicator bar
            if (pitchData.cents !== undefined && pitchData.cents !== null) {
                const roundedCents = Math.round(pitchData.cents);

                // Draw bar background
                const barWidth = 300;
                const barHeight = 8;
                const barX = centerX - barWidth / 2;
                const barY = centerY + 30;

                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
                this.ctx.fillRect(barX, barY, barWidth, barHeight);

                // Draw center line
                this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
                this.ctx.fillRect(centerX - 1, barY - 5, 2, barHeight + 10);

                // Draw cents marker
                const centsPercent = ((roundedCents + 50) / 100);
                const markerX = barX + (centsPercent * barWidth);
                const threshold = window.tuningThreshold || 5;
                const markerColor = Math.abs(roundedCents) < threshold ? '#4ade80' : waveformColor;

                this.ctx.fillStyle = markerColor;
                this.ctx.beginPath();
                this.ctx.arc(markerX, barY + barHeight / 2, 6, 0, Math.PI * 2);
                this.ctx.fill();

                // Draw cents text
                const centsText = roundedCents >= 0 ? `+${roundedCents}¢` : `${roundedCents}¢`;
                this.ctx.font = '20px Inter, sans-serif';
                this.ctx.fillStyle = markerColor;
                this.ctx.shadowBlur = 5;
                this.ctx.shadowColor = markerColor;
                this.ctx.fillText(centsText, centerX, centerY + 65);
            }

            this.ctx.shadowBlur = 0;
        }
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
