# PitchWiz - Real-time Pitch Detection PWA

A Progressive Web App for real-time pitch detection and visualization, perfect for musicians, singers, and music students.

## Features

✨ **Real-time Pitch Detection** - Accurate pitch detection using autocorrelation algorithm  
🎵 **Musical Note Display** - Shows note name, octave, and frequency  
📊 **Dual Visualization Modes**
- **Spectrogram** - Beautiful frequency visualization over time
- **Tuner** - Waveform display for precise tuning

🎯 **Cents Indicator** - Visual feedback showing how close you are to the target pitch  
⚙️ **Customizable Settings** - Adjust A4 reference frequency and smoothing  
📱 **Progressive Web App** - Install on your phone or desktop for offline use  
🎨 **Modern UI** - Beautiful dark theme with smooth animations

## Technology Stack

- **HTML5** - Semantic structure
- **Vanilla CSS** - Modern design system with CSS variables
- **JavaScript** - No frameworks, pure Web APIs
- **Web Audio API** - Microphone access and audio processing
- **Canvas API** - Real-time visualizations
- **Service Workers** - Offline functionality

## How to Use

### Running Locally

Choose one of the following methods to run PitchWiz on your computer:

#### Option 1: Python (Recommended - Easiest)

**If you don't have Python installed:**
1. Download Python from [python.org](https://www.python.org/downloads/)
2. During installation, check "Add Python to PATH"
3. Restart your terminal/command prompt

**To run the app:**
```bash
# Navigate to the PitchWiz folder
cd path/to/PitchWiz

# Start the server
python -m http.server 8000
```
Then open your browser to `http://localhost:8000`

#### Option 2: Node.js

**If you don't have Node.js installed:**
1. Download Node.js from [nodejs.org](https://nodejs.org/)
2. Install using the default settings
3. Restart your terminal/command prompt

**To run the app:**
```bash
# Navigate to the PitchWiz folder
cd path/to/PitchWiz

# Start the server (no installation needed)
npx http-server -p 8000
```
Then open your browser to `http://localhost:8000`

#### Option 3: VS Code Live Server (For Developers)

1. Install [Visual Studio Code](https://code.visualstudio.com/)
2. Install the "Live Server" extension
3. Open the PitchWiz folder in VS Code
4. Right-click `index.html` → "Open with Live Server"

#### Option 4: Double-Click (Limited Functionality)

⚠️ **Not Recommended** - Some features may not work due to browser security restrictions

Simply double-click `index.html` to open it in your browser. However, microphone access and some features may be blocked.

### Using the App

1. Click **"Start Listening"** to activate your microphone
2. Grant microphone permissions when prompted
3. Play or sing a note
4. Watch the real-time pitch detection and visualization
5. Toggle between **Spectrogram** and **Tuner** modes
6. Adjust settings via the gear icon

### Installing as PWA

**On Desktop (Chrome/Edge):**
- Click the install icon in the address bar
- Or go to Menu → Install PitchWiz

**On Mobile (Chrome/Safari):**
- Tap the share/menu button
- Select "Add to Home Screen"

### Backup & Restore (Export/Import)

**To Backup your Library:**
1. Go to the **Library** tab
2. Click **📦 Export**
3. A ZIP file containing all your recordings (audio + data) and settings will be downloaded.

**To Restore your Library:**
1. Go to the **Library** tab
2. Click **📥 Import**
3. Select your previously exported ZIP file
4. The app will intelligently import new recordings and merge your profiles/settings (skipping duplicates).

## Project Structure

```
dynamic-orion/
├── index.html           # Main HTML structure
├── styles.css           # Design system and styles
├── app.js              # Main application controller
├── pitch-detector.js   # Pitch detection algorithm
├── visualizer.js       # Canvas visualization engine
├── manifest.json       # PWA manifest
├── service-worker.js   # Offline caching
├── icon-192.png        # App icon (192x192)
├── icon-512.png        # App icon (512x512)
└── README.md           # This file
```

## Algorithm Details

### Pitch Detection
Uses **autocorrelation** algorithm for accurate pitch detection:
1. Captures audio buffer from microphone
2. Calculates RMS to detect silence
3. Performs autocorrelation to find fundamental frequency
4. Uses parabolic interpolation for sub-sample accuracy
5. Applies smoothing to reduce jitter

### Visualization
- **Spectrogram**: Real-time frequency spectrum with color-coded intensity
- **Tuner**: Waveform display showing audio signal shape

## Browser Compatibility

✅ Chrome/Edge (recommended)  
✅ Firefox  
✅ Safari (iOS 11+)  
✅ Opera

**Requirements:**
- HTTPS or localhost (required for microphone access)
- Modern browser with Web Audio API support

## Performance

- **Low latency** - Real-time processing with minimal delay
- **Efficient** - Uses Web Audio API for native performance
- **Smooth animations** - 60 FPS canvas rendering
- **Small footprint** - No dependencies, ~50KB total

## Future Enhancements

- [ ] Recording and playback
- [ ] Pitch history graph
- [ ] Multiple tuning systems (equal temperament, just intonation)
- [ ] Transposition support
- [ ] Export pitch data
- [ ] Dark/light theme toggle

## License

MIT License - Feel free to use and modify!

## Credits

Built with ❤️ by Louis-Martin Richard using modern web technologies.



Future Features: 

📊 Recording & Playback - Record sessions and review your progress
📈 Progress Tracking - Track pitch accuracy over time, see improvement graphs
🎯 Practice Modes - Interval training, scale practice, specific exercises
🎼 Sheet Music Integration - Follow along with notation
🔊 Audio Export - Save your best takes
📱 Mobile Optimization - Touch controls for phone/tablet
🎨 Themes - Dark/light mode, custom color schemes
🌍 Multiple Tuning Systems - Just intonation, historical temperaments
🎤 Formant Analysis - For vowel shaping and resonance
🔄 Real-time Effects - Reverb, pitch correction preview
📚 Exercise Library - Built-in vocal exercises with targets
👥 Multi-user Profiles - Track different singers
🎯 Target Pitch Display - Show where you should be vs where you are

---

**Note:** This app requires microphone access. Your audio is processed locally in your browser and never sent to any server.
