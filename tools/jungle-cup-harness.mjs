import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import { createServer } from 'vite';

export const makeInput = (overrides = {}) => ({
  moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
  grindHeld: false, grindPressed: false, spinHeld: false, spinPressed: false,
  grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false,
  restartPressed: false,
  consumeEdges() {
    for (const key of Object.keys(this)) if (/Pressed|Released/.test(key)) this[key] = false;
  }, ...overrides,
});

export async function withSkateRuntime(run) {
  const fixture = await readFile(new URL('./test-campaign-death-flow.mjs', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('fixture.mjs', fixture, ts.ScriptTarget.Latest, true);
  const dom = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'installHeadlessDom');
  new Function('noop', dom.getText(ast) + '; installHeadlessDom();')(() => {});
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  const warn = console.warn, error = console.error;
  console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
  console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
  let level;
  try {
    const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
    const { Player } = await server.ssrLoadModule('/src/player.ts');
    const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
    const scene = new THREE.Scene();
    level = new Level(scene, findLevel('jungle-cup'));
    scene.updateMatrixWorld(true);
    const player = new Player(scene);
    player.competitionMode = true;
    player.endlessDeaths = true;
    player.rawInput = makeInput();
    player.respawn(level, true);
    const step = input => {
      player.step(CONST.fixedStep, input, level);
      level.update(CONST.fixedStep);
      input.consumeEdges();
    };
    await run({ THREE, server, scene, Level, Player, level, player, CONST, TUNING, step });
  } finally {
    level?.dispose();
    await server.close();
    console.warn = warn; console.error = error;
  }
}
