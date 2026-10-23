// Residency is opt-in for immutable derived geometry. The default mutable ABI
// and all dynamic pose inputs must remain immediately observable.
import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
  const {SkinBoundsKernel}=await server.ssrLoadModule('/src/character/skinBoundsKernel.ts');
  const cached=new SkinBoundsKernel(),eager=new SkinBoundsKernel();
  assert.ok(await cached.warm());assert.ok(await eager.warm());
  const make=(count,offset=0,morphCount=0)=>{
    const v={positions:new Float64Array(count*3),morphDeltas:Array.from({length:morphCount},()=>new Float64Array(count*3)),indices:new Uint32Array(count*4),weights:new Float64Array(count*4),kernelInputsFinite:true,highestWeightedIndex:1};
    for(let i=0;i<count;i++){
      v.positions.set([i/count+offset,Math.sin(i),Math.cos(i)*2],i*3);
      v.indices.set([0,1,0,0],i*4);v.weights.set([.7,.3,0,0],i*4);
      for(let m=0;m<morphCount;m++)v.morphDeltas[m].set([Math.cos(i+m)*.3,.4,Math.sin(i-m)*.2],i*3);
    }
    return v;
  };
  const palette=[new THREE.Matrix4(),new THREE.Matrix4().makeRotationZ(.3)],inverse=new THREE.Matrix4(),morphs=[.3,-.7];
  const box=new THREE.Box3(),expected=new THREE.Box3();let comparisons=0;
  const compare=(v,resident=true,oracle=false)=>{
    assert.equal(eager.measure(v,morphs,palette,inverse.elements,expected,true),true);
    assert.equal(cached.measure(v,morphs,palette,inverse.elements,box,true,resident),true);
    assert.deepEqual(box,expected,'warm resident bounds must be bit-identical to eager bounds');
    if(oracle){
      const reference=new THREE.Box3(),p=new THREE.Vector3(),q=new THREE.Vector3(),sum=new THREE.Vector3();
      for(let i=0;i<v.positions.length/3;i++){
        p.fromArray(v.positions,i*3);
        for(let m=0;m<v.morphDeltas.length;m++)p.addScaledVector(q.fromArray(v.morphDeltas[m],i*3),morphs[m]??0);
        sum.set(0,0,0);
        for(let c=0;c<4;c++)if(v.weights[i*4+c])sum.addScaledVector(q.copy(p).applyMatrix4(palette[v.indices[i*4+c]]),v.weights[i*4+c]);
        reference.expandByPoint(sum.applyMatrix4(inverse));
      }
      assert.ok(reference.min.distanceTo(box.min)<1e-12&&reference.max.distanceTo(box.max)<1e-12,'Three.js vertex oracle');
    }
    comparisons++;
  };
  const a=make(1000,0,2),b=make(1200,9,2);
  compare(a);compare(b);
  const warm=cached.diagnostics();
  for(let i=0;i<30;i++){
    palette[0].makeRotationX(i*.07);palette[1].makeTranslation(Math.sin(i),i*.04,-i*.02);
    palette[1].elements[15]=i%2?.7:-1.3;
    morphs[0]=Math.sin(i);morphs[1]=Math.cos(i)*1.2;
    inverse.makeScale(1+i*.01,.8,1.1);inverse.elements[15]=1+Number.EPSILON;
    compare(a,true,true);compare(b,true,true);
  }
  const after=cached.diagnostics();
  assert.equal(after.geometryUploads,warm.geometryUploads,'live poses must reuse uploaded geometry');
  assert.equal(after.residentHits-warm.residentHits,60);
  assert.equal(after.copiedBytes-warm.copiedBytes,60*(2*8+3*128),'only live morphs, palette and inverse are copied');
  assert.equal(after.workspaceBytes,warm.workspaceBytes,'fixed working set stops growing after warm-up');
  assert.ok(cached.residents instanceof WeakMap,'residency must not retain discarded meshes/geometry');
  assert.deepEqual(Object.keys(cached.residents.get(a)).sort(),['base','generation']);

  // Default callers can mutate a bundle in place; switching back to immutable
  // inputs must reload residents overwritten by that packed mutable upload.
  const mutable=make(256,20,2);compare(mutable,false,true);
  mutable.positions[0]=90;mutable.weights[0]=.2;mutable.indices[0]=1;mutable.morphDeltas[1][0]=8;
  compare(mutable,false,true);
  const uploads=cached.diagnostics().geometryUploads;
  compare(a,true,true);assert.equal(cached.diagnostics().geometryUploads,uploads+1);
  compare(b,true,true);
  // A replacement bundle sees edits even if its lengths are unchanged.
  const edited={...a,positions:a.positions.slice()};edited.positions[0]=150;compare(edited,true,true);

  // A larger dynamic palette may move the resident arena. All former offsets
  // must then be invalidated, and the live matrices must still be consumed.
  while(palette.length<520)palette.push(new THREE.Matrix4());
  const preGrow=cached.diagnostics();compare(a,true,true);compare(b,true,true);
  assert.equal(cached.diagnostics().residentResets,preGrow.residentResets+1);
  palette.length=2;compare(a,true,true);

  // Churn beyond the fixed 8 MiB arena exercises wraparound and revisiting
  // old live identities; every upload and read must match eager arithmetic.
  const large=Array.from({length:4},(_,i)=>make(40000,i*10));
  const preWrap=cached.diagnostics();
  for(let pass=0;pass<3;pass++)for(const v of large)compare(v);
  assert.ok(cached.diagnostics().residentResets>preWrap.residentResets);
  compare(a);compare(b);
  // A valid input which fits the packed ABI but not the reserved prefix must
  // remain supported, invalidate overlapping residents, and respect the cap.
  compare(make(116000));compare(a);compare(b);
  assert.ok(cached.diagnostics().workspaceBytes<=8*1024*1024);
  const stable=cached.diagnostics();
  for(let i=0;i<100;i++){compare(a);compare(b);}
  assert.equal(cached.diagnostics().workspaceBytes,stable.workspaceBytes);
  assert.equal(cached.diagnostics().geometryUploads,stable.geometryUploads);
  assert.equal(cached.diagnostics().fallbacks.oversize,0);
  console.log(JSON.stringify({passed:true,comparisons,livePoseUploadBytes:after.copiedBytes-warm.copiedBytes,diagnostics:cached.diagnostics()}));
} finally {await server.close();}
