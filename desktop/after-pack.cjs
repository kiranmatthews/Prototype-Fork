'use strict';
const path = require('node:path');
module.exports = async context => {
  const { flipFuses, FuseVersion, FuseV1Options } = await import('@electron/fuses');
  const platform = context.electronPlatformName;
  const name = context.packager.appInfo.productFilename;
  const binary = platform === 'darwin' ? path.join(context.appOutDir, name + '.app') :
    path.join(context.appOutDir, platform === 'win32' ? name + '.exe' : context.packager.executableName);
  await flipFuses(binary, {
    version:FuseVersion.V1,
    [FuseV1Options.RunAsNode]:false,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]:false,
    [FuseV1Options.EnableNodeCliInspectArguments]:false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]:platform === 'darwin' || platform === 'win32',
    [FuseV1Options.OnlyLoadAppFromAsar]:true,
  });
};
