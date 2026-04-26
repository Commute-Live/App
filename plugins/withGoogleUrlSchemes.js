const { withInfoPlist } = require('@expo/config-plugins');

const GOOGLE_URL_SCHEMES = [
  'com.googleusercontent.apps.790984102356-l6hiv8it79uvbeb65s17te3u61dfltft',
  'com.googleusercontent.apps.790984102356-sq1leqa8e4c71pb51nmf2gsrl8up0n13',
];

module.exports = function withGoogleUrlSchemes(config) {
  return withInfoPlist(config, (cfg) => {
    const infoPlist = cfg.modResults;
    const urlTypes = Array.isArray(infoPlist.CFBundleURLTypes) ? infoPlist.CFBundleURLTypes : [];

    for (const scheme of GOOGLE_URL_SCHEMES) {
      const exists = urlTypes.some((entry) => {
        const schemes = Array.isArray(entry?.CFBundleURLSchemes) ? entry.CFBundleURLSchemes : [];
        return schemes.includes(scheme);
      });

      if (!exists) {
        urlTypes.push({
          CFBundleURLSchemes: [scheme],
        });
      }
    }

    infoPlist.CFBundleURLTypes = urlTypes;
    return cfg;
  });
};
