import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'/private/tmp/rooftop-anthro/game';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const report={base,errors};
try{
 await page.goto(base+'/?playtest&level=rooftop-relay',{timeout:180000});await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.loaded=await page.evaluate(async()=>{const g=window.__game,l=g.getLevel();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);await Promise.all(l.enemies.map(e=>e.visual.ready));g.player.invulnTimer=999;window.anthroReview={start:l.enemies.map(e=>e.group.position.clone()),shots:0};return l.enemies.map(e=>({role:e.kook.role,status:e.visual.diagnostics.status,components:e.group.userData.meshyComponents,rig:e.group.userData.rigContract,position:e.group.position.toArray()}));});
 assert.equal(report.loaded.length,7);for(const e of report.loaded){assert.equal(e.status,'ready');assert.ok(e.components>=10);assert.equal(e.rig,'bone-man semantic humanoid');}
 await page.waitForTimeout(2300);
 report.patrol=await page.evaluate(()=>{const l=window.__game.getLevel();return l.enemies.map((e,i)=>({moved:e.group.position.distanceTo(window.anthroReview.start[i]),state:e.state,feet:e.group.userData.kookFootErrors,hand:e.group.userData.kookHandErrors}));});
 assert.ok(report.patrol.every(e=>e.moved>.15),'Every animal strolls');
 await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),goose=l.enemies.find(e=>e.kook.role==='lookout');window.anthroReview.goose=goose;const p=goose.group.position.clone();p.z+=12;p.y+=.1;
  g.player.respawn(l,true,false,{position:p,heading:p.clone().set(0,0,-1)});g.player.invulnTimer=999;
  const original=l.spawnProjectile.bind(l);l.spawnProjectile=(...a)=>{window.anthroReview.shots++;return original(...a);};
 });
 await page.waitForFunction(()=>window.anthroReview.goose.state==='shriek'&&window.anthroReview.goose.stateT>.2,null,{timeout:20000});
 report.squawk=await page.evaluate(()=>{const e=window.anthroReview.goose,b=e.group.userData.kookSquawk;return {state:e.state,active:b.active,length:b.length,origin:b.origin.toArray(),direction:b.direction.toArray()};});assert.equal(report.squawk.active,true);assert.ok(report.squawk.length>2);
 await page.screenshot({path:out+'/native-squawk.png'});
 await page.evaluate(()=>{const g=window.__game;g.crtGuestSettings.setEnabled(true);g.renderQualitySettings.setRegularResolution(480);});
 await page.waitForFunction(()=>window.anthroReview.goose.state==='shriek'&&window.anthroReview.goose.stateT>.2,null,{timeout:20000});await page.screenshot({path:out+'/crt-squawk.png'});
 // Every goose is disabled: independently acquiring gunners must still shoot.
 report.independent=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel();for(const e of l.enemies)if(e.kook.role==='lookout'){e.alive=false;e.group.visible=false;}
  const e=l.enemies.find(e=>e.kook.role==='gunner');window.anthroReview.gunner=e;e.state='patrol';e.stateT=0;e.kook.exposure=0;
  const eye=e.group.position.clone();eye.y+=1.85*e.body.scale.y;let p=null;
  for(const radius of [7,5,10])for(let i=0;i<24&&!p;i++){const q=e.group.position.clone();q.x+=Math.sin(i*Math.PI/12)*radius;q.z+=Math.cos(i*Math.PI/12)*radius;const floor=l.nearbyFloorY(q.x,q.z,e.baseY);if(floor===null||Math.abs(floor-e.baseY)>2)continue;q.y=floor+.1;const target=q.clone();target.y+=.8;if(!l.projectilePathBlocked(eye,target))p=q;}
  if(!p)throw Error('No clear supported encounter position');g.player.respawn(l,true,false,{position:p,heading:p.clone().set(0,0,-1)});g.player.invulnTimer=999;
  // Respawn restores enemies; suppress lookouts after the transition as well.
  for(const q of l.enemies)if(q.kook.role==='lookout'){q.alive=false;q.group.visible=false;}
  g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);return {before:window.anthroReview.shots};
 });
 await page.waitForFunction(()=>window.anthroReview.gunner.kook.shots>0,null,{timeout:15000});await page.screenshot({path:out+'/native-gunner.png'});
 report.finished=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {shots:window.anthroReview.shots,gunners:l.enemies.filter(e=>e.kook.role==='gunner').map(e=>({state:e.state,shots:e.kook.shots,hand:e.group.userData.kookHandErrors})),buffer:[g.renderer.domElement.width,g.renderer.domElement.height],render:g.renderer.info.render,memory:g.renderer.info.memory,stamp:document.querySelector('.hud-build')?.textContent};});
 assert.deepEqual(report.finished.buffer,[2560,1440]);assert.ok(report.finished.shots>report.independent.before);assert.deepEqual(errors,[]);
 if(process.env.ANTHRO_LIFECYCLE){
  report.reentry=[];
  for(let cycle=0;cycle<3;cycle++){
   await page.evaluate(()=>window.__game.switchLevel('codex-lab'));
   await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
   await page.evaluate(()=>window.__game.switchLevel('rooftop-relay'));
   await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
   await page.evaluate(async()=>{const g=window.__game,l=g.getLevel();await l.prepareJungleAssets();const p=l.enemies[0].group.position.clone();p.z+=12;p.y+=.1;g.player.respawn(l,true,false,{position:p,heading:p.clone().set(0,0,-1)});g.player.invulnTimer=999;});
   await page.waitForTimeout(1800);
   report.reentry.push(await page.evaluate(()=>{const g=window.__game;return {memory:{...g.renderer.info.memory},ready:g.getLevel().enemies.filter(e=>e.visual.diagnostics.status==='ready').length};}));
  }
  assert.ok(report.reentry.every(r=>r.ready===7));
  const first=report.reentry[0].memory,last=report.reentry.at(-1).memory;
  assert.ok(last.geometries<=first.geometries+2&&last.textures<=first.textures+2,'Native assets and skeleton textures plateau across re-entry');assert.deepEqual(errors,[]);
 }
 console.log('PASS rooftop animal patrols, squawk, independent gunfire, native and CRT',JSON.stringify(report));
}catch(error){report.failure=await page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {player:g.player.pos.toArray(),enemies:l.enemies.map(e=>({role:e.kook?.role,pos:e.group.position.toArray(),state:e.state,alive:e.alive,exposure:e.kook?.exposure,shots:e.kook?.shots}))};}).catch(()=>null);await page.screenshot({path:out+'/failure.png'}).catch(()=>{});throw error;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
