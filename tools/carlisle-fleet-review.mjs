import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483',out=process.env.FLEET_OUT??'art/carlisle-shipyard/fishing-fleet/review';
const baseline=process.argv.includes('--baseline'),lite=process.argv.includes('--lite');await mkdir(out,{recursive:true});
const built=await build({entryPoints:['src/levels/carlisle-tidal-relay.ts'],bundle:true,format:'esm',write:false});
const {carlislePoint:point,CARLISLE_RELAY_SECTIONS:sections}=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const seaY=z=>{let a=-150,b=4200;for(let i=0;i<15;i++){const m=(a+b)/2;if(point(m,0)[2]>z)a=m;else b=m;}return point((a+b)/2,-8)[1];};
const mooring=i=>{const [,a,b]=sections[i],p=point((a+b)/2,0,(i%2?-1:1)*(!baseline&&[2,9].includes(i)?156:122)),yaw=i*.6;let best=p[2],score=Infinity;
 for(let dz=-65;dz<=65;dz+=2){const z=p[2]+dz,span=18*Math.abs(Math.sin(yaw))+8*Math.abs(Math.cos(yaw)),candidate=Math.abs(seaY(z-span)-seaY(z+span))+Math.abs(dz)*.001;if(candidate<score){score=candidate;best=z;}}
 return[p[0]-(!baseline&&i===9?28:0),seaY(best),best];};
