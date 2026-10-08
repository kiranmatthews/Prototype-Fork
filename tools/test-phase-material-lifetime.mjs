import assert from 'node:assert/strict';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

await withSkateRuntime(({THREE,Level})=>{
 const make=(id,phase=0)=>new Level(new THREE.Scene(),{id,name:id,data:{v:1,name:id,spawn:[0,.1,4],killY:-20,
  components:[{t:'platform',p:[0,-.5,0],s:[20,1,20]},{t:'phasepad',p:[0,2,-6],s:[4,.6,4],cycle:4,phase,amp:.5},{t:'gate',p:[0,0,-9]}]}});
 for(const phase of [0,.6]){
  const level=make('phase-disposal',phase),pad=level.phasePads[0];level.update(0);
  const texture=new THREE.Texture();pad.litMat.map=texture;pad.ghostMat.map=texture;
  const calls={lit:0,ghost:0,texture:0};pad.litMat.addEventListener('dispose',()=>calls.lit++);
  pad.ghostMat.addEventListener('dispose',()=>calls.ghost++);texture.addEventListener('dispose',()=>calls.texture++);
  level.dispose();assert.deepEqual(calls,{lit:1,ghost:1,texture:1},'both phase states and their shared texture must retire once');
 }
 const old=make('old'),next=make('next'),a=old.phasePads[0],b=next.phasePads[0];
 b.ghostMat.dispose();b.ghostMat=a.ghostMat;
 const texture=new THREE.Texture();a.litMat.map=texture;a.ghostMat.map=texture;
 const calls={oldLit:0,retainedGhost:0,texture:0};
 a.litMat.addEventListener('dispose',()=>calls.oldLit++);a.ghostMat.addEventListener('dispose',()=>calls.retainedGhost++);
 texture.addEventListener('dispose',()=>calls.texture++);
 old.dispose(next);assert.deepEqual(calls,{oldLit:1,retainedGhost:0,texture:0},'a successor owns its unused phase material and its texture');
 next.dispose();assert.deepEqual(calls,{oldLit:1,retainedGhost:1,texture:1},'the final owner releases the retained alternative');
});
console.log('PASS phase material ownership: lit/ghost disposal, shared texture deduplication and inactive successor preservation.');
