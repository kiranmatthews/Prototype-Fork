import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
try{
 const {cutPiratePassage}=await server.ssrLoadModule('/src/levels/pirate-clearance.ts');
 const source=await server.ssrLoadModule('/src/levels/pirate-wreck.ts');
 const {WorldSolids,solidContact}=await server.ssrLoadModule('/src/worldSolids.ts');
 const mesh=c=>{const g=new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));g.setIndex(c.indices);return new THREE.Mesh(g,new THREE.MeshBasicMaterial({side:THREE.DoubleSide}));};
 const area=c=>{let value=0;for(let i=0;i<c.indices.length;i+=3){const p=c.indices.slice(i,i+3).map(id=>new THREE.Vector3(...c.vertices.slice(id*3,id*3+3)));value+=new THREE.Triangle(...p).getArea();}return value;};
 let checks=0;
 for(const {a,b,width,height}of [...source.PIRATE_HATCH_PASSAGES,source.PIRATE_GROTTO_PASSAGE]){
  const forward=new THREE.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize(),right=new THREE.Vector3(-forward.z,0,forward.x),mid=new THREE.Vector3(...a).lerp(new THREE.Vector3(...b),.5);
  const point=(u,y)=>mid.clone().addScaledVector(right,u).add(new THREE.Vector3(0,y,0));
  const fixture={t:'mesh',p:[0,0,0],nm:'Independent structural wall',grp:3,color:'#754832',solid:false,vertices:[...point(-6,0).toArray(),...point(6,0).toArray(),...point(6,4.5).toArray(),...point(-6,4.5).toArray()],indices:[0,1,2,0,2,3]};
  const cut=cutPiratePassage(fixture,a,b,width,height);
  assert.notEqual(cut,fixture);assert.ok(Math.abs(area(fixture)-area(cut)-width*(height-.08))<.025,'only the prescribed passage area is removed');
  for(const key of ['nm','grp','color','solid'])assert.equal(cut[key],fixture[key]);
  const outside={...fixture,vertices:fixture.vertices.map((n,i)=>i%3===0?n+100:n)};assert.equal(cutPiratePassage(outside,a,b,width,height),outside,'unaffected geometry keeps its exact original data');
  const worlds=[new WorldSolids(),new WorldSolids()],meshes=[mesh(fixture),mesh(cut)];worlds.forEach((w,i)=>w.add(meshes[i]));
  const cast=(world,u,y=.12)=>world.cast(point(u,y).addScaledVector(forward,-1),point(u,y).addScaledVector(forward,1),{low:.4,high:2,radius:.4,axis:new THREE.Vector3(0,1,0)},solidContact());
  assert.equal(cast(worlds[0],0),true,'the original structural wall reproduces an obstruction');
  for(const u of [-2,0,2])assert.equal(cast(worlds[1],u),false,'body clearance crosses the real cut, not a collision exception');
  assert.equal(cast(worlds[1],4.5),true,'the structural wall remains solid outside the opening');
  assert.equal(cast(worlds[1],0,3.8),true,'structure above the specified headroom remains solid');
  worlds.forEach(w=>w.dispose());meshes.forEach(m=>{m.geometry.dispose();m.material.dispose();});checks+=6;
 }
 let parity;
 if(process.env.PIRATE_BASELINE_MODULE){
  const before=(await server.ssrLoadModule(process.env.PIRATE_BASELINE_MODULE)).PIRATE_WRECK_LEVEL,after=source.PIRATE_WRECK_LEVEL;
  const affected=new Set(['Individual weathered deck plank','Hand-shaped broken galleon hull planking','Hull oak frame','Afterdeck','Forecastle port deck','Forecastle starboard lip','Bow hatch receiving deck','Faceted underground tunnel shell']);
  assert.deepEqual(after.components.filter(c=>!affected.has(c.nm)),before.components.filter(c=>!affected.has(c.nm)),'every unrelated component must remain exact');
  const hash=c=>createHash('sha256').update(JSON.stringify(c)).digest('hex'),counts=new Map();for(const c of before.components){const h=hash(c);counts.set(h,(counts.get(h)??0)+1);}
  let identical=0;for(const c of after.components){const h=hash(c),n=counts.get(h)??0;if(n){identical++;counts.set(h,n-1);}}
  const visual=c=>{const {scenerySolid,...rest}=c;return hash(rest);},visuals=new Map();
  for(const c of before.components){const h=visual(c);visuals.set(h,(visuals.get(h)??0)+1);}
  let visualIdentical=0;for(const c of after.components){const h=visual(c),n=visuals.get(h)??0;if(n){visualIdentical++;visuals.set(h,n-1);}}
  parity={before:before.components.length,after:after.components.length,identical,visualIdentical,changedOrRemoved:before.components.length-identical,changedOrAdded:after.components.length-identical};
 }
 console.log(JSON.stringify({pass:true,bodySweeps:checks,parity}));
}finally{await server.close();}
