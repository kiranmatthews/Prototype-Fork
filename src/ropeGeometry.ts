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
/** Strand relief belongs in shading, independently of the curve's tessellation.
 * Axial UVs are in metres, so the braid pitch stays fixed on every rope length. */
function ropeMaterial(radius:number):THREE.MeshLambertMaterial {
  const material=new THREE.MeshLambertMaterial({color:0xc5a77d,side:THREE.DoubleSide});
  material.name="hemp rope / filtered strand relief";
  material.onBeforeCompile=shader=>{
    shader.uniforms.ropeRelief={value:radius*.10};
    shader.vertexShader="varying vec2 vRopeUv;\n"+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace("#include <uv_vertex>","#include <uv_vertex>\nvRopeUv=uv;");
    shader.fragmentShader="varying vec2 vRopeUv;\nuniform float ropeRelief;\n"+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace("#include <color_fragment>",`#include <color_fragment>
      float ropePhase=6.28318530718*(3.0*vRopeUv.x+6.25*vRopeUv.y);
      vec2 ropePhaseSlope=vec2(dFdx(ropePhase),dFdy(ropePhase));
      float ropeDetail=1.0-smoothstep(1.5,4.0,abs(ropePhaseSlope.x)+abs(ropePhaseSlope.y));
      float ropeFiberPhase=6.28318530718*(24.0*vRopeUv.x-50.0*vRopeUv.y);
      float ropeFiberDetail=1.0-smoothstep(1.0,3.0,fwidth(ropeFiberPhase));
      diffuseColor.rgb*=vec3(.68,.59,.46)*(1.0+.28*cos(ropePhase)*ropeDetail
        +.035*sin(ropeFiberPhase)*ropeFiberDetail);
    `);
    // Surface-gradient bump mapping: use the analytic height slope, avoiding
    // texture fetches and derivatives of the derivative-based detail filter.
    shader.fragmentShader=shader.fragmentShader.replace("#include <normal_fragment_maps>",`#include <normal_fragment_maps>
      vec3 ropeDx=dFdx(-vViewPosition),ropeDy=dFdy(-vViewPosition);
      vec3 ropeRx=cross(ropeDy,normal),ropeRy=cross(normal,ropeDx);
      float ropeDet=dot(ropeDx,ropeRx)*faceDirection;
      vec2 ropeHeightSlope=-ropeRelief*sin(ropePhase)*ropeDetail*ropePhaseSlope;
      vec3 ropeGradient=sign(ropeDet)*(ropeHeightSlope.x*ropeRx+ropeHeightSlope.y*ropeRy);
      normal=normalize(max(abs(ropeDet),1e-10)*normal-ropeGradient);
    `);
  };
  material.customProgramCacheKey=()=>"hemp-rope-strand-relief-v1";
  return material;
}
const ROPE_SIDES=8;
const circle=Array.from({length:ROPE_SIDES+1},(_,i)=>[Math.cos(i/ROPE_SIDES*Math.PI*2),Math.sin(i/ROPE_SIDES*Math.PI*2)] as const);
const p=new THREE.Vector3(),before=new THREE.Vector3(),after=new THREE.Vector3(),tangent=new THREE.Vector3(),side=new THREE.Vector3(),cross=new THREE.Vector3();
/** One low-poly tube follows the physical curve; its shader supplies the braid. */
export class BraidedRope {
  readonly mesh:THREE.Mesh;
  readonly endKnot:THREE.Mesh|null;
  readonly root=new THREE.Group();
  readonly segments:number;
  readonly radialSegments=ROPE_SIDES;
  private positions:THREE.BufferAttribute;private normals:THREE.BufferAttribute;
  private readonly curveBounds=new THREE.Box3();
  constructor(readonly len:number,readonly radius=.10,knot=true){
    this.len=Math.max(.001,len);
    this.segments=Math.min(96,Math.max(24,Math.ceil(this.len*2)));
    const rings=this.segments+1,sides=this.radialSegments,geometry=new THREE.BufferGeometry();
    this.positions=new THREE.BufferAttribute(new Float32Array(rings*(sides+1)*3),3);
    this.normals=new THREE.BufferAttribute(new Float32Array(rings*(sides+1)*3),3);
    this.positions.setUsage(THREE.DynamicDrawUsage);this.normals.setUsage(THREE.DynamicDrawUsage);
    const uv=new Float32Array(rings*(sides+1)*2),index:number[]=[];
    for(let i=0;i<rings;i++)for(let j=0;j<=sides;j++){
      const k=i*(sides+1)+j;uv[k*2]=j/sides;uv[k*2+1]=i/this.segments*this.len;
      if(i<this.segments&&j<sides){index.push(k,k+1,k+sides+1,k+1,k+sides+2,k+sides+1);}
    }
    geometry.setAttribute("position",this.positions);geometry.setAttribute("normal",this.normals);geometry.setAttribute("uv",new THREE.BufferAttribute(uv,2));geometry.setIndex(index);
    geometry.boundingBox=new THREE.Box3();geometry.boundingSphere=new THREE.Sphere();
    const material=ropeMaterial(radius);
    this.mesh=new THREE.Mesh(geometry,material);this.mesh.name="continuous braided hemp rope";this.mesh.castShadow=true;this.root.add(this.mesh);
    this.endKnot=knot?new THREE.Mesh(ropeKnotGeometry(),ropeMaterial(.053)):null;
    if(this.endKnot)this.root.add(this.endKnot);
  }
  update(sample:(d:number,out:THREE.Vector3)=>THREE.Vector3):void {
    const sides=this.radialSegments,r=this.radius*.9;
    const positions=this.positions.array as Float32Array,normals=this.normals.array as Float32Array;
    this.curveBounds.makeEmpty();
    for(let i=0;i<=this.segments;i++){
      const d=i/this.segments*this.len;sample(d,p);sample(Math.max(0,d-.015),before);sample(Math.min(this.len,d+.015),after);
      this.curveBounds.expandByPoint(p);
      tangent.copy(after).sub(before).normalize();side.set(Math.abs(tangent.x)<.9?1:0,0,Math.abs(tangent.x)<.9?0:1);
      side.addScaledVector(tangent,-side.dot(tangent)).normalize();cross.crossVectors(tangent,side).normalize();
      for(let j=0;j<=sides;j++){
        const [c,s]=circle[j],k=(i*(sides+1)+j)*3;
        const nx=side.x*c+cross.x*s,ny=side.y*c+cross.y*s,nz=side.z*c+cross.z*s;
        positions[k]=p.x+nx*r;positions[k+1]=p.y+ny*r;positions[k+2]=p.z+nz*r;
        normals[k]=nx;normals[k+1]=ny;normals[k+2]=nz;
      }
    }
    this.positions.needsUpdate=true;this.normals.needsUpdate=true;
    // All triangle vertices lie within this curve envelope. Reuse its bounds
    // instead of scanning every uploaded vertex twice after each deformation.
    const min=this.curveBounds.min,max=this.curveBounds.max;
    const roundoff=Math.max(1e-5,Math.abs(min.x)*1e-7,Math.abs(min.y)*1e-7,Math.abs(min.z)*1e-7,
      Math.abs(max.x)*1e-7,Math.abs(max.y)*1e-7,Math.abs(max.z)*1e-7);
    this.mesh.geometry.boundingBox!.copy(this.curveBounds).expandByScalar(r+roundoff);
    this.mesh.geometry.boundingBox!.getBoundingSphere(this.mesh.geometry.boundingSphere!);
    if(this.endKnot)sample(this.len,this.endKnot.position);
  }
}

function ropeKnotGeometry():THREE.TorusKnotGeometry {
  const geometry=new THREE.TorusKnotGeometry(.125,.053,48,6,2,3);
  const positions=geometry.getAttribute("position"),uv=geometry.getAttribute("uv");
  const centre=new THREE.Vector3(),previous=new THREE.Vector3(),vertex=new THREE.Vector3();
  const distances=[0];
  for(let ring=0;ring<=48;ring++){
    centre.set(0,0,0);
    for(let j=0;j<6;j++)centre.add(vertex.fromBufferAttribute(positions,ring*7+j));
    centre.multiplyScalar(1/6);
    if(ring>0)distances.push(distances[ring-1]+centre.distanceTo(previous));
    previous.copy(centre);
  }
  // TorusKnot UVs run along the knot first. Swap them into the tube convention,
  // using actual curve distance and a whole number of strand turns at the seam.
  const total=distances[48],scale=Math.round(total/.16)*.16/total;
  for(let ring=0;ring<=48;ring++)for(let j=0;j<=6;j++)uv.setXY(ring*7+j,j/6,distances[ring]*scale);
  return geometry;
}
