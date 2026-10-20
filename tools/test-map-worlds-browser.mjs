import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const {CAMPAIGN_ISLANDS:islands,CAMPAIGN_LEVELS:levels,CAMPAIGN_MAP_EDGES:edges}=await server.ssrLoadModule('/src/campaign.ts');
const view=await server.ssrLoadModule('/src/mapView.ts');await server.close();
const base=process.argv[2]||'http://127.0.0.1:6264/';
const out=process.env.ISLAND_REVIEW_DIR||'/private/tmp/island-worlds-final';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],report={views:[],transfers:[]};
try{
 const page=await browser.newPage({viewport:{width:1920,height:1080},deviceScaleFactor:2});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.addInitScript(()=>localStorage.setItem('solProtoRenderQuality.v1',JSON.stringify({version:3,enabled:false,baseHeight:1080,outputMultiplier:2,fixed60:true})));
 await page.goto(base+'?playtest&level=warproom');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>window.__game.getLevel().prepareJungleAssets());
 const go=async key=>{
  await page.evaluate(async key=>{const g=window.__game;g.campaign.setMapFocus(key);g.switchLevel('warproom');await g.getLevel().prepareJungleAssets()},key);
  await page.evaluate(()=>new Promise(r=>{let n=0;const step=()=>++n>=20?r():requestAnimationFrame(step);requestAnimationFrame(step)}));
 };
 report.geometry=await page.evaluate(async({levels,edges,url})=>{
  const T=await import(url),l=window.__game.getLevel(),models=[],land=[],failures=[],overlaps=[],foundations=[];
  l.root.updateMatrixWorld(true);
  l.root.traverse(o=>{
   if(o.userData.asset)models.push(o);
   if(o.name.startsWith('world map campaign island '))land.push(o);
   if(o.name==='world map hub foundation')foundations.push(o.geometry.parameters.height);
  });
  const bounds=models.map(o=>({o,b:new T.Box3().setFromObject(o)})),ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);
  let samples=0,crossings=0;
  for(const e of edges){
   const from=levels.find(l=>l.progressKey===e.from),to=levels.find(l=>l.progressKey===e.to);
   if(from.islandId!==to.islandId){crossings++;continue}
   for(let i=0;i<=50;i++){
    const p=l.campaignMapTravel(e.from,e.to,i/50).position,r=l.campaignMapTravel(e.to,e.from,1-i/50).position;samples++;
    if(p.distanceTo(r)>1e-6)failures.push({edge:e.from,at:i,reason:'nonreciprocal'});
    if(e.travel==='trail'){
     ray.set(p.clone().add(new T.Vector3(0,.4,0)),down);ray.far=1.5;
     if(!ray.intersectObjects(land,false).length)failures.push({edge:e.from,at:i,reason:'unsupported'});
    }
    // Five vertical probes cover a 1.8 m wide, 11 m tall map-skater envelope.
    for(const {o,b} of bounds){
     if(p.x<b.min.x-1||p.x>b.max.x+1||p.z<b.min.z-1||p.z>b.max.z+1||b.max.y<p.y+.5||b.min.y>p.y+11)continue;
     for(const [dx,dz] of [[0,0],[-.9,0],[.9,0],[0,-.9],[0,.9]]){
      ray.set(p.clone().add(new T.Vector3(dx,11,dz)),down);ray.far=10.5;
      const hit=ray.intersectObject(o,true)[0];
      if(hit){overlaps.push({from:e.from,to:e.to,at:i/50,group:o.parent.name,asset:o.userData.asset,point:hit.point.toArray(),local:o.position.toArray()});break}
     }
    }
   }
  }
  return {samples,crossings,failures,overlaps,maxFoundationHeight:Math.max(...foundations),routes:l.root.children.filter(o=>o.name==='world map route bed').length};
 },{levels,edges,url:process.env.THREE_REVIEW_URL||new URL('node_modules/three/build/three.module.js',base).href});
 await writeFile(out+'/geometry.json',JSON.stringify(report.geometry,null,2));
 assert.deepEqual(report.geometry.failures,[]);assert.deepEqual(report.geometry.overlaps,[]);
 assert.equal(report.geometry.routes,edges.length-report.geometry.crossings);
 assert.ok(report.geometry.maxFoundationHeight<10,'floating island has sea-length columns');
 const keys=process.env.MAP_TRANSFERS_ONLY?[]:process.env.MAP_ALL_VIEWS?levels.map(l=>l.progressKey):islands.map(i=>i.levelKeys[0]);
 for(const key of keys){
  await go(key);
  const state=await page.evaluate(key=>{
   const g=window.__game,l=g.getLevel(),pose=l.campaignMapPose(key).position,centre=l.campaignMapIslandCentre(key);
   return {key,selected:document.querySelector('.world-map-ui').dataset.selectedKey,canvas:[g.renderer.domElement.width,g.renderer.domElement.height],
    native:!g.renderQualitySettings.enabled,screen:pose.clone().add({x:0,y:5,z:0}).project(g.camera).toArray(),
    facing:g.camera.getWorldDirection(pose.clone()).setY(0).normalize().dot(centre.clone().sub(g.camera.position).setY(0).normalize())};
  },key);
  assert.equal(state.selected,key);assert.ok(state.native);assert.deepEqual(state.canvas,[3840,2160]);
  assert.ok(Math.abs(state.screen[0])<.85&&Math.abs(state.screen[1])<.85,key+' skater is off screen');assert.ok(state.facing>.995);
  await page.screenshot({path:out+'/'+key+'.png'});report.views.push(state);console.log('Full-resolution view',key);
 }
 for(const edge of edges.filter(e=>levels.find(l=>l.progressKey===e.from).islandId!==levels.find(l=>l.progressKey===e.to).islandId)){
  for(const [from,to] of [[edge.from,edge.to],[edge.to,edge.from]]){
   await go(from);
   const data=await page.evaluate(({from,edges})=>{
    const l=window.__game.getLevel(),p=l.campaignMapPose(from).position,c=l.campaignMapIslandCentre(from);
    return {p:p.toArray(),c:c.toArray(),exits:edges.filter(e=>e.from===from||e.to===from).map(e=>{const key=e.from===from?e.to:e.from;return {key,delta:l.campaignMapTravel(from,key,.08).position.sub(p).toArray()}})};
   },{from,edges});
   const direction=Object.entries(view.mapViewDirections(view.islandViewAngle(new THREE.Vector3(...data.p),new THREE.Vector3(...data.c)),data.exits.map(e=>({...e,delta:new THREE.Vector3(...e.delta)})))).find(([,key])=>key===to)?.[0];
   assert.ok(direction);
   await page.evaluate(()=>{
    window.__mapPanFrames=[];window.__mapPanRecord=true;
    const record=()=>{if(!window.__mapPanRecord)return;const g=window.__game;
     window.__mapPanFrames.push({p:g.player.renderPosition.toArray(),visible:g.player.group.visible,eye:g.camera.position.toArray(),moving:document.querySelector('.world-map-ui').classList.contains('is-moving')});
     requestAnimationFrame(record)};
    requestAnimationFrame(record);
   });
   await page.keyboard.press({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[direction]);
   await page.waitForFunction(to=>window.__mapPanFrames.some(f=>f.moving)&&document.querySelector('.world-map-ui').dataset.selectedKey===to&&!document.querySelector('.world-map-ui').classList.contains('is-moving'),to,{timeout:60000});
   const frames=await page.evaluate(()=>{window.__mapPanRecord=false;return window.__mapPanFrames});
   const a=new THREE.Vector3(...levels.find(l=>l.progressKey===from).mapPosition),b=new THREE.Vector3(...levels.find(l=>l.progressKey===to).mapPosition);
   assert.ok(frames.some(f=>!f.visible),'rider remains visible over the sea');
   for(const frame of frames){const p=new THREE.Vector3(...frame.p);assert.ok(Math.min(p.distanceTo(a),p.distanceTo(b))<.05,'rider skates through the sea')}
   const eyeDistances=frames.slice(1).map((f,i)=>new THREE.Vector3(...f.eye).distanceTo(new THREE.Vector3(...frames[i].eye)));
   assert.ok(Math.max(...eyeDistances)<35,'camera jumped instead of panning');
   assert.ok(new THREE.Vector3(...frames.at(-1).p).distanceTo(b)<.05);
   const final=await page.evaluate(()=>({visible:window.__game.player.group.visible,selected:document.querySelector('.world-map-ui').dataset.selectedKey}));
   assert.ok(final.visible);assert.equal(final.selected,to);
   report.transfers.push({from,to,frames:frames.length,hidden:frames.filter(f=>!f.visible).length,maxCameraStep:Math.max(...eyeDistances)});
   console.log('Camera pan',from,'→',to);
  }
 }
 await go('treehouse-trail');await page.setViewportSize({width:844,height:1170});await page.waitForTimeout(750);
 await page.screenshot({path:out+'/portrait.png'});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({views:report.views.length,transfers:report.transfers.length,routeSamples:report.geometry.samples,errors}));
}finally{report.errors=errors;await writeFile(out+'/report.json',JSON.stringify(report,null,2));await browser.close()}
