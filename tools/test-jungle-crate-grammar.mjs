import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.JUNGLE_REVIEW_OUT||'/tmp/jungle-crate-review';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {l,p}=r,ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),report={harvests:[]};
 assert.equal(l.crates.filter(c=>!c.nitroBang).length,100);
 for(const c of l.crates){
  ray.set(c.mesh.position.clone().setY(c.box.min.y+.12),down);ray.far=.25;
  assert.ok(l.raycastGround(ray).length||l.crates.some(b=>b!==c&&Math.abs(b.box.max.y-c.box.min.y)<.1&&Math.abs(b.mesh.position.x-c.mesh.position.x)<.1&&Math.abs(b.mesh.position.z-c.mesh.position.z)<.1),'each crate rests on native ground or its stack');
 }
 report.supported=l.crates.length;
 const groups=new Map();
 for(const c of l.crates){
  const spec=r.source.components[c.mesh.userData.editorIdx],name=spec?.nm;
  if(!name||c.nitroBang||/fuse|Nitro/i.test(name))continue;
  if(!groups.has(name))groups.set(name,[]);groups.get(name).push(c);
 }
 for(const [name,boxes]of groups){
  l.reset(true);const x=boxes.reduce((n,c)=>n+c.mesh.position.x,0)/boxes.length,z=boxes[0].mesh.position.z,y=Math.min(...boxes.map(c=>c.box.min.y));
  p.respawn(l,true,false,{position:new THREE.Vector3(x,y+.1,z+2.1),heading:new THREE.Vector3(0,0,-1)});r.stepFor(24);
  assert.ok(p.grounded,'supported staged harvest approach');
  while(boxes.some(c=>c.alive)){
   const box=boxes.filter(c=>c.alive).sort((a,b)=>a.box.min.y-b.box.min.y||r.distanceTo(a.mesh.position)-r.distanceTo(b.mesh.position))[0];
   r.until(()=>!box.alive,()=>({...r.steerToward(box.mesh.position,{pace:.28}),spinHeld:r.frame%26<13}),{maxFrames:700,label:name});r.stepFor(20);
  }
  assert.equal(p.totalDeaths,0);report.harvests.push({name,count:boxes.length,deaths:p.totalDeaths});
 }
 // Stomp the side fuse, then use its visible open refuge across the corridor.
 l.reset(true);const tnt=l.crates.find(c=>c.tnt),tz=tnt.mesh.position.z,ty=tnt.box.min.y;
 p.respawn(l,true,false,{position:new THREE.Vector3(tnt.mesh.position.x,ty+.1,tz+2),heading:new THREE.Vector3(0,0,-1)});r.stepFor(24);
 r.charge();r.releaseJump();
 r.until(()=>tnt.fuse!==undefined||!tnt.alive,()=>r.steerToward(tnt.mesh.position),{maxFrames:180,label:'side TNT stomp'});
 r.until(()=>p.grounded,()=>r.steerToward([2.8,ty,tz+4]),{maxFrames:180,label:'open TNT refuge'});
 r.until(()=>!tnt.alive&&l.explosions.length===0,{}, {maxFrames:300,label:'fuse-cleared stock'});
 const fuseStock=l.crates.filter(c=>Math.abs(c.mesh.position.z-tz)<.1);
 assert.ok(fuseStock.length===3&&fuseStock.every(c=>!c.alive));assert.equal(p.totalDeaths,0);report.sideFuse={harvested:3,deaths:p.totalDeaths};
 // The ordinary final-switch attack remotely credits the framed Nitro cache.
 l.reset(true);const green=l.crates.find(c=>c.nitroBang);
 p.respawn(l,true,false,{position:green.mesh.position.clone().setY(green.box.min.y+.1).add(new THREE.Vector3(-2.2,0,0)),heading:new THREE.Vector3(1,0,0)});r.stepFor(24);
 r.until(()=>green.bangUsed,()=>({...r.steerToward(green.mesh.position,{pace:.2}),spinHeld:r.frame%26<13}),{maxFrames:300,label:'remote Nitro clear'});r.stepFor(60);
 const framed=l.crates.filter(c=>Math.abs(c.mesh.position.z+636)<.1);
 assert.ok(framed.length===4&&framed.every(c=>!c.alive));report.remoteNitroClear={harvested:4};
 l.reset(true);l.activateCheckpoint(l.checkpoints[4],0);
 const unbanked=l.crates.filter(c=>c.mesh.position.z<-580&&c.mesh.position.z>-702&&!c.nitro);
 for(const c of unbanked)l.breakCrate(c,true);l.reset(false);assert.ok(unbanked.every(c=>c.alive));report.checkpointRestores=true;
 let patrolProbes=0;
 for(let f=0;f<600;f++){l.update(1/60);if(f%20)continue;for(const enemy of l.enemies){
  ray.set(enemy.group.position.clone().setY(enemy.baseY+1),down);ray.far=2;
  const hit=l.raycastGround(ray)[0];assert.ok(hit&&Math.abs(hit.point.y-enemy.baseY)<.45,'patrol stays on its terrain or terrace');patrolProbes++;
 }}
 report.patrolProbes=patrolProbes;report.enemies=l.enemies.map(e=>({kind:e.kind,range:[e.x0,e.x1],z:e.cross}));
 await writeFile(out+'/main-cargo.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
},{modulePath:'/src/level.ts',levelId:'jungle',source:m=>{const l=new m.Level(new THREE.Scene(),{id:'jungle',name:'Jungle Ruins'}),source=l.captureData();l.dispose();return source;},controlFrame:r=>r.l.zoneAt(r.p.pos.x,r.p.pos.z)?{x:0,z:-1}:r.l.laneDirAt(r.p.pos.x,r.p.pos.y,r.p.pos.z)??{x:0,z:-1},maxFrames:30000,allowCheckpointTrips:true});
