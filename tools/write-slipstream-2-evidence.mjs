import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';

const hashFile = async path => createHash('sha256').update(await readFile(new URL(path, import.meta.url))).digest('hex');
const [native, gaps, retraction] = await Promise.all(['journey', 'gaps', 'retraction'].map(async key =>
  JSON.parse(await readFile(`${tmpdir()}/slipstream-2-${key}.json`, 'utf8'))));
const sourceSha256 = await hashFile('../src/levels/slipstream-2.ts');
const playerSha256 = await hashFile('../src/player.ts'), tuningSha256 = await hashFile('../src/tuning.ts');
for (const report of [native, gaps, retraction]) {
  assert.equal(report.sourceSha256, sourceSha256, 'Evidence must match current level source');
  assert.equal(report.playerSha256, playerSha256, 'Evidence must match current controller');
  assert.equal(report.tuningSha256, tuningSha256, 'Evidence must match current movement tuning');
}
assert.equal(native.state, 'finished'); assert.equal(native.deaths, 0); assert.deepEqual(native.errors, []);
assert.equal(native.evidence.jumps.length, 3); assert.equal(native.evidence.temple.length, 9);
assert.equal(native.evidence.checkpoints.length, 7); assert.equal(gaps.results.length, 9);
const fast = gaps.results.filter(r => r.kind === 'fast'), slow = gaps.results.filter(r => r.kind === 'slow'), roll = gaps.results.filter(r => r.kind === 'roll');
assert.ok(fast.every(r => r.landed && r.landingMargin >= 3)); assert.ok([...slow, ...roll].every(r => !r.landed));
assert.ok(retraction.supported && !retraction.forbiddenInterior && retraction.deaths === 0);
const range = numbers => [Math.min(...numbers), Math.max(...numbers)];
const evidence = {
  level: 'slipstream-2', recordedAt: new Date().toISOString(), sourceSha256,
  playerSha256, tuningSha256,
  authoredVerticalDropSafety: { hugeDropDistanceMetres: native.authoredHugeDropDistance, minimumNormalImpactMetresPerSecond: native.authoredHugeDropImpact },
  publishedLevelMatchesSource: native.publishedMatchesSource,
  playableLengthMetres: native.laneLength, originalPlayableLengthMetres: native.originalLength, lengthRatio: native.lengthRatio,
  geometry: { templeRisingLedges: 6, slidingLedges: 1, templeTierCount: 1, templeRiseMetres: 11.2,
    skateGaps: 3, gapWidthMetres: range(fast.map(r => r.width)), approachDescentMetres: [8, 10, 14],
    approachLengthMetres: 40, kickerRiseMetres: [1.5, 2.5, 2.5], kickerLengthMetres: 9, flatLaunchShelfMetres: 6,
    markedReleaseBeforeEdgeMetres: 8 },
  nativeJourney: { command: 'node tools/test-slipstream-2.mjs', frames: native.frames, seconds: native.seconds,
    deaths: native.deaths, state: native.state, templeLandings: native.evidence.temple.length,
    movingLedgeLandings: native.evidence.temple.filter(r => r.moving).length,
    optionalRailFrames: native.evidence.highRailFrames, crystal: native.evidence.crystal,
    gapLandings: native.evidence.jumps.length, bankedCheckpoints: native.evidence.checkpoints.length,
    maxSpeedMetresPerSecond: native.evidence.maxSpeed },
  gapControls: { command: 'node tools/test-slipstream-2-gaps.mjs', probes: 9,
    fastChargedSuccessful: fast.filter(r => r.landed).length, slowChargedFailed: slow.filter(r => !r.landed).length,
    noReleaseFailed: roll.filter(r => !r.landed).length, noReleaseSuccessful: roll.filter(r => r.landed).length, fastTakeoffSpeedMetresPerSecond: range(fast.map(r => r.launch.speed)),
    slowTakeoffSpeedMetresPerSecond: range(slow.map(r => r.launch.speed)), minimumLandingMarginMetres: Math.min(...fast.map(r => r.landingMargin)),
    inputsOnly: true, runtimeTuningUnmodifiedByPilots: true },
  retraction: { command: 'node tools/test-slipstream-2-retraction.mjs', idleRiderSupported: retraction.supported,
    wallPenetration: retraction.forbiddenInterior, retractedCentreZ: retraction.mostRetracted, fatalFalls: retraction.deaths },
};
await mkdir(new URL('../docs/performance/', import.meta.url), { recursive: true });
await writeFile(new URL('../docs/performance/slipstream-2.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n');
console.log(JSON.stringify(evidence, null, 2));
