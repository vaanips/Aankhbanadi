Drishti iOS release
===================

This machine is Windows, so a native IPA cannot be produced here.
JS bundle for iOS is already prepared at:

  dist/js/ios/main.jsbundle

To build the IPA on a Mac with Xcode + CocoaPods:

  1. Copy the c_app folder to the Mac (or clone the repo).
  2. Open Terminal in c_app.
  3. Run:
       chmod +x scripts/build-ios-release.sh
       ./scripts/build-ios-release.sh

  Or manually:
       npm ci
       cd ios && pod install && cd ..
       npx react-native run-ios --mode Release
       # Archive in Xcode: Product > Archive > Distribute App

Outputs land in:
  dist/ios/Drishti.xcarchive
  dist/ios/ipa/*.ipa

Signing:
  - Apple Developer account required for device/TestFlight/App Store.
  - ExportOptions.plist defaults to method=development; change to
    ad-hoc / app-store-connect as needed.
