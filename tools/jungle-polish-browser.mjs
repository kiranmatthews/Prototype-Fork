import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5417/';
const out=process.env.JUNGLE_POLISH_OUT||'/private/tmp/jungle-polish';
const normalOnly=process.env.JUNGLE_POLISH_NORMAL_ONLY==='1';
const liveResize=process.env.JUNGLE_POLISH_LIVE_RESIZE==='1';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,mode:process.env.JUNGLE_POLISH_LITE==='1'?'lite':'full',normalOnly,liveResize,views:[],normalViews:[],swims:[],errors:[],failedAssets:[]};
let page;
async function openReviewPage(native){
 const next=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'});
 next.on('pageerror',e=>report.errors.push(e.message));
 next.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
 next.on('response',r=>{if(r.status()>=400)report.failedAssets.push({url:r.url(),status:r.status()})});
 await next.goto(base+'?playtest&level=jungle'+(process.env.JUNGLE_POLISH_LITE==='1'?'&lite':''));
 await next.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
 console.log('Supported Jungle spawn loaded');
 await next.evaluate(async native=>{const g=window.__game;await g.getLevel().prepareJungleAssets();g.campaign.startEphemeral();
   g.renderQualitySettings.setRegularResolution(native?null:720);
   const render=g.renderer.render.bind(g.renderer);
   g.renderer.render=(...args)=>{if(args[1]===g.camera&&window.__reviewView){g.camera.position.fromArray(window.__reviewView.eye);g.camera.lookAt(...window.__reviewView.target);g.camera.updateMatrixWorld(true)}return render(...args)};
 },native);
 console.log('Native Jungle assets prepared');
 return next;
}
try {
 page=await openReviewPage(!normalOnly);
 const sample=()=>page.evaluate(()=>{const g=window.__game,p=g.player;return{position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths}});
 for(const offset of normalOnly||process.env.JUNGLE_POLISH_GALLERY_ONLY==='1'?[]:[-6,6]){
  await page.evaluate(offset=>{const g=window.__game,l=g.getLevel(),c=l.captureData().components.find(c=>c.nm==='Jungle cove beach and seabed');
   const ray=new g.player.raycaster.constructor(g.player.pos.clone().set(c.p[0]+offset,20,18),g.player.pos.clone().set(0,-1,0));
   const ground=ray.intersectObjects(l.groundMeshes,false)[0];if(!ground)throw Error('missing dry sand');
   g.player.respawn(l,true,false,{position:ground.point.clone().add(g.player.pos.clone().set(0,.06,0)),heading:g.player.camDir.clone().set(0,0,-1)});g.player.endlessDeaths=true;},offset);
  await page.waitForFunction(()=>window.__game.player.grounded);
  const before=await sample();
  await page.keyboard.down('ArrowDown');
  await page.waitForFunction(()=>window.__game.player.state==='swim',null,{timeout:20000});const entry=await sample();
  await page.waitForFunction(z=>window.__game.player.pos.z>z+4,entry.position[2],{timeout:20000});
  await page.keyboard.up('ArrowDown');const deep=await sample();
  await page.screenshot({path:`${out}/swim-${offset}.png`});
  await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.pos.z<19,null,{timeout:30000});
  await page.keyboard.up('ArrowUp');const returned=await sample();
  assert.equal(returned.deaths,before.deaths);report.swims.push({offset,before,entry,deep,returned});
 }
 const views=[
  ['cove',[4,2.4,13],[3,17,6],[4,0,40]],
  ['shore',[4,2,22],[28,12,46],[2,0,18]],
  ['temple',[0,.1,-314],[0,7,-315],[0,7,-350]],
  ['terrace',[0,11.6,-406],[0,17,-395],[0,12,-424]],
  ['aqueduct',[0,.1,-774],[0,9,-755],[0,0,-820]],
  ['takeoff',[0,3,-833],[0,10,-825],[0,1,-855]],
  ['ascent',[83,13.3,-1360],[85,22,-1342],[90,14,-1360]],
  ['summit',[175,26.5,-1360],[158,39,-1333],[177,29,-1360]],
 ];
 for(const [name,p,eye,target] of views){
  if(normalOnly)break;
  if(process.env.JUNGLE_POLISH_VIEWS&&!process.env.JUNGLE_POLISH_VIEWS.split(',').includes(name))continue;
  await page.evaluate(({p,eye,target})=>{const g=window.__game;g.player.respawn(g.getLevel(),true,true,{position:g.player.pos.clone().fromArray(p),heading:g.player.pos.clone().set(0,0,-1)});window.__reviewView={eye,target};},{p,eye,target});
  await page.waitForTimeout(1800);
  const stats=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return{resolution:g.renderQualitySettings.regularResolution,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],frame:g.getRenderFrameStats(),assetErrors:l.jungleAssetDiagnostics.errors,position:g.player.pos.toArray(),grounded:g.player.grounded,glError:g.renderer.getContext().getError()}});
  await page.screenshot({path:`${out}/${name}.png`});report.views.push({name,...stats});
  console.log('Reviewed MAX/native view:',name);
 }
 // Review normal 720p presentation with a fresh renderer and game camera.
 if(!normalOnly){
  if(liveResize)await page.evaluate(()=>window.__game.renderQualitySettings.setRegularResolution(720));
  else{await page.close();page=await openReviewPage(false);}
 }
 for(const [name,p] of [['shore-720',[4,2.4,13]],['play-aqueduct',[0,.1,-774]],['play-ascent',[83,13.3,-1360]]]){
  await page.evaluate(({name,p})=>{const g=window.__game;
   window.__reviewView=name==='shore-720'?{eye:[3,17,6],target:[4,0,40]}:null;
   g.player.respawn(g.getLevel(),true,true,{position:g.player.pos.clone().fromArray(p),heading:g.player.pos.clone().set(p[0]>20?1:0,0,p[0]>20?0:-1)});},{name,p});
  await page.waitForTimeout(1800);
  report.normalViews.push(await page.evaluate(name=>{const g=window.__game;return{name,resolution:g.renderQualitySettings.regularResolution,frame:g.getRenderFrameStats(),glError:g.renderer.getContext().getError()};},name));
  await page.screenshot({path:`${out}/${name}.png`});
 }
 report.stamp=await page.locator('.hud-build').textContent();
 assert.match(report.stamp,/Codex\/sol fork/);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failedAssets,[]);
 assert.ok(report.views.every(v=>v.resolution==='max'&&v.grounded&&v.glError===0&&v.assetErrors.length===0));
 assert.ok(report.normalViews.every(v=>v.resolution===720&&v.glError===0));
 console.log('PASS Jungle polish gallery, clean console, assets and WebGL');
}catch(error){report.failure=await page?.evaluate(()=>{const g=window.__game,p=g?.player;if(!p)return null;const l=g.getLevel();const ray=new p.raycaster.constructor(p.pos.clone().setY(20),p.pos.clone().set(0,-1,0));return{position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,blocked:g.gameFlow.blocksGameplay,ground:ray.intersectObjects(l.groundMeshes,false).slice(0,5).map(h=>({point:h.point.toArray(),name:h.object.name})),cove:l.captureData().components.find(c=>c.nm==='Jungle cove beach and seabed')?.p}}).catch(()=>null);await page?.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;
}finally{await writeFile(out+'/gallery.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
