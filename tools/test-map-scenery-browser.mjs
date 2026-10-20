import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const {CAMPAIGN_LEVELS:levels,CAMPAIGN_MAP_EDGES:edges}=await server.ssrLoadModule('/src/campaign.ts');
const view=await server.ssrLoadModule('/src/mapView.ts');await server.close();
const base=process.argv[2]||'http://127.0.0.1:6264/';
const out=process.env.ISLAND_REVIEW_DIR||'/private/tmp/meshy-map-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],checks=[];
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:2,fixed60:true})));
 await page.goto(base+'?playtest&level=warproom');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 const resolution=await page.evaluate(()=>({dpr:devicePixelRatio,ratio:window.__game.renderer.getPixelRatio(),enabled:window.__game.renderQualitySettings.enabled,canvas:[window.__game.renderer.domElement.width,window.__game.renderer.domElement.height]}));
 assert.deepEqual(resolution,{dpr:2,ratio:2,enabled:false,canvas:[3840,2160]});console.log('Native full-resolution review',JSON.stringify(resolution));
 const directionTo=async(from,to)=>{
  const data=await page.evaluate(({from,edges})=>{const l=window.__game.getLevel(),p=l.campaignMapPose(from).position,c=l.campaignMapIslandCentre(from);return {p:p.toArray(),c:c.toArray(),exits:edges.filter(e=>e.from===from||e.to===from).map(e=>{const key=e.from===from?e.to:e.from;return {key,delta:l.campaignMapTravel(from,key,.08).position.sub(p).toArray()}})}},{from,edges});
  const angle=view.islandViewAngle(new THREE.Vector3(...data.p),new THREE.Vector3(...data.c));
  return Object.entries(view.mapViewDirections(angle,data.exits.map(e=>({...e,delta:new THREE.Vector3(...e.delta)})))).find(([,key])=>key===to)?.[0];
 };
 const visit=async(key,capture=true)=>{
  await page.waitForFunction(key=>document.querySelector('.world-map-ui')?.dataset.selectedKey===key&&!document.querySelector('.world-map-ui')?.classList.contains('is-moving'),key,{timeout:20000});
  // Wait for the animation itself, rather than a wall-clock delay that can
  // expire early while a full-resolution frame is still rendering.
  await page.waitForFunction(key=>{
   const g=window.__game,l=g?.getLevel(),p=l?.campaignMapPose(key)?.position,c=l?.campaignMapIslandCentre(key);
   if(!p||!c||g.gameFlow.blocksGameplay)return false;
   const screen=p.clone().add({x:0,y:3,z:0}).project(g.camera);
   return Math.abs(screen.x)<.85&&Math.abs(screen.y)<.72
     &&g.camera.getWorldDirection(p.clone()).setY(0).normalize().dot(c.clone().sub(g.camera.position).setY(0).normalize())>.995;
  },key,{timeout:60000}).catch(async error=>{
   console.error('Camera settle timeout',key,await page.evaluate(key=>{const g=window.__game,l=g.getLevel(),p=l.campaignMapPose(key).position,c=l.campaignMapIslandCentre(key);return {screen:p.clone().add({x:0,y:3,z:0}).project(g.camera).toArray(),eye:g.camera.position.toArray(),player:g.player.renderPosition.toArray(),centre:c.toArray(),selected:document.querySelector('.world-map-ui')?.dataset.selectedKey,blocked:g.gameFlow.blocksGameplay}},key));throw error;
  });
  const state=await page.evaluate(key=>{
   const g=window.__game,l=g.getLevel(),pose=l.campaignMapPose(key).position,c=l.campaignMapIslandCentre(key),forward=g.camera.getWorldDirection(pose.clone()).setY(0).normalize(),toward=c.clone().sub(g.camera.position).setY(0).normalize(),hero=pose.clone().add({x:0,y:3,z:0}).project(g.camera),group=l.root.getObjectByName('world map diorama '+key),assets=[];
   group.traverse(o=>{if(o.userData.asset)assets.push(o.userData.asset)});
   return {key,facingCentre:forward.dot(toward),screen:hero.toArray(),ready:group.userData.ready,assets,draws:g.renderer.info.render.calls,triangles:g.renderer.info.render.triangles};
  },key);
  checks.push(state);assert.ok(state.facingCentre>.97,key+' camera not facing inward');assert.ok(Math.abs(state.screen[0])<.85&&Math.abs(state.screen[1])<.72,key+' marker out of frame');assert.ok(state.ready,key+' assets not ready');
  if(capture&&!process.env.MAP_SKIP_CAPTURES)await page.screenshot({path:out+'/'+key+'.png'});
  console.log('Reviewed',key,state.assets.length,'Meshy instances');
 };
 if(process.env.MAP_GEOMETRY_ONLY){
  await visit(levels[0].progressKey,false);
 }else if(process.env.MAP_REVERSE_ONLY){
  await page.evaluate(key=>{window.__game.campaign.setMapFocus(key);window.__game.switchLevel('warproom')},levels.at(-1).progressKey);
  await visit(levels.at(-1).progressKey,false);
 }else{
 await visit(levels[0].progressKey);
 for(const edge of edges){const direction=await directionTo(edge.from,edge.to);assert.ok(direction);await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);await visit(edge.to);}
 }
 if(process.env.MAP_CAPTURE_ONLY){assert.deepEqual(errors,[]);console.log('Native 2× capture complete');process.exitCode=0;}else{
 // Slow cloud movement is measured on the real sprite transforms, not a timer stub.
 const cloudStart=await page.evaluate(()=>{const a=[];window.__game.getLevel().root.traverse(o=>{if(o.name==='drifting photoreal cloud bank')a.push(o.position.toArray())});return a;});
 await page.waitForTimeout(1500);
 const cloudMoved=await page.evaluate(before=>{const a=[];window.__game.getLevel().root.traverse(o=>{if(o.name==='drifting photoreal cloud bank')a.push(o.position.toArray())});return a.length===24&&a.some((p,i)=>Math.hypot(...p.map((v,j)=>v-before[i][j]))>.2)},cloudStart);assert.ok(cloudMoved);
 // Actual reverse keyboard travel validates direction changes around every coast.
 if(!process.env.MAP_GEOMETRY_ONLY)for(const edge of [...edges].reverse()){const direction=await directionTo(edge.to,edge.from);await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);await visit(edge.from,false);}
 const geometry=await page.evaluate(async({levels,edges,url})=>{
  const T=await import(url),l=window.__game.getLevel(),land=[],models=[];l.root.updateMatrixWorld(true);l.root.traverse(o=>{if(o.name.startsWith('world map campaign island '))land.push(o);if(o.name.startsWith('world map diorama '))models.push(o)});
  const ray=new T.Raycaster(),down=new T.Vector3(0,-1,0),failures=[],overlaps=[];let samples=0;
  for(const e of edges)for(let i=0;i<=20;i++){
   const p=l.campaignMapTravel(e.from,e.to,i/20).position,r=l.campaignMapTravel(e.to,e.from,1-i/20).position;samples++;
   if(p.distanceTo(r)>1e-6)failures.push('nonreciprocal '+e.from);
   if(e.travel==='trail'){ray.set(p.clone().add(new T.Vector3(0,.35,0)),down);ray.far=1.3;if(!ray.intersectObjects(land,false).length)failures.push('unsupported '+e.from+' '+i);}
   ray.set(p.clone().add(new T.Vector3(0,2,0)),down);ray.far=1.8;const hits=ray.intersectObjects(models,true);if(hits.length)overlaps.push({from:e.from,to:e.to,at:i/20,object:hits[0].object.parent?.name});
  }
  return {samples,failures,overlaps,land:land.length,models:models.length};
 },{levels,edges,url:process.env.THREE_REVIEW_URL||'http://127.0.0.1:6264/node_modules/three/build/three.module.js'});
 await writeFile(out+'/geometry.json',JSON.stringify(geometry,null,2));assert.deepEqual(geometry.failures,[]);
 // Portrait uses the same full renderer and real navigation state.
 await page.setViewportSize({width:844,height:1170});await page.waitForTimeout(1200);await page.screenshot({path:out+'/portrait-treehouse.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({reviewed:checks.length,reverse:process.env.MAP_GEOMETRY_ONLY?0:37,cloudMoved,geometry,errors}));
}
}finally{await writeFile(out+'/report.json',JSON.stringify({checks,errors},null,2));await browser.close();}
