import {mkdir,writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

// Inventory, not a reachability certificate: this raster ignores vertical
// blockers and jump mechanics. Candidate islands must be inspected and driven.
const out=process.env.MAYFIELD_OUTPUT||'/tmp/mayfield-flow-audit/before';
await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 const {l,THREE,sourceModule:m}=r,step=2,grid=new Map(),meshes=[];
 const key=(x,z)=>`${x},${z}`;
 for(const mesh of l.groundMeshes){
  const g=mesh.geometry,pos=g?.attributes.position;if(!pos)continue;
  const ix=g.index,ids=ix?.array??Array.from({length:pos.count},(_,i)=>i),id=meshes.length;
  const component=m.MAYFIELD_MALL_LEVEL.components[mesh.userData.editorIdx];
  const info={id,name:component?.nm??mesh.name,component:mesh.userData.editorIdx,type:component?.t,group:component?.grp,area:0,bounds:[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity]};
  meshes.push(info);
  const p=Array.from({length:pos.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(pos,i).applyMatrix4(mesh.matrixWorld));
  for(const v of p)for(let k=0;k<3;k++){info.bounds[k]=Math.min(info.bounds[k],v.getComponent(k));info.bounds[k+3]=Math.max(info.bounds[k+3],v.getComponent(k));}
  for(let i=0;i<ids.length;i+=3){
   const a=p[ids[i]],b=p[ids[i+1]],c=p[ids[i+2]],n=b.clone().sub(a).cross(c.clone().sub(a)),area=n.length()/2;n.normalize();
   if(n.y<.55)continue;info.area+=area;
   const den=(b.z-c.z)*(a.x-c.x)+(c.x-b.x)*(a.z-c.z);if(Math.abs(den)<1e-9)continue;
   for(let gx=Math.ceil(Math.min(a.x,b.x,c.x)/step);gx<=Math.floor(Math.max(a.x,b.x,c.x)/step);gx++)for(let gz=Math.ceil(Math.min(a.z,b.z,c.z)/step);gz<=Math.floor(Math.max(a.z,b.z,c.z)/step);gz++){
    const x=gx*step,z=gz*step,u=((b.z-c.z)*(x-c.x)+(c.x-b.x)*(z-c.z))/den,v=((c.z-a.z)*(x-c.x)+(a.x-c.x)*(z-c.z))/den;
    if(u<-.00001||v<-.00001||u+v>1.00001)continue;
    const y=u*a.y+v*b.y+(1-u-v)*c.y,k=key(gx,gz),list=grid.get(k)??[];
    if(!list.some(q=>Math.abs(q.y-y)<.08))list.push({x,z,y,mesh:id,gx,gz,region:-1});grid.set(k,list);
   }
  }
 }
 const nodes=[...grid.values()].flat(),regions=[];
 for(const start of nodes){if(start.region>=0)continue;const id=regions.length,q=[start],ms=new Set();start.region=id;
  const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(let i=0;i<q.length;i++){const n=q[i];ms.add(n.mesh);for(const [k,v]of[n.x,n.y,n.z].entries()){bounds[k]=Math.min(bounds[k],v);bounds[k+3]=Math.max(bounds[k+3],v);}
   for(const [dx,dz]of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,1],[-1,1],[1,-1]])for(const b of grid.get(key(n.gx+dx,n.gz+dz))??[]){
    if(b.region<0&&Math.abs(b.y-n.y)<=.7*Math.hypot(dx,dz)*step){b.region=id;q.push(b);}
   }
  }
  regions.push({id,samples:q.length,area:q.length*step*step,bounds,meshes:[...ms]});
 }
 const spawn=m.MAYFIELD_MALL_LEVEL.spawn,nearest=nodes.reduce((a,b)=>Math.hypot(b.x-spawn[0],b.y-spawn[1],b.z-spawn[2])<Math.hypot(a.x-spawn[0],a.y-spawn[1],a.z-spawn[2])?b:a);
 const report={step,spawnRegion:nearest.region,regions:regions.sort((a,b)=>b.samples-a.samples),meshes,nodes:nodes.map(n=>[n.x,n.y,n.z,n.mesh,n.region]),route:m.MAYFIELD_ROUTE,checkpoints:m.MAYFIELD_CHECKPOINTS,provenance:m.MAYFIELD_SOURCE_PROVENANCE};
 await writeFile(out+'/surface-inventory.json',JSON.stringify(report));
 await writeFile(out+'/surface-inventory-summary.json',JSON.stringify({...report,nodes:undefined,regions:report.regions.filter(q=>q.area>=12).map(q=>({...q,names:q.meshes.map(i=>meshes[i].name)}))},null,2));
 console.log(JSON.stringify({meshes:meshes.length,nodes:nodes.length,regions:regions.length,spawnRegion:nearest.region,largeRegions:report.regions.filter(q=>q.area>=80).map(q=>({...q,names:q.meshes.slice(0,12).map(i=>meshes[i].name)}))},null,2));
},{modulePath:'/src/levels/mayfield-mall.ts',source:m=>m.MAYFIELD_MALL_LEVEL,levelId:'mayfield-mall',maxFrames:1});
