$ErrorActionPreference = "Stop"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"

Set-Location $PSScriptRoot
$py = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $py)) {
  Write-Error "Missing venv. Create it first (see README.md)."
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
