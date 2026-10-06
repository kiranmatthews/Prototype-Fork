import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { sceneryTextureLoader } from './sceneryTextureLoader';
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { addCarlisleMaterialLook,addCarlisleGrassLook } from "./carlislePresentation";
import { CARLISLE_ASSETS } from "./carlisleAssets";
import { JUNGLE_MODULES } from "./jungleModules";
import { MAP_MODULES } from "./mapModules";
import { clayArchGeometry, createClayPlantGeometry, isClayPlant } from "./mapClayGeometry";
import { NIGHTWORKS_MODULES } from "./nightworksModules";
import { JUNGLE_EDITOR_ASSETS } from "./jungleEditorAssets";
import { isJungleAssembly, jungleAssemblyParts, type JunglePartKind } from "./jungleAssemblies";
import { addJungleDepthFade } from "./jungleGround";
import { AssetCache, disposeTextures } from "./assetLifetime";
import { sceneryLoads } from "./assetLoadQueue";
import { addTreehouseTrialsMaterialLook } from "./treehouseTrialsPresentation";

export interface JungleAssetSpec {
  file: string; label: string; size: readonly [number,number,number]; wind: boolean;
  normalStrength?: number; lod?: boolean;
  /** Carlisle alone uses authored low geometry beyond the close view. */
  distanceLod?: boolean;
  doubleSided?: boolean;
  backdrop?: boolean;
  clay?: boolean;
  /** Painted scenery cards share the kit's cache, instancing and editor path. */
  matte?: boolean;
  /** New forest layers participate in the scene atmosphere. */
  fog?: boolean;
  image?: string;
  /** Portable full-resolution image when GPU compression is unavailable. */
  imageFallback?: string;
  alphaCutout?: boolean;
  edgeFade?: number;
  windowGlow?: boolean;
  /** Soft additive environmental light card; shares the ordinary decor path. */
  shaft?: boolean;
  /** Attachment mask comes from the source mesh; billow only in local Y. */
  cloth?: boolean;
}
const TREEHOUSE_TRIALS_V2_ASSETS = {
  trialsv2treea:{file:"../treehouse-trials-v2/tree-a",label:"Treehouse Trials broad ancient tree A",size:[26,24,20],wind:true,normalStrength:.09,lod:true,distanceLod:true,doubleSided:false},
  trialsv2treeb:{file:"../treehouse-trials-v2/tree-b",label:"Treehouse Trials broad ancient tree B",size:[26,24,20],wind:true,normalStrength:.09,lod:true,distanceLod:true,doubleSided:false},
  trialsv2crowna:{file:"../treehouse-trials-v2/crown-a",label:"Treehouse Trials loose leaf crown A",size:[26,11,22],wind:true,normalStrength:.07,lod:true,distanceLod:true,doubleSided:false},
  trialsv2crownb:{file:"../treehouse-trials-v2/crown-b",label:"Treehouse Trials loose leaf crown B",size:[26,11,22],wind:true,normalStrength:.07,lod:true,distanceLod:true,doubleSided:false},
  trialsv2groundcovera:{file:"../treehouse-trials-v2/groundcover-a",label:"Treehouse Trials low forest carpet A",size:[5,1.2,3],wind:true,normalStrength:.08,lod:true,distanceLod:true,doubleSided:false},
  trialsv2groundcoverb:{file:"../treehouse-trials-v2/groundcover-b",label:"Treehouse Trials low forest carpet B",size:[5,1.2,3],wind:true,normalStrength:.08,lod:true,distanceLod:true,doubleSided:false},
  trialsv2ferna:{file:"../treehouse-trials-v2/fern-a",label:"Treehouse Trials broad fern A",size:[3,2,3],wind:true,normalStrength:.08,lod:true,distanceLod:true,doubleSided:false},
  trialsv2fernb:{file:"../treehouse-trials-v2/fern-b",label:"Treehouse Trials broad fern B",size:[3,2,3],wind:true,normalStrength:.08,lod:true,distanceLod:true,doubleSided:false},
  trialsv2earthbanka:{file:"../treehouse-trials-v2/earthbank-a",label:"Treehouse Trials mossy earth bank A",size:[8,2.5,4],wind:true,normalStrength:.13,lod:true,distanceLod:true,doubleSided:false},
  trialsv2earthbankb:{file:"../treehouse-trials-v2/earthbank-b",label:"Treehouse Trials mossy earth bank B",size:[8,2.5,4],wind:true,normalStrength:.13,lod:true,distanceLod:true,doubleSided:false},
  trialsv2riverstonea:{file:"../treehouse-trials-v2/riverstone-a",label:"Treehouse Trials broad river stone A",size:[5,.7,4],wind:false,normalStrength:.1,lod:true,doubleSided:false},
  trialsv2riverstoneb:{file:"../treehouse-trials-v2/riverstone-b",label:"Treehouse Trials broad river stone B",size:[5,.7,4],wind:false,normalStrength:.1,lod:true,doubleSided:false},
  trialsv2riverstonec:{file:"../treehouse-trials-v2/riverstone-c",label:"Treehouse Trials broad river stone C",size:[5,.7,4],wind:false,normalStrength:.1,lod:true,doubleSided:false},
  trialsv2cavewalla:{file:"../treehouse-trials-v2/cavewall-a",label:"Treehouse Trials layered cave wall A",size:[12,10,6],wind:false,normalStrength:.13,lod:true,doubleSided:false},
  trialsv2cavewallb:{file:"../treehouse-trials-v2/cavewall-b",label:"Treehouse Trials layered cave wall B",size:[12,10,6],wind:false,normalStrength:.13,lod:true,doubleSided:false},
  trialsv2caveroofa:{file:"../treehouse-trials-v2/caveroof-a",label:"Treehouse Trials broad cave roof A",size:[18,5,8],wind:false,normalStrength:.13,lod:true,doubleSided:false},
  trialsv2caveroofb:{file:"../treehouse-trials-v2/caveroof-b",label:"Treehouse Trials broad cave roof B",size:[18,5,8],wind:false,normalStrength:.13,lod:true,doubleSided:false},
  trialsv2rockstepsa:{file:"../treehouse-trials-v2/rocksteps-a",label:"Treehouse Trials rounded rock climb A",size:[7,2.5,8],wind:false,normalStrength:.12,lod:true,doubleSided:false},
  trialsv2rockstepsb:{file:"../treehouse-trials-v2/rocksteps-b",label:"Treehouse Trials rounded rock climb B",size:[7,2.5,8],wind:false,normalStrength:.12,lod:true,doubleSided:false},
  trialsv2halfpipeend:{file:"../treehouse-trials-v2/halfpipe-end",label:"Treehouse Trials halfpipe timber frame",size:[8,4,2.5],wind:false,normalStrength:.1,lod:true,doubleSided:false},
  trialsv2plank:{file:"../treehouse-trials-v2/plank",label:"Treehouse Trials worn timber plank",size:[5,.18,.35],wind:false,normalStrength:.08,lod:true,doubleSided:false},
  trialsv2beam:{file:"../treehouse-trials-v2/beam",label:"Treehouse Trials hand-hewn beam",size:[4,.35,.35],wind:false,normalStrength:.08,lod:true,doubleSided:false},
  trialsv2porchhut:{file:"../treehouse-trials-v2/porchhut",label:"Treehouse Trials warm layered porch hut",size:[8,5.5,7],wind:false,normalStrength:.1,lod:true,doubleSided:false,windowGlow:true},
  trialsv2crabshack:{file:"../treehouse-trials-v2/crabshack",label:"Treehouse Trials coastal crab shack",size:[10,8,9],wind:false,normalStrength:.1,lod:true,doubleSided:false,windowGlow:true},
  trialsv2awning:{file:"../treehouse-trials-v2/awning",label:"Treehouse Trials frayed coral cloth awning",size:[4.5,.5,2.2],wind:true,normalStrength:.06,lod:true,doubleSided:true,cloth:true},
  trialsv2waterreflection:{file:"",image:"treehouse-trials-v2/forest-water-probe.ktx2",imageFallback:"treehouse-trials-v2/forest-water-probe.webp",label:"Treehouse Trials forest water reflection",size:[120,60,.02],wind:false,matte:true},
} as const;
const ASSETS = {
  trialsv3thicket:{file:'../treehouse-trials-v3/understory-thicket',label:'Dense rooted jungle thicket',size:[8,4.7,5.2],wind:true,normalStrength:.07,lod:true,distanceLod:true,doubleSided:false},
  trialsv3bough:{file:'../treehouse-trials-v3/canopy-bough',label:'Layered hanging jungle bough',size:[15,5.8,7],wind:true,normalStrength:.08,lod:true,distanceLod:true,doubleSided:false},
  trialsv3understorymatte:{file:'',image:'treehouse-trials-v3/understory-matte.ktx2',imageFallback:'treehouse-trials-v3/understory-matte.webp',label:'Dense overlapping jungle understory matte',size:[64,21.333,.02],wind:false,matte:true,edgeFade:.04,fog:true},
  treehouserepairgrove:{file:'',image:'treehouse-repair/grove.ktx2',imageFallback:'treehouse-repair/grove.webp',label:'Complete Treehouse midground grove',size:[72,30.074,.02],wind:false,matte:true,edgeFade:.025,fog:true},
  treehouserepairridge:{file:'',image:'treehouse-repair/ridge.ktx2',imageFallback:'treehouse-repair/ridge.webp',label:'Layered Treehouse canopy ridge',size:[126,52.63,.02],wind:false,matte:true,edgeFade:.025,fog:true},
  treehouserepairvines:{file:'',image:'treehouse-repair/cave.ktx2',imageFallback:'treehouse-repair/cave.webp',label:'Layered cavern vine curtain',size:[30,12.53,.02],wind:false,matte:true,edgeFade:.025,fog:true},
  ...CARLISLE_ASSETS,
  ...JUNGLE_MODULES,
  ...MAP_MODULES,
  ...NIGHTWORKS_MODULES,
  ...JUNGLE_EDITOR_ASSETS,
  ...TREEHOUSE_TRIALS_V2_ASSETS,
  treehousebody: {file:"../treehouse-trail/body-v2",label:"Detailed treehouse cabin body",size:[7,5.2,5.5],wind:false,normalStrength:0.14,lod:true,doubleSided:false,windowGlow:true},
  treehousehost: {file:"../treehouse-trail/host",label:"Treehouse supporting trunk and boughs",size:[15.5,15,10],wind:false,normalStrength:0.18,lod:true,doubleSided:false},
  treehousebalconydeck: {file:"../treehouse-trail/balcony-deck",label:"Treehouse balcony deck without rails",size:[14.5,0.35,3],wind:false,normalStrength:0.14,lod:true,doubleSided:false},
  treehousecanopy: {file:"../treehouse-trail/canopy",label:"Separate treehouse crown",size:[28,10,22],wind:true,normalStrength:0.08,lod:true,doubleSided:false},
  treehousebalcony: {file:"../treehouse-trail/balcony",label:"Treehouse balcony",size:[8,1.5,3],wind:false,normalStrength:0.18,lod:true,doubleSided:false},
  treehousestairs: {file:"../treehouse-trail/stairs",label:"Treehouse stair flight",size:[3,2.25,5.5],wind:false,normalStrength:0.18,lod:true,doubleSided:false},
  treehouselanding: {file:"../treehouse-trail/landing",label:"Treehouse landing",size:[3.5,0.35,3.5],wind:false,normalStrength:0.18,lod:true,doubleSided:false},
  treehousetree: {file:"../treehouse-trail/tree",label:"Treehouse ancient canopy tree",size:[22,20,17],wind:true,normalStrength:0.12,lod:true,doubleSided:false},
  treehousebush: {file:"../treehouse-trail/bush",label:"Treehouse lush bush cluster",size:[5,2.8,4.5],wind:true,normalStrength:0.12,lod:true,doubleSided:false},
  treehousemattefar: {file:"",image:"treehouse-trail/matte-far.png",label:"Treehouse distant painted jungle",size:[120,50,.02],wind:false,matte:true},
  treehousemattemid: {file:"",image:"treehouse-trail/matte-mid.png",label:"Treehouse painted forest layer",size:[85,38,.02],wind:false,matte:true,alphaCutout:true,edgeFade:0.1},
  treehousecavearch: {file:"../treehouse-trials/cavearch",label:"Treehouse Trials natural cave arch",size:[14,10,5],wind:false,normalStrength:0.2,lod:true,doubleSided:false},
  treehousecavewall: {file:"../treehouse-trials/cavewall",label:"Treehouse Trials mossy cave wall",size:[12,10,6],wind:false,normalStrength:0.2,lod:true,doubleSided:false},
  treehouserocksteps: {file:"../treehouse-trials/rocksteps",label:"Treehouse Trials broad rock steps",size:[6,2.5,7],wind:false,normalStrength:0.18,lod:true,doubleSided:false},
  treehouseporchhut: {file:"../treehouse-trials/porchhut",label:"Treehouse Trials coastal porch hut",size:[7,5,6],wind:false,normalStrength:0.16,lod:true,doubleSided:false,windowGlow:true},
  treehousecrabshack: {file:"../treehouse-trials/crabshack",label:"Treehouse Trials painted crab shack",size:[9,7,8],wind:false,normalStrength:0.16,lod:true,doubleSided:false,windowGlow:true},
  treehousesugarcane: {file:"../treehouse-trials/sugarcane",label:"Treehouse Trials sugar cane clump",size:[4,5,3],wind:true,normalStrength:0.1,lod:true,doubleSided:true},
  treehousebridgeend: {file:"../treehouse-trials/bridgeend",label:"Treehouse Trials broken bridge abutment",size:[7,2.5,4],wind:false,normalStrength:0.16,lod:true,doubleSided:false},
  treehousemossrock: {file:"../treehouse-trials/boulder",label:"Treehouse Trials broad mossy rock",size:[5,3,4],wind:false,normalStrength:0.18,lod:true,doubleSided:false},
  treehousetrialsforestmatte: {file:"",image:"treehouse-trials/forest-depth-alpha.ktx2",imageFallback:"treehouse-trials/forest-depth-alpha.webp",label:"Treehouse Trials transparent layered forest depth",size:[150,65,.02],wind:false,matte:true,edgeFade:0.14},
  treehousetrialscoastmatte: {file:"",image:"treehouse-trials/coast-depth-alpha.ktx2",imageFallback:"treehouse-trials/coast-depth-alpha.webp",label:"Treehouse Trials distant coast",size:[150,65,.02],wind:false,matte:true,edgeFade:0.12},
  treehousetrialscavematte: {file:"",image:"treehouse-trials/cavern-depth.ktx2",imageFallback:"treehouse-trials/cavern-depth.webp",label:"Treehouse Trials cavern depth",size:[65,36,.02],wind:false,matte:true,edgeFade:0.08},
  treehousetrialssunshaft: {file:"",label:"Treehouse Trials soft cavern light shaft",size:[3,14,.02],wind:false,shaft:true},
  junglecliff: {file:"",label:"jungle cliff face",size:[28,32,30],wind:false,backdrop:true},
  junglebackdrop: {file:"",label:"outer jungle canopy",size:[42,44,40],wind:false,backdrop:true},
  jungleleaf: {file:"broadleaf",label:"jungle broadleaf",size:[4.2,2.6,4.2],wind:true},
  junglefern: {file:"fern",label:"jungle fern",size:[4.4,1.8,4],wind:true},
  junglepalmtree: {file:"palm",label:"jungle palm",size:[8.5,11,8.2],wind:true},
  junglevine: {file:"",label:"hanging jungle vine",size:[4,3,1],wind:true},
  templeplatform: {file:"",label:"temple platform",size:[4,2,4],wind:false},
  templewall: {file:"",label:"temple wall",size:[6,5,1.4],wind:false},
  roofedtemple: {file:"",label:"modular roofed temple",size:[14,13,12],wind:false},
  hangingarch: {file:"",label:"modular hanging arch",size:[20,13,2.8],wind:false},
  carvedlog: {file:"log",label:"carved jungle log",size:[8,1.1,1.3],wind:false},
  thornroots: {file:"thorns",label:"pit thorn roots",size:[4.8,2,4.8],wind:false},
} as const;
export type JungleAssetKind = keyof typeof ASSETS;
export const JUNGLE_ASSETS: Readonly<Record<JungleAssetKind,JungleAssetSpec>> = ASSETS;
export const JUNGLE_ASSET_KINDS = Object.keys(ASSETS) as JungleAssetKind[];
export const JUNGLE_ASSET_LABELS = Object.fromEntries(JUNGLE_ASSET_KINDS.map(k=>[k,JUNGLE_ASSETS[k].label])) as Record<JungleAssetKind,string>;
export function isJungleAsset(kind:string|undefined):kind is JungleAssetKind {return !!kind&&Object.prototype.hasOwnProperty.call(ASSETS,kind);}
export interface JunglePlacement {
  dkind:JungleAssetKind;p:[number,number,number];s?:[number,number,number];w?:number;
  yaw?:number;amp?:number;color?:string;vr?:number;seed?:number;cameraCutaway?:boolean;castShadow?:boolean;
}
export function jungleAssetMatrix(c:JunglePlacement):THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(...c.p),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0,THREE.MathUtils.degToRad(c.yaw??0),THREE.MathUtils.degToRad(c.amp??0),"YXZ")),
    new THREE.Vector3(...(c.s??JUNGLE_ASSETS[c.dkind].size)).multiplyScalar(c.w??1));
}

