import * as THREE from 'three';
import type {CustomComponent} from './level';
import type {RacePoint} from './race/types';

const up=new THREE.Vector3(0,1,0);
const round=(n:number)=>Math.round(n*1e5)/1e5;
const noise=(n:number)=>{const v=Math.sin(n*17.13+12.7)*43123.19;return v-Math.floor(v);};
type Contour=(angle:number,radialOffset:number)=>THREE.Vector3;

/** Thick, closed arch collars on the existing shell contour. Only the visible
 * upper arch is dressed: the untouched liner continues below the ride floor.
 * Cream, oxidised steel and rust reuse the established Deadwater palette. */
function portalMeshData(origin:THREE.Vector3,outward:THREE.Vector3,contour:Contour,seed:number,name:string):CustomComponent[] {
 const vertices:number[]=[],indices:number[]=[],colors:number[]=[],uvs:number[]=[];
 const segments=48;
 // Radial offset and axial depth: rounded corners around a broad bolted face.
 const profile=[[0,-.10],[.22,-.14],[.88,-.14],[1.08,.04],[1.08,.42],[.88,.62],[.20,.62],[0,.42]];
 const right=contour(0,0).sub(contour(Math.PI,0)).normalize();
 const winding=right.clone().cross(up).dot(outward)>0?1:-1;
 const face=(a:number,b:number,c:number)=>indices.push(...(winding>0?[a,b,c]:[a,c,b]));
 const cream=new THREE.Color('#eadbb7'),weather=new THREE.Color('#7d8768'),back=new THREE.Color('#768578');
 let along=0,previous=contour(0,0);
 for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI,at=contour(a,0);if(i)along+=at.distanceTo(previous);previous=at;
  for(const [k,[radial,depth]]of profile.entries()){
   // Seal against the liner's actual 32-sided edge. At the outer bevel the
   // contour eases out to a smoother silhouette, hiding the old paper rim.
   const panel=a/(Math.PI/16),j=Math.floor(panel),t=panel-j;
   const seam=contour(j*Math.PI/16,0).lerp(contour(Math.min(16,j+1)*Math.PI/16,0),t);
   const p=contour(a,radial).lerp(seam,Math.max(0,1-radial/.22)).addScaledVector(outward,depth).sub(origin);
   vertices.push(...p.toArray().map(round));uvs.push(along/4,k/profile.length);
   const damp=(1-Math.sin(a))**3*.25,variation=noise(seed+i*7.3)*.09;
   const color=cream.clone().lerp(weather,damp+variation);
   if(k<3)color.lerp(back,.40);else if(k===3)color.lerp(weather,.15);
   colors.push(color.r,color.g,color.b);
  }
  if(i)for(let k=0;k<profile.length;k++){
   const a=(i-1)*profile.length+k,b=i*profile.length+k,c=i*profile.length+(k+1)%profile.length,d=(i-1)*profile.length+(k+1)%profile.length;
   face(a,b,d);face(d,b,c);
  }
 }
 for(let k=1;k<profile.length-1;k++){
  face(0,k,k+1);const last=segments*profile.length;face(last,last+k+1,last+k);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
 const component=(nm:string,v:number[],idx:number[],col:number[],normals:number[],tex='solid'):CustomComponent=>({
  t:'mesh',p:origin.toArray().map(round) as RacePoint,vertices:v,indices:idx,colors:col,normals,tex,
  color:'#ffffff',solid:false,scenerySolid:false,edgeGrinding:false,castShadow:true,doubleSided:false,grp:434,nm,
 });
 const rim=component(`${name} / beveled portal collar`,vertices,indices,colors,Array.from(geometry.attributes.normal.array));
 rim.uvs=uvs;geometry.dispose();

 // One mesh per portal contains every washer and hex head. Separate normals
 // retain their facets without one draw/object per fitting.
 const fastVertices:number[]=[],fastIndices:number[]=[],fastColors:number[]=[],fastNormals:number[]=[];
 const rotation=new THREE.Quaternion().setFromUnitVectors(up,outward);
 const washer=new THREE.CylinderGeometry(.18,.22,.055,10,1,false);
 const bolt=new THREE.CylinderGeometry(.105,.135,.13,6,1,false);
 const append=(g:THREE.BufferGeometry,centre:THREE.Vector3,color:THREE.Color)=>{
  const offset=fastVertices.length/3;
  for(let i=0;i<g.attributes.position.count;i++){
   const p=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyQuaternion(rotation).add(centre).sub(origin);
   const n=new THREE.Vector3().fromBufferAttribute(g.attributes.normal,i).applyQuaternion(rotation);
   fastVertices.push(...p.toArray().map(round));fastNormals.push(...n.toArray().map(round));fastColors.push(color.r,color.g,color.b);
  }
  fastIndices.push(...Array.from(g.index!.array,i=>i+offset));
 };
 for(let i=0;i<11;i++){
  const a=(.06+i*.088)*Math.PI,centre=contour(a,.54).addScaledVector(outward,.645);
  append(washer,centre,new THREE.Color('#915d46').lerp(new THREE.Color('#426974'),noise(seed+i)*.38));
  append(bolt,centre.clone().addScaledVector(outward,.07),new THREE.Color('#726d59').lerp(new THREE.Color('#a5aa93'),noise(seed+3+i)*.5));
 }
 washer.dispose();bolt.dispose();
 return [rim,component(`${name} / rusted portal fasteners`,fastVertices,fastIndices,fastColors,fastNormals)];
}

// Fixed topology: 1,536 vertices and 1,484 triangles per placement, with a
// conservative charge for the temporary geometry and normal construction.
export const WATERPARK_PORTAL_WORK = 4_000;

/** Compact, editable portal prop. Width/rise describe its clear arch; bank is
 * the signed half-height difference between its feet. Local +Z faces out. */
export function createWaterparkPortal(c: CustomComponent): THREE.Group {
 const radius=(c.w??22)/2,height=c.rise??12,bank=c.bank??0;
 const contour=(a:number,radial:number)=>new THREE.Vector3(
  Math.cos(a)*(radius+radial),Math.cos(a)*bank+Math.sin(a)*(height+radial),0);
 const name=c.nm??'Waterpark / tunnel portal',group=new THREE.Group();
 group.name=name;group.position.set(...c.p);group.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
 group.scale.set(...(c.s??[1,1,1]));group.userData.visualOnly=true;
 for(const part of portalMeshData(new THREE.Vector3(),new THREE.Vector3(0,0,1),contour,c.seed??0,name)){
  const geometry=new THREE.BufferGeometry();
  for(const [key,values,size]of [['position',part.vertices!,3],['normal',part.normals!,3],['color',part.colors!,3]] as const)
   geometry.setAttribute(key,new THREE.Float32BufferAttribute(values,size));
  geometry.setIndex(part.indices!);geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({color:c.color??'#ffffff',vertexColors:true}));
  mesh.name=part.nm!;mesh.castShadow=c.castShadow!==false;mesh.receiveShadow=true;
  mesh.userData.visualOnly=true;mesh.userData.edgeGrinding=false;group.add(mesh);
 }
 return group;
}
