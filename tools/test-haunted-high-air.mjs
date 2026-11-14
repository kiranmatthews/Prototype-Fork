import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {pumpAqueductRow} from './test-blockworks-aqueduct.mjs';

// Six separate floor starts, then ordinary wall-to-wall pump inputs. No air
// placement, speed change or target manipulation supplies the required height.
const reports=[];
await withBlockworksRuntime(r=>{
 const {p,l,THREE,sourceModule:m}=r;
 for(const target of m.BLOCKWORKS_VERT_AQUEDUCT.targets){
  p.respawn(l,true,false,{position:new THREE.Vector3(...m.routePoint(target.s,.05)),heading:new THREE.Vector3(...m.routeTangent(target.s))});
  r.stepFor(20);
  const result=pumpAqueductRow(r,target.s,target.u>0?-1:1,{singleTarget:true});
  assert.ok(result.broken.includes(target.name));assert.equal(p.totalDeaths,0);
  reports.push({target:target.name,...result,deaths:p.totalDeaths});
 }
},{maxFrames:18000});
await writeFile(process.env.HAUNTED_AIR_OUTPUT||'/tmp/haunted-high-air.json',JSON.stringify(reports,null,2)+'\n');
console.log('PASS all six high-air crates collected in separate normal-input pump sessions');