type RenderKind = JungleAssetKind | JunglePartKind;
export interface Template {
  geometry:THREE.BufferGeometry;lodGeometry?:THREE.BufferGeometry;map:THREE.Texture|null;
  normalMap?:THREE.Texture|null;roughnessMap?:THREE.Texture|null;
}
function disposeTemplate(template:Template,kind:RenderKind):void {
  // This view borrows the canopy's resources through its dependency lease.
  if(kind==='junglebackdrop')return;
  for(const geometry of new Set([template.geometry,template.lodGeometry]))geometry?.dispose();
  if(kind!=='treehousecanopy')disposeTextures([template.map,template.normalMap,template.roughnessMap].filter((t):t is THREE.Texture=>!!t));
}
const templates=new AssetCache<RenderKind,Template>(createTemplate,disposeTemplate);
export const createJungleAssetScope=()=>templates.scope();
let compressedLoader:KTX2Loader|null=null;
const matteFallbackWarnings=new Set<RenderKind>();
const atlasFallbackWarnings=new Set<RenderKind>();
export function configureJungleAssetRenderer(renderer:THREE.WebGLRenderer,loader?:KTX2Loader):void {
  if(!compressedLoader)compressedLoader=loader??sceneryTextureLoader(renderer);
}
function renderSpec(kind:RenderKind):JungleAssetSpec {
  if(kind==="joint")return {file:"",label:"recessed masonry joints",size:[1,1,1],wind:false};
  if(kind==="earth")return {file:"",label:"earth bedding",size:[1,1,1],wind:false};
  if(kind==="vine")return JUNGLE_ASSETS.junglevine;
  return JUNGLE_ASSETS[kind];
}
function vineGeometry():THREE.BufferGeometry {
  const curve=new THREE.CatmullRomCurve3(Array.from({length:13},(_,i)=>{const x=i/12-.5;return new THREE.Vector3(x,4*x*x,Math.sin(i*.8)*.018);}));
  const pieces:THREE.BufferGeometry[]=[new THREE.TubeGeometry(curve,36,.012,5,false)];
  for(let i=0;i<9;i++) {
    const at=curve.getPoint((i+.5)/9),side=i%2?-1:1;
    const shape=new THREE.Shape();shape.moveTo(0,0);shape.quadraticCurveTo(.12,.035,.12,.14);shape.quadraticCurveTo(.015,.13,0,0);
    const leaf=new THREE.ShapeGeometry(shape,3);leaf.rotateZ(side*.65);leaf.rotateY(side*.6);leaf.translate(at.x,at.y-.1,at.z);pieces.push(leaf);
  }
  for(const [i,g] of pieces.entries()) {
    const n=g.attributes.position.count,color=new THREE.Color(i?0x83ae48:0x426331),colors=new Float32Array(n*3);
    for(let v=0;v<n;v++)color.toArray(colors,v*3);
    g.setAttribute("color",new THREE.BufferAttribute(colors,3));
  }
  const normalized=pieces.map(g=>g.index?g.toNonIndexed():g);
  const result=mergeGeometries(normalized)!;
  for(const g of new Set([...pieces,...normalized]))g.dispose();
  return result;
}
function finishGeometry(geometry:THREE.BufferGeometry,kind:RenderKind):THREE.BufferGeometry {
  const positions=geometry.attributes.position,flex=new Float32Array(positions.count),ao=new Float32Array(positions.count);
  const authoredFlex=geometry.attributes._wind_flex,authoredAO=geometry.attributes._jungle_ao;
  for(let i=0;i<positions.count;i++){
    const value=authoredAO?.getX(i)??1;ao[i]=Number.isFinite(value)?THREE.MathUtils.clamp(value,.2,1):1;
  }
  if(renderSpec(kind).wind)for(let i=0;i<positions.count;i++) {
    const y=positions.getY(i),radial=Math.hypot(positions.getX(i),positions.getZ(i));
    const sourceFlex=authoredFlex?.getX(i);
    flex[i]=sourceFlex!==undefined?Number.isFinite(sourceFlex)?THREE.MathUtils.clamp(sourceFlex,0,1)*(renderSpec(kind).cloth?1:THREE.MathUtils.smoothstep(y,0,.035)):0
      :geometry.hasAttribute('aClayLeaf')?geometry.attributes.aClayLeaf.getX(i):kind==="vine"||kind==="junglevine"?Math.max(0,1-y):kind==="junglepalmtree"
      ?Math.pow(THREE.MathUtils.smoothstep(y,.48,1),1.2)*.6+y*y*.08
      :kind==="treehousetree"?Math.pow(THREE.MathUtils.smoothstep(y,.42,.86),1.5)*.34
      :kind==="treehousesugarcane"?Math.pow(THREE.MathUtils.smoothstep(y,.02,.98),1.7)*.72
      :Math.min(1,Math.pow(radial*1.6+y*.45,1.5))*THREE.MathUtils.smoothstep(y,0,.12);
  }
  geometry.setAttribute("aJungleFlex",new THREE.BufferAttribute(flex,1));
  geometry.setAttribute("aJungleAO",new THREE.BufferAttribute(ao,1));
  geometry.deleteAttribute('_wind_flex');geometry.deleteAttribute('_jungle_ao');
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const margin=renderSpec(kind).cloth ? .3 : renderSpec(kind).wind ? .085 : .002;
  geometry.boundingBox!.expandByScalar(margin);geometry.boundingSphere!.radius+=margin;
  geometry.userData.shared=true;return geometry;
}
function hasAssetLod(mesh:THREE.Object3D,lod:0|1):boolean {
  for(let node:THREE.Object3D|null=mesh;node;node=node.parent)if(node.name.endsWith(`LOD${lod}`))return true;
  return false;
}
/** A generated asset may arrive as several primitives beneath its LOD node.
 * Preserve every primitive rather than silently rendering the first mesh. */
