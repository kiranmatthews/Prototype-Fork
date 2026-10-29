import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
import {execFileSync} from 'node:child_process';

/** Exercise the actual production camera, including its presentation layers. */
export async function createCourseCameraHarness(runtime, aspect=16/10) {
  const deps={THREE:runtime.THREE,level:runtime.l,player:runtime.p};
  for(const name of ['tuning','level','cameraRig','cameraViews','cameraLook','cameraSpeedEffect',
    'skateChaseCamera','skateParkTuning','loopCamera','cameraHeroFraming','boss/camera',
    'carlisleSceneryCollision','boulderChase','race/finishPresentation'])
    Object.assign(deps,await runtime.server.ssrLoadModule(`/src/${name}.ts`));
  const baseline=process.env.SKYSTREAM_DROP_BASELINE;
  const main=baseline?execFileSync('git',['show',`${baseline}:src/main.ts`],{encoding:'utf8'}):
    await readFile(new URL('../src/main.ts',import.meta.url),'utf8');
  if(baseline){
    const old=execFileSync('git',['show',`${baseline}:src/cameraRig.ts`],{encoding:'utf8'}),exports={};
    const code=ts.transpileModule(old,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
    new Function('require','exports',code)(()=>runtime.THREE,exports);
    Object.assign(deps,exports);
  }
  const start=main.indexOf('const camTarget = new THREE.Vector3();');
  const end=main.indexOf('\ncamera.position\n  .copy(player.renderPosition)',start);
  assert.ok(start>=0&&end>start,'Production camera extraction points moved');
  const source=ts.transpileModule(main.slice(start,end),{
    compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
  }).outputText;
  deps.camera=new runtime.THREE.PerspectiveCamera(deps.TUNING.camFov,aspect,.1,1800);
  const factory=new Function('deps',`
    const {${Object.keys(deps).join(',')}}=deps;
    const current={id:'skystream'},worldMapController=null,oceanOverview=false,oceanReview=false;
    const BOULDER_FOV=27,input={lookX:0,lookY:0},window={matchMedia:()=>({matches:false})};
    ${source}
    return {step:updateCamera,camera,heading:camControlDir,cursor:cameraLaneCursor};
  `);
  return factory(deps);
}
