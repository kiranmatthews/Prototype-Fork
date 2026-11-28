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
 assert.equal(bridge.shutsHinge,false,'spun from the leaf\'s own side, nobody is held at its hinge');
 bridge.update(.2);assert.equal(bridge.deployed,false);assert.equal(bridge.trigger(hit()),false);
 bridge.update(.2);assert.equal(bridge.state,'open');assert.equal(bridge.remaining,5.5);
 bridge.update(4.5);assert.equal(bridge.remaining,1);assert.equal(bridge.deployed,true);
 assert.equal(bridge.trigger(hit()),false,'standing on the leaf cannot refresh its timer');
 bridge.update(1);assert.equal(bridge.state,'closing');assert.equal(bridge.deployed,false);
 assert.ok(!bridge.wallBox.isEmpty(),'let go with nobody over it, the hinge is shut again at once');
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
 // Spun from the bank behind the hinge, the hinge stays shut until the leaf is down: a running spin is
 // held at the brink for the leaf's fall instead of being let off it into the drop.
 const sprung=new SpinBridge(root,{t:'spinbridge',p:[0,0,0],s:[10,.4,4],cycle:.7,hold:4},material);
 const fromBank=()=>new THREE.Box3(new THREE.Vector3(-1.7,0,-.6),new THREE.Vector3(.15,1.6,.6));
 assert.equal(sprung.trigger(fromBank()),true);
 assert.ok(sprung.wallBox.isEmpty(),'the upright wall retires at once: a jump with the spin in it goes on over the hinge');
 assert.equal(sprung.shutsHinge,true,'spun from the bank, the hinge is shut to a body on the ground while the leaf falls');
 sprung.update(.35);assert.equal(sprung.state,'opening');assert.equal(sprung.shutsHinge,true);
 sprung.update(.35);assert.equal(sprung.state,'open');assert.equal(sprung.shutsHinge,false,'the hinge opens when the leaf is down');
 // The fold is a sprung one: drawn down as the hold runs out, still in the step it is let go in (that step
 // is the throw's), then a whip: nearly half of the way up in the first fifth of the time.
 const step=1/60,level=sprung.leaf.rotation.z;
 assert.equal(level,0);
 sprung.update(3.9);assert.ok(sprung.leaf.rotation.z<-.004&&sprung.leaf.rotation.z>-.04,'the leaf is drawn down before it is let go');
 sprung.update(.1+step/2);assert.equal(sprung.state,'closing');
 assert.equal(sprung.leaf.rotation.z,0,'the leaf does not move in the step it is let go in');
 assert.ok(!sprung.wallBox.isEmpty());
 assert.equal(sprung.meets(new THREE.Vector3(5,0,0),step),true,'a body standing on the leaf is met at once');
 assert.equal(sprung.meets(new THREE.Vector3(9.9,.3,1.9),step),true,'...anywhere along and across it');
 assert.equal(sprung.meets(new THREE.Vector3(5,3,0),step),false,'a body well above it is not met yet');
 assert.equal(sprung.meets(new THREE.Vector3(-.5,0,0),step),false,'a body on the bank is not on it');
 assert.equal(sprung.meets(new THREE.Vector3(5,0,2.6),step),false,'nor one beside it');
 assert.equal(sprung.meets(new THREE.Vector3(5,-1.5,0),step),false,'nor one already below the deck');
 // A body it threw is over it: the leaf comes up behind him, waits for him, and never goes back down.
 sprung.holdBehind(.3);assert.ok(sprung.wallBox.isEmpty(),'his way back over the hinge is open from that step on');
 for(let i=0;i<15;i++){sprung.holdBehind(.3);sprung.update(step);}
 assert.equal(sprung.state,'closing');
 assert.ok(sprung.leaf.rotation.z<=.3+1e-9&&sprung.leaf.rotation.z>.29,'the leaf comes up to just behind him and waits');
 assert.ok(sprung.wallBox.isEmpty());
 for(let i=0;i<10;i++){sprung.holdBehind(.1);sprung.update(step);}
 assert.ok(sprung.leaf.rotation.z>.29,'it does not go back down for him');
 assert.equal(sprung.meets(new THREE.Vector3(5,5*Math.tan(.31),0),step),true,'a body that comes down onto it is met again');
 for(let i=0;i<90;i++){sprung.holdBehind(1.5);sprung.update(step);}
 assert.equal(sprung.state,'closing','it does not stand upright while he is over it');
 sprung.holdBehind(null);sprung.update(step);
 assert.ok(!sprung.wallBox.isEmpty(),'clear of him, the hinge is shut');
 for(let i=0;i<20;i++)sprung.update(step);
 assert.equal(sprung.state,'closed','...and the leaf finishes its fold');
 // A body that stops telling it (a quarter second's silence) is forgotten, and the leaf goes on.
 sprung.trigger(fromBank());sprung.update(.7);sprung.update(4);assert.equal(sprung.state,'closing');
 sprung.holdBehind(.2);for(let i=0;i<60;i++)sprung.update(step);
 assert.equal(sprung.state,'closed','a body that fell silent does not hold the leaf for ever');
 // The whip.
 sprung.trigger(fromBank());sprung.update(.7);sprung.update(4);sprung.update(.14);
 assert.ok(sprung.leaf.rotation.z>Math.PI/2*.45,'nearly half of the way up in the first fifth of the fold');
 sprung.update(.56);assert.equal(sprung.state,'closed');
 console.log('PASS timed spin bridge: contact, visible settling, exact hold, no refresh, folding, reuse, reset, legacy latch and frame-rate parity; a hinge shut to the ground for a spin from the bank; the sprung fold (drawn, let go, whipped), what it meets, and the leaf held behind a body it threw',JSON.stringify(rateResults));
}finally{await server.close();}