function combineAssetMeshes(meshes:THREE.Mesh[],kind:RenderKind):THREE.BufferGeometry {
  const parts=meshes.map(mesh=>mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
  if(parts.length===1)return parts[0];
  const merged=mergeGeometries(parts,false);
  for(const part of parts)part.dispose();
  if(!merged)throw new Error(`Jungle asset ${kind} has incompatible mesh attributes; export one atlas mesh per LOD`);
  return merged;
}
function createTemplate(kind:RenderKind,dependency:(kind:RenderKind)=>Promise<Template>,wanted:()=>boolean):Promise<Template> {
  const spec=renderSpec(kind);
  if(spec.shaft){
    const geometry=new THREE.PlaneGeometry(1,1).translate(0,.5,0);
    geometry.setAttribute('aJungleShaftUv',geometry.attributes.uv);
    return Promise.resolve({geometry:finishGeometry(geometry,kind),map:null});
  }
  if(spec.matte && spec.image){
    // The plane is already normalized in X/Y, bottom-anchored, facing +Z.
    // Skip GLB bounds normalization: a genuine flat card has zero Z extent.
    const geometry=finishGeometry(new THREE.PlaneGeometry(1,1).translate(0,.5,0),kind);
    const fallback=()=>new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+(spec.imageFallback??spec.image));
    const pending=sceneryLoads.run(()=>spec.imageFallback&&compressedLoader
      ?compressedLoader.loadAsync(import.meta.env.BASE_URL+spec.image).catch(error=>{
        if(!wanted())throw error;
        if(!matteFallbackWarnings.has(kind)){
          matteFallbackWarnings.add(kind);
          console.warn(`Jungle matte ${kind} compressed texture unavailable; loading its portable image.`);
        }
        return fallback();
      }):fallback(),wanted).then(map=>{
      map.colorSpace=THREE.SRGBColorSpace;map.anisotropy=4;map.userData.shared=true;
      if(kind==='trialsv2waterreflection')map.wrapS=THREE.RepeatWrapping;
      return {geometry,map};
    }).catch(error=>{geometry.dispose();throw error;});
    return pending;
  }
  if(isClayPlant(kind)){
    const pending=Promise.resolve({geometry:finishGeometry(createClayPlantGeometry(kind),kind),lodGeometry:finishGeometry(createClayPlantGeometry(kind,true),kind),map:null});
    return pending;
  }
  if(kind==='maparch'){
    const pending=Promise.resolve({geometry:finishGeometry(clayArchGeometry(),kind),lodGeometry:finishGeometry(clayArchGeometry(true),kind),map:null});
    return pending;
  }
  if(kind==="junglebackdrop") {
    const pending=dependency("junglecanopy").then(source=>({...source,
      geometry:source.lodGeometry??source.geometry,lodGeometry:undefined}));
    return pending;
  }
  if(kind==="junglecliff") {
    const geometry=new THREE.IcosahedronGeometry(1,1);
    const pos=geometry.attributes.position,colors=new Float32Array(pos.count*3);
    for(let i=0;i<pos.count;i++) {
      const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i);
      pos.setXYZ(i,x*(.9+.1*Math.cos(y*5))+.065*y,(y+1)*.5,z*(.9+.08*Math.sin(y*4+.7)));
      new THREE.Color('#69816c').lerp(new THREE.Color('#a8b39c'),(y+1)*.5).toArray(colors,i*3);
    }
    geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    geometry.translate(-center.x,-bounds.min.y,-center.z);geometry.scale(1/size.x,1/size.y,1/size.z);
    geometry.computeVertexNormals();geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    const pending=Promise.resolve({geometry:finishGeometry(geometry,kind),map:null});
    return pending;
  }
  if(kind==="joint"||kind==="earth"||kind==="vine"||kind==="junglevine") {
    const geometry=kind==="joint"||kind==="earth"?new THREE.BoxGeometry(1,1,1).translate(0,.5,0):vineGeometry();
    const map=kind==="earth"?new THREE.TextureLoader().load(import.meta.env.BASE_URL+"jungle-kit/dirt.jpg"):null;
    if(map){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.userData.shared=true;map.anisotropy=8;}
    return Promise.resolve({geometry:finishGeometry(geometry,kind),map});
  }
  // The separated crown contains byte-identical tree atlases. Borrow them
  // before decoding/uploading, retaining the tree until this crown is gone.
  // Resolve the shared donor BEFORE reserving a decode slot, so dependencies
  // cannot fill the queue with parents waiting for children behind them.
  const donor=kind==='treehousecanopy'?dependency('treehousetree'):Promise.resolve(null);
  const borrowedTextures:THREE.Texture[]=[];
  const load=(compressed:boolean)=>donor.then(tree=>{
    const loader=new GLTFLoader();if(compressed&&compressedLoader)loader.setKTX2Loader(compressedLoader);
    if(tree){
      for(const texture of [tree.map,tree.normalMap])if(texture)borrowedTextures.push(texture);
      const loadTexture=(index:number)=>index<2?Promise.resolve(index===0?tree.map!:tree.normalMap!):null;
      loader.register(()=>({name:'TreehouseSharedAtlas',loadTexture}));
      // BasisU's built-in plugin runs before fallback image plugins. Override
      // this asset's BasisU hook too, so its compressed atlases are borrowed.
      loader.register(()=>({name:'KHR_texture_basisu',loadTexture}));
    }
    return sceneryLoads.run(()=>loader.loadAsync(import.meta.env.BASE_URL+`jungle-kit/${spec.file}.glb`),wanted);
  }).then(gltf=>{
    const meshes:THREE.Mesh[]=[];gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
    const highParts=meshes.filter(m=>hasAssetLod(m,0));
    const high=highParts.length?highParts:meshes.filter(m=>!hasAssetLod(m,1)),low=meshes.filter(m=>hasAssetLod(m,1));
    const sourceMaterials=new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
    const sourceTextures=new Set<THREE.Texture>();
    for(const material of sourceMaterials)for(const value of Object.values(material))if(value instanceof THREE.Texture)sourceTextures.add(value);
    let geometry:THREE.BufferGeometry|undefined,lodGeometry:THREE.BufferGeometry|undefined;
    const retained:THREE.Texture[]=[];
    try{
      if(!high.length)throw new Error(`Jungle asset ${kind} has no geometry`);
      const highMaterials=new Set(high.flatMap(m=>Array.isArray(m.material)?m.material:[m.material]));
      if(highMaterials.size!==1)throw new Error(`Jungle asset ${kind} must use one shared atlas material`);
      geometry=combineAssetMeshes(high,kind);geometry.computeBoundingBox();
      const bounds=geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      if(![...bounds.min.toArray(),...bounds.max.toArray()].every(Number.isFinite)||Math.min(size.x,size.y,size.z)<1e-6)
        throw new Error(`Jungle asset ${kind} has empty, non-finite or flat mesh bounds`);
      const normalize=kind.startsWith("night") ? new THREE.Matrix4() : new THREE.Matrix4().makeScale(1/size.x,1/size.y,1/size.z).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
      geometry.applyMatrix4(normalize);
      if(low.length)lodGeometry=combineAssetMeshes(low,kind).applyMatrix4(normalize);
      const material=highMaterials.values().next().value as THREE.MeshStandardMaterial;
      const map=material.map??null,normalMap=material.normalMap,roughnessMap=material.roughnessMap;
      const sourceMaterialsJson=gltf.parser.json.materials as {pbrMetallicRoughness?:{baseColorTexture?:unknown};normalTexture?:unknown}[];
      if ((kind.startsWith('treehouse') || /^trialsv[23]/.test(kind)) &&
        ((sourceMaterialsJson?.some(m=>m.pbrMetallicRoughness?.baseColorTexture)&&!map)||
         (sourceMaterialsJson?.some(m=>m.normalTexture)&&!normalMap)))
        throw new Error(`Textured scenery ${kind} decoded without its original atlases`);
      if(map)map.colorSpace=THREE.SRGBColorSpace;
      for(const texture of [map,normalMap,roughnessMap])if(texture){texture.userData.shared=true;texture.anisotropy=8;retained.push(texture);}
      return {geometry:finishGeometry(geometry,kind),lodGeometry:lodGeometry?finishGeometry(lodGeometry,kind):undefined,map,normalMap,roughnessMap};
    }catch(error){geometry?.dispose();lodGeometry?.dispose();throw error;}
    finally{
      for(const g of new Set(meshes.map(m=>m.geometry)))g.dispose();
      for(const material of sourceMaterials)material.dispose();
      const kept=[...retained,...borrowedTextures];
      disposeTextures([...sourceTextures].filter(texture=>!kept.includes(texture)),kept);
    }
  });
  return load(true).catch(error=>{
    if(!wanted()||!compressedLoader||!(kind.startsWith('treehouse')||/^trialsv[23]/.test(kind))||
      !/decoded without|KTX|Basis|transcod|texture/i.test(String((error as Error)?.message??error)))throw error;
    if(!atlasFallbackWarnings.has(kind)){
      atlasFallbackWarnings.add(kind);
      console.warn(`Jungle asset ${kind} compressed atlas unavailable; using its original portable atlases.`);
    }
    // These authored GLBs include original JPEG sources as well as BasisU.
    // A decoder failure must not leave a ready-looking, untextured model.
    return load(false);
  });
}

