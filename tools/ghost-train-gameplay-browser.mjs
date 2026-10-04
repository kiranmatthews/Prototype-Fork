import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const base=(process.argv.find(arg=>/^https?:/.test(arg))||'http://127.0.0.1:5198/').replace(/\/$/,'');
const out='/private/tmp/ghost-train-gameplay-browser';
await mkdir(out,{recursive:true});

// Reuse the current authored pilots and the exact production-input harness.
// Importing ghost-train-pilot.mjs would also run its standalone headless suite.
const pilotFile=await readFile(new URL('./ghost-train-pilot.mjs',import.meta.url),'utf8');
const pilotBegin=pilotFile.indexOf('const station=');
const pilotEnd=pilotFile.indexOf('const server=await createServer');
assert.ok(pilotBegin>=0&&pilotEnd>pilotBegin,'current authored pilot functions must be present');
const pilotSource=pilotFile.slice(pilotBegin,pilotEnd).replaceAll('export function','function');
const harnessFile=await readFile(new URL('./blockworks-runner.mjs',import.meta.url),'utf8');
const inputBegin=harnessFile.indexOf('const HELD =');
const inputEnd=harnessFile.indexOf('/** Full source-owned');
const inputSource=harnessFile.slice(inputBegin,inputEnd).replace('export function normalizeGameInput','function normalizeGameInput');
const tickBegin=harnessFile.indexOf('const dt = CONST.fixedStep');
const tickEnd=harnessFile.indexOf('return await run(context);',tickBegin)+'return await run(context);'.length;
assert.ok(inputBegin>=0&&inputEnd>inputBegin&&tickBegin>=0&&tickEnd>tickBegin,'native harness factories must be present');
const runnerSource=harnessFile.slice(tickBegin,tickEnd);
const inputFile=await readFile(new URL('./jungle-cup-harness.mjs',import.meta.url),'utf8');
const makeBegin=inputFile.indexOf('export const makeInput =');
const makeEnd=inputFile.indexOf('export async function withSkateRuntime',makeBegin);
assert.ok(makeBegin>=0&&makeEnd>makeBegin,'complete game input factory must be present');
const makeSource=inputFile.slice(makeBegin,makeEnd).replace('export const makeInput','const makeInput');
const sourceHash=createHash('sha256').update(pilotSource+inputSource+runnerSource+makeSource).digest('hex');

