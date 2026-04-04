#!/bin/sh
set -e

# Install Node.js via Homebrew (not available by default on Xcode Cloud)
brew install node

# Install Node.js dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH"

# Set environment variables for the build
export EXPO_PUBLIC_SERVER_URL="${EXPO_PUBLIC_SERVER_URL:-https://api.commutelive.com}"
export EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID:-790984102356-2d2jhelkf2bugl2kd21moq832qp0276t.apps.googleusercontent.com}"
export EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID="${EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID:-790984102356-sq1leqa8e4c71pb51nmf2gsrl8up0n13.apps.googleusercontent.com}"

npm install

# Install CocoaPods dependencies
cd "$CI_PRIMARY_REPOSITORY_PATH/ios"
pod install
