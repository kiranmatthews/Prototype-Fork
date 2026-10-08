'use strict';
const path = require('node:path');
const { mkdir, copyFile } = require('node:fs/promises');

module.exports = async context => {
  if (context.electronPlatformName !== 'darwin') return;
  // electron-builder deletes these top-level files when creating a Mac app.
  // Preserve the notices from the actual target runtime before that cleanup.
  const runtimeName = context.packager.config.electronBranding?.productName || 'Electron';
  const destination = path.join(context.appOutDir, runtimeName + '.app', 'Contents', 'Resources', 'licenses');
  await mkdir(destination, {recursive:true});
  await copyFile(path.join(context.appOutDir, 'LICENSE'), path.join(destination, 'Electron-LICENSE.txt'));
  await copyFile(path.join(context.appOutDir, 'LICENSES.chromium.html'), path.join(destination, 'Chromium-LICENSES.html'));
};
