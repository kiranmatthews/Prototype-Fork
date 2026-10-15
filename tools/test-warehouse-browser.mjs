// Production acceptance in isolated Chrome saves; the upper route uses continuous inputs.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createWarehousePilot,warehouseDock,warehouseGallery,warehouseUpperJourney,warehouseHalfpipe,warehouseStreetCombo} from './warehouse-pilot.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5321/';
const output=process.env.WAREHOUSE_OUTPUT||'/private/tmp/warehouse-tall-browser';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],reports=[];
const functions={createWarehousePilot,warehouseDock,warehouseGallery,warehouseUpperJourney,warehouseHalfpipe,warehouseStreetCombo};
const sources=Object.fromEntries(Object.entries(functions).map(([name,fn])=>[name,fn.toString()]));
try{
 for(const lite of[true,false]){
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(`${base}?playtest&level=warehouse${lite?'&lite':''}`,{waitUntil:'domcontentloaded',timeout:120000});
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay&&window.__game.player.grounded,null,{timeout:120000});
  const initial=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),d=l.captureData(),roof=d.components.find(c=>c.nm==='Warehouse roof / real ceiling'),floor=d.components.find(c=>c.nm==='Continuous concrete floor');return {stamp:document.querySelector('.hud-build')?.textContent,spawn:g.player.pos.toArray(),roof:roof.p[1]-roof.s[1]/2,floor:floor.s,tokenHeights:l.skateCollectathon.tokens.map(t=>t.y),edgeRails:l.surfaceEdgeRails.length,alwaysSkate:l.alwaysSkate,skating:g.player.freeSkate,draw:g.renderer.info.render};});
  assert.match(initial.stamp,/Codex\/sol fork/);assert.ok(initial.spawn[1]>7.8&&Math.abs(initial.roof-48)<1e-5);assert.equal(initial.tokenHeights.length,5);assert.ok(initial.edgeRails>0);
  assert.equal(initial.alwaysSkate,false);assert.equal(initial.skating,false);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-start.png`});
  await page.keyboard.down('ArrowUp');await page.waitForTimeout(1200);await page.keyboard.up('ArrowUp');
  assert.ok(await page.evaluate(()=>window.__game.player.pos.z<22),'keyboard must move the rider on the raised start');
  assert.equal(await page.evaluate(()=>window.__game.player.freeSkate),false,'ordinary direction remains walking');
  await page.keyboard.down('ArrowUp');await page.keyboard.down('Space');await page.waitForTimeout(1100);
  assert.equal(await page.evaluate(()=>window.__game.player.freeSkate),true,'held jump and direction mount the board');
  await page.keyboard.up('ArrowUp');await page.keyboard.up('Space');await page.keyboard.down('KeyQ');
  await page.waitForFunction(()=>window.__game.player.grounded&&!window.__game.player.freeSkate,null,{timeout:12000});
  await page.keyboard.up('KeyQ');
  await page.evaluate(sources=>{const f=Object.fromEntries(Object.entries(sources).map(([name,source])=>[name,(0,eval)('('+source+')')]));window.__warehouse={...f,pilot:f.createWarehousePilot(window.__game.player,window.__game.getLevel())};},sources);
  const call=(name,hard=false)=>page.evaluate(({name,hard})=>{
   const t=window.__warehouse.pilot,result=window.__warehouse[name](t,hard);
   // Brake in the same continuous input sequence as the roof arrival. A
   // render callback between two evaluate calls may consume a catch-up
   // frame, coasting the rider into the shelf guard before braking starts.
   if(name==='warehouseUpperJourney'){t.stop();result.stopped=t.snapshot();}
   return result;
  },{name,hard});
  const halfpipe=await call('warehouseHalfpipe',true);assert.ok(halfpipe.reached&&halfpipe.launched&&!halfpipe.bail);
  const combo=await call('warehouseStreetCombo',true);assert.ok(combo.reached&&combo.maxMult>=2&&combo.points>0&&!combo.bail);
  await page.waitForTimeout(250);await page.screenshot({path:`${output}/${lite?'lite':'full'}-street.png`});
  const dock=await call('warehouseDock',true);assert.ok(dock.reached&&!dock.bail);
  const gallery=await call('warehouseGallery');assert.ok(gallery.grind.reached&&!gallery.grind.bail);
  const upper=await call('warehouseUpperJourney');
  for(const s of upper.stages){assert.ok(s.reached??s.index===s.total,s.name);assert.equal(s.bail,false,s.name);}
  assert.equal(upper.tokens,5);assert.ok(upper.pos[1]>=31.9);
  assert.ok(upper.stopped.grounded&&!upper.stopped.bail&&upper.stopped.pos[1]>=31.9,'brake safely on the roof shelf');
  await page.evaluate(()=>window.__warehouse.pilot.stop());await page.waitForTimeout(300);
  await page.screenshot({path:`${output}/${lite?'lite':'full'}-roof.png`});
  const returnPath=await page.evaluate(()=>window.__warehouse.pilot.rideRibbon('Upper return to gantry',{speed:12}));
  assert.equal(returnPath.index,returnPath.total);assert.ok(!returnPath.bail&&Math.abs(returnPath.pos[1]-28)<.2);
  const checkpoint=await page.evaluate(()=>{const g=window.__game,t=window.__warehouse.pilot,cp=g.getLevel().checkpoints.find(c=>Math.abs(c.spawnPos.y-28.1)<.1);t.place([cp.spawnPos.x,cp.box.max.y+2,cp.spawnPos.z],[0,0,-1],false);return t.run(()=>cp.active,{},180);});assert.ok(checkpoint.reached);
  const snap=await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.y=g.getLevel().killY-8;p.prevPos.copy(p.pos);p.grounded=false;return p.renderSnapVersion;});
  await page.waitForFunction(snap=>{const p=window.__game.player;return p.grounded&&p.state!=='dead'&&p.renderSnapVersion!==snap;},snap,{timeout:20000});
  const recovered=await page.evaluate(()=>({position:window.__game.player.pos.toArray(),tokens:window.__game.getLevel().skateCollectathon.collected}));assert.equal(recovered.tokens,5);assert.ok(recovered.position[1]>27.8);
  const finish=await page.evaluate(()=>{const t=window.__warehouse.pilot;t.place([-53,9,23],[0,0,-1],false);return t.run(()=>t.p.state==='finished',{},90);});assert.ok(finish.reached);
  const restart=await page.evaluate(()=>{const t=window.__warehouse.pilot;t.place([-53,9,23],[0,0,-1],true);for(let i=0;i<60;i++)t.tick();return t.snapshot();});assert.equal(restart.tokens,0);assert.notEqual(restart.state,'finished');
  if(!lite){
   // Inspection-only cutaway, restored before resuming gameplay.
   const png=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),d=l.captureData(),hidden=[];
    l.root.traverse(o=>{const nm=d.components[o.userData.editorIdx]?.nm??'';if(/roof \/ real|Roof truss|Roof longitudinal|Ceiling strip/.test(nm)&&o.visible){hidden.push(o);o.visible=false;}});
    const c=g.camera.clone();c.position.set(150,225,150);c.up.set(0,1,0);c.lookAt(0,9,-86);c.fov=46;c.far=1000;c.updateProjectionMatrix();
    const target=g.renderer.getRenderTarget(),fog=g.scene.fog;g.scene.fog=null;g.renderer.setRenderTarget(null);g.renderer.render(g.scene,c);const png=g.renderer.domElement.toDataURL('image/png');g.scene.fog=fog;g.renderer.setRenderTarget(target);for(const o of hidden)o.visible=true;return png;
   });await writeFile(`${output}/overview.png`,Buffer.from(png.split(',')[1],'base64'));
   await page.setViewportSize({width:390,height:844});await page.waitForTimeout(400);await page.screenshot({path:`${output}/portrait.png`});
   const rect=await page.locator('.hud-park-goal').boundingBox();assert.ok(rect&&rect.x>=0&&rect.x+rect.width<=390);
  }
  reports.push({lite,initial,halfpipe,combo,dock,gallery,upper,returnPath,checkpoint,recovered,finish,restart});
  console.log(`PASS ${lite?'lite':'full'} public-shaped build: raised spawn, halfpipe, curved combo, all five tokens, continuous roof journey, return, checkpoint, respawn and finish`);
  await page.close();
 }
 assert.deepEqual(errors,[]);
}finally{await writeFile(`${output}/results.json`,JSON.stringify({base,reports,errors},null,2));await browser.close();}
