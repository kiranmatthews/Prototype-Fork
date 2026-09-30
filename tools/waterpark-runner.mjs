import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { normalizeGameInput } from './blockworks-runner.mjs';
import { makeInput } from './jungle-cup-harness.mjs';

// Production Level and Player, driven by complete device samples. Placement
// is allowed only before a test starts; the pilot never mutates live motion.
export async function withWaterparkRuntime(run, options = {}) {
  const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
  const dom = fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nconst held'));
  new Function('noop', dom + '\ninstallHeadlessDom();')(() => {});
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  const warn = console.warn, error = console.error;
  console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
  console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
  let level;
  try {
    const { Level } = await server.ssrLoadModule('/src/level.ts');
    const { Player } = await server.ssrLoadModule('/src/player.ts');
    const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
    const source = await server.ssrLoadModule('/src/levels/waterpark.ts');
    const scene = new THREE.Scene();
    level = new Level(scene, { id: 'waterpark', name: source.WATERPARK_LEVEL.name, data: source.WATERPARK_LEVEL });
    level.update(0); scene.updateMatrixWorld(true);
    const player = new Player(scene);
    player.enterLevel('waterpark');
    player.rawInput = makeInput();
    player.respawn(level,true,false,options.start ? { position: new THREE.Vector3(...options.start), heading: new THREE.Vector3(0,0,-1) } : undefined);
    let last = makeInput(), frame = 0;
    const trace = [];
    const snapshot = () => ({ frame, position: player.pos.toArray(), state: player.state, grounded: player.grounded,
      speed: player.speed, verticalSpeed: player.vVel, pipe: level.halfpipes.indexOf(player.groundHit?.halfpipe ?? player.hangPipe),
      vertAir: player.vertAir, pipeHang: player.pipeHang, releaseStage: player.vertBoardRelease.stage, bailing: player.isBailing,
      deaths: player.totalDeaths, freeSkate: player.freeSkate, rail: player.grindRail ? level.rails.indexOf(player.grindRail) : null });
    const tick = (sample = {}) => {
      const input = normalizeGameInput(sample,last);
      last = { ...input };
      player.step(CONST.fixedStep,input,level);
      level.update(CONST.fixedStep); player.flushLevelCrateRewards(level); player.commitRenderStep(level);
      frame++; const state=snapshot(); trace.push(state); input.consumeEdges(); return state;
    };
    return await run({ source, player, p: player, level, l: level, tick, trace, snapshot, CONST, TUNING, THREE, scene });
  } finally { level?.dispose(); await server.close(); console.warn=warn;console.error=error; }
}
