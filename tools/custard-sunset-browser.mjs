// Actual gameplay cameras, streamed assets and complete-frame performance.
// Static art captures alone use silent hazard grace; input pilots are separate.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
const require=createRequire(import.meta.url);
let playwright=process.env.PLAYWRIGHT_MODULE;
if(!playwright){try{playwright=require.resolve('playwright');}catch{playwright=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(playwright.startsWith('/')?pathToFileURL(playwright).href:playwright);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5246').replace(/\/$/,'');
const lite=process.argv.includes('--lite'),portrait=process.argv.includes('--portrait');
const variant=portrait?'portrait':lite?'lite':'full',out=process.env.CUSTARD_REVIEW_OUTPUT||`/private/tmp/custard-sunset-${variant}`;
const selected=process.argv.includes('--smoke-only')?[]:process.env.CUSTARD_REVIEW_SCENES?.split(','),frames=Number(process.env.CUSTARD_REVIEW_FRAMES||60);
await mkdir(out,{recursive:true});
const author=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
let m;try{m=await author.ssrLoadModule('/src/levels/custard-creek.ts');}finally{await author.close();}
const fixtures=[['00-spawn',0,0],['01-lockyard',60,0],['02-inner-bank',300,-6],['03-first-gap',333,-6],['04-outer-bank',376,8],
 ['05-aqueduct',631,0],['06-crown-terrace',753,-3.5],['07-mill-roof',791,-18,5],['08-spillway-entry',870,0],['09-spillway-bend',1020,0],
 ['10-sluice-first',1224,0],['11-sluice-crescent',1418,-2],['12-ferry-near',1595,3],['13-ferry-far',1676,4],['14-reedbanks',1770,-5],
 ['15-boulder-run',1908,6],['16-final-rail',2270,-3.5],['17-finish-island',2390,4],['18-millrace-reunion',523,0],['19-mill-hoist',788,-5],['20-quarry-court',1862,0],['21-second-court',1950,0],['22-last-court',2030,0]];
const scenes=fixtures.map(([name,s,u,lift=0])=>({name,s,u,position:m.custardPoint(s,m.custardHeight(s)+lift+.12,u),heading:m.custardTangent(s)}));
const report={base,variant,started:new Date().toISOString(),sceneCount:scenes.length,scenes:[],errors:[],staticCaptureHazardGrace:true};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:portrait?{width:390,height:844}:{width:1280,height:720}});
 // Keep static fixtures and keyboard smoke independent of connected host pads.
 await page.addInitScript(()=>{Object.defineProperty(navigator,'getGamepads',{value:()=>[]});});
 page.setDefaultTimeout(180000);page.setDefaultNavigationTimeout(180000);
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',v=>{if(v.type()==='error')report.errors.push(v.text());});
 await page.goto(`${base}/?playtest&level=custard-creek&frameprobe&renderdiag${lite?'&lite':''}`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay);
 await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('custard-creek');await g.switchLevel('custard-creek');await g.getLevel().prepareJungleAssets();});
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay);
 await page.waitForTimeout(500);
 const snapshot=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return{position:p.pos.toArray(),grounded:p.grounded,state:p.state,lives:p.lives,stamp:document.querySelector('.hud-build')?.textContent,assets:l.jungleAssetDiagnostics,render:g.getRenderFrameStats(),memory:{...g.renderer.info.memory,programs:g.renderer.info.programs?.length},camera:g.camera.position.toArray()};});
 const measure=count=>page.evaluate(async count=>{const g=window.__game,t=[],calls=[],tri=[];let frame=g.frameStats.frame;for(let i=0;i<count;i++)await new Promise(resolve=>{const next=()=>requestAnimationFrame(()=>{if(frame===g.frameStats.frame){next();return;}frame=g.frameStats.frame;t.push(g.frameStats.rawDt*1000);const r=g.getRenderFrameStats();calls.push(r.calls);tri.push(r.triangles);resolve();});next();});t.sort((a,b)=>a-b);return{frames:count,medianMs:t[Math.floor(count*.5)],p95Ms:t[Math.floor(count*.95)],calls:Math.max(...calls),triangles:Math.max(...tri)};},count);
 report.environment=await page.evaluate(()=>{const g=window.__game,gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return{userAgent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,viewport:[innerWidth,innerHeight],resolution:g.getRenderQualitySizes(),atmosphere:g.getLevel().atmosphere,sunDirection:g.scene.children.find(l=>l.isDirectionalLight&&l.castShadow)?.position.clone().sub(g.scene.children.find(l=>l.isDirectionalLight&&l.castShadow).target.position).normalize().toArray()};});
 assert.ok(Math.abs(Math.asin(report.environment.sunDirection[1])*180/Math.PI-17.41005)<.01,'actual rendered evening sun direction');
 report.spawn=await snapshot();assert.equal(report.spawn.grounded,true);assert.match(report.spawn.stamp,/Codex\/sol fork/);
 for(const scene of selected?scenes.filter(s=>selected.includes(s.name)):scenes){
  await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player,l=g.getLevel();g.campaign.startEphemeral();p.respawn(l,true,false,{position:p.pos.clone().fromArray(position),heading:p.axisF.clone().fromArray(heading)});p.lives=30;p.invulnTimer=120;p.invulnSilent=true;p.commitRenderStep(l);},scene);
  await page.waitForTimeout(500);await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());await page.waitForTimeout(200);
  await measure(30);const state=await snapshot();assert.ok(state.grounded,`${scene.name} supported camera fixture: ${JSON.stringify(state)}`);assert.ok(state.position.every(Number.isFinite));
  assert.deepEqual(state.assets?.errors??[],[],`${scene.name} streamed assets`);assert.equal(state.assets?.pendingCells??0,0);
  const timing=await measure(frames);report.scenes.push({...scene,...state,timing});
  await page.screenshot({path:`${out}/${scene.name}.png`});
  if(!lite&&!portrait){
   const style=await page.addStyleTag({content:'.game-hud-layer,.hud-build,#render-diagnostics,#frame-probe{display:none!important}'});
   await page.evaluate(()=>{const g=window.__game;window.__custardHud={icons:g.ui.drawIcons,hud:g.ui.drawGameHud,fruit:g.player.drawFlyingFruit};g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};g.player.drawFlyingFruit=()=>{};});
   await measure(2);await page.screenshot({path:`${out}/preview-${scene.name}.png`});
   if(scene.name==='02-inner-bank')await page.screenshot({path:`${out}/preview-${scene.name}.jpg`,type:'jpeg',quality:86});
   await page.evaluate(()=>{const g=window.__game,s=window.__custardHud;g.ui.drawIcons=s.icons;g.ui.drawGameHud=s.hud;g.player.drawFlyingFruit=s.fruit;delete window.__custardHud;});await style.evaluate(e=>e.remove());
  }
  console.log(JSON.stringify({name:scene.name,...timing,textureMiB:state.assets?.textureMiB,cells:state.assets?.residentCells}));
 }
 await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().fromArray(position),heading:p.axisF.clone().fromArray(heading)});},scenes[0]);
 await page.waitForTimeout(400);await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());await measure(30);
 const before=await snapshot();await measure(120);const after=await snapshot();report.idle={before,after};
 assert.deepEqual(after.memory,before.memory,'idle renderer ownership');assert.equal(after.assets?.residentCells,before.assets?.residentCells,'idle scenery residency');
 if(process.argv.includes('--smoke')||process.argv.includes('--smoke-only')){
  const place=async(s,u=0)=>{const position=m.custardPoint(s,m.custardHeight(s)+.12,u),heading=m.custardTangent(s);await page.evaluate(({position,heading})=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().fromArray(position),heading:p.axisF.clone().fromArray(heading)});}, {position,heading});await page.waitForTimeout(700);};
  await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.switchLevel('custard-creek');});
  await place(548,2.5);await page.keyboard.down('KeyF');
  await page.waitForFunction(()=>!!window.__game.getLevel().activeCheckpoint,null,{timeout:12000});await page.keyboard.up('KeyF');
  const banked=await page.evaluate(()=>({lives:window.__game.player.lives,spawn:window.__game.getLevel().currentSpawn.toArray()}));
  await page.evaluate(()=>{const p=window.__game.player,old=p.onDeath;window.__custardRestoreDeath=()=>{p.onDeath=old;};p.onDeath=()=>{window.__custardDeathPoint=p.pos.toArray();old?.call(p);};});
  await page.keyboard.down('ArrowRight');await page.keyboard.down('Space');
  await page.waitForFunction(lives=>window.__game.player.lives<lives,banked.lives,{timeout:25000});
  await page.keyboard.up('ArrowRight');await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.grounded&&!['dead','gameover'].includes(window.__game.player.state),null,{timeout:18000});
  const deathPoint=await page.evaluate(()=>{window.__custardRestoreDeath();return window.__custardDeathPoint;});
  const deathStation=m.custardProgress(deathPoint),waterY=m.custardWaterHeight(deathStation);
  assert.ok(deathPoint[1]<=waterY+.3&&deathPoint[1]>waterY-3,'natural fall resets near the visible water');
  const respawn=await snapshot();assert.equal(respawn.lives,banked.lives-1);assert.ok(Math.hypot(...respawn.position.map((v,i)=>v-banked.spawn[i]))<3);
  await place(2415);await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.keyboard.down('KeyF');await page.waitForTimeout(1300);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});for(const key of ['ArrowUp','KeyF'])await page.keyboard.up(key);
  report.smoke={checkpoint:banked,deathPoint,waterY,naturalPitRespawn:respawn,finish:await snapshot()};assert.equal(report.smoke.finish.state,'finished');
 }
 assert.deepEqual(report.errors,[]);report.pass=true;report.finished=new Date().toISOString();
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
