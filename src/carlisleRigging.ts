import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CustomComponent } from './level';
import { roundCorners } from './pathNodes';

const UP=new THREE.Vector3(0,1,0),DROP=.12,STRAND_RADIUS=.065,LAY_RADIUS=.13;
// A round cable's vertical section widens on a slope. Lower its centre enough
// to retain the same native crown, rather than letting collars clip the board.
const dropAt=(tangent:THREE.Vector3)=>Math.max(DROP,.21/Math.hypot(tangent.x,tangent.z)-.09);
const weather=(material:THREE.MeshStandardMaterial)=>{
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 rigPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nrigPosition=position;');
    shader.fragmentShader=`varying vec3 rigPosition;
      float rigHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float rigNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(rigHash(i),rigHash(i+vec3(1,0,0)),f.x),mix(rigHash(i+vec3(0,1,0)),rigHash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(rigHash(i+vec3(0,0,1)),rigHash(i+vec3(1,0,1)),f.x),mix(rigHash(i+vec3(0,1,1)),rigHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float wear=rigNoise(rigPosition*19.0)*.65+rigNoise(rigPosition*53.0)*.35;
      diffuseColor.rgb*=.78+.29*rigNoise(rigPosition*4.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.17,.22,.27),smoothstep(.69,.83,wear)*.65);`);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+wear*.12,.35,.9);');
  };material.customProgramCacheKey=()=> 'carlisle-rigging-salt-wear-v1';return material;
};
type Section={point:THREE.Vector3;tangent:THREE.Vector3;side:THREE.Vector3;up:THREE.Vector3;distance:number};
const frame=(point:THREE.Vector3,tangent:THREE.Vector3,distance:number):Section=>{
  const side=new THREE.Vector3().crossVectors(tangent,UP).normalize();
  return{point,tangent,side,up:new THREE.Vector3().crossVectors(side,tangent).normalize(),distance};
};

