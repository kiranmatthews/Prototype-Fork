import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// World-space audit of the built Temple of Embers, independent of the rules
// the course verifies while it is authored.
const SIZE=1.152;
await withBlockworksRuntime(async r=>{
 const {l,THREE}=r,{JUNGLE_TERRACES_ROUTE:route}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 const C=route.data.components,crates=C.filter(c=>c.t==='crate'),hits=[];
 const local=p=>route.toLocal(p).map(n=>+n.toFixed(2));
 // 1. No authored rail passes through a crate.
 for(const c of C.filter(c=>c.t==='rail'&&c.pts))for(const k of crates)for(let i=1;i<c.pts.length;i++){
  const a=[c.p[0]+c.pts[i-1][0],c.p[1]+(c.pts[i-1][3]??0),c.p[2]+c.pts[i-1][1]],b=[c.p[0]+c.pts[i][0],c.p[1]+(c.pts[i][3]??0),c.p[2]+c.pts[i][1]];
  const dx=b[0]-a[0],dz=b[2]-a[2],len2=dx*dx+dz*dz,t=len2?Math.max(0,Math.min(1,((k.p[0]-a[0])*dx+(k.p[2]-a[2])*dz)/len2)):0,px=a[0]+dx*t,pz=a[2]+dz*t,py=a[1]+(b[1]-a[1])*t,d=Math.hypot(px-k.p[0],pz-k.p[2]);
  if(d<SIZE/2+.75&&py>k.p[1]-1.6&&py<k.p[1]+SIZE+2.4)hits.push({rule:'rail through crate',rail:c.nm,crate:k.nm,local:local(k.p)});
 }
 // 2. No lamp inside a sentinel's reach; the sentinel's own crown torch is runtime-owned.
 // A brazier standing above the flame's path (the dais fires) is the destination's own light, not guidance.
 // The breath is directional: it leaves the head along its yaw and sweeps ±amp, reaching range × head scale.
 for(const tiki of C.filter(c=>c.t==='firetiki'))for(const torch of C.filter(c=>c.t==='torch')){
  const yaw=(tiki.yaw??0)*Math.PI/180,fx=Math.sin(yaw),fz=Math.cos(yaw),dx=torch.p[0]-tiki.p[0],dz=torch.p[2]-tiki.p[2],dist=Math.hypot(dx,dz);
  const reach=(tiki.range??7.1)*(tiki.w??1)+1.5,angle=dist>1e-6?Math.acos(Math.max(-1,Math.min(1,(dx*fx+dz*fz)/dist)))*180/Math.PI:0;
  const inSweep=dist<2.5||(dist<reach&&angle<(tiki.amp??28)+14);
  if(inSweep&&torch.p[1]<tiki.p[1]+1.5&&torch.p[1]>tiki.p[1]-4)hits.push({rule:'lamp in a flame',tiki:tiki.nm,torch:torch.nm,local:local(torch.p)});
 }
 // 3. No crate under a censer's swing.
 // The bob swings along the pendulum's local X, spun by its yaw: offset (swing·cos, -swing·sin) in world X/Z.
 for(const pend of C.filter(c=>c.t==='pendulum'))for(const k of crates){const reach=(pend.len??5)*Math.sin(pend.amp??1)+1.2,yaw=(pend.yaw??0)*Math.PI/180,dx=k.p[0]-pend.p[0],dz=k.p[2]-pend.p[2],along=dx*Math.cos(yaw)-dz*Math.sin(yaw),across=dx*Math.sin(yaw)+dz*Math.cos(yaw);if(Math.abs(across)<1.9&&Math.abs(along)<reach&&k.p[1]+SIZE>pend.p[1]-(pend.len??5)-1.1)hits.push({rule:'crate under a censer',crate:k.nm,local:local(k.p)});}
 // 4. No crate inside a patrol's walk.
 for(const e of l.enemies)for(const k of crates){
  const axis=e.axis,along=axis==='z'?k.p[2]:k.p[0],cross=axis==='z'?k.p[0]:k.p[2],home=axis==='z'?e.group.position.x:e.group.position.z;
  if(along>Math.min(e.x0,e.x1)-1.3&&along<Math.max(e.x0,e.x1)+1.3&&Math.abs(cross-home)<1.6&&Math.abs(k.p[1]-e.group.position.y)<2)hits.push({rule:'crate in a patrol',enemy:e.kind,crate:k.nm,local:local(k.p)});
 }
 // 5. Every crate has floor under it within nine metres (floating rewards included); the crate bridge over the Ravine Break is the one row over a void.
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);l.root.updateMatrixWorld(true);
 // Transitions are ridden by the pipe physics, not the ground raycast, so caps above the bowl lips are checked against the bowl's footprint instead.
 const bowl=C.find(c=>c.t==='vertramp'&&c.vkind==='half'&&(c.rise??0)>=5);
 for(const k of crates){
  if(bowl&&Math.abs(k.p[2]-bowl.p[2])<(bowl.w??0)+(bowl.rise??0)+(bowl.deck??0)&&Math.abs(k.p[0]-bowl.p[0])<(bowl.len??0)/2&&k.p[1]>bowl.p[1])continue;
  if(k.nm?.includes('Crate bridge'))continue;
  ray.set(new THREE.Vector3(k.p[0],k.p[1]+.4,k.p[2]),down);ray.far=9.2;if(!ray.intersectObjects(l.groundMeshes,false)[0])hits.push({rule:'crate without floor',crate:k.nm,local:local(k.p)});
 }
 // 6. Every sentinel head stands on its pedestal with nothing else inside its head volume.
 for(const tiki of C.filter(c=>c.t==='firetiki')){
  const under=floorUnder(tiki.p);if(under===undefined||Math.abs(under-tiki.p[1])>.3)hits.push({rule:'sentinel without pedestal',tiki:tiki.nm,under});
  for(const d of C.filter(c=>c.t==='decor'&&c.p&&!c.nm?.includes(tiki.nm)&&!c.nm?.includes('pedestal')))if(Math.hypot(d.p[0]-tiki.p[0],d.p[2]-tiki.p[2])<Math.min(d.s?.[0]??1,d.s?.[2]??1)*.3+1.3&&d.p[1]<tiki.p[1]+3&&d.p[1]+(d.s?.[1]??1)>tiki.p[1]-.5)hits.push({rule:'scenery in a sentinel',tiki:tiki.nm,decor:d.nm,local:local(d.p)});
 }
 function floorUnder(p){ray.set(new THREE.Vector3(p[0],p[1]+.5,p[2]),down);ray.far=1.5;return ray.intersectObjects(l.groundMeshes,false)[0]?.point.y;}
 // 7. Enemies stand on floor along their whole walk.
 for(const e of l.enemies)for(let i=0;i<=10;i++){const q=e.group.position.clone();q[e.axis]=e.x0+(e.x1-e.x0)*i/10;ray.set(q.clone().add(new THREE.Vector3(0,1.5,0)),down);ray.far=3;if(!ray.intersectObjects(l.groundMeshes,false).length)hits.push({rule:'patrol over nothing',enemy:e.kind,at:q.toArray().map(n=>+n.toFixed(1))});}
 const report={crates:crates.length,enemies:l.enemies.length,tikis:l.fireTikis.length,hits};
 await writeFile('/private/tmp/temple-embers-collisions.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.deepEqual(hits,[],'the built world must have no geometry collisions');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
