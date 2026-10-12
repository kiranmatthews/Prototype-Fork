import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {join} from 'node:path';
const require=createRequire(import.meta.url);let module;try{module=require.resolve('playwright');}catch{module=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');}
const {chromium}=await import(module),base=process.env.CARLISLE_URL||'http://127.0.0.1:5242';
const lite=process.argv.includes('--lite'),out=process.env.CARLISLE_CLIFF_REVIEW||`/private/tmp/carlisle-cliff-${lite?'lite':'full'}`;await mkdir(out,{recursive:true});
const replay=JSON.parse(await readFile(new URL('fixtures/carlisle-cliff-replay.json',import.meta.url),'utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}}),report={base,lite,errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
const ready=()=>page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
const snapshot=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel(),anchor=p.pos.clone();anchor.y+=.58;return{p:p.pos.toArray(),camera:g.camera.position.toArray(),grounded:p.grounded,ground:p.groundHit?.name,clearance:l.carlisleScenery.cameraFraction(anchor,g.camera.position,.22),frame:g.replayer.frame,stamp:document.querySelector('.hud-build')?.textContent,assets:l.jungleAssetDiagnostics};});
try{
 await page.goto(`${base}/?playtest&level=test${lite?'&lite':''}`,{waitUntil:'domcontentloaded'});await ready();
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();g.restoreBuiltin('test');await g.switchLevel('test');await g.getLevel().prepareJungleAssets();});await ready();
 await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player;window.__savedCliffCamera=l.carlisleScenery.cameraFraction;l.carlisleScenery.cameraFraction=()=>1;
  p.respawn(l,true,false,{position:p.pos.clone().set(15.17459,-35.22637452246039,-192.584759),heading:p.camDir.clone().set(0,0,-1)});p.lives=30;});
 await page.waitForTimeout(900);await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());await page.waitForTimeout(150);
 report.before=await snapshot();if(!lite)await page.screenshot({path:out+'/before-camera.png'});
 await page.evaluate(()=>{window.__game.getLevel().carlisleScenery.cameraFraction=window.__savedCliffCamera;});await page.waitForTimeout(450);
 report.after=await snapshot();if(!lite)await page.screenshot({path:out+'/after-camera.png'});
 assert.ok(Math.hypot(...report.before.camera.map((v,i)=>v-report.after.camera[i]))>1,'camera leaves the obstructing rock');
 assert.ok(Math.hypot(...report.before.p.map((v,i)=>v-report.after.p[i]))<.01,'camera clearance does not move the player');
 assert.equal(report.after.clearance,1);assert.equal(report.after.grounded,true);assert.match(report.after.stamp,/Codex\/sol fork/);
 await page.evaluate(data=>{const g=window.__game;g.loadReplay(data);},replay);await ready();
 await page.evaluate(total=>{const g=window.__game,p=g.player,l=g.getLevel();p.respawn(l,true,false,{position:p.pos.clone().set(0,-4.985,-185),heading:p.camDir.clone().set(0,0,-1)});g.replayer.frame=5807;
  const step=p.step,q=window.__cliffTake={done:false,undersideSupports:0,frames:0};
  p.step=function(...args){const result=step.apply(this,args);if(g.replayer.active){q.frames++;if(p.grounded&&p.groundHit?.mesh?.userData.carlisleScenery&&p.groundHit.normal.y<=0)q.undersideSupports++;
   if(g.replayer.frame>=total){q.done=true;q.last=p.pos.toArray();p.step=step;g.replayer.end();g.ui.setReplayBadge(false);}}return result;};
 },replay.frames);
 await page.waitForFunction(()=>window.__cliffTake.done,null,{timeout:180000});await page.waitForTimeout(400);
 report.replay=await snapshot();report.take=await page.evaluate(()=>window.__cliffTake);
 assert.equal(report.take.frames,811);assert.ok(Math.hypot(...report.take.last.map((v,i)=>v-report.replay.p[i]))<.1,'capture retains the replay endpoint before automatic level reset');assert.equal(report.take.undersideSupports,0);assert.equal(report.replay.grounded,true);assert.ok(report.replay.p[1]>-7,'recorded approach cannot enter the buried rock layers');assert.equal(report.replay.clearance,1);
 if(!lite)await page.screenshot({path:out+'/replay-end.png'});
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify({pass:true,lite,before:report.before.camera,after:report.after.camera,final:report.replay.p,take:report.take,errors:report.errors}));
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close();}
