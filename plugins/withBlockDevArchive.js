const { withXcodeProject } = require('@expo/config-plugins');

const SCRIPT_NAME = '[Guard] Block dev variant from Release/Archive';
const SHELL_SCRIPT = [
  'if [ "$CONFIGURATION" = "Release" ]; then',
  '  case "$PRODUCT_BUNDLE_IDENTIFIER" in',
  '    *.dev)',
  '      echo "error: Refusing to Archive dev variant. Run: npm run prebuild:prod" 1>&2;',
  '      exit 1;;',
  '  esac',
  'fi',
].join('\\n');

module.exports = function withBlockDevArchive(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const targetName = cfg.modRequest.projectName;
    const target = project.pbxTargetByName(targetName);
    if (!target) return cfg;

    const phases = project.hash.project.objects.PBXShellScriptBuildPhase || {};
    const exists = Object.values(phases).some(
      (p) => typeof p === 'object' && p?.name && p.name.includes('Block dev variant'),
    );
    if (exists) return cfg;

    project.addBuildPhase(
      [],
      'PBXShellScriptBuildPhase',
      SCRIPT_NAME,
      target.uuid,
      { shellPath: '/bin/bash', shellScript: SHELL_SCRIPT },
    );

    return cfg;
  });
};
