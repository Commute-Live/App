// Safe wrapper for @react-native-google-signin/google-signin
// Falls back gracefully when native module is unavailable (e.g. Expo Go)

let GoogleSignin: any = null;
let statusCodes: any = {};
let isAvailable = false;

try {
  const mod = require('@react-native-google-signin/google-signin');
  GoogleSignin = mod.GoogleSignin;
  statusCodes = mod.statusCodes;
  isAvailable = true;
} catch {
  GoogleSignin = {
    configure: () => {},
    hasPlayServices: async () => false,
    signIn: async () => {
      throw new Error('Google Sign-In is not available in this environment');
    },
    signOut: async () => {},
  };
}

export {GoogleSignin, statusCodes, isAvailable as isGoogleSignInAvailable};
