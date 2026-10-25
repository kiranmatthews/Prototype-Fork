import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.PORCH_OUTPUT||'/private/tmp/rooftop-porch/browser';
await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export {ROOFTOP_PORCH_BONUS as source} from './src/levels/rooftop-porch-bonus'; export {runStormPorch} from './tools/rooftop-porch-pilot.mjs'; export * as THREE from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),reports=[];
try{for(const mode of (process.env.PORCH_MODES||'lite,native').split(',')){
 const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/porch-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
 await page.goto(`${base}/?playtest&level=rooftop-relay${mode==='lite'?'&lite':''}`,{timeout:180000});
 const ready=async id=>{try{await page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:90000});}
  catch(error){await page.screenshot({path:`${out}/${mode}-blocked.png`});console.log('BLOCKED',id,await page.evaluate(()=>{const g=window.__game;return g?{id:g.getCurrentLevel().id,flow:g.gameFlow.currentScreen,loading:g.gameFlow.loadingPhase,pos:g.player.pos.toArray(),state:g.player.state}:null;}),errors);throw error;}
  console.log('READY',mode,id);
 };
 await ready('rooftop-relay');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
  window.porchParent=g.getLevel();window.porchBefore={lives:g.player.lives,fruit:g.player.fruit,deaths:g.player.totalDeaths,crates:g.player.cratesBroken,lens:g.getLookDiagnostics()?.rain.enabled};});
 const enter=async()=>{await page.evaluate(()=>window.__game.enterBonusRound());await ready('bonus:rooftop-relay');};
 let failedAttempt;
 if(mode==='lite'){
  await enter();await page.waitForTimeout(1000);await page.keyboard.down('ArrowLeft');await page.keyboard.down('Space');
  await page.waitForTimeout(900);await page.keyboard.up('Space');await page.waitForTimeout(3400);await page.keyboard.up('ArrowLeft');
  console.log('FALL',await page.evaluate(()=>({pos:window.__game.player.pos.toArray(),state:window.__game.player.state,id:window.__game.getCurrentLevel().id})));
  await ready('rooftop-relay');
  failedAttempt=await page.evaluate(()=>{const g=window.__game;return {sameParent:g.getLevel()===window.porchParent,completed:g.getLevel().bonusRoundCompleted,
   lives:g.player.lives,fruit:g.player.fruit,deaths:g.player.totalDeaths,before:window.porchBefore};});
  assert.ok(failedAttempt.sameParent);assert.equal(failedAttempt.completed,false);assert.equal(failedAttempt.lives,failedAttempt.before.lives);
  assert.equal(failedAttempt.fruit,failedAttempt.before.fruit);assert.equal(failedAttempt.deaths,failedAttempt.before.deaths);
 }
 await enter();await page.waitForTimeout(700);
 await page.screenshot({path:`${out}/${mode}-arrival.png`});
 const shelter=await page.evaluate(()=>{const g=window.__game;return {name:g.getCurrentLevel().data.name,rain:g.getLevel().rainDiagnostics,lens:g.getLookDiagnostics()?.rain,
  slippy:g.player.groundHit?.slippy??false,buffer:[g.renderer.domElement.width,g.renderer.domElement.height]};});
 assert.equal(shelter.name,'Bonus: The Storm Parlour');assert.ok(shelter.rain.visible);assert.equal(shelter.lens.enabled,false);assert.equal(shelter.slippy,false);
 if(mode==='native')assert.deepEqual(shelter.buffer,[2560,1440]);
 // Render the actual loaded rain shaders into a small isolated target. Both
 // streaks and impact rings must vanish inside cover, and survive beside it.
 const gpu=await page.evaluate(async()=>{
  const {THREE}=await import('/porch-fixture.js'),g=window.__game,renderer=g.renderer;
  const weather=g.getLevel().root.getObjectByName('Cyclone rain and roof impacts');
  const target=new THREE.WebGLRenderTarget(96,96),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(49,1,.1,30);
  camera.position.set(0,2,4);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
  const oldTarget=renderer.getRenderTarget(),oldColor=renderer.getClearColor(new THREE.Color()),oldAlpha=renderer.getClearAlpha();
  const rows=[];
  try{for(let i=0;i<2;i++){
   const original=weather.children[i],mesh=original.clone();mesh.geometry=original.geometry.clone();mesh.material=original.material.clone();
   mesh.geometry.instanceCount=1;mesh.frustumCulled=false;const u=mesh.material.uniforms;
   u.uTime.value=.1;u.uIntensity.value=1;u.uEye.value.copy(camera.position);u.uWind.value.set(0,0);
   if(i===0){u.uTime.value=0;const seed=mesh.geometry.getAttribute('aSeed');seed.setXYZW(0,0,0,0,1);seed.needsUpdate=true;}
   else{for(const [name,values] of [['aImpact',[0,0,0,1]],['aNormal',[0,1,0]],['aPhase',[0]]]){
    const attribute=mesh.geometry.getAttribute(name);values.forEach((v,k)=>attribute.array[k]=v);attribute.needsUpdate=true;
   }}
   scene.add(mesh);
   const render=()=>{renderer.setRenderTarget(target);renderer.setClearColor(0,1);renderer.clear();renderer.render(scene,camera);
    const bytes=new Uint8Array(96*96*4);renderer.readRenderTargetPixels(target,0,0,96,96,bytes);return bytes.reduce((sum,v,k)=>sum+(k%4===3?0:v),0);};
   u.uShelterEnabled.value=0;const exposed=render();
   u.uShelterEnabled.value=1;u.uShelterMin.value.set(-1,-1,-1);u.uShelterMax.value.set(1,1,1);const covered=render();
   u.uShelterMin.value.set(2,-1,-1);u.uShelterMax.value.set(3,1,1);const beside=render();
   rows.push({kind:i?'impact':'streak',exposed,covered,beside});scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();
  }}finally{renderer.setRenderTarget(oldTarget);renderer.setClearColor(oldColor,oldAlpha);target.dispose();}
  return rows;
 });
 for(const row of gpu){assert.ok(row.exposed>0);assert.equal(row.covered,0);assert.equal(row.beside,row.exposed);}
 if(mode==='native'){
  await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(480);window.__game.crtGuestSettings.setEnabled(true);});
  await page.waitForTimeout(500);await page.screenshot({path:`${out}/native-crt.png`});
  await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
 }
 await page.evaluate(async()=>{
  const {source,runStormPorch}=await import('/porch-fixture.js'),g=window.__game,p=g.player,l=g.getLevel();
  const report=window.porchJourney={frame:0,done:false,error:null,actions:[],evidence:[],trace:[],sourceMatches:JSON.stringify(source)===JSON.stringify(g.getCurrentLevel().data),tuning:JSON.stringify(g.TUNING)};
  const ctx={p,l,source,report,get frame(){return report.frame;}},pilot=runStormPorch(ctx);let next=pilot.next(),last={},advanced=false;
  const step=p.step.bind(p),commit=p.commitRenderStep.bind(p);
  p.step=(dt,input,level)=>{
   if(report.done)return step(dt,input,level);
   const sample=next.value??{};input.moveX=sample.moveX??0;input.moveY=sample.moveY??0;
   const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
   input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
   for(const held of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld']){
    input[held]=sample[held]??false;input[held.replace('Held','Pressed')]=sample[held.replace('Held','Pressed')]??(input[held]&&!last[held]);
   }
   input.jumpReleased=sample.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.jumpCancelled=false;input.restartPressed=false;
   last={...sample};step(dt,input,level);advanced=true;
  };
  p.commitRenderStep=(...args)=>{
   commit(...args);if(!advanced||report.done)return;advanced=false;report.frame++;
   const pose={frame:report.frame,position:p.pos.toArray(),state:p.state,grounded:p.grounded,deaths:p.totalDeaths,crates:p.cratesBroken,slippy:p.groundHit?.slippy??false};
   report.pose=pose;if(report.frame%12===0)report.trace.push(pose);
   try{next=pilot.next();if(next.done){report.done=true;report.result=next.value;report.tuningUnchanged=JSON.stringify(g.TUNING)===report.tuning;}}
   catch(e){report.done=true;report.error=String(e);}
  };
 });
 const shots=new Set(),began=Date.now();let state;
 do{
  await page.waitForTimeout(750);state=await page.evaluate(()=>({done:window.porchJourney.done,error:window.porchJourney.error,stage:window.porchJourney.stage,pose:window.porchJourney.pose}));
  const x=state.pose?.position[0]??-8,y=state.pose?.position[1]??0;
  const shot=x>10&&x<18&&y>4?'delivery':x>27&&x<32?'bridge':x>49&&x<55?'pantry':x>74&&x<85?'bell-crossing':null;
  if(shot&&!shots.has(shot)){shots.add(shot);await page.screenshot({path:`${out}/${mode}-${shot}.png`});console.log(mode,shot,JSON.stringify(state.pose));}
 }while(!state.done&&Date.now()-began<240000);
 const journey=await page.evaluate(()=>window.porchJourney);
 await writeFile(`${out}/${mode}-journey.json`,JSON.stringify(journey,null,2));
 assert.ok(journey.done);assert.equal(journey.error,null);assert.ok(journey.sourceMatches&&journey.tuningUnchanged);
 assert.equal(journey.result.cratesBroken,23);assert.equal(journey.result.deaths,0);assert.ok(journey.trace.every(p=>!p.slippy));
 await ready('rooftop-relay');
 const after=await page.evaluate(()=>{const g=window.__game;return {sameParent:g.getLevel()===window.porchParent,completed:g.getLevel().bonusRoundCompleted,
  boxes:g.player.bonusCrates,crates:g.player.cratesBroken,before:window.porchBefore,lens:g.getLookDiagnostics()?.rain,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.ok(after.sameParent&&after.completed);assert.equal(after.boxes,23);assert.equal(after.crates,after.before.crates);
 assert.equal(after.lens.enabled,after.before.lens);assert.match(after.stamp,/Codex\/sol fork/);assert.deepEqual(errors,[]);
 reports.push({mode,shelter,gpu,failedAttempt,after,result:journey.result,frames:journey.frame,errors});
 await writeFile(`${out}/report.json`,JSON.stringify(reports,null,2));console.log('PASS',JSON.stringify(reports.at(-1)));await page.close();
}}finally{await browser.close();}
