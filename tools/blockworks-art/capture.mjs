// Authoring inspection: native production camera at explicitly logged poses.
// These screenshots do not claim to be an input-only gameplay acceptance run.
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
const base=process.env.BLOCKWORKS_URL||'http://127.0.0.1:5187';
const pass=process.argv.includes('--after')?'after':'captures';
const out=`${ROOT}/docs/blockworks-art/${pass}`;
await mkdir(out,{recursive:true});
const hash=s=>createHash('sha256').update(s).digest('hex');
const sourceFiles=pass==='after'?['src/levels/codex-lab.ts','src/levels/blockworks-art.ts','src/blockworksAssets.ts','src/blockworksSurfaces.ts','src/blockworksMattes.ts','src/blockworksLighting.ts','src/blockworksModelLoader.ts','src/level.ts','src/main.ts','src/levelAtmosphere.ts','src/seaBackdrop.ts','tools/blockworks-art/asset-manifest.json']:['src/levels/codex-lab.ts'];
const sourceSha256=hash((await Promise.all(sourceFiles.map(async p=>p+':'+hash(await readFile(ROOT+'/'+p))))).join('\n'));
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const manifest={schemaVersion:1,createdAt:new Date().toISOString(),sourceSha256,pass,
 method:'Inspection placements with production gameplay follow camera; no authored camera override. Not traversal evidence.',
 sourceFiles,viewport:{width:1600,height:900},render:'full',shots:[],errors};
