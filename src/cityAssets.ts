import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {CITY_MODULES} from './cityModules';
import collisionData from './cityShapes.json';

const PROPS={
 cityretaining:{label:"bolted concrete retaining panel",size:[6,13,.35],bounds:[[-3,0,-.175],[3,13,.175]],procedural:true},
 cityutilitypole:{label:"Meshy utility pole",size:[3.2,8,.8],bounds:[[-1.6,0,-.4],[1.6,8,.4]],file:"utility-pole.glb"},
 cityjersey:{label:"Meshy concrete safety barrier",size:[3,.95,.65],bounds:[[-1.5,0,-.325],[1.5,.95,.325]],file:"jersey-barrier.glb"},
 cityexcavator:{label:"Meshy compact excavator",size:[3.4,4.1,5.8],bounds:[[-1.7,0,-2.9],[1.7,4.1,2.9]],file:"excavator.glb"},
 citytaper:{label:"boulevard to two-lane transition",size:[18,.15,18],bounds:[[-9,0,-9],[9,.15,9]],ground:true},
 citycone:{label:'roadworks cone',size:[.66,.9,.66],bounds:[[-.33,0,-.33],[.33,.9,.33]],procedural:true},
 citybarrier:{label:'roadworks barrier',size:[3,.9,.7],bounds:[[-1.5,0,-.35],[1.5,.9,.35]],procedural:true},
 citylamp:{label:'city street lamp',size:[1,6,.6],bounds:[[-.5,0,-.3],[.5,6,.3]],procedural:true},
 cityfence:{label:'works safety fence',size:[6,3,.16],bounds:[[-3,0,-.08],[3,3,.08]],procedural:true},
 citydeck:{label:'steel work deck',size:[4.5,.4,4.5],bounds:[[-2.25,0,-2.25],[2.25,.4,2.25]],ground:true,procedural:true},
 cityscaffold:{label:'excavation scaffold',size:[4.5,12,4.5],bounds:[[-2.25,0,-2.25],[2.25,12,2.25]],procedural:true},
} as const;
const ASSETS={...CITY_MODULES,...PROPS};
export type CityKind=keyof typeof ASSETS;
export interface CitySpec {label:string;size:readonly number[];bounds:readonly (readonly number[])[];ground?:boolean;building?:boolean;footprint?:readonly number[];procedural?:boolean;file?:string;}
export const CITY_ASSETS:Readonly<Record<CityKind,CitySpec>>=ASSETS;
export const CITY_ASSET_KINDS=Object.keys(ASSETS) as CityKind[];
export const CITY_ASSET_LABELS=Object.fromEntries(CITY_ASSET_KINDS.map(k=>[k,CITY_ASSETS[k].label])) as Record<CityKind,string>;
export const isCityAsset=(kind:string|undefined):kind is CityKind=>!!kind&&Object.prototype.hasOwnProperty.call(ASSETS,kind);
export interface CityPlacement {
 dkind:CityKind;p:[number,number,number];s?:[number,number,number];yaw?:number;w?:number;color?:string;cameraCutaway?:boolean;
 /** Height change in metres across local +X; yaw 90 points +X along world -Z. */
 amp?:number;
}
export function cityMatrix(c:CityPlacement,centered=false):THREE.Matrix4 {
 const size=c.s??CITY_ASSETS[c.dkind].size,nominal=CITY_ASSETS[c.dkind].size,scale=c.w??1;
 const matrix=new THREE.Matrix4().compose(new THREE.Vector3(c.p[0],c.p[1]-(centered?size[1]*scale/2:0),c.p[2]),
  new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),THREE.MathUtils.degToRad(c.yaw??0)),
  new THREE.Vector3(size[0]/nominal[0]*scale,size[1]/nominal[1]*scale,size[2]/nominal[2]*scale));
 // Grade vertically about the tile midpoint. Unlike a rigid pitch, this keeps
 // its requested horizontal span exact at every height, including the curbs.
 matrix.elements[1]=(c.amp??0)/nominal[0];
 return matrix;
}
/** Three's default instanced normal transform assumes orthogonal matrix axes. */
function addCityInstanceNormals(material:THREE.Material):void {
 if(material.userData.cityInstanceNormals)return;
 material.userData.cityInstanceNormals=true;
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>',THREE.ShaderChunk.defaultnormal_vertex.replace(
   /transformedNormal \/= vec3\( dot\( im\[ 0 \], im\[ 0 \] \), dot\( im\[ 1 \], im\[ 1 \] \), dot\( im\[ 2 \], im\[ 2 \] \) \);\s*transformedNormal = im \* transformedNormal;/,
   `vec3 cityNormalX = cross(im[1], im[2]);
    vec3 cityNormalY = cross(im[2], im[0]);
    vec3 cityNormalZ = cross(im[0], im[1]);
    transformedNormal = mat3(cityNormalX, cityNormalY, cityNormalZ) * transformedNormal / dot(im[0], cityNormalX);`));
 };
 material.customProgramCacheKey=()=>previousKey()+'|city-affine-normals-v1';
}
/** Retaining panels fade by their own height, independent of the street elevation. */
function addCityRetainingFade(material:THREE.Material):void {
 const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
 material.onBeforeCompile=(shader,renderer)=>{
  previous.call(material,shader,renderer);
  shader.vertexShader='varying float vCityPanelHeight;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCityPanelHeight=position.y/13.0;');
  shader.fragmentShader='varying float vCityPanelHeight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>','#include <fog_fragment>\ngl_FragColor.rgb*=smoothstep(0.08,0.60,vCityPanelHeight);');
 };
 material.customProgramCacheKey=()=>previousKey()+'|city-panel-depth-v1';
}
interface Part {geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial;}
interface Template {near:Part[];far:Part[];}
let renderer:THREE.WebGLRenderer|null=null,ktx:KTX2Loader|null=null;
export function configureCityAssetRenderer(value:THREE.WebGLRenderer):void {
 renderer=value;ktx??=new KTX2Loader().setTranscoderPath(import.meta.env.BASE_URL+'jungle-kit/basis/').setWorkerLimit(2).detectSupport(value);
}
const palette:Record<string,string>={MI_Concrete:'#ded3bd',MI_Asphalt:'#9ab5d1',MI_RedBrick:'#e09a7d',MI_RedBrick_Pale:'#d3ac90',MI_Trim:'#e7d3ac',MI_Trim_Green:'#77b9b3',MI_Trim_Dark:'#607d82',MI_Trim_MetalConcrete:'#8da7aa',MI_Ornaments:'#d8c69d'};
function stylize(source:THREE.MeshStandardMaterial):THREE.MeshStandardMaterial {
 const mat=source.clone();mat.vertexColors=false;mat.roughness=.86;mat.metalness=0;mat.roughnessMap=null;mat.metalnessMap=null;mat.aoMap=null;mat.normalScale.setScalar(.28);
 const color=palette[mat.name];if(color)mat.color.lerp(new THREE.Color(color),.5);
 if(mat.name.includes('StreetDecals')){mat.transparent=false;mat.alphaTest=.35;mat.depthWrite=false;mat.polygonOffset=true;mat.polygonOffsetFactor=-1;mat.polygonOffsetUnits=-1;}
 if(mat.name.includes('Glass')){mat.color.set('#6793b6');mat.roughness=.42;mat.opacity=1;mat.transparent=false;mat.depthWrite=true;}
 mat.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',THREE.ShaderChunk.map_fragment.replace('vec4 sampledDiffuseColor = texture2D( map, vMapUv );','vec4 sampledDiffuseColor = texture2D( map, vMapUv, 0.4 );\n sampledDiffuseColor.rgb = mix(vec3(0.64),sampledDiffuseColor.rgb,0.86);'));};
 mat.customProgramCacheKey=()=> 'carlisle-painted-material-v2';
 for(const tex of [mat.map,mat.normalMap])if(tex){tex.userData.shared=true;tex.anisotropy=8;renderer?.initTexture(tex);}
 addCityInstanceNormals(mat);
 return mat;
}
function floatGeometry(source:THREE.BufferGeometry):THREE.BufferGeometry {
 const geometry=source.clone();
 for(const [name,attribute] of Object.entries(geometry.attributes)){
  if(attribute.array instanceof Float32Array && !attribute.normalized)continue;
  const values=new Float32Array(attribute.count*attribute.itemSize);
  for(let i=0;i<attribute.count;i++)for(let c=0;c<attribute.itemSize;c++)values[i*attribute.itemSize+c]=c===0?attribute.getX(i):c===1?attribute.getY(i):c===2?attribute.getZ(i):attribute.getW(i);
  geometry.setAttribute(name,new THREE.Float32BufferAttribute(values,attribute.itemSize));
 }
 return geometry;
}
/** Keep the fitted street markings on flat roads without importing raised curbs. */
function bareRoadParts(parts:Part[],kind:'cityroad2bare'|'cityroad4bare'):Part[] {
 const halfX=CITY_ASSETS[kind].size[0]/2,halfZ=CITY_ASSETS[kind].size[2]/2,result:Part[]=[];
 for(const part of parts){
  const decal=part.material.name.includes('StreetDecals');
  if(part.material.name!=='MI_Asphalt'&&!decal)continue;
  const geometry=part.geometry.clone();geometry.computeBoundingBox();const bounds=geometry.boundingBox!;
  // Quantized edge vertices may differ by fractions of a millimetre. Never
  // pull a sidewalk decal into the driving surface to make a larger part fit.
  if(bounds.min.x<-halfX-.002||bounds.max.x>halfX+.002||bounds.min.z<-halfZ-.002||bounds.max.z>halfZ+.002){geometry.dispose();continue;}
  const position=geometry.getAttribute('position');
  for(let i=0;i<position.count;i++)position.setXYZ(i,THREE.MathUtils.clamp(position.getX(i),-halfX,halfX),decal ? .002 : 0,THREE.MathUtils.clamp(position.getZ(i),-halfZ,halfZ));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.shared=true;result.push({geometry,material:part.material});
 }
 return result;
}
let library:Promise<Map<CityKind,Template>>|null=null;
function loadLibrary():Promise<Map<CityKind,Template>> {
 if(library)return library;
 const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);if(ktx)loader.setKTX2Loader(ktx);
 library=loader.loadAsync(import.meta.env.BASE_URL+'carlisle-kit/city.glb').then(gltf=>{
  gltf.scene.updateMatrixWorld(true);const result=new Map<CityKind,Template>(),materials=new Map<THREE.Material,THREE.MeshStandardMaterial>();
  for(const kind of Object.keys(CITY_MODULES) as CityKind[]){
   const spec=CITY_ASSETS[kind],lo=spec.bounds[0],hi=spec.bounds[1],normalize=new THREE.Matrix4().makeTranslation(-(lo[0]+hi[0])/2,-lo[1],-(lo[2]+hi[2])/2);
   const extract=(suffix:string):Part[]=>{
    const root=gltf.scene.getObjectByName(kind+suffix);if(!root)throw new Error('Missing city module '+kind+suffix);
    const parts:Part[]=[];root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
     const source=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;
     let material=materials.get(source);if(!material){material=stylize(source);materials.set(source,material);}
     if(kind==='citypavementflat'){material=material.clone();material.map=null;material.normalMap=null;material.color.set('#b0b6a9');material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vCityWorld;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvec4 cityWorld=vec4(transformed,1.0);\n#ifdef USE_INSTANCING\ncityWorld=instanceMatrix*cityWorld;\n#endif\nvCityWorld=(modelMatrix*cityWorld).xyz;');shader.fragmentShader='varying vec3 vCityWorld;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nvec2 paver=vCityWorld.xz/vec2(1.25,.8);paver.x+=mod(floor(paver.y),2.0)*.5;vec2 cell=fract(paver);float edge=smoothstep(0.0,.015,min(min(cell.x,1.0-cell.x),min(cell.y,1.0-cell.y)));float variation=fract(sin(dot(floor(paver),vec2(12.9898,78.233)))*43758.5453);diffuseColor.rgb*=mix(.72,.96+variation*.08,edge);');};material.customProgramCacheKey=()=> 'city-world-pavers-v2';material.userData.cityInstanceNormals=false;addCityInstanceNormals(material);}
     const geometry=floatGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld).applyMatrix4(normalize);geometry.computeBoundingBox();geometry.computeBoundingSphere();geometry.userData.shared=true;
     parts.push({geometry,material});
    });return parts;
   };
   result.set(kind,{near:extract('_LOD0'),far:extract('_LOD1')});
  }
  for(const [bare,full] of [['cityroad2bare','cityroad2'],['cityroad4bare','cityroad4']] as const){
   const old=result.get(bare)!,road=result.get(full)!;
   result.set(bare,{near:bareRoadParts(road.near,bare),far:bareRoadParts(road.far,bare)});
   for(const part of [...old.near,...old.far])part.geometry.dispose();
  }
  const taper=transformTaper;const road=result.get('cityroad4')!;result.set('citytaper',{near:road.near.map(p=>({material:p.material,geometry:taper(p.geometry.clone())})),far:road.near.map(p=>({material:p.material,geometry:taper(p.geometry.clone())}))});
  gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)(o as THREE.Mesh).geometry.dispose();});
  return result;
 }).catch(error=>{library=null;throw error;});return library;
}
const extras=new Map<CityKind,Promise<Template>>();
function loadExtra(kind:CityKind):Promise<Template>{
 let value=extras.get(kind);if(value)return value;const spec=CITY_ASSETS[kind];
 value=new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'carlisle-kit/'+spec.file).then(gltf=>{
  gltf.scene.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const matrix=new THREE.Matrix4().makeScale(spec.size[0]/size.x,spec.size[1]/size.y,spec.size[2]/size.z).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
  const parts:Part[]=[];gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;const source=(Array.isArray(mesh.material)?mesh.material[0]:mesh.material) as THREE.MeshStandardMaterial;const geometry=floatGeometry(mesh.geometry).applyMatrix4(mesh.matrixWorld).applyMatrix4(matrix);geometry.userData.shared=true;geometry.computeBoundingSphere();const material=stylize(source);material.emissive.set(0);material.color.set('#ffffff');material.normalScale.setScalar(.25);parts.push({geometry,material});mesh.geometry.dispose();});return {near:parts,far:parts};
 }).catch(e=>{extras.delete(kind);throw e;});extras.set(kind,value);return value;
}
const procedural=new Map<CityKind,Template>();
function box(w:number,h:number,d:number,x:number,y:number,z:number):THREE.BufferGeometry {return new RoundedBoxGeometry(w,h,d,2,Math.min(.035,w*.15,h*.15,d*.15)).translate(x,y,z);}
function cylinder(a:THREE.Vector3,b:THREE.Vector3,r=.05,radial=10):THREE.BufferGeometry {
 const delta=b.clone().sub(a),geometry=new THREE.CylinderGeometry(r,r,delta.length(),radial);geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));return geometry.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);
}
function proceduralTemplate(kind:CityKind):Template {
 const cached=procedural.get(kind);if(cached)return cached;
 const pieces:{g:THREE.BufferGeometry;color:number;emissive?:number}[]=[];
 const add=(g:THREE.BufferGeometry,color:number,emissive?:number)=>pieces.push({g,color,emissive});
 if(kind==='cityretaining'){
  for(let i=0;i<3;i++)add(box(1.98,12.95,.28,-2+i*2,6.5,0),i===1?0x798e99:0x819aa4);
  for(const x of [-2.82,-.98,.98,2.82]){add(box(.09,13,.35,x,6.5,0),0x466475);for(const y of [1.2,4.5,8,11.7])add(new THREE.SphereGeometry(.06,8,6).scale(1,1,.7).translate(x,y,.19),0xb9c5c4);}
 }else if(kind==='citycone'){
  add(box(.64,.1,.64,0,.05,0),0x405267);
  for(let i=0;i<6;i++){const r0=.27-i*.038,r1=r0-.038;add(new THREE.CylinderGeometry(r1,r0,.125,20).translate(0,.16+i*.125,0),i===2||i===3?0xf5dfbc:0xe47740);}
 }else if(kind==='citybarrier'){
  const shape=new THREE.Shape();shape.moveTo(-.32,0);shape.lineTo(.32,0);shape.lineTo(.32,.15);shape.lineTo(.16,.53);shape.lineTo(.12,.86);shape.lineTo(-.12,.86);shape.lineTo(-.16,.53);shape.lineTo(-.32,.15);shape.closePath();
  const g=new THREE.ExtrudeGeometry(shape,{depth:2.94,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2,steps:1});g.rotateY(Math.PI/2);g.translate(-1.47,.025,0);add(g,0xdad0b5);
  for(const x of [-1.05,1.05])add(box(.18,.12,.17,x,.87,0),0xe7ae32,0x5c2d05);
 }else if(kind==='citylamp'){
  add(new THREE.CylinderGeometry(.07,.1,5.5,12).translate(0,2.75,0),0x577b80);add(box(.25,.16,.25,0,.08,0),0x536b76);
  add(cylinder(new THREE.Vector3(0,5.45,0),new THREE.Vector3(.45,5.7,0),.07),0x577b80);add(box(.8,.22,.5,.1,5.77,0),0x577b80);add(box(.65,.07,.39,.1,5.63,0),0xf9e4b2,0x8b6531);
 }else if(kind==='citydeck'){
  add(box(4.5,.16,4.5,0,.1,0),0x4e687b);
  for(let i=0;i<12;i++)add(box(.35,.18,4.42,-2.05+i*.372,.31,0),i%3?0xa6a496:0xc6b795);
  for(const x of [-2.16,2.16])add(box(.12,.3,4.5,x,.2,0),0x5d778a);
 }else if(kind==='cityscaffold'){
  for(const x of [-2,2])for(const z of [-2,2])add(cylinder(new THREE.Vector3(x,0,z),new THREE.Vector3(x,12,z),.09),0x68828c);
  for(let y=0;y<12;y+=3)for(const z of [-2,2]){add(cylinder(new THREE.Vector3(-2,y,z),new THREE.Vector3(2,y+3,z),.055),0x748f95);add(cylinder(new THREE.Vector3(2,y,z),new THREE.Vector3(-2,y+3,z),.055),0x748f95);}
 }else if(kind==='cityfence'){
  for(const x of [-2.95,2.95])add(cylinder(new THREE.Vector3(x,0,0),new THREE.Vector3(x,3,0),.065),0x577984);
  for(const y of [.2,2.85])add(cylinder(new THREE.Vector3(-3,y,0),new THREE.Vector3(3,y,0),.045),0x6e9095);
  // Physical wire lattice, shared once across all instanced safety panels.
  for(let x=-5.5;x<3;x+=.28){const x0=Math.max(-2.9,x),x1=Math.min(2.9,x+2.65);if(x1<=x0)continue;
   add(cylinder(new THREE.Vector3(x0,.2+x0-x,0),new THREE.Vector3(x1,.2+x1-x,0),.007),0x719198);}
  for(let x=-3;x<5.5;x+=.28){const x0=Math.max(-2.9,x-2.65),x1=Math.min(2.9,x);if(x1<=x0)continue;
   add(cylinder(new THREE.Vector3(x0,.2+x-x0,0),new THREE.Vector3(x1,.2+x-x1,0),.007),0x719198);}
 }
 const buckets=new Map<string,THREE.BufferGeometry[]>();
 for(const p of pieces){const key=p.color+':'+(p.emissive??0);const list=buckets.get(key)??[];list.push(p.g.index?p.g.toNonIndexed():p.g);buckets.set(key,list);}
 const parts:Part[]=[];
 for(const [key,geometries] of buckets){const [color,emissive]=key.split(':').map(Number);const geometry=mergeGeometries(geometries)!;geometry.computeBoundingSphere();geometry.userData.shared=true;
  const material=new THREE.MeshStandardMaterial({color,emissive,roughness:.85,metalness:0});
  if(kind==='citybarrier'&&color===0xdad0b5){material.onBeforeCompile=shader=>{shader.vertexShader='varying vec3 vBarrier;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBarrier=position;');shader.fragmentShader='varying vec3 vBarrier;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\nif(abs(vBarrier.z)>.12){float stripe=step(.5,fract((vBarrier.x+vBarrier.y*.7)*1.6));diffuseColor.rgb*=mix(vec3(.91,.88,.74),vec3(.78,.29,.12),stripe);}');};material.customProgramCacheKey=()=> 'city-barrier-stripes-v1';}
  addCityInstanceNormals(material);
  if(kind==='cityretaining')addCityRetainingFade(material);
  parts.push({geometry,material});
 }
 const result={near:parts,far:parts};procedural.set(kind,result);return result;
}
function transformTaper(g:THREE.BufferGeometry):THREE.BufferGeometry {
 const pos=g.getAttribute('position');for(let i=0;i<pos.count;i++){const x=pos.getX(i),z=pos.getZ(i),half=3+(x+3)/2,az=Math.abs(z);pos.setXYZ(i,x*3,pos.getY(i),Math.sign(z)*(az<=6?az*half/6:half+az-6));}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();g.userData.shared=true;return g;
}
export function cityCollisionGeometry(kind:CityKind):THREE.BufferGeometry {
 const spec=CITY_ASSETS[kind];
 if(kind==='citytaper')return transformTaper(cityCollisionGeometry('cityroad4'));
 if(kind==='citydeck')return new THREE.BoxGeometry(4.5,.4,4.5).translate(0,.2,0);
 if(spec.procedural){const parts=proceduralTemplate(kind).near;return mergeGeometries(parts.map(p=>p.geometry.index?p.geometry.toNonIndexed():p.geometry.clone()))!;}
 const data=(collisionData as Record<string,{positions:number[];indices:number[]}>)[kind];if(!data)throw new Error('No city ground geometry: '+kind);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data.positions,3));g.setIndex(data.indices);
 g.translate(-(spec.bounds[0][0]+spec.bounds[1][0])/2,-spec.bounds[0][1],-(spec.bounds[0][2]+spec.bounds[1][2])/2);g.computeVertexNormals();return g;
}
interface Bucket {kind:CityKind;cutaway:boolean;matrices:THREE.Matrix4[];colors:THREE.Color[];}
/** City streets are static; reject distant rays before entering each tile's BVH. */
export function accelerateCityGround(mesh:THREE.Mesh):void {
 if(!mesh.userData.cityAsset)return;
 const exact=mesh.raycast,bounds=new THREE.Box3(),matrix=new THREE.Matrix4(),target=new THREE.Vector3();
 mesh.geometry.computeBoundingBox();matrix.copy(mesh.matrixWorld);bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(matrix);
 mesh.raycast=function(ray,hits){
  if(!matrix.equals(this.matrixWorld)){matrix.copy(this.matrixWorld);bounds.copy(this.geometry.boundingBox!).applyMatrix4(matrix);}
  const r=ray.ray;
  if(r.direction.x===0&&r.direction.z===0){if(r.origin.x<bounds.min.x||r.origin.x>bounds.max.x||r.origin.z<bounds.min.z||r.origin.z>bounds.max.z)return;}
  else if(!r.intersectBox(bounds,target))return;
  exact.call(this,ray,hits);
 };
}
export class CityAssetKit {
 readonly root=new THREE.Group();readonly errors:string[]=[];private buckets=new Map<string,Bucket>();private jobs:Promise<void>[]=[];private disposed=false;private count=0;private loaded=0;private loose=new Set<THREE.Group>();private ownedMaterials=new Set<THREE.Material>();
 constructor(private batched=true){this.root.name='Carlisle Coast city kit';}
 add(c:CityPlacement,centered=false):THREE.Group|null {
  const matrix=cityMatrix(c,centered);this.count++;
  if(this.batched){const key=c.dkind+':'+Math.floor(c.p[0]/48)+':'+Math.floor(c.p[2]/48)+':'+(c.cameraCutaway?'cutaway':'solid');let bucket=this.buckets.get(key);if(!bucket){bucket={kind:c.dkind,cutaway:!!c.cameraCutaway,matrices:[],colors:[]};this.buckets.set(key,bucket);}bucket.matrices.push(matrix);bucket.colors.push(new THREE.Color(c.color??'#ffffff'));return null;}
  return this.addLoose(this.root,c,matrix);
 }
 /** Dress a moving gameplay object in its local coordinates without replacing its collider. */
 attach(parent:THREE.Object3D,placement:CityPlacement):void {
  this.count++;this.addLoose(parent,placement,cityMatrix(placement));
 }
 private addLoose(parent:THREE.Object3D,c:CityPlacement,matrix:THREE.Matrix4):THREE.Group {
  const holder=new THREE.Group();holder.name=CITY_ASSETS[c.dkind].label;holder.position.fromArray(c.p);holder.userData.editorIdx=parent.userData.editorIdx;parent.add(holder);this.loose.add(holder);
  this.jobs.push(this.template(c.dkind).then(template=>{if(this.disposed)return;const inverse=new THREE.Matrix4().makeTranslation(-c.p[0],-c.p[1],-c.p[2]);
   for(const part of template.near){const material=part.material.clone();material.onBeforeCompile=part.material.onBeforeCompile;material.customProgramCacheKey=part.material.customProgramCacheKey;material.color.multiply(new THREE.Color(c.color??'#ffffff'));this.ownedMaterials.add(material);const m=new THREE.Mesh(part.geometry,material);m.matrix.copy(inverse).multiply(matrix);m.matrixAutoUpdate=false;m.castShadow=m.receiveShadow=true;m.userData.editorIdx=holder.userData.editorIdx;holder.add(m);}this.loaded++;
  }).catch(e=>this.failed(c.dkind,e)));return holder;
 }
 private template(kind:CityKind):Promise<Template>{return CITY_ASSETS[kind].file?loadExtra(kind):CITY_ASSETS[kind].procedural?Promise.resolve(proceduralTemplate(kind)):loadLibrary().then(l=>l.get(kind)!);}
 flush():void {
  for(const bucket of this.buckets.values())this.jobs.push(this.template(bucket.kind).then(template=>{if(this.disposed)return;
   const center=new THREE.Vector3();for(const m of bucket.matrices)center.add(new THREE.Vector3().setFromMatrixPosition(m));center.multiplyScalar(1/bucket.matrices.length);
   const inverse=new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z),lod=new THREE.LOD(),bounds=new THREE.Box3();lod.position.copy(center);lod.name=CITY_ASSETS[bucket.kind].label;
   const build=(parts:Part[])=>{const group=new THREE.Group();for(const part of parts){const m=new THREE.InstancedMesh(part.geometry,part.material,bucket.matrices.length);bucket.matrices.forEach((matrix,i)=>{m.setMatrixAt(i,inverse.clone().multiply(matrix));m.setColorAt(i,bucket.colors[i]);});m.computeBoundingBox();
    // A sphere transformed by max-axis scale can under-bound a graded instance.
    // The transformed box encloses all instances, including their full descent.
    m.boundingSphere=m.boundingBox!.getBoundingSphere(new THREE.Sphere());bounds.union(m.boundingBox!);m.updateMatrix();m.matrixAutoUpdate=false;m.castShadow=m.receiveShadow=true;m.userData.cityAsset=bucket.kind;group.add(m);}return group;};
   lod.addLevel(build(template.near),0);if(template.far!==template.near)lod.addLevel(build(template.far),130,.15);lod.userData.cityBounds=bounds.translate(center);lod.userData.cameraCutaway=bucket.cutaway;lod.updateMatrix();lod.matrixAutoUpdate=false;this.root.add(lod);this.loaded+=bucket.matrices.length;
  }).catch(e=>this.failed(bucket.kind,e)));this.buckets.clear();
 }
 private failed(kind:CityKind,error:unknown):void {if(this.disposed||this.errors.includes(kind))return;this.errors.push(kind);if((error as {response?:{url?:string}}).response?.url!=='')console.error('City asset failed: '+kind,error);}
 updateVisibility(position:THREE.Vector3,sideScroll=false):void {
  if(!this.batched)return;
  for(const group of this.root.children){const box=group.userData.cityBounds as THREE.Box3|undefined;if(!box)continue;const dx=Math.max(box.min.x-position.x,0,position.x-box.max.x),dz=Math.max(box.min.z-position.z,0,position.z-box.max.z);group.visible=dx*dx+dz*dz<285*285&&!(sideScroll&&group.userData.cameraCutaway);}
 }
 async ready():Promise<void>{await Promise.all(this.jobs);}
 get diagnostics(){return {placements:this.count,ready:this.loaded,errors:[...this.errors]};}
 dispose():void {this.disposed=true;this.root.traverse(o=>{if((o as THREE.InstancedMesh).isInstancedMesh)(o as THREE.InstancedMesh).dispose();});this.root.removeFromParent();this.root.clear();for(const holder of this.loose){holder.removeFromParent();holder.clear();}this.loose.clear();for(const m of this.ownedMaterials)m.dispose();this.ownedMaterials.clear();this.buckets.clear();}
}

