import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const CLAY_PLANT_KINDS = ['mapbroadleaf','mappalm','mapbanana','mapgroundleaf'] as const;
export type ClayPlantKind = typeof CLAY_PLANT_KINDS[number];
export function isClayPlant(kind:string):kind is ClayPlantKind {return (CLAY_PLANT_KINDS as readonly string[]).includes(kind);}
export function clayArchGeometry(low=false):THREE.BufferGeometry {
  const shape=new THREE.Shape();
  shape.moveTo(-.52,0);shape.lineTo(-.47,.57);shape.quadraticCurveTo(-.46,.94,-.12,1);
  shape.quadraticCurveTo(.27,1.06,.45,.69);shape.lineTo(.53,0);shape.lineTo(.25,0);
  shape.lineTo(.22,.56);shape.quadraticCurveTo(.12,.77,-.06,.75);shape.quadraticCurveTo(-.27,.72,-.25,.49);
  shape.lineTo(-.25,0);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:.45,steps:1,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:low?2:4,curveSegments:low?5:12});
  g.translate(0,0,-.225);g.computeBoundingBox();
  const b=g.boundingBox!,s=b.getSize(new THREE.Vector3()),c=b.getCenter(new THREE.Vector3());g.translate(-c.x,-b.min.y,-c.z);g.scale(1/s.x,1/s.y,1/s.z);
  const p=g.attributes.position,n=g.attributes.normal,colors=new Float32Array(p.count*3);
  for(let i=0;i<p.count;i++){
    const color=new THREE.Color(0x63746c).lerp(new THREE.Color(0xafb69b),p.getY(i)*.75+.1);
    if(p.getY(i)>.73&&n.getY(i)>.58)color.lerp(new THREE.Color(0x668f43),.8);
    color.toArray(colors,i*3);
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('aClayPart',new THREE.BufferAttribute(new Float32Array(p.count),1));
  g.userData.closedParts=1;g.name='solid clay arch';return g;
}
type V3 = readonly [number,number,number];
const v=(p:V3)=>new THREE.Vector3(...p);

/** Closed ring loft: one vertex per pole; no duplicated zero-area tip quads. */
function loft(rings:THREE.Vector3[][],start:THREE.Vector3,end:THREE.Vector3):THREE.BufferGeometry {
  const sides=rings[0].length,points=[start,...rings.flat(),end],indices:number[]=[];
  for(let j=0;j<sides;j++)indices.push(0,1+(j+1)%sides,1+j);
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<sides;j++){
    const a=1+i*sides+j,b=1+(i+1)*sides+j,c=1+i*sides+(j+1)%sides,d=1+(i+1)*sides+(j+1)%sides;
    indices.push(a,c,b,b,c,d);
  }
  const last=1+(rings.length-1)*sides,tip=points.length-1;
  for(let j=0;j<sides;j++)indices.push(tip,last+j,last+(j+1)%sides);
  let volume=0;
  for(let i=0;i<indices.length;i+=3)volume+=points[indices[i]].dot(points[indices[i+1]].clone().cross(points[indices[i+2]]));
  if(volume<0)for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(p=>p.toArray()),3));
  g.setIndex(indices);g.computeVertexNormals();return g;
}

function paint(g:THREE.BufferGeometry,leaf:boolean):void {
  const p=g.attributes.position,n=g.attributes.normal,colors=new Float32Array(p.count*3),flex=new Float32Array(p.count);
  g.computeBoundingBox();const box=g.boundingBox!,height=box.max.y-box.min.y,length=box.max.z-box.min.z;
  for(let i=0;i<p.count;i++){
    const t=leaf?(p.getZ(i)-box.min.z)/length:(p.getY(i)-box.min.y)/height;
    const c=leaf?new THREE.Color(0x225b3b).lerp(new THREE.Color(0x81b944),THREE.MathUtils.clamp(n.getY(i)*.42+.42+t*.12,0,1))
      :new THREE.Color(0x65422f).lerp(new THREE.Color(0xbb8550),t*.76+.12);
    c.toArray(colors,i*3);flex[i]=leaf?Math.pow(Math.max(0,t),1.3):0;
  }
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.setAttribute('aClayLeaf',new THREE.BufferAttribute(flex,1));
}

/** A thick lenticular blade with a raised centre fold and a curved drooping tip. */
export function clayLeafGeometry(length:number,width:number,arch:number,droop:number,low=false):THREE.BufferGeometry {
  const steps=low?6:12,sides=low?8:12,rings:THREE.Vector3[][]=[];
  for(let i=1;i<steps;i++){
    const t=i/steps,shape=Math.pow(Math.sin(Math.PI*t),.82),half=width*.5*shape,thickness=width*.105*shape;
    const cy=arch*Math.sin(Math.PI*t)-droop*t*t;
    const angle=Math.atan((arch*Math.PI*Math.cos(Math.PI*t)-2*droop*t)/length);
    const ring:THREE.Vector3[]=[];
    for(let j=0;j<sides;j++){
      const phi=j/sides*Math.PI*2,x=Math.cos(phi)*half;
      const dy=Math.sin(phi)*thickness+Math.max(0,Math.sin(phi))*(1-Math.abs(Math.cos(phi)))*width*.055*shape;
      ring.push(new THREE.Vector3(x,cy+Math.cos(angle)*dy,length*t-Math.sin(angle)*dy));
    }
    rings.push(ring);
  }
  const g=loft(rings,new THREE.Vector3(),new THREE.Vector3(0,-droop,length));paint(g,true);return g;
}

