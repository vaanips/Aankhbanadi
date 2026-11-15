# Builds release APK + AAB via a short path to avoid Windows MAX_PATH / Reanimated CMake failures.
$ErrorActionPreference = "Stop"

$SourceApp = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$BuildRoot = "C:\d\capp"
$DistAndroid = Join-Path $SourceApp "dist\android"
$JavaHome = "C:\Program Files\Android\Android Studio\jbr"
$AndroidHome = Join-Path $env:LOCALAPPDATA "Android\Sdk"

if (-not (Test-Path $JavaHome)) { throw "JAVA_HOME not found: $JavaHome" }
if (-not (Test-Path $AndroidHome)) { throw "ANDROID_HOME not found: $AndroidHome" }

$env:JAVA_HOME = $JavaHome
$env:ANDROID_HOME = $AndroidHome
$env:GRADLE_USER_HOME = "C:\g"
$env:Path = "$JavaHome\bin;$AndroidHome\platform-tools;$env:Path"

Write-Host "Syncing sources to $BuildRoot ..."
New-Item -ItemType Directory -Force -Path "C:\d" | Out-Null
if (Test-Path $BuildRoot) {
  cmd /c "rmdir /s /q `"$BuildRoot`"" | Out-Null
}
New-Item -ItemType Directory -Force -Path $BuildRoot | Out-Null
robocopy $SourceApp $BuildRoot /E /XD node_modules android\.gradle android\app\build android\build .git dist /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null

Set-Location $BuildRoot
if (-not (Test-Path "node_modules\react-native")) {
  npm ci --prefer-offline --no-audit --no-fund
}

$sdkEscaped = $AndroidHome -replace '\\', '\\'
Set-Content -Path (Join-Path $BuildRoot "android\local.properties") -Value "sdk.dir=$sdkEscaped"

New-Item -ItemType Directory -Force -Path $DistAndroid | Out-Null
Set-Location (Join-Path $BuildRoot "android")
.\gradlew.bat assembleRelease bundleRelease --no-daemon "-PreactNativeArchitectures=armeabi-v7a,arm64-v8a"
if ($LASTEXITCODE -ne 0) { throw "Gradle release build failed ($LASTEXITCODE)" }

$apk = Get-ChildItem "app\build\outputs\apk\release\*.apk" | Select-Object -First 1
$aab = Get-ChildItem "app\build\outputs\bundle\release\*.aab" | Select-Object -First 1
Copy-Item $apk.FullName (Join-Path $DistAndroid "Drishti-release.apk") -Force
Copy-Item $aab.FullName (Join-Path $DistAndroid "Drishti-release.aab") -Force

Write-Host "Android release artifacts:"
Get-ChildItem $DistAndroid | ForEach-Object {
  Write-Host "  $($_.FullName) ($([math]::Round($_.Length/1MB,1)) MB)"
}
