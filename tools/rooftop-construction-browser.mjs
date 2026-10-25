import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5269').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/construction-seams/production';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),report={base,runs:[],errors:[],failed:[]};
try{
 for(const lite of [true,false]){
  const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'});
  page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)report.failed.push({url:r.url(),status:r.status()});});
  await page.goto(`${base}/?playtest&level=rooftop-relay${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),p=g.player,c=l.crumbles[0];
   g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);
   c.mesh.geometry.computeBoundingBox();const top=c.base.y+c.mesh.geometry.boundingBox.max.y;
   const safe=c.base.clone().add(p.pos.clone().set(Math.sin(c.yaw)*13,0,Math.cos(c.yaw)*13));safe.y=top+.15;
   window.__deckSafe=safe;window.__deckHeading=p.camDir.clone().set(-Math.sin(c.yaw),0,-Math.cos(c.yaw));
   p.respawn(l,true,false,{position:safe,heading:window.__deckHeading});
  });
  await page.waitForFunction(()=>window.__game.player.grounded);await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
  await page.waitForTimeout(700);
  if(!lite)await page.screenshot({path:out+'/approach.png'});
  const initial=await page.evaluate(()=>{
   const g=window.__game,l=g.getLevel(),c=l.crumbles[0],meshes=[];
   c.mesh.traverse(o=>{if(o.isInstancedMesh&&o.userData.woodPathMeshFamily==='plank')meshes.push({count:o.count,vertices:o.geometry.attributes.position.count,triangles:o.geometry.index.count/3});});
   const probe={age:0,states:[],drop:null,returned:null};window.__deckProbe=probe;
   const update=l.update.bind(l);l.update=dt=>{const before=c.state;update(dt);probe.age+=dt;if(before!==c.state)probe.states.push({state:c.state,age:probe.age,solid:l.groundMeshes.includes(c.mesh)});if(before==='shake'&&c.state==='fall')probe.drop=probe.age;if(probe.drop!==null&&probe.returned===null&&c.state==='idle')probe.returned=probe.age-probe.drop;};
   const pos=c.base.clone();pos.y+=c.mesh.geometry.boundingBox.max.y+.15;
   g.player.respawn(l,true,false,{position:pos,heading:window.__deckHeading});
   return {meshes,stamp:document.querySelector('.hud-build')?.textContent,buffer:[g.renderer.domElement.width,g.renderer.domElement.height]};
  });
  assert.deepEqual(initial.buffer,lite?[1280,720]:[2560,1440]);assert.ok(initial.meshes.length>0);assert.match(initial.stamp,/Codex\/sol fork/);
  await page.waitForFunction(()=>window.__game.player.grounded&&window.__game.player.groundHit?.crumbleId===0&&window.__game.getLevel().crumbles[0].state==='shake',null,{polling:16});
  const landed=await page.evaluate(()=>({state:window.__game.player.state,grounded:window.__game.player.grounded,crumble:window.__game.player.groundHit.crumbleId}));
  // Move to the adjacent original roof after the actual player triggered it;
  // retain the level clock and its normal collapse/return animation.
  await page.evaluate(()=>{const p=window.__game.player;p.pos.copy(window.__deckSafe);p.prevPos.copy(p.pos);p.speed=0;p.vVel=0;p.grounded=false;});
  await page.waitForFunction(()=>window.__game.getLevel().crumbles[0].state==='gone',null,{timeout:15000});
  if(!lite)await page.screenshot({path:out+'/collapsed.png'});
  await page.waitForFunction(()=>window.__deckProbe.returned!==null,null,{timeout:20000});
  const restored=await page.evaluate(()=>{const g=window.__game,c=g.getLevel().crumbles[0];return {probe:window.__deckProbe,position:c.mesh.position.toArray(),base:c.base.toArray(),scale:c.mesh.scale.toArray(),visible:c.mesh.visible,supported:g.player.grounded};});
  assert.ok(restored.probe.returned>=9.98&&restored.probe.returned<=10.04);assert.deepEqual(restored.position,restored.base);assert.deepEqual(restored.scale,[1,1,1]);assert.ok(restored.visible&&restored.supported);
  assert.ok(restored.probe.states.some(s=>s.state==='gone'&&!s.solid));
  if(!lite)await page.screenshot({path:out+'/restored.png'});
  report.runs.push({lite,initial,landed,restored});await page.close();
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.failed,[]);
 console.log('PASS actual rooftop player landing, native Meshy boards, collapse/return and supported adjacent roof in lite/full 2560x1440');
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
