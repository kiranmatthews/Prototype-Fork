import assert from "node:assert/strict";
import { createServer } from "vite";
import * as THREE from "three";

const server = await createServer({logLevel:"silent",server:{middlewareMode:true},appType:"custom"});
try {
  const {TropicalPlantKit,TROPICAL_PLANT_KINDS} = await server.ssrLoadModule("/src/tropicalPlants.ts");
  const kit = new TropicalPlantKit();
  const scene = new THREE.Scene();
  const geometries = new Set(), materials = new Set();
  for(const kind of TROPICAL_PLANT_KINDS) {
    const plant = kit.create(kind);
    scene.add(plant);
    const bounds = new THREE.Box3().setFromObject(plant);
    assert.ok(bounds.max.y>1 && bounds.min.y>-.2,`${kind} needs a supported stem and recognizable height`);
    plant.traverse((mesh)=>{
      if(!mesh.isMesh)return;
      geometries.add(mesh.geometry);materials.add(mesh.material);materials.add(mesh.customDepthMaterial);
      const {position,color,aPlantFlex}=mesh.geometry.attributes;
      assert.equal(color.count,position.count);
      assert.equal(aPlantFlex.count,position.count);
      assert.ok(Array.from(position.array).every(Number.isFinite));
      assert.equal(mesh.material.map,null,"plant color must come from geometry, not a bitmap");
      assert.ok(mesh.material.userData.gouraud && mesh.customDepthMaterial);
    });
    const duplicate = kit.create(kind);
    assert.equal(duplicate.children[0].geometry,plant.children[0].geometry,"repeated plants must share geometry");
  }

  // A monstera must have actual holes in its triangulated surface. Count
  // connected boundary loops after welding the non-indexed template vertices.
  const leaves=kit.create("monstera").children[1].geometry.attributes.position;
  const ids=new Map(), edges=new Map();
  const vertex=(i)=>{
    const key=[leaves.getX(i),leaves.getY(i),leaves.getZ(i)].map(n=>Math.round(n*1e5)).join(",");
    if(!ids.has(key))ids.set(key,ids.size);
    return ids.get(key);
  };
  for(let i=0;i<leaves.count;i+=3){
    const tri=[vertex(i),vertex(i+1),vertex(i+2)];
    for(let e=0;e<3;e++){
      const pair=[tri[e],tri[(e+1)%3]].sort((a,b)=>a-b).join("|");
      edges.set(pair,(edges.get(pair)||0)+1);
    }
  }
  const adjacency=new Map();
  for(const [edge,count] of edges)if(count===1){
    const [a,b]=edge.split("|").map(Number);
    if(!adjacency.has(a))adjacency.set(a,[]);
    if(!adjacency.has(b))adjacency.set(b,[]);
    adjacency.get(a).push(b);adjacency.get(b).push(a);
  }
  let loops=0;const seen=new Set();
  for(const start of adjacency.keys()){
    if(seen.has(start))continue;
    loops++;const stack=[start];
    while(stack.length){const n=stack.pop();if(seen.has(n))continue;seen.add(n);stack.push(...adjacency.get(n));}
  }
  assert.ok(loops>=35,`monstera fenestrations disappeared (${loops} boundary loops)`);

  kit.update(1/60);const time=kit.time.value;
  kit.update(0);assert.equal(kit.time.value,time,"paused plant time advanced");
  kit.update(1/60);assert.ok(kit.time.value>time);
  const batch=kit.batch("fanpalm",[new THREE.Matrix4(),new THREE.Matrix4().makeTranslation(8,0,0)]);
  assert.equal(batch.children[0].count,2);
  const disposal=new Map();
  for(const resource of [...geometries,...materials])resource.addEventListener("dispose",()=>disposal.set(resource,(disposal.get(resource)||0)+1));
  kit.dispose();kit.dispose();
  assert.equal(scene.children.length,0);
  for(const count of disposal.values())assert.equal(count,1,"plant resource disposed more than once");
  assert.throws(()=>kit.create("monstera"),/disposed/);
  console.log("Validated five reusable tropical species, real monstera leaf holes, vertex shading attributes, batched reuse, paused wind clock, and resource ownership.");
}finally{await server.close();}
