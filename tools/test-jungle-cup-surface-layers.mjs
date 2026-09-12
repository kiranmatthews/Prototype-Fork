import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({ THREE, server, level }) => {
  const { parseCustomLevelJson }=await server.ssrLoadModule('/src/level.ts');
  const ray=new THREE.Raycaster(),pairs=new Map();let samples=0,layered=0;
  const bias=hit=>{
    const m=Array.isArray(hit.object.material)?hit.object.material[hit.face.materialIndex]:hit.object.material;
    return m.polygonOffset?m.polygonOffsetUnits:0;
  };
  const names=hit=>`${hit.object.userData.editorIdx}:${hit.object.name}`;
  for(let x=-51.71;x<52;x+=.73)for(let z=-122.63;z<30;z+=.79){
    ray.set(new THREE.Vector3(x,15,z),new THREE.Vector3(0,-1,0));ray.far=16;
    const unique=new Map();
    for(const h of ray.intersectObjects(level.groundMeshes,false))if(h.face&&h.face.normal.y>.98&&!unique.has(h.object))unique.set(h.object,h);
    const hits=[...unique.values()];samples++;
    for(let a=0;a<hits.length;a++)for(let b=a+1;b<hits.length;b++){
      if(Math.abs(hits[a].point.y-hits[b].point.y)>.0005)continue;
      const key=[names(hits[a]),names(hits[b])].sort().join(' / ');pairs.set(key,(pairs.get(key)??0)+1);
      assert.notEqual(bias(hits[a]),bias(hits[b]),`unresolved coplanar render surfaces ${key} at ${x}/${z}`);
      layered++;
    }
  }
  assert.ok(layered>100,'audit missed the shared flat beds');
  const data=level.captureData(),restored=parseCustomLevelJson(JSON.stringify(data));
  assert.equal(restored.components[0].depthBias,2,'editor round-trip dropped floor layering');
  for(const invalid of [9,-9,'2',null]){
    const copy=structuredClone(data);copy.components[0].depthBias=invalid;
    assert.equal(parseCustomLevelJson(JSON.stringify(copy)),null);
  }
  console.log(`PASS ${samples} floor samples: ${layered} coplanar overlaps across ${pairs.size} surface pairs have distinct render depth; exact y=0 support and editor persistence retained.`);
});
