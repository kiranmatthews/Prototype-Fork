import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from '/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
const out='art/carlisle-shipyard/integration/repair',base=process.env.CARLISLE_BASE??'http://127.0.0.1:5483';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true}),page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:1,serviceWorkers:'block'});
const report={errors:[],impacts:[]};page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text())});await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
const capture=async(name,kind)=>{
 const image=await page.evaluate(kind=>{const g=window.__game,m=g.getLevel().groundMeshes.find(m=>m.userData.marineNet&&(kind==='moving'?m.userData.moverId!==undefined:m.userData.moverId===undefined)),c=g.camera.clone();
  const target=m.position.clone();target.y+=.3;c.position.copy(target).add(target.clone().set(14,9,19));c.lookAt(target);c.fov=43;c.updateProjectionMatrix();c.updateMatrixWorld(true);g.renderer.render(g.scene,c);return g.renderer.domElement.toDataURL('image/png');},kind);
 await writeFile(out+'/'+name+'.png',Buffer.from(image.split(',')[1],'base64'));
};
try{
 await page.goto(base+'/art/carlisle-shipyard/viewer.html?asset=assembled-net',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__shipyardViewer?.current?.id==='assembled-net');
 report.anchors=await page.evaluate(()=>{
  const api=window.__shipyardViewer,net=api.getNet(),g=net.mesh.geometry,p=g.attributes.position,flex=g.attributes.netMobility;
  return net.eyes.map(eye=>{let distance=Infinity,count=0;for(let i=0;i<p.count;i++)if(flex.getX(i)===0){const d=Math.hypot(p.getX(i)-eye.x,p.getY(i)-eye.y,p.getZ(i)-eye.z);if(d<distance)distance=d;count++;}return{distance,fixedVertices:count}});
 });assert.equal(report.anchors.length,8);assert.ok(report.anchors.every(a=>a.distance<.025&&a.fixedVertices>50));
 await page.screenshot({path:out+'/net-assembled-final.png'});
 await page.evaluate(()=>{const a=window.__shipyardViewer;a.renderer.setAnimationLoop(null);a.getNet().impact(.2,-.2,55);a.getNet().update(.1);a.renderer.render(a.scene,a.camera)});await page.screenshot({path:out+'/net-impact-final.png'});
 await page.goto(base+'/art/carlisle-cone/viewer.html',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.__coneReview?.ready);
 report.cone=await page.evaluate(()=>{
  const api=window.__coneReview,a=api.actor;api.playback(false);a.play('idle');let m;a.model.traverse(n=>{if(n.isSkinnedMesh)m=n});
  const weights=m.geometry.attributes.skinWeight,indices=m.geometry.attributes.skinIndex,p=m.geometry.attributes.position,feet=[];
  let weightError=0;for(let i=0;i<p.count;i++){
   let sum=0;for(let j=0;j<4;j++)sum+=weights.getComponent(i,j);weightError=Math.max(weightError,Math.abs(1-sum));
   if(p.getY(i)<.012&&m.skeleton.bones[indices.getX(i)]?.name.endsWith('Foot'))feet.push(i);
   else if(p.getY(i)<.012){for(let j=0;j<4;j++)if(weights.getComponent(i,j)>.99&&m.skeleton.bones[indices.getComponent(i,j)]?.name.endsWith('Foot')){feet.push(i);break;}}
  }
  const position=i=>m.getVertexPosition(i,a.group.position.clone()).applyMatrix4(m.matrixWorld).toArray();
  a.sample(0);const baseline=feet.map(position),scale=a.group.scale.toArray();let footDrift=0;
  for(let j=0;j<=48;j++){a.sample(a.duration*j/48);feet.forEach((i,k)=>{const v=position(i);footDrift=Math.max(footDrift,Math.hypot(...v.map((x,n)=>x-baseline[k][n])))});}
  return{...api.metrics,weightError,soleVertices:feet.length,footDrift,scale,triangles:m.geometry.index.count/3};
 });assert.equal(report.cone.bones,13);assert.equal(report.cone.triangles,4986);assert.ok(report.cone.weightError<1e-6);assert.ok(report.cone.soleVertices>50);assert.ok(report.cone.footDrift<1e-5);assert.deepEqual(report.cone.scale,[1,1,1]);
 await page.goto(base+'/?playtest&level=carlisle-coast',{waitUntil:'domcontentloaded',timeout:180000});await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 report.main=await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(null);g.crtGuestSettings.setEnabled(false);const meshes=g.getLevel().groundMeshes.filter(m=>m.userData.marineNet);return{art:g.getLevel().carlisleShipyardDiagnostics,cones:g.getLevel().carlisleConeDiagnostics,grounds:g.getLevel().groundMeshes.length,netGeometries:new Set(meshes.map(m=>m.getObjectByName('Woven ropes, knots and eight threaded lashings').geometry.uuid)).size}});
 assert.equal(report.main.grounds,334);assert.equal(report.main.art.nets,56);assert.equal(report.main.cones.actors,78);assert.ok(report.main.netGeometries<12);
 for(const kind of ['fixed','moving']){
  const before=await page.evaluate(kind=>{const g=window.__game,l=g.getLevel(),m=l.groundMeshes.find(m=>m.userData.marineNet&&(kind==='moving'?m.userData.moverId!==undefined:m.userData.moverId===undefined));m.geometry.computeBoundingBox();const local=m.position.clone().set(1.8,m.geometry.boundingBox.max.y+.5,-1.1);const position=m.localToWorld(local);g.player.respawn(l,true,false,{position});return{index:m.userData.editorIdx,impacts:m.userData.marineNet.impacts,matrix:m.matrixWorld.toArray(),stamp:m.userData.trampolineVisualImpact?.id??0};},kind);
  await page.waitForFunction(({index,impacts})=>window.__game.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index).userData.marineNet.impacts>impacts,before,{timeout:15000});
  const first=await page.evaluate(({index})=>{const m=window.__game.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index);return{stamp:m.userData.trampolineVisualImpact,visual:{...m.userData.marineNet},state:window.__game.player.state,up:window.__game.player.vVel}},before);
  assert.equal(first.stamp.id,before.stamp+1);assert.equal(first.visual.impacts,before.impacts+1);assert.ok(first.visual.age<.3);assert.equal(first.state,'air');assert.ok(first.up>20);
  await capture(kind+'-net-impact',kind);
  await page.waitForFunction(({index})=>window.__game.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index).userData.marineNet.age===2,before);
  const settled=await page.evaluate(({index})=>{const m=window.__game.getLevel().groundMeshes.find(m=>m.userData.editorIdx===index);return{...m.userData.marineNet,matrix:m.matrixWorld.toArray()}},before);
  if(kind==='fixed')assert.deepEqual(settled.matrix,before.matrix);else assert.notDeepEqual(settled.matrix,before.matrix);
  report.impacts.push({kind,before,first,settled});
 }
 report.bonus=await page.evaluate(async()=>{const g=window.__game,old=g.getLevel();g.switchLevel('bonus-carlisle-coast');await g.getLevel().prepareJungleAssets();return{art:g.getLevel().carlisleShipyardDiagnostics,oldNets:old.root.getObjectsByProperty('name','Laced elastic marine net').length,oldCones:old.root.getObjectsByProperty('name','Angry cone').length};});
 assert.equal(report.bonus.art.nets,5);assert.equal(report.bonus.oldNets,0);assert.equal(report.bonus.oldCones,0);
 await page.screenshot({path:out+'/bonus-native.png'});
 await page.evaluate(async()=>{const g=window.__game;g.switchLevel('carlisle-coast');await g.getLevel().prepareJungleAssets();g.renderQualitySettings.setRegularResolution(480);g.crtGuestSettings.setEnabled(true)});await page.waitForTimeout(200);await page.screenshot({path:out+'/normal-game.png'});
 assert.deepEqual(report.errors,[]);console.log('PASS eyelet attachment, planted cone soles, fixed/moving native impacts, finite settling and lifecycle.');
}finally{await writeFile(out+'/validation.json',JSON.stringify(report,null,2)+'\n');await browser.close();}
