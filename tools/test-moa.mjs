import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createHash} from 'node:crypto';
const harness=await readFile(new URL('./validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const originalWarn=console.warn;console.warn=(...args)=>{if(args.some(v=>v?.response?.status===404&&v.response.url===''))return;originalWarn(...args);};
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true}});
const originalLoad=GLTFLoader.prototype.loadAsync;
GLTFLoader.prototype.loadAsync=async function(url,...args){
 const name=String(url).match(/enemies\/(moa(?:-clean|-roast-chicken)?)\.glb(?:\?.*)?$/)?.[1];
 if(!name)return originalLoad.call(this,url,...args);
 const bytes=await readFile(new URL('../public/enemies/'+name+'.glb',import.meta.url));
 return new GLTFLoader().register(()=>({name:'MoaHeadlessTexture',loadTexture:()=>Promise.resolve(null)})).parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
const near=(a,b,label,epsilon=1e-5)=>assert.ok(Math.abs(a-b)<epsilon,`${label}: ${a} != ${b}`);
try{
 const {createMoaVisual,MOA}=await server.ssrLoadModule('/src/enemies/moa.ts');
 const {Level,parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
 const {Player}=await server.ssrLoadModule('/src/player.ts');
 const {sfx}=await server.ssrLoadModule('/src/audio.ts');
 const {sampleMoaBounce}=await server.ssrLoadModule('/src/enemies/moaBounce.ts');
 const moa=createMoaVisual();await moa.ready;
 const peer=createMoaVisual();await peer.ready;
 const skinMeshes=v=>{const m=[];v.group.getObjectByName('Moa_MeshySkin').traverse(n=>{if(n.isSkinnedMesh)m.push(n);});return m;};
 const firstSkin=skinMeshes(moa)[0],peerSkin=skinMeshes(peer)[0];
 assert.equal(firstSkin.geometry,peerSkin.geometry);assert.notEqual(firstSkin.skeleton,peerSkin.skeleton);assert.notEqual(firstSkin.skeleton.bones[0],peerSkin.skeleton.bones[0]);
 const peerPose=peerSkin.skeleton.bones.map(b=>b.matrixWorld.toArray());let sharedDisposals=0;firstSkin.geometry.addEventListener('dispose',()=>sharedDisposals++);
 const late=createMoaVisual();late.dispose();await late.ready;assert.equal(late.diagnostics.status,'disposed');assert.equal(late.group.children.length,0);
 const frame={state:'patrol',stateTime:0,time:0,speed:1.45,verticalVelocity:0,grounded:true,alive:true,flung:false};
 moa.group.traverse(n=>{if(n.isMesh){const normals=n.geometry.attributes.normal;for(let i=0;i<normals.count;i++)assert.ok(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))>.9,`${n.name}: invalid lighting normal`);}});
 assert.equal(moa.diagnostics.status,'ready',moa.diagnostics.error);assert.ok(moa.diagnostics.skinnedMeshes>=2,'real Meshy skin and separated lower bill');
 const painted=skinMeshes(moa).filter(m=>m.material.name==='Moa clean vertex colours');assert.equal(painted.length,1,'living moa has a dedicated clean colour surface');
 const colours=painted[0].geometry.attributes.color;assert.ok(colours,'vertex colour export must survive packing');let darkest=1;const tones=new Set();for(let i=0;i<colours.count;i++){darkest=Math.min(darkest,colours.getX(i));tones.add(colours.getX(i).toFixed(3));}assert.ok(darkest<.2&&tones.size>20,'palette must not export as white');
 const rest=new THREE.Box3().setFromObject(moa.group.getObjectByName('Moa_MeshySkin'),true);
 assert.ok(rest.max.y>4.1&&rest.max.y<4.5,'full-size moa');
 const foot=moa.group.getObjectByName('Moa_FootLeft'),head=moa.group.getObjectByName('Moa_Head');
 let previous=null,plantedFrames=0,maxLift=0,previousSkin=null;
 const soles=[];moa.group.getObjectByName('Moa_MeshySkin').traverse(m=>{if(!m.isSkinnedMesh)return;const f=m.skeleton.bones.findIndex(b=>b.name==='moa_footLeft'),a=m.geometry.attributes;for(let i=0;i<a.position.count;i++)if(a.position.getY(i)<.05&&a.skinIndex.getX(i)===f&&a.skinWeight.getX(i)>.999)soles.push({m,i});});assert.ok(soles.length>5,'actual Meshy foot contacts');
 // After gait entry, support feet must remain fixed in WORLD space during stance.
 for(let i=0;i<300;i++){
  moa.group.position.z+=frame.speed/60;moa.update(1/60,{...frame,time:i/60});
  const point=foot.getWorldPosition(new THREE.Vector3()),phase=moa.diagnostics.gaitPhase;
  if(i>100&&phase>.03&&phase<MOA.stance-.02&&previous?.phase<phase&&previous.phase>.03){
   near(point.z,previous.z,'planted foot travel',.001);near(point.y,0,'planted sole');plantedFrames++;
   const skin=soles.map(({m,i})=>m.getVertexPosition(i,new THREE.Vector3()).applyMatrix4(m.matrixWorld));
   for(const p of skin)assert.ok(p.y>-.002&&p.y<.055,'Meshy sole stays on support');
   if(previousSkin)for(let n=0;n<skin.length;n++)near(skin[n].distanceTo(previousSkin[n]),0,'Meshy stance vertex locks to world',.001);
   previousSkin=skin;
  }
  if(!(i>100&&phase>.03&&phase<MOA.stance-.02&&previous?.phase<phase&&previous.phase>.03))previousSkin=null;
  previous={z:point.z,phase};maxLift=Math.max(maxLift,point.y);
  assert.deepEqual(moa.group.scale.toArray(),[1,1,1]);assert.deepEqual(moa.body.scale.toArray(),[1,1,1]);
 }
 assert.ok(plantedFrames>70&&maxLift>.44,'high step and contact coverage');
 moa.reset();moa.group.position.set(0,0,0);
 const baseline=JSON.parse(await readFile(new URL('./moa-assets/pre-bounce-contact.json',import.meta.url),'utf8')),rows=[],feet=['Moa_FootLeft','Moa_FootRight'].map(n=>moa.group.getObjectByName(n));let parityTime=0,minimum=Infinity,maximum=-Infinity,frameIndex=0;
 const bodySurface=moa.group.getObjectByName('Moa_TorsoSurface');
 for(const [state,frames,speed]of baseline.cycles)for(let i=0;i<frames;i++){
  moa.update(1/60,{...frame,state,stateTime:i/60,time:parityTime,speed});parityTime+=1/60;
  rows.push(feet.map(n=>n.matrixWorld.toArray().map(v=>+v.toFixed(7))));
  near(bodySurface.scale.x*bodySurface.scale.y*bodySurface.scale.z,1,'torso volume is preserved');
  if(state==='patrol'&&i>40){minimum=Math.min(minimum,bodySurface.scale.y);maximum=Math.max(maximum,bodySurface.scale.y);}
  const contact=baseline.pecks.find(p=>p.frame===frameIndex++);if(contact){const point=new THREE.Vector3();moa.getAttackPosition(point);near(point.distanceTo(new THREE.Vector3(...contact.position)),0,'active peck target stays unchanged',1e-6);}
 }
 assert.equal(createHash('sha256').update(JSON.stringify(rows)).digest('hex'),baseline.footSha256,'bounce must preserve the authored foot path');
 assert.ok(minimum<.90&&maximum>1.10,'walk needs visible compression and extension');moa.reset();
 const settledBounce=sampleMoaBounce({...frame,state:'recover',stateTime:MOA.recover},.2,0,1,MOA);for(const key of ['bodyY','bodyZ','bodyPitch','headY','headZ','headPitch','tail'])near(settledBounce[key],0,'finite recovery '+key);
 near(settledBounce.headScale,1,'head settles');
 const tip=new THREE.Vector3();moa.getAttackPosition(tip);const standing=tip.clone();
 moa.update(1/60,{...frame,state:'windup',stateTime:.55,speed:0});assert.ok(head.position.z<.6,'neck anticipates backward');
 moa.update(1/60,{...frame,state:'peck',stateTime:.14,speed:0});moa.getAttackPosition(tip);
 assert.ok(tip.z>2.8&&tip.y<1.2&&standing.y-tip.y>2.5,'bill visibly reaches skater height');
 moa.update(1/60,{...frame,state:'squawk',stateTime:.5,speed:0});assert.ok(moa.group.getObjectByName('Moa_Jaw').rotation.x>.65,'open beak squawk');
 const poses=()=>{const rows=[];moa.group.traverse(n=>rows.push([...n.position.toArray(),...n.quaternion.toArray(),...n.scale.toArray()]));return rows;};
 moa.update(1,{...frame,alive:false,flung:true,speed:0,time:9});const settled=poses();
 moa.update(1,{...frame,alive:false,flung:true,speed:0,time:10});assert.deepEqual(poses(),settled,'finite defeat settle');
 assert.deepEqual(peerSkin.skeleton.bones.map(b=>b.matrixWorld.toArray()),peerPose,'one moa cannot animate another');
 let disposed=0;moa.group.traverse(n=>{if(n.isMesh)n.material.addEventListener('dispose',()=>disposed++);});moa.dispose();const once=disposed;moa.dispose();assert.equal(disposed,once);assert.equal(moa.group.children.length,0);assert.equal(sharedDisposals,0,'peer keeps geometry alive');peer.dispose();assert.equal(sharedDisposals,1,'last owner releases geometry once');
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
 assert.equal(e.state,'roast');assert.ok(e.roast);assert.equal(e.flungT,undefined);
 for(let i=0;i<90;i++){tick();player.collide(level);}assert.ok(e.roast&&e.group.visible,'killing spin must leave a persistent chicken');
 player.spinTimer=0;player.collide(level);assert.ok(e.roast,'touching chicken does not clear it');
 player.debrisSpinToken={};player.spinTimer=.3;player.collide(level);assert.equal(e.roast,undefined);assert.equal(e.group.visible,false);assert.equal(e.state,'removed');
 level.reset(true);assert.equal(e.alive,true);assert.ok(e.attackBox.isEmpty());assert.equal(e.state,'patrol');
 // Stomp and slide use the real Player branches; direct/environment takedowns
 // also leave the food, with no projectile or death-timer cleanup hiding it.
 for(const method of ['stomp','slide']){
  level.reset(true);level.playerPos.set(100,0,100);tick(0);player.pos.copy(e.group.position);player.prevPos.copy(player.pos);player.spinTimer=0;player.invulnTimer=player.uberTimer=0;player.slideTimer=0;player.state='ride';player.grounded=true;player.vVel=0;
  if(method==='stomp'){player.pos.y=e.box.max.y-.02;player.prevPos.y=e.box.max.y+.4;player.vVel=-6;player.grounded=false;player.state='air';}
  else player.slideTimer=.3;
  player.collide(level);assert.equal(e.state,'roast',method+' cooks moa');assert.ok(e.roast);
  tick(5);assert.ok(e.group.visible&&e.roast,method+' chicken persists');
 }
 level.reset(true);level.killEnemy(e);tick(2);assert.ok(e.roast&&e.group.visible,'environment kill produces chicken');
 player.pos.copy(e.group.position);player.ropeSpinSmash(level);assert.ok(e.roast,'same hanging spin keeps roast');
 const points=player.points;player.debrisSpinToken={};player.ropeSpinSmash(level);assert.equal(e.state,'removed','a new hanging spin clears chicken');assert.equal(player.points,points,'clearing roast never scores twice');level.reset(true);
 const chickenBytes=await readFile(new URL('../public/enemies/moa-roast-chicken.glb',import.meta.url));assert.equal(createHash('sha256').update(chickenBytes).digest('hex'),'fba2151c740e179152af76345fe8d06ca77ab05195d61950011173b38261fcad','chicken asset remains unchanged');
 const exported=level.captureData();assert.equal(exported.components.find(c=>c.t==='enemy').foe,'moa');
 level.dispose();assert.equal(e.visual.diagnostics.status,'disposed');
 for(const name of ['moa-caw.wav','moa-caw-peck.wav']){const wav=await readFile(new URL(`../public/sfx/${name}`,import.meta.url));assert.equal(wav.toString('ascii',0,4),'RIFF');let peak=0;for(let i=44;i<wav.length;i+=2)peak=Math.max(peak,Math.abs(wav.readInt16LE(i)));assert.ok(peak>18000&&peak<30000,'audible bounded licensed recording');}
 console.log('PASS moa: bouncy independent squash/stretch, unchanged 429-frame foot paths and active peck targets, actual Meshy sole contacts, persistent steaming chicken and new-spin clearance; metre-scale model, planted high steps, articulated peck, squawk, finite deformation, real Player hit/dodge/spin, AI cycle, audio timing/distance, reset/export/disposal.');
}finally{GLTFLoader.prototype.loadAsync=originalLoad;console.warn=originalWarn;await server.close();}
