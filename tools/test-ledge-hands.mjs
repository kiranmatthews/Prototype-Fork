import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createServer} from 'vite';

const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false}});
try {
  const {LedgeHandMotion}=await server.ssrLoadModule('/src/animation/ledgeHands.ts');
  const reports=[];
  for(const fps of [30,60,120])for(const first of [-1,1]) {
    const hands=new LedgeHandMotion(),centre=new THREE.Vector3(),side=new THREE.Vector3(1,0,0);
    const project=point=>{point.y=0;point.z=0;};
    hands.update(1/fps,centre,side,false,project);
    let largestStep=0,largestReach=0,plantedFrames=0;
    for(let f=0;f<fps*7;f++) {
      const t=f/fps,move=t<1.17?first:t<2.5?-first:t<3?0:t<4.17?first:t<5?-first:0;
      const before=[hands.left.clone(),hands.right.clone()];
      centre.x+=move*hands.traverseSpeed/fps;hands.update(1/fps,centre,side,!!move,project);
      const distances=[hands.left.distanceTo(before[0]),hands.right.distanceTo(before[1])];
      assert.ok(Math.min(...distances)<1e-10,'both hands moved in one frame');
      if(move&&Math.max(...distances)>.001)plantedFrames++;
      largestStep=Math.max(largestStep,...distances);
      for(const hand of [hands.left,hands.right]) {
        assert.ok(hand.toArray().every(Number.isFinite));
        largestReach=Math.max(largestReach,Math.abs(hand.x-centre.x));
      }
      if(t>6) {
        assert.equal(hands.reaching,false,'idle never settled');
        assert.ok(Math.max(...distances)<1e-10,'idle grip kept sliding');
      }
    }
    assert.ok(plantedFrames>fps*2,'no planted hand-over-hand movement');
    assert.ok(largestStep<10/fps,`reach teleported: ${largestStep} at ${fps} Hz`);
    const left=hands.left.clone(),right=hands.right.clone(),delta=new THREE.Vector3(.3,.2,-.4);
    hands.carry(delta);centre.add(delta);hands.update(1/fps,centre,side,false,project);
    assert.ok(hands.left.distanceTo(left.add(delta))<1e-10,'moving platform lost left plant');
    assert.ok(hands.right.distanceTo(right.add(delta))<1e-10,'moving platform lost right plant');
    reports.push({fps,first,largestStep,largestReach,plantedFrames});
  }
  console.log(JSON.stringify({status:'pass',reports},null,2));
} finally {await server.close();}
