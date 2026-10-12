import * as THREE from 'three';

/** Closest point on an authored coping. The position is horizontal: a rising
 * or falling rider must retain its independently integrated vertical motion. */
export function copingPlane(points:readonly THREE.Vector3[],position:Readonly<THREE.Vector3>,normal:Readonly<THREE.Vector3>){
  let best=Infinity,result:null|{x:number;y:number;z:number;nx:number;nz:number;ended:boolean}=null;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i],dx=b.x-a.x,dz=b.z-a.z,length2=dx*dx+dz*dz;
    if(length2<1e-8)continue;
    const raw=((position.x-a.x)*dx+(position.z-a.z)*dz)/length2,t=Math.max(0,Math.min(1,raw));
    const x=a.x+dx*t,z=a.z+dz*t,d=(position.x-x)**2+(position.z-z)**2;
    if(d>=best)continue;
    best=d;const length=Math.sqrt(length2),sign=(-dz*normal.x+dx*normal.z)>=0?1:-1;
    result={x,y:a.y+(b.y-a.y)*t,z,nx:-dz/length*sign,nz:dx/length*sign,
      ended:(i===1&&raw*length<-.5)||(i===points.length-1&&(raw-1)*length>.5)};
  }
  return result;
}

export function nearestCoping(copings:readonly THREE.Vector3[][],position:Readonly<THREE.Vector3>,normal:Readonly<THREE.Vector3>){
  let distance=Infinity,points:readonly THREE.Vector3[]|null=null;
  for(const path of copings){const p=copingPlane(path,position,normal);if(!p)continue;
    const d=(position.x-p.x)**2+(position.z-p.z)**2;
    if(d<distance){distance=d;points=path;}
  }
  return points;
}
