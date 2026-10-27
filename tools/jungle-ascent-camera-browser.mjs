import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5418/';
const out=process.env.JUNGLE_CAMERA_OUT||'/private/tmp/jungle-ascent-camera';
const source=await readFile(new URL('../src/levels/jungle-ruins-finale.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {RUINS_CLIMB_LEDGES:ledges}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,runs:[],errors:[],failedAssets:[]};
try{
 for(const mode of (process.env.JUNGLE_CAMERA_MODES||'full-max,full-720,lite-720').split(',')){
  const page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push({mode,error:e.message}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({mode,error:m.text()});});
  page.on('response',r=>{if(r.status()>=400)report.failedAssets.push({mode,url:r.url(),status:r.status()});});
  await page.goto(base+'?playtest&level=jungle'+(mode.startsWith('lite')?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
  await page.evaluate(async native=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(native?null:720);},mode.endsWith('max'));
  const run={mode,stamp:await page.locator('.hud-build').textContent(),samples:[]};report.runs.push(run);
  assert.match(run.stamp,/Codex\/sol fork/);
  // Cover both edges of the 9 m decks as well as the centreline. The ordinary
  // follow camera is never replaced, so this catches trees around the lens.
  const stops=[['turn',[12.5,0,-1360],ledges[0]],...ledges.map(([x,y,w],i)=>['ledge-'+(i+1),[x,y,-1360],ledges[i+1]]),['summit',[175,26.4,-1360],null]];
  for(const offset of [0,3,-3])for(const [name,p,next]of stops){
   await page.evaluate(({p,offset})=>{const g=window.__game;g.gameFlow.hide();g.player.respawn(g.getLevel(),true,true,{position:g.player.pos.clone().fromArray(p).add(g.player.pos.clone().set(0,.08,offset)),heading:g.player.pos.clone().set(1,0,0)});g.player.endlessDeaths=true;},{p,offset});
   await page.waitForTimeout(1100);
   const sample=await page.evaluate(({name,offset,next})=>{
    const g=window.__game,p=g.player,camera=g.camera,l=g.getLevel(),meshes=[];
    l.root.updateMatrixWorld(true);camera.updateMatrixWorld(true);
    l.root.traverse(o=>{if(!o.isMesh||!/(canopy|backdrop|trialsv2tree[ab]|treehousetree|leaf|fern|thicket|groundcover|vine|grove)/i.test(o.userData.jungleAsset??''))return;
      for(let ancestor=o;ancestor;ancestor=ancestor.parent)if(!ancestor.visible)return;
      meshes.push(o);
    });
    const ray=new p.raycaster.constructor(),eye=camera.position.clone();
    const hitInfo=hit=>{
      if(!hit)return null;const m=hit.object.matrixWorld.clone();
      if(hit.instanceId!==undefined){const instance=m.clone();hit.object.getMatrixAt(hit.instanceId,instance);m.multiply(instance);}
      return{asset:hit.object.userData.jungleAsset,instance:hit.instanceId,anchor:p.pos.clone().setFromMatrixPosition(m).toArray(),distance:hit.distance,point:hit.point.toArray()};
    };
    const cast=(target,far)=>{ray.set(eye,target.clone().sub(eye).normalize());ray.near=camera.near;ray.far=far??eye.distanceTo(target)-.15;return hitInfo(ray.intersectObjects(meshes,false)[0]);};
    const targets=[['body',p.pos.clone().add(p.pos.clone().set(0,.8,0))],['head',p.pos.clone().add(p.pos.clone().set(0,1.6,0))]];
    if(next)targets.push(['next-landing',p.pos.clone().set(next[0]-next[2]/2+1.6,next[1]+.3,-1360+offset)]);
    const blocked=targets.flatMap(([target,point])=>{const screen=point.clone().project(camera);if(Math.abs(screen.x)>.95||Math.abs(screen.y)>.95)return[];const hit=cast(point);return hit?[{target,...hit}]:[];});
    const foreground=[];
    for(const x of [-.65,-.325,0,.325,.65])for(const y of [-.25,0,.3,.6]){
      const hit=cast(p.pos.clone().set(x,y,.5).unproject(camera),Math.min(15,eye.distanceTo(p.pos)-2));if(hit)foreground.push({screen:[x,y],...hit});
    }
    return{name,offset,position:p.pos.toArray(),camera:eye.toArray(),grounded:p.grounded,state:p.state,blocked,foreground,resolution:g.renderQualitySettings.regularResolution,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],glError:g.renderer.getContext().getError(),assetErrors:l.jungleAssetDiagnostics.errors};
   },{name,offset,next});
   run.samples.push(sample);
   if(offset===0||sample.blocked.length)await page.screenshot({path:`${out}/${mode}-${name}-${offset}.png`});
   console.log(mode,name,offset,'blocked',sample.blocked.length,'foreground',sample.foreground.length);
  }
  assert.ok(run.samples.every(s=>s.resolution===(mode.endsWith('max')?'max':720)),'requested render resolution');
  await page.close();
 }
 assert.deepEqual(report.errors,[],'browser console');assert.deepEqual(report.failedAssets,[],'asset requests');
 assert.ok(report.runs.every(r=>r.samples.every(s=>s.grounded&&s.glError===0&&s.assetErrors.length===0)),'supported, clean render samples');
 if(process.env.JUNGLE_CAMERA_BASELINE!=='1'){
  assert.ok(report.runs.every(r=>r.samples.every(s=>s.blocked.length===0)),'player and next landing remain visible');
  assert.ok(report.runs.every(r=>r.samples.every(s=>s.foreground.length===0)),'no foliage in the main camera corridor');
 }
 console.log('PASS Jungle ascent ordinary-camera sweep');
}finally{await writeFile(out+'/camera.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
