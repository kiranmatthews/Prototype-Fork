import { testGpuArgs, softwareGpuTest } from './test-gpu.mjs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const require = createRequire(new URL('../../desktop/package.json', import.meta.url));
const probe = process.argv.includes('--probe');
const profile = await mkdtemp(path.join(tmpdir(), 'boneman-lifecycle-'));
const out = fileURLToPath(new URL('../../desktop/test-results/', import.meta.url));
await mkdir(out, {recursive:true});
const child = spawn(require('electron'), [...testGpuArgs, fileURLToPath(new URL(probe ? './gpu-probe.cjs' : './native-lifecycle.cjs', import.meta.url))], {
  env:{...process.env, BONEMAN_USER_DATA:profile}, stdio:['ignore','pipe','pipe'],
});
let stdout = '', stderr = '';
child.stdout.on('data', bytes => { stdout = (stdout + bytes).slice(-12000); });
child.stderr.on('data', bytes => { stderr = (stderr + bytes).slice(-12000); });
const timeout = setTimeout(() => child.kill('SIGKILL'), probe ? 30000 : 120000);
try {
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('exit', resolve); });
  const report = {status:code === 0 ? 'passed' : 'failed', code, platform:process.platform, arch:process.arch, softwareGpuTest, stdout, stderr};
  await writeFile(path.join(out, probe ? 'gpu-probe.json' : 'native-lifecycle.json'), JSON.stringify(report, null, 2) + '\n');
  if (code !== 0) throw new Error('Native lifecycle failed: ' + stdout + stderr);
  console.log(probe ? 'PASS native WebGL2 capability: ' + stdout.trim() : 'PASS native app hide/restore: simulation stops, resumes, sandbox enabled.');
} finally {
  clearTimeout(timeout);
  if (child.exitCode === null) child.kill('SIGKILL');
  await rm(profile, {recursive:true, force:true, maxRetries:5, retryDelay:200});
}
