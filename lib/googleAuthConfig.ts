const DEFAULT_GOOGLE_WEB_CLIENT_ID = '790984102356-2d2jhelkf2bugl2kd21moq832qp0276t.apps.googleusercontent.com';
const DEFAULT_GOOGLE_IOS_CLIENT_ID = '790984102356-sq1leqa8e4c71pb51nmf2gsrl8up0n13.apps.googleusercontent.com';
const DEFAULT_GOOGLE_ANDROID_CLIENT_ID = '790984102356-s7pn4glo6n6rp097n240jnu3044imc1p.apps.googleusercontent.com';

function getConfiguredValue(value: string | undefined, fallback: string) {
  return value?.trim() ? value : fallback;
}

export const googleAuthConfig = {
  webClientId: getConfiguredValue(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, DEFAULT_GOOGLE_WEB_CLIENT_ID),
  iosClientId: getConfiguredValue(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, DEFAULT_GOOGLE_IOS_CLIENT_ID),
  androidClientId: getConfiguredValue(
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    DEFAULT_GOOGLE_ANDROID_CLIENT_ID,
  ),
};
