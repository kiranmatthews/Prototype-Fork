import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const c=await server.ssrLoadModule('/src/campaign.ts');
const levels=c.CAMPAIGN_LEVELS,edges=c.CAMPAIGN_MAP_EDGES,islands=c.CAMPAIGN_ISLANDS;await server.close();
const base=process.argv[2]||'http://127.0.0.1:6264/',full=process.argv.includes('--full');
const out=process.env.ISLAND_REVIEW_DIR||'/private/tmp/archipelago-review';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[],checks=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto(base+'?playtest&level=warproom&unlockAll'+(full?'':'&lite'));
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 const geometry=await page.evaluate(async({levels,edges,threeUrl})=>{
   const g=window.__game,l=g.getLevel(),T=await import(threeUrl),land=[],models=[];l.root.updateMatrixWorld(true);
   l.root.traverse(o=>{if(o.name.startsWith('world map campaign island '))land.push(o);if(o.name.startsWith('world map diorama '))models.push(o)});
   const failures=[],ray=new T.Raycaster(),down=new T.Vector3(0,-1,0);let samples=0;
   for(const d of levels){const p=l.campaignMapPose(d.progressKey).position;ray.set(p.clone().add(new T.Vector3(0,.5,0)),down);ray.far=2;if(!ray.intersectObjects(l.groundMeshes,false).length)failures.push('unsupported '+d.progressKey);}
   for(const e of edges)for(let i=0;i<=20;i++){
    const p=l.campaignMapTravel(e.from,e.to,i/20),r=l.campaignMapTravel(e.to,e.from,1-i/20);samples++;
    if(p.position.distanceTo(r.position)>1e-6||!p.position.toArray().every(Number.isFinite))failures.push('invalid route '+e.from);
    ray.set(p.position.clone().add(new T.Vector3(0,12,0)),down);ray.far=13;
    if(ray.intersectObjects(models,true).some(hit=>hit.point.y>p.position.y+.2))failures.push('scenery on path '+e.from+' '+i);
    if(e.travel==='trail'){ray.set(p.position.clone().add(new T.Vector3(0,.35,0)),down);ray.far=1.3;if(!ray.intersectObjects(land,false).length)failures.push('unsupported trail '+e.from+' '+i);}
   }
   return {land:land.length,models:models.length,samples,failures};
 },{levels,edges,threeUrl:process.env.THREE_REVIEW_URL||'http://127.0.0.1:6264/node_modules/three/build/three.module.js'});
 await writeFile(out+'/geometry.json',JSON.stringify(geometry,null,2));
 assert.equal(geometry.land,6);assert.equal(geometry.models,38);assert.deepEqual(geometry.failures,[]);checks.push(geometry);
 const keyFor=d=>({up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'})[d];
 const visit=async(key)=>{
  await page.waitForFunction(key=>document.querySelector('.world-map-ui')?.dataset.selectedKey===key&&!document.querySelector('.world-map-ui')?.classList.contains('is-moving'),key,{timeout:15000});
  if(islands.some(i=>i.levelKeys.at(-1)===key))await page.waitForTimeout(900);
  const view=await page.evaluate(key=>{const g=window.__game,p=g.getLevel().campaignMapPose(key).position.clone();p.y+=3;const v=p.project(g.camera);return {x:v.x,y:v.y,z:v.z};},key);
  assert.ok(Math.abs(view.x)<.9&&Math.abs(view.y)<.72,`${key} off screen ${JSON.stringify(view)}`);
 };
 await visit(levels[0].progressKey);await page.screenshot({path:out+`/opening-${full?'full':'lite'}.png`});
 for(const edge of edges){
  await page.keyboard.press(keyFor(edge.fromDirection));await visit(edge.to);
  if(islands.some(i=>i.levelKeys[2]===edge.to||i.levelKeys.at(-1)===edge.to)){
   await page.waitForTimeout(350);await page.screenshot({path:out+`/${full?'full':'lite'}-${edge.to}.png`});console.log('Reached',edge.to);
  }
 }
 // Reverse each transition using the actual opposite direction, through all 38 hubs.
 for(const edge of [...edges].reverse()){await page.keyboard.press(keyFor(edge.toDirection));await visit(edge.from);}
 checks.push({keyboardDestinations:38,forwardEdges:37,reverseEdges:37,screenFraming:'pass'});
 // Every miniature is inspected in isolation using the actual renderer/materials.
 const images=await page.evaluate(async({levels,islands,threeUrl})=>{
  const g=window.__game,T=await import(threeUrl),result=[];
  const width=420,height=320,oldSize=g.renderer.getSize(new T.Vector2());g.renderer.setSize(width,height,false);
  for(const level of levels){
   const original=g.getLevel().root.getObjectByName('world map diorama '+level.progressKey),scene=new T.Scene();scene.background=new T.Color(0xb5c9d1);
   const model=original.clone();model.position.set(0,0,0);scene.add(model);scene.add(new T.HemisphereLight(0xdcefff,0x706046,2.5));const sun=new T.DirectionalLight(0xffedca,2.5);sun.position.set(-6,12,8);scene.add(sun);
   const camera=new T.PerspectiveCamera(40,width/height,.1,100);camera.position.set(13,12,19);camera.lookAt(0,2,0);g.renderer.render(scene,camera);result.push({key:level.progressKey,image:g.renderer.domElement.toDataURL()});
  }
  g.renderer.setSize(oldSize.x,oldSize.y,false);
  const camera=new T.PerspectiveCamera(43,oldSize.x/oldSize.y,.1,2500);camera.position.set(55,830,520);camera.lookAt(55,0,0);
  const fog=g.scene.fog;g.scene.fog=null;g.renderer.render(g.scene,camera);result.push({key:'archipelago-overview',image:g.renderer.domElement.toDataURL()});g.scene.fog=fog;
  return result;
 },{levels,islands,threeUrl:process.env.THREE_REVIEW_URL||'http://127.0.0.1:6264/node_modules/three/build/three.module.js'});
 for(const {key,image} of images)await writeFile(out+'/'+key+'.png',Buffer.from(image.split(',')[1],'base64'));
 assert.deepEqual(errors,[]);console.log(JSON.stringify({checks,errors}));
}finally{await writeFile(out+`/report-${full?'full':'lite'}.json`,JSON.stringify({checks,errors},null,2));await browser.close()}
