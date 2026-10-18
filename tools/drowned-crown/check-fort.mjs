// Real scene collision/camera clearance at the coastal cliff-to-mine junction.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))??'http://127.0.0.1:5198/';
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'/private/tmp/drowned-fort-clearance';
const packPath=process.argv.find(a=>a.startsWith('--levels='))?.slice(9);
const entry=packPath?JSON.parse(await readFile(packPath,'utf8')).levels.find(l=>l.id==='drowned-crown'):null;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),errors=[];
try{
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.on('crash',()=>errors.push('Page crashed'));page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 if(entry)await page.addInitScript(entry=>{localStorage.setItem('solProtoUserLevels',JSON.stringify([entry]));localStorage.setItem('solProtoCloudPulled','1');},entry);
 await page.goto(new URL('?playtest&level=drowned-crown&lite',base).href,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game?.getCurrentLevel().id==='drowned-crown'&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(async()=>{const g=window.__game;g.campaign.startEphemeral();await g.getLevel().prepareJungleAssets();await g.getLevel().prepareSurfaceImages();});
 await page.waitForTimeout(500);
 const report=await page.evaluate(async()=>{
  const g=window.__game,l=g.getLevel(),v=(...p)=>g.player.pos.clone().set(...p);
  const contact=()=>({surface:null,normal:v(0,0,0),point:v(0,0,0),position:v(0,0,0),surfaceDelta:v(0,0,0),fraction:1,depth:0,top:0});
  const rocks=[...l.worldSolids.surfaces].filter(s=>['crowncrashcavernrock','crowncrashskylight'].includes(s.mesh.userData.jungleAsset)&&s.matrix.elements[14]>40&&s.matrix.elements[14]<100);
  if(rocks.length!==3)throw Error('Expected both native shoulders and the stone canopy in real collision; found '+rocks.length);
  const selected=new Set(rocks),ignore=s=>!selected.has(s);
  // Independently authored walk centreline and usable side lanes, including
  // the diagonal approach. Query a standing rider, not only a floor ray.
  const knots=[[-43,-5.5,90],[-46,-4.3,82],[-48,-3,74],[-48,-1.4,60],[-48,0,48],[-48,0,36]];
  const stations=[],body=[],camera=[];
  for(let segment=0;segment<knots.length-1;segment++){
   const a=v(...knots[segment]),b=v(...knots[segment+1]),direction=b.clone().sub(a);direction.y=0;direction.normalize();
   const right=v(-direction.z,0,direction.x),steps=Math.ceil(a.distanceTo(b)/2);
   for(let i=0;i<steps;i++){
    const from=a.clone().lerp(b,i/steps),to=a.clone().lerp(b,(i+1)/steps);
    for(const lane of [-1.3,0,1.3]){
     const start=from.clone().addScaledVector(right,lane),end=to.clone().addScaledVector(right,lane);start.y+=.12;end.y+=.12;
     const hit=contact();if(l.worldSolids.cast(start,end,{low:.42,high:1.9,radius:.42,ignoreGround:true,groundStep:.8,ignore},hit))
      throw Error('Fort rock blocks the standing route: '+JSON.stringify({segment,i,lane,point:hit.point.toArray(),name:hit.surface?.mesh.name}));
     body.push({segment,station:i,lane});
    }
    stations.push({position:from.toArray(),heading:direction.toArray()});
   }
  }
  // Actual settled follow camera at intervals through the same passage.
  for(const station of stations.filter((_,i)=>i%2===0)){
   const requested=v(...station.position);requested.y+=.15;
   g.player.respawn(l,true,false,{position:requested,heading:v(...station.heading)});
   await new Promise(resolve=>setTimeout(resolve,350));
   if(!g.player.grounded||g.player.totalDeaths!==0||g.player.state!=='ride')throw Error('Unsupported fort camera station');
   const anchor=g.player.pos.clone();anchor.y+=1.2;
   const hit=contact();if(l.worldSolids.cast(anchor,g.camera.position,{low:0,high:0,radius:.22,ignore},hit))
    throw Error('Fort rock crosses the actual camera arm: '+JSON.stringify({position:g.player.pos.toArray(),camera:g.camera.position.toArray(),point:hit.point.toArray(),name:hit.surface?.mesh.name}));
   camera.push({position:g.player.pos.toArray(),camera:g.camera.position.toArray()});
  }
  const contacts=[];
  for(const x of [-67,-27]){
   const hit=contact(),blocked=l.worldSolids.cast(v(-48,0,68),v(x,0,68),{low:.42,high:1.9,radius:.42,ignore},hit);
   if(!blocked||hit.surface?.mesh.userData.jungleAsset!=='crowncrashcavernrock')throw Error('New rock shoulder has no physical contact');
   contacts.push({towardX:x,point:hit.point.toArray(),normal:hit.normal.toArray()});
  }
  return{bodySweeps:body.length,cameraStations:camera.length,solidInstances:rocks.length,contacts,camera,loading:g.getLoadingDiagnostics(),stamp:document.querySelector('.hud-build')?.textContent};
 });
 assert.deepEqual(report.loading.failed,[]);assert.deepEqual(errors,[]);
 await writeFile(out+'/report.json',JSON.stringify({...report,errors},null,2)+'\n');
 console.log(JSON.stringify({bodySweeps:report.bodySweeps,cameraStations:report.cameraStations,solidInstances:report.solidInstances,contacts:report.contacts,errors}));
}finally{await browser.close();}
