#!/bin/sh
set -e

# Install Node.js dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm install

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
