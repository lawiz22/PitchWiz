#!/usr/bin/env pwsh
# Quick script to kill development servers

Write-Host "Stopping development servers..." -ForegroundColor Yellow

# Kill Node.js processes
$nodeKilled = $false
try {
    taskkill /F /IM node.exe 2>$null
    if ($LASTEXITCODE -eq 0) {
        $nodeKilled = $true
        Write-Host "[OK] Node.js processes killed" -ForegroundColor Green
    }
}
catch {
    # No node processes running
}

# Kill Python processes
$pythonKilled = $false
try {
    taskkill /F /IM python.exe 2>$null
    if ($LASTEXITCODE -eq 0) {
        $pythonKilled = $true
        Write-Host "[OK] Python processes killed" -ForegroundColor Green
    }
}
catch {
    # No python processes running
}

if (-not $nodeKilled -and -not $pythonKilled) {
    Write-Host "[INFO] No server processes found" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "WARNING: Clear your browser's Service Worker cache!" -ForegroundColor Red
Write-Host "   1. Press F12 to open DevTools" -ForegroundColor White
Write-Host "   2. Go to Application -> Service Workers" -ForegroundColor White
Write-Host "   3. Click 'Unregister'" -ForegroundColor White
Write-Host "   4. Go to Storage -> Clear site data" -ForegroundColor White
Write-Host ""
Write-Host "   Or just use Incognito mode for development!" -ForegroundColor Cyan
