import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
const snapshot = process.argv.find(a => a.startsWith('--source-snapshot='))?.split('=').slice(1).join('=');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true }, plugins: snapshot ? [{
  name: 'recovery-source', enforce: 'pre', async load(id) {
    const rel = path.relative(process.cwd(), id.split('?')[0]);
    if (rel === 'src/character/bailRecoveryMotion.ts') return readFile(path.join(snapshot, rel), 'utf8');
  },
}] : [] });
try {
  const { BailRecoveryMotion } = await server.ssrLoadModule('/src/character/bailRecoveryMotion.ts');
  const motion = new BailRecoveryMotion(), out = new THREE.Quaternion();
  const cases = Array.from({ length: 36 }, (_, i) => ({
    orientation: new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(i) * 3, Math.cos(i * .7) * 3, Math.sin(i * .3) * 3)),
    spin: new THREE.Vector3(Math.sin(i * .3) * 12, Math.cos(i * .7) * 5, Math.sin(i * .4) * 8),
  }));
  const samples = []; let checksum = 0;
  for (let trial = -8; trial < 9; trial++) {
    const start = performance.now();
    for (let incident = 0; incident < 3000; incident++) {
      const c = cases[incident % cases.length]; motion.begin(c.orientation, c.spin, .56);
      for (let frame = 1; frame <= 34; frame++) { motion.sample(frame / 33.6, out); checksum += out.y; }
    }
    if (trial >= 0) samples.push((performance.now() - start) / (3000 * 34));
  }
  samples.sort((a, b) => a - b);
  console.log(JSON.stringify({ source: snapshot ?? 'current', scope: 'Local Node CPU; 9 x 3000 warm recovery incidents with begin plus 34 samples, no render or world queries.',
    medianStepMs: samples[4], samples, checksum }, null, 2));
} finally { await server.close(); }
