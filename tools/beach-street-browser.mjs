import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {homedir} from 'node:os';
import {pathToFileURL} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire(import.meta.url);let module;
try{module=require.resolve('playwright');}catch{module=homedir()+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';}
const {chromium}=await import(pathToFileURL(module).href);
const base=(process.env.BEACH_BASE??'http://127.0.0.1:5287/').replace(/\/$/,''),out=process.env.BEACH_OUTPUT??'docs/beach-street';
const full=process.argv.includes('--full'),visual=process.argv.includes('--visual');await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
const report={base,full,visual,started:new Date().toISOString(),errors:[],failed:[],captures:[]};
const timed=async(label,task)=>{console.log('START',label);let timer;try{const result=await Promise.race([task(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(`Deadline: ${label}`)),150000);})]);console.log('DONE',label);return result;}finally{clearTimeout(timer);}};
page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
page.on('response',r=>{if(r.status()>=400)report.failed.push({url:r.url(),status:r.status()});});
const snapshot=()=>page.evaluate(()=>{const g=window.__game,p=g.player,l=g.getLevel();return {position:p.pos.toArray(),grounded:p.grounded,lives:p.lives,deaths:p.totalDeaths,state:p.state,checkpoint:!!l.activeCheckpoint,spawn:l.currentSpawn.toArray(),stamp:document.querySelector('.hud-build')?.textContent};});
const place=async(x,z)=>{
 await page.evaluate(({x,z})=>{
  const g=window.__game,l=g.getLevel(),p=g.player;
  const road=l.builtFromData.components.find(c=>c.grp===1&&(c.s?.[0]===12||c.w===12)&&Math.abs(c.p[2]+z)<=(c.s?.[2]??c.len)/2);
  if(!road)throw Error('No road at '+z);
  const y=road.t==='platform'?road.p[1]+road.s[1]/2:road.p[1]+road.rise*(.5+(road.yaw===180?-1:1)*(z+road.p[2])/road.len);
  p.respawn(l,true,false,{position:p.pos.clone().set(x,y+.14,-z),heading:p.camDir.clone().set(0,0,-1)});p.lives=99;
 },{x,z});await page.waitForTimeout(350);
};
try{
 await timed('document',()=>page.goto(`${base}/?playtest&level=coastal-street-run${full?'':'&lite'}`,{waitUntil:'domcontentloaded',timeout:150000}));
 await timed('game ready',()=>page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='coastal-street-run'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:150000}));
 await timed('source restore and assets',()=>page.evaluate(async()=>{const g=window.__game;g.restoreBuiltin('coastal-street-run');await g.switchLevel('coastal-street-run');g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();}));
 await page.waitForFunction(()=>!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.waitForTimeout(600);report.spawn=await snapshot();assert.ok(report.spawn.grounded);assert.match(report.spawn.stamp,/Codex\/sol fork/);
 report.source=await page.evaluate(()=>{const l=window.__game.getLevel();return {components:l.builtFromData.components.length,enemies:l.enemies.length,kinds:[...new Set(l.enemies.map(e=>e.kind))],mattes:l.builtFromData.components.filter(c=>c.dkind?.endsWith('matte')).length};});
 assert.equal(report.source.enemies,41);assert.equal(report.source.mattes,0);
 if(full)await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 const scenes=process.argv.includes('--polish')?[['cargo',523],['transfer',796],['surf',1540],['gap-approach',415],['stairs',330]]:[['market',112],['stairs',330],['cargo',523],['climb',710],['surf',1540],['festival',1988],['lighthouse',2655]];
 for(const [name,z] of process.argv.includes('--smoke')?[]:scenes){
  await place(0,z);await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());await page.waitForTimeout(500);
  if(full&&['market','stairs','climb','cargo','surf'].includes(name)){
   await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(200);
   await page.screenshot({path:`${out}/presentation-${name}.png`});
   await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});await page.waitForTimeout(200);
  }
  await page.screenshot({path:`${out}/${full?'native':'normal'}-${name}.png`});
  const view=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();let reduced=0;l.root.traverse(o=>{if(o.isMesh&&((o.userData.sceneryLod??0)>0||(o.userData.bwLod??0)>0))reduced++;});return {camera:g.camera.position.toArray(),buffer:[g.renderer.domElement.width,g.renderer.domElement.height],resolution:g.renderQualitySettings.regularResolution,assets:l.jungleAssetDiagnostics,reduced};});
  if(full){assert.deepEqual(view.buffer,[1920,1080]);assert.equal(view.resolution,'max');}assert.equal(view.reduced,0);assert.deepEqual(view.assets?.errors??[],[]);report.captures.push({name,...view});
 }
 if(!visual){
  // Cross both staggered barriers using ordinary on-foot keyboard movement.
  await place(-2.5,117);const before=await snapshot();await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.pos.z<-130,null,{timeout:15000});await page.keyboard.down('ArrowRight');
  await page.waitForFunction(()=>window.__game.player.pos.x>1.25,null,{timeout:10000});await page.keyboard.up('ArrowRight');
  await page.waitForFunction(()=>window.__game.player.pos.z<-149,null,{timeout:15000});await page.keyboard.up('ArrowUp');
  report.chicane=await snapshot();assert.equal(report.chicane.lives,before.lives);assert.ok(report.chicane.position[0]>1);console.log('Chicane passed');
  // A real spin interaction with the first patrol (no invulnerability or kill writes).
  await place(0,90.7);await page.evaluate(()=>{const g=window.__game;g.player.pos.x=g.getLevel().enemies[0].group.position.x;g.player.prevPos.copy(g.player.pos);g.player.invulnTimer=0;});
  const lives=(await snapshot()).lives;await page.keyboard.down('KeyF');await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>!window.__game.getLevel().enemies[0].alive,null,{timeout:15000});
  await page.keyboard.up('ArrowUp');await page.keyboard.up('KeyF');report.combat=await snapshot();assert.equal(report.combat.lives,lives);console.log('Combat passed');
  report.gaps=[];
  await page.evaluate(()=>{const p=window.__game.player,step=p.step.bind(p);p.step=(...args)=>{step(...args);const t=window.__beachJumpTrace;if(t&&t.length<600)t.push({p:p.pos.toArray(),speed:p.speed,grounded:p.grounded,state:p.state,lives:p.lives,charge:p.xHoldT,jumpHeld:args[1].jumpHeld});};});
  for(const [start,end,x] of [[430,441,-3.15],[900,912,3.15],[1810,1823,-3.15],[2680,2694,3.15]]){
   await place(x,start-41);const before=await snapshot();assert.ok(before.grounded,`Gap ${start} approach supported`);await page.evaluate(()=>{window.__beachJumpTrace=[];});await page.keyboard.down('ArrowUp');
   await page.waitForFunction(s=>window.__game.player.pos.z<-(s-33),start,{timeout:18000});await page.keyboard.down('Space');
   // Release through the normal DOM input listener on the browser frame that
   // reaches the lip. A remote wait -> snapshot -> keyup round trip can span
   // several game frames on a busy machine and miss the intended launch point.
   const takeoff=await page.evaluate(start=>new Promise((resolve,reject)=>{
    const begun=performance.now();const tick=()=>{
     const p=window.__game.player;
     if(p.pos.z<-(start-2.5)){
      const result={p:p.pos.toArray(),speed:p.speed,charge:p.xHoldT,skating:p.freeSkate};
      window.dispatchEvent(new KeyboardEvent('keyup',{code:'Space',key:' ',bubbles:true}));resolve(result);
     }else if(performance.now()-begun>15000)reject(Error('Gap approach deadline'));
     else requestAnimationFrame(tick);
    };tick();
   }),start);await page.keyboard.up('Space');
   await page.waitForFunction(({end,lives})=>{const p=window.__game.player;return p.lives<lives||(p.pos.z<-(end+3)&&p.grounded);},{end,lives:before.lives},{timeout:15000});await page.keyboard.up('ArrowUp');
   const after=await snapshot(),trace=await page.evaluate(()=>{const t=window.__beachJumpTrace;window.__beachJumpTrace=null;return t;});report.gaps.push({start,end,takeoff,trace,...after});assert.equal(after.lives,before.lives,`Gap ${start} clears with keyboard`);console.log('Gap passed',start,JSON.stringify(takeoff));
  }
  await place(3.5,796);await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.pos.z<-810&&window.__game.player.grounded,null,{timeout:12000});await page.keyboard.up('ArrowUp');
  report.bank=await snapshot();assert.ok(report.bank.position[1]>9.7,'Walkable bank leads onto the elevated landing');
  const crumbleTop=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),p=g.player,c=l.crumbles[0];c.mesh.geometry.computeBoundingBox();const position=c.base.clone();position.y+=c.mesh.geometry.boundingBox.max.y+.15;p.respawn(l,true,false,{position,heading:p.camDir.clone().set(0,0,-1)});p.lives=99;return position.y-.15;});
  await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.groundHit?.crumbleId===0&&window.__game.getLevel().crumbles[0].state==='shake',null,{timeout:10000});report.crumbleContact=await snapshot();
  await page.waitForFunction(top=>{const g=window.__game;return g.getLevel().crumbles[0].state==='gone'&&g.player.grounded&&g.player.pos.y<top-.7;},crumbleTop,{timeout:15000});
  report.crumbleRecovery=await snapshot();assert.equal(report.crumbleRecovery.lives,report.crumbleContact.lives);console.log('Bank, crumble contact and safe street recovery passed');
  // Confirm the freight load is a live hazard, then weave through both safe
  // opposite lanes with protection disabled and ordinary keyboard movement.
  await place(-3.5,531);await page.evaluate(()=>{window.__game.player.invulnTimer=0;});
  await page.waitForFunction(()=>window.__game.player.lives<99,null,{timeout:12000});report.cargoHit=await snapshot();
  await place(3.4,520);await page.evaluate(()=>{window.__game.player.invulnTimer=0;});await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>window.__game.player.pos.z<-536,null,{timeout:12000});await page.keyboard.down('ArrowLeft');
  await page.waitForFunction(()=>window.__game.player.pos.x<-1.5,null,{timeout:10000});await page.keyboard.up('ArrowLeft');
  await page.waitForFunction(()=>window.__game.player.pos.z<-550,null,{timeout:12000});await page.keyboard.up('ArrowUp');
  report.cargoWeave=await snapshot();assert.equal(report.cargoWeave.lives,99,'Freight lanes offer a safe keyboard route');console.log('Live cargo hazard and safe weave passed');
  await place(-3.5,508);await page.keyboard.down('KeyF');await page.keyboard.down('ArrowUp');
  await page.waitForFunction(()=>!!window.__game.getLevel().activeCheckpoint,null,{timeout:10000});await page.keyboard.up('ArrowUp');await page.keyboard.up('KeyF');
  report.checkpoint=await snapshot();
  await page.evaluate(()=>{const p=window.__game.player;p.pos.set(0,4.15,-435.5);p.grounded=false;p.state='air';p.vVel=-2;p.invulnTimer=0;});
  await page.waitForFunction(n=>window.__game.player.lives<n&&window.__game.player.grounded,report.checkpoint.lives,{timeout:20000});
  report.pitRespawn=await snapshot();assert.ok(report.pitRespawn.checkpoint);assert.ok(Math.hypot(...report.pitRespawn.position.map((v,i)=>v-report.checkpoint.spawn[i]))<3);
  await place(0,2998);await page.keyboard.down('ArrowUp');await page.waitForFunction(()=>window.__game.player.state==='finished',null,{timeout:12000});await page.keyboard.up('ArrowUp');report.finish=await snapshot();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);report.pass=true;
}catch(e){report.pass=false;report.failure=e.stack;report.last=await snapshot().catch(()=>null);throw e;}
finally{for(const key of ['ArrowUp','ArrowRight','ArrowLeft','Space','KeyF'])await page.keyboard.up(key).catch(()=>{});if(report.pass)for(const gap of report.gaps??[])gap.trace=gap.trace.filter((_,i)=>i%6===0);report.finished=new Date().toISOString();await writeFile(`${out}/browser-${full?'native':'lite'}${visual?'-visual':''}.json`,JSON.stringify(report,null,2)+'\n');await browser.close();console.log(JSON.stringify({pass:report.pass,source:report.source,failure:report.failure,last:report.last,errors:report.errors,failed:report.failed}));}
