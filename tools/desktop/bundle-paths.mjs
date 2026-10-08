import path from 'node:path';
import { fileURLToPath } from 'node:url';
export function bundlePaths() {
  const release = fileURLToPath(new URL('../../desktop/release/', import.meta.url));
  if (process.platform === 'darwin') {
    const app = path.join(release, process.arch === 'arm64' ? 'mac-arm64' : 'mac', 'BONEMAN.app');
    return { root:app, binary:path.join(app, 'Contents/MacOS/BONEMAN'), archive:path.join(app, 'Contents/Resources/app.asar'), fuses:app };
  }
  const root = path.join(release, process.platform === 'win32' ? 'win-unpacked' : 'linux-unpacked');
  const binary = path.join(root, process.platform === 'win32' ? 'BONEMAN.exe' : 'boneman');
  return { root, binary, archive:path.join(root, 'resources/app.asar'), fuses:binary };
}
