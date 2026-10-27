import assert from 'node:assert/strict';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {SpinBridge}=await server.ssrLoadModule('/src/spinBridge.ts');
 const material=new THREE.MeshBasicMaterial(),root=new THREE.Group();
 const bridge=new SpinBridge(root,{t:'spinbridge',p:[0,0,0],s:[8,.4,4],cycle:.4,hold:5.5},material);
 const hit=()=>bridge.hitBox.clone();
 assert.equal(bridge.state,'closed');assert.ok(!bridge.wallBox.isEmpty());
 assert.equal(bridge.trigger(new THREE.Box3(new THREE.Vector3(20,0,20),new THREE.Vector3(22,2,22))),false);
 assert.equal(bridge.trigger(hit()),true);assert.equal(bridge.state,'opening');assert.ok(bridge.wallBox.isEmpty());
 bridge.update(.2);assert.equal(bridge.deployed,false);assert.equal(bridge.trigger(hit()),false);
 bridge.update(.2);assert.equal(bridge.state,'open');assert.equal(bridge.remaining,5.5);
 bridge.update(4.5);assert.equal(bridge.remaining,1);assert.equal(bridge.deployed,true);
 assert.equal(bridge.trigger(hit()),false,'standing on the leaf cannot refresh its timer');
 bridge.update(1);assert.equal(bridge.state,'closing');assert.equal(bridge.deployed,false);assert.ok(bridge.wallBox.isEmpty());
 bridge.update(.4);assert.equal(bridge.state,'closed');assert.ok(!bridge.wallBox.isEmpty());
 assert.equal(bridge.trigger(hit()),true,'timed bridge can be reused after closing');
 bridge.update(50);assert.equal(bridge.state,'closed','one long update consumes opening, hold and folding');
 bridge.trigger(hit());bridge.update(.4);bridge.restore(true);assert.equal(bridge.state,'closed','checkpoint reset never turns a timer into a permanent latch');
 const old=new SpinBridge(root,{t:'spinbridge',p:[0,0,0],cycle:.4},material);
 old.trigger(old.hitBox.clone());old.update(300);assert.equal(old.state,'open');old.restore(true);assert.equal(old.state,'open');
 const rateResults=[];
 for(const hz of [30,60,120]){
  bridge.restore(false);bridge.trigger(hit());let seconds=0;
  while(bridge.state!=='closed'&&seconds<10){bridge.update(1/hz);seconds+=1/hz;}
  rateResults.push({hz,seconds});assert.ok(Math.abs(seconds-6.3)<1/hz+.00001);
 }
 console.log('PASS timed spin bridge: contact, visible settling, exact hold, no refresh, folding, reuse, reset, legacy latch and frame-rate parity',JSON.stringify(rateResults));
}finally{await server.close();}