const cases=[
  {name:'moving-cart-relay-0',kind:'cart',relay:0},
  {name:'long-crypt-broken-rails',kind:'rail',a:1426,b:1583},
  {name:'swinging-execution-axe',kind:'axe',index:0},
];
const browser=await chromium.launch({headless:true,channel:'chrome'});
const reports=[];
try{
  const page=await browser.newPage({viewport:{width:1280,height:720}});
  const consoleErrors=[];
  page.on('pageerror',error=>consoleErrors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  for(const focused of cases){
    const firstError=consoleErrors.length;
    await page.goto(`${base}/?playtest&level=ghost-train`);
    await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='ghost-train'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
    await page.evaluate(async()=>{await window.__game.getLevel().prepareGhostTrainAssets?.();});
    await page.waitForFunction(()=>{
      const diagnostics=window.__game.getLevel().ghostTrainDiagnostics;
      return diagnostics&&Object.values(diagnostics.scenery.assets).every(asset=>asset.status==='ready')
        &&diagnostics.enemies.every(enemy=>enemy.status==='ready');
    },null,{timeout:120000});
    const result=await page.evaluate(async({focused,pilotSource,inputSource,runnerSource,makeSource})=>{
      const g=window.__game,l=g.getLevel(),p=g.player;
      const THREE=await import('/node_modules/three/build/three.module.js');
      const sourceModule=await import('/src/levels/ghost-train.ts');
      const {CONST,TUNING}=await import('/src/tuning.ts');
      // Block the ordinary animation-loop simulation for this synchronous pilot.
      g.gameFlow.showPause({levelName:l.name??'Haunted Castle · Ghost Train',inWarpRoom:false});
      const assert={
        ok(condition,message='assertion failed'){if(!condition)throw new Error(message);},
        equal(actual,expected,message='values differ'){if(actual!==expected)throw new Error(`${message}: ${JSON.stringify({actual,expected})}`);},
      };
      const pilots=new Function('assert','process',`${pilotSource}\nreturn {runGhostCartRelay,runGhostBrokenRails,runGhostAxe};`)(assert,{env:{}});
      let start,pilot;
      if(focused.kind==='cart'){
        const gap=sourceModule.GHOST_TRAIN_GAPS.filter(gap=>gap.kind==='cart')[focused.relay];
        start=sourceModule.ghostRoutePoint(gap.a-4,.12);
        pilot=r=>pilots.runGhostCartRelay(r,focused.relay);
      }else if(focused.kind==='rail'){
        const rails=sourceModule.GHOST_TRAIN_RAILS.filter(rail=>rail.a>=focused.a&&rail.b<=focused.b);
        assert.ok(rails.length>=3,'long crypt must contain at least three receiving segments');
        start=sourceModule.ghostRoutePoint(focused.a-6,.12);
        pilot=r=>pilots.runGhostBrokenRails(r,rails);
      }else{
        const axe=sourceModule.GHOST_TRAIN_AXES[focused.index];
        start=sourceModule.ghostRoutePoint(18-axe.p[2]-7,.12);
        pilot=r=>pilots.runGhostAxe(r,axe);
      }
      // Exactly one focused initial placement; all subsequent motion comes from
      // normalized held-button samples and native Player/Level fixed steps.
      p.respawn(l,true,false,{position:new THREE.Vector3(...start)});
      const assetsBefore=l.ghostTrainDiagnostics;
      const options={maxFrames:18000,controlFrame:r=>r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1}};
      const nativeRun=new Function('THREE','CONST','TUNING','sourceModule','p','l','options','run',
        `${makeSource}\n${inputSource}\nconst server=null,Level=l.constructor,Player=p.constructor,scene=window.__game.scene,source=sourceModule.GHOST_TRAIN_LEVEL;\nreturn async()=>{${runnerSource}};`
      )(THREE,CONST,TUNING,sourceModule,p,l,options,r=>{
        r.stepFor(20);
        assert.ok(p.grounded,'focused start must settle onto authored collision');
        const initial=r.snapshot(),evidence=pilot(r),final=r.snapshot();
        const stats={frames:r.frame,airborneFrames:r.trace.filter(frame=>frame.state==='air').length,
          grindFrames:r.trace.filter(frame=>frame.state==='grind').length,
          movingSupports:[...new Set(r.trace.map(frame=>frame.mover).filter(id=>id!==null))],
          railCatches:[...new Set(r.trace.map(frame=>frame.rail).filter(id=>id!==null))],
          deaths:p.totalDeaths,actions:r.actions};
        const inputOnly=r.trace.every(frame=>Object.keys(frame.requested).every(key=>
          ['moveX','moveY','jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','transferPressed','restartPressed'].includes(key)));
        assert.ok(inputOnly,'every fixed-step request must contain game input only');
        return{initial,evidence,final,stats,initialPlacementCount:1,inputOnly};
      });
      let outcome;
      try{outcome={ok:true,...await nativeRun()};}
      catch(error){outcome={ok:false,error:error.message,position:p.pos.toArray(),state:p.state,deaths:p.totalDeaths};}
      // Render the actual full-quality game scene with the production renderer.
      // This is presentation-only and never changes player or obstacle state.
      g.scene.updateMatrixWorld(true);
      const camera=new THREE.PerspectiveCamera(58,16/9,.1,220);
      camera.position.set(p.pos.x+9,p.pos.y+8,p.pos.z+15);
      camera.lookAt(p.pos.x,p.pos.y+1,p.pos.z-8);camera.updateMatrixWorld(true);
      const target=new THREE.WebGLRenderTarget(1280,720);target.texture.colorSpace=THREE.SRGBColorSpace;
      const previous=g.renderer.getRenderTarget(),pixels=new Uint8Array(1280*720*4);
      g.renderer.setRenderTarget(target);g.renderer.clear();g.renderer.render(g.scene,camera);
      g.renderer.readRenderTargetPixels(target,0,0,1280,720,pixels);g.renderer.setRenderTarget(previous);target.dispose();
      const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
      const context=canvas.getContext('2d'),image=context.createImageData(1280,720);
      for(let y=0;y<720;y++)image.data.set(pixels.subarray((719-y)*1280*4,(720-y)*1280*4),y*1280*4);
      context.putImageData(image,0,0);
      return{...outcome,assets:assetsBefore.scenery.assets,animatronicsReady:assetsBefore.enemies.filter(enemy=>enemy.status==='ready').length,
        fullRender:true,endpointPng:canvas.toDataURL('image/png').split(',')[1]};
    },{focused,pilotSource,inputSource,runnerSource,makeSource});
    const {endpointPng,...evidence}=result;
    await writeFile(`${out}/${focused.name}.png`,Buffer.from(endpointPng,'base64'));
    const errors=consoleErrors.slice(firstError);
    const report={name:focused.name,...evidence,consoleErrors:errors};
    reports.push(report);
    await writeFile(`${out}/report.json`,JSON.stringify({sourceHash,reports,consoleErrors},null,2));
    assert.equal(result.ok,true,`${focused.name}: ${result.error}`);
    assert.deepEqual(errors,[],`${focused.name}: Chrome console must be clean`);
    console.log(JSON.stringify({name:focused.name,frames:result.stats.frames,deaths:result.stats.deaths,
      airborneFrames:result.stats.airborneFrames,grindFrames:result.stats.grindFrames,
      movingSupports:result.stats.movingSupports,railCatches:result.stats.railCatches,consoleErrors:errors}));
  }
  console.log(JSON.stringify({passed:reports.length,fullRender:true,sourceHash,output:out,consoleErrors}));
}finally{await browser.close();}
