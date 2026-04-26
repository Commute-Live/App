Local dev/BT testing:

npm run prebuild:dev 
npm run ios:dev

Before next TestFlight push:
npm run prebuild:prod
Then Xcode → Product → Archive → Distribute as usual.