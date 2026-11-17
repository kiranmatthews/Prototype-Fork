import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const output=process.env.TEMPLE_AUDIT_OUTPUT||'/private/tmp/temple-embers-audit';
await mkdir(output,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {l,p,THREE}=r,route=r.sourceModule.JUNGLE_TERRACES_ROUTE;
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
 const floor=(s,side)=>{const q=route.toWorld(s,route.groundAt(s),side);ray.set(new THREE.Vector3(...q).add(new THREE.Vector3(0,.3,0)),down);ray.far=.65;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y??null;};
 const missing=[],probes=[];
 for(let s=-12;s<route.end-12;s+=2){
  if(route.gaps.some(g=>s>g.a-1&&s<g.b+1)||route.pipes.some(b=>s>b.a-1&&s<b.b+1))continue;
  for(const side of [-4.7,-4.25,4.25,4.7]){const hit=floor(s,side),q={s,side,hit};probes.push(q);if(hit===null)missing.push(q);}
 }
 const exits=[];
 for(const s of [50,210,315,535,660,860,1065,1195,1300])for(const side of [-1,1]){
  p.respawn(l,true,false,{position:new THREE.Vector3(...route.toWorld(s,route.groundAt(s)+.12,side*2.9))});
  r.stepFor(12);
  let drop=0;
  for(let i=0;i<50&&!p.isBailing&&p.state!=='dead';i++){
   const f=route.frameAt(s),camera=l.cameraDirAt(p.pos.x,p.pos.y,p.pos.z)??{x:0,z:-1};p.camDir.set(camera.x,0,camera.z);
   r.tick(r.worldDirectionInput({x:-f.fz*side,z:f.fx*side},.4));
   drop=Math.max(drop,route.groundAt(s)-p.pos.y);
  }
  exits.push({s,side,drop,local:route.toLocal(p.pos.toArray()),grounded:p.grounded,state:p.state});
 }
 const sideContacts=[];
 for(const s of [50,198,315,660,848,1065,1195,1300])for(const side of [-1,1]){
  const y=route.groundAt(s)-2,from=new THREE.Vector3(...route.toWorld(s,y,side*7));
  const to=new THREE.Vector3(...route.toWorld(s,y,side*2)),normal=new THREE.Vector3();
  const hit=l.meshSideCollisions.resolve(from,to,r.CONST.playerHalf,normal);
  sideContacts.push({s,side,hit,position:to.toArray()});
 }
 const descriptor={id:route.id,end:route.end,profile:route.profile,pipes:route.pipes,gaps:route.gaps,tikiTrials:route.tikiTrials,step:.25,
  frames:Array.from({length:(route.end+20)*4+1},(_,i)=>({...route.frameAt(i/4-20),y:route.groundAt(i/4-20)})),data:{components:route.data.components.filter(c=>c.t==='crate')}};
 const report={name:route.data.name,components:route.data.components.length,crates:l.crates.length,enemies:l.enemies.length,probes:probes.length,missing,exits,sideContacts};
 await writeFile(`${output}/audit.json`,JSON.stringify(report,null,2));await writeFile(`${output}/route.json`,JSON.stringify(descriptor));
 console.log(JSON.stringify({...report,missing:missing.slice(0,20)}));
 if(!process.argv.includes('--baseline')){
  assert.deepEqual(missing,[],'Every ordinary route shoulder must have real support');
  assert.ok(exits.every(q=>q.grounded&&q.state==='ride'&&q.drop<.1),'Lateral input must not fall through the banks');
  assert.equal(l.enemies.length,8);
  assert.ok(sideContacts.every(q=>q.hit),'A body below an elevated lip must not clip through the masonry side');
 }
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true,
 controlFrame:r=>r.p.courseInputDirection(r.l)??{x:r.p.camDir.x,z:r.p.camDir.z}});
