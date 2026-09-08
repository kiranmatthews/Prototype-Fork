import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const nativeFetch=globalThis.fetch;globalThis.self=globalThis;
globalThis.createImageBitmap=async()=>({width:1024,height:1024,close(){}});
globalThis.ProgressEvent??=class{constructor(type,data){this.type=type;Object.assign(this,data);}};
globalThis.fetch=async input=>{const url=typeof input==='string'?input:input.url;if(url.startsWith('blob:'))return nativeFetch(input);const path=new URL(url,'http://headless.invalid').pathname;const match=path.match(/\/(nightworks-kit\/[\w-]+\.glb)$/);return match?new Response(await readFile(new URL('../public/'+match[1],import.meta.url))):new Response('',{status:404});};
const server=await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
try {
 const {Level,normalizeCustomLevelData,setEditorBuild}=await server.ssrLoadModule('/src/level.ts');
 const {Player}=await server.ssrLoadModule('/src/player.ts');
 const {CONST}=await server.ssrLoadModule('/src/tuning.ts');
 const {NIGHTWORKS_LEVEL}=await server.ssrLoadModule('/src/levels/nightworks.ts');
 const {loadJungleAssetTemplate}=await server.ssrLoadModule('/src/jungleAssets.ts');
 assert.ok(normalizeCustomLevelData(JSON.parse(JSON.stringify(NIGHTWORKS_LEVEL))));
 const scene=new THREE.Scene(),level=new Level(scene,{id:'dark',name:'The Nightworks'});
 await level.nightworksRocks.ready();await level.prepareJungleAssets();level.root.updateMatrixWorld(true);
 assert.deepEqual(level.nightworksRocks.errors,[]);assert.equal(level.nightworksRocks.solids.length,62);
 assert.equal(level.movers.length,34);assert.equal(level.phasePads.length,14);assert.equal(level.ropeSwings.length,4);
 const ray=new THREE.Raycaster();const down=new THREE.Vector3(0,-1,0);
 const floor=(x,z,y=120)=>{ray.set(new THREE.Vector3(x,y,z),down);ray.near=0;ray.far=200;return ray.intersectObjects(level.groundMeshes,false)[0];};
 assert.ok(Math.abs(floor(0,4).point.y)<.001,'supported spawn');
 // Sweep both sides of every old handoff, including airborne approaches.
 // Camera and player have independent cursors: neither may choose a cross-leg.
 assert.equal(level.zones.length,0,'no competing side-scroll input remaps');
 let cameraSamples=0;
 for(const [x,y,z] of [[0,0,-48],[-47,12,-48],[-47,12,-112],[10,12,-112],[10,26,-202],[-48,26,-202],[-48,34,-278],[9,56,-278],[9,56,-324],[-43,64,-324]])
   for(const dx of [-8,-.1,0,.1,8])for(const dz of [-8,-.1,0,.1,8])for(const dy of [0,4]){
     const view=level.laneDirAt(x+dx,y+dy,z+dz);
     assert.ok(view&&Math.abs(view.x)<1e-8&&Math.abs(view.z+1)<1e-8,'stable camera and input frame through a corner');cameraSamples++;
   }
 assert.equal(cameraSamples,500);

 // Actual held-input traversal across the former camera handoffs.
 const cs=new THREE.Scene(),cl=new Level(cs,{id:'night-camera',name:'Night camera',data:{v:1,name:'Night camera',spawn:[0,101,0],killY:-30,components:[
   ...NIGHTWORKS_LEVEL.components.filter(c=>c.t==='camnode'||c.t==='zone'),
   {t:'platform',p:[-20,100,-190],s:[160,1,500]},{t:'gate',p:[0,100,-430]}]}});
 const cp=new Player(cs),ci={moveX:0,moveY:0,consumeEdges(){}};
 for(const [x,z] of [[0,-48],[-47,-48],[-47,-112],[10,-112],[10,-202],[-48,-202],[-48,-278],[9,-278],[9,-324],[-43,-324]])for(const sideways of [false,true]){
   cp.pos.set(x-2,100.5,z+2);cp.prevPos.copy(cp.pos);cp.state='ride';cp.freeSkate=false;cp.speed=0;cp.walkVelocity.set(0,0,0);cp.laneCursor.s=-1;cp.settle(cl);
   ci.moveX=sideways?1:0;ci.moveY=sideways?0:1;cp.rawInput=ci;const start=cp.pos.clone();
   for(let frame=0;frame<90;frame++){cl.update(CONST.fixedStep);cp.step(CONST.fixedStep,ci,cl);}
   assert.ok(sideways?cp.pos.x>start.x+3:cp.pos.z<start.z-3,'held input crosses the old transition');
   assert.ok(Math.abs(sideways?cp.pos.z-start.z:cp.pos.x-start.x)<.001,'camera cannot hijack held run direction');
 }
 cl.dispose();
 const normal=new THREE.Vector3();let ledges=0,sideProbes=0,groundProbes=0,joinedEdges=0;
 const player=new Player(scene),input={moveX:0,moveY:0,consumeEdges(){}};
 for(const k of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferPressed'])input[k]=false;
 player.rawInput=input;player.lives=500;
 // Exercise actual irregular boundaries in eight directions, including corners.
 for(const solid of level.nightworksRocks.solids.filter(s=>s.mesh.userData.nightworksRock!=="nightrockridge")){
   const mesh=solid.mesh,top=mesh.position.y+mesh.geometry.boundingBox.max.y;
   for(let i=0;i<8;i++){
     const dx=Math.cos(i*Math.PI/4),dz=Math.sin(i*Math.PI/4);let edge=0;
     for(let r=0;r<20;r+=.035){const hit=floor(mesh.position.x+dx*r,mesh.position.z+dz*r,top+.3);if(!hit||hit.object!==mesh||Math.abs(hit.point.y-top)>.05)break;edge=r;}
     assert.ok(edge>1,'broad walkable top');groundProbes++;
     const outside=new THREE.Vector3(mesh.position.x+dx*(edge+.6),top-1.1,mesh.position.z+dz*(edge+.6));
     const inside=new THREE.Vector3(mesh.position.x+dx*(edge-1),top-1.1,mesh.position.z+dz*(edge-1));
     // Test the visible side face, not empty air beneath a natural overhang.
     ray.set(outside.clone().add(new THREE.Vector3(0,.46,0)),new THREE.Vector3(-dx,0,-dz));ray.near=0;ray.far=20;
     const side=ray.intersectObject(mesh,false)[0];
     if(side){
       const end=side.point.clone().add(new THREE.Vector3(-dx,-.46,-dz));
       const result=end.clone();level.nightworksRocks.resolve(outside,result,CONST.playerHalf,normal);
       assert.ok(result.distanceTo(end)>.1,`solid side ${mesh.position.toArray()} ${i}`);sideProbes++;
     }
     player.pos.copy(outside);player.prevPos.copy(outside);player.state='air';player.grounded=false;player.vVel=-1;player.speed=0;player.freeSkate=false;
     player.lastVelX=-dx*4;player.lastVelZ=-dz*4;player.axisF.set(-dx,0,-dz);player.axisL.set(dz,0,-dx);player.ledgeCoolT=0;player.comboRun=false;
     if(player.tryLedgeGrabMesh(level)){
       assert.ok(Math.abs(player.ledgeLip-top)<.05);assert.ok(floor(player.ledgeLanding.x,player.ledgeLanding.z,top+.3));ledges++;
     } else {
       const neighbour=floor(outside.x,outside.z,top+1.5);
       assert.ok(neighbour&&neighbour.object!==mesh&&Math.abs(neighbour.point.y-top)<1,"a rejected edge must join another walkable island");joinedEdges++;
     }
   }
 }
 assert.equal(ledges+joinedEdges,groundProbes);assert.ok(ledges>450);
 // Every fixed-tick moving top, collision proxy and Meshy visual share a transform.
 const mover=level.movers[0];for(let i=0;i<180;i++){level.update(1/60);const top=mover.mesh.position.y+mover.mesh.geometry.boundingBox.max.y;assert.ok(Math.abs(floor(mover.mesh.position.x,mover.mesh.position.z,top+.3).point.y-top)<.001);}
 const pad=level.phasePads[0];level.time=pad.cycle*.75;level.update(0);assert.equal(pad.on,false);assert.ok(!level.groundMeshes.includes(pad.mesh));assert.ok(pad.mesh.children.every(c=>!c.visible));
 level.time=0;level.update(0);assert.equal(pad.on,true);assert.ok(level.groundMeshes.includes(pad.mesh));
 // Curved rope velocity must be the derivative of the actual visible/contact curve.
 for(const rope of level.ropeSwings)for(const time of [0,.8,2.7,6.2]){
   level.time=time;level.update(0);const d=rope.len*.57,p=level.ropePointAt(rope,d,new THREE.Vector3()),v=level.ropeVelAt(rope,d,new THREE.Vector3());
   assert.ok(Math.abs(level.ropeClosestDistance(rope,p)-d)<.006);
   const dt=.00001;level.time=time+dt;level.update(0);const next=level.ropePointAt(rope,d,new THREE.Vector3());
   assert.ok(next.sub(p).divideScalar(dt).distanceTo(v)<.002,'analytic curved rope velocity');
   const knot=level.ropePointAt(rope,rope.len,new THREE.Vector3());rope.pivot.updateWorldMatrix(true,true);
   assert.ok(rope.visual.endKnot.getWorldPosition(new THREE.Vector3()).distanceTo(knot)<1e-5,'visual knot/contact endpoint');
 }
 // Compare actual loaded render triangles against the synchronous collision surface.
 let matchingRays=0;
 for(const kind of ['nightplateau','nightlongisland','nightsteppingrock','nightphaserock']){
   const source=level.nightworksRocks.solids.find(s=>s.mesh.userData.nightworksRock===kind).mesh;
   const template=await loadJungleAssetTemplate(kind),visual=new THREE.Mesh(template.geometry,new THREE.MeshBasicMaterial());
   const data=level.captureData().components.find(c=>c.dkind===kind&&['platform','mover','phasepad'].includes(c.t));
   visual.scale.fromArray(data.s);visual.position.copy(source.position).add(new THREE.Vector3(0,-data.s[1]/2,0));visual.updateMatrixWorld(true);
   const top=source.position.y+source.geometry.boundingBox.max.y;
   for(let x=-.55;x<=.55;x+=.055)for(let z=-.55;z<=.55;z+=.055){
     ray.set(new THREE.Vector3(source.position.x+x*data.s[0],top+.5,source.position.z+z*data.s[2]),down);ray.far=30;
     const a=ray.intersectObject(source,false)[0],b=ray.intersectObject(visual,false)[0];
     assert.equal(!!a,!!b,'render/collision footprint agreement');if(a)assert.ok(Math.abs(a.point.y-b.point.y)<.0002,'render/collision height agreement');matchingRays++;
   }
 }
 // A real player hangs from a vertically moving irregular rim and mantles onto it.
 const fixtureData={v:1,name:'Moving rock mantle',spawn:[0,10,0],killY:-30,components:[{t:'mover',dkind:'nightsteppingrock',p:[0,10,0],s:[4.5,3.69,4.5],axis:'y',amp:3,speed:.7,phase:0},{t:'gate',p:[0,0,-80]}]};
 const fs=new THREE.Scene(),fl=new Level(fs,{id:'rock-mantle',name:'Rock mantle',data:fixtureData}),fp=new Player(fs);fl.update(0);fs.updateMatrixWorld(true);
 fp.rawInput=input;fp.lives=20;fp.pos.set(2.62,8.9,0);fp.prevPos.copy(fp.pos);fp.state='air';fp.grounded=false;fp.vVel=-1;fp.lastVelX=-4;fp.lastVelZ=0;fp.axisF.set(-1,0,0);fp.axisL.set(0,0,-1);
 assert.ok(fp.tryLedgeGrabMesh(fl),'catch moving rock');assert.equal(fp.ledgeMoverId,0);
 for(let i=0;i<35;i++){fl.update(CONST.fixedStep);fp.step(CONST.fixedStep,input,fl);}
 assert.equal(fp.state,'hang');assert.ok(Math.abs(fp.ledgeLip-(fl.movers[0].mesh.position.y+1.845))<.02,'grip carried with moving rim');
 input.jumpHeld=true;input.jumpPressed=true;for(let i=0;i<150;i++){fl.update(CONST.fixedStep);fp.step(CONST.fixedStep,input,fl);input.jumpPressed=false;}
 input.jumpHeld=false;assert.ok(fp.grounded,'mantle onto moving rock');assert.ok(Math.abs(fp.pos.y-(fl.movers[0].mesh.position.y+1.845))<.06);fl.dispose();
 // Asset completion while a pad is off must hide the lit proxy, never its ghost.
 const lateData={...fixtureData,name:'Late phase rock',components:[{t:'phasepad',dkind:'nightphaserock',p:[0,10,0],s:[5,3.8,5],phase:.5,cycle:4.4,amp:.5},{t:'gate',p:[0,0,-80]}]};
 const late=new Level(new THREE.Scene(),{id:'phase-late',name:'Late phase rock',data:lateData});late.update(0);await late.prepareJungleAssets();
 const off=late.phasePads[0];assert.equal(off.on,false);assert.equal(off.litMat.visible,false);assert.equal(off.ghostMat.visible,true);
 late.time=3;late.update(0);assert.equal(off.on,true);assert.equal(off.mesh.material,off.litMat);assert.ok(off.mesh.children.every(c=>c.visible));late.dispose();
 // The global grind rope's deforming visual samples the same rebaked polyline.
 const bridge=new Level(new THREE.Scene(),{id:'rope-braid',name:'Braided rope',data:{v:1,name:'Braided rope',spawn:[0,0,0],killY:-30,components:[{t:'rope',p:[0,4,0],len:14},{t:'gate',p:[0,0,-30]}]}});
 const sky=bridge.ropes[0];for(let i=0;i<80;i++){bridge.grindRope(sky.rail);bridge.update(CONST.fixedStep);}
 assert.ok(sky.rail.points.some((p,i)=>p.y<sky.rest[i].y-.01),'loaded grind rope sags');
 const vertices=sky.visual.mesh.geometry.attributes.position;
 for(let i=0;i<=sky.visual.segments;i+=7){const center=new THREE.Vector3();for(let j=0;j<12;j++)center.add(new THREE.Vector3().fromBufferAttribute(vertices,i*13+j));center.multiplyScalar(1/12);
   assert.ok(center.distanceTo(sky.rail.pointAt(i/sky.visual.segments*sky.rail.totalLength))<.00002,'braid centre follows physical grind path');}
 bridge.dispose();
 // Falling below the authored void kills; the summit gate still completes the level.
 player.state='air';player.pos.set(100,-27,0);player.prevPos.copy(player.pos);player.vVel=-5;player.grounded=false;player.step(CONST.fixedStep,input,level);assert.ok(['dead','gameover'].includes(player.state),'void death');
 player.respawn?.(level);player.state='ride';player.pos.set(-43,70.1,-353);player.prevPos.copy(player.pos);player.settle(level);player.step(CONST.fixedStep,input,level);assert.equal(player.state,'finished','summit finish');
 const copy=new Level(new THREE.Scene(),{id:'dark-copy',name:'Copy',data:JSON.parse(JSON.stringify(level.captureData()))});
 assert.deepEqual(copy.captureData(),level.captureData());assert.equal(copy.ropeSwings[2].travel.phase,Math.PI/2);copy.dispose();
 console.log(`PASS Nightworks: ${groundProbes} surface probes, ${sideProbes} swept side/corner collisions, ${ledges} real Player ledge catches, ${joinedEdges} supported joins, ${matchingRays} visual/collision comparisons; moving mantle and death/finish; moving support, phase collision and visibility, rope endpoints/velocity, editor round trip.`);
 level.dispose();
} finally {await server.close();}
