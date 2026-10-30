import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {Reflector} from 'three/examples/jsm/objects/Reflector.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type {CustomComponent} from './level';
import type {SkateCollectathon} from './skateCollectathon';
import {WarehouseMaterials,warehouseSurfaceUV} from './warehouseMaterials';
import {WAREHOUSE_ASSET_SIZE} from './warehouseAssetMetrics';
import {warehouseTextureLoader} from './warehouseTextureLoader';
import {fitWarehouseWallSection} from './warehouseWallSections';

export const WAREHOUSE_DECOR_KINDS=['warehousewindow','warehousehoist','warehouselight','warehousepipes','warehouseshutter',
 'warehousecabinet','warehousedumpster','warehousefan','warehousejunk','warehouseboiler','warehousecrate','warehousegraffiti','warehousepuddle','warehousetoken','warehouseplaster','warehousestain','warehousependant','warehouseivy','warehousewalllower','warehousewallupper'] as const;
type Kind=typeof WAREHOUSE_DECOR_KINDS[number];
export const WAREHOUSE_DECOR_LABELS:Record<Kind,string>={warehousewindow:'Warehouse / smashed Meshy factory window',warehousehoist:'Warehouse / rusted Meshy crane hoist',
 warehouselight:'Warehouse / failing Meshy fluorescent',warehousepipes:'Warehouse / Meshy utility pipes',warehouseshutter:'Warehouse / graffitied Meshy loading shutter',
 warehousecabinet:'Warehouse / Meshy electrical cabinet',warehousedumpster:'Warehouse / Meshy dumpster',warehousefan:'Warehouse / broken Meshy ventilation fan',
 warehousejunk:'Warehouse / reused Meshy rubbish',warehouseboiler:'Warehouse / reused Meshy boiler',warehousecrate:'Warehouse / reused Meshy wooden crate',
 warehousegraffiti:'Warehouse / original spray-painted mural',warehousepuddle:'Warehouse / reflective shallow puddle',warehousetoken:'Warehouse / collectible bearing medal',warehouseplaster:'Warehouse / crumbling Meshy plaster',warehousestain:'Warehouse / localized sourced concrete staining',warehousependant:'Warehouse / warm Meshy bell lamp',warehouseivy:'Warehouse / reused Meshy trailing ivy',warehousewalllower:'Warehouse / Meshy lower wall section',warehousewallupper:'Warehouse / Meshy upper wall section'};
const FILES:Partial<Record<Kind,string>>={warehousewindow:'warehouse/broken-factory-window.glb',warehousehoist:'warehouse/rusted-crane-hoist.glb',
 warehouselight:'warehouse/industrial-fluorescent.glb',warehousepipes:'warehouse/rusted-pipe-manifold.glb',warehouseshutter:'warehouse/graffiti-shutter.glb',
 warehousecabinet:'warehouse/electrical-cabinet.glb',warehousedumpster:'warehouse/graffiti-dumpster.glb',warehousefan:'warehouse/broken-ventilation-fan.glb',
 warehousejunk:'ghost-train/haunted-junk-v3.glb',warehouseboiler:'ghost-train/haunted-boiler-v3.glb',warehousecrate:'props/wood-crate/classic-wood-crate.glb',
 warehousetoken:'warehouse/warehouse-token.glb',warehouseplaster:'warehouse/broken-plaster-panel.glb',warehousependant:'warehouse/industrial-pendant.glb',warehouseivy:'blockworks-art/hanging-vines.glb',warehousewalllower:'warehouse/factory-wall-lower.glb',warehousewallupper:'warehouse/factory-wall-upper.glb'};
