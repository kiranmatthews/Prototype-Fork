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
      ended:(i===1&&raw*length<-.005)||(i===points.length-1&&(raw-1)*length>.005)};
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

/** Continue an authored coping across a short, reachable break. Only a
 * forward, similarly aligned receiver qualifies; vertical flight is untouched. */
export function nextCoping(source:readonly THREE.Vector3[],candidates:readonly (readonly THREE.Vector3[])[],
 position:Readonly<THREE.Vector3>,normal:Readonly<THREE.Vector3>,lateralSpeed:number,verticalSpeed:number,gravity:number):readonly THREE.Vector3[]|null {
 if(Math.abs(lateralSpeed)<2)return null;
 const sign=Math.sign(lateralSpeed),fx=-normal.z*sign,fz=normal.x*sign;
 const start=source[0],end=source[source.length-1];
 const from=(end.x-start.x)*fx+(end.z-start.z)*fz>=0?end:start;
 let score=Infinity,result:readonly THREE.Vector3[]|null=null;
 for(const path of candidates){
  if(path===source||path.length<2)continue;
  for(const reverse of [false,true]){
   const first=path[reverse?path.length-1:0],second=path[reverse?path.length-2:1];
   const dx=first.x-from.x,dz=first.z-from.z,along=dx*fx+dz*fz,cross=Math.abs(dx*fz-dz*fx);
   const tx=second.x-first.x,tz=second.z-first.z,length=Math.hypot(tx,tz);
   if(along<.6||along>24||cross>3.5||Math.abs(first.y-from.y)>6||!length||(tx*fx+tz*fz)/length<.72)continue;
   const discriminant=verticalSpeed*verticalSpeed+2*gravity*(position.y-first.y+1);
   if(discriminant<0)continue;
   const time=(verticalSpeed+Math.sqrt(discriminant))/Math.max(1,gravity);
   if(along/Math.abs(lateralSpeed)>time+.12)continue;
   const cost=along+cross*3;if(cost>=score)continue;
   score=cost;result=[from,...(reverse?[...path].reverse():path)];
  }
 }
 return result;
}
