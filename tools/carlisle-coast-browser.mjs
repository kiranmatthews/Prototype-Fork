// Real-browser scene, memory and input evidence. Use --lite first, then a
// full pass and --portrait. --baseline captures the undecorated source; use
// --visual for screenshots/performance without repeating the input smoke.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);
let playwright=process.env.PLAYWRIGHT_MODULE;
if(!playwright){try{playwright=require.resolve('playwright');}catch{playwright=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}}
const {chromium}=await import(playwright.startsWith('/')?pathToFileURL(playwright).href:playwright);
const base=(process.argv.find(a=>/^https?:/.test(a))||'http://127.0.0.1:5240').replace(/\/$/,'');
const lite=process.argv.includes('--lite'),portrait=process.argv.includes('--portrait'),baseline=process.argv.includes('--baseline');
const smokeOnly=process.argv.includes('--smoke-only');
const visual=process.argv.includes('--visual')||(baseline&&!smokeOnly);
const variant=(baseline?'baseline':portrait?'portrait':lite?'lite':'full')+(smokeOnly?'-smoke':'');
const out=process.env.CARLISLE_REVIEW_OUTPUT||`/private/tmp/carlisle-coast-${variant}`;
const frameCount=Number(process.env.CARLISLE_REVIEW_FRAMES||60);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[],report={base,variant,lite,portrait,baseline,started:new Date().toISOString(),errors,scenes:[],scenesUseSilentHazardGrace:true};
let page;
async function snapshot(){return page.evaluate(()=>{
  const g=window.__game,p=g.player,l=g.getLevel();
  return {position:p.pos.toArray(),grounded:p.grounded,state:p.state,deaths:p.totalDeaths,lives:p.lives,
    currentSpawn:l.currentSpawn.toArray(),checkpoint:!!l.activeCheckpoint,assets:l.jungleAssetDiagnostics,
    render:g.getRenderFrameStats(),memory:{...g.renderer.info.memory,programs:g.renderer.info.programs?.length??0},
    camera:g.camera.position.toArray(),stamp:document.querySelector('.hud-build')?.textContent};
});}
async function place(position,capture=false){
  await page.evaluate(({position,capture})=>{
    const g=window.__game,l=g.getLevel(),p=g.player;g.campaign.startEphemeral();
    const heading=p.camDir.clone().set(l.zoneAt(position[0],position[2])?.dir==='E'?1:0,0,l.zoneAt(position[0],position[2])?.dir==='E'?0:-1);
    p.respawn(l,true,false,{position:p.pos.clone().set(...position),heading});p.lives=30;
    // Static shot review may sit beside a patrolling hazard for many frames.
    // Grace affects only damage during captures; the input smoke calls
    // respawn without it and uses the authored contacts and movement.
    if(capture){p.invulnTimer=120;p.invulnSilent=true;}
  },{position,capture});
  await page.waitForTimeout(500);
  await page.evaluate(async()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(200);
}
async function renderedFrames(count){return page.evaluate(async count=>{
  const g=window.__game,timings=[],draws=[];let previous=g.frameStats.frame;
  for(let i=0;i<count;i++){
    await new Promise(resolve=>{const step=()=>requestAnimationFrame(()=>{
      if(g.frameStats.frame===previous){step();return;}previous=g.frameStats.frame;
      timings.push(g.frameStats.rawDt*1000);draws.push({...g.getRenderFrameStats()});resolve();
    });step();});
  }
  timings.sort((a,b)=>a-b);
  return {frames:timings.length,medianMs:timings[Math.floor(timings.length*.5)],p95Ms:timings[Math.floor(timings.length*.95)],
    calls:{min:Math.min(...draws.map(d=>d.calls)),max:Math.max(...draws.map(d=>d.calls))},
    triangles:{min:Math.min(...draws.map(d=>d.triangles)),max:Math.max(...draws.map(d=>d.triangles))}};
},count);}
try{
  page=await browser.newPage({viewport:portrait?{width:390,height:844}:{width:1280,height:720}});
  page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message}));
  page.on('console',m=>{if(m.type()==='error')errors.push({type:'console',message:m.text()});});
  await page.goto(`${base}/?playtest&level=test&frameprobe&renderdiag${lite?'&lite':''}`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('test');await g.switchLevel('test');await g.getLevel().prepareJungleAssets();});
  await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.waitForTimeout(700);
  report.spawn=await snapshot();assert.equal(report.spawn.grounded,true,'supported source spawn');assert.match(report.spawn.stamp,/Codex\/sol fork/);
  report.environment=await page.evaluate(()=>{
    const g=window.__game,gl=g.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return {userAgent:navigator.userAgent,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unavailable',
      viewport:[innerWidth,innerHeight],quality:g.renderQualitySettings.snapshot(),resolution:g.getRenderQualitySizes()};
  });
  const scenes=await page.evaluate(()=>{
    const l=window.__game.getLevel();return [{name:'00-spawn',position:l.spawnPos.toArray()},
      ...l.checkpoints.map((c,i)=>({name:`${String(i+1).padStart(2,'0')}-checkpoint`,position:c.spawnPos.toArray()})),
      {name:'15-halfpipe',position:[0,-13.4,-770]},
      {name:'16-market',position:[0,-21.9,-1103]},
      {name:'17-split-dock',position:[146.5,-25.9,-2078]},
      {name:'18-finish-approach',position:[152,-25.9,-2282]}];
  });
  assert.equal(scenes.filter(s=>s.name.includes('checkpoint')).length,14);
  for(const scene of smokeOnly?[]:scenes){
    await place(scene.position,true);const sample=await snapshot();
    assert.ok(sample.position.every(Number.isFinite),`${scene.name}: finite player`);assert.equal(sample.grounded,true,`${scene.name}: supported source location`);
    if(!baseline){assert.ok(sample.assets);assert.deepEqual(sample.assets.errors,[],`${scene.name}: loaded assets`);assert.equal(sample.assets.pendingCells,0);}
    const timing=await renderedFrames(frameCount);
    assert.ok(timing.calls.min>0&&timing.triangles.min>0,`${scene.name}: counts come from rendered gameplay frames`);
    await page.screenshot({path:`${out}/${scene.name}.png`});
    report.scenes.push({...scene,...sample,timing});
    if(!lite&&!portrait&&['02-checkpoint','03-checkpoint'].includes(scene.name)){
      // Capture one actual final gameplay frame through the existing camera,
      // world lighting and CRT. The two HUD painters are temporarily muted
      // because their Canvas mirrors can outlive hidden DOM ink.
      const style=await page.addStyleTag({content:'.game-hud-layer,.hud-build,#render-diagnostics,#frame-probe { display:none !important; }'});
      await page.evaluate(()=>{
        const g=window.__game;window.__coastHudCapture={icons:g.ui.drawIcons,hud:g.ui.drawGameHud,fruit:g.player.drawFlyingFruit};
        g.ui.drawIcons=()=>{};g.ui.drawGameHud=()=>{};g.player.drawFlyingFruit=()=>{};
      });
      try{
        await renderedFrames(2);await page.screenshot({path:`${out}/preview-${scene.name}.png`});
        (report.previews??=[]).push({scene:scene.name,path:`${out}/preview-${scene.name}.png`,camera:sample.camera,actualRuntime:true});
      }finally{
        await page.evaluate(()=>{const g=window.__game,s=window.__coastHudCapture;g.ui.drawIcons=s.icons;g.ui.drawGameHud=s.hud;g.player.drawFlyingFruit=s.fruit;delete window.__coastHudCapture;});
        await style.evaluate(element=>element.remove());await renderedFrames(2);
      }
    }
    console.log(JSON.stringify({scene:scene.name,variant,calls:timing.calls.max,triangles:timing.triangles.max,
      medianMs:+timing.medianMs.toFixed(2),p95Ms:+timing.p95Ms.toFixed(2),textureMiB:sample.assets?.textureMiB,residentCells:sample.assets?.residentCells}));
  }
  await place(report.spawn.position,true);const returned=await snapshot();
  await renderedFrames(90);const idle=await snapshot();report.idle={returned,idle};
  assert.ok(idle.memory.geometries<=returned.memory.geometries,'idle geometry ownership does not grow');
  assert.ok(idle.memory.textures<=returned.memory.textures,'idle texture ownership does not grow');
  if(!baseline)assert.equal(idle.assets.residentCells,returned.assets.residentCells,'idle cell residency remains stable');
  if(!visual){
    await place([0,-4.52,-134]);const before=await snapshot();
    // The original 9m gap is a skating/rope encounter. Commit to the board
    // on supported ground, then release the charged ollie before the lip;
    // a late walking jump cannot establish the authored skating run-up.
    await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.pos.z<-137,null,{timeout:12000});
    await page.keyboard.down('Space');await page.waitForFunction(()=>window.__game.player.pos.z<-151.8,null,{timeout:12000});
    report.takeoff=await page.evaluate(()=>{const p=window.__game.player;return {position:p.pos.toArray(),speed:p.speed,skating:p.freeSkate,charge:p.xHoldT};});
    await page.keyboard.up('Space');await page.waitForFunction(()=>window.__game.player.pos.z<-166&&window.__game.player.grounded,null,{timeout:12000});
    await page.keyboard.up('ArrowUp');report.inputJump={before,after:await snapshot()};
    assert.equal(report.inputJump.after.lives,before.lives,'keyboard clears original first pit without losing a life');
    assert.equal(report.takeoff.skating,true,'the first gap uses the original board commitment gesture');
    await page.screenshot({path:`${out}/input-first-jump.png`});
    const checkpointApproach=await page.evaluate(()=>{
      const cp=window.__game.getLevel().checkpoints[0];return [(cp.box.min.x+cp.box.max.x)/2,cp.box.min.y+.1,cp.box.max.z+.8];
    });
    await place(checkpointApproach);await page.keyboard.down('KeyF');
    await page.waitForFunction(()=>!!window.__game.getLevel().activeCheckpoint,null,{timeout:5000});await page.keyboard.up('KeyF');
    report.checkpoint=await snapshot();assert.equal(report.checkpoint.checkpoint,true,'real spin banks the first checkpoint');
    await page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();p.pos.y=l.killY-1;p.state='air';p.grounded=false;p.vVel=-1;});
    await page.waitForFunction(lives=>window.__game.player.lives<lives&&window.__game.player.state==='ride'&&window.__game.player.grounded,
      report.checkpoint.lives,{timeout:20000});report.pitRespawn=await snapshot();
    assert.equal(report.pitRespawn.checkpoint,true,'pit death keeps the banked checkpoint');
    assert.ok(Math.hypot(...report.pitRespawn.position.map((v,i)=>v-report.checkpoint.currentSpawn[i]))<2,'pit respawns at actual checkpoint');
    await place([152,-25.9,-2282]);await page.keyboard.down('ArrowUp');
    await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:15000});await page.keyboard.up('ArrowUp');
    report.finish=await snapshot();assert.equal(report.finish.state,'finished','keyboard traversal reaches the actual finish pad');
  }
  assert.deepEqual(errors,[],'real browser has no console or page errors');report.pass=true;
}catch(error){report.failure=error.stack;report.last=await snapshot().catch(()=>null);report.pass=false;throw error;}
finally{
  if(page){for(const key of ['ArrowUp','Space','KeyF'])await page.keyboard.up(key).catch(()=>{});}
  report.finished=new Date().toISOString();await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();
  console.log(JSON.stringify({pass:report.pass,variant,scenes:report.scenes.length,errors,out,failure:report.failure}));
}