interface Part {geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial;}
interface Template {promise:Promise<Part[]>;refs:number;parts?:Part[];}
interface Lease {promise:Promise<Part[]>;release:()=>void;}
const templates=new Map<Kind,Template>();
function releaseTemplate(kind:Kind,entry:Template):void {
 if(entry.refs||!entry.parts)return;
 if(templates.get(kind)===entry)templates.delete(kind);
 const geometries=new Set(entry.parts.map(p=>p.geometry)),materials=new Set(entry.parts.map(p=>p.material)),textures=new Set<THREE.Texture>(),images=new Set<unknown>();
 for(const material of materials)for(const value of Object.values(material))if((value as THREE.Texture)?.isTexture)textures.add(value as THREE.Texture);
 for(const geometry of geometries)geometry.dispose();for(const material of materials)material.dispose();
 for(const texture of textures){images.add(texture.source.data);texture.dispose();}
 for(const image of images)if(image&&typeof (image as ImageBitmap).close==='function')(image as ImageBitmap).close();
 entry.parts=undefined;
}
function acquire(kind:Kind):Lease {
 let entry=templates.get(kind);
 if(!entry){entry={refs:0,promise:Promise.resolve([])};templates.set(kind,entry);const current=entry;
 const gltfLoader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder),ktx=warehouseTextureLoader();if(ktx)gltfLoader.setKTX2Loader(ktx);
 const promise=new Promise<Part[]>((resolve,reject)=>gltfLoader.load(import.meta.env.BASE_URL+FILES[kind],gltf=>{
  gltf.scene.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(gltf.scene),centre=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
  if(box.isEmpty()){reject(new Error('Empty warehouse model '+kind));return;}
  const scale=kind==='warehousejunk'?1/size.y:kind==='warehouseboiler'?2.4/size.y:kind==='warehousecrate'?1.2/size.y:kind==='warehouseivy'?3/size.y:1;
  const parts:Part[]=[];
  gltf.scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
   const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).translate(-centre.x,-box.min.y,-centre.z).scale(scale,scale,scale);
   if(kind==='warehouselight'){geometry.translate(0,-size.y/2,0).rotateX(Math.PI/2);geometry.computeBoundingBox();geometry.translate(0,-geometry.boundingBox!.min.y,0);}
   geometry.userData.shared=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
   for(const source of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
    const material=source as THREE.MeshStandardMaterial;material.userData.shared=true;
    for(const value of Object.values(material))if((value as THREE.Texture)?.isTexture){const texture=value as THREE.Texture;texture.userData.shared=true;texture.anisotropy=8;}
    parts.push({geometry,material});
   }
  });resolve(parts);
 },undefined,reject)).then(parts=>{current.parts=parts;releaseTemplate(kind,current);return parts;}).catch(error=>{if(templates.get(kind)===current)templates.delete(kind);throw error;});current.promise=promise;
 }
 entry.refs++;const current=entry;let released=false;
 return {promise:entry.promise,release:()=>{if(released)return;released=true;current.refs--;releaseTemplate(kind,current);}};
}

export function warehouseFlicker(time:number,seed:number):number {
 const cycle=(time+seed*2.27)%11.3;
 return cycle>8.9&&cycle<9.5?.28+.35*Math.pow(Math.sin(time*27+seed),2):.94+.04*Math.sin(time*2.4+seed);
}

