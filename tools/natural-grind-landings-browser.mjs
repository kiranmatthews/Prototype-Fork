// Native keyboard/Input/Player validation on the shipped, authored rails.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5377').replace(/\/$/,'');
const output=process.env.GRIND_LANDING_OUTPUT||'/private/tmp/natural-grind-browser';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1280,height:720}});
await page.addInitScript(()=>{navigator.getGamepads=()=>[];});
const errors=[],results=[],stamps=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
async function advance(frames){
 await page.evaluate(n=>{window.__landingReview.frames=n;},frames);
 await page.waitForFunction(()=>window.__landingReview.frames===0,null,{timeout:20000});
 return page.evaluate(()=>{const p=window.__game.player,q=window.__landingReview;return{
  state:p.state,bail:p.isBailing,pending:!!p.naturalGrindRail,contact:q.contact,path:q.path,
  rail:p.grindRail===q.rail,pos:p.pos.toArray(),canvas:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]};});
}
async function capture(name){
 await page.evaluate(()=>{const q=window.__landingReview;q.inspect=true;q.inspectionFrames=0;q.savedFov=window.__game.camera.fov;});
 await page.waitForFunction(()=>window.__landingReview.inspectionFrames>=2);
 await page.screenshot({path:`${output}/${name}.png`});
 await page.evaluate(()=>{const q=window.__landingReview;q.inspect=false;window.__game.camera.fov=q.savedFov;window.__game.camera.updateProjectionMatrix();});
}
async function setup({height=1.3,vy=-1,offset=0,old=false}={}){
 await page.keyboard.up('KeyE');
 await page.evaluate(({height,vy,offset,old})=>{
  const g=window.__game,p=g.player,l=g.getLevel(),q=window.__landingReview;
  const heading=q.rail.tangentAt(q.t);heading.y=0;heading.normalize();
  const position=q.rail.pointAt(q.t);position.y+=.15+height;position.x+=heading.z*offset;position.z-=heading.x*offset;
  p.respawn(l,true,true,{position,heading});p.pos.copy(position);p.prevPos.copy(position);
  p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);p.camDir.copy(heading);
  p.state='air';p.grounded=false;p.freeSkate=p.airFromSkate=true;p.airGrav='board';p.speed=12;p.vVel=vy;
  p.lastVelX=heading.x*12;p.lastVelZ=heading.z*12;p.balanceBoostT=100;
  p.deferNaturalGrind=old?()=>false:q.defer;q.path=[];q.contact=null;
  g.input.update();q.consume();
 },{height,vy,offset,old});
}
try{
 for(const lite of [true,false])for(const id of ['jungle-cup','sky']){
  await page.goto(`${base}/?playtest&level=${id}${lite?'&lite':''}`,{timeout:120000});
  await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
  await page.evaluate(()=>window.__game.campaign.startEphemeral());
  if(id==='jungle-cup'){
   await page.evaluate(()=>window.__game.competitionAction('retry'));
   await page.waitForFunction(()=>window.__game.getCompetition()?.phase==='running',null,{timeout:20000});
  }
  const info=await page.evaluate(({id,lite})=>{
   const g=window.__game,p=g.player,l=g.getLevel();
   if(!lite){g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);}
   if(g.getCompetition())g.getCompetition().remaining=600;
   let rail,t=1.5;
   if(id==='jungle-cup')rail=l.grindRails.find(r=>Math.abs(r.pointAt(r.totalLength/2).x+22)<.1&&!r.coping);
   else{rail=l.grindRails.find(r=>{const m=r.pointAt(r.totalLength/2);return m.z< -265&&Math.abs(m.x)<.01&&r.totalLength>24&&!r.coping;});t=4;}
   if(!rail)throw Error('Authored test rail missing');
   const q=window.__landingReview={rail,t,frames:0,path:[],contact:null,
    consume:g.input.consumeEdges.bind(g.input),defer:p.deferNaturalGrind.bind(p)};
   // Only paused inspection stills use a side view, so both the feet and
   // the rail are visible. Actual input/flight checks retain gameplay view.
   const render=g.renderer.render.bind(g.renderer);
   g.renderer.render=(scene,camera)=>{
    if(q.inspect&&scene===g.scene&&camera===g.camera){
     camera.position.copy(p.pos).addScaledVector(p.axisL,7).addScaledVector(p.axisF,-6);camera.position.y+=3.5;
     camera.fov=50;camera.lookAt(p.pos.x,p.pos.y+.9,p.pos.z);camera.updateProjectionMatrix();q.inspectionFrames++;
    }
    return render(scene,camera);
   };
   const step=p.step.bind(p),enter=p.enterGrind.bind(p);g.input.consumeEdges=()=>{};
   p.enterGrind=(r,s,l)=>{q.contact={natural:p.naturalGrindRail===r,feet:p.pos.toArray(),rail:s.point.toArray()};enter(r,s,l);};
   p.step=(dt,input,level)=>{
    if(q.frames<=0)return;
    step(dt,input,level);q.consume();q.frames--;
    q.path.push({pos:p.pos.toArray(),vy:p.vVel,state:p.state});
    if(p.state==='grind'||p.grounded||p.isBailing)q.frames=0;
   };
   return{index:l.grindRails.indexOf(rail),length:rail.totalLength,t};
  },{id,lite});
  console.log(`Loaded ${id} ${lite?'lite':'full'} rail ${info.index}`);
  for(const scenario of [{name:'descending tap',tap:true},{name:'rising hold',height:.6,vy:6}]){
   await setup(scenario);await page.keyboard.down('KeyE');
   const first=await advance(1);assert.equal(first.state,'air');assert.equal(first.pending,true);
   if(!lite&&scenario.tap)await capture(`${id}-native-approach`);
   if(scenario.tap)await page.keyboard.up('KeyE');
   const landed=await advance(90);
   assert.equal(landed.state,'grind');assert.equal(landed.rail,true);assert.equal(landed.bail,false);
   assert.equal(landed.contact.natural,true);assert.ok(landed.path.length>2);
   assert.ok(Math.abs(landed.contact.feet[1]-landed.contact.rail[1]-.15)<1e-6);
   if(!lite&&scenario.tap){
    assert.deepEqual(landed.canvas,[1280,720]);
    await capture(`${id}-native-contact`);
    await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(480);window.__game.crtGuestSettings.setEnabled(true);});
    await capture(`${id}-normal-contact`);
    await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
   }
   results.push({lite,id,scenario:scenario.name,info,landed});
  }
  for(const scenario of [{name:'near miss',offset:1.2,height:.7},{name:'old early catch',old:true}]){
   await setup(scenario);await page.keyboard.down('KeyE');const caught=await advance(1);
   assert.equal(caught.state,'grind');assert.equal(caught.contact.natural,false);
   if(scenario.old)assert.ok(caught.contact.feet[1]>caught.contact.rail[1]+1);
   results.push({lite,id,scenario:scenario.name,info,caught});
  }
  const stamp=await page.locator('.hud-build').textContent();assert.match(stamp,/Codex\/sol fork/);stamps.push(stamp);
 }
 assert.deepEqual(errors,[]);
 console.log(`PASS ${results.length} real keyboard flights/catches on authored campaign and park rails in lite/full Chrome, natural tap/hold contact, unchanged near-miss assistance, native/normal review and clean consoles.`);
 }catch(error){
 const failure=await page.evaluate(()=>{const g=window.__game,p=g?.player,q=window.__landingReview;return{
  level:g?.getCurrentLevel().id,state:p?.state,position:p?.pos.toArray(),bail:p?.isBailing,
  screen:g?.gameFlow.currentScreen,blocked:g?.gameFlow.blocksGameplay,competition:g?.getCompetition()?.phase,
  frames:q?.frames,rail:q?{t:q.t,length:q.rail.totalLength,start:q.rail.pointAt(q.t).toArray()}:null,path:q?.path};});
 console.error(JSON.stringify(failure));await page.screenshot({path:`${output}/failure.png`});throw error;
 }finally{
 await writeFile(`${output}/review.json`,JSON.stringify({base,stamps,results,errors},null,2)+'\n');
 await browser.close();
}
