import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';
const option = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const snapshot = option('source-snapshot'), reportOnly = process.argv.includes('--report-only');
const server = await createServer({ appType:'custom', logLevel:'silent', server:{middlewareMode:true}, plugins:snapshot ? [{
  name:'roll-through-baseline', enforce:'pre', async load(id) {
    const rel=path.relative(process.cwd(),id.split('?')[0]);
    if(rel==='src/character/bailRecoveryMotion.ts') return readFile(path.join(snapshot,rel),'utf8');
  },
}] : [] });
try {
  const { BailRecoveryMotion } = await server.ssrLoadModule('/src/character/bailRecoveryMotion.ts');
  const motion = new BailRecoveryMotion(), start = new THREE.Quaternion(), q = new THREE.Quaternion();
  const previous = new THREE.Quaternion(), delta = new THREE.Quaternion(), inverse = new THREE.Quaternion();
  const axis = new THREE.Vector3(), spin = new THREE.Vector3();
  function track(orientation, velocity, direction, duration=.56, momentum) {
    motion.begin(orientation, velocity, duration, momentum); motion.sample(0, previous);
    assert.ok(previous.angleTo(orientation)<1e-7, 'entry pose changed');
    let forward=0, reversed=0, maxTurn=0, minDot=1;
    for(let frame=1;frame<=240;frame++) {
      motion.sample(frame/240,q); minDot=Math.min(minDot,q.dot(previous));
      delta.copy(q).multiply(inverse.copy(previous).invert());
      if(delta.w<0) delta.set(-delta.x,-delta.y,-delta.z,-delta.w);
      const sine=Math.hypot(delta.x,delta.y,delta.z), angle=2*Math.atan2(sine,delta.w);
      const turn=sine>1e-12 ? angle*(delta.x*direction.x+delta.y*direction.y+delta.z*direction.z)/sine : 0;
      forward+=Math.max(0,turn); reversed+=Math.max(0,-turn); maxTurn=Math.max(maxTurn,angle);
      assert.ok(q.toArray().every(Number.isFinite)&&Math.abs(q.length()-1)<1e-12);
      previous.copy(q);
    }
    assert.ok(q.angleTo(new THREE.Quaternion())<1e-7,'not upright at completion');
    return {forward,reversed,maxTurn,minDot};
  }
  const rows=[];
  // Independent axis-angle oracle: a roll already on its shoulder should
  // finish in that direction, for either sign and every planar heading.
  for(let heading=0;heading<16;heading++) for(const sign of [-1,1]) for(const lean of [1.2,2.2]) for(const rate of [.4,2,6]) {
    axis.set(Math.cos(heading*Math.PI/8)*sign,0,Math.sin(heading*Math.PI/8)*sign);
    const row={heading,sign,lean,rate,...track(start.setFromAxisAngle(axis,lean),spin.copy(axis).multiplyScalar(rate),axis)};
    if(!reportOnly) {
      assert.ok(row.reversed<1e-7,`roll reversed: ${JSON.stringify(row)}`);
      assert.ok(Math.abs(row.forward-(2*Math.PI-lean))<1e-7,'roll did not finish its remaining arc');
    }
    rows.push(row);
  }
  let rememberedCases=0, rememberedReverse=0, rememberedDerivativeError=0;
  const memory = new THREE.Vector3(), infinitesimal = new THREE.Quaternion();
  for(let heading=0;heading<16;heading++) for(const rate of [-.1,0,.1]) {
    axis.set(Math.cos(heading*Math.PI/8),0,Math.sin(heading*Math.PI/8));
    start.setFromAxisAngle(axis,1.4); spin.copy(axis).multiplyScalar(rate); memory.copy(axis).multiplyScalar(3);
    const result=track(start,spin,axis,.56,memory); rememberedReverse=Math.max(rememberedReverse,result.reversed);
    if(!reportOnly) assert.ok(result.forward>4.8 && result.reversed<.001,'friction counter-rock reversed the whole get-up');
    motion.begin(start,spin,.56,memory); motion.sample(1e-7/.56,q);
    infinitesimal.copy(q).multiply(inverse.copy(start).invert());
    if(infinitesimal.w<0) infinitesimal.set(-infinitesimal.x,-infinitesimal.y,-infinitesimal.z,-infinitesimal.w);
    rememberedDerivativeError=Math.max(rememberedDerivativeError,new THREE.Vector3(infinitesimal.x,infinitesimal.y,infinitesimal.z).multiplyScalar(2e7).distanceTo(spin));
    // A fresh, strong rebound must supersede the older fall direction.
    spin.copy(axis).multiplyScalar(-5);
    const rebound=track(start,spin,axis,.56,memory);
    if(!reportOnly) assert.ok(rebound.reversed>1.39 && rebound.forward<.001,'remembered roll ignored a new rebound');
    rememberedCases++;
  }
  assert.ok(rememberedDerivativeError<.001,'roll memory changed incoming angular velocity');
  let joinVelocityChange=0;
  for(let heading=0;heading<16;heading++) {
    axis.set(Math.cos(heading*Math.PI/8),0,Math.sin(heading*Math.PI/8));
    motion.begin(start.setFromAxisAngle(axis,1.4),spin.copy(axis).multiplyScalar(2),.56);
    for(const phase of [.55,.9]) {
      const h=1e-6;
      motion.sample(phase-h,previous); motion.sample(phase,q); motion.sample(phase+h,inverse);
      delta.copy(q).multiply(infinitesimal.copy(previous).invert());
      const before=new THREE.Vector3(delta.x,delta.y,delta.z).multiplyScalar(2/h/.56);
      delta.copy(inverse).multiply(infinitesimal.copy(q).invert());
      const after=new THREE.Vector3(delta.x,delta.y,delta.z).multiplyScalar(2/h/.56);
      joinVelocityChange=Math.max(joinVelocityChange,before.distanceTo(after));
    }
  }
  assert.ok(joinVelocityChange<.01,'rotation velocity jumped at the plant or upright handoff');
  let quietExtra=0, uprightExtra=0;
  for(let heading=0;heading<16;heading++) for(const lean of [-2.8,-1.4,-.2,.2,1.4,2.8]) {
    axis.set(Math.cos(heading*Math.PI/8),0,Math.sin(heading*Math.PI/8));
    const quiet=track(start.setFromAxisAngle(axis,lean),spin.set(0,0,0),axis);
    quietExtra=Math.max(quietExtra,quiet.forward+quiet.reversed-Math.abs(lean));
    const small=track(start.setFromAxisAngle(axis,lean*.02),spin.copy(axis).multiplyScalar(.1),axis);
    uprightExtra=Math.max(uprightExtra,small.forward+small.reversed);
  }
  if(!reportOnly) assert.ok(quietExtra<1e-7,'quiet recovery invented a revolution');
  if(!reportOnly) assert.ok(uprightExtra<.07,'nearly upright body rolled over again');
  let captured;
  if(option('captures')) {
    const data=JSON.parse(await readFile(option('captures'),'utf8'));
    captured=data.results.flatMap(r=>r.recoveries.map((c,index)=>{
      spin.fromArray(c.spin);
      const reference = Math.hypot(spin.x,spin.z)<.8 && c.momentum && Math.hypot(c.momentum[0],c.momentum[2])>=.8 ? c.momentum : c.spin;
      axis.set(reference[0],0,reference[2]).normalize();
      return {cause:r.cause,index,rate:Math.hypot(spin.x,spin.z),...track(start.fromArray(c.orientation),spin,axis,c.duration,c.momentum ? new THREE.Vector3().fromArray(c.momentum) : undefined)};
    }));
  }
  console.log(JSON.stringify({passed:true,cases:rows.length,quietCases:96,quietExtra,uprightExtra,
    worstReversal:Math.max(...rows.map(r=>r.reversed)),reverseCases:rows.filter(r=>r.reversed>.01).length,
    rememberedCases,rememberedReverse,rememberedDerivativeError,joinVelocityChange,captured,rows},null,2));
} finally { await server.close(); }