try{const previous=JSON.parse(await readFile(`${out}/manifest.json`,'utf8'));if(previous.sourceSha256===sourceSha256)manifest.shots=previous.shots;}catch(error){if(error.code!=='ENOENT')throw error;}
const flush=()=>writeFile(`${out}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');
try{
 await page.goto(`${base}/?playtest&level=codex-lab`,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 const plan=await page.evaluate(async()=>{
  const m=await import('/src/levels/codex-lab.ts');
 const g=window.__game,p=g.player,l=g.getLevel();
  // Art review uses the existing MAX/native renderer setting. Default 720p
  // performance and input behaviour are checked separately by browser-audit.
  g.renderQualitySettings.setRegularResolution(null);
  g.campaign.startEphemeral();g.gameFlow.hide();
  // Freeze only the rider simulation. The normal follow camera, rendering,
  // asset preparation and world animation continue to run.
  p.step=()=>{};
  const shots=[];
  const add=(s,y,u,label,kind='route')=>{
   const district=m.BLOCKWORKS_SECTIONS.findIndex(d=>s>=d.a&&s<d.b);
   const position=m.routePoint(s,y+.04,u),heading=m.routeTangent(s);
   // Show the reward/key crate from immediately behind it, rather than
   // placing the frozen inspection rider inside its collision box.
   if(label==='Foundry reward and bonus branch'||label==='Foundry upper key'){
    position[0]-=heading[0]*1.8;position[2]-=heading[2]*1.8;
   }
   shots.push({station:s,district:Math.max(0,district<0?7:district),position,heading,label,kind});
  };
  const val=(v,s)=>typeof v==='function'?v(s):v;
  // 30-station spacing plus every feature. Curvature makes actual spacing
  // vary; screen-frustum metadata is retained to audit the visible coverage.
  for(let s=2;s<=2136;s+=30){
   const roads=m.BLOCKWORKS_ROADS.filter(r=>s>=r.a&&s<=r.b);
   if(!roads.length)continue;
   const r=roads.reduce((a,b)=>val(a.top,s)>val(b.top,s)?a:b);
   add(s,val(r.top,s)+(s>=770&&s<=920?.04:0),val(r.offset,s),`Route ${s}`);
  }
  for(const c of m.BLOCKWORKS_CLIMBS)for(const [i,t]of c.steps.entries())add(t.s,t.top,t.u,`${c.name} tier ${i+1}`,'roof');
  for(const s of [78,93,109])add(s,s===93?2.8:1.4,-3.4,'Entry shelf alternative','branch');
  for(const u of [-10,10])add(310,-.03,u,u<0?'West courtyard gallery':'East courtyard gallery','branch');
  for(const t of m.BLOCKWORKS_GAPS){
   if(t.kind==='three-switch route puzzle')continue;
   const r=m.BLOCKWORKS_ROADS.find(r=>t.a-.8>=r.a&&t.a-.8<=r.b);
   if(r)add(t.a-.8,val(r.top,t.a-.8),val(r.offset,t.a-.8),`${t.kind} takeoff`,'jump');
  }
  add(1131,3.6,11,'Foundry reward and bonus branch','branch');
  add(1136,8.4,-5.4,'Foundry upper key','puzzle');
  for(const s of [1119.5,1161,1195]){const stair=s<1140;add(s,stair?6.68:8.635,stair?-5.4:0,'Materialized foundry route','conditional');}
  for(const [s,y,u]of [[826,14.8,6.2],[874,15.6,-6.2]])add(s,y,u,'High aqueduct wall-air view','aerial');
  add(974,5,-1.2,'Aqueduct rail transfer','rail');
  add(1355,8.4,0,'Freight deck crossing','mover');
  add(1410,10.8,0,'Loading lift','mover');
  add(1380,12,5.7,'Machinery elevated rail','rail');
  add(1728,7.2,5.5,'Relay east roof','branch');
  add(1836,8.4,-5,'Relay west roof','branch');
  add(2108,14,-2.5,'Final returning grind','rail');
  add(2132,13.2,0,'Finish courtyard and gate','finish');
  shots.sort((a,b)=>a.station-b.station||a.kind.localeCompare(b.kind));
  return shots.map((s,i)=>({...s,id:`${String(i+1).padStart(3,'0')}-d${s.district+1}-${Math.round(s.station)}`}));
 });
 await writeFile(`${ROOT}/tools/blockworks-art/views.json`,JSON.stringify(plan,null,2)+'\n');
 const limit=Number(process.env.BLOCKWORKS_CAPTURE_LIMIT||plan.length);
 const start=Number(process.env.BLOCKWORKS_CAPTURE_START||0);
 const selectedIds=process.env.BLOCKWORKS_CAPTURE_IDS?.split(',');
 for(const shot of selectedIds?plan.filter(s=>selectedIds.includes(s.id)):plan.slice(start,start+limit)){
  const placement=await page.evaluate(async shot=>{
   const g=window.__game,p=g.player,l=g.getLevel();
   window.__bwWorldUpdate??=l.update.bind(l);l.update=window.__bwWorldUpdate;
   g.gameFlow.hide();p.respawn(l,true,true,{position:p.pos.clone().set(...shot.position),heading:p.pos.clone().set(...shot.heading)});
   if(shot.kind==='conditional')for(const crate of l.crates)if(crate.bang)l.triggerBang(crate);
   p.state='ride';p.grounded=shot.kind!=='aerial'&&shot.kind!=='rail';p.speed=0;p.vVel=0;
   p.pos.set(...shot.position);
   if(shot.kind==='mover'){
    // Inspect the real deck at its current cycle pose with the rider on it.
    // Freeze that world pose while the native follow camera settles.
    l.update=()=>{};
    const m=l.movers.reduce((a,b)=>a.base.distanceToSquared(p.pos)<b.base.distanceToSquared(p.pos)?a:b);
    m.mesh.updateWorldMatrix(true,false);m.mesh.geometry.computeBoundingBox();
    const box=m.mesh.geometry.boundingBox.clone().applyMatrix4(m.mesh.matrixWorld);
    box.getCenter(p.pos);p.pos.y=box.max.y+.04;
   }
   // Shelf access ramps can sit above the analytic road height. Use actual
   // collision support so the reference rider is never embedded in a ramp.
   let support=null;
   if(!['aerial','rail','mover','conditional'].includes(shot.kind)){
    // Placement may begin below an authored access ramp, beyond the player's
    // normal step-up allowance. Inspect actual collision triangles from above.
    p.raycaster.set(p.pos.clone().add(p.pos.clone().set(0,16,0)),p.pos.clone().set(0,-1,0));p.raycaster.far=30;
    const hit=p.raycaster.intersectObjects(l.groundMeshes,false).find(h=>h.object.visible&&h.point.y>=p.pos.y-.5&&h.point.y<=p.pos.y+14&&h.face?.normal.clone().transformDirection(h.object.matrixWorld).y>.2);
    support=hit?{y:hit.point.y}:p.queryGround(l);
    if(support&&support.y>p.pos.y-.5&&support.y<p.pos.y+14)p.pos.y=support.y+.04;
   }
   p.prevPos.copy(p.pos);p.resetRenderInterpolation();p.commitRenderStep(l);p.collapseRenderInterpolation();
   // Simulation-frozen captures never stand in for testing switches or movers.
   // Keep pre-switch ghosts as visible authored cues; optional perched views
   // are explicitly marked in the manifest.
   for(let i=0;i<45;i++)await new Promise(requestAnimationFrame);
   return{position:p.pos.toArray(),supportY:support?.y??null};
  },shot);
  const camera=await page.evaluate(()=>{
   const g=window.__game,c=g.camera,l=g.getLevel();
   const visible=[];
   for(const [i,m]of l.groundMeshes.entries()){
    if(!m.visible)continue;
    if(!m.geometry.boundingSphere)m.geometry.computeBoundingSphere();
    const b=m.geometry.boundingSphere;if(!b)continue;
    const v=b.center.clone().applyMatrix4(m.matrixWorld),distance=v.distanceTo(c.position),screen=v.clone().project(c);
    if(distance<230&&screen.z>0&&screen.z<1&&Math.abs(screen.x)<1.25&&Math.abs(screen.y)<1.25)visible.push(i);
   }
   return{position:c.position.toArray(),quaternion:c.quaternion.toArray(),fov:c.fov,aspect:c.aspect,
    matrixWorld:c.matrixWorld.toArray(),projectionMatrix:c.projectionMatrix.toArray(),player:g.player.pos.toArray(),visibleGroundMeshIndices:visible,
    artDiagnostics:l.blockworksArtDiagnostics,frameStats:g.getRenderFrameStats(),renderResolution:g.getRenderQualitySizes(),buildStamp:document.querySelector('.hud-build')?.textContent??null};
  });
  const file=`${shot.id}.png`;
  await page.screenshot({path:`${out}/${file}`});
  manifest.shots=manifest.shots.filter(s=>s.id!==shot.id);
  manifest.shots.push({...shot,placement,camera,file,sha256:hash(await readFile(`${out}/${file}`)),storyboard:null});
  manifest.shots.sort((a,b)=>a.id.localeCompare(b.id));
  await flush();
  console.log(JSON.stringify({captured:shot.id,label:shot.label,total:manifest.shots.length,planned:plan.length,errors:errors.length}));
 }
 await flush();
 if(errors.length)throw new Error(`Browser errors: ${errors.join('; ')}`);
}finally{await flush();await browser.close();}