/** The skate contact layer rides 9 cm above a rail's authored centreline. */
export const CITY_RAIL_TOP = .09;
export const CITY_BEAM_WIDTH = .18; // fits between the default board's wheel inner faces
export const CITY_BEAM_DEPTH = .56;
/** Use an upright frame in every direction, including almost-opposite -Z slopes. */
export function cityRailFrame(tangent:THREE.Vector3):THREE.Matrix4 {
 const forward=tangent.clone().normalize(),right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,1,0),forward);
 if(right.lengthSq()<1e-10)right.set(1,0,0);else right.normalize();
 const up=new THREE.Vector3().crossVectors(forward,right).normalize();
 return new THREE.Matrix4().makeBasis(right,up,forward);
}
/** The top flange shares the exact surface used by the skater's truck/deck contact. */
export function cityRailVisual(points:readonly THREE.Vector3[],cable=false):THREE.Group {
 const group=new THREE.Group(),pieces:THREE.BufferGeometry[]=[];
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i],delta=b.clone().sub(a),length=delta.length();if(length<.001)continue;
  if(cable)pieces.push(cylinder(a,b,CITY_RAIL_TOP,32));
  else {
   const frame=cityRailFrame(delta),mid=a.clone().add(b).multiplyScalar(.5);
   frame.setPosition(mid);
   // Rounded running edge leaves room for Smith/Feeble deck overhangs and
   // crooked-grind wheels; the supported point remains exactly at +.09 m.
   const crest=new THREE.Shape(),radius=CITY_BEAM_WIDTH/2,crestBase=-.025;
   crest.moveTo(-radius,crestBase);crest.lineTo(radius,crestBase);crest.lineTo(radius,0);
   for(let j=1;j<=24;j++){const a=j*Math.PI/24;crest.lineTo(radius*Math.cos(a),CITY_RAIL_TOP*Math.sin(a));}
   crest.closePath();
   const cap=new THREE.ExtrudeGeometry(crest,{depth:length,steps:1,bevelEnabled:false});cap.translate(0,0,-length/2);pieces.push(cap.applyMatrix4(frame));
   const flange=.065,bottom=CITY_RAIL_TOP-CITY_BEAM_DEPTH,web=crestBase-(bottom+flange);
   for(const [width,height,y] of [[.07,web,(crestBase+bottom+flange)/2],[CITY_BEAM_WIDTH,flange,bottom+flange/2]])pieces.push(box(width,height,length,0,y,0).applyMatrix4(frame));
  }
 }
 const geometry=mergeGeometries(pieces.map(g=>g.index?g.toNonIndexed():g))!;
 geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const mat=new THREE.MeshStandardMaterial({color:cable?0x334a60:0x678fa8,metalness:.25,roughness:.55});
 const mesh=new THREE.Mesh(geometry,mat);mesh.name=cable?'grind cable':'upright grind beam';mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return group;
}
