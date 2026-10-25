import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5267',out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/enemies';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'/?playtest&level=rooftop-relay',{timeout:180000});await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const initial=await page.evaluate(async()=>{
  const g=window.__game,l=g.getLevel();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);await Promise.all(l.enemies.map(e=>e.visual.ready));
  const karen=l.enemies.find(e=>e.kook?.role==='lookout'),gunner=l.enemies.find(e=>e.kook?.role==='gunner'&&e.kook.group===karen.kook.group);
  const marker=window.kookReview={shots:0,alarms:0,group:karen.kook.group};const fire=l.spawnProjectile.bind(l);l.spawnProjectile=(e,...args)=>{if(e===gunner)marker.shots++;return fire(e,...args);};
  const pos=karen.group.position.clone(),yaw=karen.kook.bearing;pos.x+=Math.sin(yaw)*12;pos.z+=Math.cos(yaw)*12;pos.y+=.12;
  g.player.respawn(l,true,false,{position:pos,heading:pos.clone().set(-Math.sin(yaw),0,-Math.cos(yaw))});g.player.invulnTimer=25;
  return l.enemies.filter(e=>e.kook).map(e=>({role:e.kook.role,group:e.kook.group,status:e.visual.diagnostics.status,meshes:e.visual.diagnostics.meshes,skinned:e.visual.diagnostics.skinnedMeshes}));
 });
 assert.equal(initial.length,7);for(const e of initial)assert.equal(e.status,'ready');
 await page.waitForTimeout(1400);await page.screenshot({path:out+'/alarm.png'});
 await page.waitForFunction(()=>window.kookReview.shots>0,null,{timeout:12000});
 const firing=await page.evaluate(()=>{const l=window.__game.getLevel(),k=l.enemies.find(e=>e.kook?.role==='lookout'&&e.kook.group===window.kookReview.group);return {shots:window.kookReview.shots,alarms:k.kook.alarms,awake:l.enemies.filter(e=>e.kook?.role==='gunner').map(e=>({group:e.kook.group,state:e.state}))};});
 assert.ok(firing.alarms>0);assert.ok(firing.shots>0);assert.ok(firing.awake.filter(e=>e.group!==1).every(e=>e.state==='doze'));
 await page.screenshot({path:out+'/gunner.png'});
 const cover=await page.evaluate(()=>{
  const g=window.__game,l=g.getLevel(),enemy=l.enemies.find(e=>e.kook?.role==='gunner'&&e.kook.group===window.kookReview.group);
  const crate=l.crates.filter(c=>c.metal).sort((a,b)=>a.mesh.position.distanceTo(enemy.group.position)-b.mesh.position.distanceTo(enemy.group.position))[0];
  const away=crate.mesh.position.clone().sub(enemy.group.position).setY(0).normalize(),pos=crate.mesh.position.clone().addScaledVector(away,7);pos.y=enemy.baseY+.12;
  const blocked=l.projectilePathBlocked(enemy.group.position.clone().add(pos.clone().set(0,1.85,0)),pos.clone().add(pos.clone().set(0,.8,0)));
  g.player.resetRacePosition(l,pos,away.clone().negate());g.player.invulnTimer=20;
  return {blocked,position:pos.toArray(),before:window.kookReview.shots,awake:enemy.kook.awake,crate:crate.mesh.position.toArray(),box:[crate.box.min.toArray(),crate.box.max.toArray()],gunner:enemy.group.position.toArray()};
 });
 console.log('cover fixture',JSON.stringify(cover));assert.equal(cover.blocked,true);assert.ok(cover.awake>0);await page.waitForTimeout(4500);
 const after=await page.evaluate(()=>window.kookReview.shots);assert.equal(after,cover.before);await page.screenshot({path:out+'/cover.png'});
 const diagnostics=await page.evaluate(()=>window.__game.getLevel().enemies.filter(e=>e.kook).map(e=>{const bounds=[];e.visual.body.traverse(o=>{if(o.isSkinnedMesh){o.computeBoundingBox();const b=o.boundingBox.clone().applyMatrix4(o.matrixWorld);bounds.push({bottom:b.min.y-e.baseY,top:b.max.y-e.baseY});}});return {role:e.kook.role,state:e.state,hands:e.group.userData.kookHandErrors,feet:e.group.userData.kookFootErrors,bounds,status:e.visual.diagnostics.status};}));
 for(const e of diagnostics){assert.equal(e.status,'ready');assert.ok([...(e.hands??[]),...e.feet].every(v=>v<.03),'Enemy contacts must remain planted on a translated rooftop');assert.ok(e.bounds.length>0);for(const b of e.bounds){assert.ok(Math.abs(b.bottom)<.25,'Enemy feet must align with the roof');assert.ok(b.top>2&&b.top<3,'Enemy artwork must stay around its gameplay collider');}}
 await writeFile(out+'/browser.json',JSON.stringify({base,initial,firing,cover,shotsBehindCover:after-cover.before,diagnostics,errors},null,2)+'\n');assert.deepEqual(errors,[]);console.log('PASS',JSON.stringify({firing,cover,diagnostics,errors}));
}finally{await browser.close();}
