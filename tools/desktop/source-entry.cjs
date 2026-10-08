'use strict';
// Private parent/child test channel; this file is never packaged, and the
// renderer receives no bridge. Quit follows the production shutdown handlers.
const { app } = require('electron');
const path = require('node:path');
app.setAppPath(path.resolve(__dirname, '../../desktop'));
process.on('message', message => {
  if (message === 'boneman-test-quit') app.quit();
});
require('../../desktop/main.cjs');
