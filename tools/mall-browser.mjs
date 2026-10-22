import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5275';
const full=process.argv.includes('--full'),inspect=process.argv.includes('--inspect'),pauses=process.argv.includes('--visual-pauses'),route=process.argv.find(a=>a.startsWith('--route='))?.split('=')[1]??'main';
const tag=`${full?'full':'lite'}-${route}${pauses?'-inspection':''}`,out='/private/tmp/mall-recreation';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mall';export {createMallPilot,createMallPlanterPilot} from './tools/mall-pilot.mjs';export {Raycaster,Vector3} from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1440,height:900},serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mall-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mall${full?'':'&lite'}`,{timeout:120000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mall'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 await page.waitForTimeout(1200);await page.screenshot({path:`${out}/${tag}-spawn.png`});
 const initial=await page.evaluate(()=>{const g=window.__game,p=g.player;return{position:p.pos.toArray(),state:p.state,grounded:p.grounded,skatepark:g.getLevel().skatepark,components:g.getCurrentLevel().data.components.length};});console.log(JSON.stringify({initial,errors}));
 if(!inspect){
 await page.evaluate(async route=>{
  const {source,createMallPilot,createMallPlanterPilot,Raycaster,Vector3}=await import('/mall-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),pilot=route==='planter'?createMallPlanterPilot(source,{fromSpawn:true}):createMallPilot(source,{route});
  const canonical=o=>JSON.stringify(o,(_k,v)=>typeof v==='number'?Math.round(v*1e7)/1e7:v);
  const expected=canonical(source.MALL_LEVEL),actual=canonical(g.getCurrentLevel().data);
  const r=window.mallReview={done:false,error:null,frames:0,progress:pilot.progress,evidence:pilot.evidence,initialTuning:JSON.stringify(g.TUNING),sourceMatches:expected===actual};
  if(!r.sourceMatches){const i=Array.from(expected).findIndex((v,i)=>actual[i]!==v);r.sourceMismatch={index:i,expected:expected.slice(i-90,i+150),actual:actual.slice(i-90,i+150)};throw Error('Browser loaded a stale Mall snapshot: '+JSON.stringify(r.sourceMismatch));}
  let sample={};const update=g.input.update.bind(g.input),step=p.step.bind(p);
  const render=g.renderer.render.bind(g.renderer);r.fountainCamera=[];r.entryCamera=[];r.entryObstructions=[];
  const sightRay=new Raycaster(),focus=new Vector3(),eyeDirection=new Vector3();r.fountainViewSamples=0;r.fountainObstructions=[];
  const cap=source.MALL_LEVEL.components.find(c=>c.nm==='Fountain monument cap');r.fountainCapBottom=cap.p[1]-cap.s[1]/2;
  g.renderer.render=(scene,camera)=>{
   render(scene,camera);
   if(scene===g.scene&&r.progress>=6&&r.progress<=34){
    focus.copy(p.renderPosition);focus.y+=1.25;eyeDirection.subVectors(camera.position,focus);
    sightRay.set(focus,eyeDirection.clone().normalize());sightRay.near=.15;sightRay.far=eyeDirection.length()-.2;
    const hit=sightRay.intersectObjects(l.groundMeshes,false)[0];
    if(hit)r.entryObstructions.push({s:r.progress,name:hit.object.name,distance:hit.distance});
    r.entryCamera.push({s:r.progress,eye:camera.position.toArray(),subject:p.renderPosition.toArray(),distance:camera.position.distanceTo(p.renderPosition)});
   }
   if(scene===g.scene&&['upper','upper-fast'].includes(route)&&r.progress>=67&&r.progress<=92){
    r.fountainViewSamples++;focus.copy(p.renderPosition);focus.y+=1.25;eyeDirection.subVectors(camera.position,focus);
    sightRay.set(focus,eyeDirection.clone().normalize());sightRay.near=.15;sightRay.far=eyeDirection.length()-.2;
    const hit=sightRay.intersectObjects(l.groundMeshes,false)[0];
    if(hit)r.fountainObstructions.push({s:r.progress,name:hit.object.name,distance:hit.distance,eye:camera.position.toArray(),subject:p.renderPosition.toArray()});
   }
   if(scene===g.scene&&['upper','upper-fast'].includes(route)&&r.progress>=73.2&&r.progress<=78.8){
    const bounds=p.cameraPoseBounds;
    r.fountainCamera.push({s:r.progress,eye:camera.position.toArray(),subject:p.renderPosition.toArray(),distance:camera.position.distanceTo(p.renderPosition),
     headY:bounds?.max.y??null,feetY:bounds?.min.y??null});
   }
  };
  g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};return{id:'Mall validation controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
  p.step=(dt,input,level)=>{
   if(r.done||r.paused)return;
   try{sample=pilot.sample(p,l);update();step(dt,input,level);pilot.observe(p,l);r.frames++;r.progress=pilot.progress;r.position=p.pos.toArray();r.state=p.state;r.grounded=p.grounded;r.deaths=p.totalDeaths;if(p.state==='finished'||pilot.done)r.done=true;}
   catch(e){r.error=String(e);r.done=true;}
   if(r.done)r.finalTuning=JSON.stringify(g.TUNING);
  };
 },route);
 const shots=new Set();
 for(let i=0;i<900;i++){
  await page.waitForTimeout(250);
  const r=await page.evaluate(()=>({progress:window.mallReview.progress,done:window.mallReview.done}));
  for(const [s,name]of [[-67,'entry-upper'],[-54,'entry-gold-quarter'],[-38,'entry-return'],[-20,'entry-blue-quarter'],[7,'entry-lower'],[25,'entry-doors'],[50,'entrance-trough'],[62,'fountain'],[69,'fountain-approach'],[76,'fountain-passage'],[85,'fountain-landing'],[109,'second-escalator'],[120,'gallery'],[165,'atrium'],[215,'escalator'],[285,'crossrails'],[345,'plaza'],[353,'blue-banks'],[377,'exit-overpass'],[384,'exit-throat'],[391,'stairs']])
   if(r.progress>=s&&!shots.has(name)){
    shots.add(name);
    if(pauses){await page.evaluate(()=>{window.mallReview.paused=true;});await page.waitForTimeout(900);}
    await page.screenshot({path:`${out}/${tag}-${name}.png`});
    if(pauses){console.log(JSON.stringify(await page.evaluate(name=>{const g=window.__game;return{name,position:g.player.pos.toArray(),camera:g.camera.position.toArray(),state:g.player.state,progress:window.mallReview.progress};},name)));await page.evaluate(()=>{window.mallReview.paused=false;});}
   }
  if(r.done)break;
 }
 const report=await page.evaluate(()=>window.mallReview);await page.screenshot({path:`${out}/${tag}-finish.png`});
 if(report.entryCamera.length){
  await writeFile(`${out}/${tag}-entry-camera.json`,JSON.stringify(report.entryCamera,null,2));
  report.entryCamera={samples:report.entryCamera.length,minimumDistance:Math.min(...report.entryCamera.map(v=>v.distance))};
 }
 if(report.fountainCamera.length){
  await writeFile(`${out}/${tag}-camera.json`,JSON.stringify(report.fountainCamera,null,2));
  report.fountainCamera={samples:report.fountainCamera.length,minimumDistance:Math.min(...report.fountainCamera.map(v=>v.distance)),maximumHeadY:Math.max(...report.fountainCamera.map(v=>v.headY??0))};
 }
 await writeFile(`${out}/${tag}-browser.json`,JSON.stringify({initial,report,errors},null,2));console.log(JSON.stringify({report:{...report,initialTuning:undefined,finalTuning:undefined},errors},null,2));
 assert.ok(report.entryCamera.samples>=30&&report.entryCamera.minimumDistance>3&&report.entryObstructions.length===0,'The lower entrance must retain a clear camera view');
 assert.equal(report.error,null);assert.equal(report.state,route==='planter'?'grind':'finished');assert.equal(report.deaths,0);assert.equal(report.sourceMatches,true);assert.equal(report.initialTuning,report.finalTuning);
 if(route==='planter'){assert.ok(report.evidence.laps>2&&report.evidence.seams>=2&&!report.evidence.bailed&&report.evidence.peakSpeed>20);}
 else assert.ok(report.evidence.railNames.some(name=>name.startsWith('Crossrail ')));
 if(['upper','upper-fast','car','escalator'].includes(route)){
  assert.ok(report.evidence.railNames.includes('Suspended upper light rail'));
  assert.ok(report.evidence.crystal);
  assert.ok(report.evidence.jumps.some(j=>j.name==='Hidden rail reward ollie'));
  assert.ok(report.evidence.upperTransfer?.frames>=10,'The beam transfer must settle into a sustained grind on the opposite rail');
 }
 if(route==='upper'){
  assert.ok(report.evidence.fountainLandingFrames>=2);
  for(const name of ['Fountain entry','Fountain exit'])assert.ok(report.evidence.jumps.some(j=>j.name===name&&j.air));
 }
 if(['upper','upper-fast'].includes(route)){
  assert.ok(report.fountainCamera.samples>=3&&report.fountainCamera.minimumDistance>5,'The fountain camera must retain a useful view of the skater');
  assert.ok(report.fountainCamera.maximumHeadY<report.fountainCapBottom-.1,'The rendered skater must clear the monument cap');
  assert.ok(report.fountainViewSamples>=15&&report.fountainObstructions.length===0,'The approach and passage must retain a clear sightline to the skater');
 }
 if(route==='coffee'){
  assert.ok(report.evidence.railNames.includes('Coffee Grind'));
  assert.ok(report.evidence.railNames.includes('Suspended lower light rail'));
 }
 }
 assert.deepEqual(errors,[]);
}finally{await browser.close();}