const WIND = /* glsl */ `
vec4 jungleOrigin = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  jungleOrigin = instanceMatrix * jungleOrigin;
#endif
jungleOrigin = modelMatrix * jungleOrigin;
float junglePhase = uJungleTime * uJungleWindFrequency + jungleOrigin.x * 0.37 + jungleOrigin.z * 0.19;
float jungleGust = sin(junglePhase) * 0.026 + sin(junglePhase * 0.43 + 1.8) * 0.012;
transformed.x += jungleGust * aJungleFlex * uJungleWindScale;
transformed.z += cos(junglePhase * 0.73 + position.x * 3.0) * 0.02 * aJungleFlex * uJungleWindScale;
transformed.y += sin(junglePhase * 1.42 + position.z * 5.0) * 0.012 * aJungleFlex * uJungleWindScale;
`;
const CLOTH_WIND = /* glsl */ `
vec4 jungleOrigin = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  jungleOrigin = instanceMatrix * jungleOrigin;
#endif
jungleOrigin = modelMatrix * jungleOrigin;
float junglePhase = uJungleTime * uJungleWindFrequency * 0.6 + jungleOrigin.x * 0.17 + jungleOrigin.z * 0.11;
transformed.y += (sin(junglePhase + position.z * 1.9) * 0.12 + sin(junglePhase * 0.63 + position.x * 1.4) * 0.06) * aJungleFlex * uJungleWindScale;
`;
const WORLD = /* glsl */ `
vec4 jungleWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  jungleWorld = instanceMatrix * jungleWorld;
#endif
vJungleWorld = (modelMatrix * jungleWorld).xyz;
`;

