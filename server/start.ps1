$ErrorActionPreference = "Stop"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"

Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  if ($env:OneDrive) {
    $legacyPython = Join-Path $env:OneDrive "Desktop\Drishti\server\.venv\Scripts\python.exe"
    if (Test-Path $legacyPython) {
      $py = $legacyPython
    }
  }
}
if (-not (Test-Path $py)) {
  Write-Error "Missing server venv. Create server\.venv first (see README.md)."
}

$modelPath = Join-Path (Split-Path $PSScriptRoot -Parent) "yolo26x.pt"
if (-not (Test-Path $modelPath) -and $env:OneDrive) {
  $legacyModelPath = Join-Path $env:OneDrive "Desktop\Drishti\yolo26x.pt"
  if (Test-Path $legacyModelPath) {
    $modelPath = $legacyModelPath
  }
}
if (Test-Path $modelPath) {
  $env:DRISHTI_MODEL_PATH = $modelPath
} else {
  Write-Warning "YOLO weights not found. Set DRISHTI_MODEL_PATH or place yolo26x.pt at the repository root."
}

try {
  $runningServer = Invoke-RestMethod -Uri "http://127.0.0.1:8765/health" -TimeoutSec 2
  if ($runningServer.ok) {
    Write-Host "Drishti server is already running on port 8765; reusing it."
    if (-not $runningServer.ready) {
      Write-Warning "The server is running, but its detection model is not ready."
    }
    return
  }
} catch {
  # No local server is listening yet; start one below.
}

$wifiIp = (
  Get-NetIPAddress -AddressFamily IPv4 |
  Where-Object {
    $_.IPAddress -notlike '127.*' -and
    $_.InterfaceAlias -match 'Wi-?Fi|WLAN'
  } |
  Select-Object -First 1 -ExpandProperty IPAddress
)
if (-not $wifiIp) {
  $wifiIp = (
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.PrefixOrigin -ne 'WellKnown' } |
    Select-Object -First 1 -ExpandProperty IPAddress
  )
}

Write-Host "Starting Drishti detection server on http://0.0.0.0:8765"
if ($wifiIp) {
  Write-Host "Phone should use: http://${wifiIp}:8765"
  Write-Host "Update c_app/src/core/utils/serverConfig.ts DETECTION_SERVER_HOST to $wifiIp if needed"
} else {
  Write-Host "Could not detect Wi-Fi IP. Run ipconfig and set DETECTION_SERVER_HOST in the app."
}
Write-Host "If phone cannot connect: allow TCP 8765 in Windows Firewall (Private networks)."
& $py app.py
