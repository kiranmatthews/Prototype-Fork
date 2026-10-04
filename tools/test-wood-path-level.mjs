import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';

const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
new Function('noop',fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'))+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const warn=console.warn,error=console.error;
console.warn=(...a)=>{if(!/failed|already non-indexed/i.test(String(a[0])))warn(...a);};
console.error=(...a)=>{if(!/failed|GLB/i.test(String(a[0])))error(...a);};
let original,rebuilt;
try {
  const {Level}=await server.ssrLoadModule('/src/level.ts');
  const {ISLAND_HOPPER_LEVEL:source}=await server.ssrLoadModule('/src/levels/island-hopper.ts');
  original=new Level(new THREE.Scene(),{id:'island-hopper',name:source.name,data:source});
  const meshes=[];original.root.traverse(o=>{if(o.userData.woodPathModel)meshes.push(o);});
  assert.ok(meshes.length>30,'live level contains instanced model buckets');
  const disposed=new Map();for(const mesh of meshes)mesh.addEventListener('dispose',()=>disposed.set(mesh,(disposed.get(mesh)??0)+1));
  const capture=original.captureData();
  assert.equal(disposed.size,0,'editor capture must never release live instance buffers');
  assert.equal(capture.components.filter(c=>c.t==='woodpath').length,11);
  rebuilt=new Level(new THREE.Scene(),{id:'boardwalk-roundtrip',name:source.name,data:capture});
  assert.deepEqual(rebuilt.captureData().components.filter(c=>c.t==='woodpath'),capture.components.filter(c=>c.t==='woodpath'),'source-owned paths survive editor rebuild');
  const before=original.groundMeshes.filter(m=>m.userData.woodPathComp),after=rebuilt.groundMeshes.filter(m=>m.userData.woodPathComp);
  assert.equal(before.length,11);assert.equal(after.length,11);
  for(let i=0;i<before.length;i++){
    assert.deepEqual(after[i].geometry.attributes.position.array,before[i].geometry.attributes.position.array,'smooth collision deck unchanged by editor');
    assert.deepEqual(after[i].geometry.index.array,before[i].geometry.index.array);
    assert.equal(before[i].material.colorWrite,false);
    assert.equal(before[i].material.depthWrite,false);
  }
  const signatures=level=>{
    const result=[];level.root.traverse(o=>{if(o.userData.woodPathModel)result.push({model:o.userData.woodPathModel,count:o.count,matrix:Array.from(o.instanceMatrix.array)});});return result;
  };
  assert.deepEqual(signatures(rebuilt),signatures(original),'every rendered variant and fitted transform survives capture');
  assert.equal(rebuilt.rails.length,original.rails.length,'grind paths retained');
  const boxSignature=level=>level.walls.map(b=>[...b.min.toArray(),...b.max.toArray()]);
  assert.deepEqual(boxSignature(rebuilt),boxSignature(original),'barriers and scaffold collision retained');
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);let supports=0;
  original.root.updateMatrixWorld(true);
  for(const deck of before){const positions=deck.geometry.attributes.position;
    // Sample inside swept top quads; a rounded authored end knot lies on a
    // triangle boundary and cannot reliably support a Float32 edge ray.
    for(let frame=1;frame<positions.count/4;frame+=8){
      const centre=new THREE.Vector3();for(const index of [(frame-1)*4,(frame-1)*4+1,frame*4,frame*4+1])centre.add(new THREE.Vector3().fromBufferAttribute(positions,index));centre.multiplyScalar(.25);
      const {x,y,z}=centre;
      ray.set(new THREE.Vector3(x,y+1,z),down);ray.far=2;
      assert.ok(ray.intersectObjects(original.groundMeshes,false).some(hit=>Math.abs(hit.point.y-y)<.06),'supported swept deck interior');supports++;
    }
  }
  original.dispose();original=null;
  assert.equal(disposed.size,meshes.length,'all level-owned instance buffers released');
  assert.ok([...disposed.values()].every(n=>n===1));
  assert.deepEqual(signatures(rebuilt).map(s=>[s.model,s.count]),meshes.map(m=>[m.userData.woodPathModel,m.count]),'shared templates remain available to the rebuilt level');
  console.log(`PASS live boardwalk level: 11 Island Hopper paths, ${supports} supported surface samples, identical editor meshes/collision/rails and instance-buffer ownership.`);
} finally {
  original?.dispose();rebuilt?.dispose();console.warn=warn;console.error=error;await server.close();
}