/** Moving canopy shade costs a few ALU operations, with no extra render pass. */
export function addJungleDapple(material: THREE.Material, time: { value: number }, wind = false, cloth = false): void {
  const dirt = material.userData.jungleDirt === true;
  const painterly = material.userData.junglePainterly === true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    const trail=material.userData.jungleTrail===true;
    if(trail)shader.uniforms.uJungleGrass={value:material.userData.jungleGrassTexture};
    shader.uniforms.uJungleTime = time;
    if(wind){shader.uniforms.uJungleWindScale={value:painterly?1.65:1};shader.uniforms.uJungleWindFrequency={value:painterly?.72:1.15};}
    shader.vertexShader = `uniform float uJungleTime;\n${wind ? 'attribute float aJungleFlex; uniform float uJungleWindScale; uniform float uJungleWindFrequency;' : ''}\n${trail?'attribute vec2 aJungleTrail; varying vec2 vJungleTrail;':''}\nvarying vec3 vJungleWorld;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${trail?'vJungleTrail = aJungleTrail;':''}\n${wind ? cloth?CLOTH_WIND:WIND : ''}\n${WORLD}`);
    shader.fragmentShader = 'uniform float uJungleTime;\nvarying vec3 vJungleWorld;\n'+(trail?'uniform sampler2D uJungleGrass; varying vec2 vJungleTrail;\n':'') + shader.fragmentShader;
    if (dirt) shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", /* glsl */ `
      #ifdef USE_MAP
        vec3 soilNormal = abs(normalize(cross(dFdx(vJungleWorld), dFdy(vJungleWorld))));
        vec2 soilUV = soilNormal.y > 0.55 ? vJungleWorld.xz : (soilNormal.x > soilNormal.z ? vJungleWorld.zy : vJungleWorld.xy);
        soilUV *= 0.145;
        vec3 soilA = texture2D(map, soilUV).rgb;
        vec3 soilB = texture2D(map, vec2(-soilUV.y, soilUV.x) * 1.31 + vec2(0.21, 0.37)).rgb;
        float soilPatch = smoothstep(-0.6, 0.6, sin(vJungleWorld.x * 0.09 + sin(vJungleWorld.z * 0.06)) * cos(vJungleWorld.z * 0.075));
        vec3 soil = mix(soilA, soilB, soilPatch * 0.55);
        soil = ${painterly?'soil * 2.0':'mix(vec3(0.98, 0.72, 0.36), soil * 3.0, 0.30)'};
        ${trail ? `
          vec2 grassUV = vJungleWorld.xz * 0.24;
          vec3 grass = texture2D(uJungleGrass, grassUV).rgb;
          float edgeNoise = sin(vJungleWorld.z * 0.83 + sin(vJungleWorld.z * 1.47)) * 0.07
            + sin(vJungleWorld.z * 4.6 + vJungleWorld.x * 2.8) * 0.018
            + (grass.g - grass.r) * 0.055;
          float edgeDistance = abs(vJungleTrail.x) / max(0.5, vJungleTrail.y);
          float grassBlend = smoothstep(0.42 + edgeNoise, 0.79 + edgeNoise, edgeDistance)
            * smoothstep(0.40, 0.76, soilNormal.y);
          soil = mix(soil, grass * vec3(0.18, 0.42, 0.12), grassBlend);
        ` : ''}
        diffuseColor.rgb *= soil;
      #endif
    `);
    shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
      float shadeWave = sin(vJungleWorld.x * 0.48 + vJungleWorld.z * 0.33 + sin(uJungleTime * 0.21) * 0.15)
        * sin(vJungleWorld.z * 0.68 - vJungleWorld.x * 0.23);
      float lightPool = smoothstep(-0.34, 0.6, shadeWave);
      diffuseColor.rgb *= mix(${painterly?'vec3(0.91, 0.95, 0.95)':dirt?'vec3(0.87, 0.84, 0.76)':'vec3(0.60, 0.75, 0.70)'}, ${painterly?'vec3(1.02, 1.01, 0.98)':'vec3(1.06, 1.02, 0.90)'}, lightPool);
    `);
    if (wind) shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float jungleTransmission = pow(max(0.0, dot(-normal, directionalLights[0].direction)), 2.0);
        totalEmissiveRadiance += diffuseColor.rgb * (0.035 + jungleTransmission * 0.12);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `jungle-dapple-v6-${wind}-${cloth}-${dirt}-${material.userData.jungleTrail===true}-${painterly}`;
  if(painterly)addTreehouseTrialsMaterialLook(material);
}

