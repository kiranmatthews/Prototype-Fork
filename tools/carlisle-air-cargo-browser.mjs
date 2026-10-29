import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {airCargoPilot} from './carlisle-air-cargo-pilot.mjs';
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const api=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const lite=process.argv.includes('--lite'),normal=process.argv.includes('--normal'),mode=lite?'lite':normal?'normal':'full',base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483';
const out='docs/carlisle-relay/air-cargo';await mkdir(out,{recursive:true});
const report={base,mode,errors:[],flights:[],views:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const keys=new Set();
async function press(input){
 const next=new Set();if(input.jumpHeld)next.add('Space');if(input.moveY)next.add(input.moveY>0?'ArrowUp':'ArrowDown');if(input.moveX)next.add(input.moveX>0?'ArrowRight':'ArrowLeft');if(input.spinHeld)next.add('KeyF');
 for(const key of [...keys])if(!next.has(key)){await page.keyboard.up(key);keys.delete(key);}
 for(const key of next)if(!keys.has(key)){await page.keyboard.down(key);keys.add(key);}
}
const observe=()=>page.evaluate(()=>{const g=window.__game,p=g.player,f=p.courseInputDirection(g.getLevel())??p.camDir;return{at:p.pos.toArray(),forward:[f.x,0,f.z],side:[-f.z,0,f.x],spring:p.trampolineAir,vy:p.vVel,grounded:p.grounded,state:p.state,deaths:p.totalDeaths,bail:p.isBailing,mounted:p.freeSkate,broken:p.cratesBroken,time:p.runTime};});
try{
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.source=await page.evaluate(async normal=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(normal?480:null);g.crtGuestSettings.setEnabled(normal);return{components:g.getCurrentLevel().data.components.length,crates:g.getLevel().crates.length,nitro:g.getLevel().crates.filter(c=>c.nitro).length,grounds:g.getLevel().groundMeshes.length,art:g.getLevel().carlisleShipyardDiagnostics.status,build:document.querySelector('.hud-build')?.textContent};},normal);
 assert.equal(report.source.components,api.CARLISLE_TIDAL_RELAY_LEVEL.components.length);assert.equal(report.source.nitro,22);assert.equal(report.source.grounds,334);assert.equal(report.source.art,'ready');
 const encounters=api.CARLISLE_RELAY_AIR_CARGO;
 for(const encounter of encounters.filter(e=>(lite?['Socket starboard gap']:normal?['Storm crosswind row']:['Socket starboard gap','Storm crosswind row','Rigging port gap']).includes(e.name))){
  const jump=api.CARLISLE_RELAY_JUMPS.find(j=>j.name===encounter.jump),target=api.carlislePoint(...jump.to);
  // Keep held Jump across the respawn, without a fresh jump/board-mount edge.
  await press({jumpHeld:true});await page.waitForTimeout(80);
  await page.evaluate(name=>{const g=window.__game,l=g.getLevel(),p=g.player,c=g.getCurrentLevel().data.components.find(c=>c.nm===name&&(c.t==='trampoline'||c.t==='mover')),m=c.t==='mover'?l.movers.find(m=>m.mesh.name===name):null;
   const at=m?m.mesh.position.clone().add(p.pos.clone().set(0,c.s[1]/2+.15,0)):p.pos.clone().set(c.p[0],c.p[1]+.15,c.p[2]);
   p.respawn(l,true,false,{position:at,heading:p.pos.clone().set(0,0,-1)});p.totalDeaths=0;p.freeSkate=false;p.speed=0;p.masks=0;
  },jump.name);
  // External keyboard polling spans multiple game frames; use a wider stop
  // band so the test driver does not chatter left/right around the waypoint.
  const pilot=airCargoPilot(encounter,target,{sideDeadzone:.85}),samples=[];let launched=false,landed=false,shot=false,previous=0;
  for(let i=0;i<500;i++){
   const p=await observe();samples.push(p);
   if(p.spring&&p.vy>15)launched=true;
   if(p.deaths||p.state==='dead'||p.bail)break;
   if(launched&&samples.length>8&&(p.grounded||previous<0&&p.vy>15)){landed=true;break;}
   previous=p.vy;await press(pilot(p));
   if(launched&&!shot&&p.vy>10&&p.vy<20){shot=true;await page.screenshot({path:`${out}/${mode}-${encounter.name.toLowerCase().replaceAll(' ','-')}-approach.png`});}
   await page.waitForTimeout(16);
  }
  await press({});const end=await observe(),distance=Math.hypot(...end.at.map((v,i)=>v-target[i]));
  const row={name:encounter.name,launched,landed,distance,end,samples};report.flights.push(row);
  assert.ok(landed&&!end.deaths&&!end.bail&&distance<15,JSON.stringify({...row,samples:undefined}));
  assert.ok(end.broken>=2,'real keyboard spin did not collect the airborne cluster');
 }
 // Close views preserve the native scene, authored crate shapes and lighting.
 for(const encounter of (normal?[]:lite?encounters.slice(0,2):encounters)){
  const data=await page.evaluate(e=>{const g=window.__game,p=g.player;p.respawn(g.getLevel(),true,false,{position:p.pos.clone().set(e.center[0],e.center[1],e.center[2])});
   const camera=g.camera.clone(),side=e.side;camera.position.set(e.center[0]+side[0]*10-side[2]*12,e.center[1]+11,e.center[2]+side[2]*10+side[0]*12);camera.fov=48;camera.lookAt(e.center[0],e.center[1]+.5,e.center[2]);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   const visible=p.group.visible;p.group.visible=false;g.renderer.render(g.scene,camera);const result=g.renderer.domElement.toDataURL('image/png');p.group.visible=visible;return result;
  },encounter);
  const id=encounter.name.toLowerCase().replaceAll(' ','-');await writeFile(`${out}/${mode}-${id}.png`,Buffer.from(data.split(',')[1],'base64'));report.views.push(id);
 }
 if(!lite){
  await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);g.player.respawn(g.getLevel(),true);});
  await page.waitForTimeout(200);await page.screenshot({path:out+'/normal-spawn.png'});
 }
 assert.deepEqual(report.errors,[]);
 report.passed=true;
}catch(error){report.failure={message:error.message,player:await observe()};throw error;}
finally{await press({}).catch(()=>{});if(report.passed)report.flights=report.flights.map(({samples,...row})=>row);await writeFile(`${out}/${mode}-browser.json`,JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify({...report,flights:report.flights.map(({samples,...row})=>row)}));
