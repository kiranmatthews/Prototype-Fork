import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
await withBlockworksRuntime(r=>{
 const {p,l}=r,b=l.spinBridges[0],edges=l.surfaceEdgeRails.filter(e=>l.surfaceEdgeOwners.get(e)===b.mesh);
 assert.equal(edges.length,4);assert.ok(edges.every(e=>!e.grindable));r.stepFor(20);assert.ok(p.grounded);
 r.walkTo([-2.9,0,0],{pace:.4,arrivalTolerance:.3});r.tick({spinHeld:true});r.stepFor(25);
 assert.ok(l.checkpoints[0].active,'safe terrace checkpoint banks before the timer');
 r.walkTo([-.8,0,0],{pace:.4,arrivalTolerance:.3});r.tick({spinHeld:true});r.until(()=>b.deployed,{}, {maxFrames:90,label:'timed floor settles'});
 assert.ok(l.groundMeshes.includes(b.mesh));assert.ok(edges.every(e=>e.grindable));
 r.walkTo([2.8,0,0],{pace:.8,settleFrames:0,arrivalTolerance:.7,tolerance:.3});
 assert.ok(p.grounded&&p.groundHit.mesh===b.mesh,'real player stands on timed support');
 r.until(()=>!b.deployed,{}, {maxFrames:240,label:'wait for authored expiry'});
 assert.ok(!l.groundMeshes.includes(b.mesh),'expired leaf leaves the native floor set');assert.ok(edges.every(e=>!e.grindable),'expired rim cannot support a ghost grind');
 r.until(()=>p.state==='dead',{}, {maxFrames:180,allowDeath:true,label:'fall from the expired plank'});
 r.until(()=>p.grounded&&p.state==='ride',{}, {maxFrames:400,allowDeath:true,label:'safe checkpoint respawn'});
 r.stepFor(12);assert.ok(p.pos.x<0&&Math.abs(p.pos.y)<.11,JSON.stringify(r.snapshot()));assert.equal(b.state,'closed');
 r.walkTo([-.8,0,0],{pace:.4,arrivalTolerance:.3});r.tick({spinHeld:true});r.until(()=>b.deployed,{}, {maxFrames:90,label:'repeat the lock after recovery'});
 assert.ok(l.groundMeshes.includes(b.mesh));assert.ok(edges.every(e=>e.grindable));
 console.log('PASS production player: timed support, physical expiry, pit death, checkpoint recovery and repeat activation',JSON.stringify({frames:r.frame,checkpoint:l.activeCheckpoint!==null,bridge:b.state}));
},{modulePath:'/src/levels/waterfall-climb.ts',levelId:'timed-waterfall-contact',controlFrame:()=>({x:0,z:-1}),source:()=>({v:1,name:'Timed waterfall contact',spawn:[-5,.12,0],killY:-8,
 components:[{t:'platform',p:[-4,-.5,0],s:[8,1,7]}, {t:'spinbridge',p:[0,0,0],s:[8,.4,4],hold:2,cycle:.32},
 {t:'platform',p:[12,-.5,0],s:[8,1,7]},{t:'checkpoint',p:[-1.8,0,0]},{t:'gate',p:[15,0,0],yaw:90},
 {t:'pit',p:[5,-3,0],s:[10,1,8],invisible:true},{t:'clock',p:[-5,0,2.6]},{t:'zone',p:[4,0,0],s:[40,1,20],dir:'E'}]})});
