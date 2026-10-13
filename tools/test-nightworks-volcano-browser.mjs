import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(v=>/^http/.test(v))||'http://127.0.0.1:5236/';
const output=process.env.VOLCANO_REVIEW_OUTPUT||'/private/tmp/nightworks-volcano-performance';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const rows=[];
try{
  await page.goto(`${base}?playtest&level=nightworks-after-hours`);
  await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
  await page.evaluate(async()=>{const g=window.__game;await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages()]);g.player.step=()=>{};});
  const pulse=await page.evaluate(()=>{
    const g=window.__game,r=g.renderer;
    const volcano=g.getLevel().root.getObjectByName('Monumental caldera horizon');
    if(!volcano?.material.map?.image)throw Error('No loaded caldera painting');
    if(!volcano.userData.visualOnly)throw Error('Horizon must remain non-colliding');
    let basalt=0;
    g.getLevel().root.traverse(o=>{
      if(o.userData.jungleAsset?.startsWith('nightbasalt')){
        basalt++;
        if(o.userData.solidSurface!=='none')throw Error('Basalt scenery must not create contacts');
        if(!o.material.map?.isCompressedTexture)throw Error('Basalt must have a loaded compressed atlas');
      }
    });
    if(!basalt)throw Error('No 3D caldera formations loaded');
    const clone=volcano.clone(false),scene=new g.scene.constructor(),camera=new g.camera.constructor(38,1.6,.1,2000);
    clone.position.set(0,0,0);clone.updateMatrix();scene.add(clone);
    camera.position.set(0,0,0);camera.lookAt(0,0,-1);camera.updateMatrixWorld(true);
    const clock=clone.material.userData.magmaClock,time=clock.value,target=r.getRenderTarget();
    const w=r.domElement.width,h=r.domElement.height,gl=r.getContext(),a=new Uint8Array(w*h*4),b=new Uint8Array(w*h*4);
    try{
      r.setRenderTarget(null);r.setViewport(0,0,w,h);
      clock.value=0;r.clear();r.render(scene,camera);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,a);
      clock.value=3;r.clear();r.render(scene,camera);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,b);
      let red=0,changed=0,delta=0;
      for(let i=0;i<a.length;i+=4){
        if(a[i]>a[i+1]*2&&a[i]>a[i+2]*2&&a[i]>70){red++;const d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2]);if(d>3)changed++;delta+=d;}
      }
      return {redPixels:red,animatedRedPixels:changed,totalRedDifference:delta,loadedBasaltFormations:basalt,
        triangles:clone.geometry.index.count/3,textureSize:[clone.material.map.image.width,clone.material.map.image.height]};
    }finally{clock.value=time;r.setRenderTarget(target);r.setViewport(0,0,w,h);scene.remove(clone);}
  });
  assert.ok(pulse.loadedBasaltFormations>0);assert.ok(pulse.redPixels>1000,'distinct molten channels must render');
  assert.ok(pulse.animatedRedPixels>pulse.redPixels*.2,'the actual volcano shader visibly animates the lava');
  const smoke=await page.evaluate(async()=>{
    const root=window.__game.getLevel().root.getObjectByName('Distant Gouraud caldera smoke');
    if(!root)throw Error('No separate animated Gouraud plume');
    const meshes=root.children.filter(o=>o.isMesh);
    const before=meshes.map(m=>Array.from(m.geometry.attributes.position.array));
    await new Promise(resolve=>setTimeout(resolve,800));
    let moved=0;
    for(let j=0;j<meshes.length;j++){
      const positions=meshes[j].geometry.attributes.position.array;
      for(let i=0;i<positions.length;i++)if(Math.abs(positions[i]-before[j][i])>.01)moved++;
    }
    return {batches:meshes.length,movedCoordinates:moved,
      vertexGouraud:meshes.every(m=>m.material.map===null&&m.geometry.attributes.color.itemSize===4),
      activeTriangles:meshes.reduce((n,m)=>n+m.geometry.drawRange.count/3,0)};
  });
  assert.ok(smoke.vertexGouraud,'smoke uses untextured interpolated vertex colour/alpha');
  assert.ok(smoke.movedCoordinates>100,'the separate plume must actually move and deform');
  assert.ok(smoke.batches<=2&&smoke.activeTriangles<2500,'bounded distant smoke draw budget');
  for(const [id,point,name]of [
    ['nightworks-after-hours',[0,10.1,10],'arrival'],
    ['nightworks-after-hours',[-8,12.1,-180],'cutbacks'],
    ['nightworks-after-hours',[132,36.1,-675],'summit'],
    ['bonus-nightworks-after-hours',[29,6.1,0],'bonus-crucible'],
  ]){
    await page.evaluate(async({id,point})=>{const g=window.__game;if(g.getCurrentLevel().id!==id)g.switchLevel(id);
      await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages()]);
      g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().fromArray(point),heading:g.player.pos.clone().set(0,0,-1)});
    },{id,point});
    await page.waitForTimeout(900);
    const row=await page.evaluate(async()=>{const g=window.__game,dt=[],calls=[],tris=[];let last=0;
      await new Promise(resolve=>{function frame(t){if(last){dt.push(t-last);calls.push(g.getRenderFrameStats().calls);tris.push(g.getRenderFrameStats().triangles);}last=t;if(dt.length<150)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
      dt.sort((a,b)=>a-b);return {medianFrameMs:dt[75],p95FrameMs:dt[142],maxDrawCalls:Math.max(...calls),maxTriangles:Math.max(...tris),
        memory:{...g.renderer.info.memory},programs:g.renderer.info.programs.length,scenery:g.getLevel().jungleAssetDiagnostics,contextLost:g.renderer.getContext().isContextLost()};});
    rows.push({name,...row});await writeFile(`${output}/partial.json`,JSON.stringify({pulse,smoke,rows,errors},null,2));await page.screenshot({path:`${output}/${name}.png`});
    assert.equal(row.contextLost,false);assert.deepEqual(row.scenery.errors,[]);assert.ok(row.maxDrawCalls<430);assert.ok(row.maxTriangles<650000);
  }
  const memory=[];
  for(let i=0;i<3;i++){
    await page.evaluate(async()=>{const g=window.__game;for(const id of ['nightworks-after-hours','bonus-nightworks-after-hours']){g.switchLevel(id);await Promise.all([g.getLevel().prepareJungleAssets(),g.getLevel().prepareSurfaceImages()]);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));}});
    await page.waitForTimeout(400);
    memory.push(await page.evaluate(()=>({...window.__game.renderer.info.memory,programs:window.__game.renderer.info.programs.length})));
  }
  assert.ok(memory.at(-1).textures<=memory[0].textures+2,'repeated bonus/main transitions must not leak textures');
  assert.ok(memory.at(-1).geometries<=memory[0].geometries+4,'repeated transitions must not leak geometry');
  assert.deepEqual(errors,[]);
  const report={pulse,smoke,rows,memory,errors};await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));console.log('PASS full renderer: moving Gouraud smoke, visible animated lava, loaded compressed basalt, bounded draw cost, stable resources across six level switches.');
}finally{await browser.close();}
