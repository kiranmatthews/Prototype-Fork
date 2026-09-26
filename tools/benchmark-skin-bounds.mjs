/** Actual production torso/shorts, including every input copy and palette
 * preparation. Node microbenchmark complements (not replaces) browser frame
 * profiling. Every measured mesh is also checked bit-for-bit against JS. */
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
globalThis.document={createElementNS:()=>({addEventListener(){},removeEventListener(){},set src(_){}})};
globalThis.window={location:{href:'http://headless.invalid/'}};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try{
  const {CharacterInteractionBounds}=await server.ssrLoadModule('/src/character/interactionBounds.ts');
  const {SkinBoundsKernel}=await server.ssrLoadModule('/src/character/skinBoundsKernel.ts');
  const {createMeshyTorso}=await server.ssrLoadModule('/src/character/meshyTorso.ts');
  const {createMeshyShorts}=await server.ssrLoadModule('/src/character/meshyShorts.ts');
  const mount=new THREE.Group();mount.userData.sculptRuntime={joints:{},deformations:[]};
  const bone=(name,parent,x,y)=>{const b=new THREE.Bone();b.name=name;b.position.set(x,y,0);parent.add(b);return b;};
  const torsoRoot=bone('torso-root',mount,0,.71),spine=bone('spine',torsoRoot,0,.11),chest=bone('chest',spine,0,.24),neck=bone('neck',chest,0,.265);
  const clavicleLeft=bone('clavicle-left',chest,.1,.16),clavicleRight=bone('clavicle-right',chest,-.1,.16);
  const hips=bone('hips',mount,0,.71),hipLeft=bone('hip-left',hips,.115,0),hipRight=bone('hip-right',hips,-.115,0);
  const torso=createMeshyTorso({mount,torsoRoot,spine,chest,neck,clavicleLeft,clavicleRight});
  const shorts=createMeshyShorts({mount,hips,hipLeft,hipRight});
  const kernel=new SkinBoundsKernel();assert.equal(await kernel.warm(),true);
  const js=new CharacterInteractionBounds(null),wasm=new CharacterInteractionBounds(kernel);
  const pose=i=>{
    spine.rotation.z=Math.sin(i*.07)*.2;chest.rotation.x=Math.cos(i*.03)*.3;
    hipLeft.rotation.x=Math.sin(i*.04)*.7;hipRight.rotation.x=Math.cos(i*.06)*.5;
    torso.mesh.morphTargetInfluences[0]=Math.sin(i*.03)*.2;torso.mesh.morphTargetInfluences[1]=Math.cos(i*.01)*.15;
    shorts.mesh.morphTargetInfluences[0]=Math.cos(i*.04)*.2;shorts.mesh.morphTargetInfluences[1]=Math.sin(i*.02)*.12;shorts.mesh.morphTargetInfluences[2]=Math.sin(i*.05)*.15;
    shorts.setLegStretch(1+Math.sin(i*.02)*.2,1+Math.cos(i*.03)*.3);mount.updateMatrixWorld(true);
  };
  let checks=0;
  for(let i=0;i<120;i++){
    pose(i);
    for(const mesh of [torso.mesh,shorts.mesh]){
      const expected=js.skinnedBounds(mesh).clone();assert.deepEqual(wasm.skinnedBounds(mesh),expected);checks++;
    }
  }
  const samples=11,iterations=150,results=[];
  for(const mesh of [torso.mesh,shorts.mesh]){
    // Warm both optimizing compilers before interleaved, alternating samples.
    for(let i=0;i<300;i++){pose(i);js.skinnedBounds(mesh);wasm.skinnedBounds(mesh);}
    const timing={javascript:[],wasm:[]};
    for(let sample=0;sample<samples;sample++)for(const mode of sample%2?['wasm','javascript']:['javascript','wasm']){
      const meter=mode==='wasm'?wasm:js,start=performance.now();
      for(let i=0;i<iterations;i++){pose(sample*iterations+i);meter.skinnedBounds(mesh);}
      timing[mode].push((performance.now()-start)/iterations);
    }
    const median=values=>[...values].sort((a,b)=>a-b)[Math.floor(values.length/2)];
    results.push({mesh:mesh.name,vertices:mesh.geometry.attributes.position.count,morphs:mesh.morphTargetInfluences.length,
      javascriptMedianMs:median(timing.javascript),wasmMedianMs:median(timing.wasm),speedup:median(timing.javascript)/median(timing.wasm),samples:timing});
  }
  const report={runtime:process.version,kind:'actual production mesh CPU microbenchmark, includes copies + palette preparation + animated pose updates',checks,samples,iterations,results,kernel:kernel.diagnostics()};
  const output=process.argv.find(a=>a.startsWith('--json='));if(output)await writeFile(output.slice(7),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}finally{await server.close();}