/** A bounded presentation owner; native surfaces and authored movement stay authoritative. */
export class WarehouseArt {
 readonly root=new THREE.Group();
 readonly materials=new WarehouseMaterials();
 private placements=new Map<Kind,CustomComponent[]>();
 private editorHolders=new Map<CustomComponent,THREE.Group>();
 private contacts=new Map<CustomComponent,THREE.Mesh>();
 private pending:Promise<void>[]=[];
 private leases=new Map<Kind,Lease>();
 private geometries=new Set<THREE.BufferGeometry>();
 private instances:THREE.InstancedMesh[]=[];
 private replaced:{mesh:THREE.Mesh;geometry:THREE.BufferGeometry;material:THREE.Material|THREE.Material[]}[]=[];
 private batchedSources=new Map<THREE.Mesh,boolean>();
 private structuralBatches=0;
 private wallBacking:THREE.MeshStandardMaterial|undefined;
 private wallSections=new Map<string,THREE.BufferGeometry>();
 private fixtures:{p:THREE.Vector3;color:THREE.Color;seed:number}[]=[];
 private fixtureSeeds=new Map<CustomComponent,number>();
 private lightTime={value:0};
 private lights=Array.from({length:4},(_,i)=>{
  const light=new THREE.SpotLight('#ffd09a',0,65,.88,.72,2);
  light.castShadow=i<2;light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.3;light.shadow.camera.far=65;
  light.shadow.bias=-.00015;light.shadow.normalBias=.035;return light;
 });
 private lightAssignments=Array.from({length:4},()=>({fixture:-1,fade:0}));
 private errors:string[]=[];
 private loaded:Kind[]=[];
 private goalModels:THREE.Mesh[]=[];
 private time=0;
 private released=false;
 private settled=false;
 private cube:THREE.WebGLCubeRenderTarget|null=null;
 private environment:THREE.WebGLRenderTarget|null=null;
 private puddles:THREE.Mesh[]=[];
 private mirror:Reflector|null=null;
 private mirrorMap={value:null as THREE.Texture|null};
 private mirrorMatrix={value:new THREE.Matrix4()};
 private mirrorHeight={value:-1000};
 private mirrorActive={value:0};
 private mirrorFrustum=new THREE.Frustum();
 private mirrorProjection=new THREE.Matrix4();
 private mirrorInverse=new THREE.Matrix4();
 private mirrorPoint=new THREE.Vector3();
 private reflectionFrames=0;
 private dust:THREE.Points|null=null;
 constructor(private readonly parent:THREE.Group,private readonly editor=false){this.root.name='Warehouse / authored derelict presentation';parent.add(this.root);}
 add(c:CustomComponent,contact?:THREE.Mesh):void {
  const kind=c.dkind as Kind;const list=this.placements.get(kind)??[];list.push(c);this.placements.set(kind,list);
  if(contact)this.contacts.set(c,contact);
  if(this.editor){const holder=new THREE.Group();holder.name=c.nm??WAREHOUSE_DECOR_LABELS[kind];this.parent.add(holder);this.editorHolders.set(c,holder);}
 }
 private asset(kind:Kind):Promise<Part[]> {let lease=this.leases.get(kind);if(!lease){lease=acquire(kind);this.leases.set(kind,lease);}return lease.promise;}
 goals(goals:SkateCollectathon):void {
  this.pending.push(this.asset('warehousetoken').then(parts=>{
   if(this.released)return;
   for(const token of goals.tokens){
    const original=token.group.children[0];if(original)original.visible=false;
    const ring=token.group.children[1] as THREE.Mesh;if(ring?.material)(ring.material as THREE.MeshBasicMaterial).color.set('#78d9cc');
    for(const part of parts){const material=this.materials.own(part.material.clone());material.userData.shared=false;material.emissive.set('#9e671b');material.emissiveIntensity=.2;
     const mesh=new THREE.Mesh(part.geometry,material);mesh.position.y=-.6;mesh.castShadow=true;mesh.userData.visualOnly=true;mesh.userData.solidSurface='none';token.group.add(mesh);this.goalModels.push(mesh);}
   }this.loaded.push('warehousetoken');
  }).catch(()=>{if(!this.released)this.errors.push(FILES.warehousetoken!);}));
 }
 private geometry<T extends THREE.BufferGeometry>(g:T):T {this.geometries.add(g);return g;}
 private mesh(g:THREE.BufferGeometry,m:THREE.Material):THREE.Mesh {const mesh=new THREE.Mesh(g,m);mesh.userData.visualOnly=true;mesh.userData.solidSurface='none';mesh.receiveShadow=true;this.root.add(mesh);return mesh;}
 flush():void {
  for(const[kind,placements]of this.placements){
   if(kind==='warehousegraffiti'){this.graffiti(placements);continue;}
   if(kind==='warehousepuddle'){this.water(placements);continue;}
   if(kind==='warehousestain'){this.stains(placements);continue;}
   this.pending.push(this.asset(kind).then(parts=>{
    if(this.released)return;
    const isWall=kind==='warehousewalllower'||kind==='warehousewallupper';
    const clusters=new Map<string,CustomComponent[]>();
    for(const c of placements){const key=isWall?Math.floor(c.p[0]/48)+':'+Math.floor(c.p[2]/48)+':'+c.s?.map(v=>v.toFixed(4)).join(',')+':'+(c.vr??0):'all';const list=clusters.get(key)??[];list.push(c);clusters.set(key,list);}
    for(const part of parts){const material=this.materials.own(part.material.clone());material.userData.shared=false;material.envMapIntensity=.65;
     if(kind==='warehousewindow')material.side=THREE.DoubleSide;
     const isLight=kind==='warehouselight'||kind==='warehousependant';
     const geometry=isLight?this.geometry(part.geometry.clone()):part.geometry;
     if(isLight){
      geometry.setAttribute('warehousePhase',new THREE.InstancedBufferAttribute(new Float32Array(placements.map(c=>this.fixtureSeeds.get(c)??0)),1));
      material.onBeforeCompile=shader=>{
       shader.uniforms.warehouseLightTime=this.lightTime;
       shader.vertexShader='attribute float warehousePhase;varying float vWarehousePhase;varying vec3 vWarehouseLampLocal;\n'+shader.vertexShader;
       shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWarehousePhase=warehousePhase;vWarehouseLampLocal=position;');
       shader.fragmentShader='uniform float warehouseLightTime;varying float vWarehousePhase;varying vec3 vWarehouseLampLocal;\n'+shader.fragmentShader;
       const region=kind==='warehouselight'?'step(vWarehouseLampLocal.y,.19)*step(abs(vWarehouseLampLocal.x),1.14)':'step(vWarehouseLampLocal.y,.7)*step(length(vWarehouseLampLocal.xz),.48)';
       shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\nfloat lampLightness=dot(diffuseColor.rgb,vec3(.333333));
        float lampChroma=max(max(diffuseColor.r,diffuseColor.g),diffuseColor.b)-min(min(diffuseColor.r,diffuseColor.g),diffuseColor.b);
        float lampMask=${region}*smoothstep(.26,.58,lampLightness)*(1.-smoothstep(.18,.32,lampChroma));
        float lampCycle=mod(warehouseLightTime+vWarehousePhase*2.27,11.3);
        float lampFlicker=lampCycle>8.9&&lampCycle<9.5?.28+.35*pow(sin(warehouseLightTime*27.+vWarehousePhase),2.):.94+.04*sin(warehouseLightTime*2.4+vWarehousePhase);
        totalEmissiveRadiance+=vec3(1.,.66,.31)*lampMask*lampFlicker*2.8;`);
      };material.customProgramCacheKey=()=> 'warehouse-emissive-source-region-'+kind+'-v1';
     }
     for(const cluster of clusters.values()){
     let section=geometry;
     if(isWall){const nominal=WAREHOUSE_ASSET_SIZE[kind as keyof typeof WAREHOUSE_ASSET_SIZE],size=cluster[0].s??nominal,variant=cluster[0].vr??0,key=geometry.uuid+':'+size.map(v=>v.toFixed(4)).join(',')+':'+variant;
      section=this.wallSections.get(key)??this.geometry(fitWarehouseWallSection(geometry,nominal,size,kind==='warehousewalllower',variant));this.wallSections.set(key,section);
     }
     const mesh=new THREE.InstancedMesh(section,material,cluster.length);mesh.name=WAREHOUSE_DECOR_LABELS[kind];mesh.castShadow=kind!=='warehousejunk'&&!isWall;mesh.receiveShadow=true;
     mesh.userData.visualOnly=true;mesh.userData.assetBatchRoot=true;mesh.userData.solidSurface='none';
     if(isWall)mesh.userData.warehouseWall=true;
     const matrix=new THREE.Matrix4(),quaternion=new THREE.Quaternion();cluster.forEach((c,i)=>{
      const yaw=(c.yaw??0)+(kind==='warehousewindow'&&(c.vr??0)%2?180:0);
      quaternion.setFromAxisAngle(new THREE.Vector3(0,1,0),yaw*Math.PI/180);const scale=c.w??1,nominal=WAREHOUSE_ASSET_SIZE[kind as keyof typeof WAREHOUSE_ASSET_SIZE],size=c.s??nominal;
      matrix.compose(new THREE.Vector3(...c.p),quaternion,(isWall?new THREE.Vector3(1,1,1):new THREE.Vector3(size[0]/nominal[0],size[1]/nominal[1],size[2]/nominal[2])).multiplyScalar(scale));mesh.setMatrixAt(i,matrix);
      const holder=this.editorHolders.get(c);if(holder){const own=new THREE.Mesh(section,material);own.matrix.copy(matrix);own.matrixAutoUpdate=false;own.castShadow=!isWall;own.receiveShadow=true;own.userData.solidSurface='none';holder.add(own);}
     });mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();this.root.add(mesh);this.instances.push(mesh);
     if(this.editor)mesh.visible=false;
     }
    }this.loaded.push(kind);
   }).catch(()=>{if(!this.released){this.errors.push(FILES[kind]??kind);for(const c of placements){const contact=this.contacts.get(c);if(contact)contact.visible=true;}}}));
   if(kind==='warehouselight'||kind==='warehousependant')for(const c of placements)this.fixture(c);
   if(kind==='warehousewindow')placements.filter((c,i)=>(c.yaw??0)===90&&i%2===0).forEach(c=>this.shaft(c));
  }
  this.makeDust();
 }
 dress(components:readonly CustomComponent[]):void {
  this.parent.updateMatrixWorld(true);
  const groups=new Map<string,THREE.Mesh[]>(),centre=new THREE.Vector3();
  this.parent.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;
   let index:number|undefined;for(let at:THREE.Object3D|null=o;at&&at!==this.parent;at=at.parent)if(Number.isInteger(at.userData.editorIdx)){index=at.userData.editorIdx;break;}
   if(index===undefined)return;const c=components[index];if(!c||c.t==='decor'||c.t==='checkpoint'||c.t==='gate'||c.t==='wumpa')return;
   const name=c.nm??'';
   const original=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
   // Greybox floor guides also cross the halfpipe at its zero-height bottom.
   // The scanned concrete provides the finished surface detail without those
   // raised guide strips showing through the plywood.
   if(c.invisible||/Enclosed warehouse walls|Floor expansion joint/.test(name)){
    this.replaced.push({mesh,geometry:mesh.geometry,material:mesh.material});const invisible=this.materials.own(new THREE.MeshBasicMaterial({color:'#4ca4b5',side:original.side,wireframe:true,transparent:true,opacity:.2}));invisible.visible=this.editor;mesh.material=invisible;return;
   }
   if(!['mesh','platform','ramp','wall','vertramp','rail','mover'].includes(c.t)||/Route direction|expansion joint/.test(name))return;
   const wood=c.t==='vertramp'&&c.vkind==='half'&&(mesh.userData.vertRampMesh||mesh.userData.halfpipe),masonry=/Warehouse masonry/.test(name);
   const trim=c.t==='rail'||/receiving edge|takeoff edge|Arrival lip|polished coping|cap edging/.test(name);
   const detail=/Construction joint|Plywood panel seam|Warehouse painted marking/.test(name);
   const steel=c.t==='wall'||trim||/truss|purlin|crosshead|brace|suspension|hanger|support|header|Roof longitudinal|Crane bridge|Crane runway|Warehouse roof|steel fascia|cable tray/.test(name);
   this.replaced.push({mesh,geometry:mesh.geometry,material:mesh.material});
   const g=masonry?mesh.geometry:warehouseSurfaceUV(mesh,wood?2.4:steel?2.5:name==='Continuous concrete floor'?6:4.5,wood?c:undefined,c.t==='mesh'&&!!c.grindTopTriangles);
   if(!masonry){this.geometries.add(g);mesh.geometry=g;}
   // The visible walls are complete Meshy sections with their original UVs
   // and textures. This untextured backing only seals joins and casts shadows.
   const surface=wood?'plywood':steel?(/Crane bridge/.test(name)?'rust':'steel'):'concrete';
   // Level colors carry the distinction between riding decks and landmarks.
   // Keep them when adding sourced PBR detail instead of flattening the park
   // into one cream tint. Meshy wall sections keep their own material path.
   const tint=c.color??(wood?'#cdb69b':steel?'#bac4c0':'#d0d0cb');
   mesh.material=masonry?(this.wallBacking??=this.materials.own(new THREE.MeshStandardMaterial({color:'#a19b8b',roughness:1,side:THREE.DoubleSide}))):
    trim?this.materials.finish('#929c9d',original.side,.55,.42):detail?this.materials.finish(tint,original.side):
    this.materials.surface(surface,tint,original.side,original.userData.texKind,c.depthBias??0);
   mesh.receiveShadow=true;
   if(!this.editor&&c.t==='mesh'&&c.solid===false&&mesh.visible){
    g.computeBoundingBox();g.boundingBox!.getCenter(centre).applyMatrix4(mesh.matrixWorld);
    const key=mesh.material.uuid+':'+mesh.castShadow+':'+Math.floor(centre.x/64)+':'+Math.floor(centre.z/64);
    const group=groups.get(key)??[];group.push(mesh);groups.set(key,group);
   }
  });
  // Static, nonphysical framing shares draw calls in local sections. The
  // source meshes stay individually editable and never supply new contacts.
  const inverse=this.parent.matrixWorld.clone().invert();
  for(const meshes of groups.values()){
   if(meshes.length<2)continue;
   const parts=meshes.map(mesh=>{
    const part=mesh.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld));
    for(const name of Object.keys(part.attributes))if(!['position','normal','uv','uv1'].includes(name))part.deleteAttribute(name);
    return part;
   });
   const geometry=mergeGeometries(parts,false);for(const part of parts)part.dispose();
   if(!geometry)continue;
   this.geometry(geometry);const batch=this.mesh(geometry,meshes[0].material as THREE.Material);
   batch.name='Warehouse / static structural section';batch.castShadow=meshes[0].castShadow;this.structuralBatches++;
   for(const mesh of meshes){this.batchedSources.set(mesh,mesh.visible);mesh.visible=false;}
  }
 }
 private graffiti(placements:CustomComponent[]):void {
  const material=this.materials.own(new THREE.MeshStandardMaterial({alphaTest:.12,roughness:1,metalness:0,polygonOffset:true,polygonOffsetFactor:-2,depthWrite:false,side:THREE.DoubleSide}));
  this.materials.bind(material,'map','warehouse/graffiti.webp',true,true);
  for(const c of placements){const geometry=this.geometry(new THREE.PlaneGeometry(c.s?.[0]??9,c.s?.[1]??5)),uv=geometry.getAttribute('uv'),tile=(c.vr??0)%4;
   for(let i=0;i<uv.count;i++)uv.setXY(i,(uv.getX(i)+(tile%2))*.5,(uv.getY(i)+(tile<2?1:0))*.5);
   const mesh=this.mesh(geometry,material);mesh.position.set(c.p[0],c.p[1]+(c.s?.[1]??5)/2,c.p[2]);mesh.rotation.y=(c.yaw??0)*Math.PI/180;mesh.name=c.nm??'Original warehouse spraypaint';
   this.editorHolders.get(c)?.add(mesh);
  }
 }
 private water(placements:CustomComponent[]):void {
  const material=this.materials.own(new THREE.MeshStandardMaterial({color:'#54575a',roughness:.09,metalness:0,transparent:true,opacity:.74,depthWrite:false,envMapIntensity:1,polygonOffset:true,polygonOffsetFactor:-1}));
  this.mirror=new Reflector(new THREE.PlaneGeometry(1,1),{textureWidth:512,textureHeight:384,clipBias:.003,multisample:0});
  this.mirror.rotation.x=-Math.PI/2;this.mirror.getRenderTarget().texture.type=THREE.UnsignedByteType;
  this.mirrorMap.value=this.mirror.getRenderTarget().texture;
  material.onBeforeCompile=shader=>{
   Object.assign(shader.uniforms,{warehouseMirror:this.mirrorMap,warehouseMirrorMatrix:this.mirrorMatrix,warehouseMirrorHeight:this.mirrorHeight,warehouseMirrorActive:this.mirrorActive});
   shader.vertexShader='attribute float warehouseWaterFade;varying float vWarehouseWaterFade;uniform mat4 warehouseMirrorMatrix;varying vec4 vWarehouseMirror;varying float vWarehouseWaterY;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvWarehouseWaterFade=warehouseWaterFade;vec4 warehouseWaterWorld=modelMatrix*vec4(transformed,1.0);vWarehouseWaterY=warehouseWaterWorld.y;vWarehouseMirror=warehouseMirrorMatrix*warehouseWaterWorld;');
   shader.fragmentShader='uniform sampler2D warehouseMirror;uniform float warehouseMirrorHeight;uniform float warehouseMirrorActive;varying float vWarehouseWaterFade;varying vec4 vWarehouseMirror;varying float vWarehouseWaterY;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`\nif(warehouseMirrorActive>.5&&abs(vWarehouseWaterY-warehouseMirrorHeight)<.1&&vWarehouseMirror.w>0.0){
    vec2 uv=vWarehouseMirror.xy/vWarehouseMirror.w;vec2 pixel=vec2(1.0/512.0,1.0/384.0);
    vec3 reflected=texture2D(warehouseMirror,uv).rgb*.4;
    reflected+=(texture2D(warehouseMirror,uv+vec2(pixel.x,0.)).rgb+texture2D(warehouseMirror,uv-vec2(pixel.x,0.)).rgb+texture2D(warehouseMirror,uv+vec2(0.,pixel.y)).rgb+texture2D(warehouseMirror,uv-vec2(0.,pixel.y)).rgb)*.15;
    float edge=step(0.,uv.x)*step(uv.x,1.)*step(0.,uv.y)*step(uv.y,1.);
    float fresnel=.28+.65*pow(1.-max(0.,dot(normal,normalize(vViewPosition))),3.);
    outgoingLight=mix(outgoingLight,reflected*vec3(.90,.95,.96),edge*fresnel);
   }\ndiffuseColor.a*=smoothstep(0.,.9,vWarehouseWaterFade);\n#include <opaque_fragment>`);
  };material.customProgramCacheKey=()=> 'warehouse-shared-planar-puddle-v1';
  for(const [index,c]of placements.entries()){
   const w=(c.s?.[0]??8)/2,d=(c.s?.[2]??4)/2,vertices=[0,0,0],fade=[1],indices:number[]=[];
   for(const ring of[.82,1])for(let i=0;i<36;i++){const a=i/36*Math.PI*2,r=ring*(1+.10*Math.sin(a*3+index)+.045*Math.sin(a*7-index));vertices.push(Math.cos(a)*w*r,0,Math.sin(a)*d*r);fade.push(ring===1?0:1);}
   for(let i=0;i<36;i++){const j=(i+1)%36;indices.push(0,1+j,1+i,1+i,1+j,37+j,1+i,37+j,37+i);}
   const geometry=this.geometry(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('warehouseWaterFade',new THREE.Float32BufferAttribute(fade,1));geometry.setIndex(indices);geometry.computeVertexNormals();
   const mesh=this.mesh(geometry,material);mesh.position.set(c.p[0],c.p[1]+.022,c.p[2]);mesh.rotation.y=(c.yaw??0)*Math.PI/180;mesh.name='Shallow rainwater / dry traction retained';this.puddles.push(mesh);
   mesh.renderOrder=3;
   this.editorHolders.get(c)?.add(mesh);
  }
 }
 private stains(placements:CustomComponent[]):void {
  const material=this.materials.own(new THREE.MeshStandardMaterial({color:'#a1a09b',roughness:.95,transparent:true,opacity:.64,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
  this.materials.bind(material,'map','warehouse/materials/grime-diff.webp',true,true);
  material.onBeforeCompile=shader=>{
   shader.vertexShader='attribute float warehouseStainFade;varying float vWarehouseStainFade;\n'+shader.vertexShader;
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvWarehouseStainFade=warehouseStainFade;');
   shader.fragmentShader='varying float vWarehouseStainFade;\n'+shader.fragmentShader;
   shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=smoothstep(0.,.9,vWarehouseStainFade);');
  };material.customProgramCacheKey=()=> 'warehouse-local-source-stain-v1';
  for(const [seed,c]of placements.entries()){
   const w=c.s?.[0]??8,d=c.s?.[2]??5,vertices=[0,0,0],uv=[.5,.5],fade=[1],indices:number[]=[];
   for(const ring of[.7,1])for(let i=0;i<32;i++){const a=i/32*Math.PI*2,r=ring*(1+.14*Math.sin(a*3+seed)+.06*Math.sin(a*5-seed));const x=Math.cos(a)*w*.5*r,z=Math.sin(a)*d*.5*r;vertices.push(x,0,z);uv.push(x/w+.5,z/d+.5);fade.push(ring===1?0:1);}
   for(let i=0;i<32;i++){const j=(i+1)%32;indices.push(0,j+1,i+1,i+1,j+1,j+33,i+1,j+33,i+33);}
   const geometry=this.geometry(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geometry.setAttribute('warehouseStainFade',new THREE.Float32BufferAttribute(fade,1));geometry.setIndex(indices);geometry.computeVertexNormals();
   const mesh=this.mesh(geometry,material);mesh.position.set(c.p[0],c.p[1]+.012,c.p[2]);mesh.rotation.y=(c.yaw??0)*Math.PI/180;mesh.renderOrder=1;mesh.name='Localized water and machine stains / licensed scan';this.editorHolders.get(c)?.add(mesh);
  }
 }
 private fixture(c:CustomComponent):void {
  if(!this.fixtures.length)for(const light of this.lights)this.root.add(light,light.target);
  const seed=this.fixtures.length;this.fixtureSeeds.set(c,seed);
  this.fixtures.push({p:new THREE.Vector3(...c.p),color:new THREE.Color(c.color??'#ffc68a'),seed});
 }
 private shaft(c:CustomComponent):void {
  const material=this.materials.own(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,
   uniforms:{tint:{value:new THREE.Color('#edcc96')}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'varying vec2 vUv;uniform vec3 tint;void main(){float edge=pow(max(0.0,sin(vUv.x*3.14159265)),1.8);float lengthFade=smoothstep(0.0,0.12,vUv.y)*pow(1.0-vUv.y,.7);gl_FragColor=vec4(tint,edge*lengthFade*.045);#include <colorspace_fragment>\n}'.replace(';#include',';\n#include')}));
  // Align the visible dust volume with the authored daylight through the
  // resized room. This is atmosphere; the real window mesh casts the light.
  const x=c.p[0]+.25,z=c.p[2],v=[x,27,z-7,x,27,z+7,x+39,2,z+19,x+39,2,z+5];
  const g=this.geometry(new THREE.BufferGeometry());g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();
  const mesh=this.mesh(g,material);mesh.name='Broken window / suspended dust light shaft';mesh.renderOrder=2;
 }
 private makeDust():void {
  const positions=new Float32Array(160*3);for(let i=0;i<160;i++){positions[i*3]=Math.sin(i*31.19)*50;positions[i*3+1]=1+(Math.sin(i*12.73)*.5+.5)*30;positions[i*3+2]=-58+Math.cos(i*17.31)*70;}
  const geometry=this.geometry(new THREE.BufferGeometry());geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=this.materials.own(new THREE.PointsMaterial({color:'#dfc49b',size:.06,transparent:true,opacity:.20,depthWrite:false,sizeAttenuation:true}));
  this.dust=new THREE.Points(geometry,material);this.dust.userData.solidSurface='none';this.root.add(this.dust);
 }
 async ready():Promise<void>{await Promise.all(this.pending);await this.materials.ready();if(!this.released)this.settled=true;}
 invalidateEnvironment():void {
  for(const material of this.materials.materials)if((material as THREE.MeshStandardMaterial).isMeshStandardMaterial){const m=material as THREE.MeshStandardMaterial;m.envMap=null;m.needsUpdate=true;}
  this.environment?.dispose();this.cube?.dispose();this.environment=null;this.cube=null;this.mirrorActive.value=0;
 }
 renderReflection(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera):void {
  this.mirrorActive.value=0;if(this.released||!this.settled||!this.mirror)return;
  if(!this.cube&&this.loaded.length)this.captureEnvironment(renderer,scene);
  camera.updateMatrixWorld();this.mirrorProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);this.mirrorFrustum.setFromProjectionMatrix(this.mirrorProjection);
  let selected:THREE.Mesh|null=null,distance=Infinity;
  for(const puddle of this.puddles){puddle.getWorldPosition(this.mirrorPoint);const d=this.mirrorPoint.distanceToSquared(camera.position);
   if(this.mirrorPoint.y<camera.position.y-.15&&d<60*60&&d<distance&&this.mirrorFrustum.intersectsObject(puddle)){selected=puddle;distance=d;}}
  if(!selected)return;
  selected.getWorldPosition(this.mirrorPoint);this.mirrorHeight.value=this.mirrorPoint.y;
  this.mirror.position.set(0,this.mirrorHeight.value,0);this.mirror.updateMatrixWorld(true);
  for(const mesh of this.puddles)mesh.visible=false;
  const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();
  const tone=renderer.toneMapping,exposure=renderer.toneMappingExposure;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
  renderer.setScissorTest(false);
  try{this.mirror.onBeforeRender(renderer,scene,camera,this.mirror.geometry,this.mirror.material as THREE.Material,null as never);}
  finally{renderer.toneMapping=tone;renderer.toneMappingExposure=exposure;renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);for(const mesh of this.puddles)mesh.visible=true;}
  const matrix=(this.mirror.material as THREE.ShaderMaterial).uniforms.textureMatrix.value as THREE.Matrix4;
  this.mirrorMatrix.value.copy(matrix).multiply(this.mirrorInverse.copy(this.mirror.matrixWorld).invert());this.mirrorActive.value=1;this.reflectionFrames++;
 }
 captureEnvironment(renderer:THREE.WebGLRenderer,scene:THREE.Scene):void {
  if(this.released||!this.settled||this.cube||!this.loaded.length)return;
  // A bounded capture prevents a single invalid/high-energy source texel
  // from poisoning every roughness mip during environment convolution.
  this.cube=new THREE.WebGLCubeRenderTarget(128,{type:THREE.UnsignedByteType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const camera=new THREE.CubeCamera(.2,400,this.cube);camera.position.set(0,10,-86);
  for(const mesh of this.puddles)mesh.visible=false;
  const viewport=renderer.getViewport(new THREE.Vector4()),scissor=renderer.getScissor(new THREE.Vector4()),scissorTest=renderer.getScissorTest();renderer.setScissorTest(false);
  const tone=renderer.toneMapping,exposure=renderer.toneMappingExposure;renderer.toneMapping=THREE.NoToneMapping;renderer.toneMappingExposure=1;
  const shadow=renderer.shadowMap.autoUpdate;renderer.shadowMap.autoUpdate=false;
  let generator:THREE.PMREMGenerator|null=null;
  try{camera.update(renderer,scene);generator=new THREE.PMREMGenerator(renderer);this.environment=generator.fromCubemap(this.cube.texture);}
  finally{generator?.dispose();renderer.toneMapping=tone;renderer.toneMappingExposure=exposure;renderer.shadowMap.autoUpdate=shadow;for(const mesh of this.puddles)mesh.visible=true;renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);}
  for(const material of this.materials.materials)if((material as THREE.MeshStandardMaterial).isMeshStandardMaterial){const m=material as THREE.MeshStandardMaterial;m.envMap=this.environment.texture;m.needsUpdate=true;}
 }
 update(dt:number,player:THREE.Vector3):void {
  if(this.released||!Number.isFinite(dt))return;this.time+=Math.max(0,dt);
  this.lightTime.value=this.editor?0:this.time;
  const near=this.fixtures.map((f,index)=>({index,distance:f.p.distanceToSquared(player)})).sort((a,b)=>a.distance-b.distance).slice(0,this.lights.length).map(f=>f.index);
  // A lamp fades out before its bounded light slot is reused. Moving through
  // a route cannot teleport a bright pool or its shadow across the floor.
  this.lights.forEach((light,i)=>{
   const slot=this.lightAssignments[i],wanted=near.includes(slot.fixture);
   slot.fade=THREE.MathUtils.clamp(slot.fade+(wanted?1:-1)*dt*3,0,1);
   if(slot.fade===0&&!wanted){slot.fixture=near.find(index=>!this.lightAssignments.some(s=>s.fixture===index))??-1;}
   const f=this.fixtures[slot.fixture];if(!f){light.intensity=0;return;}
   light.position.copy(f.p);light.position.y-=.08;light.target.position.copy(f.p);light.target.position.y-=20;
   light.color.copy(f.color);light.intensity=1300*slot.fade*warehouseFlicker(this.time,f.seed);
  });
  if(this.dust)this.dust.position.y=Math.sin(this.time*.07)*.5;
 }
 get diagnostics(){return {loaded:this.loaded,models:this.instances.length,instances:this.instances.reduce((n,m)=>n+m.count,0),fixtures:this.fixtures.length,
  artReady:this.settled,structuralBatches:this.structuralBatches,batchedSources:this.batchedSources.size,dynamicLights:this.fixtures.length?this.lights.length:0,puddles:this.puddles.length,collectibleModels:this.goalModels.length,reflectionReady:!!this.cube,reflectionFrames:this.reflectionFrames,reflectionSize:[512,384],errors:[...this.errors,...this.materials.errors]};}
 dispose():void {
  if(this.released)return;this.released=true;for(const{mesh,geometry,material}of this.replaced){mesh.geometry=geometry;mesh.material=material;}this.replaced.length=0;
  for(const[mesh,visible]of this.batchedSources)mesh.visible=visible;this.batchedSources.clear();
  this.wallSections.clear();
  for(const light of this.lights)light.shadow.dispose();
  for(const mesh of this.instances)mesh.dispose();for(const holder of this.editorHolders.values())holder.removeFromParent();this.editorHolders.clear();this.contacts.clear();for(const mesh of this.goalModels)mesh.removeFromParent();this.goalModels.length=0;for(const g of this.geometries)g.dispose();this.materials.dispose();this.mirror?.geometry.dispose();this.mirror?.dispose();this.environment?.dispose();this.cube?.dispose();this.root.removeFromParent();
  for(const lease of this.leases.values())lease.release();this.leases.clear();this.geometries.clear();
 }
}
