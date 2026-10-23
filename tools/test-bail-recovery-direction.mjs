import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
const snapshot=process.argv.find(a=>a.startsWith('--source-snapshot='))?.slice(18);
const reportOnly=process.argv.includes('--report-only');
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true},plugins:snapshot?[{
  name:'recovery-direction-baseline',enforce:'pre',async load(id){
    const rel=path.relative(process.cwd(),id.split('?')[0]);
    if(rel==='src/character/bailRecoveryMotion.ts')return readFile(path.join(snapshot,rel),'utf8');
  },
}]:[]});
try {
  const {BailRecoveryMotion}=await server.ssrLoadModule('/src/character/bailRecoveryMotion.ts');
  const a=new BailRecoveryMotion(),b=new BailRecoveryMotion();
  const axis=new THREE.Vector3(1,0,0),spin=new THREE.Vector3(),start=new THREE.Quaternion();
  const q=new THREE.Quaternion(),other=new THREE.Quaternion(),previous=new THREE.Quaternion(),delta=new THREE.Quaternion();
  function track(lean,rate,duration=.56){
    start.setFromAxisAngle(axis,lean);spin.set(rate,0,0);a.begin(start,spin,duration);a.sample(0,previous);
    let travel=0,reversed=0,maxTurn=0,minDot=1;
    for(let frame=1;frame<=120;frame++){
      a.sample(frame/120,q);minDot=Math.min(minDot,previous.dot(q));
      delta.copy(q).multiply(other.copy(previous).invert());
      if(delta.w<0)delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
      const turn=2*Math.atan2(delta.x,delta.w);
      travel+=Math.abs(turn);if(rate*turn<0)reversed+=Math.abs(turn);
      maxTurn=Math.max(maxTurn,Math.abs(turn));previous.copy(q);
      assert.ok(q.toArray().every(Number.isFinite)&&Math.abs(q.length()-1)<1e-12);
    }
    assert.ok(q.angleTo(new THREE.Quaternion())<1e-7,'recovery did not finish upright');
    return {lean,rate,duration,travel,reversed,maxTurn,minDot};
  }
  const quiet=[-3,-2,-1.4,-.56,-.2,0,.2,.56,1.4,2,3].map(lean=>track(lean,0));
  const carry=[[1.3,-6],[-1.3,6],[2.7,10],[-2.7,-10]].map(([lean,rate])=>track(lean,rate));
  let mirroredCases=0,mirrorError=0,minDot=1;
  for(const duration of [.56,.56/3,1.2])for(const lean of [-2.7,-1.3,-.55,.15,1.6,2.8,6.25])for(const rate of [-16,-8,0,7,16]){
    a.begin(start.setFromAxisAngle(axis,lean),spin.set(rate,0,0),duration);
    b.begin(start.setFromAxisAngle(axis,-lean),spin.set(-rate,0,0),duration);
    a.sample(0,previous);
    for(let frame=0;frame<=120;frame++){
      a.sample(frame/120,q);b.sample(frame/120,other);minDot=Math.min(minDot,previous.dot(q));previous.copy(q);
      q.x=-q.x;mirrorError=Math.max(mirrorError,q.angleTo(other));
    }
    mirroredCases++;
  }
  const result={quiet,carry,mirroredCases,mirrorError,minDot,
    worstUnneededQuietTurn:Math.max(...quiet.map(r=>r.travel-Math.abs(r.lean))),
    worstReverseCarry:Math.max(...carry.map(r=>r.reversed))};
  console.log(JSON.stringify(result,null,2));
  if(!reportOnly){
    assert.ok(result.worstUnneededQuietTurn<1e-7,'a quiet landing added an unnecessary revolution');
    assert.ok(result.worstReverseCarry<1e-7,'recovery reversed a body already heading toward upright');
    assert.ok(mirrorError<1e-7,'backward tumbles did not receive the mirrored forward response');
    assert.ok(minDot>.95,'a completed winding flipped quaternion hemisphere');
  }
}finally{await server.close();}
