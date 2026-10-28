import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import ts from 'typescript';
const require=createRequire(import.meta.url);let module;
try{module=require.resolve('playwright');}catch{module=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(module).href);
const code=ts.transpileModule(await readFile(new URL('../src/levels/beach-street-gameplay.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {BEACH_KITE_BEATS:beats,BEACH_KITE_JUMPS:jumps}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const base=process.env.BEACH_BASE??'http://127.0.0.1:5288',out=process.env.BEACH_OUTPUT??'docs/beach-street/wind-finish';
const lite=process.argv.includes('--lite'),preview=process.argv.includes('--preview');
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1000},deviceScaleFactor:1,serviceWorkers:'block'});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const report={base,lite,preview,errors:[],failed:[],captures:[],started:new Date().toISOString()};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.failed.push({url:r.url(),status:r.status()});});
try{
 await page.goto(`${base}/?playtest&level=coastal-street-run${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:150000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='coastal-street-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:150000});
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:150000});
 await page.evaluate(({beats,jumps,preview})=>{
  const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true);p.lives=99;
  g.renderQualitySettings.setRegularResolution(preview?null:480);g.crtGuestSettings.setEnabled(!preview);
  const keys=new Set(),used=new Set();let releasedUntil=-1,cp='',lastTrace=-1;
  const pad=l.bonusPlatformDiagnostics;
  const state=window.__kitePilot={done:false,crashes:[],trace:[],jumps:[],checkpoints:[],keys:[],maxGripError:0,canopyBounds:{minX:1,maxX:-1,minY:1,maxY:-1},canopyClips:[]};
  let frame=0;
  const key=(code,down)=>{if(keys.has(code)===down)return;if(down)keys.add(code);else keys.delete(code);document.body.dispatchEvent(new KeyboardEvent(down?'keydown':'keyup',{code,key:code==='Space'?' ':code,bubbles:true}));state.keys.push({z:-p.pos.z,code,down});};
  const line=z=>{let a={z:-15,lane:0,kind:'rest'};for(const b of beats){if(z<b.z+(b.kind==='gap'?25:7)){const leave=a.z+(a.kind==='gap'?25:7),arrive=b.z-(b.kind==='gap'?25:17),t=Math.max(0,Math.min(1,(z-leave)/Math.max(1,arrive-leave)));return a.lane+(b.lane-a.lane)*t*t*(3-2*t);}a=b;}return 0;};
  const snap=()=>({z:-p.pos.z,x:p.pos.x,y:p.pos.y,state:p.state,grounded:p.grounded,lives:p.lives,speed:p.speed,crates:p.cratesBroken,totalCrates:l.totalCrates,bonusCrates:l.bonusCrateTotal,crystal:p.hasCrystal,gem:p.gemEarned});
  const run=()=>{
   if(state.done)return;
   const z=-p.pos.z;
   if(p.state==='dead'||p.state==='gameover'){state.crashes.push(snap());state.done=true;}
   if(p.state==='finished'||preview&&z>215)state.done=true;
   if(state.done){for(const c of [...keys])key(c,false);state.final=snap();return;}
   if(p.kiteReleased){
    if(!state.release){state.release={...snap(),at:p.runTime};for(const c of [...keys])key(c,false);}
    const elapsed=p.runTime-state.release.at,walking=elapsed>=6.4;
    if(elapsed>=3)state.waitingAtFinish??=snap();
    if(elapsed>=3.8)state.walkedRight??=snap();
    if(!walking){
     key('ArrowRight',elapsed>=3&&elapsed<3.8);key('ArrowLeft',elapsed>=3.8&&elapsed<4.6);
     key('ArrowDown',elapsed>=4.6&&elapsed<5.4);
    }
    if(walking){
     state.walkedBack??=snap();key('ArrowDown',false);
     key('ArrowLeft',p.pos.x>.1);key('ArrowRight',p.pos.x<-.1);key('ArrowUp',true);
     if(z>=3000.5&&state.finishJumpAt===undefined)state.finishJumpAt=p.runTime;
     key('Space',state.finishJumpAt!==undefined&&p.runTime-state.finishJumpAt<.10);
    }
    requestAnimationFrame(run);return;
   }
   let target=line(z+2);
   // The optional pad now catches a straight approach. Choose its outer side
   // after collecting the preceding exit rewards. Entry/return is tested separately.
   if(pad&&z>-pad.z-14&&z<-pad.z+1)target=pad.x-2.1;
   const error=target-p.pos.x-(p.kiteMotion?.lateral??0)*.12;
   // Real DOM keyboard events: no teleports, velocity writes or invulnerability.
   key('ArrowRight',error>.10);key('ArrowLeft',error<-.10);
   const jump=jumps.find(j=>!used.has(j.name)&&z>=j.at-.5);
   if(jump){used.add(jump.name);releasedUntil=p.runTime+.10;state.jumps.push({name:jump.name,...snap()});}
   key('Space',p.runTime>=releasedUntil);
   const checkpoint=l.currentSpawn.toArray().join(',');if(cp!==checkpoint){cp=checkpoint;state.checkpoints.push({spawn:l.currentSpawn.toArray(),...snap()});}
   if(Math.floor(z/30)>lastTrace){lastTrace=Math.floor(z/30);state.trace.push(snap());}
   state.maxGripError=Math.max(state.maxGripError,...(p.kiteVisual?.gripErrors??[0]));
   if(z>20&&p.kiteTowing&&p.kiteVisual?.root.visible&&frame++%6===0){
    const v=p.pos.clone();let clips=false;
    p.kiteVisual.sail.traverse(o=>{const a=o.geometry?.getAttribute('position');if(!a)return;for(let i=0;i<a.count;i++){
     v.fromBufferAttribute(a,i).applyMatrix4(o.matrixWorld).project(g.camera);const b=state.canopyBounds;
     b.minX=Math.min(b.minX,v.x);b.maxX=Math.max(b.maxX,v.x);b.minY=Math.min(b.minY,v.y);b.maxY=Math.max(b.maxY,v.y);
     clips ||= Math.abs(v.x)>1.02||Math.abs(v.y)>1.02;
    }});
    if(clips&&state.canopyClips.length<12)state.canopyClips.push(snap());
   }
   requestAnimationFrame(run);
  };run();
 },{beats,jumps,preview});
 const captures=preview?[['tow',32],['first-hop',188]]:lite?[['lite-tow',32]]:[['tow',32],['canal-flight',433],['freight',550],['cliff',1200],['festival',2025],['lighthouse',2645]];
 for(const [name,z]of captures){
  await page.waitForFunction(z=>-window.__game.player.pos.z>=z||window.__kitePilot.done,z,{timeout:240000});
  assert.deepEqual(await page.evaluate(()=>window.__kitePilot.crashes),[]);
  if(!lite){
   if(!preview&&['tow','festival'].includes(name))await page.screenshot({path:`${out}/presentation-${name}.png`});
   await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
   await page.waitForFunction(()=>window.__game.renderer.domElement.width===1600&&window.__game.renderer.domElement.height===1000);
  }
  await page.screenshot({path:`${out}/${lite?'lite':'native'}-${name}.png`});
  report.captures.push(await page.evaluate(name=>{const g=window.__game;return {name,z:-g.player.pos.z,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],kiteVisible:g.player.kiteVisual?.root.visible,gripErrors:g.player.kiteVisual?.gripErrors,stamp:document.querySelector('.hud-build')?.textContent};},name));
  if(!preview&&!lite)await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
 }
 if(!preview){
  await page.waitForFunction(()=>window.__kitePilot.release||window.__kitePilot.done,null,{timeout:240000});
  assert.deepEqual(await page.evaluate(()=>window.__kitePilot.crashes),[]);
  if(!lite){await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(null);window.__game.crtGuestSettings.setEnabled(false);});
   await page.waitForFunction(()=>window.__game.player.runTime-window.__kitePilot.release.at>=.65);
   await page.screenshot({path:`${out}/native-kite-release.png`});
   await page.waitForFunction(()=>window.__game.player.runTime-window.__kitePilot.release.at>=5.9);
   await page.screenshot({path:`${out}/native-walking-finish.png`});}
 }
 await page.waitForFunction(()=>window.__kitePilot.done,null,{timeout:300000});
 report.journey=await page.evaluate(()=>window.__kitePilot);
 assert.deepEqual(report.journey.crashes,[]);
 if(!preview){assert.equal(report.journey.final.state,'finished');assert.equal(report.journey.jumps.length,jumps.length);assert.ok(report.journey.checkpoints.length>=10);
  assert.ok(report.journey.release&&report.journey.waitingAtFinish);assert.equal(report.journey.waitingAtFinish.state,'ride');assert.equal(report.journey.waitingAtFinish.speed,0);assert.ok(report.journey.waitingAtFinish.z<3000);
  assert.ok(report.journey.walkedRight.x>report.journey.release.x+2,'On-foot side exploration');
  assert.ok(report.journey.walkedBack.z<report.journey.release.z-2,'On-foot backward exploration');
  assert.equal(report.journey.final.crates,report.journey.final.totalCrates-report.journey.final.bonusCrates,'All main-course rewards remain reachable when bypassing the optional pad');
  assert.ok(report.journey.final.crystal);assert.equal(report.journey.final.gem,report.journey.final.bonusCrates===0,'The gem still requires any linked bonus boxes');}
 assert.ok(report.captures.every(c=>c.kiteVisible));
 assert.ok(report.journey.maxGripError<.08,'Both hands remain attached to the bar');
 assert.deepEqual(report.journey.canopyClips,[],'The complete canopy remains framed through the run');
 report.assets=await page.evaluate(()=>{const l=window.__game.getLevel();let reduced=0;l.root.traverse(o=>{if(o.isMesh&&((o.userData.sceneryLod??0)>0||(o.userData.bwLod??0)>0))reduced++;});return {errors:l.jungleAssetDiagnostics?.errors??[],reduced};});
 assert.deepEqual(report.assets.errors,[]);assert.equal(report.assets.reduced,0);
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);
 report.pass=true;
}catch(e){report.pass=false;report.error=e.stack;report.journey=await page.evaluate(()=>window.__kitePilot).catch(()=>null);await page.screenshot({path:`${out}/failure.png`}).catch(()=>{});throw e;}
finally{
 const keys=report.journey?.keys;
 if(keys){report.journey.keyEventCount=keys.length;report.journey.keyCounts={};for(const {code,down}of keys){const k=`${code}:${down?'down':'up'}`;report.journey.keyCounts[k]=(report.journey.keyCounts[k]??0)+1;}delete report.journey.keys;}
 report.finished=new Date().toISOString();await writeFile(`${out}/browser-${lite?'lite':'full'}${preview?'-preview':''}.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,final:report.journey?.final,errors:report.errors,error:report.error}));
}
