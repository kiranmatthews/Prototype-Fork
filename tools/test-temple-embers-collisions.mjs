import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
// World-space audit of the built Temple of Embers, independent of the
// station-space rules the course verifies while it is authored.
const SIZE=1.152;
await withBlockworksRuntime(async r=>{
 const {l,THREE}=r,{JUNGLE_TERRACES_ROUTE:route}=await r.server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 const C=route.data.components,crates=C.filter(c=>c.t==='crate'),hits=[];
 const local=p=>route.toLocal(p).map(n=>+n.toFixed(2));
 // 1. No rail, trick rail or rope passes through a crate.
 const lines=[];
 for(const c of C){
  if((c.t==='rail'||c.t==='trickrail')&&c.pts)lines.push({nm:c.nm,pts:c.pts.map(q=>[c.p[0]+q[0],c.p[1]+(q[3]??0),c.p[2]+q[1]])});
  if(c.t==='rope'){const a=(c.yaw??0)*Math.PI/180,dx=Math.sin(a)*c.len/2,dz=Math.cos(a)*c.len/2;lines.push({nm:c.nm,pts:[[c.p[0]-dx,c.p[1],c.p[2]-dz],[c.p[0]+dx,c.p[1]-(c.amp??1.2),c.p[2]+dz]],sag:true});}
 }
 for(const line of lines)for(const c of crates)for(let i=1;i<line.pts.length;i++){
  const [ax,ay,az]=line.pts[i-1],[bx,by,bz]=line.pts[i],dx=bx-ax,dz=bz-az,len2=dx*dx+dz*dz,t=len2?Math.max(0,Math.min(1,((c.p[0]-ax)*dx+(c.p[2]-az)*dz)/len2)):0;
  const px=ax+dx*t,pz=az+dz*t,py=line.sag?Math.min(ay,by):ay+(by-ay)*t,d=Math.hypot(px-c.p[0],pz-c.p[2]);
  if(d<SIZE/2+.75&&py>c.p[1]-1.6&&py<c.p[1]+SIZE+2.4)hits.push({rule:'rail through crate',line:line.nm,crate:c.nm,local:local(c.p),lateral:+d.toFixed(2)});
 }
 // 2. No lamp inside a sentinel's reach; the sentinel's own crown torch is runtime-owned.
 for(const tiki of C.filter(c=>c.t==='firetiki'))for(const torch of C.filter(c=>c.t==='torch'))
  if(Math.hypot(tiki.p[0]-torch.p[0],tiki.p[2]-torch.p[2])<(tiki.range??7.1)+1.5)hits.push({rule:'lamp in a flame',tiki:tiki.nm,torch:torch.nm,local:local(torch.p)});
 // 3. No crate on a pad that moves, breaks, phases or boosts, nor under a piston.
 for(const pad of C.filter(c=>['phasepad','crumble','mover','trampoline','speedpad','crusher'].includes(c.t)))for(const c of crates){
  const s=pad.s??[5,.6,5],inside=Math.abs(c.p[0]-pad.p[0])<s[0]/2+.5&&Math.abs(c.p[2]-pad.p[2])<s[2]/2+.5&&Math.abs(c.p[1]-pad.p[1])<4;
  if(inside)hits.push({rule:'crate on machinery',pad:pad.nm,crate:c.nm,local:local(c.p)});
 }
 // 4. No parapet point inside a piston's footprint.
 for(const pad of C.filter(c=>c.t==='crusher'))for(const w of C.filter(c=>c.t==='wallpath'&&c.pts))for(const q of w.pts){
  const x=w.p[0]+q[0],z=w.p[2]+q[1],s=pad.s;if(Math.abs(x-pad.p[0])<s[0]/2+.2&&Math.abs(z-pad.p[2])<s[2]/2+.2&&Math.abs(w.p[1]-pad.p[1])<3)hits.push({rule:'parapet under a piston',pad:pad.nm,wall:w.nm,at:[+x.toFixed(1),+z.toFixed(1)]});
 }
 // 5. No crate inside a patrol's walk.
 for(const e of l.enemies)for(const c of crates){
  const axis=e.axis,along=axis==='z'?c.p[2]:c.p[0],cross=axis==='z'?c.p[0]:c.p[2],home=axis==='z'?e.group.position.x:e.group.position.z;
  if(along>Math.min(e.x0,e.x1)-1.3&&along<Math.max(e.x0,e.x1)+1.3&&Math.abs(cross-home)<1.6&&Math.abs(c.p[1]-e.group.position.y)<2)hits.push({rule:'crate in a patrol',enemy:e.kind,crate:c.nm,local:local(c.p)});
 }
 // 6. Every crate has floor under it, within four metres (caps above the bowl lips included).
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);l.root.updateMatrixWorld(true);
 for(const c of crates){ray.set(new THREE.Vector3(c.p[0],c.p[1]+.4,c.p[2]),down);ray.far=4.6;const hit=ray.intersectObjects(l.groundMeshes,false)[0];
  if(!hit)hits.push({rule:'crate without floor',crate:c.nm,local:local(c.p)});}
 // 7. The side-view zone covers the censers and no checkpoint.
 const zone=l.zones[0];assert.ok(zone,'the censer hall needs its travel zone');
 for(const pend of C.filter(c=>c.t==='pendulum'))assert.ok(pend.p[0]>=zone.xMin&&pend.p[0]<=zone.xMax&&pend.p[2]>=zone.zMin&&pend.p[2]<=zone.zMax,`${pend.nm} must swing inside the side view`);
 for(const cp of C.filter(c=>c.t==='checkpoint'))assert.ok(!(cp.p[0]>=zone.xMin&&cp.p[0]<=zone.xMax&&cp.p[2]>=zone.zMin&&cp.p[2]<=zone.zMax),'no checkpoint inside the side-view turn');
 // 8. The kickflip seal and the sentinel heads stay out of the eight-metre lane.
 for(const g of C.filter(c=>c.t==='trickgate'))assert.ok(Math.abs(route.toLocal(g.p)[2])>4.6,'the seal stands beside the lane');
 for(const t of C.filter(c=>c.t==='firetiki'))assert.ok(Math.abs(route.toLocal(t.p)[2])>5.5,'sentinel heads stand beside the lane');
 const report={crates:crates.length,lines:lines.length,enemies:l.enemies.length,hits};
 await writeFile('/private/tmp/temple-embers-collisions.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 assert.deepEqual(hits,[],'the built world must have no geometry collisions');
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',source:m=>m.JUNGLE_TERRACES_LEVEL,endlessDeaths:true});
