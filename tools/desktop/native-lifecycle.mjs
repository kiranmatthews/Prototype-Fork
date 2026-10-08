import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const profile = await mkdtemp(path.join(tmpdir(), 'boneman-lifecycle-'));
const out = fileURLToPath(new URL('../../desktop/test-results/', import.meta.url));
await mkdir(out, {recursive:true});
const child = spawn(require('electron'), [fileURLToPath(new URL('./native-lifecycle.cjs', import.meta.url))], {
  env:{...process.env, BONEMAN_USER_DATA:profile}, stdio:['ignore','pipe','pipe'],
});
let stdout = '', stderr = '';
child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-12000); });
child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-12000); });
const timeout = setTimeout(() => child.kill('SIGKILL'), 120000);
try {
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  const report = {status:code === 0 ? 'passed' : 'failed', code, platform:process.platform, arch:process.arch, stdout, stderr};
  await writeFile(path.join(out, 'native-lifecycle.json'), JSON.stringify(report, null, 2) + '\n');
  if (code !== 0) throw new Error('Native lifecycle failed: ' + stdout + stderr);
  console.log('PASS native app hide/restore: simulation stops, resumes, sandbox enabled.');
} finally {
  clearTimeout(timeout);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(profile, {recursive:true, force:true, maxRetries:5, retryDelay:200});
}