function stem(points:V3[],radius:number,tipRadius:number,low:boolean):THREE.BufferGeometry {
  const curve=new THREE.CatmullRomCurve3(points.map(v)),steps=low?6:14,sides=low?8:12;
  const frames=curve.computeFrenetFrames(steps,false),rings:THREE.Vector3[][]=[];
  for(let i=0;i<=steps;i++){
    const t=i/steps,r=THREE.MathUtils.lerp(radius,tipRadius,t),at=curve.getPointAt(t),ring=[];
    for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;ring.push(at.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r));}
    rings.push(ring);
  }
  const g=loft(rings,curve.getPoint(0),curve.getPoint(1));paint(g,false);return g;
}

export function createClayPlantGeometry(kind:ClayPlantKind,low=false):THREE.BufferGeometry {
  const parts:THREE.BufferGeometry[]=[];let leafCount=0;
  const addLeaf=(origin:V3,yaw:number,length:number,width:number,arch:number,droop:number,tilt=0)=>{
    const g=clayLeafGeometry(length,width,arch,droop,low);g.rotateX(tilt);g.rotateY(yaw);g.translate(...origin);parts.push(g);leafCount++;
  };
  if(kind==='mappalm'){
    parts.push(stem([[0,0,0],[-.25,1.6,0],[.2,3.5,0],[.48,5.3,0]],.28,.17,low));
    for(let i=0;i<6;i++)addLeaf([.48,5.25,0],i*Math.PI/3+.15,3.3,1.65,1.0,1.05+(i%2)*.24);
    for(let i=0;i<3;i++){
      const g=new THREE.SphereGeometry(.28,low?8:14,low?6:10);g.deleteAttribute('uv');paint(g,false);
      const c=g.attributes.color,p=g.attributes.position;
      for(let j=0;j<c.count;j++){const colour=new THREE.Color(0x94622f).lerp(new THREE.Color(0xd8b168),(p.getY(j)/.28+1)*.5);c.setXYZ(j,colour.r,colour.g,colour.b);}
      g.translate(.48+Math.cos(i*2.094)*.25,5.05,Math.sin(i*2.094)*.25);parts.push(g);
    }
  } else if(kind==='mapbroadleaf'){
    parts.push(stem([[0,0,0],[-.18,1.4,0],[0,2.5,0],[.1,3.8,0]],.33,.15,low));
    const crowns:V3[]=[[-1.0,3.0,.1],[1.1,3.4,-.25],[.1,4.25,-.2]];
    for(let k=0;k<crowns.length;k++){
      const p=crowns[k];parts.push(stem([[0,1.9,0],[p[0]*.65,p[1]-.4,p[2]],p],.16,.065,low));
      for(let j=0;j<3;j++)addLeaf(p,j*Math.PI*2/3+k*.9,2.1+(k===2?.2:0),1.6,.42,.44);
    }
  } else {
    const banana=kind==='mapbanana',count=banana?5:3;
    if(banana)parts.push(stem([[0,0,0],[.08,.7,0],[0,1.6,0]],.15,.09,low));
    for(let j=0;j<count;j++)addLeaf([0,banana?1.35:.16,0],j*Math.PI*2/count+.3,banana?2.8:1.6,banana?1.3:.98,banana?1.05:.56,banana?.9:.2,banana?-.35:0);
  }
  if(kind==='mappalm'||kind==='mapbroadleaf')for(let j=0;j<3;j++){
    const a=j*Math.PI*2/3;parts.push(stem([[0,.32,0],[Math.cos(a)*.34,.11,Math.sin(a)*.34],[Math.cos(a)*.62,.02,Math.sin(a)*.62]],.14,.035,low));
  }
  // Parts remain individual closed shells; no random decimation of thin leaves.
  parts.forEach((g,i)=>g.setAttribute('aClayPart',new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(i),1)));
  const g=mergeGeometries(parts)!;for(const p of parts)p.dispose();
  g.computeBoundingBox();const bounds=g.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  g.translate(-center.x,-bounds.min.y,-center.z);g.scale(1/size.x,1/size.y,1/size.z);
  g.computeBoundingBox();g.computeBoundingSphere();g.name=`solid clay ${kind}${low?' LOD1':' LOD0'}`;
  g.userData.leafCount=leafCount;g.userData.closedParts=parts.length;return g;
}
