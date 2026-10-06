/** Reproduce the isolated actual-character breakup CPU comparison.
 * node tools/profile-break-apart.mjs [--baseline-ref=<git ref>] [--out=<json>]
 * Rendering, controller physics and end-to-end frame time are not measured.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile, unlink, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const option = key => process.argv.find(arg => arg.startsWith(`--${key}=`))?.slice(key.length + 3);
const baselineRef = option('baseline-ref') ?? 'ba562b63d8b6684a0df0ae1f707b5c7a32095e68';
const out = resolve(root, option('out') ?? 'docs/performance/wipeout-breakup.json');
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 2e6 }).trim();
const baselineCommit = git('rev-parse', `${baselineRef}^{commit}`);
const source = git('show', `${baselineCommit}:src/character/breakApart.ts`);
// Sibling placement lets relative imports resolve at their original location.
// The exclusive temporary file is always removed, even after failed loading.
const tempPath = resolve(root, `src/character/.break-apart-profile-${process.pid}.ts`);
await writeFile(tempPath, source, { flag: 'wx' });
try {
  await withSkateRuntime(async ({ THREE, server, Player, Level, CONST }) => {
    const Old = (await server.ssrLoadModule(tempPath)).CharacterBreakApart;
    const New = (await server.ssrLoadModule('/src/character/breakApart.ts')).CharacterBreakApart;
    const fixtures = [];
    try {
      for (const C of [Old, New]) {
        const scene = new THREE.Scene();
        const level = new Level(scene, { id: 'debris-bench', name: 'Debris bench', data: {
          v: 1, name: 'Debris bench', spawn: [0, .04, 0], killY: -30, components: [
            { t: 'platform', p: [0, -.5, 0], s: [80, 1, 80], edgeGrinding: false },
            { t: 'gate', p: [0, 0, -30] },
          ],
        }});
        const player = new Player(scene); player.rawInput = makeInput(); player.respawn(level, true);
        player.step(CONST.fixedStep, makeInput(), level);
        fixtures.push({ player, level, debris: new C(player.bodyGroup) });
      }
      const measure = (fixture, settled) => {
        const { debris, player, level } = fixture;
        debris.reset();
        debris.request('air', new THREE.Vector3(12, 0, -5), true, player.groundHit, { style: 'yard-sale', seed: 42 });
        const step = () => { debris.restore(); debris.step(1 / 120, level, false, 10, true); };
        // Launch resets counters before the measured phase. Settling is outside
        // the settled timing window; capture/launch belongs to neither sample.
        for (let i = 0; i < (settled ? 650 : 1); i++) step();
        const probes = debris.diagnostics.probes;
        const steps = settled ? 2400 : 120;
        const start = performance.now();
        for (let i = 0; i < steps; i++) step();
        return { microsecondsPerStep: (performance.now() - start) * 1000 / steps,
          probes: debris.diagnostics.probes - probes, steps };
      };
      for (let i = 0; i < 5; i++) for (const fixture of fixtures) { measure(fixture, false); measure(fixture, true); }
      const results = {};
      for (const settled of [false, true]) {
        const samples = [];
        for (let i = 0; i < 7; i++) samples.push(fixtures.map(fixture => measure(fixture, settled)));
        const summaries = fixtures.map((_, index) => {
          const times = samples.map(row => row[index].microsecondsPerStep).sort((a, b) => a - b);
          return { medianMicrosecondsPerStep: times[3], minMicrosecondsPerStep: times[0], maxMicrosecondsPerStep: times[6],
            probes: samples[0][index].probes, steps: samples[0][index].steps };
        });
        results[settled ? 'settled' : 'active'] = { baseline: summaries[0], current: summaries[1],
          medianReductionPercent: 100 * (1 - summaries[1].medianMicrosecondsPerStep / summaries[0].medianMicrosecondsPerStep) };
      }
      const evidence = {
        generatedAt: new Date().toISOString(), baselineCommit, currentHead: git('rev-parse', 'HEAD'),
        measuredSource: 'src/character/breakApart.ts from working tree',
        baselineSourceSha256: createHash('sha256').update(source).digest('hex'),
        currentSourceSha256: createHash('sha256').update(await readFile(resolve(root, 'src/character/breakApart.ts'))).digest('hex'),
        node: process.version,
        platform: process.platform, arch: process.arch, fixedStep: 1 / 120, warmups: 5, runs: 7,
        fixture: 'Two actual Player.bodyGroup rigs on identical 80m platforms, nine-part yard-sale, restore + step',
        limitations: [
          'CPU-only headless presentation microbenchmark; excludes renderer, controller physics, incident capture and launch.',
          'Both implementations use the current character geometry and runtime; baseline restores only breakApart.ts.',
          'Different contact solvers and settling trajectories are intentional. Wall-clock timings vary by machine and load.',
          'Performance claims use measured medians, not a pass/fail timing threshold.',
        ], results,
      };
      await mkdir(dirname(out), { recursive: true });
      await writeFile(out, `${JSON.stringify(evidence, null, 2)}\n`);
      console.log(JSON.stringify({ output: out, ...evidence }, null, 2));
    } finally { for (const fixture of fixtures) { fixture.debris.reset(); fixture.level.dispose(); } }
  });
} finally { await unlink(tempPath); }
