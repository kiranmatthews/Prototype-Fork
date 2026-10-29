import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

/** Visual rope bed only. It never supplies collision or changes bounce physics. */
export function createMarineNet({width=6, length=4, cell=.44, radius=.027, sag=.13, depth=.8}={}) {
  const group=new THREE.Group();
  group.name='orange-marine-net';
  const hx=width/2, hz=length/2;
  const profile=(x,z)=>Math.max(0,1-(x/hx)**2)*Math.max(0,1-(z/hz)**2);
  const ropes=[];
  class Strand extends THREE.Curve {
    constructor(a,b){super();this.a=a;this.b=b;}
    getPoint(t,target=new THREE.Vector3()) {
      target.lerpVectors(this.a,this.b,t);
      target.y=-sag*profile(target.x,target.z);
      return target;
    }
  }
  for (const slope of [-1,1]) {
    const geometries=[];
    for(let intercept=-hx-hz;intercept<=hx+hz;intercept+=cell*Math.SQRT2){
      const candidates=[[-hx,-slope*hx+intercept],[hx,slope*hx+intercept],[(-hz-intercept)/slope,-hz],[(hz-intercept)/slope,hz]];
      const points=candidates.filter(([x,z])=>Math.abs(x)<=hx+1e-6&&Math.abs(z)<=hz+1e-6).map(([x,z])=>new THREE.Vector3(x,0,z));
      const unique=points.filter((p,i)=>points.findIndex(q=>p.distanceToSquared(q)<1e-8)===i);
      if(unique.length!==2||unique[0].distanceTo(unique[1])<.08)continue;
      geometries.push(new THREE.TubeGeometry(new Strand(...unique),Math.max(2,Math.ceil(unique[0].distanceTo(unique[1])/.36)),radius,6,false));
    }
    const geometry=mergeGeometries(geometries);geometries.forEach(g=>g.dispose());
    const rest=geometry.attributes.position, compressed=rest.clone();
    for(let i=0;i<rest.count;i++)compressed.setY(i,rest.getY(i)-depth*profile(rest.getX(i),rest.getZ(i)));
    const deformed=geometry.clone();deformed.setAttribute('position',compressed);deformed.computeVertexNormals();
    geometry.morphAttributes.position=[compressed];geometry.morphAttributes.normal=[deformed.attributes.normal.clone()];deformed.dispose();
    const material=new THREE.MeshStandardMaterial({color:slope===1?0xee6227:0xc94a17,roughness:.88,metalness:0});
    const mesh=new THREE.Mesh(geometry,material);mesh.name=slope===1?'rope-diagonal-a':'rope-diagonal-b';mesh.castShadow=true;mesh.receiveShadow=true;mesh.morphTargetDictionary={compression:0};
    group.add(mesh);ropes.push(mesh);
  }
  const borderGeometries=[];
  const borderMaterial=new THREE.MeshStandardMaterial({color:0xff7430,roughness:.85});
  const corners=[[-hx,0,-hz],[hx,0,-hz],[hx,0,hz],[-hx,0,hz]].map(p=>new THREE.Vector3(...p));
  for(let i=0;i<4;i++){
    const curve=new THREE.LineCurve3(corners[i],corners[(i+1)%4]);
    borderGeometries.push(new THREE.TubeGeometry(curve,1,radius*1.65,8,false));
    const joint=new THREE.SphereGeometry(radius*1.65,8,6);joint.translate(...corners[i].toArray());borderGeometries.push(joint);
  }
  const perimeter=new THREE.Mesh(mergeGeometries(borderGeometries),borderMaterial);perimeter.name='fixed-perimeter-rope';perimeter.castShadow=true;borderGeometries.forEach(g=>g.dispose());
  group.add(perimeter);
  group.userData={kind:'procedural-marine-net',width,length,cell,radius,restSag:sag,maxCompression:depth,visualOnly:true};
  group.setCompression=value=>ropes.forEach(mesh=>{mesh.morphTargetInfluences[0]=THREE.MathUtils.clamp(value,0,1)});
  return group;
}
