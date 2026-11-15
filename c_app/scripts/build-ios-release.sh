#!/usr/bin/env bash
# Build iOS Release archive + IPA. Requires macOS + Xcode + CocoaPods.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIST_IOS="$ROOT/dist/ios"
DIST_JS="$ROOT/dist/js/ios"
SCHEME="Drishti"
WORKSPACE="$ROOT/ios/Drishti.xcworkspace"
PROJECT="$ROOT/ios/Drishti.xcodeproj"
ARCHIVE_PATH="$DIST_IOS/Drishti.xcarchive"
EXPORT_PATH="$DIST_IOS/ipa"
EXPORT_PLIST="$DIST_IOS/ExportOptions.plist"

mkdir -p "$DIST_IOS" "$DIST_JS" "$EXPORT_PATH"

cd "$ROOT"
npm ci --prefer-offline --no-audit --no-fund

echo "Bundling JS for iOS..."
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$DIST_JS/main.jsbundle" \
  --assets-dest "$DIST_JS"

cd "$ROOT/ios"
if command -v pod >/dev/null 2>&1; then
  pod install
else
  echo "CocoaPods (pod) not found. Install with: sudo gem install cocoapods" >&2
  exit 1
fi

if [[ ! -f "$EXPORT_PLIST" ]]; then
  cat > "$EXPORT_PLIST" <<'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>method</key>
  <string>development</string>
  <key>compileBitcode</key>
  <false/>
  <key>signingStyle</key>
  <string>automatic</string>
</dict>
</plist>
EOF
fi

BUILD_TARGET="$WORKSPACE"
BUILD_FLAG="-workspace"
if [[ ! -d "$WORKSPACE" ]]; then
  BUILD_TARGET="$PROJECT"
  BUILD_FLAG="-project"
fi

echo "Archiving $SCHEME..."
xcodebuild \
  $BUILD_FLAG "$BUILD_TARGET" \
  -scheme "$SCHEME" \
  -configuration Release \
  -destination "generic/platform=iOS" \
  -archivePath "$ARCHIVE_PATH" \
  clean archive \
  CODE_SIGN_STYLE=Automatic \
  -allowProvisioningUpdates

echo "Exporting IPA..."
xcodebuild -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$EXPORT_PLIST" \
  -allowProvisioningUpdates

echo "iOS artifacts:"
ls -lh "$ARCHIVE_PATH" "$EXPORT_PATH" || true
find "$EXPORT_PATH" -name "*.ipa" -print
