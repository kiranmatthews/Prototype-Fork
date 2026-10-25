import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv[2]||'http://127.0.0.1:5461/';
const out=process.env.BEACON_REVIEW_OUT||new URL('../docs/beacon-platforms/',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={gallery:null,modes:[],errors:[]};
try{
  if(!process.env.BEACON_SKIP_GALLERY){
    const page=await browser.newPage({viewport:{width:1600,height:1000}});
    page.on('pageerror',e=>report.errors.push(e.message));
    page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});
    await page.goto(new URL('tools/beacon-platforms/review.html',base).href);
    await page.waitForFunction(()=>window.__beaconReview,null,{timeout:120000});
    await page.screenshot({path:out+'/pair.png'});
    report.gallery=await page.evaluate(async()=>{
      const {pads,THREE,renderer,scene,render,releaseLostGraphicsResources}=window.__beaconReview;
      const {createWarpPad}=await import('/src/warpPad.ts');
      const samples=[];
      for(const pad of pads){
        if(pad.group.userData.beaconPlatformState!=='ready')throw Error('Procedural art did not initialize');
        pad.group.updateMatrixWorld(true);
        const art=pad.group.children.find(c=>c.name.startsWith('Procedural '));
        let drawCount=0;art.traverse(o=>{if(o.isMesh)drawCount++});
        for(const radius of [0,.3,.65,1.05])for(let i=0;i<12;i++){
          const a=i/12*Math.PI*2,from=new THREE.Vector3(Math.cos(a)*radius,2,Math.sin(a)*radius).add(pad.group.position);
          const ray=new THREE.Raycaster(from,new THREE.Vector3(0,-1,0),0,3);
          const surfaces=[];art.traverse(o=>{if(o.userData.beaconSurface)surfaces.push(o)});
          const physical=ray.intersectObjects(pad.solids,false)[0],visual=ray.intersectObjects(surfaces,false)[0];
          if(!physical||!visual)throw Error('Open or unsupported standing deck');
          if(Math.abs(physical.point.y-visual.point.y)>.045)throw Error('Feet do not meet the visible deck');
          samples.push(Math.abs(physical.point.y-visual.point.y));
        }
        if(drawCount>12)throw Error('Procedural beacon exceeded its bounded draw budget');
        const shaders=[];art.traverse(o=>{if(o.material?.isShaderMaterial)shaders.push(o.material)});
        if(shaders.length<3)throw Error('Missing procedural light layers');
        const before=shaders[0].uniforms.time.value;pad.update(.05);
        if(shaders[0].uniforms.time.value===before)throw Error('Beacon light is not animated');
      }
      const original=pads[0],duplicate=createWarpPad({quiet:true,arrival:true});scene.add(duplicate.group);
      await duplicate.ready;
      const meshes=p=>{const a=[];p.group.traverse(o=>{if(o.isMesh&&o.userData.visualOnly)a.push(o)});return a;};
      const a=meshes(original)[0],b=meshes(duplicate)[0];
      if(a.geometry!==b.geometry||a.material!==b.material)throw Error('Repeated pads do not share their model');
      let destroyed=0;a.geometry.addEventListener('dispose',event=>{if(!event.graphicsReset)destroyed++});
      releaseLostGraphicsResources([original.group,duplicate.group]);
      if(destroyed||original.group.userData.beaconPlatformState!=='ready')throw Error('Graphics reset released a live model');
      duplicate.dispose();scene.remove(duplicate.group);
      if(destroyed)throw Error('A live pad lost its shared geometry');
      const cancelled=createWarpPad({quiet:true,arrival:true});cancelled.dispose();await cancelled.ready;
      if(cancelled.group.children.some(c=>c.name.startsWith('Procedural ')))throw Error('A disposed pad accepted a late download');
      render();
      const result={samples:samples.length,maxDeckGap:Math.max(...samples),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,
        shared:true,graphicsReset:true,lateLoadGuard:true};
      original.dispose();original.dispose();
      if(destroyed!==1)throw Error('The final model lease was not released exactly once');
      pads[1].dispose();return result;
    });
    await page.close();
    console.log('PASS asset gallery, visible deck alignment, shared resources, graphics reset and late-load disposal');
  }
  for(const lite of [true,false]){
    const mode=lite?'lite':'full',page=await browser.newPage({viewport:{width:1440,height:900}});
    page.on('pageerror',e=>{report.errors.push(mode+': '+e.message);console.error(mode+': '+e.message)});
    page.on('console',m=>{if(m.type()==='error'){report.errors.push(mode+': '+m.text());console.error(mode+': '+m.text())}});
    await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
    await page.goto(base+`?playtest&level=codex-lab${lite?'&lite':''}`);
    console.log(mode+' game page loaded');
    await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:240000}).catch(async error=>{
      await page.screenshot({path:out+'/'+mode+'-loading-failure.png'});
      console.error(JSON.stringify({errors:report.errors,state:await page.evaluate(()=>({game:!!window.__game,phase:window.__game?.gameFlow.loadingPhase,text:document.body.innerText.slice(-1800)}))}));
      throw error;
    });
    await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
    const sample=()=>page.evaluate(()=>{const g=window.__game,l=g.getLevel();return {name:l.name,position:g.player.pos.toArray(),grounded:g.player.grounded,
      state:g.player.state,deaths:g.player.totalDeaths,snap:g.player.renderSnapVersion,currentSpawn:l.currentSpawn.toArray(),
      pads:l.warpPads.map(p=>({kind:p.group.userData.beaconPlatform,state:p.group.userData.beaconPlatformState,solids:p.solids.length})),
      checkpoint:l.checkpoints.findIndex(c=>c.active),build:document.querySelector('.hud-build')?.textContent}});
    await page.waitForFunction(()=>window.__game.player.grounded);
    const row={mode,start:await sample()};report.modes.push(row);
    assert.match(row.start.build,/Codex\/sol fork/);assert.equal(row.start.pads.length,2);
    assert.ok(row.start.pads.every(p=>p.state==='ready'&&p.solids===3));
    assert.deepEqual(new Set(row.start.pads.map(p=>p.kind)),new Set(['arrival','finish']));
    await page.screenshot({path:out+'/'+mode+'-start.png'});
    await page.keyboard.down('ArrowUp');
    await page.waitForFunction(from=>{const p=window.__game.player;return p.grounded&&Math.hypot(p.pos.x-from[0],p.pos.z-from[2])>2.1},row.start.position,{timeout:15000});
    await page.keyboard.up('ArrowUp');row.walkOff=await sample();assert.equal(row.walkOff.deaths,row.start.deaths);
    await page.keyboard.press('Space',{delay:160});
    await page.waitForFunction(()=>!window.__game.player.grounded,null,{timeout:5000});
    await page.waitForFunction(()=>window.__game.player.grounded,null,{timeout:15000});row.landing=await sample();
    await page.keyboard.press('KeyM'); // K/L belong to the visible debug controls.
    await page.keyboard.press('KeyL');
    await page.waitForFunction(()=>window.__game.getLevel().checkpoints.some(c=>c.active)&&window.__game.player.grounded,null,{timeout:15000});
    row.checkpoint=await sample();
    await page.keyboard.press('KeyM');
    await page.evaluate(()=>{const g=window.__game,p=g.player;p.pos.x=20000;p.vVel=-6;p.grounded=false;p.state='air';});
    await page.waitForFunction(snap=>{const p=window.__game.player;return p.renderSnapVersion>snap&&p.grounded&&Math.abs(p.pos.x)<10000},row.checkpoint.snap,{timeout:30000});
    row.respawn=await sample();
    assert.ok(Math.hypot(...row.respawn.position.map((v,i)=>v-row.checkpoint.currentSpawn[i]))<1,'pit did not return to the earned checkpoint');
    await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),p=g.player,gate=l.gateSpec;
      p.respawn(l,true,false,{position:p.pos.clone().set(gate.x,gate.y+1,gate.z+4.5),heading:p.camDir.clone().set(0,0,-1)});
    });
    await page.waitForFunction(()=>window.__game.player.grounded);
    await page.waitForTimeout(400);
    await page.screenshot({path:out+'/'+mode+'-finish.png'});
    await page.evaluate(()=>{
      const g=window.__game,l=g.getLevel(),p=g.player,gate=l.gateSpec;
      p.respawn(l,true,false,{position:p.pos.clone().set(gate.x,gate.y+.82,gate.z),heading:p.camDir.clone().set(0,0,-1)});
    });
    await page.waitForFunction(()=>window.__game.player.state==='finished'||window.__game.gameFlow.blocksGameplay,null,{timeout:15000});
    row.finish=await sample();assert.equal(row.finish.state,'finished');
    await page.close();console.log(`PASS ${mode}: loaded procedural pair, supported arrival, walk-off, jump, checkpoint, pit respawn and finish`);
  }
  assert.deepEqual(report.errors,[]);
}finally{
  await writeFile(out+'/browser-review.json',JSON.stringify(report,null,2)+'\n');
  await browser.close();
}
