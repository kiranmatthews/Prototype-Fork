import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const out=process.env.SPAGHETTI_OUTPUT??'/private/tmp/spaghetti-box-route';await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const route=r.sourceModule.SPAGHETTI_PLATFORMER_BOX_ROUTE,C=r.source.components,crates=C.filter(c=>c.t==='crate');
 const ray=new r.THREE.Raycaster(),report={stops:route.length,boxes:crates.length,visibleLinks:0,supportedBoxes:0,largestGap:0,collections:[]};
 assert.ok(route.length>100&&crates.length>=route.length,'A complete box trail spans the whole level');
 assert.ok(crates.find(c=>c.nm==='Box trail / start here').p[2]<r.source.spawn[2],'The first box leads forward from spawn');
 assert.equal(C.filter(c=>c.nm==='Box trail / gold direction').length,route.length,'Every landing retains its direction after boxes are collected');
 for(const c of crates){
  assert.ok(c.nm==='Box trail / start here'||route.some(s=>c.nm.startsWith(s.name+' / ')),'No required crate hides on an unmarked side route');
  ray.set(new r.THREE.Vector3(c.p[0],c.p[1]+.12,c.p[2]),new r.THREE.Vector3(0,-1,0));ray.near=0;ray.far=.3;
  assert.ok(r.l.raycastGround(ray).some(h=>h.face?.normal.y>.5),'Crate is supported at its route height: '+c.nm);report.supportedBoxes++;
 }
 for(let i=0;i<route.length-1;i++){
  const a=route[i],b=route[i+1],targets=crates.filter(c=>c.nm.startsWith(b.name+' / ')).map(c=>new r.THREE.Vector3(c.p[0],c.p[1]+1.4,c.p[2]));
  if(!targets.length)targets.push(new r.THREE.Vector3(b.p[0],b.p[1]+2,b.p[2]));
  const gap=Math.hypot(b.p[0]-a.p[0],b.p[2]-a.p[2]);report.largestGap=Math.max(report.largestGap,gap);
  assert.ok(b.p[2]<a.p[2]&&gap<27,'The marked path advances in short readable jumps');
  const eye=new r.THREE.Vector3(a.p[0],a.p[1]+2.6,a.p[2]-a.d/2+1);
  const visible=targets.some(target=>{const d=target.clone().sub(eye),length=d.length();ray.set(eye,d.normalize());ray.near=.15;ray.far=length-.3;return !r.l.raycastGround(ray).length;});
  assert.ok(visible,'Next boxes must be visible from '+a.name+' to '+b.name);report.visibleLinks++;
 }
 for(const index of [0,8,22,40,70,97,route.length-2]){
  const stop=route[index],boxes=r.l.crates.filter(c=>Math.abs(c.mesh.position.x-stop.p[0])<3&&Math.abs(c.mesh.position.z-stop.p[2])<3&&Math.abs(c.mesh.position.y-stop.p[1])<4);
  r.p.respawn(r.l,true,false,{position:new r.THREE.Vector3(stop.p[0],stop.p[1]+.08,stop.p[2]+4),heading:new r.THREE.Vector3(0,0,-1)});
  r.stepFor(4);
  for(const c of boxes)for(let f=0;f<240&&c.alive;f++)r.tick({...r.steerToward(c.mesh.position),spinHeld:true,spinPressed:f%24===0});
  report.collections.push({name:stop.name,count:boxes.length,broken:boxes.every(c=>!c.alive),grounded:r.p.grounded});
  assert.ok(boxes.length>=2&&boxes.every(c=>!c.alive),'Native spin collects the visible box pair: '+stop.name);
 }
 await writeFile(out+'/route.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
},{modulePath:'/src/levels/spaghetti-rails-platforming.ts',source:m=>m.SPAGHETTI_RAILS_PLATFORMING_LEVEL,levelId:'spaghetti-rails-platforming',endlessDeaths:true});
