import * as THREE from 'three';
import type { CustomComponent } from '../level';

export type BahiaPoint = [number, number, number];
const round=(n:number)=>Math.round(n*100000)/100000;

/** A real chamfer, with six broad faces, twelve edge planes and eight corners.
 * 44 triangles, independent of the dimensions. No texture-baked bevels. */
export function bahiaBevel(size:BahiaPoint,bevel=.08,seed=0,wear=0):THREE.BufferGeometry {
  const h=size.map(v=>v/2),b=Math.min(bevel,...h.map(v=>v*.65)),v:number[]=[];
  const face=(points:number[][])=>{
    const a=new THREE.Vector3(...points[0]),n=new THREE.Vector3(...points[1]).sub(a)
      .cross(new THREE.Vector3(...points[2]).sub(a));
    const center=new THREE.Vector3();points.forEach(p=>center.add(new THREE.Vector3(...p)));
    if(n.dot(center)<0)points.reverse();
    for(let i=1;i<points.length-1;i++)for(const p of [points[0],points[i],points[i+1]])v.push(...p);
  };
  for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
    const u=(axis+1)%3,w=(axis+2)%3;
    face([[-1,-1],[1,-1],[1,1],[-1,1]].map(([su,sw])=>{
      const p=[0,0,0];p[axis]=sign*h[axis];p[u]=su*(h[u]-b);p[w]=sw*(h[w]-b);return p;
    }));
  }
  for(let axis=0;axis<3;axis++)for(const su of [-1,1])for(const sw of [-1,1]){
    const u=(axis+1)%3,w=(axis+2)%3;
    face([[1,0],[-1,0],[-1,1],[1,1]].map(([s,side])=>{
      const p=[0,0,0];p[axis]=s*(h[axis]-b);p[u]=su*(h[u]-(side?b:0));p[w]=sw*(h[w]-(side?0:b));return p;
    }));
  }
  for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])
    face([0,1,2].map(axis=>[x,y,z].map((s,i)=>s*(h[i]-(i===axis?0:b)))));
  // Share the 24 authored corners. Each belongs to a broad face; its normal
  // keeps that face flat and interpolates a round highlight over the bevel.
  const positions:number[]=[],normals:number[]=[],indices:number[]=[],known=new Map<string,number>();
  for(let i=0;i<v.length;i+=3){
    const p=v.slice(i,i+3),key=p.map(n=>n.toFixed(8)).join(',');let index=known.get(key);
    if(index===undefined){index=positions.length/3;known.set(key,index);positions.push(...p);
      const axis=p.map((n,j)=>Math.abs(n/h[j])).reduce((best,n,j,all)=>n>all[best]?j:best,0),n=[0,0,0];n[axis]=Math.sign(p[axis]);normals.push(...n);
    }indices.push(index);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);
  if(wear){const p=g.attributes.position;for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=seed*2.716;
    p.setXYZ(i,x+wear*Math.sin(y*4.1+z*2.9+t),y+wear*.45*Math.sin(x*3.7+z*1.9+t*2),z+wear*.45*Math.sin(x*2.3+y*3.1+t*3));
  }}
  return g;
}

/** Emits source-owned, separately editable components in shop-local coordinates.
 * Metric face UVs and gentle vertex paint keep trim and broad walls coherent. */
export class BahiaCraft {
  readonly components:CustomComponent[]=[];
  private co:number;private si:number;
  constructor(readonly origin:BahiaPoint,readonly yaw:number,readonly grp:number,readonly prefix:string,readonly vertexPaint=false){
    this.co=Math.cos(yaw*Math.PI/180);this.si=Math.sin(yaw*Math.PI/180);
  }
  point([x,y,z]:BahiaPoint):BahiaPoint{return [round(this.origin[0]+x*this.co+z*this.si),round(this.origin[1]+y),round(this.origin[2]-x*this.si+z*this.co)];}
  mesh(name:string,g:THREE.BufferGeometry,p:BahiaPoint,color:string,extra:Partial<CustomComponent>={}):CustomComponent {
    if(!g.attributes.normal)g.computeVertexNormals();
    const a=g.attributes.position,n=g.attributes.normal,uv:number[]=[],colors:number[]=[],base=new THREE.Color(color);
    g.computeBoundingBox();const box=g.boundingBox!,height=Math.max(.1,box.max.y-box.min.y);
    const paint=extra.tex!=='solid'&&extra.opacity===undefined;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),y=a.getY(i),z=a.getZ(i),nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));
      uv.push((nx>ny&&nx>nz?z:x)/2.8+.37,(ny>nx&&ny>nz?z:y)/2.8+.19);
      if(this.vertexPaint){const c=base.clone();if(paint)c.lerp(new THREE.Color('#8c7798'),.055*(1-(y-box.min.y)/height));colors.push(c.r,c.g,c.b);}
    }
    const c:CustomComponent={t:'mesh',p:this.point(p),yaw:this.yaw,grp:this.grp,nm:`${this.prefix} / ${name}`,
      solid:false,tex:'bahia-plaster',color:this.vertexPaint?'#ffffff':color,vertices:Array.from(a.array,round),normals:Array.from(n.array,round),
      uvs:uv.map(round),...(this.vertexPaint?{colors:colors.map(round)}:{}),indices:g.index?Array.from(g.index.array):Array.from({length:a.count},(_,i)=>i),...extra};
    this.components.push(c);g.dispose();return c;
  }
  box(name:string,p:BahiaPoint,size:BahiaPoint,color:string,bevel=.07,extra:Partial<CustomComponent>={}){
    return this.mesh(name,bevel?bahiaBevel(size,bevel):new THREE.BoxGeometry(...size),p,color,extra);
  }
  cylinder(name:string,p:BahiaPoint,r:number,h:number,color:string,top=r,segments=12){
    return this.mesh(name,new THREE.CylinderGeometry(top,r,h,segments),p,color);
  }
  ball(name:string,p:BahiaPoint,r:number,color:string,extra:Partial<CustomComponent>={}){
    return this.mesh(name,new THREE.SphereGeometry(r,10,6),p,color,extra);
  }
  polygon(name:string,points:[number,number][],p:BahiaPoint,color:string,depth=.1,bevel=.025){
    const s=new THREE.Shape(points.map(p=>new THREE.Vector2(...p)));
    return this.mesh(name,new THREE.ExtrudeGeometry(s,{depth,steps:1,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,curveSegments:4}),p,color);
  }
  beam(name:string,a:BahiaPoint,b:BahiaPoint,r:number,color:string){
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start);
    const g=new THREE.CylinderGeometry(r,r,d.length(),8).applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));
    return this.mesh(name,g,start.add(end).multiplyScalar(.5).toArray() as BahiaPoint,color);
  }
}
