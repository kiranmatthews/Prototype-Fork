import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { JUNGLE_MODULES } from "./jungleModules";
import { MAP_MODULES } from "./mapModules";
import { NIGHTWORKS_MODULES } from "./nightworksModules";
import { JUNGLE_EDITOR_ASSETS } from "./jungleEditorAssets";
import { isJungleAssembly, jungleAssemblyParts, type JunglePartKind } from "./jungleAssemblies";
import { addJungleDepthFade } from "./jungleGround";

export interface JungleAssetSpec {
  file: string; label: string; size: readonly [number,number,number]; wind: boolean;
  normalStrength?: number; lod?: boolean;
  doubleSided?: boolean;
  backdrop?: boolean;
}
const ASSETS = {
  ...JUNGLE_MODULES,
  ...MAP_MODULES,
  ...NIGHTWORKS_MODULES,
  ...JUNGLE_EDITOR_ASSETS,
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
  yaw?:number;amp?:number;color?:string;vr?:number;seed?:number;
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
const templates=new Map<RenderKind,Promise<Template>>();
let compressedLoader:KTX2Loader|null=null;
let assetRenderer:THREE.WebGLRenderer|null=null;
export function configureJungleAssetRenderer(renderer:THREE.WebGLRenderer,loader?:KTX2Loader):void {
  assetRenderer=renderer;
  if(!compressedLoader)compressedLoader=loader??new KTX2Loader().setTranscoderPath(import.meta.env.BASE_URL+"jungle-kit/basis/").setWorkerLimit(2).detectSupport(renderer);
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
  const positions=geometry.attributes.position,flex=new Float32Array(positions.count);
  if(renderSpec(kind).wind)for(let i=0;i<positions.count;i++) {
    const y=positions.getY(i),radial=Math.hypot(positions.getX(i),positions.getZ(i));
    flex[i]=kind==="vine"||kind==="junglevine"?Math.max(0,1-y):kind==="junglepalmtree"
      ?Math.pow(THREE.MathUtils.smoothstep(y,.48,1),1.2)*.6+y*y*.08
      :Math.min(1,Math.pow(radial*1.6+y*.45,1.5))*THREE.MathUtils.smoothstep(y,0,.12);
  }
  geometry.setAttribute("aJungleFlex",new THREE.BufferAttribute(flex,1));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const margin=renderSpec(kind).wind ? .065 : .002;
  geometry.boundingBox!.expandByScalar(margin);geometry.boundingSphere!.radius+=margin;
  geometry.userData.shared=true;return geometry;
}
function loadTemplate(kind:RenderKind):Promise<Template> {
  const cached=templates.get(kind);if(cached)return cached;
  const spec=renderSpec(kind);
  if(kind==="junglebackdrop") {
    const pending=loadTemplate("junglecanopy").then(source=>({...source,
      geometry:source.lodGeometry??source.geometry,lodGeometry:undefined}));
    templates.set(kind,pending);return pending;
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
    templates.set(kind,pending);return pending;
  }
  if(kind==="joint"||kind==="earth"||kind==="vine"||kind==="junglevine") {
    const geometry=kind==="joint"||kind==="earth"?new THREE.BoxGeometry(1,1,1).translate(0,.5,0):vineGeometry();
    const map=kind==="earth"?new THREE.TextureLoader().load(import.meta.env.BASE_URL+"jungle-kit/dirt.jpg"):null;
    if(map){map.wrapS=map.wrapT=THREE.RepeatWrapping;map.colorSpace=THREE.SRGBColorSpace;map.userData.shared=true;map.anisotropy=8;}
    const promise=Promise.resolve({geometry:finishGeometry(geometry,kind),map});templates.set(kind,promise);return promise;
  }
  const loader=new GLTFLoader();if(compressedLoader)loader.setKTX2Loader(compressedLoader);
  const pending=loader.loadAsync(import.meta.env.BASE_URL+`jungle-kit/${spec.file}.glb`).then(gltf=>{
    const meshes:THREE.Mesh[]=[];gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
    const high=meshes.find(m=>m.name.endsWith("LOD0"))??meshes[0],low=meshes.find(m=>m.name.endsWith("LOD1"));
    if(!high)throw new Error(`Jungle asset ${kind} has no geometry`);
    const geometry=high.geometry.clone().applyMatrix4(high.matrixWorld);geometry.computeBoundingBox();
    const bounds=geometry.boundingBox!,size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const normalize=kind.startsWith("night") ? new THREE.Matrix4() : new THREE.Matrix4().makeScale(1/size.x,1/size.y,1/size.z).multiply(new THREE.Matrix4().makeTranslation(-center.x,-bounds.min.y,-center.z));
    geometry.applyMatrix4(normalize);
    const lodGeometry=low?low.geometry.clone().applyMatrix4(low.matrixWorld).applyMatrix4(normalize):undefined;
    const material=high.material as THREE.MeshStandardMaterial;
    const map=material.map!,normalMap=material.normalMap,roughnessMap=material.roughnessMap;
    map.colorSpace=THREE.SRGBColorSpace;
    for(const texture of [map,normalMap,roughnessMap])if(texture){texture.userData.shared=true;texture.anisotropy=8;assetRenderer?.initTexture(texture);}
    for(const g of new Set(meshes.map(m=>m.geometry)))g.dispose();
    for(const m of new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material])))m.dispose();
    return {geometry:finishGeometry(geometry,kind),lodGeometry:lodGeometry?finishGeometry(lodGeometry,kind):undefined,map,normalMap,roughnessMap};
  }).catch(error=>{templates.delete(kind);throw error;});
  templates.set(kind,pending);return pending;
}

