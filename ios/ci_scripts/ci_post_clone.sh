#!/bin/sh
set -e

# Install Node.js via Homebrew (not available by default on Xcode Cloud)
brew install node

# Install Node.js dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
