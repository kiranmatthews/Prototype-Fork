import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'/private/tmp/rooftop-hud-fog/pickups';
await mkdir(out,{recursive:true});
const fixture=await build({stdin:{contents:"export * as THREE from 'three';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({headless:true,channel:'chrome'}),report={base,runs:[],errors:[]};
try{for(const mode of (process.env.FOG_MODES||'lite,native').split(',')){
 const page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.route('**/pickup-fog-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:fixture.outputFiles[0].text}));
 await page.goto(`${base}/?playtest&level=rooftop-relay${mode==='lite'?'&lite':''}`,{timeout:180000});
 const ready=async id=>page.waitForFunction(id=>window.__game?.getCurrentLevel().id===id&&!window.__game.gameFlow.blocksGameplay,id,{timeout:180000});
 await ready('rooftop-relay');
 await page.evaluate(()=>{const g=window.__game;g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);});
 const samples=await page.evaluate(async()=>{
  const {THREE}=await import('/pickup-fog-fixture.js'),g=window.__game,l=g.getLevel(),p=g.player,r=g.renderer,fog=l.heightFog;
  const target=new THREE.WebGLRenderTarget(512,288),bytes=new Uint8Array(512*288*4);
  const saved={target:r.getRenderTarget(),color:r.getClearColor(new THREE.Color()),alpha:r.getClearAlpha(),auto:r.autoClear,
   viewport:r.getViewport(new THREE.Vector4()),scissor:r.getScissor(new THREE.Vector4()),scissorTest:r.getScissorTest()};
  const read=draw=>{r.setRenderTarget(target);r.setViewport(0,0,512,288);r.setScissorTest(false);r.setClearColor(0,0);r.clear();draw();r.readRenderTargetPixels(target,0,0,512,288,bytes);return bytes.slice();};
  const difference=(a,b)=>a.reduce((sum,v,i)=>sum+Math.abs(v-b[i]),0);
  const orange=a=>{let n=0;for(let i=0;i<a.length;i+=4)if(a[i+3]>128&&a[i]>a[i+2]*1.5&&a[i]>a[i+1]*1.1)n++;return n;};
  const rows=[];
  try{
   p.bankFlyingFruit();p.flyFruit(p.pos.clone().add(new THREE.Vector3(0,1.3,0)));
   const flight=p.fruits.find(f=>f.phase==='fly');
   for(const [name,x,y] of [['start',.5,.55],['middle',.3,.31],['arrival',.08,.08]]){
    flight.sx=x;flight.sy=y;l.updateSceneryView(g.camera);
    const actual=read(()=>p.drawFlyingFruit(r));fog.disable();const clear=read(()=>p.drawFlyingFruit(r));
    rows.push({kind:'fruit flight',name,difference:difference(actual,clear),orangePixels:orange(actual)});
   }
   flight.sx=.4;flight.sy=.38;
   // The real shared Meshy wood material also supplies HUD/bonus crate icons.
   const source=l.crates.find(c=>c.woodCrate).woodCrate.visual;
   const mesh=new THREE.Mesh(source.geometry,source.material),scene=new THREE.Scene();scene.add(mesh,new THREE.AmbientLight(0xffffff,2));
   const camera=new THREE.PerspectiveCamera(40,512/288,.1,10000);camera.position.set(2,1.5,3);camera.lookAt(0,0,0);
   l.updateSceneryView(g.camera);const icon=read(()=>r.render(scene,camera));fog.disable();const clear=read(()=>r.render(scene,camera));
   rows.push({kind:'shared crate HUD',difference:difference(icon,clear),orangePixels:orange(icon)});
   // Near, middle and late roof crates must keep their actual painted faces;
   // the same material must still disappear when genuinely deep inside haze.
   const crates=l.crates.filter(c=>c.woodCrate&&c.alive).sort((a,b)=>b.mesh.position.z-a.mesh.position.z);
   scene.fog=g.scene.fog.clone();const color=scene.fog.color;
   for(const t of [.1,.5,.9]){
    const crate=crates[Math.floor((crates.length-1)*t)].woodCrate.visual;crate.updateWorldMatrix(true,false);
    crate.getWorldPosition(mesh.position);crate.getWorldQuaternion(mesh.quaternion);crate.getWorldScale(mesh.scale);
    camera.position.copy(mesh.position).add(new THREE.Vector3(4,3,6));camera.lookAt(mesh.position);
    fog.update(l.root,camera.position,l.atmosphere.heightFog,color,true);const world=read(()=>r.render(scene,camera));
    fog.disable();const clear=read(()=>r.render(scene,camera));
    fog.update(l.root,camera.position,{height:camera.position.y+50,density:.16,falloff:.3},color,true);
    const buried=read(()=>r.render(scene,camera));
    rows.push({kind:'world crate',position:mesh.position.toArray(),nearFogDifference:difference(world,clear),fullFogDifference:difference(buried,clear),orangePixels:orange(world)});
   }
  }finally{
   l.updateSceneryView(g.camera);r.setRenderTarget(saved.target);r.setViewport(saved.viewport);r.setScissor(saved.scissor);r.setScissorTest(saved.scissorTest);
   r.setClearColor(saved.color,saved.alpha);r.autoClear=saved.auto;target.dispose();
  }
  // Hold a real collected fruit for full-resolution/CRT inspection only.
  window.fogReviewUpdate=p.updateFruit;p.updateFruit=()=>{};
  return {rows,buffer:[r.domElement.width,r.domElement.height],stamp:document.querySelector('.hud-build')?.textContent};
 });
 await page.screenshot({path:`${out}/${mode}-flight.png`});
 if(mode==='native'){
  await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(480);window.__game.crtGuestSettings.setEnabled(true);});
  await page.waitForTimeout(400);await page.screenshot({path:`${out}/crt-flight.png`});
 }
 await page.evaluate(()=>{const g=window.__game;g.player.updateFruit=window.fogReviewUpdate;g.player.bankFlyingFruit();g.enterBonusRound();});
 await ready('bonus:rooftop-relay');
 const bonus=await page.evaluate(()=>{const g=window.__game;return {name:g.getCurrentLevel().data.name,heightFog:!!g.getLevel().atmosphere?.heightFog,slippy:g.player.groundHit?.slippy??false};});
 report.runs.push({mode,...samples,bonus});await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');
 for(const row of samples.rows){
  if(row.kind==='world crate'){assert.ok(row.fullFogDifference>1000);assert.ok(row.nearFogDifference<row.fullFogDifference*.5,JSON.stringify(row));}
  else assert.equal(row.difference,0,JSON.stringify(row));
  assert.ok(row.orangePixels>10,JSON.stringify(row));
 }
 assert.equal(bonus.heightFog,false);assert.equal(bonus.slippy,false);assert.match(samples.stamp,/Codex\/sol fork/);
 if(mode==='native')assert.deepEqual(samples.buffer,[2560,1440]);
 await page.close();
}
assert.deepEqual(report.errors,[]);console.log('PASS native shared crate, three real fruit-flight positions, three roof elevations, CRT and bonus entry',JSON.stringify(report));
}finally{await writeFile(out+'/report.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