const report={base,baseline,lite,errors:[],views:[]},browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
 page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.goto(base+'/?playtest&level=carlisle-coast&art=harbour'+(lite?'&lite':''),{waitUntil:'domcontentloaded',timeout:180000});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const l=g.getLevel();return{art:l.carlisleShipyardDiagnostics,ground:l.groundMeshes.length,crates:l.crates.length,wetSlopes:l.groundMeshes.filter(m=>m.userData.slippy&&m.visible&&m.material.name==='Harbour wet').length,build:document.querySelector('.hud-build')?.textContent};});
 assert.equal(report.main.art.status,'ready');assert.equal(report.main.ground,334);assert.equal(report.main.crates,270);assert.equal(report.main.wetSlopes,18);
 if(!baseline){assert.equal(report.main.art.fleet.status,'ready');assert.equal(report.main.art.fleet.vessels,6);}
 const capture=async(id,camera,center)=>{
  const data=await page.evaluate(({camera,center})=>{const g=window.__game,c=g.camera.clone(),visible=g.player.group.visible;g.player.group.visible=false;c.position.set(...camera);c.fov=52;c.lookAt(...center);c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);const url=g.renderer.domElement.toDataURL('image/png');g.player.group.visible=visible;return{url,far:c.far,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],render:{...g.renderer.info.render}};},{camera,center});
  await writeFile(`${out}/${id}.png`,Buffer.from(data.url.split(',')[1],'base64'));report.views.push({id,camera,center,...data,url:undefined});
 };
 for(const [i,id,offset] of (lite?(process.argv.includes('--crane')?[[9,'crane-mooring',[-45,23,43]]]:[[0,'arrival-vessel',[45,18,40]]]):[[0,'arrival-vessel',[45,18,40]],[0,'arrival-stern',[-43,20,-36]],[9,'crane-mooring',[-45,23,43]],[17,'homecoming-vessel',[-43,20,45]]])){
  const p=mooring(i),s=(sections[i][1]+sections[i][2])/2;
  await page.evaluate(p=>{const g=window.__game;g.player.respawn(g.getLevel(),true,false,{position:g.player.pos.clone().set(...p)});},point(s,3));await page.waitForTimeout(250);
  await capture(id,p.map((v,k)=>v+offset[k]),p.map((v,k)=>v+(k===1?9:0)));
 }
 const fleetState=()=>{const g=window.__game,boats=[];g.scene.updateMatrixWorld(true);g.scene.traverse(n=>{if(n.userData.fishingVessel){let triangles=0;n.traverse(m=>{if(m.isMesh)triangles+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;});boats.push({spec:n.userData.fishingVessel,position:n.position.toArray(),rotation:n.quaternion.toArray(),scale:n.scale.toArray(),triangles});}});return boats;};
 if(!baseline){report.pileClearance=await page.evaluate(()=>{
  const g=window.__game,art=g.scene.getObjectByName('Carlisle shipyard art'),boats=[],poles=[];g.scene.updateMatrixWorld(true);
  art.traverse(n=>{if(n.userData.fishingVessel)boats.push(n);if(n.isInstancedMesh&&n.geometry.type==='CylinderGeometry')for(let i=0;i<n.count;i++){
    const m=n.matrixWorld.clone().fromArray(n.instanceMatrix.array,i*16).premultiply(n.matrixWorld),e=m.elements;
    poles.push({at:g.camera.position.clone().setFromMatrixPosition(m),height:Math.hypot(e[4],e[5],e[6]),radius:.56*Math.max(Math.hypot(e[0],e[1],e[2]),Math.hypot(e[8],e[9],e[10]))});
  }});
  return boats.map(boat=>{const mesh=boat.children.find(n=>n.isMesh),box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrix);
    const measure=dx=>{const matrix=boat.matrixWorld.clone();matrix.elements[12]+=dx;const inverse=matrix.invert();let clearance=Infinity,nearest=null;
      for(const pole of poles){const p=pole.at.clone().applyMatrix4(inverse);if(p.y+pole.height/2<box.min.y||p.y-pole.height/2>box.max.y)continue;const distance=Math.hypot(Math.max(box.min.x-p.x,0,p.x-box.max.x),Math.max(box.min.z-p.z,0,p.z-box.max.z))-pole.radius;if(distance<clearance){clearance=distance;nearest=pole.at.toArray();}}
      return{clearance,nearest};};
    const current=measure(0);let suggestion=null;if(current.clearance<2)for(let d=4;d<=120;d+=4){const dx=d*Math.sign(boat.position.x),result=measure(dx);if(result.clearance>8){suggestion={dx,clearance:result.clearance};break;}}
    return{at:boat.userData.fishingVessel.at,minimumPoleToHullBounds:current.clearance,nearestPole:current.nearest,suggestion};});
 });assert.ok(report.pileClearance.every(b=>b.minimumPoleToHullBounds>2),'scenic boat overlaps a pier support');}
 if(!baseline){report.motionBefore=await page.evaluate(fleetState);await page.waitForTimeout(1500);report.motionAfter=await page.evaluate(fleetState);assert.equal(report.motionBefore.length,6);assert.ok(report.motionAfter.every((b,i)=>b.triangles===report.motionBefore[i].triangles));assert.ok(report.motionAfter.some((b,i)=>b.position[1]!==report.motionBefore[i].position[1]));}
 if(!lite){
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();});await page.waitForTimeout(250);
  report.bonus=await page.evaluate(()=>{const l=window.__game.getLevel();return{art:l.carlisleShipyardDiagnostics,movers:l.movers.length,crates:l.crates.length};});assert.equal(report.bonus.movers,4);
  await capture('bonus-fleet',[83,18,-18],[42,8,-62]);
  await capture('bonus-harbour',[32,15,26],[63,4,-13]);
  if(!baseline){assert.equal(report.bonus.art.fleet.vessels,2);report.bonusBoats=await page.evaluate(fleetState);assert.equal(report.bonusBoats.length,2);}
  await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true);});await page.waitForFunction(()=>window.__game.player.grounded);await page.screenshot({path:out+'/normal-arrival.png'});
  report.normal=await page.evaluate(async()=>{const g=window.__game,times=[];let previous=performance.now();for(let i=0;i<130;i++){await new Promise(requestAnimationFrame);const now=performance.now();if(i>10)times.push(now-previous);previous=now;}times.sort((a,b)=>a-b);return{far:g.camera.far,art:g.getLevel().carlisleShipyardDiagnostics.status,median:times[Math.floor(times.length*.5)],p95:times[Math.floor(times.length*.95)],samples:times.length};});
  const z=await page.evaluate(()=>window.__game.player.pos.z);await page.keyboard.down('ArrowUp');await page.waitForTimeout(650);await page.keyboard.up('ArrowUp');report.walk=await page.evaluate(()=>({z:window.__game.player.pos.z,deaths:window.__game.player.totalDeaths}));assert.ok(report.walk.z<z-2);assert.equal(report.walk.deaths,0);
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}finally{await writeFile(out+'/browser.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
console.log(JSON.stringify(report));
