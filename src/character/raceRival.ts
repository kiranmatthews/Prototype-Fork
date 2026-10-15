import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

/** Light surfaces on the existing semantic rig; the same clips and elasticity still drive it. */
export function createRaceRivalHead(color:string):THREE.Group {
  const root=new THREE.Group();root.name='rival-head';
  const ivory=new THREE.MeshLambertMaterial({color:0xe8dcc7,flatShading:true});
  const helmet=new THREE.MeshLambertMaterial({color,flatShading:true});
  const dark=new THREE.MeshLambertMaterial({color:0x242b35});
  const add=(geo:THREE.BufferGeometry,mat:THREE.Material,x:number,y:number,z:number)=>{
    const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;root.add(m);return m;
  };
  add(new THREE.SphereGeometry(.2,12,8),ivory,0,.18,0).scale.set(1,.92,.85);
  add(new THREE.SphereGeometry(.22,12,6,0,Math.PI*2,0,Math.PI/2),helmet,0,.23,0).scale.y=.75;
  for(const x of [-.065,.065])add(new THREE.SphereGeometry(.037,8,6),dark,x,.175,.157).scale.set(.8,1.12,.4);
  add(new THREE.ConeGeometry(.025,.045,3),dark,0,.12,.179).rotation.z=Math.PI;
  add(new THREE.BoxGeometry(.11,.032,.024),dark,0,.072,.162);
  // One vertex-coloured draw for the entire head, rather than a draw per facial part.
  const pieces:THREE.BufferGeometry[]=[];
  for(const child of root.children){
    const m=child as THREE.Mesh;m.updateMatrix();const geometry=m.geometry.clone().applyMatrix4(m.matrix);
    const color=(m.material as THREE.MeshLambertMaterial).color,values=new Float32Array(geometry.getAttribute('position').count*3);
    for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(values,3));pieces.push(geometry);
    m.geometry.dispose();
  }
  const merged=mergeGeometries(pieces);for(const geometry of pieces)geometry.dispose();
  root.clear();ivory.dispose();helmet.dispose();dark.dispose();
  if(!merged)throw new Error('Rival head geometry could not be combined');
  const head=new THREE.Mesh(merged,new THREE.MeshLambertMaterial({vertexColors:true,flatShading:true}));head.castShadow=true;root.add(head);
  return root;
}

export interface RaceRivalShirt {mesh:THREE.SkinnedMesh;setLength(value:number):void}

export function createRaceRivalShirt(rig:{mount:THREE.Object3D;torsoRoot:THREE.Bone;spine:THREE.Bone;chest:THREE.Bone;neck:THREE.Bone},color:string):RaceRivalShirt {
  const rings=[[.71,.135,.12],[.82,.17,.13],[1.06,.235,.145],[1.22,.285,.13],[1.325,.085,.075],[1.325,.05,.05],[1.435,.047,.047]],sides=12;
  const position:number[]=[],indices:number[]=[],skinIndex:number[]=[],skinWeight:number[]=[],colors:number[]=[];
  const jersey=new THREE.Color(color),boneColor=new THREE.Color(0xe8dcc7);
  const heights=[.71,.82,1.06,1.325];
  for(let r=0;r<rings.length;r++){
    const [y,w,d]=rings[r];let bone=0;while(bone<2&&y>heights[bone+1])bone++;
    const t=THREE.MathUtils.clamp((y-heights[bone])/(heights[bone+1]-heights[bone]),0,1);
    for(let i=0;i<sides;i++){
      const angle=i/sides*Math.PI*2;position.push(Math.sin(angle)*w,y,Math.cos(angle)*d);
      skinIndex.push(bone,bone+1,0,0);skinWeight.push(1-t,t,0,0);
      const tint=r<5?jersey:boneColor;colors.push(tint.r,tint.g,tint.b);
      if(r){const a=(r-1)*sides+i,b=(r-1)*sides+(i+1)%sides,c=r*sides+i,e=r*sides+(i+1)%sides;indices.push(a,b,c,c,b,e);}
    }
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(position,3));geometry.setIndex(indices);
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(skinIndex,4));geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute(skinWeight,4));geometry.computeVertexNormals();
  // Keep the shared torso squash/stretch profile, including radial volume response.
  geometry.morphAttributes.position=[1.35,.8].map(scale=>new THREE.Float32BufferAttribute(position.map((v,i)=>i%3===1||Math.floor(i/3)>=5*sides?v:v*scale),3));
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true,side:THREE.DoubleSide,flatShading:true}));mesh.updateMorphTargets();mesh.name='rival-shirt';mesh.frustumCulled=false;mesh.castShadow=true;
  rig.mount.add(mesh);rig.mount.updateWorldMatrix(true,true);
  const skeleton=new THREE.Skeleton([rig.torsoRoot,rig.spine,rig.chest,rig.neck]);skeleton.calculateInverses();mesh.bind(skeleton,mesh.matrixWorld);
  return {mesh,setLength(value){
    const radial=1/Math.sqrt(THREE.MathUtils.clamp(value,.55,1.5));
    mesh.morphTargetInfluences![0]=Math.max(0,(radial-1)/.35);
    mesh.morphTargetInfluences![1]=Math.max(0,(1-radial)/.2);
  }};
}

export function attachRaceRivalShorts(hips:THREE.Bone,left:THREE.Bone,right:THREE.Bone):void {
  const cloth=new THREE.MeshLambertMaterial({color:0x26394c,flatShading:true});
  const waist=new THREE.Mesh(new THREE.BoxGeometry(.34,.16,.265),cloth);waist.position.y=-.025;waist.name='rival-waist';waist.castShadow=true;hips.add(waist);
  for(const bone of [left,right]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.105,.095,.2,8),cloth);leg.position.y=-.09;leg.name='rival-shorts';leg.castShadow=true;bone.add(leg);}
}
