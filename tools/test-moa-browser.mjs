import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5291/';
const output=process.env.MOA_REVIEW_OUTPUT||'/private/tmp/moa-game-review';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],evidence=[];
try{
 for(const lite of [true,false]){
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:output,size:{width:1440,height:900}}});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.addInitScript(()=>{
   window.__moaAudio=[];const start=AudioBufferSourceNode.prototype.start;
   AudioBufferSourceNode.prototype.start=function(...args){window.__moaAudio.push({duration:this.buffer?.duration,state:this.context.state,rate:this.playbackRate.value});return start.apply(this,args);};
  });
  const url=new URL(base);url.search=`?playtest&level=codex-lab${lite?'&lite':''}`;await page.goto(url.href);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
  await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.player.preparePresentationAssets(),g.getLevel().prepareJungleAssets()]);});
  await page.keyboard.press('Shift');
  const setup=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),p=g.player,e=l.enemies.find(e=>e.kind==='moa');if(!e)throw Error('Published level has no moa');
   const spawn={grounded:p.grounded,y:p.pos.y};
   const neutral={moveX:0,moveY:0,jumpHeld:false,jumpPressed:false,jumpReleased:false,grindHeld:false,grindPressed:false,spinHeld:false,spinPressed:false,grabHeld:false,grabPressed:false,transferHeld:false,transferPressed:false,inventoryHeld:true};
   const native=p.step.bind(p);p.step=(dt,input,level)=>native(dt,{...neutral,...window.__moaInput},level);
   const states=new Set(),sample=[];const update=l.update.bind(l);l.update=dt=>{update(dt);states.add(e.state);if(sample.length<900)sample.push({state:e.state,t:e.stateT,phase:e.visual.diagnostics.gaitPhase});};
   const anchor=e.group.position.clone();const render=g.renderer.render.bind(g.renderer);
   g.renderer.render=(scene,camera)=>{if(camera===g.camera){camera.position.copy(anchor).add({x:8,y:5,z:9});camera.lookAt(anchor.clone().add({x:0,y:2,z:0}));camera.fov=43;camera.updateProjectionMatrix();}return render(scene,camera);};
   const place=(at)=>{g.gameFlow.hide();p.respawn(l,true,true,{position:at,heading:at.clone().set(0,0,-1)});p.freeSkate=true;p.speed=0;p.invulnTimer=p.uberTimer=0;};
   place(anchor.clone().add({x:1.5,y:.04,z:6.5}));p.masks=1;
   const events={finish:0};const finish=p.onFinish;p.onFinish=(...args)=>{events.finish++;return finish(...args);};
   window.__moaProbe={states,sample,e,place,anchor,events};
   const bounds=root=>{const box=e.box.clone().makeEmpty(),point=p.pos.clone();root.updateWorldMatrix(true,true);root.traverse(n=>{if(n.isMesh&&!n.userData.characterRenderProxy&&n.geometry.attributes.position){if(n.isSkinnedMesh)n.skeleton.update();for(let i=0;i<n.geometry.attributes.position.count;i++){n.getVertexPosition(i,point).applyMatrix4(n.matrixWorld);box.expandByPoint(point);}}});return box.getSize(p.pos.clone()).toArray();};
   return {spawn,status:e.visual.diagnostics.status,moa:bounds(e.group),skater:bounds(p.riderRef),position:e.group.position.toArray()};
  });
  assert.equal(setup.status,'ready');assert.equal(setup.spawn.grounded,true);assert.ok(setup.moa[1]>setup.skater[1]*1.2,JSON.stringify(setup));
  await page.waitForFunction(()=>window.__moaProbe.states.has('squawk')&&window.__moaAudio.some(s=>Math.abs(s.duration-1.14)<.01&&s.state==='running'),null,{timeout:20000});
  await page.waitForTimeout(1700);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-size-walk.png`});
  const idle=await page.evaluate(()=>({states:[...window.__moaProbe.states],audio:window.__moaAudio.filter(s=>Math.abs(s.duration-1.14)<.01),frames:window.__moaProbe.sample.length}));
  await page.evaluate(()=>{const g=window.__game,q=window.__moaProbe;q.place(q.anchor.clone().add({x:0,y:.04,z:3.05}));g.player.masks=1;});
  await page.waitForFunction(()=>window.__moaProbe.e.state==='windup',null,{timeout:12000});
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-windup.png`});
  await page.waitForFunction(()=>window.__game.player.masks===0,null,{timeout:10000});
  const peck=await page.evaluate(()=>({state:window.__moaProbe.e.state,alive:window.__moaProbe.e.alive,masks:window.__game.player.masks,audio:window.__moaAudio.filter(s=>Math.abs(s.duration-.22)<.005)}));
  assert.equal(peck.alive,true);assert.ok(peck.audio.length>0);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-peck-hit.png`});
  // Actual normal spin input after staging within the body attack envelope.
  await page.evaluate(()=>{const g=window.__game,q=window.__moaProbe;q.place(q.anchor.clone().add({x:-.85,y:.04,z:0}));g.player.masks=1;window.__moaInput={spinHeld:true,spinPressed:true};});
  await page.waitForFunction(()=>!window.__moaProbe.e.alive,null,{timeout:5000});
  await page.evaluate(()=>{window.__moaInput={};});
  const defeated=await page.evaluate(()=>({alive:window.__moaProbe.e.alive,flung:window.__moaProbe.e.flungT!==undefined}));assert.equal(defeated.flung,true);
  // Existing checkpoint, pit recovery and finish still function in the affected level.
  await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),q=window.__moaProbe,cp=l.checkpoints[0];q.place(cp.box.getCenter(g.player.pos.clone()).setY(cp.box.min.y+.05));window.__moaInput={spinHeld:true,spinPressed:true};});
  await page.waitForFunction(()=>!!window.__game.getLevel().activeCheckpoint,null,{timeout:6000});
  await page.evaluate(()=>{window.__moaInput={};const g=window.__game;g.player.pos.y=g.getLevel().killY-3;g.player.grounded=false;g.player.state='air';});
  await page.waitForFunction(()=>window.__game.player.state==='dead',null,{timeout:6000});
  await page.waitForFunction(()=>window.__game.player.state!=='dead',null,{timeout:12000});
  const respawn=await page.evaluate(()=>({alive:window.__moaProbe.e.alive,attackEmpty:window.__moaProbe.e.attackBox.isEmpty(),checkpoint:!!window.__game.getLevel().activeCheckpoint,player:window.__game.player.state}));assert.equal(respawn.alive,true);assert.equal(respawn.attackEmpty,true);
  await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;g.gameFlow.hide();const at=l.finishGlow.getCenter(p.pos.clone());p.pos.copy(at).setY(l.finishBox.min.y+.2);p.prevPos.copy(p.pos);p.settle(l);p.grounded=false;p.vVel=-1;p.state='air';});
  await page.waitForFunction(()=>window.__moaProbe.events.finish>0,null,{timeout:12000});
  const finish=await page.evaluate(()=>({screen:window.__game.gameFlow.currentScreen,events:window.__moaProbe.events,stamp:document.querySelector('.hud-build')?.textContent}));assert.match(finish.stamp,/Codex\/sol fork/);
  evidence.push({lite,...setup,idle,peck,defeated,respawn,finish});console.log(`${lite?'lite':'full'}: size ${setup.moa[1].toFixed(2)}m / skater ${setup.skater[1].toFixed(2)}m; walk, squawk audio, actual peck, spin, checkpoint, respawn, finish`);
  await context.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,evidence,errors},null,2));await browser.close();}
console.log('PASS moa actual game and audio in lite/full rendering. '+output);
