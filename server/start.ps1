$ErrorActionPreference = "Stop"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"

Set-Location $PSScriptRoot

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

function Test-ServerPython($Executable) {
  if (-not (Test-Path $Executable)) {
    return $false
  }
  & $Executable -c "import cv2, easyocr, fastapi, numpy, PIL, torch, ultralytics" *> $null
  return $LASTEXITCODE -eq 0
}

function Test-ServerCuda($Executable) {
  if (-not (Test-ServerPython $Executable)) {
    return $false
  }
  & $Executable -c "import sys, torch; sys.exit(0 if torch.cuda.is_available() else 1)" *> $null
  return $LASTEXITCODE -eq 0
}

$localPython = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$legacyPython = $null
if ($env:OneDrive) {
  $legacyPython = Join-Path $env:OneDrive "Desktop\Drishti\server\.venv\Scripts\python.exe"
}

$py = $null
if (Test-ServerCuda $localPython) {
  $py = $localPython
} elseif ($legacyPython -and (Test-ServerCuda $legacyPython)) {
  Write-Host "Using the existing CUDA-enabled OneDrive server environment."
  $py = $legacyPython
} elseif (Test-ServerPython $localPython) {
  Write-Warning "CUDA is unavailable; using the repository venv on CPU."
  $py = $localPython
} elseif ($legacyPython -and (Test-ServerPython $legacyPython)) {
  Write-Warning "CUDA is unavailable; using the existing OneDrive venv on CPU."
  $py = $legacyPython
} else {
  Write-Error "No usable server venv found. Install server\requirements.txt and the required PyTorch build (see README.md)."
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

$worldModelPath = Join-Path (Split-Path $PSScriptRoot -Parent) "yolov8s-worldv2.pt"
if (Test-Path $worldModelPath) {
  $env:DRISHTI_WORLD_MODEL_PATH = $worldModelPath
} else {
  Write-Warning "Optional YOLO-World weights not found; household-object detection will be disabled."
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
