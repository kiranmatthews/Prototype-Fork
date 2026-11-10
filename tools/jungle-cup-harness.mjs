import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import * as THREE from 'three';
import ts from 'typescript';
import { createServer } from 'vite';

// Clear approach lanes on the current Motu course, outside the added street
// features. These still traverse the actual continuous perimeter and collision.
export const PERIMETER_APPROACHES = [
  [[0,.1,25],[0,0,1]], [[0,.1,-145],[0,0,-1]],
  [[58,.1,-42],[1,0,0]], [[-58,.1,-70],[-1,0,0]],
];

export const makeInput = (overrides = {}) => ({
  moveX: 0, moveY: 0, jumpHeld: false, jumpPressed: false, jumpReleased: false,
  grindHeld: false, grindPressed: false, spinHeld: false, spinPressed: false,
  grabHeld: false, grabPressed: false, transferHeld: false, transferPressed: false,
  restartPressed: false,
  consumeEdges() {
    for (const key of Object.keys(this)) if (/Pressed|Released/.test(key)) this[key] = false;
  }, ...overrides,
});

export async function withSkateRuntime(run, options = {}) {
  const fixture = await readFile(new URL('./test-campaign-death-flow.mjs', import.meta.url), 'utf8');
  const ast = ts.createSourceFile('fixture.mjs', fixture, ts.ScriptTarget.Latest, true);
  const dom = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'installHeadlessDom');
  new Function('noop', dom.getText(ast) + '; installHeadlessDom();')(() => {});
  await options.prepareRuntime?.();
  const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });
  const warn = console.warn, error = console.error;
  console.warn = (...a) => { if (!/failed|GLB|procedural skateboard/i.test(String(a[0]))) warn(...a); };
  console.error = (...a) => { if (!/failed|GLB/i.test(String(a[0]))) error(...a); };
  let level;const animationDisposables=[];
  try {
    const { Level, findLevel } = await server.ssrLoadModule('/src/level.ts');
    let { Player } = await server.ssrLoadModule('/src/player.ts');
    // Exercise existing gameplay scenarios with the exact default animation
    // factory as well as their isolated native-controller baselines.
    if(options.animationScheme==='D'||process.env.GAMEPLAY_ANIMATION_SCHEME==='D'){
      const [{GameplayAnimationPresentation,gameplayAnimationDocument},{createCharacterAnimationRuntime},
        {RigBinding,createPlayerStarterAnimationSuite},jak,skate]=await Promise.all([
          server.ssrLoadModule('/src/gameplayAnimationScheme.ts'),server.ssrLoadModule('/src/characterAnimationRuntime.ts'),
          server.ssrLoadModule('/src/animation/index.ts'),
          ...['jak','skate'].map(async name=>JSON.parse(gunzipSync(await readFile(new URL(`../public/motion-study/${name}/motion.json.gz`,import.meta.url))))),
        ]);
      const ink=new THREE.Texture(),BasePlayer=Player;animationDisposables.push(ink);
      Player=class extends BasePlayer{
        constructor(scene){super(scene);
          const rig=RigBinding.fromSculptRuntime(this.animationRig.root).definition;
          animationDisposables.push(createCharacterAnimationRuntime(this,gameplayAnimationDocument(createPlayerStarterAnimationSuite(rig),rig,jak)),
            new GameplayAnimationPresentation(this,scene,{jak,skate,ink}));
        }
      };
    }
    const { CONST, TUNING } = await server.ssrLoadModule('/src/tuning.ts');
    const scene = new THREE.Scene();
    level = new Level(scene, options.levelEntry ?? findLevel('jungle-cup'));
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
    animationDisposables.reverse().forEach(value=>value.dispose());
    level?.dispose();
    await server.close();
    console.warn = warn; console.error = error;
  }
}