/** Full braided geometry on the authored polyline; no new rail or collision. */
export class CarlisleRigging {
  readonly diagnostics={cables:0,metres:0,strands:0,collars:0,fairleads:0,triangles:0};
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly groups:THREE.Group[]=[];
  private readonly steel=new THREE.MeshStandardMaterial({color:0x8c9dad,metalness:.48,roughness:.54,vertexColors:true,emissive:0x102033,emissiveIntensity:.1});
  private readonly dark=weather(new THREE.MeshStandardMaterial({color:0x263a50,metalness:.55,roughness:.57}));
  private readonly orange=weather(new THREE.MeshStandardMaterial({color:0xd45b26,metalness:.32,roughness:.52}));
  private readonly zinc=weather(new THREE.MeshStandardMaterial({color:0x8a99a7,metalness:.72,roughness:.42}));
  private readonly collarBody:THREE.BufferGeometry;
  private readonly collarBand:THREE.BufferGeometry;
  private readonly anchor:{geometry:THREE.BufferGeometry;material:THREE.Material;name:string}[];
  constructor(){
    const left=new THREE.CylinderGeometry(.205,.205,.16,16,1,true).translate(0,-.2,0);
    const right=new THREE.CylinderGeometry(.205,.205,.16,16,1,true).translate(0,.2,0);
    this.collarBody=this.own(mergeGeometries([left,right])!);left.dispose();right.dispose();
    this.collarBand=this.own(new THREE.CylinderGeometry(.205,.205,.24,16,1,true));
    // Fairlead roller crowns and cheek plates sit below the native rail top.
    // Its base meets the existing 1.3m support post's cap at y=-1.2.
    const body=[new RoundedBoxGeometry(1.5,.28,1.3,2,.04).translate(0,-1.06,0)];
    for(const side of [-1,1])body.push(new RoundedBoxGeometry(.16,.8,1.05,2,.035).translate(side*.55,-.58,0));
    const wheel=[new THREE.CylinderGeometry(.40,.40,.78,24).rotateZ(Math.PI/2).translate(0,-.48,0)];
    for(const side of [-1,1])wheel.push(new THREE.CylinderGeometry(.43,.43,.08,24).rotateZ(Math.PI/2).translate(side*.4,-.48,0));
    const fittings:THREE.BufferGeometry[]=[];
    for(const side of [-1,1])fittings.push(new THREE.CylinderGeometry(.11,.11,.09,12).rotateZ(Math.PI/2).translate(side*.67,-.48,0));
    for(const x of [-.5,.5])for(const z of [-.43,.43])fittings.push(new THREE.CylinderGeometry(.075,.075,.055,6).translate(x,-.8925,z));
    this.anchor=[{parts:body,material:this.dark,name:'Fairlead cheeks'},
      {parts:wheel,material:this.orange,name:'Grooved roller'},
      {parts:fittings,material:this.zinc,name:'Bearing caps and bolts'}].map(({parts,material,name})=>{
        const flat=parts.map(g=>g.index?g.toNonIndexed():g),geometry=this.own(mergeGeometries(flat)!);new Set([...parts,...flat]).forEach(g=>g.dispose());return{geometry,material,name};
      });
  }
  private own(geometry:THREE.BufferGeometry){this.geometries.add(geometry);return geometry;}
  private mesh(geometry:THREE.BufferGeometry,material:THREE.Material,name:string,parent:THREE.Object3D){
    const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);
    this.diagnostics.triangles+=(geometry.index?.count??geometry.attributes.position.count)/3;return mesh;
  }
  add(component:CustomComponent,parent:THREE.Object3D){
    if(component.t!=='rail'||!component.pts||component.closed||component.amp)return;
    // This is the same corner-rounding function used by Level's native Rail.
    const points=roundCorners(component.pts,false).map(p=>new THREE.Vector3(p.x,p.y,p.z));
    if(points.length<2)return;
    const sections:Section[]=[],lengths:number[]=[],directions:THREE.Vector3[]=[];
    let length=0;
    for(let i=1;i<points.length;i++){
      const delta=points[i].clone().sub(points[i-1]),n=delta.length();lengths.push(n);directions.push(delta.divideScalar(n));length+=n;
    }
    let along=0;
    for(let i=0;i<lengths.length;i++){
      const count=Math.ceil(lengths[i]/.12);
      for(let j=0;j<count;j++)sections.push(frame(points[i].clone().lerp(points[i+1],j/count),directions[i],along+lengths[i]*j/count));
      along+=lengths[i];
    }
    sections.push(frame(points[points.length-1].clone(),directions[directions.length-1],length));
    const group=new THREE.Group();group.name='Braided harbour grind cable';group.position.set(...component.p);group.userData.visualOnly=true;
    group.userData.rigging={source:component.nm,points:points.map(p=>p.toArray()),length,maxCrown:.09,bodyRadius:LAY_RADIUS+STRAND_RADIUS,maxDrop:Math.max(...directions.map(dropAt))};parent.add(group);this.groups.push(group);
    const vertices:number[]=[],colors:number[]=[],indices:number[]=[];
    for(let strand=0;strand<7;strand++){
      const radius=strand===6?.078:STRAND_RADIUS,shade=.84+(strand%3)*.07;
      const centers=sections.map(s=>{
        const angle=s.distance/1.28*Math.PI*2+strand*Math.PI/3;
        return s.point.clone().addScaledVector(UP,-dropAt(s.tangent)).addScaledVector(s.side,strand===6?0:Math.cos(angle)*LAY_RADIUS).addScaledVector(s.up,strand===6?0:Math.sin(angle)*LAY_RADIUS);
      });
      const start=vertices.length/3,sides=8;
      for(let i=0;i<centers.length;i++){
        const direction=centers[Math.min(i+1,centers.length-1)].clone().sub(centers[Math.max(0,i-1)]).normalize();
        const side=new THREE.Vector3().crossVectors(direction,UP).normalize(),normal=new THREE.Vector3().crossVectors(side,direction).normalize();
        for(let k=0;k<sides;k++){
          const angle=k/sides*Math.PI*2,p=centers[i].clone().addScaledVector(side,Math.cos(angle)*radius).addScaledVector(normal,Math.sin(angle)*radius);
          vertices.push(...p.toArray());colors.push(shade,shade,shade);
          if(i){const a=start+(i-1)*sides+k,b=start+(i-1)*sides+(k+1)%sides,c=start+i*sides+k,d=start+i*sides+(k+1)%sides;indices.push(a,c,b,b,c,d);}
        }
      }
      for(const end of [0,centers.length-1]){
        const cap=vertices.length/3;vertices.push(...centers[end].toArray());colors.push(shade,shade,shade);
        for(let k=0;k<sides;k++){const a=start+end*sides+k,b=start+end*sides+(k+1)%sides;indices.push(cap,...(end?[b,a]:[a,b]));}
      }
    }
    const braid=this.own(new THREE.BufferGeometry());braid.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));braid.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));braid.setIndex(indices);braid.computeVertexNormals();braid.computeBoundingBox();braid.computeBoundingSphere();
    this.mesh(braid,this.steel,'Seven steel rope strands',group);
    const sample=(distance:number)=>{
      let d=distance;for(let i=0;i<lengths.length;i++){if(d<=lengths[i]||i===lengths.length-1)return frame(points[i].clone().addScaledVector(directions[i],d),directions[i],distance);d-=lengths[i];}return sections[0];
    };
    const marks=[1.2];for(let d=12;d<length-3;d+=12)marks.push(d);marks.push(length-1.2);
    for(const [geometry,material,name]of[[this.collarBody,this.zinc,'Steel cable sleeves'],[this.collarBand,this.orange,'Orange cable collars']]as const){
      const mesh=new THREE.InstancedMesh(geometry,material,marks.length);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;
      marks.forEach((d,i)=>{const s=sample(d),matrix=new THREE.Matrix4().compose(s.point.addScaledVector(UP,-dropAt(s.tangent)),new THREE.Quaternion().setFromUnitVectors(UP,s.tangent),new THREE.Vector3(1,1,1));mesh.setMatrixAt(i,matrix);});
      mesh.computeBoundingSphere();group.add(mesh);this.diagnostics.triangles+=(geometry.index!.count/3)*marks.length;
    }
    for(const distance of [0,length]){
      const s=sample(distance),anchor=new THREE.Group();anchor.name='Winch cable fairlead';anchor.position.copy(s.point);anchor.rotation.y=Math.atan2(s.tangent.x,s.tangent.z);group.add(anchor);
      for(const part of this.anchor)this.mesh(part.geometry,part.material,part.name,anchor);
    }
    this.diagnostics.cables++;this.diagnostics.metres+=length;this.diagnostics.strands+=7;this.diagnostics.collars+=marks.length;this.diagnostics.fairleads+=2;
  }
  dispose(){
    for(const group of this.groups){group.traverse(n=>{if((n as THREE.InstancedMesh).isInstancedMesh)(n as THREE.InstancedMesh).dispose();});group.removeFromParent();}
    this.groups.length=0;this.geometries.forEach(g=>g.dispose());this.geometries.clear();
    for(const m of [this.steel,this.dark,this.orange,this.zinc])m.dispose();
  }
}
