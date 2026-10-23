import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createServer } from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {BailFallPose}=await server.ssrLoadModule('/src/character/bailFallPose.ts');
  const {QUATERNIUS_DEATH_DURATION:duration,QUATERNIUS_DEATH_ROTATION_KEYS:keys}=await server.ssrLoadModule('/src/animation/quaterniusDeath.generated.ts');
  const names=['spine','head','shoulderRight','elbowRight','wristRight','shoulderLeft','elbowLeft','wristLeft','hipRight','kneeRight','ankleRight','hipLeft','kneeLeft','ankleLeft','chest','neck'];
  const mirrored=[0,1,5,6,7,2,3,4,11,12,13,8,9,10,14,15];
  const root=new THREE.Object3D(),nodes=names.map(()=>new THREE.Object3D());root.add(...nodes);
  root.position.set(7,3,-4);root.rotation.set(.2,.3,-.4);
  const rootBefore=[...root.position.toArray(),...root.quaternion.toArray()];
  const expected=new THREE.Quaternion(),next=new THREE.Quaternion(),euler=new THREE.Euler();
  let cases=0,maxSourceError=0;
  for(const side of [-1,1]) for(const age of [.12,.25,.5,.7,1,2]) {
    const pose=new BailFallPose();pose.begin(0,side);
    const before=nodes.map((n,i)=>{n.rotation.set(i*.01,.1,-.2);return n.quaternion.clone();});
    pose.apply(nodes,age,-1);
    const frame=Math.min(duration,age*2.4)/duration*72,a=Math.min(71,Math.floor(frame)),mix=frame-a;
    for(let i=0;i<nodes.length;i++) {
      const track=keys[names[side<0?mirrored[i]:i]];
      expected.fromArray(track[a][1]);next.fromArray(track[a+1][1]);expected.slerp(next,mix).normalize();
      if(side<0){expected.y=-expected.y;expected.z=-expected.z;}
      maxSourceError=Math.max(maxSourceError,nodes[i].quaternion.angleTo(expected));
      assert.ok(nodes[i].quaternion.angleTo(expected)<1e-6,`lost authored ${names[i]} coordination`);
    }
    assert.deepEqual([...root.position.toArray(),...root.quaternion.toArray()],rootBefore,'source motion replaced physical travel/root rotation');
    const time=pose.time;pose.restore();
    for(let i=0;i<nodes.length;i++)assert.ok(nodes[i].quaternion.angleTo(before[i])<1e-7,'source layer accumulated');
    pose.apply(nodes,age+.1,.15);assert.ok(pose.time>time||time===duration,'source stopped its outgoing velocity at get-up entry');
    pose.restore();pose.apply(nodes,age+.2,1);assert.equal(pose.weight,0);
    for(let i=0;i<nodes.length;i++)assert.ok(nodes[i].quaternion.angleTo(before[i])<1e-7,'source lingered after get-up');
    nodes[14].rotation.x+=.3;nodes[15].rotation.x-=.1;pose.restore();
    assert.ok(nodes[14].quaternion.angleTo(before[14])<1e-7&&nodes[15].quaternion.angleTo(before[15])<1e-7,'late get-up chest/neck curl accumulated');
    cases++;
  }
  const pose=new BailFallPose();pose.begin(0,1);pose.apply(nodes,.3,-1);
  const chest=euler.setFromQuaternion(nodes[14].quaternion).x;
  const neck=euler.setFromQuaternion(nodes[15].quaternion).x;
  assert.ok(chest>.5&&neck<-.4,'collapse lost the chest curve and delayed head counter-motion');
  assert.ok(euler.setFromQuaternion(nodes[9].quaternion).x>1,'collapse lost folded knees');
  console.log(JSON.stringify({passed:true,cases,joints:16,maxSourceError,sharedSource:'Quaternius Death01',physicsRootUnchanged:true,finiteRelease:true}));
} finally {await server.close();}
