import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
await withSkateRuntime(async({THREE,Level,Player,CONST,server})=>{
 const {ledgeClimbPoint}=await server.ssrLoadModule('/src/ledgeTraversal.ts');
 const reports=[];
 for(const phase of [-Math.PI/2,0,Math.PI/2])for(const [axis,sign,height,edge] of [['x',1,1.45,1.456],['x',-1,1.45,1.456],['z',1,1.35,2.689],['z',-1,.9,2.689]]){
  const l=new Level(new THREE.Scene(),{id:'cart-ledge',name:'cart-ledge',data:{v:1,name:'cart-ledge',spawn:[0,2,0],killY:-15,components:[
   {t:'mover',dkind:'ghostcart',p:[0,2,0],s:[3.2,.35,6.2],axis:'z',amp:4.5,speed:.62,phase,travelSign:-1},
   {t:'platform',p:[20,-.5,0],s:[10,1,10]},{t:'gate',p:[20,0,0]},
  ]}});l.update(0);l.scene.updateMatrixWorld(true);
  const m=l.movers[0],floor=m.mesh.position.y+.175,lip=floor+height;
  const p=new Player(l.scene);p.enterLevel('cart-ledge');p.respawn(l,true);p.state='air';p.grounded=false;p.pos.copy(m.mesh.position);p.pos.y=lip-1.1;p.pos[axis]+=sign*(edge+.49);p.prevPos.copy(p.pos);p.vVel=-1;
  const toward=axis==='x'?{moveX:-sign}:{moveY:sign};const rows=[];
  const tick=(sample={})=>{p.step(CONST.fixedStep,makeInput(sample),l);l.update(CONST.fixedStep);p.commitRenderStep(l);rows.push({pos:p.pos.clone(),state:p.state,phase:p.ledgePhase,local:p.pos.clone().sub(m.mesh.position),k:p.ledgeClimbK});};
  try{
   for(let i=0;i<20&&p.state!=='hang';i++)tick(toward);
   assert.equal(p.state,'hang',`${axis}/${sign}/${phase}: actual wall contact did not catch rim`);
   assert.ok(Math.abs(p.ledgeLip-lip)<.001,`${axis}: caught hidden floor instead of rim`);
   assert.equal(p.ledgeMoverId,0);assert.ok(Math.abs(p.ledgeLanding.y-floor)<.001,'receiver is not cabin floor');
   for(let i=0;i<12;i++)tick();const held=rows.at(-1).local.clone();
   for(let i=0;i<45;i++){tick();assert.ok(rows.at(-1).local.distanceTo(held)<.06,'hanging rider detached from moving rim');}
   tick({jumpPressed:true,jumpHeld:true,spinPressed:true,spinHeld:true});
   assert.equal(p.ledgePhase,'climb');assert.ok(p.spinning,'rim swallowed spin');
   const from=p.ledgeClimbFrom.clone(),to=p.ledgeClimbTo.clone();
   for(let i=0;i<=100;i++){
    const t=i/100,q=ledgeClimbPoint(new THREE.Vector3(),from,to,p.ledgeLip,t);
    if(t>.42&&t<.73)assert.ok(q.y>=p.ledgeLip+.059,'vault crosses the solid rim before rising above it');
    if(t>=.76)assert.ok(Math.abs(q[axis]-to[axis])<1e-6,'vault descends before reaching the cabin');
   }
   for(let i=0;i<45;i++)tick();
   assert.ok(p.grounded&&p.state==='ride',`${axis}/${sign}/${phase}: failed to land ${p.state} ${p.pos.toArray()}`);
   assert.equal(p.groundHit?.moverId,0,'landing lost carriage support');assert.ok(Math.abs(p.pos.y-floor)<.01,'did not settle inside cabin');
   const seated=rows.at(-1).local.clone();for(let i=0;i<120;i++){tick();assert.ok(p.grounded&&p.state==='ride');assert.ok(rows.at(-1).local.distanceTo(seated)<.06,'seated rider slipped off moving cabin');}
   // The inaccessible floor edge must never create a timed, un-climbable hang.
   p.respawn(l,true);p.state='air';p.grounded=false;p.pos.copy(m.mesh.position);p.pos.y=floor-1.5;p.pos[axis]+=sign*(edge+.3);p.prevPos.copy(p.pos);p.vVel=-1;p.lastVelX=axis==='x'?-sign*4:0;p.lastVelZ=axis==='z'?-sign*4:0;p.rawInput=makeInput(toward);
   assert.equal(p.tryLedgeGrabMesh(l),false,'hidden floor still captured an impossible grab');
   if(phase===0&&axis==='x'&&sign===1){
    const placeAtRim=()=>{
     p.respawn(l,true);p.state='air';p.grounded=false;p.pos.copy(m.mesh.position);
     p.pos.y=lip-1.1;p.pos[axis]+=sign*(edge+.49);p.prevPos.copy(p.pos);p.vVel=-1;
     p.lastVelX=-4;p.lastVelZ=0;p.rawInput=makeInput(toward);
    };
    placeAtRim();assert.ok(p.tryLedgeGrabMesh(l),'mesh rim catch failed');
    p.pos.copy(p.ledgeAnchor);
    const landing=p.ledgeLanding.clone();
    const ceiling=new THREE.Box3(new THREE.Vector3(landing.x-.8,lip+.25,landing.z-.8),new THREE.Vector3(landing.x+.8,lip+.6,landing.z+.8));
    l.walls.push(ceiling);assert.equal(p.startLedgeClimb(l),false,'vault ignored a solid overhead blocker');l.walls.pop();
    placeAtRim();m.mesh.userData.moverId=99;
    assert.equal(p.tryLedgeGrabMesh(l),false,'rim accepted the floor of a different moving object');m.mesh.userData.moverId=0;
    placeAtRim();const index=l.groundMeshes.indexOf(m.mesh);l.groundMeshes.splice(index,1);
    assert.equal(p.tryLedgeGrabMesh(l),false,'rim with no receiver offered a false landing');l.groundMeshes.splice(index,0,m.mesh);
   }
   reports.push({axis,sign,phase,lip,floor,climbFrames:rows.filter(r=>r.state==='hang'&&r.phase==='climb').length});
  }finally{l.dispose();}
 }
 console.log('PASS',JSON.stringify(reports));
});
