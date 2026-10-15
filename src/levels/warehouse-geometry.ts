import { CatmullRomCurve3, Matrix4, Quaternion, Vector3 } from 'three';
import type { CustomComponent } from '../level';

export type WarehousePoint = [number, number, number];
/** Authoring helpers produce ordinary greybox decks, banks and steelwork. Runtime stays shared. */
export function warehouseRibbon(nm:string, points:WarehousePoint[], width:number, thickness=.7):CustomComponent {
 const curve=new CatmullRomCurve3(points.map(p=>new Vector3(...p)),false,'centripetal');
 const minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1]));
 const count=Math.max(16,Math.ceil(curve.getLength()/1.4)),vertices:number[]=[],indices:number[]=[];
 for(let i=0;i<=count;i++){
  const p=curve.getPointAt(i/count),t=curve.getTangentAt(i/count),l=new Vector3(-t.z,0,t.x).normalize().multiplyScalar(width/2);
  p.y=Math.max(minY,Math.min(maxY,p.y)); // flat junctions cannot overshoot below their floor or above their landing
  for(const y of [0,-thickness])for(const sign of [-1,1])vertices.push(p.x+l.x*sign,p.y+y,p.z+l.z*sign);
 }
 for(let i=0;i<count;i++){const a=i*4,b=a+4;indices.push(a,a+1,b+1,a,b+1,b);}
 const grindTopTriangles=indices.length/3;
 for(let i=0;i<count;i++){
  const a=i*4,b=a+4;
  indices.push(a,b,b+2,a,b+2,a+2,a+1,a+3,b+3,a+1,b+3,b+1,a+2,b+2,b+3,a+2,b+3,a+3);
 }
 indices.push(0,2,3,0,3,1,count*4,count*4+1,count*4+3,count*4,count*4+3,count*4+2);
 return {t:'mesh',nm,p:[0,0,0],vertices,indices,grindTopTriangles,solidSides:true,tex:'solid',color:'#a5a8ab',vert:false};
}

export function warehouseIsland(nm:string,x:number,z:number,w:number,d:number,height:number,bank:number,phase=0):CustomComponent {
 const vertices=[0,height,0],indices:number[]=[],n=48;
 for(const [extra,y]of [[0,height],[bank,0],[bank,-.4]])for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2,r=1+.09*Math.sin(a*3+phase);
  vertices.push(Math.cos(a)*(w/2+extra)*r,y,Math.sin(a)*(d/2+extra)*r);
 }
 for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(0,1+j,1+i,1+i,1+j,1+n+j,1+i,1+n+j,1+n+i);}
 const grindTopTriangles=indices.length/3;
 for(let i=0;i<n;i++){const j=(i+1)%n;indices.push(1+n+i,1+n+j,1+2*n+j,1+n+i,1+2*n+j,1+2*n+i);}
 return {t:'mesh',nm,p:[x,0,z],vertices,indices,grindTopTriangles,solidSides:true,tex:'solid',color:'#b8bbbe',vert:false};
}

export function warehouseBeam(nm:string,a:WarehousePoint,b:WarehousePoint,w:number,d:number,color='#535a60'):CustomComponent {
 const from=new Vector3(...a),to=new Vector3(...b),delta=to.clone().sub(from);
 const transform=new Matrix4().compose(from.clone().add(to).multiplyScalar(.5),
  new Quaternion().setFromUnitVectors(new Vector3(0,1,0),delta.clone().normalize()),new Vector3(w,delta.length(),d));
 const vertices:number[]=[],indices:number[]=[];
 for(const face of [
  [[.5,-.5,-.5],[.5,.5,-.5],[.5,.5,.5],[.5,-.5,.5]],
  [[-.5,-.5,.5],[-.5,.5,.5],[-.5,.5,-.5],[-.5,-.5,-.5]],
  [[-.5,.5,.5],[.5,.5,.5],[.5,.5,-.5],[-.5,.5,-.5]],
  [[-.5,-.5,-.5],[.5,-.5,-.5],[.5,-.5,.5],[-.5,-.5,.5]],
  [[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],
  [[.5,-.5,-.5],[-.5,-.5,-.5],[-.5,.5,-.5],[.5,.5,-.5]],
 ]){const k=vertices.length/3;for(const p of face)vertices.push(...new Vector3(...p).applyMatrix4(transform).toArray());indices.push(k,k+1,k+2,k,k+2,k+3);}
 // Truss members are overhead/in the protected support bays, not hidden floors.
 return {t:'mesh',nm,p:[0,0,0],vertices,indices,solid:false,edgeGrinding:false,castShadow:false,tex:'solid',color};
}
