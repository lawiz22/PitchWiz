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

1. **Simple HTTP Server (Python)**
   ```bash
   python -m http.server 8000
   ```
   Then open `http://localhost:8000`

2. **Simple HTTP Server (Node.js)**
   ```bash
   npx http-server -p 8000
   ```
   Then open `http://localhost:8000`

3. **VS Code Live Server**
   - Install "Live Server" extension
   - Right-click `index.html` → "Open with Live Server"

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
