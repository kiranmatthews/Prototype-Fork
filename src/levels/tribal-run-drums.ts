import type {CustomComponent} from '../level';

/** Hand-built drum: a flat, readable crown and closed tapered timber body.
 * The native mover's render surface is also its real ground collider. */
export function tribalDrum(width:number,depth:number):Partial<CustomComponent>{
 const vertices:number[]=[],indices:number[]=[],uvs:number[]=[],colors:number[]=[],normals:number[]=[];
 const count=24,top=.6,bottom=-.6;
 const vertex=(x:number,y:number,z:number,u:number,v:number,color:number[],normal:number[])=>{
  vertices.push(x,y,z);uvs.push(u,v);colors.push(...color);normals.push(...normal);return vertices.length/3-1;
 };
 const centre=vertex(0,top,0,.5,.5,[1,.93,.72],[0,1,0]);
 for(let i=0;i<=count;i++){const a=i/count*Math.PI*2,x=Math.cos(a),z=Math.sin(a);vertex(x*width/2,top,z*depth/2,.5+x*.5,.5+z*.5,[1,.93,.72],[0,1,0]);}
 for(let i=0;i<count;i++)indices.push(centre,i+2,i+1);
 const grindTopTriangles=indices.length/3;
 for(let i=0;i<count;i++){
  const a=i/count*Math.PI*2,b=(i+1)/count*Math.PI*2,k=vertices.length/3;
  for(const [theta,y,r,v]of [[a,top,1,1],[b,top,1,1],[a,bottom,.87,0],[b,bottom,.87,0]]){
   const x=Math.cos(theta),z=Math.sin(theta);vertex(x*width/2*r,y,z*depth/2*r,theta/Math.PI*3,v,[.65,.41,.22],[x,.18,z]);
  }
  indices.push(k,k+1,k+3,k,k+3,k+2);
 }
 const base=vertex(0,bottom,0,.5,.5,[.4,.24,.13],[0,-1,0]);
 for(let i=0;i<=count;i++){const a=i/count*Math.PI*2,x=Math.cos(a),z=Math.sin(a);vertex(x*width*.435,bottom,z*depth*.435,.5+x*.5,.5+z*.5,[.4,.24,.13],[0,-1,0]);}
 for(let i=0;i<count;i++)indices.push(base,base+i+1,base+i+2);
 return{vertices,indices,uvs,colors,normals,grindTopTriangles,tex:'tribal-weave',color:'#ffffff'};
}
