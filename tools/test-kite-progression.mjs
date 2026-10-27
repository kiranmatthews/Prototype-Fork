import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';
const data={v:1,name:'Gem placement isolation',spawn:[0,.12,0],killY:-10,components:[{t:'platform',p:[0,-.5,-10],s:[20,1,40]},{t:'gate',p:[0,0,-24]}]};
const report={};
await withSkateRuntime(async({THREE,Level,level})=>{
 level.awardGem(new THREE.Vector3(0,0,-10));
 report.ordinary=level.gemPickup.group.position.toArray();
 assert.deepEqual(report.ordinary,[2.6,1.5,-24],'Ordinary mode retains its established side pickup');
 const kite=new Level(new THREE.Scene(),{id:'kite-gem',name:data.name,data:{...data,kiteTow:true}});
 try{
  kite.awardGem(new THREE.Vector3(0,0,-10));
  kite.root.updateMatrixWorld(true);
  report.kite=kite.gemPickup.group.position.toArray();
  assert.deepEqual(report.kite,[0,1.5,-20.6]);
  const support = new THREE.Raycaster(new THREE.Vector3(0,6,-20.6),new THREE.Vector3(0,-1,0),0,14)
    .intersectObjects(kite.groundMeshes,false)[0];
  assert.equal(support?.point.y,0,'Kite reward sits over supported approach');
  assert.ok(kite.gemPickup.box.max.z>kite.finishGlow.max.z+1,'Reward is collectible before the finish trigger');
 }finally{kite.dispose();}
},{levelEntry:{id:'gem-test',name:data.name,data}});
report.pass=true;await mkdir('docs/beach-street/kite',{recursive:true});
await writeFile('docs/beach-street/kite/progression.json',JSON.stringify(report,null,2)+'\n');
console.log('PASS scoped kite gem approach and unchanged ordinary gem placement',JSON.stringify(report));
