import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';

const require=createRequire(import.meta.url);let pw;
try{pw=require.resolve('playwright');}catch{pw=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(pw).href);
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const point=api.carlislePoint,run=api.CARLISLE_RELAY_CROSSINGS[0],lite=process.argv.includes('--lite'),mode=lite?'lite':'full';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out=process.env.CARLISLE_MOTION_OUT??'docs/carlisle-relay/slope-motion';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1,serviceWorkers:'block'});
const report={mode,base,errors:[],cases:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const read=()=>page.evaluate(()=>{const g=window.__game,p=g.player,d=g.characterAnimationRuntime.diagnostics;
 const soleClearance=p.proceduralFootwear.map(({sole})=>{sole.updateWorldMatrix(true,false);const points=sole.geometry.getAttribute('position'),normal=p.groundHit?.normal;let min=Infinity;
  if(normal)for(let i=0;i<points.count;i++){const v=p.pos.clone().fromBufferAttribute(points,i).applyMatrix4(sole.matrixWorld).sub(p.pos);min=Math.min(min,v.dot(normal)/normal.y);}return min;});return{
 at:p.pos.toArray(),velocity:p.walkVelocity.toArray(),normal:p.groundHit?.normal.toArray(),grounded:p.grounded,
 soleClearance,wet:!!p.groundHit?.slipGravity,state:p.state,board:p.freeSkate,bail:p.isBailing,time:p.runTime,
 hint:p.animationClipHint,active:d.activeClipId,transient:d.transientClipId,phase:p.walkPhase,
 normalizedSpeed:p.animationIntent.motion.normalizedSpeed,timeline:d.timelineTime,slideTimer:p.slideTimer,
};});
const wait=async(seconds)=>{const p=await read();await page.waitForFunction(t=>window.__game.player.runTime>=t,p.time+seconds,{timeout:30000});return read();};
const keys=new Set();
const press=async(key)=>{for(const old of [...keys])if(old!==key){await page.keyboard.up(old);keys.delete(old);}if(key&&!keys.has(key)){await page.keyboard.down(key);keys.add(key);}};
const place=async(s)=>{
 await press(null);const at=point(s,run.height(s,0)+.12),heading=point(s+2,0).map((v,i)=>i===1?0:v-point(s,0)[i]);
 await page.evaluate(({at,heading})=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(...at),heading:p.pos.clone().set(...heading)});},{at,heading});
 await wait(.1);
};
const inspection=async name=>{
 const url=await page.evaluate(()=>{const g=window.__game,p=g.player,c=g.camera.clone(),a=p.visualYaw+Math.PI,f=p.pos.clone().set(Math.sin(a),0,Math.cos(a)),r=p.pos.clone().set(f.z,0,-f.x);
  c.position.copy(p.pos).addScaledVector(f,5).addScaledVector(r,6);c.position.y=p.pos.y+3;c.lookAt(p.pos.clone().add(p.pos.clone().set(0,1.2,0)));c.updateMatrixWorld(true);g.renderer.render(g.scene,c);return g.renderer.domElement.toDataURL('image/png');});
 await writeFile(`${out}/${mode}-${name}-inspection.png`,Buffer.from(url.split(',')[1],'base64'));
};
const along=p=>p.velocity[0]*p.normal[0]+p.velocity[2]*p.normal[2];
const check=(p,clip)=>{assert.ok(p.grounded&&p.wet&&!p.board&&!p.bail,JSON.stringify(p));assert.equal(p.hint,clip);assert.equal(p.active,clip);};
try{
 await page.goto(`${base}/?playtest&level=carlisle-coast${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='carlisle-coast'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 report.source=await page.evaluate(()=>{const g=window.__game;return{build:document.querySelector('.hud-build')?.textContent,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],components:g.getCurrentLevel().data.components.length};});
 assert.equal(report.source.components,api.CARLISLE_TIDAL_RELAY_LEVEL.components.length);
 if(!lite)assert.deepEqual(report.source.canvas,[1440,900]);
 for(const [name,key,station,seconds] of [['downhill','ArrowUp',25,.75],['neutral',null,25,.75],['uphill','ArrowDown',42,1.2]]){
  await place(station);await press(key);const start=await wait(.15),end=await wait(seconds);
  const clip=name==='uphill'?'player.run':'player.slope-slide';check(end,clip);
  if(name==='uphill'){assert.ok(along(end)<-.2);assert.equal(end.normalizedSpeed,1);assert.ok(Math.hypot(...end.velocity)<4);}
  else{assert.ok(along(end)>1);assert.equal(end.phase,start.phase);assert.equal(end.slideTimer,0);}
  await page.screenshot({path:`${out}/${mode}-${name}.png`});
  if(!lite&&name!=='uphill')await inspection(name);
  await wait(.15);await page.screenshot({path:`${out}/${mode}-${name}-next.png`});
  report.cases.push({name,start,end});
 }
 await place(25);await press('ArrowUp');const downhill=await wait(.65);
 await press('ArrowDown');const reversing=await wait(.05);check(reversing,'player.run');assert.ok(along(reversing)>0,'reversal erased momentum');
 const uphill=await wait(1.5);check(uphill,'player.run');assert.ok(along(uphill)<0);
 await press(null);const released=await wait(.8);check(released,'player.slope-slide');assert.ok(along(released)>0);
 report.reversal={downhill,reversing,uphill,released};
 report.jumps=[];
 for(const [name,key,station] of [['downhill','ArrowUp',25],['uphill','ArrowDown',42]]){
  await place(station);await press(key);await wait(.4);
  await page.keyboard.down('Space');await wait(.3);await page.keyboard.up('Space');
  const jump=await wait(.1);assert.equal(jump.state,'air');assert.equal(jump.grounded,false);
  assert.ok(!['player.slope-slide','player.run'].includes(jump.hint));report.jumps.push({name,jump});
 }
 if(!lite){
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});
  await place(25);await press('ArrowUp');await wait(.5);await page.screenshot({path:`${out}/full-normal-downhill.png`});
  await place(42);await press('ArrowDown');await wait(.8);await page.screenshot({path:`${out}/full-normal-uphill.png`});
 }
 assert.deepEqual(report.errors,[]);console.log(JSON.stringify(report));
}catch(error){report.failure={message:error.message,player:await read().catch(()=>null)};throw error;}
finally{await press(null).catch(()=>{});await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
