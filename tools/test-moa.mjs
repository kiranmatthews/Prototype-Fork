import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const originalWarn=console.warn;console.warn=(...args)=>{if(args.some(v=>v?.response?.status===404&&v.response.url===''))return;originalWarn(...args);};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true}});
const near=(a,b,label,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${label}: ${a} != ${b}`);
try{
 const {createMoaVisual,MOA}=await server.ssrLoadModule('/src/enemies/moa.ts');
 const {Level,parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
 const {Player}=await server.ssrLoadModule('/src/player.ts');
 const {sfx}=await server.ssrLoadModule('/src/audio.ts');
 const moa=createMoaVisual();await moa.ready;
 const frame={state:'patrol',stateTime:0,time:0,speed:1.45,verticalVelocity:0,grounded:true,alive:true,flung:false};
 moa.group.traverse(n=>{if(n.isMesh){const normals=n.geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))>.9,`${n.name}: invalid lighting normal`);}});
 const rest=new THREE.Box3().setFromObject(moa.group,true);
 assert.ok(rest.max.y>4.1&&rest.max.y<4.5,'full-size moa');
 const foot=moa.group.getObjectByName('Moa_FootLeft'),head=moa.group.getObjectByName('Moa_Head');
 let previous=null,plantedFrames=0,maxLift=0;
 // After gait entry, support feet must remain fixed in WORLD space during stance.
 for(let i=0;i<300;i++){
  moa.group.position.z+=frame.speed/60;moa.update(1/60,{...frame,time:i/60});
  const point=foot.getWorldPosition(new THREE.Vector3()),phase=moa.diagnostics.gaitPhase;
  if(i>100&&phase>.03&&phase<MOA.stance-.02&&previous?.phase<phase&&previous.phase>.03){
   near(point.z,previous.z,'planted foot travel',.001);near(point.y,0,'planted sole');plantedFrames++;
  }
  previous={z:point.z,phase};maxLift=Math.max(maxLift,point.y);
  assert.deepEqual(moa.group.scale.toArray(),[1,1,1]);assert.deepEqual(moa.body.scale.toArray(),[1,1,1]);
 }
 assert.ok(plantedFrames>70&&maxLift>.44,'high step and contact coverage');
 moa.reset();moa.group.position.set(0,0,0);
 const tip=new THREE.Vector3();moa.getAttackPosition(tip);const standing=tip.clone();
 moa.update(1/60,{...frame,state:'windup',stateTime:.55,speed:0});assert.ok(head.position.z<.6,'neck anticipates backward');
 moa.update(1/60,{...frame,state:'peck',stateTime:.14,speed:0});moa.getAttackPosition(tip);
 assert.ok(tip.z>2.8&&tip.y<1.2&&standing.y-tip.y>2.5,'bill visibly reaches skater height');
 moa.update(1/60,{...frame,state:'squawk',stateTime:.5,speed:0});assert.ok(moa.group.getObjectByName('Moa_Jaw').rotation.x>.65,'open beak squawk');
 const poses=()=>{const rows=[];moa.group.traverse(n=>rows.push([...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]));return rows;};
 moa.update(1,{...frame,alive:false,flung:true,speed:0,time:9});const settled=poses();
 moa.update(1,{...frame,alive:false,flung:true,speed:0,time:10});assert.deepEqual(poses(),settled,'finite defeat settle');
 let disposed=0;moa.group.traverse(n=>{if(n.isMesh)n.material.addEventListener('dispose',()=>disposed++);});moa.dispose();const once=disposed;moa.dispose();assert.equal(disposed,once);assert.equal(moa.group.children.length,0);
 const data={v:1,name:'Moa test',spawn:[0,.08,8],killY:-15,components:[{t:'platform',p:[0,-.5,0],s:[30,1,30]},{t:'enemy',foe:'moa',p:[0,0,0],range:2.3,speed:1.45},{t:'gate',p:[0,0,-10]}]};
 // The public schema must preserve the species through editor export/import.
 assert.equal(parseCustomLevelJson(JSON.stringify(data))?.components.find(c=>c.t==='enemy').foe,'moa');
 const scene=new THREE.Scene(),level=new Level(scene,{id:'moa-test',name:'Moa test',data});
 const e=level.enemies[0],sounds=[];sfx.play=(...args)=>sounds.push(args);
 const tick=(dt=1/60)=>{level.time+=dt;level.updateEnemies(dt);};
 level.playerPos.set(8,0,0);const states=new Set();
 for(let i=0;i<400;i++){tick();states.add(e.state);assert.ok(e.group.position.x>=-2.3&&e.group.position.x<=2.3);}
 assert.ok(states.has('idle')&&states.has('squawk')&&states.has('patrol'));assert.equal(sounds.filter(s=>s[0]==='moaSquawk').length,1);
 level.reset(true);level.playerPos.set(100,0,100);sounds.length=0;
 for(let i=0;i<400;i++)tick();assert.equal(sounds.length,0,'distant moa is silent');
 level.reset(true);level.playerPos.set(0,0,3.1);e.stateT=.81;tick();assert.equal(e.state,'windup');
 const home=e.group.position.clone();while(e.state==='windup')tick();assert.equal(e.state,'peck');
 for(let i=0;i<8;i++)tick();assert.ok(!e.attackBox.isEmpty());
 const center=e.attackBox.getCenter(new THREE.Vector3());e.visual.getAttackPosition(tip);near(center.distanceTo(tip),0,'animated attack alignment');
 near(e.group.position.distanceTo(home),0,'no hidden root lunge');
 // Real Player collision must take a hit outside the body, and avoid it to the side.
 const player=new Player(scene);player.rawInput={moveX:0,moveY:0,consumeEdges(){}};
 player.pos.copy(center).setY(0);player.prevPos.copy(player.pos);player.state='ride';player.grounded=true;
 player.spinTimer=0;player.masks=1;player.invulnTimer=player.uberTimer=0;
 player.playerBox.setFromCenterAndSize(center,new THREE.Vector3(.7,1.5,.7));
 assert.equal(player.playerBox.intersectsBox(e.box),false,'peck extends beyond body contact');
 player.collide(level);assert.equal(player.masks,0,'real Player receives the bill hit');
 player.masks=1;player.invulnTimer=0;player.pos.x+=2;player.playerBox.translate(new THREE.Vector3(2,0,0));player.collide(level);assert.equal(player.masks,1,'side dodge avoids hit');
 while(e.state!=='recover')tick();assert.ok(e.attackBox.isEmpty());assert.equal(e.touchHurt,false,'recovery is safe');
 player.pos.copy(e.group.position);player.prevPos.copy(player.pos);player.spinTimer=.3;player.spinBox.copy(e.box);player.playerBox.copy(e.box);player.collide(level);assert.equal(e.alive,false,'spin defeats moa');assert.ok(e.attackBox.isEmpty(),'defeat clears the bill hitbox');
 level.reset(true);assert.equal(e.alive,true);assert.ok(e.attackBox.isEmpty());assert.equal(e.state,'patrol');
 const exported=level.captureData();assert.equal(exported.components.find(c=>c.t==='enemy').foe,'moa');
 level.dispose();assert.equal(e.visual.diagnostics.status,'disposed');
 for(const name of ['moa-squawk.wav','moa-peck.wav']){const wav=await readFile(new URL(`../public/sfx/${name}`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));assert.ok(peak>18000&&peak<30000,'audible bounded original sound');}
 console.log('PASS moa: metre-scale model, planted high steps, articulated peck, squawk, finite deformation, real Player hit/dodge/spin, AI cycle, audio timing/distance, reset/export/disposal.');
}finally{console.warn=originalWarn;await server.close();}
