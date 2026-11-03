import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
const report={dryProbes:0,accessProbes:0,waveProbes:0};
report.assets={};
for(const [name,budget] of Object.entries({'pizza-slice':3000,'snack-sign':5000,'funville-marquee':8000})){
 const file=`public/coastal-town/bahia-${name}`,bytes=await readFile(file+'.glb'),manifest=JSON.parse(await readFile(file+'.json','utf8'));
 assert.equal(bytes.toString('ascii',0,4),'glTF');
 const gltf=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)));
 const triangles=gltf.meshes.flatMap(m=>m.primitives).reduce((n,p)=>n+gltf.accessors[p.indices].count/3,0);
 assert.ok(triangles>0&&triangles<=budget&&triangles<=30000,`${name} meets its component budget`);
 assert.match(manifest.source,/Smart Mesh P2\.0/);
 assert.equal(triangles,manifest.triangles);
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest.sha256);
 report.assets[name]={triangles,budget,bytes:bytes.length};
}
const empty={v:1,name:'Bahia test harness',spawn:[0,.1,0],killY:-10,components:[{t:'platform',p:[0,-.5,0],s:[20,1,40]},{t:'gate',p:[0,0,-18]}]};
await withSkateRuntime(async({server,THREE,Level})=>{
 const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
 const {BAHIA_OPENINGS:openings,bahiaShoreX:shore}=await server.ssrLoadModule('/src/levels/beach-bahia-shore.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');
 assert.ok(normalizeCustomLevelData(source),'complete Beach Street must survive editor import');
 const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
 assert.equal(hash(source.components.filter(c=>c.grp===104)),'cc193e55d3886a0f076ba940edfce43a6e0a4286a9c054cf1b1d12bf07ca71b3','offshore islands and every island prop preserved exactly');
 assert.equal(hash(source.components.filter(c=>[1,2,3,6,8,11].includes(c.grp))),'0332e686fe91493b8412961c6edb3d73c1743ef27e650850a784eeb88a5c5a55','roads, four pits, stairs, kite encounters, cameras and finish unchanged');
 assert.equal(source.unitySand,undefined,'old submerged rectangle retired');
 assert.equal(source.components.filter(c=>c.t==='gate').length,1);
 report.manualShops={};
 for(const kind of ['snack','funville','pizza']){
  const floor=source.components.find(c=>c.nm===`Bahia ${kind} / interior floor`);
  const kit=source.components.filter(c=>c.grp===floor.grp&&c.nm?.startsWith(`Bahia ${kind} /`));
  const triangles=kit.reduce((n,c)=>n+(c.indices?.length??0)/3,0);
  const signTriangles=kind==='funville'?report.assets['funville-marquee'].triangles:kind==='pizza'?report.assets['pizza-slice'].triangles:0;
  assert.ok(triangles<=20000&&triangles+signTriangles<=30000,`${kind} complete furnished shop stays under 30k triangles`);
  const glass=kit.filter(c=>c.nm.endsWith('separate transparent glass pane'));
  assert.ok(glass.length>0&&glass.every(c=>c.opacity>0&&c.opacity<.25&&c.solid===false),`${kind} has transparent separate panes`);
  if(kind==='snack')assert.equal(kit.filter(c=>c.nm.includes('hand-built sign letter')).map(c=>c.nm.at(-1)).join(''),'SNACKSHACK','correct geometric lettering replaces the misspelled generated plaque');
  assert.ok(kit.some(c=>c.nm.endsWith('foundation skirt fitted below terrace')),'closed foundations at graded shop placements');
  for(const c of kit)if(c.t==='mesh')assert.ok([...(c.vertices??[]),...(c.normals??[]),...(c.uvs??[]),...(c.colors??[])].every(Number.isFinite),'finite manual geometry');
  report.manualShops[kind]={triangles,totalWithSign:triangles+signTriangles,parts:kit.length,transparentPanes:glass.length};
 }
 const data={...source,components:source.components.filter(c=>c.t!=='decor'&&c.solid!==false)};
 const l=new Level(new THREE.Scene(),{id:'bahia-test',name:source.name,data});
 try{
  l.root.updateMatrixWorld(true);l.water.group.updateMatrixWorld(true);
  const water=l.water.group.getObjectByName('Unity curved shoreline ocean ribbon');
  const horizon=l.water.group.getObjectByName('Unity ocean horizon fill');
  assert.ok(water&&horizon);
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const ground=(x,z)=>{ray.set(new THREE.Vector3(x,30,z),down);return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;};
  // The terrace is visual scenery, so inspect its authored triangles rather
  // than the road collision mesh beneath it.
  const terraces=source.components.filter(c=>c.nm==='Town terrace foundation / follows the road grade').map(c=>{
   const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));g.setIndex(c.indices);
   const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));m.position.fromArray(c.p);m.rotation.y=(c.yaw??0)*Math.PI/180;m.updateMatrixWorld(true);return m;
  });
  report.shopFloorClearance=[];
  for(const floor of source.components.filter(c=>/^Bahia .* \/ interior floor$/.test(c.nm??''))){
   const top=floor.p[1]+.12;
   const clearance=Math.min(...[-5.3,-2.65,0,2.65,5.3].map(d=>{
    ray.set(new THREE.Vector3(floor.p[0],30,floor.p[2]+d),down);
    return top-ray.intersectObjects(terraces,false)[0]?.point.y;
   }));
   assert.ok(clearance>.025,`terrace cannot clip through ${floor.nm} at ${floor.p[2]}: ${clearance}`);
   report.shopFloorClearance.push({shop:floor.nm,z:floor.p[2],clearance});
  }
  terraces.forEach(m=>{m.geometry.dispose();m.material.dispose();});
  for(let z=0;z<=3020;z+=19)for(let x=8;x<shore(z)+1;x+=.65){
   const y=ground(x,-z);assert.ok(y!==undefined,`continuous sand ${x}/${z}`);
   if(y<-.6)continue;
   assert.equal(ray.intersectObject(water).length,0,`no near water over dry sand ${x}/${z}`);
   assert.equal(ray.intersectObject(horizon).length,0,`no far water over dry sand ${x}/${z}`);
   report.dryProbes++;
  }
  // Actual wave displacement must not carry the shoreline edge back across
  // the sea-level contour at any point in the sampled animation cycle.
  let minMargin=Infinity;
  for(let z=0;z<3020;z+=37)for(let t=0;t<24;t+=.5){
   const x=shore(z)+.65,s=l.water.sampleWaterSurface(x,-z,t);
   const margin=x+s.displacementX-shore(z-s.displacementZ);
   minMargin=Math.min(minMargin,margin);report.waveProbes++;
  }
  report.minimumAnimatedShoreMargin=minMargin;assert.ok(minMargin>.2,`waves stay offshore: ${minMargin}`);
  for(const z of openings){
   const y=ground(6.5,-z);
   assert.ok(!l.walls.some(w=>w.containsPoint(new THREE.Vector3(7.2,y+.55,-z))),'opening has no wall '+z);
   for(let dz=-2.6;dz<=2.6;dz+=1.3)for(let x=6.5;x<=11;x+=.75){
    const h=ground(x,-z+dz);assert.ok(Number.isFinite(h));
    assert.ok(!l.walls.some(w=>w.containsPoint(new THREE.Vector3(x,h+.55,-z+dz))),`entrance remains clear ${z}/${x}/${dz}`);
   }
   for(const x of [7,7.6,8,9,10,11,13,20,28,35]){assert.ok(Number.isFinite(ground(x,-z)),'supported access '+z);report.accessProbes++;}
  }
  const patches=source.components.filter(c=>c.nm?.startsWith('Bahia continuous Treehouse sand'));
  for(let i=1;i<patches.length;i++){
   const a=patches[i-1],b=patches[i];
   for(let j=0;j<33;j++)assert.ok(Math.abs(a.vertices.at(-33+j)+(j%3===2?a.p[2]:0)-b.vertices[j]-(j%3===2?b.p[2]:0))<.00002,'exact shared sand patch edge');
  }
  const stoneBays=source.components.filter(c=>c.nm?.startsWith('Bahia hand-set stone bay'));
  assert.ok(stoneBays.length>200&&stoneBays.every(c=>c.indices.length/3<2000),'small complete stone bays, never a distance-dependent mesh substitute');
  report.wall={stoneBays:stoneBays.length,entrances:openings.length,piers:source.components.filter(c=>c.nm?.startsWith('Bahia rhythm pier')).length};
  report.components=source.components.length;report.patches=patches.length;report.islands=5;report.pass=true;
 }finally{l.dispose();}
},{levelEntry:{id:'empty',name:empty.name,data:empty}});
await mkdir('docs/beach-bahia',{recursive:true});
await writeFile('docs/beach-bahia/shore-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
