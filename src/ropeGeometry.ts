import * as THREE from "three";

export interface FlexibleRopeState {
  anchor:THREE.Vector3;anchorVel:THREE.Vector3;len:number;yaw:number;theta:number;thetaV:number;
  bend?:number;bendV?:number;sway?:number;swayV?:number;
}
export function ropeLocalPoint(rs:FlexibleRopeState,d:number,out:THREE.Vector3):THREE.Vector3 {
  const u=THREE.MathUtils.clamp(d/Math.max(.001,rs.len),0,1),shape=Math.sin(Math.PI*u);
  const bend=(rs.bend??0)*shape,st=Math.sin(rs.theta),ct=Math.cos(rs.theta);
  return out.set(st*d+ct*bend,-ct*d+st*bend,(rs.sway??0)*shape);
}
export function flexibleRopePoint(rs:FlexibleRopeState,d:number,out:THREE.Vector3):THREE.Vector3 {
  ropeLocalPoint(rs,d,out);const x=out.x,z=out.z,c=Math.cos(rs.yaw),s=Math.sin(rs.yaw);
  return out.set(rs.anchor.x+x*c+z*s,rs.anchor.y+out.y,rs.anchor.z-x*s+z*c);
}
export function flexibleRopeVelocity(rs:FlexibleRopeState,d:number,out:THREE.Vector3):THREE.Vector3 {
  const shape=Math.sin(Math.PI*THREE.MathUtils.clamp(d/Math.max(.001,rs.len),0,1));
  const b=(rs.bend??0)*shape,bv=(rs.bendV??0)*shape,st=Math.sin(rs.theta),ct=Math.cos(rs.theta);
  const vx=ct*d*rs.thetaV-st*rs.thetaV*b+ct*bv;
  const vy=st*d*rs.thetaV+ct*rs.thetaV*b+st*bv,vz=(rs.swayV??0)*shape;
  const c=Math.cos(rs.yaw),s=Math.sin(rs.yaw);
  return out.set(vx*c+vz*s,vy,-vx*s+vz*c).add(rs.anchorVel);
}
const a=new THREE.Vector3(),b=new THREE.Vector3(),direction=new THREE.Vector3(),query=new THREE.Vector3();
export function closestRopeDistance(rs:FlexibleRopeState,point:THREE.Vector3):number {
  const lo=1,hi=Math.max(lo,rs.len-.1),n=32;let best=Infinity,result=lo;
  flexibleRopePoint(rs,lo,a);
  for(let i=1;i<=n;i++){
    const end=lo+(hi-lo)*i/n;flexibleRopePoint(rs,end,b);direction.copy(b).sub(a);
    const t=THREE.MathUtils.clamp(query.copy(point).sub(a).dot(direction)/Math.max(1e-9,direction.lengthSq()),0,1);
    const distance=query.copy(a).addScaledVector(direction,t).distanceToSquared(point);
    if(distance<best){best=distance;result=end-(hi-lo)/n*(1-t);}a.copy(b);
  }
  return result;
}
let fiberTexture:THREE.CanvasTexture|null=null;
function ropeTexture():THREE.CanvasTexture {
  if(fiberTexture)return fiberTexture;
  const canvas=document.createElement("canvas");canvas.width=256;canvas.height=512;
  const ctx=canvas.getContext("2d")!,pixels=ctx.createImageData(256,512);
  for(let y=0;y<512;y++)for(let x=0;x<256;x++){
    const twist=x/256*3+y/512*2;
    const strand=.5+.5*Math.cos(twist*Math.PI*2);
    const fiber=Math.sin((x*1.9+y*.57)*Math.PI)*.026+Math.sin((x*.23-y*1.13)*Math.PI)*.018;
    const v=.64+.27*Math.pow(strand,.45)+fiber,i=(y*256+x)*4;
    pixels.data[i]=255*v;pixels.data[i+1]=239*v;pixels.data[i+2]=209*v;pixels.data[i+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  fiberTexture=new THREE.CanvasTexture(canvas);fiberTexture.colorSpace=THREE.SRGBColorSpace;
  fiberTexture.wrapS=fiberTexture.wrapT=THREE.RepeatWrapping;fiberTexture.anisotropy=4;fiberTexture.userData.shared=true;
  return fiberTexture;
}
const p=new THREE.Vector3(),before=new THREE.Vector3(),after=new THREE.Vector3(),tangent=new THREE.Vector3(),side=new THREE.Vector3(),cross=new THREE.Vector3(),radial=new THREE.Vector3();
/** A continuous, three-lobed helical braid; one draw call follows the physical curve. */
export class BraidedRope {
  readonly mesh:THREE.Mesh;
  readonly endKnot:THREE.Mesh|null;
  readonly root=new THREE.Group();
  readonly segments:number;
  private positions:THREE.BufferAttribute;private normals:THREE.BufferAttribute;
  constructor(readonly len:number,readonly radius=.10,knot=true){
    this.len=Math.max(.001,len);
    this.segments=Math.min(420,Math.max(32,Math.ceil(len*22)));
    const rings=this.segments+1,sides=12,geometry=new THREE.BufferGeometry();
    this.positions=new THREE.BufferAttribute(new Float32Array(rings*(sides+1)*3),3);
    this.normals=new THREE.BufferAttribute(new Float32Array(rings*(sides+1)*3),3);
    this.positions.setUsage(THREE.DynamicDrawUsage);this.normals.setUsage(THREE.DynamicDrawUsage);
    const uv=new Float32Array(rings*(sides+1)*2),index:number[]=[];
    for(let i=0;i<rings;i++)for(let j=0;j<=sides;j++){
      const k=i*(sides+1)+j;uv[k*2]=j/sides;uv[k*2+1]=i/this.segments*len/1.4;
      if(i<this.segments&&j<sides){index.push(k,k+sides+1,k+1,k+1,k+sides+1,k+sides+2);}
    }
    geometry.setAttribute("position",this.positions);geometry.setAttribute("normal",this.normals);geometry.setAttribute("uv",new THREE.BufferAttribute(uv,2));geometry.setIndex(index);
    const material=new THREE.MeshLambertMaterial({color:0xc5a77d,map:ropeTexture(),side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.name="continuous braided hemp rope";this.mesh.castShadow=true;this.root.add(this.mesh);
    this.endKnot=knot?new THREE.Mesh(new THREE.TorusKnotGeometry(.125,.053,48,6,2,3),material):null;
    if(this.endKnot)this.root.add(this.endKnot);
  }
  update(sample:(d:number,out:THREE.Vector3)=>THREE.Vector3):void {
    const sides=12;
    for(let i=0;i<=this.segments;i++){
      const d=i/this.segments*this.len;sample(d,p);sample(Math.max(0,d-.015),before);sample(Math.min(this.len,d+.015),after);
      tangent.copy(after).sub(before).normalize();side.set(Math.abs(tangent.x)<.9?1:0,0,Math.abs(tangent.x)<.9?0:1);
      side.addScaledVector(tangent,-side.dot(tangent)).normalize();cross.crossVectors(tangent,side).normalize();
      for(let j=0;j<=sides;j++){
        const angle=j/sides*Math.PI*2,braid=angle+d/0.48*Math.PI*2;
        const r=this.radius*(.85+.15*Math.cos(braid*3));
        radial.copy(side).multiplyScalar(Math.cos(angle)).addScaledVector(cross,Math.sin(angle));
        const k=i*(sides+1)+j;this.positions.setXYZ(k,p.x+radial.x*r,p.y+radial.y*r,p.z+radial.z*r);this.normals.setXYZ(k,radial.x,radial.y,radial.z);
      }
    }
    this.positions.needsUpdate=true;this.normals.needsUpdate=true;
    this.mesh.geometry.computeBoundingSphere();
    if(this.endKnot)sample(this.len,this.endKnot.position);
  }
}
