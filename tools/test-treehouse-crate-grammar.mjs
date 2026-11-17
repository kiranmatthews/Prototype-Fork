import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Exercise the authored, enlarged formations through the real collision and
// Player. Each collection starts on the approach; only normal inputs follow.
await withBlockworksRuntime(async r=>{
 const {l,p,THREE,source}=r;
 const name=c=>source.components[c.mesh.userData.editorIdx]?.nm??'';
 const crates=l.crates.filter(c=>name(c).startsWith('Trail crate'));
 const ray=new THREE.Raycaster();
 const ground=(x,z,y)=>{ray.set(new THREE.Vector3(x,y+.25,z),new THREE.Vector3(0,-1,0));ray.far=1;return ray.intersectObjects(l.groundMeshes,false)[0];};
 for(const [i,c] of crates.entries()){
  const box=c.box.clone().expandByScalar(-.015);
  assert.ok(!crates.some((other,j)=>j!==i&&box.intersectsBox(other.box.clone().expandByScalar(-.015))),`${name(c)} overlaps another crate`);
  const topSupport=crates.some(other=>other!==c&&Math.abs(other.box.max.y-c.box.min.y)<.03&&Math.abs(other.mesh.position.x-c.mesh.position.x)<.65&&Math.abs(other.mesh.position.z-c.mesh.position.z)<.65);
  assert.ok(ground(c.mesh.position.x,c.mesh.position.z,c.box.min.y)||topSupport||name(c).includes('TOOL TARGET'),`${name(c)} lost its floor/support`);
  if(c.multiHit)assert.ok(crates.some(other=>other!==c&&Math.abs(other.mesh.position.x-c.mesh.position.x)<.1&&Math.abs(other.mesh.position.z-c.mesh.position.z)<.1&&other.box.min.y>=c.box.max.y-.03),`${name(c)} must support a target`);
 }
 for(const e of source.components.filter(c=>c.t==='enemy'))for(const dx of [-e.range,0,e.range])
  assert.ok(ground(e.p[0]+dx,e.p[2],e.p[1]),`${e.nm} patrol must remain on supported ground`);
 const groups=new Map();
 for(const c of crates){if(c.bouncy||name(c).includes('TOOL TARGET'))continue;const key=name(c);if(!groups.has(key))groups.set(key,[]);groups.get(key).push(c);}
 let collected=0;
 for(const [job,group] of groups){
  l.reset(true);l.update(0);r.scene.updateMatrixWorld(true);
  const base=group.reduce((a,b)=>a.box.min.y<b.box.min.y?a:b);
  const x=group.reduce((sum,c)=>sum+c.mesh.position.x,0)/group.length,z=base.mesh.position.z;
  const floor=ground(x,z+4,base.box.min.y)?.point.y??base.box.min.y;
  p.respawn(l,true,false,{position:new THREE.Vector3(x,floor+.05,z+4),heading:new THREE.Vector3(0,0,-1)});
  const deaths=p.totalDeaths;
  for(let frame=0;frame<600&&group.some(c=>c.alive);frame++){
   r.tick({...r.worldDirectionInput([0,0,-1],.35),spinHeld:true,spinPressed:frame%45===0});
   assert.equal(p.totalDeaths,deaths,`${job}: approach/collection killed the player`);
  }
  assert.ok(group.every(c=>!c.alive),`${job}: collection failed at ${p.pos.toArray()}`);
  collected+=group.length;
 }
 // Start a falling contact above the arrow, then let native bounce/bonk and
 // support gravity collect both targets without directly changing crate state.
 l.reset(true);l.update(0);
 const arrow=crates.find(c=>c.bouncy),targets=crates.filter(c=>name(c).includes('TOOL TARGET'));
 p.respawn(l,true,false,{position:new THREE.Vector3(arrow.mesh.position.x,arrow.box.max.y+1,arrow.mesh.position.z),heading:new THREE.Vector3(0,0,-1)});
 p.grounded=false;p.state='air';p.vVel=-1;
 for(let frame=0;frame<400&&targets.some(c=>c.alive);frame++)r.tick({});
 assert.ok(targets.every(c=>!c.alive),'the native arrow bounce must collect both overhead rewards');
 assert.ok(arrow.alive,'collect the rewards before consuming the arrow');
 p.respawn(l,true,false,{position:new THREE.Vector3(arrow.mesh.position.x,arrow.box.min.y+.05,arrow.mesh.position.z+2),heading:new THREE.Vector3(0,0,-1)});
 for(let frame=0;frame<120&&arrow.alive;frame++)r.tick({...r.worldDirectionInput([0,0,-1],.35),spinHeld:true,spinPressed:frame%45===0});
 assert.ok(!arrow.alive,'the retained arrow must remain collectible');
 // Soft recovery must restore an unbanked decision, including its supports.
 l.reset(true);const cp=l.checkpoints[3];l.activateCheckpoint(cp,0);
 const target=crates.find(c=>name(c).includes('cavern entrance'));
 l.breakCrate(target);l.reset(false);
 assert.equal(target.alive,true,'checkpoint restores the unbanked reward');
 console.log(`PASS: ${crates.length} supported/intentional crates; ${groups.size} groups (${collected} crates), both arrow targets and arrow collected with native inputs; supported enemy patrols; checkpoint restoration.`);
},{modulePath:'/src/levels/treehouse-trail.ts',levelId:'treehouse-trail',source:m=>m.TREEHOUSE_TRAIL_LEVEL,
 controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir,endlessDeaths:true});
