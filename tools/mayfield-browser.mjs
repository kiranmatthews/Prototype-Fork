import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5277').replace(/\/$/,''),full=process.argv.includes('--full'),native=process.argv.includes('--native'),tour=process.argv.includes('--tour'),mode=process.argv.includes('--foot')?'foot':'skate';
const tag=`${native?'native':full?'full':'lite'}-${tour?'tour':mode}`,out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-validation';await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as source from './src/levels/mayfield-mall'; export {createMayfieldPilot} from './tools/mayfield-pilot.mjs';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:native?{width:1920,height:1080}:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/mayfield-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
try{
 await page.goto(`${base}/?playtest&level=mayfield-mall${full||native?'':'&lite'}`,{timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='mayfield-mall'&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:180000});
 if(native){await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});await page.waitForTimeout(200);}
 await page.waitForTimeout(1200);await page.screenshot({path:`${out}/${tag}-spawn.png`});
 if(process.argv.includes('--preview')){const url=await page.evaluate(()=>{const g=window.__game;g.renderer.render(g.scene,g.camera);const c=document.createElement('canvas');c.width=640;c.height=360;c.getContext('2d').drawImage(g.renderer.domElement,0,0,640,360);return c.toDataURL('image/jpeg',.92);});await writeFile('public/level-previews/mayfield-mall.jpg',Buffer.from(url.split(',')[1],'base64'));}
 const initial=await page.evaluate(async()=>{const {source:m}=await import('./mayfield-fixture.js'),g=window.__game;return{checkpointCount:m.MAYFIELD_CHECKPOINTS.length,length:m.MAYFIELD_LENGTH,provenance:m.MAYFIELD_SOURCE_PROVENANCE,stamp:document.querySelector('.hud-build')?.textContent,sourceMatches:JSON.stringify(m.MAYFIELD_MALL_LEVEL)===JSON.stringify(g.getCurrentLevel().data),skatepark:g.getLevel().skatepark,freeSkate:g.player.freeSkate,display:{buffer:[g.renderer.domElement.width,g.renderer.domElement.height],resolution:g.renderQualitySettings.regularResolution,crt:g.crtGuestSettings.enabled}};});
 assert.equal(initial.skatepark,false);assert.equal(initial.freeSkate,false);assert.equal(initial.sourceMatches,true);assert.match(initial.stamp,/Codex\/sol fork/);
 if(native){assert.equal(initial.display.resolution,'max');assert.deepEqual(initial.display.buffer,[1920,1080]);}
 if(process.argv.includes('--menu')){
  if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.locator('.hud-levelplay[title="Mayfield Mall"]').click();
  await page.getByRole('button',{name:'MENU',exact:true}).click();
  await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='mayfield-mall'&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded);
  await page.keyboard.press('KeyM');
 }
 if(process.argv.includes('--inspect')){console.log(JSON.stringify(initial));}else if(tour){
  if(!await page.evaluate(()=>window.__game.gameFlow.developerChromeVisible))await page.keyboard.press('KeyM');
  const checkpoints=[];
  for(let i=0;i<initial.checkpointCount;i++){
   await page.keyboard.press('KeyL');await page.waitForFunction(i=>{const g=window.__game,l=g.getLevel();return l.checkpoints.indexOf(l.activeCheckpoint)===i&&g.player.grounded;},i,{timeout:20000});await page.waitForTimeout(850);
   checkpoints.push(await page.evaluate(()=>({position:window.__game.player.pos.toArray(),state:window.__game.player.state})));await page.screenshot({path:`${out}/${tag}-checkpoint-${i+1}.png`});
  }
  await page.keyboard.press('KeyK');await page.waitForFunction(()=>{const g=window.__game,l=g.getLevel();return g.player.pos.distanceTo(l.checkpoints[l.checkpoints.length-2].spawnPos)<.2&&g.player.grounded;});
  // A dedicated below-course drop tests the actual pit/respawn pipeline.
  const deaths=await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.set(0,-24,-565);p.grounded=false;return p.lives;});
  await page.waitForFunction(d=>{const g=window.__game;return g.player.lives===d-1&&g.player.grounded&&g.player.pos.distanceTo(g.getLevel().currentSpawn)<.25;},deaths,{timeout:30000});
  const recovery=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),lives:window.__game.player.lives,deaths:window.__game.player.totalDeaths,grounded:window.__game.player.grounded}));
  await writeFile(`${out}/${tag}.json`,JSON.stringify({base,initial,checkpoints,recovery,errors},null,2));console.log(JSON.stringify({tag,initial,checkpoints:checkpoints.length,recovery,errors}));
 }else{
  await page.evaluate(async mode=>{
   const {source:m,createMayfieldPilot}=await import('./mayfield-fixture.js'),g=window.__game,p=g.player,l=g.getLevel(),pilot=createMayfieldPilot(m,{mode});
   const report=window.mayfieldReview={done:false,error:null,steps:0,seconds:0,evidence:pilot.evidence,state:p.state,progress:-p.pos.z,tuningBefore:JSON.stringify(g.TUNING)};
   const step=p.step.bind(p),update=g.input.update.bind(g.input),commit=p.commitRenderStep.bind(p);let sample={},advanced=false;
   g.input.pollGamepad=()=>{const x=sample.moveX||0,y=sample.moveY||0,n=Math.hypot(x,y),a=n?.22+.78*Math.min(1,n):0,held={0:!!sample.jumpHeld,1:!!sample.grabHeld,2:!!sample.spinHeld,3:!!sample.grindHeld};return{id:'Mayfield review controller',index:0,connected:true,mapping:'standard',axes:n?[x/n*a,-y/n*a,0,0]:[0,0,0,0],buttons:Array.from({length:18},(_,i)=>({pressed:!!held[i],touched:!!held[i],value:held[i]?1:0}))};};
   p.step=(dt,input,level)=>{if(report.done)return;try{sample=pilot.sample(p,l);update();step(dt,input,level);pilot.observe(p,l);report.steps++;report.seconds+=dt;advanced=true;}catch(e){report.error=String(e);report.done=true;}};
   p.commitRenderStep=(...args)=>{commit(...args);if(!advanced||report.done)return;advanced=false;report.state=p.state;report.position=p.pos.toArray();report.deaths=p.totalDeaths;report.progress=pilot.progress;if(p.state==='finished'){report.done=true;report.tuningUnchanged=report.tuningBefore===JSON.stringify(g.TUNING);delete report.tuningBefore;}};
  },mode);
  const seen=new Set();for(let i=0;i<3600;i++){await page.waitForTimeout(250);const r=await page.evaluate(()=>window.mayfieldReview);for(const s of [45,175,310,440,620,800,950,1120,1350,1570,1800])if(r.progress>=s&&!seen.has(s)){seen.add(s);await page.screenshot({path:`${out}/${tag}-${s}.png`});console.log(`Mayfield ${tag}: ${Math.round(r.progress)} m`);}if(r.done)break;}
  const report=await page.evaluate(()=>window.mayfieldReview);await page.screenshot({path:`${out}/${tag}-finish.png`});await writeFile(`${out}/${tag}.json`,JSON.stringify({base,initial,report,errors},null,2));console.log(JSON.stringify({tag,report,errors}));
  assert.equal(report.error,null);assert.equal(report.state,'finished');assert.equal(report.deaths,0);for(const [source,frames] of Object.entries(report.evidence.sourceGround))assert.ok(frames>30,`${source} must supply main-route ground`);assert.equal(report.evidence.checkpoints.length,initial.checkpointCount);assert.equal(report.evidence.crystal,true);assert.equal(report.tuningUnchanged,true);
 }
 assert.deepEqual(errors,[]);
}catch(e){await page.screenshot({path:`${out}/${tag}-failure.png`}).catch(()=>{});console.log('BROWSER ERRORS',errors);throw e;}finally{await browser.close();}