/** Shared cached Meshy geometry/textures for terrain whose transform moves. */
export const loadJungleAssetTemplate = loadTemplate;

const WIND = /* glsl */ `
vec4 jungleOrigin = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  jungleOrigin = instanceMatrix * jungleOrigin;
#endif
jungleOrigin = modelMatrix * jungleOrigin;
float junglePhase = uJungleTime * 1.15 + jungleOrigin.x * 0.37 + jungleOrigin.z * 0.19;
float jungleGust = sin(junglePhase) * 0.026 + sin(junglePhase * 0.43 + 1.8) * 0.012;
transformed.x += jungleGust * aJungleFlex;
transformed.z += cos(junglePhase * 0.73 + position.x * 3.0) * 0.02 * aJungleFlex;
transformed.y += sin(junglePhase * 1.42 + position.z * 5.0) * 0.012 * aJungleFlex;
`;
const WORLD = /* glsl */ `
vec4 jungleWorld = vec4(transformed, 1.0);
#ifdef USE_INSTANCING
  jungleWorld = instanceMatrix * jungleWorld;
#endif
vJungleWorld = (modelMatrix * jungleWorld).xyz;
`;

/** Moving canopy shade costs a few ALU operations, with no extra render pass. */
export function addJungleDapple(material: THREE.Material, time: { value: number }, wind = false): void {
  const dirt = material.userData.jungleDirt === true;
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer);
    const trail=material.userData.jungleTrail===true;
    if(trail)shader.uniforms.uJungleGrass={value:material.userData.jungleGrassTexture};
    shader.uniforms.uJungleTime = time;
    shader.vertexShader = `uniform float uJungleTime;\n${wind ? 'attribute float aJungleFlex;' : ''}\n${trail?'attribute vec2 aJungleTrail; varying vec2 vJungleTrail;':''}\nvarying vec3 vJungleWorld;\n` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${trail?'vJungleTrail = aJungleTrail;':''}\n${wind ? WIND : ''}\n${WORLD}`);
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
        soil = mix(vec3(0.98, 0.72, 0.36), soil * 3.0, 0.30);
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
      diffuseColor.rgb *= mix(${dirt?'vec3(0.87, 0.84, 0.76)':'vec3(0.60, 0.75, 0.70)'}, vec3(1.06, 1.02, 0.90), lightPool);
    `);
    if (wind) shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_end>", `#include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        float jungleTransmission = pow(max(0.0, dot(-normal, directionalLights[0].direction)), 2.0);
        totalEmissiveRadiance += diffuseColor.rgb * (0.035 + jungleTransmission * 0.12);
      #endif
    `);
  };
  material.customProgramCacheKey = () => `jungle-dapple-v4-${wind}-${dirt}-${material.userData.jungleTrail===true}`;
}

interface Bucket {kind:RenderKind;transforms:THREE.Matrix4[];colors:THREE.Color[];}
export class JungleAssetKit {
  readonly root=new THREE.Group();readonly time={value:0};readonly errors:string[]=[];
  private buckets=new Map<string,Bucket>();private jobs:Promise<void>[]=[];
  private materials=new Map<RenderKind,THREE.MeshStandardMaterial|THREE.MeshLambertMaterial>();
  private depths=new Map<RenderKind,THREE.MeshDepthMaterial>();
  private loose=new Set<THREE.Group>();private disposed=false;
  private sourceCount=0;private count=0;private readyCount=0;private skipped=0;
  constructor(private batched:boolean,private lite:boolean,private depthFade=false,private lodDistanceScale=1){this.root.name="Jungle Ruins modular kit";}
  private material(kind:RenderKind,template:Template):THREE.MeshStandardMaterial|THREE.MeshLambertMaterial {
    const cached=this.materials.get(kind);if(cached)return cached;
    const spec=renderSpec(kind),isVine=kind==="vine"||kind==="junglevine";
    if (kind.startsWith("night")) {
      const material=new THREE.MeshLambertMaterial({map:template.map,emissive:0x1b2d4b,emissiveIntensity:.3});
      material.name=spec.label;material.userData.jungleAsset=true;this.materials.set(kind,material);return material;
    }
    const m=spec.backdrop?new THREE.MeshLambertMaterial({map:template.map,vertexColors:kind==="junglecliff",
      emissive:kind==="junglecliff"?0x64765f:0x25462e,emissiveIntensity:kind==="junglecliff"?.35:.18,
      side:kind==="junglebackdrop"?THREE.DoubleSide:THREE.FrontSide}):new THREE.MeshStandardMaterial({map:template.map,normalMap:template.normalMap??null,
      roughnessMap:template.roughnessMap??null,normalScale:new THREE.Vector2().setScalar(spec.normalStrength??.28),
      roughness:spec.lod ? .94 : .96,metalness:0,vertexColors:isVine,
      side:spec.wind||spec.doubleSided?THREE.DoubleSide:THREE.FrontSide});
    m.name=spec.label;m.userData.jungleAsset=true;
    if(kind==="earth")m.userData.jungleDirt=true;
    addJungleDapple(m,this.time,spec.wind);
    if(this.depthFade)addJungleDepthFade(m);
    this.materials.set(kind,m);return m;
  }
  private configure(mesh:THREE.Mesh,kind:RenderKind):void {
    const spec=renderSpec(kind);mesh.name=spec.label;mesh.userData.jungleAsset=kind;
    mesh.castShadow=!this.lite&&!spec.backdrop&&kind!=="joint"&&kind!=="earth";
    mesh.receiveShadow=!this.lite&&!spec.backdrop;
    if(!spec.wind)return;
    let depth=this.depths.get(kind);
    if(!depth){
      depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});
      depth.onBeforeCompile=shader=>{shader.uniforms.uJungleTime=this.time;
        shader.vertexShader='uniform float uJungleTime;\nattribute float aJungleFlex;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+WIND);};
      depth.customProgramCacheKey=()=>"jungle-wind-depth-v2";this.depths.set(kind,depth);
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
        const key=`${part.kind}:${Math.floor(point.x/cell)}:${Math.floor(point.z/cell)}`;
        let bucket=this.buckets.get(key);
        if(!bucket){bucket={kind:part.kind,transforms:[],colors:[]};this.buckets.set(key,bucket);}
        bucket.transforms.push(part.matrix);bucket.colors.push(new THREE.Color(part.color));
      }
      return null;
    }
    const holder=new THREE.Group();holder.name=JUNGLE_ASSETS[c.dkind].label;holder.position.fromArray(c.p);
    this.root.add(holder);this.loose.add(holder);
    const inverseAnchor=new THREE.Matrix4().makeTranslation(-c.p[0],-c.p[1],-c.p[2]);
    this.jobs.push(Promise.all(drawParts.map(async part=>{
      const template=await loadTemplate(part.kind);if(this.disposed)return;
      const mesh=new THREE.Mesh(template.geometry,this.material(part.kind,template));
      this.configure(mesh,part.kind);mesh.matrix.copy(inverseAnchor).multiply(part.matrix);mesh.matrixAutoUpdate=false;
      mesh.userData.editorIdx=holder.userData.editorIdx;holder.add(mesh);this.readyCount++;
    })).then(()=>{holder.userData.assetReady=true;}).catch(error=>this.failed(c.dkind,error)));
    return holder;
  }
  flush():void {
    for(const bucket of this.buckets.values()){
      this.jobs.push(loadTemplate(bucket.kind).then(template=>{
        if(this.disposed)return;
        const center=new THREE.Vector3();for(const m of bucket.transforms)center.add(new THREE.Vector3().setFromMatrixPosition(m));center.multiplyScalar(1/bucket.transforms.length);
        const inverse=new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z);
        const material=this.material(bucket.kind,template);
        const make=(geometry:THREE.BufferGeometry):THREE.InstancedMesh=>{
          const mesh=new THREE.InstancedMesh(geometry,material,bucket.transforms.length);
          bucket.transforms.forEach((matrix,i)=>{mesh.setMatrixAt(i,inverse.clone().multiply(matrix));mesh.setColorAt(i,bucket.colors[i]);});
          mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
          mesh.computeBoundingBox();mesh.computeBoundingSphere();this.configure(mesh,bucket.kind);return mesh;
        };
        if(template.lodGeometry){
          const lod=new THREE.LOD();lod.name=renderSpec(bucket.kind).label+' cell';lod.position.copy(center);
          // Large canopy silhouettes keep detail farther away than a single masonry block.
          const distance=(renderSpec(bucket.kind).wind?48:32)*this.lodDistanceScale;
          lod.addLevel(make(template.geometry),0);lod.addLevel(make(template.lodGeometry),distance,.12);this.root.add(lod);
        }else{const mesh=make(template.geometry);mesh.position.copy(center);this.root.add(mesh);}
        this.readyCount+=bucket.transforms.length;
      }).catch(error=>this.failed(bucket.kind,error)));
    }
    this.buckets.clear();
  }
  private failed(kind:RenderKind,error:unknown):void {
    if(this.disposed||this.errors.includes(kind))return;this.errors.push(kind);
    const url=(error as {response?:{url?:string}}).response?.url;if(url!=="")console.error(`Jungle asset failed: ${kind}`,error);
  }
  async ready():Promise<void>{await Promise.all(this.jobs);}
  update(dt:number):void{if(!this.disposed)this.time.value+=Math.max(0,Math.min(dt,.1));}
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
      compressedTextures,textureMiB:Math.round(textureBytes/1048576*100)/100,errors:[...this.errors],windTime:this.time.value};
  }
  dispose():void {
    if(this.disposed)return;this.disposed=true;
    this.root.traverse(o=>{if((o as THREE.InstancedMesh).isInstancedMesh)(o as THREE.InstancedMesh).dispose();});
    this.root.removeFromParent();this.root.clear();for(const holder of this.loose){holder.removeFromParent();holder.clear();}this.loose.clear();
    for(const m of this.materials.values())m.dispose();for(const m of this.depths.values())m.dispose();
    this.materials.clear();this.depths.clear();this.buckets.clear();
  }
}
