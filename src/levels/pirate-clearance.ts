import type { CustomComponent } from '../level';
import type { P } from './pirate-meshes';

/** Cut headroom for an existing sloping passage from generated world-space
 * triangles. This changes the visible surface and its collision together. */
export function cutPiratePassage(component:CustomComponent,a:P,b:P,width:number,height:number):CustomComponent {
  if(component.t!=='mesh'||!component.vertices||!component.indices||component.p.some(n=>n!==0)||
    component.yaw||(component.s??[1,1,1]).some(n=>n!==1))return component;
  const dx=b[0]-a[0],dz=b[2]-a[2],length=Math.hypot(dx,dz),slope=(b[1]-a[1])/length;
  let minS=Infinity,maxS=-Infinity,minU=Infinity,maxU=-Infinity,minH=Infinity,maxH=-Infinity;
  for(let i=0;i<component.vertices.length;i+=3){
    const x=component.vertices[i]-a[0],z=component.vertices[i+2]-a[2],s=(x*dx+z*dz)/length,u=(-x*dz+z*dx)/length,h=component.vertices[i+1]-a[1]-s*slope;
    minS=Math.min(minS,s);maxS=Math.max(maxS,s);minU=Math.min(minU,u);maxU=Math.max(maxU,u);minH=Math.min(minH,h);maxH=Math.max(maxH,h);
  }
  // Most generated pieces miss a passage entirely. Keep those buffers intact
  // without allocating triangle fragments or vertex lookup maps.
  if(maxS<-.5||minS>length+.5||maxU< -width/2||minU>width/2||maxH<.08||minH>height)return component;
  const along=(p:P)=>((p[0]-a[0])*dx+(p[2]-a[2])*dz)/length;
  const across=(p:P)=>((p[0]-a[0])*-dz+(p[2]-a[2])*dx)/length;
  const above=(p:P)=>p[1]-a[1]-along(p)*slope;
  const planes=[(p:P)=>along(p)+.5,(p:P)=>length+.5-along(p),
    (p:P)=>width/2+across(p),(p:P)=>width/2-across(p),(p:P)=>above(p)-.08,(p:P)=>height-above(p)];
  const area=(p:P,q:P,r:P)=>{
    const u=q.map((n,i)=>n-p[i]),v=r.map((n,i)=>n-p[i]);
    return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);
  };
  const split=(polygon:P[],distance:(p:P)=>number):[P[],P[]]=>{
    const inside:P[]=[],outside:P[]=[];
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],dp=distance(p),dq=distance(q);
      (dp>=0?inside:outside).push(p);
      if((dp>=0)!==(dq>=0)){
        const t=dp/(dp-dq),hit=p.map((n,k)=>n+(q[k]-n)*t) as P;
        inside.push(hit);outside.push(hit);
      }
    }
    return [inside,outside];
  };
  const original=component.vertices,vertices=original.slice(),indices:number[]=[],lookup=new Map<string,number>();
  for(let i=0;i<vertices.length;i+=3)lookup.set(vertices.slice(i,i+3).join(','),i/3);
  const index=(p:P)=>{
    const rounded=p.map(n=>Math.round(n*1000)/1000),key=rounded.join(',');
    let i=lookup.get(key);if(i===undefined){i=vertices.length/3;vertices.push(...rounded);lookup.set(key,i);}return i;
  };
  let changed=false;
  for(let i=0;i<component.indices.length;i+=3){
    const ids=component.indices.slice(i,i+3),triangle=ids.map(id=>original.slice(id*3,id*3+3) as P);
    if(planes.some(plane=>triangle.every(p=>plane(p)<0))){indices.push(...ids);continue;}
    let remaining=triangle;const retained:P[][]=[];
    for(const plane of planes){const [inside,outside]=split(remaining,plane);if(outside.length>=3)retained.push(outside);remaining=inside;if(!remaining.length)break;}
    const removedArea=remaining.slice(2).reduce((sum,p,j)=>sum+area(remaining[0],remaining[j+1],p),0);
    if(removedArea<1e-8){indices.push(...ids);continue;}
    changed=true;
    for(const polygon of retained)for(let j=1;j<polygon.length-1;j++){
      if(area(polygon[0],polygon[j],polygon[j+1])<1e-8)continue;
      const face=[index(polygon[0]),index(polygon[j]),index(polygon[j+1])];
      if(new Set(face).size===3)indices.push(...face);
    }
  }
  return changed?{...component,vertices,indices}:component;
}
