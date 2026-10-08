import { execFileSync } from 'node:child_process';
import { softwareGpuTest } from './test-gpu.mjs';

const target = process.env.BONEMAN_TARGET_ARCH || process.arch;
let translated = process.platform === 'darwin' && target === 'x64' && process.arch === 'arm64';
if (process.platform === 'darwin' && process.arch === 'x64') {
  try { translated = execFileSync('/usr/sbin/sysctl', ['-in', 'sysctl.proc_translated'], {encoding:'utf8'}).trim() === '1'; }
  catch { /* Native Intel host. */ }
}
export const translatedTest = translated;
export const slowTest = softwareGpuTest || translatedTest;
// Functional checks on emulated CPUs/software GPUs preserve scene/quality.
// These generous deadlines are not release performance acceptance thresholds.
export const testTimeout = slowTest ? 600000 : 120000;
