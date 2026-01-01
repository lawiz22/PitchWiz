# Development Guide

## Starting the Development Server

Choose one of these methods:

### Option 1: Python HTTP Server
```bash
python -m http.server 8000
```

### Option 2: Node.js HTTP Server
```bash
npx http-server -p 8000
```

### Option 3: VS Code Live Server
- Install "Live Server" extension
- Right-click `index.html` → "Open with Live Server"

## Stopping the Server

### Step 1: Kill the Server Process

**If you started with Python:**
- Press `Ctrl + C` in the terminal

**If you started with Node.js:**
- Press `Ctrl + C` in the terminal

**If you can't find the terminal:**
```powershell
# Kill all Node.js processes
taskkill /F /IM node.exe

# Or kill all Python processes
taskkill /F /IM python.exe
```

**If you started with VS Code Live Server:**
- Click the port number in the bottom-right status bar
- Or right-click `index.html` → "Stop Live Server"

### Step 2: Clear the Service Worker Cache

**This is CRITICAL for PWAs!** The Service Worker will keep serving cached content even after the server is stopped.

#### Method 1: Browser DevTools (Recommended)
1. Open the app in your browser
2. Press `F12` to open DevTools
3. Go to **Application** tab (Chrome/Edge) or **Storage** tab (Firefox)
4. Click **Service Workers** in the left sidebar
5. Click **Unregister** next to the service worker
6. Go to **Storage** → **Clear site data** → Click "Clear site data"
7. Close the browser tab

#### Method 2: Hard Refresh
1. Press `Ctrl + Shift + Delete` to open Clear Browsing Data
2. Select "Cached images and files"
3. Click "Clear data"
4. Do a hard refresh: `Ctrl + Shift + R`

#### Method 3: Incognito/Private Mode (For Testing)
- Use Incognito mode during development to avoid Service Worker caching issues
- Service Workers won't persist between sessions

## Development Tips

### Disable Service Worker During Development

Comment out the Service Worker registration in `index.html` (lines 134-142):

```html
<!-- Disable during development to avoid caching issues
<script>
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(reg => console.log('Service Worker registered'))
                .catch(err => console.log('Service Worker registration failed'));
        });
    }
</script>
-->
```

### Force Reload Without Cache
- **Chrome/Edge/Firefox:** `Ctrl + Shift + R` or `Ctrl + F5`
- **With DevTools open:** Right-click the refresh button → "Empty Cache and Hard Reload"

### Check What's Running on a Port

```powershell
# Check if port 8000 is in use
Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue

# Find what process is using port 8000
Get-NetTCPConnection -LocalPort 8000 | ForEach-Object { 
    Get-Process -Id $_.OwningProcess 
}
```

## Quick Kill Script

Save this as `kill-server.ps1`:

```powershell
# Kill common web servers
taskkill /F /IM node.exe 2>$null
taskkill /F /IM python.exe 2>$null

Write-Host "Server processes killed!"
Write-Host "Don't forget to clear your browser's Service Worker cache!"
Write-Host "Press F12 → Application → Service Workers → Unregister"
```

Run with:
```powershell
.\kill-server.ps1
```
