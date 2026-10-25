import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=(process.argv[2]||'http://127.0.0.1:5267').replace(/\/$/,''),out=process.env.ROOFTOP_OUTPUT||'docs/rooftop-kook/storm-case/local';
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile('public/rooftop-kook/storm-case.json'));
const bundle=await build({stdin:{contents:"export * as THREE from 'three';export {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';export {dressStormCase} from './src/stormCase';",resolveDir:process.cwd()},define:{'import.meta.env.BASE_URL':JSON.stringify(base+'/')},bundle:true,format:'esm',write:false});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:2560,height:1440},deviceScaleFactor:1,serviceWorkers:'block'}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.route('**/storm-case-fixture.js',r=>r.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text}));
await page.route('**/storm-case-fixture.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><body style="margin:0"></body>'}));
try{
 await page.goto(base+'/storm-case-fixture.html');
 const fixture=await page.evaluate(async()=>{
  const {THREE,dressStormCase,RoomEnvironment}=await import('/storm-case-fixture.js');
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(2560,1440);document.body.appendChild(renderer.domElement);renderer.toneMapping=THREE.ACESFilmicToneMapping;
  const scene=new THREE.Scene();scene.background=new THREE.Color('#a5b4bd');const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new THREE.HemisphereLight('#ecf4fb','#68705c',1.4));const light=new THREE.DirectionalLight('#edf3fb',3);light.position.set(3,5,4);scene.add(light);
  const camera=new THREE.PerspectiveCamera(32,2560/1440,.01,2000),body=new THREE.Mesh(new THREE.BoxGeometry(.96,.96,.96),new THREE.MeshLambertMaterial({color:'#8b999c'}));scene.add(body);
  const art=dressStormCase(body);art.setPending(true);await art.ready;
  const pendingBeforeReady=art.loaded&&!art.visual.visible&&!body.material.visible;art.setPending(false);
  const bounds=new THREE.Box3().setFromObject(art.visual,true),extent=bounds.getSize(new THREE.Vector3()).toArray(),centre=bounds.getCenter(new THREE.Vector3()).toArray();
  let triangles=0,meshCount=0;const geometry=[];art.visual.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;meshCount++;geometry.push(o.geometry.uuid);}});
  const f=window.__caseFixture={THREE,renderer,scene,camera,body,art,geometry,draw(yaw=0,distance=2.6){camera.position.set(Math.sin(yaw)*distance,1.25,Math.cos(yaw)*distance);camera.lookAt(0,0,0);renderer.render(scene,camera);}};f.draw(.7);
  const leaseBody=new THREE.Mesh(new THREE.BoxGeometry(.96,.96,.96),new THREE.MeshLambertMaterial()),cancelled=dressStormCase(leaseBody);cancelled.dispose();await cancelled.ready;
  const disposedLoadIgnored=!cancelled.loaded&&cancelled.visual.parent===null;
  return {pendingBeforeReady,extent,centre,triangles,meshCount,disposedLoadIgnored};
 });
 assert.ok(fixture.pendingBeforeReady&&fixture.disposedLoadIgnored);assert.equal(fixture.triangles,manifest.triangles);for(const n of fixture.extent)assert.ok(Math.abs(n-.96)<1e-6);for(const n of fixture.centre)assert.ok(Math.abs(n)<1e-6);
 for(const [name,yaw]of [['front',0],['quarter',.7],['rear',Math.PI],['left',-Math.PI/2]]){await page.evaluate(yaw=>window.__caseFixture.draw(yaw),yaw);await page.screenshot({path:out+'/'+name+'.png'});}
 const distance=await page.evaluate(()=>{const f=window.__caseFixture;f.draw(.7,180);const distant=[];f.art.visual.traverse(o=>{if(o.isMesh)distant.push(o.geometry.uuid);});const same=JSON.stringify(distant)===JSON.stringify(f.geometry);f.art.dispose();return {same,removed:f.art.visual.parent===null};});assert.ok(distance.same&&distance.removed);
 // The source-owned scene and its real contacts are exercised in both render paths.
 const passes=[];
 for(const lite of [true,false]){
  await page.goto(base+'/?'+(lite?'lite&':'')+'playtest&level=rooftop-relay',{waitUntil:'domcontentloaded',timeout:180000});
  await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='rooftop-relay'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
  const data=await page.evaluate(async()=>{
   const {THREE}=await import('/storm-case-fixture.js'),g=window.__game,l=g.getLevel();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);await l.prepareJungleAssets();
   const cases=l.crates.filter(c=>c.metal),rows=[];l.root.updateMatrixWorld(true);
   for(const c of cases){const art=c.stormCase;let triangles=0,materials=[];art?.visual.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;for(const m of Array.isArray(o.material)?o.material:[o.material])materials.push({pbr:m.isMeshStandardMaterial,normal:!!m.normalMap,roughness:!!m.roughnessMap,metal:!!m.metalnessMap});}});
    const bounds=art?new THREE.Box3().setFromObject(art.visual,true):null;rows.push({loaded:art?.loaded,triangles,materials,bodyHidden:!c.mesh.material.visible,contactFit:bounds?Math.max(bounds.min.distanceTo(c.box.min),bounds.max.distanceTo(c.box.max)):999,home:c.homeY===c.mesh.position.y});}
   const top=cases.find(c=>!cases.some(other=>other!==c&&Math.abs(other.mesh.position.x-c.mesh.position.x)<.5&&Math.abs(other.mesh.position.z-c.mesh.position.z)<.5&&other.box.min.y>=c.box.max.y-.01));
   g.player.respawn(l,true,false,{position:top.mesh.position.clone().setY(top.box.max.y+.12),heading:g.player.camDir.clone()});g.player.invulnTimer=30;
   window.caseTop=top;return {rows,buffer:[g.renderer.domElement.width,g.renderer.domElement.height],stamp:document.querySelector('.hud-build')?.textContent};
  });
  if(!lite)await page.waitForFunction(()=>window.__game.renderer.domElement.width===2560&&window.__game.renderer.domElement.height===1440);
  data.buffer=await page.evaluate(()=>[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]);
  assert.equal(data.rows.length,24);for(const row of data.rows){assert.ok(row.loaded&&row.bodyHidden&&row.home&&row.contactFit<1e-5,JSON.stringify(row));assert.equal(row.triangles,manifest.triangles);assert.ok(row.materials.every(m=>m.pbr&&m.normal&&m.roughness&&m.metal));}assert.deepEqual(data.buffer,lite?[1280,720]:[2560,1440]);
  await page.waitForTimeout(1300);const landing=await page.evaluate(()=>{const p=window.__game.player,c=window.caseTop;return{grounded:p.grounded,bailing:p.isBailing,feet:p.pos.y,top:c.box.max.y};});assert.ok(landing.grounded&&!landing.bailing&&Math.abs(landing.feet-landing.top)<.16,JSON.stringify(landing));passes.push({lite,...data,landing});
  if(!lite){
   const cover=await page.evaluate(()=>{const g=window.__game,l=g.getLevel(),e=l.enemies.find(e=>e.kook?.role==='gunner'),c=l.crates.filter(c=>c.metal).sort((a,b)=>a.mesh.position.distanceTo(e.group.position)-b.mesh.position.distanceTo(e.group.position))[0];
    const away=c.mesh.position.clone().sub(e.group.position).setY(0).normalize(),pos=c.mesh.position.clone().addScaledVector(away,7);pos.y=e.baseY+.12;
    const blocked=l.projectilePathBlocked(e.group.position.clone().add(pos.clone().set(0,1.85,0)),pos.clone().add(pos.clone().set(0,.8,0)));
    g.player.resetRacePosition(l,pos,away.clone().negate());g.player.invulnTimer=30;return {blocked,position:pos.toArray(),crate:c.mesh.position.toArray()};});assert.ok(cover.blocked);passes.at(-1).cover=cover;
   await page.waitForTimeout(1000);await page.screenshot({path:out+'/game-cover.png'});
   await page.evaluate(()=>{window.__game.renderQualitySettings.setRegularResolution(720);window.__game.crtGuestSettings.setEnabled(true);});await page.waitForTimeout(400);await page.screenshot({path:out+'/game-regular.png'});
   const reset=await page.evaluate(()=>{const l=window.__game.getLevel(),c=l.crates.find(c=>c.metal),home=c.homeY;c.mesh.position.y+=2;l.reset(true);return{restored:c.mesh.position.y===home,attached:c.stormCase.visual.parent===c.mesh,loaded:c.stormCase.loaded,visible:c.stormCase.visual.visible};});assert.ok(Object.values(reset).every(Boolean));passes.at(-1).reset=reset;
   await page.evaluate(()=>window.__game.switchLevel('codex-lab'));await page.waitForFunction(()=>window.__game.getCurrentLevel().id==='codex-lab'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:90000});
   assert.equal(await page.evaluate(()=>window.__game.getLevel().crates.filter(c=>c.stormCase).length),0);
  }
 }
 assert.deepEqual(errors,[]);await writeFile(out+'/browser.json',JSON.stringify({base,fixture,distance,passes,errors},null,2)+'\n');console.log('PASS native Meshy case, PBR maps, exact contact fit, pending/load lifecycle, complete geometry at distance, actual stacked landing, cover, reset and dry-level separation');
}finally{await browser.close();}
