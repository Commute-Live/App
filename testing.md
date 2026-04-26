
  Local dev / BT testing

  1. npm run prebuild:dev
  2. npm run ios:dev

  Verify app name: CommuteLive Dev

  If app is old, just (CommuteLive):
  1. npm run prebuild:dev
  2. cd ios && pod install
  3. cd ..
  4. npm run ios:dev

  Before TestFlight

  1. npm run prebuild:prod
  2. Open Xcode
  3. Product -> Archive
  4. Distribute as usual