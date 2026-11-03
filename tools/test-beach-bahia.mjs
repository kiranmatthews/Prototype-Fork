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
  assert.ok(triangles<10000,`${kind} manual kit stays small`);
  const glass=kit.filter(c=>c.nm.endsWith('separate transparent glass pane'));
  assert.ok(glass.length>0&&glass.every(c=>c.opacity>0&&c.opacity<.25&&c.solid===false),`${kind} has transparent separate panes`);
  report.manualShops[kind]={triangles,parts:kit.length,transparentPanes:glass.length};
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
   for(const x of [7,7.6,8,9,10,11,13,20,28,35]){assert.ok(Number.isFinite(ground(x,-z)),'supported access '+z);report.accessProbes++;}
  }
  const patches=source.components.filter(c=>c.nm?.startsWith('Bahia continuous Treehouse sand'));
  for(let i=1;i<patches.length;i++){
   const a=patches[i-1],b=patches[i];
   for(let j=0;j<33;j++)assert.ok(Math.abs(a.vertices.at(-33+j)+(j%3===2?a.p[2]:0)-b.vertices[j]-(j%3===2?b.p[2]:0))<.00002,'exact shared sand patch edge');
  }
  report.components=source.components.length;report.patches=patches.length;report.islands=5;report.pass=true;
 }finally{l.dispose();}
},{levelEntry:{id:'empty',name:empty.name,data:empty}});
await mkdir('docs/beach-bahia',{recursive:true});
await writeFile('docs/beach-bahia/shore-validation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
