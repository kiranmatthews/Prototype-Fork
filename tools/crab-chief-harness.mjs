import { readFile } from 'node:fs/promises';
import { createServer } from 'vite';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { makeInput } from './jungle-cup-harness.mjs';

export async function withChiefRuntime(run) {
  const fixture = await readFile(new URL('./test-crouch-jump-slam.mjs', import.meta.url), 'utf8');
  const dom = fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nconst held'));
  new Function('noop', dom + '\ninstallHeadlessDom();')(() => {});
  navigator.userAgent='Chief physics fixture';
  globalThis.self=globalThis;
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  const warn = console.warn, error = console.error;
  console.warn = (...args) => { if (!/failed|GLB|procedural skateboard/i.test(String(args[0]))) warn(...args); };
  console.error = (...args) => { if (!/failed|GLB/i.test(String(args[0]))) error(...args); };
  let l;
  const restoreFiles = installChiefAssetFiles();
  try {
    const module = await server.ssrLoadModule('/src/level.ts');
    const { Player } = await server.ssrLoadModule('/src/player.ts');
    const { CRAB_CHIEF_LEVEL } = await server.ssrLoadModule('/src/levels/crab-chief.ts');
    const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
    const scene = new THREE.Scene(); l = new module.Level(scene, { id: 'crab-chief', name: CRAB_CHIEF_LEVEL.name, data: CRAB_CHIEF_LEVEL });
    await l.prepareJungleAssets();
    const {ChiefCamera}=await server.ssrLoadModule('/src/boss/camera.ts');
    const camera=new THREE.PerspectiveCamera(49,16/9,.1,400),bossCamera=new ChiefCamera();
    const p = new Player(scene); p.enterLevel('crab-chief'); p.rawInput = makeInput(); p.respawn(l, true);
    let frame = 0, previous = {}, trace = [];
    const tick = (sample = {}) => {
      const input = chiefInput(sample, previous), consumed = { ...input };
      p.rawInput=input;
      p.step(CONST.fixedStep, input, l); l.update(CONST.fixedStep); p.commitRenderStep(l);bossCamera.restore(camera);bossCamera.apply(camera,l.boss,p.renderPosition,CONST.fixedStep,frame===0);input.consumeEdges();
      frame++; previous = consumed;
      const row = { frame, position: p.pos.toArray(), state: p.state, speed: p.speed, grounded: p.grounded,
        deaths: p.totalDeaths, bailing: p.isBailing, rail: p.grindRail ? l.rails.indexOf(p.grindRail) : null,
        phase: l.boss.phase, boss: l.boss.state, bossTime: l.boss.stateTime, health: l.boss.health,
        playerHealth: l.boss.playerHealth, charge: l.boss.charge, input: sample };
      trace.push(row); return row;
    };
    return await run({ l, p, tick, trace, scene, module, server, camera, bossCamera, source: CRAB_CHIEF_LEVEL, TUNING, get frame() { return frame; } });
  } finally { l?.dispose(); await server.close(); await new Promise(resolve => setImmediate(resolve)); console.warn = warn; console.error = error;restoreFiles(); }
}
export function chiefInput(sample = {}, previous = {}) {
  const input = makeInput(sample);
  const length = Math.hypot(input.moveX, input.moveY); if (length > 1) { input.moveX /= length; input.moveY /= length; }
  for (const held of ['jumpHeld', 'spinHeld', 'grindHeld', 'grabHeld', 'transferHeld']) {
    const pressed = held.replace('Held', 'Pressed'); if (!(pressed in sample)) input[pressed] = !!input[held] && !previous[held];
  }
  if (!('jumpReleased' in sample)) input.jumpReleased = !input.jumpHeld && !!previous.jumpHeld;
  return input;
}

/** Real local Meshy geometry for Node physics tests; texture pixels are reviewed in Chrome. */
export function installChiefAssetFiles() {
  globalThis.self=globalThis;
  const originalLoad = GLTFLoader.prototype.loadAsync;
  GLTFLoader.prototype.loadAsync = async function(url,...args) {
    const file=String(url).match(/(?:^|\/)boss\/([a-z-]+\.glb)$/)?.[1];
    if(!file)return originalLoad.call(this,url,...args);
    navigator.userAgent ??= 'Chief physics fixture';
    const bytes=await readFile(new URL('../public/boss/'+file,import.meta.url));
    return new GLTFLoader().register(()=>({name:'PhysicsWithoutTexturePixels',loadTexture:()=>Promise.resolve(null)}))
      .parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  };
  return () => { GLTFLoader.prototype.loadAsync=originalLoad; };
}
