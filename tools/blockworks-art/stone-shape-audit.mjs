// Inspect the real loaded Meshy geometry, independently of its textures.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.BLOCKWORKS_URL||'http://127.0.0.1:5187',out='docs/blockworks-art/stone-shape';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1600,height:900}}),errors=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(base+'/?playtest&level=codex-lab');
 await page.waitForFunction(()=>window.__game&&!window.__game.gameFlow.blocksGameplay,null,{timeout:120000});
 const result=await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),m=await import('/src/levels/codex-lab.ts');
  const g=window.__game,l=g.getLevel(),p=g.player;await l.prepareJungleAssets();p.step=()=>{};
  for(const c of l.crates)if(c.bang)l.triggerBang(c);
  l.root.updateWorldMatrix(true,true);
  const owner=l.blockworksSurfaces,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),roadMeshes=[],wedges=[];
  let meshes=0,triangles=0;const collisionErrors=[];
  for(const piece of owner.pieces){
   const kind=piece.userData.blockworksModule?.kind;if(!kind?.match(/flagstone-deck-v4|stone-wedge|metal-wedge/))continue;
   const proxy=owner.proxies.get(piece),native=proxy?m.CODEX_LAB_LEVEL.components[proxy.userData.editorIdx]:null;
   const entries=[];
   piece.traverse(o=>{if(!o.isMesh)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;
    if(o.userData.solidSurface!=='none'||!o.userData.visualOnly||l.groundMeshes.includes(o))collisionErrors.push(o.name||kind);
    entries.push({mesh:o,box:new THREE.Box3().setFromObject(o)});
   });
   if(!proxy)roadMeshes.push(...entries);
   if(piece.userData.blockworksModule.dedicatedWedge)wedges.push({name:native?.nm,kind,entries});
  }
  const quantiles=values=>{values.sort((a,b)=>a-b);return Object.fromEntries([0,.05,.5,.95,1].map(q=>[q,values[Math.floor(q*(values.length-1))]]));};
  const probe=(entries,x,y,z,depth=3)=>{
   ray.set(new THREE.Vector3(x,y+.12,z),down);ray.far=depth;
   const hits=ray.intersectObjects(entries.filter(e=>x>=e.box.min.x&&x<=e.box.max.x&&z>=e.box.min.z&&z<=e.box.max.z).map(e=>e.mesh),false);
   return hits.find(h=>h.face?.normal.clone().transformDirection(h.object.matrixWorld).y>.2);
  };
  const rampRows=[];
  for(const w of m.BLOCKWORKS_SKATE_RAMPS){
   const visual=wedges.find(v=>v.name===w.name),dx=w.high[0]-w.low[0],dz=w.high[2]-w.low[2],length=Math.hypot(dx,dz),heights=[];let missing=0;
   if(!visual){rampRows.push({name:w.name,missingModel:true});continue;}
   for(let i=0;i<40;i++)for(const side of [-.35,-.175,0,.175,.35]){
    const t=(i+.5)/40,x=w.low[0]+dx*t-dz/length*w.width*side,z=w.low[2]+dz*t+dx/length*w.width*side,y=w.low[1]+(w.high[1]-w.low[1])*t;
    const hit=probe(visual.entries,x,y,z);if(hit)heights.push(hit.point.y-y);else missing++;
   }
   rampRows.push({name:w.name,kind:visual.kind,samples:200,missing,surfaceMinusNativeMetres:quantiles(heights)});
  }
  const roadHeights=[],missingRoad=[];let roadSamples=0;
  const value=(v,s)=>typeof v==='function'?v(s):v;
  for(const road of m.BLOCKWORKS_ROADS){
   if(road.ice||road.a===770&&road.b===920)continue;
   for(let s=road.a+.8;s<road.b-.8;s+=2.3)for(const side of [-.35,0,.35]){
    const y=value(road.top,s),u=value(road.offset,s)+side*value(road.width,s),pos=m.routePoint(s,y,u);roadSamples++;
    const hit=probe(roadMeshes,pos[0],y,pos[2],1.4);
    if(hit)roadHeights.push(hit.point.y-y);else missingRoad.push({station:s,side});
   }
  }
  const {BlockworksSurfaces}=await import('/src/blockworksSurfaces.ts'),previewRoot=new THREE.Group(),preview=new BlockworksSurfaces(previewRoot);
  for(const [kind,size]of [['bw-stone-wedge',[2.6,2.4,8]],['bw-metal-wedge',[1.8,1,4]]])preview.decorate({t:'decor',dkind:kind,p:[0,0,0],s:size});
  await preview.ready();previewRoot.updateWorldMatrix(true,true);
  const looseWedges=preview.owners.map(o=>new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3()).toArray());preview.dispose();
  return{models:l.blockworksArtDiagnostics.surfaces.models,meshes,triangles,collisionErrors,looseWedges,
   method:'Downward ray intersections against actual loaded render triangles; heights compared with unchanged authored ramp planes and road profiles. Samples exclude the chipped outermost 15% of each side.',
   ramps:rampRows,roads:{samples:roadSamples,missing:missingRoad,surfaceMinusNativeMetres:quantiles(roadHeights)}};
 });
 const captures=JSON.parse(await readFile('docs/blockworks-art/after/manifest.json','utf8'));
 const pose=captures.shots.find(s=>s.id==='014-d2-272');
 await page.evaluate(async pose=>{
  const g=window.__game,p=g.player,l=g.getLevel();g.renderQualitySettings.setRegularResolution(null);g.gameFlow.hide();
  p.respawn(l,true,true,{position:p.pos.clone().set(...pose.placement.position),heading:p.pos.clone().set(...pose.heading)});
  p.state='ride';p.grounded=true;p.speed=0;p.vVel=0;p.pos.set(...pose.placement.position);p.prevPos.copy(p.pos);p.resetRenderInterpolation();p.commitRenderStep(l);p.collapseRenderInterpolation();
  for(let i=0;i<45;i++)await new Promise(requestAnimationFrame);
 },pose);
 await page.screenshot({path:out+'/courtyard-textured.png'});
 await page.evaluate(async()=>{
  const THREE=await import('/node_modules/three/build/three.module.js'),g=window.__game;
  const clay=new THREE.MeshStandardMaterial({color:0xb0aaa0,roughness:1,metalness:0});
  for(const piece of g.getLevel().blockworksSurfaces.pieces)if(piece.userData.blockworksModule?.kind.match(/flagstone-deck-v4|stone-wedge/))piece.traverse(o=>{if(o.isMesh)o.material=clay;});
  for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);
 });
 await page.screenshot({path:out+'/courtyard-clay.png'});
 const sourceSha256=createHash('sha256').update(await readFile('src/blockworksSurfaces.ts')).digest('hex');
 await writeFile(out+'/geometry-audit.json',JSON.stringify({createdAt:new Date().toISOString(),sourceSha256,...result,errors},null,2)+'\n');
 console.log(JSON.stringify(result));
 assert.deepEqual(errors,[]);assert.deepEqual(result.collisionErrors,[]);
 assert.equal(result.ramps.length,19);assert.equal(result.ramps.filter(r=>r.kind==='bw-stone-wedge').length,14);assert.equal(result.ramps.filter(r=>r.kind==='bw-metal-wedge').length,5);
 for(const [i,size]of [[2.6,2.4,8],[1.8,1,4]].entries())for(let axis=0;axis<3;axis++)assert.ok(Math.abs(result.looseWedges[i][axis]-size[axis])<.0001,'editor wedge preview bounds');
 assert.ok(result.ramps.every(r=>r.missing===0),'open hole in sampled ramp riding strip');
 assert.ok(result.ramps.every(r=>!r.missingModel&&r.surfaceMinusNativeMetres['1']<.04),'ramp artwork obscures the authored riding plane');
 assert.ok(result.roads.surfaceMinusNativeMetres['1']<.05,'stone face protrudes too far above native support');
}finally{await browser.close();}