function sceneryLodFragment(far:boolean):string {
  return `
    float sceneryLod = smoothstep(72.0, 96.0, distance(vJungleWorld, uJungleView));
    float sceneryDither = fract(dot(floor(gl_FragCoord.xy), vec2(0.754877666,0.569840296)));
    if (${far?'sceneryLod <= sceneryDither':'sceneryLod > sceneryDither'}) discard;
  `;
}
function addSceneryLodFade(material:THREE.Material,view:THREE.Vector3,far:boolean):void {
  const compile=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=(shader,renderer)=>{
    compile.call(material,shader,renderer);shader.uniforms.uJungleView={value:view};
    shader.fragmentShader='uniform vec3 uJungleView;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
      '#include <alphatest_fragment>\n'+sceneryLodFragment(far));
  };
  material.customProgramCacheKey=()=>key()+`|scenery-lod-fade-v1-${far}`;
}
interface Bucket {nearVisible?:boolean;farVisible?:boolean;retryCount?:number;castShadow?:boolean;cameraCutaway?:boolean;far?:boolean;farMesh?:THREE.InstancedMesh;kind:RenderKind;transforms:THREE.Matrix4[];colors:THREE.Color[];bounds:THREE.Box3;mesh?:THREE.InstancedMesh;assets?:ReturnType<typeof createJungleAssetScope>;}
export class JungleAssetKit {
  private assets=createJungleAssetScope();
  readonly root=new THREE.Group();readonly time={value:0};readonly errors:string[]=[];
  private buckets=new Map<string,Bucket>();private jobs:Promise<void>[]=[];
  private materials=new Map<RenderKind,THREE.MeshStandardMaterial|THREE.MeshLambertMaterial|THREE.MeshBasicMaterial>();
  private farMaterials=new Map<RenderKind,THREE.MeshStandardMaterial|THREE.MeshLambertMaterial|THREE.MeshBasicMaterial>();
  private readonly viewPosition=new THREE.Vector3();
  private depths=new Map<RenderKind,THREE.MeshDepthMaterial>();
  private loose=new Set<THREE.Group>();private disposed=false;
  private sourceCount=0;private count=0;private readyCount=0;private skipped=0;
  private cells:Bucket[]=[];
  private pending=new Set<Promise<void>>();
  private failedBuckets=new Map<Bucket,number>();
  private kindUsers=new Map<RenderKind,number>();
  private viewSet=false;
  private lastViews:THREE.Vector3[]=[];
  private lastRadius=0;
  private cutaway=false;
  constructor(private batched:boolean,private lite:boolean,private depthFade=false,private streamed=false,private style?:'painterly'){this.root.name="Jungle Ruins modular kit";}
  private material(kind:RenderKind,template:Template,far=false):THREE.MeshStandardMaterial|THREE.MeshLambertMaterial|THREE.MeshBasicMaterial {
    const cache=far?this.farMaterials:this.materials;
    const cached=cache.get(kind);if(cached)return cached;
    const spec=renderSpec(kind),isVine=kind==="vine"||kind==="junglevine";
    if(spec.shaft){
      const material=new THREE.MeshBasicMaterial({color:0xffdfa8,transparent:true,opacity:.055,depthWrite:false,
        blending:THREE.AdditiveBlending,fog:true,toneMapped:false,side:THREE.DoubleSide});
      material.forceSinglePass=true;
      material.onBeforeCompile=shader=>{
        shader.uniforms.uJungleTime=this.time;
        shader.vertexShader='attribute vec2 aJungleShaftUv;\nvarying vec2 vJungleShaftUv;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvJungleShaftUv = aJungleShaftUv;');
        shader.fragmentShader='uniform float uJungleTime;\nvarying vec2 vJungleShaftUv;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\nfloat shaftEdge = min(vJungleShaftUv.x, 1.0-vJungleShaftUv.x);\nfloat shaftEnds = smoothstep(0.0,0.16,vJungleShaftUv.y) * smoothstep(0.0,0.12,1.0-vJungleShaftUv.y);\ndiffuseColor.a *= smoothstep(0.0,0.18,shaftEdge) * shaftEnds * (0.92 + 0.08*sin(uJungleTime*0.17+vJungleShaftUv.y*3.0));');
      };
      material.customProgramCacheKey=()=>"shaft-v1";
      material.name=spec.label;material.userData.jungleAsset=true;
      cache.set(kind,material);return material;
    }
    if(spec.matte){
      const material=new THREE.MeshBasicMaterial({map:template.map,fog:spec.fog===true,toneMapped:false,
        side:THREE.FrontSide,alphaTest:spec.edgeFade?0.005:spec.alphaCutout?.35:0,transparent:!!spec.edgeFade,depthWrite:!spec.edgeFade});
      if(spec.edgeFade){
        material.onBeforeCompile=shader=>{
          shader.uniforms.uMatteEdgeFade={value:spec.edgeFade};
          shader.fragmentShader='uniform float uMatteEdgeFade;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>\nfloat matteBorder = min(min(vMapUv.x, 1.0-vMapUv.x), ${spec.image?.includes('-alpha.')?'vMapUv.y':'min(vMapUv.y, 1.0-vMapUv.y)'});\ndiffuseColor.a *= smoothstep(0.0, uMatteEdgeFade, matteBorder);`);
        };
        material.customProgramCacheKey=()=>`painted-matte-soft-border-v2-${spec.image?.includes('-alpha.')}`;
      }
      material.name=spec.label;material.userData.jungleAsset=true;material.userData.treehouseMatte=true;
      cache.set(kind,material);return material;
    }
    if (kind.startsWith("night")) {
      const material=new THREE.MeshLambertMaterial({map:template.map,emissive:0x1b2d4b,emissiveIntensity:.3});
      material.name=spec.label;material.userData.jungleAsset=true;cache.set(kind,material);return material;
    }
    const m=spec.backdrop?new THREE.MeshLambertMaterial({map:template.map,vertexColors:kind==="junglecliff",
      emissive:kind==="junglecliff"?0x64765f:0x25462e,emissiveIntensity:kind==="junglecliff"?.35:.18,
      side:kind==="junglebackdrop"?THREE.DoubleSide:THREE.FrontSide}):new THREE.MeshStandardMaterial({map:template.map,normalMap:template.normalMap??null,
      roughnessMap:template.roughnessMap??null,normalScale:new THREE.Vector2().setScalar((spec.normalStrength??.28)*(this.style==='painterly'?.75:1)),
      roughness:spec.clay ? .65 : spec.lod ? .94 : .96,metalness:0,vertexColors:isVine||spec.clay===true||template.geometry.hasAttribute('color'),
      side:spec.clay?THREE.FrontSide:spec.wind||spec.doubleSided?THREE.DoubleSide:THREE.FrontSide});
    // These GLTF atlases have derivative tangents; retain the glTF normal Y sign
    // when replacing its material with the shared coast material.
    if(kind.startsWith("coast")&&template.normalMap&&m instanceof THREE.MeshStandardMaterial)m.normalScale.y*=-1;
    m.name=spec.label;m.userData.jungleAsset=true;
    m.userData.junglePainterly=this.style==='painterly';m.userData.jungleAO=true;
    if(kind==="earth")m.userData.jungleDirt=true;
    addJungleDapple(m,this.time,spec.wind,spec.cloth);
    if(spec.windowGlow){
      const compile=m.onBeforeCompile,key=m.customProgramCacheKey.bind(m);
      m.onBeforeCompile=(shader,renderer)=>{
        compile.call(m,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat goldRatio=diffuseColor.r/max(diffuseColor.g,0.008);\nfloat amberGlass=smoothstep(2.3,3.2,diffuseColor.g/max(diffuseColor.b,0.008))*smoothstep(0.1,0.26,diffuseColor.g)*smoothstep(1.1,1.3,goldRatio)*(1.0-smoothstep(2.4,3.1,goldRatio));\nfloat verticalGlass=1.0-smoothstep(0.35,0.65,abs(inverseTransformDirection(normal,viewMatrix).y));\ntotalEmissiveRadiance+=vec3(1.0,0.46,0.035)*amberGlass*verticalGlass*0.65;');
      };
      m.customProgramCacheKey=()=>key()+'|amber-window-v2';
    }
    if(kind.startsWith("coastv2grass"))addCarlisleGrassLook(m);
    else if(kind.startsWith("coast"))addCarlisleMaterialLook(m);
    if(this.depthFade)addJungleDepthFade(m);
    if(this.streamed&&spec.distanceLod)addSceneryLodFade(m,this.viewPosition,far);
    cache.set(kind,m);return m;
  }
  private configure(mesh:THREE.Mesh,kind:RenderKind):void {
    const spec=renderSpec(kind);mesh.name=spec.label;mesh.userData.jungleAsset=kind;
    if(spec.matte||spec.shaft){mesh.castShadow=false;mesh.receiveShadow=false;return;}
    mesh.castShadow=!this.lite&&!spec.backdrop&&kind!=="joint"&&kind!=="earth"&&kind!=="coastcarpet"&&kind!=="coastfern"&&kind!=="coastfoliage"&&kind!=="coastv2grass"&&kind!=="coastv2grassb";
    if(kind.startsWith("coast"))mesh.userData.castShadow=mesh.castShadow;
    mesh.receiveShadow=!this.lite&&!spec.backdrop;
    if(!spec.wind)return;
    let depth=this.depths.get(kind);
    if(!depth){
      depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
      depth.onBeforeCompile=shader=>{shader.uniforms.uJungleTime=this.time;
        shader.uniforms.uJungleWindScale={value:this.style==='painterly'?1.65:1};shader.uniforms.uJungleWindFrequency={value:this.style==='painterly'?.72:1.15};
        shader.vertexShader='uniform float uJungleTime;\nuniform float uJungleWindScale;\nuniform float uJungleWindFrequency;\nattribute float aJungleFlex;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+(spec.cloth?CLOTH_WIND:WIND));
        if(this.streamed&&spec.distanceLod){
          shader.uniforms.uJungleView={value:this.viewPosition};
          shader.vertexShader='varying vec3 vJungleWorld;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',WORLD+'\n#include <project_vertex>');
          shader.fragmentShader='varying vec3 vJungleWorld; uniform vec3 uJungleView;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+sceneryLodFragment(false));
        }
      };
      depth.customProgramCacheKey=()=>`jungle-wind-depth-v5-${this.streamed&&spec.distanceLod}-${this.style??'native'}-${spec.cloth===true}`;this.depths.set(kind,depth);
    }
    mesh.customDepthMaterial=depth;
  }
  add(c:JunglePlacement):THREE.Group|null {
    if(this.disposed)throw new Error('Jungle asset kit is disposed');this.sourceCount++;
    const parts=isJungleAssembly(c.dkind)?jungleAssemblyParts({...c,dkind:c.dkind})
      :[{kind:c.dkind as RenderKind,matrix:jungleAssetMatrix(c),color:c.color??'#ffffff'}];
    this.count+=parts.length;
    const drawParts=parts.filter(p=>{
      if(this.lite&&renderSpec(p.kind).wind){this.skipped++;return false;}return true;
    });
    if(this.batched){
      for(const part of drawParts){
        const point=new THREE.Vector3().setFromMatrixPosition(part.matrix);
        // Fine cells keep a detailed temple bay from dragging the whole temple into view.
        const cell=renderSpec(part.kind).lod?20:32;
        const key=`${part.kind}:${Math.floor(point.x/cell)}:${Math.floor(point.z/cell)}:${c.cameraCutaway===true}:${c.castShadow!==false}`;
        let bucket=this.buckets.get(key);
        if(!bucket){bucket={kind:part.kind,castShadow:c.castShadow,cameraCutaway:c.cameraCutaway,transforms:[],colors:[],bounds:new THREE.Box3()};this.buckets.set(key,bucket);}
        bucket.transforms.push(part.matrix);bucket.colors.push(new THREE.Color(part.color));
        // Templates are normalized around X/Z and anchored at Y=0. Include
        // wind and overhang before the actual mesh bounds become available.
        bucket.bounds.union(new THREE.Box3(new THREE.Vector3(-.75,-.3,-.75),new THREE.Vector3(.75,1.5,.75)).applyMatrix4(part.matrix));
      }
      return null;
    }
    const holder=new THREE.Group();holder.name=JUNGLE_ASSETS[c.dkind].label;holder.position.fromArray(c.p);
    this.root.add(holder);this.loose.add(holder);
    const inverseAnchor=new THREE.Matrix4().makeTranslation(-c.p[0],-c.p[1],-c.p[2]);
    this.jobs.push(Promise.all(drawParts.map(async part=>{
      const template=await this.loadTemplate(this.assets,part.kind,()=>!this.disposed);if(this.disposed)return;
      const mesh=new THREE.Mesh(template.geometry,this.material(part.kind,template));
      this.configure(mesh,part.kind);mesh.matrix.copy(inverseAnchor).multiply(part.matrix);mesh.matrixAutoUpdate=false;
      mesh.userData.editorIdx=holder.userData.editorIdx;holder.add(mesh);this.readyCount++;
    })).then(()=>{holder.userData.assetReady=true;}).catch(error=>this.failed(c.dkind,error)));
    return holder;
  }
  flush():void {
    this.cells.push(...this.buckets.values());this.buckets.clear();
    if(!this.streamed)for(const bucket of this.cells)this.activate(bucket);
  }
  private async loadTemplate(assets:ReturnType<typeof createJungleAssetScope>,kind:RenderKind,wanted:()=>boolean):Promise<Template>{
    let failure:unknown;
    for(let attempt=0;attempt<3;attempt++){
      if(!wanted())throw new Error('Scenery owner was released');
      if(attempt)await new Promise(resolve=>setTimeout(resolve,attempt===1?300:900));
      if(!wanted())throw new Error('Scenery owner was released');
      try{return await assets.load(kind);}catch(error){failure=error;}
    }
    throw failure;
  }
  private activate(bucket:Bucket):void {
    if(bucket.assets||this.disposed)return;
    this.failedBuckets.delete(bucket);
    const assets=bucket.assets=createJungleAssetScope();
    this.kindUsers.set(bucket.kind,(this.kindUsers.get(bucket.kind)??0)+1);
    const job=this.loadTemplate(assets,bucket.kind,()=>!this.disposed&&bucket.assets===assets).then(template=>{
        if(this.disposed||bucket.assets!==assets)return;
        const center=new THREE.Vector3();for(const m of bucket.transforms)center.add(new THREE.Vector3().setFromMatrixPosition(m));center.multiplyScalar(1/bucket.transforms.length);
        const inverse=new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z);
        const material=this.material(bucket.kind,template);
        const make=(geometry:THREE.BufferGeometry,drawMaterial=material):THREE.InstancedMesh=>{
          const mesh=new THREE.InstancedMesh(geometry,drawMaterial,bucket.transforms.length);
          bucket.transforms.forEach((matrix,i)=>{mesh.setMatrixAt(i,inverse.clone().multiply(matrix));mesh.setColorAt(i,bucket.colors[i]);});
          mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
          mesh.computeBoundingBox();mesh.computeBoundingSphere();this.configure(mesh,bucket.kind);
          if(bucket.castShadow===false){mesh.castShadow=false;mesh.userData.castShadow=false;}return mesh;
        };
        // Keep the authored mesh at every distance. Cell bounds still allow
        // frustum culling without changing silhouettes as the camera moves.
        const mesh=make(template.geometry);mesh.position.copy(center);
        // Placement is immutable after upload; wind moves vertices in the
        // shader. Parent/world transforms still update normally for editor
        // roots and level transitions, without recomposing every cell/pass.
        mesh.updateMatrix();mesh.matrixAutoUpdate=false;
        this.root.add(mesh);bucket.mesh=mesh;
        mesh.userData.cameraCutaway=bucket.cameraCutaway===true;
        if(renderSpec(bucket.kind).distanceLod&&template.lodGeometry){
          const far=make(template.lodGeometry,this.material(bucket.kind,template,true));far.position.copy(center);far.updateMatrix();far.matrixAutoUpdate=false;
          far.castShadow=false;far.userData.castShadow=false;far.userData.cameraCutaway=bucket.cameraCutaway===true;
          this.root.add(far);bucket.farMesh=far;
        }
        this.showBucket(bucket);
        this.readyCount+=bucket.transforms.length;
        bucket.retryCount=0;
        if(![...this.failedBuckets.keys()].some(cell=>cell.kind===bucket.kind)){
          const index=this.errors.indexOf(bucket.kind);if(index>=0)this.errors.splice(index,1);
        }
      }).catch(error=>{
        if(this.disposed||bucket.assets!==assets)return;
        this.failed(bucket.kind,error);
        bucket.retryCount=(bucket.retryCount??0)+1;
        this.retire(bucket);
        this.failedBuckets.set(bucket,this.time.value+Math.min(30,2**bucket.retryCount));
      }).finally(()=>this.pending.delete(job));
    this.pending.add(job);
  }
  private retire(bucket:Bucket):void {
    if(!bucket.assets)return;
    if(bucket.mesh){bucket.mesh.removeFromParent();bucket.mesh.dispose();bucket.mesh=undefined;this.readyCount-=bucket.transforms.length;}
    if(bucket.farMesh){bucket.farMesh.removeFromParent();bucket.farMesh.dispose();bucket.farMesh=undefined;}
    const users=(this.kindUsers.get(bucket.kind)??1)-1;
    if(users)this.kindUsers.set(bucket.kind,users);
    else{
      this.kindUsers.delete(bucket.kind);
      this.materials.get(bucket.kind)?.dispose();this.materials.delete(bucket.kind);
      this.farMaterials.get(bucket.kind)?.dispose();this.farMaterials.delete(bucket.kind);
      this.depths.get(bucket.kind)?.dispose();this.depths.delete(bucket.kind);
    }
    bucket.assets.dispose();bucket.assets=undefined;
  }
  private showBucket(bucket:Bucket):void{
    const show=!(this.cutaway&&bucket.cameraCutaway);
    if(bucket.mesh)bucket.mesh.visible=show&&(bucket.nearVisible??true);
    if(bucket.farMesh)bucket.farMesh.visible=show&&(bucket.farVisible??false);
  }
  setCutaway(value:boolean):void{
    if(this.cutaway===value)return;this.cutaway=value;
    for(const cell of this.cells)this.showBucket(cell);
  }
  /** Retain exact authored meshes in nearby cells, with ample travel/shadow
   * prefetch. Background silhouettes and painted mattes are always resident. */
  setView(position:THREE.Vector3,visibleDistance:number,secondary?:THREE.Vector3):void {
    if(!this.streamed||this.disposed)return;
    this.viewPosition.copy(position);
    const radius=Math.max(96,visibleDistance)+64;
    this.viewSet=true;
    const views=secondary?[position,secondary]:[position];
    if(views.length===this.lastViews.length&&views.every((p,i)=>this.lastViews[i].distanceToSquared(p)<16)&&this.lastRadius===radius)return;
    this.lastViews=views.map(p=>p.clone());this.lastRadius=radius;
    const distanceTo=(cell:Bucket)=>Math.min(...views.map(p=>cell.bounds.distanceToPoint(p)));
    for(const cell of this.cells){
      const spec=renderSpec(cell.kind),distance=distanceTo(cell);
      if(spec.distanceLod){
        // The material cross-fades individual pixels through a 24m band.
        // Conservative bounds keep both meshes available until the entire
        // cell is outside that band, eliminating a whole-tree switch.
        const center=cell.bounds.getCenter(new THREE.Vector3()),radius=cell.bounds.getSize(new THREE.Vector3()).length()*.5;
        const furthest=Math.max(...views.map(p=>p.distanceTo(center)+radius));
        cell.nearVisible=distance<98;cell.farVisible=furthest>70;
        this.showBucket(cell);
      }
      if(spec.backdrop||spec.matte||distance<=radius)this.activate(cell);
    }
    // Acquire incoming leases before releasing outgoing cells, so a camera
    // warp can reuse common templates instead of decoding them a second time.
    for(const cell of this.cells){
      const spec=renderSpec(cell.kind);
      if(!spec.backdrop&&!spec.matte&&distanceTo(cell)>radius+64)this.retire(cell);
    }
  }
  private failed(kind:RenderKind,error:unknown):void {
    if(this.disposed||this.errors.includes(kind))return;this.errors.push(kind);
    const url=(error as {response?:{url?:string}}).response?.url;if(url!=="")console.error(`Jungle asset failed: ${kind}`,error);
  }
  async ready():Promise<void>{
    // Tools/editor consumers that do not supply a camera retain the full kit.
    if(!this.viewSet)for(const cell of this.cells)this.activate(cell);
    await Promise.all([...this.jobs,...this.pending]);
  }
  update(dt:number):void{
    if(this.disposed)return;this.time.value+=Math.max(0,Math.min(dt,.1));
    // Only failed cells participate. Recovery works while standing still,
    // without rebuilding the kit or checking every healthy cell each frame.
    for(const [bucket,at] of this.failedBuckets){
      if(at>this.time.value)continue;
      const nearby=this.lastViews.some(view=>bucket.bounds.distanceToPoint(view)<=this.lastRadius);
      if(!this.viewSet||nearby)this.activate(bucket);
    }
  }
  get diagnostics(){
    let draws=0,triangles=0,highTriangles=0;const usedTextures=new Set<THREE.Texture>();
    this.root.traverse(o=>{const mesh=o as THREE.InstancedMesh;if(!mesh.isMesh)return;
      const tris=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3*(mesh.isInstancedMesh?mesh.count:1);
      highTriangles+=tris;if(mesh.visible){draws++;triangles+=tris;}
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])for(const key of ['map','normalMap','roughnessMap'] as const){const map=(material as THREE.MeshStandardMaterial)[key];if(map)usedTextures.add(map);}
    });
    let textureBytes=0,compressedTextures=0;
    for(const texture of usedTextures){const compressed=texture as THREE.CompressedTexture;
      if(compressed.isCompressedTexture){compressedTextures++;for(const mip of compressed.mipmaps??[])textureBytes+=mip.data.byteLength;}
      else if(texture.image?.width&&texture.image?.height)textureBytes+=texture.image.width*texture.image.height*4*4/3;
    }
    return {components:this.sourceCount,placements:this.count,ready:this.readyCount,skipped:this.skipped,draws,triangles,allLodTriangles:highTriangles,
      cells:this.cells.length,residentCells:this.cells.filter(c=>!!c.mesh).length,pendingCells:this.pending.size,retryingCells:this.failedBuckets.size,
      compressedTextures,textureMiB:Math.round(textureBytes/1048576*100)/100,errors:[...this.errors],windTime:this.time.value};
  }
  dispose():void {
    for(const cell of this.cells)this.retire(cell);this.cells.length=0;this.failedBuckets.clear();
    this.assets.dispose();this.jobs.length=0;
    if(this.disposed)return;this.disposed=true;
    this.root.traverse(o=>{if((o as THREE.InstancedMesh).isInstancedMesh)(o as THREE.InstancedMesh).dispose();});
    this.root.removeFromParent();this.root.clear();for(const holder of this.loose){holder.removeFromParent();holder.clear();}this.loose.clear();
    for(const m of this.materials.values())m.dispose();for(const m of this.farMaterials.values())m.dispose();for(const m of this.depths.values())m.dispose();
    this.materials.clear();this.farMaterials.clear();this.depths.clear();this.buckets.clear();
  }
}
