import assert from 'node:assert/strict';
import { withSkateRuntime } from './jungle-cup-harness.mjs';
await withSkateRuntime(async({server,THREE,Level})=>{
  const {findLevel,migrateCustomLevel}=await server.ssrLoadModule('/src/level.ts');
  for(const id of ['flats','jungle','beachfront']){
    const original=new Level(new THREE.Scene(),findLevel(id));
    let copy;
    try{
      const data=migrateCustomLevel(JSON.parse(JSON.stringify(original.captureData())));
      assert.equal(data.crateLayoutRevision,1,`${id}: missing saved layout revision`);
      copy=new Level(new THREE.Scene(),{id:`__${id}_crate_copy`,name:data.name,data});
      const a=original.crates.filter(c=>!c.systemicEndNitroBang),b=copy.crates.filter(c=>!c.systemicEndNitroBang);
      assert.equal(b.length,a.length,`${id}: capture changed crate counts`);
      for(let i=0;i<a.length;i++){
        // Native Jungle's captured terrain already reseated these two bank
        // crates by ~9.6 cm before enlargement (verified against 9d96e225).
        // Preserve that floor repair; every other native position stays exact.
        const legacyBankRepair=id==='jungle'&&Math.abs(a[i].mesh.position.z+644)<.001;
        assert.ok(a[i].mesh.position.distanceTo(b[i].mesh.position)<(legacyBankRepair?.1:.025),`${id} crate ${i}: capture moved ${a[i].mesh.position.toArray()} to ${b[i].mesh.position.toArray()}`);
        assert.ok(Math.abs(b[i].box.max.y-b[i].box.min.y-1.152)<1e-6);
      }
      assert.deepEqual(copy.captureData(),data,`${id}: repeated save changed layout`);
      console.log(`PASS ${id}: ${a.length} native crate positions and sizes survive editor capture/reload`);
    }finally{copy?.dispose();original.dispose();}
  }
},{levelEntry:{id:'__capture_fixture',name:'capture fixture',data:{v:1,name:'capture fixture',spawn:[0,1,0],killY:-20,components:[]}}});
