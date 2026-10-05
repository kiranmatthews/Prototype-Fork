import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { normalizeGameInput } from './blockworks-runner.mjs';
import { makeInput } from './jungle-cup-harness.mjs';

// Production Level and Player, driven by complete device samples. Placement
// is allowed only before a test starts; the pilot never mutates live motion.
export async function withAfterHoursRuntime(run, options = {}) {
  const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
  const dom = fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nconst held'));
  new Function('noop', dom + '\ninstallHeadlessDom();')(() => {});
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  const warn = console.warn, error = console.error;
  console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
  console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
  let level;
  try {
    const { Level, vertRampSpine } = await server.ssrLoadModule('/src/level.ts');
    const { Player } = await server.ssrLoadModule('/src/player.ts');
    const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
    const authored = await server.ssrLoadModule('/src/levels/nightworks-after-hours.ts');
    const source={...authored,AFTER_HOURS_CUTBACK_PATH:vertRampSpine(authored.NIGHTWORKS_AFTER_HOURS_LEVEL.components.find(c=>c.nm==='Four quarry cutbacks')).map(q=>[q.x,q.y,q.z])};
    const scene = new THREE.Scene();
    level = new Level(scene, { id: 'nightworks-after-hours', name: source.NIGHTWORKS_AFTER_HOURS_LEVEL.name, data: source.NIGHTWORKS_AFTER_HOURS_LEVEL });
    level.update(options.timeOffset??0); scene.updateMatrixWorld(true);
    const player = new Player(scene);
    player.enterLevel('nightworks-after-hours');
    player.rawInput = makeInput();
    player.respawn(level,true,false,options.start ? { position: new THREE.Vector3(...options.start), heading: new THREE.Vector3(...(options.heading??[0,0,-1])) } : undefined);
    let last = makeInput(), frame = 0;
    const trace = [];
    const componentOf=object=>{for(let node=object;node;node=node.parent)if(Number.isInteger(node.userData?.editorIdx))return node.userData.editorIdx;return null;};
    const snapshot = () => ({ frame, time:frame*CONST.fixedStep, input:{moveX:last.moveX,moveY:last.moveY,jumpHeld:last.jumpHeld,jumpPressed:last.jumpPressed,jumpReleased:last.jumpReleased,grindHeld:last.grindHeld,grindPressed:last.grindPressed,spinHeld:last.spinHeld,spinPressed:last.spinPressed,grabHeld:last.grabHeld,grabPressed:last.grabPressed,transferHeld:last.transferHeld,transferPressed:last.transferPressed,restartPressed:last.restartPressed}, supportComponent:player.grounded?componentOf(player.groundHit?.mesh):null,railComponent:player.state==='grind'?componentOf(player.grindRail?.object):null, mover:player.groundHit?.moverId??null,heading:player.axisF.toArray(),normal:player.rideNormal.toArray(), position: player.pos.toArray(), state: player.state, grounded: player.grounded,
      speed: player.speed, verticalSpeed: player.vVel, pipe: level.halfpipes.indexOf(player.groundHit?.halfpipe ?? player.hangPipe),
      vertAir: player.vertAir, pipeHang: player.pipeHang, releaseStage: player.vertBoardRelease.stage, bailing: player.isBailing,
      deaths: player.totalDeaths, freeSkate: player.boardRolling, rail: player.grindRail ? level.rails.indexOf(player.grindRail) : null });
    const directionInput = (direction,pace=1) => {
      const f=player.courseInputDirection(level)??player.camDir, length=Math.hypot(direction[0],direction[2])||1, fl=Math.hypot(f.x,f.z)||1;
      return {moveX:(direction[0]*-f.z+direction[2]*f.x)/length/fl*pace,moveY:(direction[0]*f.x+direction[2]*f.z)/length/fl*pace};
    };
    const toward = (target,pace=1) => directionInput([target[0]-player.pos.x,0,target[2]-player.pos.z],pace);
    const tick = (sample = {}) => {
      const cameraForward=level.cameraDirAt(player.pos.x,player.pos.y,player.pos.z);
      if(cameraForward)player.camDir.set(cameraForward.x,0,cameraForward.z);
      const input = normalizeGameInput(sample,last);
      last = { ...input };
      player.step(CONST.fixedStep,input,level);
      level.update(CONST.fixedStep); player.flushLevelCrateRewards(level); player.commitRenderStep(level);
      frame++; const state=snapshot(); trace.push(state); input.consumeEdges(); return state;
    };
    return await run({ source, player, p: player, level, l: level, tick, trace, snapshot, server, directionInput, toward, CONST, TUNING, THREE, scene });
  } finally { level?.dispose(); await server.close(); console.warn=warn;console.error=error; }
}
