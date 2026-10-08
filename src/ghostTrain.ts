import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CustomComponent } from './level';
import type { EnemyAnimationFrame, EnemyKind, EnemyVisual, EnemyVisualDiagnostics } from './enemies/types';
import { characterElasticityAmplitudes } from './animation/elasticity';
import { enemyElasticPulse } from './enemies/elasticity';
import { createGhostClockwork, type GhostClockwork } from './ghostClockwork';
import { GhostAtmosphere, GHOST_EFFECT_KINDS, ghostFlicker, ghostGlow } from './ghostAtmosphere';

/** Presentation skins only. Movement, contacts and pendulum timing stay native. */
export const GHOST_STATIC_KINDS=['ghostwallbay','ghostbanquettable','ghostchandelier','ghosttrestle','ghostmonsterportal','ghostflagstone','ghostbathwall','ghostbatharch','ghostjunk','ghostboiler'] as const;
type GhostStaticKind=typeof GHOST_STATIC_KINDS[number];
export const GHOST_DECOR_KINDS = ['ghostcart','ghostaxe','ghostknight','ghostfood','ghostcake','ghostarch','ghostshowlight','ghostclockwork',...GHOST_STATIC_KINDS,...GHOST_EFFECT_KINDS] as const;
export type GhostDecorKind = typeof GHOST_DECOR_KINDS[number];
export const GHOST_DECOR_LABELS:Record<GhostDecorKind,string> = {
  ghostcart:'Ghost train cart',ghostaxe:'Castle swinging axe',ghostknight:'Clockwork haunted armour',
  ghostfood:'Animatronic banquet turkey',ghostcake:'Animatronic banquet cake',ghostarch:'Haunted castle arch',
  ghostshowlight:'Castle theatrical spotlight',
  ghostclockwork:'Animated castle counterweight machine',
  ghostwallbay:'Meshy carved castle window bay',ghostbanquettable:'Meshy ornate banquet table',ghostchandelier:'Meshy castle chandelier',
  ghosttrestle:'Meshy ruined railway trestle',ghostmonsterportal:'Meshy monster-faced portal',ghostflagstone:'Meshy worn castle flagstone',
  ghostbathwall:'Meshy derelict bathhouse tiles',ghostbatharch:'Meshy ruined bathhouse arch',ghostjunk:'Meshy abandoned ride rubbish',ghostboiler:'Meshy leaking bathhouse boiler',
  ghoststeam:'Drifting green ghost steam',ghostgraffiti:'Derelict ride spray paint',ghostneon:'Flickering ghost train neon',ghostslime:'Glowing stagnant bath water',
};
export const GHOST_ASSETS = {
  ghostcart:'ghost-train/ghost-cart.glb',ghostarch:'ghost-train/castle-arch.glb',
  ghostfood:'ghost-train/banquet-turkey.glb',ghostcake:'ghost-train/banquet-cake.glb',
  ghostknight:'ghost-train/clockwork-knight.glb',
  ghostwallbay:'ghost-train/castle-wall-window-v2.glb',ghostbanquettable:'ghost-train/banquet-table-v2.glb',
  ghostaxe:'ghost-train/skull-axe-head-v2.glb',ghostchandelier:'ghost-train/castle-chandelier-v2.glb',
  ghosttrestle:'ghost-train/broken-rail-trestle-v2.glb',ghostmonsterportal:'ghost-train/monster-face-portal-v2.glb',
  ghostclockwork:'ghost-train/castle-clockwork-v2.glb',ghostflagstone:'ghost-train/castle-flagstone-v2.glb',
  ghostcartface:'ghost-train/demon-cart-face-v2.glb',
  ghostbathwall:'ghost-train/bathhouse-wall-v3.glb',ghostbatharch:'ghost-train/bathhouse-arch-v3.glb',
  ghostjunk:'ghost-train/haunted-junk-v3.glb',ghostboiler:'ghost-train/haunted-boiler-v3.glb',
} as const;
export const GHOST_STATIC_SIZES:Record<GhostStaticKind,[number,number,number]>={
  ghostwallbay:[2.72,5.4,2.40],ghostbanquettable:[1.67,1.3,3.40],ghostchandelier:[3.24,3.2,3.24],
  ghosttrestle:[2.15,1.49,6],ghostmonsterportal:[9,9,8.84],ghostflagstone:[2.4,.0961,2.15],
  ghostbathwall:[2.63,4.5,.53],ghostbatharch:[4.9,4.1,3.63],ghostjunk:[2,1,1.6],ghostboiler:[1.8,2.4,1.6],
};
type AssetKind=keyof typeof GHOST_ASSETS;
type AssetStatus='loading'|'ready'|'error';
interface Asset {scene:THREE.Group;bounds:THREE.Box3;}
interface AssetEntry {status:AssetStatus;promise:Promise<Asset|null>;error?:string;}
const templates=new Map<AssetKind,AssetEntry>();
function asset(kind:AssetKind):AssetEntry {
  const existing=templates.get(kind);if(existing)return existing;
  const entry:AssetEntry={status:'loading',promise:Promise.resolve(null)};
  entry.promise=new Promise(resolve=>new GLTFLoader().load(import.meta.env.BASE_URL+GHOST_ASSETS[kind],gltf=>{
    gltf.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(gltf.scene);
    if(bounds.isEmpty()){entry.status='error';entry.error='Empty Meshy asset';resolve(null);return;}
    gltf.scene.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.geometry.userData.shared=true;
      // These names are measured triangle regions exported from the original
      // Meshy surfaces. Emit light only from their pane/iris geometry; retain
      // the unmodified albedo atlas and UVs on the surrounding stone.
      if(mesh.name==='WindowGlass'||mesh.name==='PortalEyes'){
        const source=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        const glowing=source.map(material=>{const own=material.clone() as THREE.MeshStandardMaterial;
          own.emissive.set(mesh.name==='WindowGlass'?'#56d77d':'#85ff39');own.emissiveIntensity=mesh.name==='WindowGlass'?1.4:2.2;own.emissiveMap=null;
          own.roughness=mesh.name==='WindowGlass'?.42:.55;own.metalness=0;own.userData.ghostEmissionRegion=mesh.name;return own;});
        mesh.material=Array.isArray(mesh.material)?glowing:glowing[0];
      }
      if(kind==='ghostchandelier')for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        const standard=material as THREE.MeshStandardMaterial;if(standard.isMeshStandardMaterial){standard.metalness=Math.min(standard.metalness,.15);standard.roughness=.52;standard.color.multiplyScalar(1.12);}
      }
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        material.userData.shared=true;
        for(const value of Object.values(material))if((value as THREE.Texture)?.isTexture){
          const texture=value as THREE.Texture;texture.userData.shared=true;texture.anisotropy=4;
        }
      }
    });
    entry.status='ready';resolve({scene:gltf.scene,bounds});
  },undefined,error=>{
    entry.status='error';entry.error=error instanceof Error?error.message:String(error);
    // The Node collision harness deliberately answers artwork requests 404.
    if((error as {response?:{url?:string}}).response?.url)console.warn('Ghost train Meshy artwork failed to load',kind,error);
    resolve(null);
  }));
  templates.set(kind,entry);return entry;
}
function material(color:number,emissive=0):THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({color,roughness:.83,metalness:.18,emissive,flatShading:true});
}
function box(parent:THREE.Object3D,size:[number,number,number],position:[number,number,number],mat:THREE.Material,name=''):THREE.Mesh {
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...position);m.name=name;
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(parent:THREE.Object3D,top:number,bottom:number,height:number,position:[number,number,number],mat:THREE.Material,sides=8):THREE.Mesh {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,sides),mat);m.position.set(...position);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function disposeOwned(root:THREE.Object3D):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    if(!mesh.geometry.userData.shared)geometries.add(mesh.geometry);
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(!mat.userData.shared)materials.add(mat);
  });
  for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();root.removeFromParent();root.clear();
}
function fitted(a:Asset,height:number,size?:[number,number,number]):THREE.Group {
  const root=new THREE.Group(),model=a.scene.clone(true),span=a.bounds.getSize(new THREE.Vector3());
  model.position.set(-(a.bounds.min.x+a.bounds.max.x)/2,-a.bounds.min.y,-(a.bounds.min.z+a.bounds.max.z)/2);
  root.add(model);root.scale.set(...(size?[size[0]/span.x,size[1]/span.y,size[2]/span.z] as [number,number,number]:[height/span.y,height/span.y,height/span.y] as [number,number,number]));
  root.userData.meshyAsset=true;return root;
}
/** Uniform semantic fitting of the delivered Meshy models. Every c.p remains
 * the model base; source placements align their measured functional planes.
 * c.w overrides scale in metres per normalized source unit. */
function placementMetrics(a:Asset,c:CustomComponent,defaults:[number,number,number]):{scale:number;anchor:number;center:THREE.Vector3;rotation:THREE.Quaternion} {
  const bounds=c.s??defaults,span=a.bounds.getSize(new THREE.Vector3()),center=a.bounds.getCenter(new THREE.Vector3());
  let scale=bounds[1]/span.y,anchor=a.bounds.min.y;
  if(c.dkind==='ghostbanquettable')scale=bounds[1]/(.382-a.bounds.min.y);
  else if(c.dkind==='ghostchandelier')scale=bounds[0]/span.x;
  else if(c.dkind==='ghosttrestle')scale=bounds[2]/span.z;
  else if(c.dkind==='ghostflagstone')scale=Math.min(bounds[0]/span.x,bounds[2]/span.z);
  if(c.w!==undefined)scale=Math.max(.001,c.w);
  const rotation=new THREE.Quaternion().setFromAxisAngle(UP,THREE.MathUtils.degToRad(c.yaw??0)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),THREE.MathUtils.degToRad(c.amp??0)));
  return{scale,anchor,center,rotation};
}
function assetPlacement(a:Asset,c:CustomComponent,defaults:[number,number,number]):THREE.Matrix4 {
  const {scale,anchor,center,rotation}=placementMetrics(a,c,defaults);
  return new THREE.Matrix4().compose(new THREE.Vector3(...c.p),rotation,new THREE.Vector3(scale,scale,scale)).multiply(new THREE.Matrix4().makeTranslation(-center.x,-anchor,-center.z));
}
const cartTemplates=new WeakMap<Asset,THREE.Group>();
/** Four measured wheel discs are cut from the actual Meshy surface. No new
 * tyres, spokes or roof geometry replaces its 2,982 textured source triangles. */
function carriage(a:Asset,depth:number,wheels:THREE.Group[]):THREE.Group {
  let template=cartTemplates.get(a);
  if(!template){
    template=new THREE.Group();const span=a.bounds.getSize(new THREE.Vector3()),center=a.bounds.getCenter(new THREE.Vector3());
    const normalize=new THREE.Matrix4().makeScale(1/span.z,1/span.z,1/span.z).multiply(new THREE.Matrix4().makeTranslation(-center.x,-a.bounds.min.y,-center.z));
    const buckets=new Map<string,{positions:number[];normals:number[];uvs:number[];mat:THREE.Material;pivot:THREE.Vector3;wheel:boolean}>();let triangles=0;
    const p=new THREE.Vector3(),centroid=new THREE.Vector3();
    a.scene.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();source.applyMatrix4(normalize.clone().multiply(mesh.matrixWorld));
      const position=source.getAttribute('position'),normal=source.getAttribute('normal'),uv=source.getAttribute('uv');
      for(let i=0;i<position.count;i+=3){centroid.set(0,0,0);for(let k=0;k<3;k++)centroid.add(p.fromBufferAttribute(position,i+k));centroid.multiplyScalar(1/3);
        const isWheel=Math.abs(centroid.x)>.105&&Math.abs(centroid.x)<.19&&Math.hypot(centroid.y-.084,Math.abs(centroid.z)-.276)<.095;
        const side=centroid.x<0?-1:1,end=centroid.z<0?-1:1,region=isWheel?`wheel ${side} ${end}`:'body';
        const group=source.groups.find(g=>i>=g.start&&i<g.start+g.count),index=group?.materialIndex??0;
        const mat=Array.isArray(mesh.material)?mesh.material[index]??mesh.material[0]:mesh.material,key=region+':'+mat.uuid;
        let bucket=buckets.get(key);if(!bucket){bucket={positions:[],normals:[],uvs:[],mat,pivot:isWheel?new THREE.Vector3(side*.128,.084,end*.276):new THREE.Vector3(),wheel:isWheel};buckets.set(key,bucket);}
        for(let k=0;k<3;k++){const n=i+k;bucket.positions.push(position.getX(n)-bucket.pivot.x,position.getY(n)-bucket.pivot.y,position.getZ(n)-bucket.pivot.z);
          if(normal)bucket.normals.push(normal.getX(n),normal.getY(n),normal.getZ(n));if(uv)bucket.uvs.push(uv.getX(n),uv.getY(n));}
        triangles++;
      }source.dispose();
    });
    const wheelRoots=new Map<string,THREE.Group>();
    for(const [key,b]of buckets){const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.positions,3));
      if(b.normals.length)geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normals,3));else geometry.computeVertexNormals();
      if(b.uvs.length)geometry.setAttribute('uv',new THREE.Float32BufferAttribute(b.uvs,2));geometry.computeBoundingSphere();geometry.userData.shared=true;
      const piece=new THREE.Mesh(geometry,b.mat);piece.castShadow=true;piece.receiveShadow=true;
      if(b.wheel){const name=key.split(':')[0];let rotor=wheelRoots.get(name);if(!rotor){rotor=new THREE.Group();rotor.position.copy(b.pivot);rotor.name='Meshy carriage '+name;rotor.userData.ghostCartWheel=true;template.add(rotor);wheelRoots.set(name,rotor);}rotor.add(piece);}
      else template.add(piece);
    }
    template.userData.ghostCartTriangles=triangles;template.userData.meshyAsset=true;cartTemplates.set(a,template);
  }
  const result=template.clone(true);result.scale.setScalar(depth);result.traverse(node=>{if(node.userData.ghostCartWheel)wheels.push(node as THREE.Group);});return result;
}
function mergeRigidParts(root:THREE.Group):THREE.BufferGeometry[] {
  root.updateWorldMatrix(true,true);const inverse=root.matrixWorld.clone().invert(),groups=new Map<THREE.Material,THREE.BufferGeometry[]>();
  const created:THREE.BufferGeometry[]=[];
  for(const child of [...root.children]){const mesh=child as THREE.Mesh;if(!mesh.isMesh||mesh.userData.ghostBillboard||(mesh as THREE.InstancedMesh).isInstancedMesh||Array.isArray(mesh.material))continue;
    const part=mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)),list=groups.get(mesh.material)??[];list.push(part);groups.set(mesh.material,list);
    mesh.geometry.dispose();mesh.removeFromParent();
  }
  for(const [mat,pieces]of groups){const geometry=mergeGeometries(pieces,false);for(const piece of pieces)piece.dispose();if(!geometry)continue;
    const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);created.push(geometry);}
  return created;
}
function greenLamp(parent:THREE.Object3D,p:[number,number,number],size=.1):THREE.Mesh {
  const m=new THREE.Mesh(new THREE.SphereGeometry(size,8,6),new THREE.MeshBasicMaterial({color:0xb2ff59,toneMapped:false}));m.position.set(...p);parent.add(m);
  const halo=ghostGlow('#77ff40',size*8);halo.position.set(...p);halo.userData.ghostBillboard=true;parent.add(halo);
  return m;
}
function fallbackCart(w:number,d:number,h:number):THREE.Group {
  const root=new THREE.Group(),oak=material(0x513328),iron=material(0x252329),gold=material(0xae8742);
  box(root,[w,h*.75,d],[0,h*.58,0],oak);box(root,[w+.08,.1,d+.08],[0,h*.9,0],gold);
  for(const side of [-1,1])for(const end of [-1,1]){
    const wheel=cylinder(root,.35,.35,.17,[side*(w/2+.03),.32,end*d*.32],iron,10);wheel.rotation.z=Math.PI/2;
    box(root,[.13,h*.55,.15],[side*w*.44,h*.74,end*d*.42],iron);
  }
  for(let i=0;i<5;i++)box(root,[w*.89,.06,d/5*.85],[0,h+.025,(i-2)*d/5],oak);
  return root;
}
function fallbackArch(w:number,h:number,d:number):THREE.Group {
  const root=new THREE.Group(),stone=material(0x423849),trim=material(0x765f7f),dark=material(0x211b2a);
  for(const side of [-1,1]){
    box(root,[w*.17,h*.8,d],[side*w*.42,h*.4,0],stone);
    box(root,[w*.21,.24,d*1.08],[side*w*.42,h*.77,0],trim);
    cylinder(root,w*.075,w*.095,h*.77,[side*w*.415,h*.4,d*.52],trim,6);
  }
  for(let i=0;i<9;i++){
    const a=Math.PI*i/8,brick=box(root,[w*.16,h*.1,d],[Math.cos(a)*w*.36,h*.77+Math.sin(a)*h*.23,0],i%2?stone:trim);
    brick.rotation.z=a-Math.PI/2;
  }
  box(root,[w*.12,h*.15,d*1.07],[0,h*.91,0],dark);return root;
}
function axeVisual(len:number):THREE.Group {
  const root=new THREE.Group(),shaft=material(0x54352d),steel=material(0xa8a6b7),edge=material(0xd5dac6),brass=material(0xb79048);
  cylinder(root,.10,.14,len,[0,-len/2,0],shaft);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(0,-.48);shape.lineTo(side*.76,-.96);shape.lineTo(side*1.04,-.46);
    shape.lineTo(side*.94,.35);shape.lineTo(side*.45,.58);shape.lineTo(0,.37);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false}),blade=new THREE.Mesh(geo,steel);
    blade.position.set(0,-len,.1);root.add(blade);
    const trim=box(root,[.1,.72,.24],[side*.96,-len-.16,.2],edge);trim.rotation.z=side*.14;
  }
  cylinder(root,.2,.2,.4,[0,-len,.18],brass);greenLamp(root,[0,-len,.36],.11);
  root.name='Castle pendulum double axe';return root;
}

export class GhostTrainAssetKit {
  private roots=new Set<THREE.Group>();private pending:Promise<void>[]=[];private released=false;
  private visuals=new Set<EnemyVisual>();
  private displays:{visual:EnemyVisual;seed:number}[]=[];
  private machines:{visual:GhostClockwork;merged:THREE.BufferGeometry[]}[]=[];
  private staticJobs=new Map<GhostStaticKind,{rows:{c:CustomComponent;root?:THREE.Group}[];status:AssetStatus;asset?:Asset}>();
  private instanceMeshes=new Set<THREE.InstancedMesh>();
  private carts:{mesh:THREE.Mesh;wheels:THREE.Group[];last:THREE.Vector3;radius:number;walls:{mesh:THREE.Mesh;box:THREE.Box3}[]}[]=[];
  private cues:{p:THREE.Vector3;to:THREE.Vector3;color:THREE.Color;power:number;cone:number;range:number;family:number;fixed:boolean}[]=[];
  private lightPool:{light:THREE.SpotLight;cue:number}[]=[];
  private candleLight:THREE.PointLight;
  private atmosphere:GhostAtmosphere;
  private fixtureHalos:{material:THREE.ShaderMaterial;seed:number}[]=[];
  private time=0;
  private focus=new THREE.Vector3();
  constructor(private levelRoot:THREE.Group,private actors:()=>readonly THREE.Object3D[]=()=>[],private instanced=true){
    this.atmosphere=new GhostAtmosphere(levelRoot);
    // Allocate the exact light topology before the first scene render. Moving
    // among show rooms never changes shader light counts or recompiles PBR art.
    for(let i=0;i<3;i++){
      const light=new THREE.SpotLight(i===0?0xffc98b:i===1?0x83f4ba:0x8172d3,0,30,.6,.6,2);
      light.name=`Ghost show ${i===0?'shadow key':'colored fill '+i}`;light.castShadow=i===0;
      if(i===0){light.shadow.mapSize.set(1024,1024);light.shadow.camera.near=.25;light.shadow.camera.far=36;light.shadow.bias=-.00015;light.shadow.normalBias=.025;}
      levelRoot.add(light,light.target);
      this.lightPool.push({light,cue:-1});
    }
    // One pooled candle bounce illuminates the actual chandelier and nearby
    // dining sculptures. It is created with the spot pool, never per prop.
    this.candleLight=new THREE.PointLight(0xffbf7c,0,22,2);this.candleLight.name='Pooled castle chandelier candle bounce';this.candleLight.castShadow=false;levelRoot.add(this.candleLight);
  }
  private staticDecor(c:CustomComponent):void {
    const kind=c.dkind as GhostStaticKind,row:{c:CustomComponent;root?:THREE.Group}={c};
    if(!this.instanced){row.root=new THREE.Group();row.root.name=GHOST_DECOR_LABELS[kind];row.root.position.fromArray(c.p);this.levelRoot.add(row.root);this.roots.add(row.root);}
    let job=this.staticJobs.get(kind);
    if(!job){job={rows:[],status:'loading'};this.staticJobs.set(kind,job);const batch=job;
      this.pending.push(asset(kind).promise.then(a=>{
        if(this.released)return;batch.status=a?'ready':'error';if(!a)return;batch.asset=a;
        if(!this.instanced){for(const item of batch.rows){const model=a.scene.clone(true),{scale,anchor,center,rotation}=placementMetrics(a,item.c,GHOST_STATIC_SIZES[kind]);
          item.root!.quaternion.copy(rotation);item.root!.scale.setScalar(scale);model.position.set(-center.x,-anchor,-center.z);item.root!.add(model);item.root!.userData.assetReady=true;}return;}
        const cells=new Map<string,CustomComponent[]>();for(const item of batch.rows){const key=`${Math.floor(item.c.p[0]/40)}:${Math.floor(item.c.p[2]/40)}`,list=cells.get(key)??[];list.push(item.c);cells.set(key,list);}
        for(const [cell,rows]of cells){const [x,z]=cell.split(':').map(Number),origin=new THREE.Vector3(x*40,0,z*40),root=new THREE.Group();root.position.copy(origin);root.name=`${GHOST_DECOR_LABELS[kind]} · shared cell`;
          root.userData.ghostStaticAsset={kind,instances:rows.length,url:GHOST_ASSETS[kind],uniform:true};this.levelRoot.add(root);this.roots.add(root);
          a.scene.traverse(object=>{const source=object as THREE.Mesh;if(!source.isMesh)return;const mesh=new THREE.InstancedMesh(source.geometry,source.material,rows.length);mesh.name=GHOST_DECOR_LABELS[kind];mesh.castShadow=true;mesh.receiveShadow=true;
            const tinted=rows.some(row=>row.color!==undefined);
            for(let i=0;i<rows.length;i++){const transform=new THREE.Matrix4().makeTranslation(-origin.x,0,-origin.z).multiply(assetPlacement(a,rows[i],GHOST_STATIC_SIZES[kind])).multiply(source.matrixWorld);mesh.setMatrixAt(i,transform);if(tinted)mesh.setColorAt(i,new THREE.Color(rows[i].color??'#ffffff'));}
            mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();mesh.computeBoundingBox();root.add(mesh);this.instanceMeshes.add(mesh);
          });
        }
      }));
    }
    job.rows.push(row);
  }
  private install(kind:AssetKind,parent:THREE.Object3D,fallback:THREE.Group,height:number,size?:[number,number,number],factory?:(a:Asset)=>THREE.Group):THREE.Group {
    const root=new THREE.Group();root.name=GHOST_DECOR_LABELS[kind as GhostDecorKind]??'Meshy carriage mask';root.userData.ghostAsset={kind,status:'loading',url:GHOST_ASSETS[kind]};
    parent.add(root);root.add(fallback);this.roots.add(root);
    this.pending.push(asset(kind).promise.then(a=>{
      if(this.released)return;
      if(a){disposeOwned(fallback);root.add(factory?factory(a):fitted(a,height,size));root.userData.assetReady=true;}
      (root.userData.ghostAsset as {status:string}).status=a?'ready':'error';
    }));return root;
  }
  private cartFace(root:THREE.Group,depth:number):void {
    this.pending.push(asset('ghostcartface').promise.then(a=>{if(this.released||!a)return;
      const center=a.bounds.getCenter(new THREE.Vector3()),span=a.bounds.getSize(new THREE.Vector3()),face=new THREE.Group(),model=a.scene.clone(true);
      model.position.copy(center).multiplyScalar(-1);face.add(model);face.scale.setScalar(Math.min(2,depth*.36)/span.x);
      face.position.set(0,depth*.22105+.70,depth*.404);face.name='Actual Meshy demon carriage mask';face.userData.meshyCartFace=true;face.userData.sourceTriangles=1396;root.add(face);
    }));
  }
  cart(mesh:THREE.Mesh,c:CustomComponent,height:number):{support:THREE.Mesh[];walls:THREE.Box3[]} {
    const [w,,d]=c.s??[3.2,.35,6.2],bodyH=d*.500941,floorOffset=d*.22105,wheels:THREE.Group[]=[];
    mesh.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
    const root=this.install('ghostcart',mesh,fallbackCart(d*.511794,d,bodyH),bodyH,undefined,a=>carriage(a,d,wheels));
    root.position.y=height/2-floorOffset;
    this.cartFace(root,d);
    // This is the visible interior floor, measured on the actual generated
    // car at normalized Y=.22. The body uses a uniform scale; there is no roof
    // over its empty seats and no wide invisible platform beneath the sides.
    mesh.userData.ghostCartSize=[w,height,d];mesh.geometry.dispose();mesh.geometry=new THREE.BoxGeometry(w*.78,height,d*.82);
    const previous=mesh.material as THREE.Material;
    for(const value of Object.values(previous)){const texture=value as THREE.Texture;if(texture?.isTexture&&!texture.userData.shared)texture.dispose();}
    previous.dispose();mesh.material=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});mesh.material.visible=false;
    mesh.name='Ghost carriage interior floor';mesh.userData.ghostSkin='ghostcart';
    // The floor is a landing receiver, not an exposed lip beneath the cabin.
    mesh.userData.ledgeGrab=false;
    const lamps=new THREE.Group(),lampMaterial=new THREE.MeshBasicMaterial({color:0x8cff3d});mesh.add(lamps);
    for(const side of [-1,1])for(const end of [-1,1]){const glow=greenLamp(lamps,[side*w*.435,height/2+bodyH-floorOffset-.18,end*d*.40],.065);(glow.material as THREE.Material).dispose();glow.material=lampMaterial;}mergeRigidParts(lamps);
    const radius=d*.09;
    mesh.userData.ghostCartProportions={uniform:true,floorNormalizedY:.22105,bodySize:[d*.511794,bodyH,d],floorSize:[w*.78,d*.82],sourceTriangles:2982,sourceWheels:4};
    const walls:{mesh:THREE.Mesh;box:THREE.Box3}[]=[],support:THREE.Mesh[]=[],proxyMaterial=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false});
    const proxy=(size:[number,number,number],p:[number,number,number])=>{
      const solid=box(mesh,size,p,proxyMaterial,'Moving cart cabin side collider');solid.visible=false;solid.userData.moverId=mesh.userData.moverId;solid.userData.edgeGrinding=false;
      // Rim height above this moving cabin's interior floor. The traversal
      // solver must vault this wall before settling onto that same mover.
      solid.userData.ledgeReceiverDrop=size[1];
      const bounds=new THREE.Box3();walls.push({mesh:solid,box:bounds});support.push(solid);
    };
    for(const side of [-1,1])proxy([.16,1.45,d*.83],[side*w*.43,height/2+.725,0]);
    for(const end of [-1,1])proxy([w*.77,end>0?1.35:.90,.17],[0,height/2+(end>0?.675:.45),end*d*.42]);
    mesh.updateWorldMatrix(true,true);for(const wall of walls)wall.box.setFromObject(wall.mesh);
    this.carts.push({mesh,wheels,last:mesh.position.clone(),radius,walls});return{support,walls:walls.map(w=>w.box)};
  }
  axe(pivot:THREE.Group,len:number):void {
    for(const child of [...pivot.children])disposeOwned(child);
    const fallback=axeVisual(len);pivot.add(fallback);pivot.userData.ghostSkin='ghostaxe';
    this.pending.push(asset('ghostaxe').promise.then(a=>{if(this.released||!a)return;disposeOwned(fallback);
      const root=new THREE.Group(),span=a.bounds.getSize(new THREE.Vector3()),center=a.bounds.getCenter(new THREE.Vector3()),scale=Math.min(2/span.x,2/span.y,1.6/span.z),model=a.scene.clone(true);
      const shaft=new THREE.Group(),shaftLength=Math.max(.2,len-span.y*scale/2);cylinder(shaft,.10,.12,shaftLength,[0,-shaftLength/2,0],material(0x573e2a));pivot.add(shaft);
      model.position.set(-center.x,-center.y,-center.z);root.add(model);root.scale.setScalar(scale);root.rotation.z=Math.PI;root.position.y=-len;root.name='Meshy skull axe head';root.userData.assetReady=true;pivot.add(root);
    }));
  }
  decorate(c:CustomComponent):void {
    if(this.atmosphere.add(c))return;
    if(GHOST_STATIC_KINDS.includes(c.dkind as GhostStaticKind)){this.staticDecor(c);return;}
    if(c.dkind==='ghostclockwork'){
      const visual=createGhostClockwork(c.s??[6,7,3],c.yaw??0),merged:THREE.BufferGeometry[]=[];
      for(const child of visual.group.children)if((child as THREE.Group).isGroup)merged.push(...mergeRigidParts(child as THREE.Group));
      visual.group.position.fromArray(c.p);visual.group.userData.ghostSkin='ghostclockwork';visual.group.userData.ghostHeight=c.s?.[1]??7;
      const record={visual,merged};this.levelRoot.add(visual.group);this.machines.push(record);
      this.pending.push(asset('ghostclockwork').promise.then(a=>{if(this.released||!a)return;
        for(const geometry of record.merged)geometry.dispose();record.merged=[];visual.dispose();
        const root=new THREE.Group(),model=a.scene.clone(true),metrics=placementMetrics(a,c,[6,7,3]);root.name='Meshy castle clockwork';root.position.fromArray(c.p);root.quaternion.copy(metrics.rotation);root.scale.setScalar(metrics.scale);
        model.position.set(-metrics.center.x,-metrics.anchor,-metrics.center.z);root.add(model);
        const bindings:{name:string;root:THREE.Group;point:THREE.Vector3;axis:THREE.Vector3}[]=[];
        let pivots:Record<string,{point:number[];axis:number[]}>|undefined;a.scene.traverse(node=>{if(node.userData.ghostClockworkRig?.pivots)pivots=node.userData.ghostClockworkRig.pivots;});
        for(const [name,pivot]of Object.entries(pivots??{})){const node=model.getObjectByName(name) as THREE.Mesh;if(!node?.isMesh||pivot.point.length!==3||pivot.axis.length!==3)continue;
          const point=new THREE.Vector3(...pivot.point as [number,number,number]),part=new THREE.Group();part.position.copy(point);part.name=name+' measured axle';
          const parent=node.parent!;node.removeFromParent();node.geometry=node.geometry.clone().translate(-point.x,-point.y,-point.z);node.geometry.userData.shared=false;node.position.set(0,0,0);node.quaternion.identity();node.scale.set(1,1,1);part.add(node);parent.add(part);
          bindings.push({name,root:part,point,axis:new THREE.Vector3(...pivot.axis as [number,number,number]).normalize()});
        }
        const ease=(v:number)=>{const t=THREE.MathUtils.clamp(v,0,1);return t*t*(3-2*t);};
        const update=(time:number)=>{const cycle=Math.max(0,time)/1.9,turn=(Math.floor(cycle)+ease((cycle%1)/.16))*Math.PI/10;
          for(const b of bindings)if(b.name==='ClockCounterweight'){const phase=(time/7.6+.17)%1,lift=phase<.22?ease(phase/.22):phase<.53?1:phase<.76?1-ease((phase-.53)/.23):0;b.root.position.copy(b.point).addScaledVector(b.axis,lift*.14);}
          else b.root.quaternion.setFromAxisAngle(b.axis,b.name==='ClockMainWheel'?-turn:turn*(b.name==='ClockUpperPulley'?1.8:-1.8));};
        root.userData.assetReady=true;root.userData.ghostMeshyClockwork=true;root.userData.ghostSkin='ghostclockwork';root.userData.ghostHeight=a.bounds.getSize(new THREE.Vector3()).y*metrics.scale;
        root.userData.ghostClockworkRig={parts:bindings.map(b=>b.name),sourceTriangles:4478,originalUVsPreserved:true};this.levelRoot.add(root);this.roots.add(root);update(this.time);
        record.visual={group:root,update,dispose:()=>root.removeFromParent()};
      }));return;
    }
    if(c.dkind==='ghostshowlight'){
      const p=new THREE.Vector3(...c.p),to=new THREE.Vector3(...(c.to??[c.p[0],c.p[1]-5,c.p[2]-4]));
      this.cues.push({p,to,color:new THREE.Color(c.color??'#ffc98b'),power:c.amp??((c.vr??0)===0?120:55),cone:THREE.MathUtils.clamp(c.w??.6,.15,1.1),range:c.rise??32,family:Math.round(c.vr??0),fixed:c.n===1});
      const fixture=new THREE.Group();fixture.position.copy(p);fixture.name='Indoor castle stage lamp';this.levelRoot.add(fixture);this.roots.add(fixture);
      const brass=material(0xb19557),iron=material(0x383130);brass.metalness=.28;brass.roughness=.5;
      cylinder(fixture,.24,.27,.06,[0,-.23,0],brass,6);cylinder(fixture,0,.29,.20,[0,.30,0],brass,6);
      const glow=new THREE.Mesh(new THREE.CylinderGeometry(.17,.19,.36,6),new THREE.MeshBasicMaterial({color:c.color??'#ffc98b',transparent:true,opacity:.82}));fixture.add(glow);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;box(fixture,[.028,.44,.028],[Math.cos(a)*.205,0,Math.sin(a)*.205],iron);}
      const hook=new THREE.Mesh(new THREE.TorusGeometry(.075,.014,4,8),brass);hook.position.y=.46;fixture.add(hook);
      const bracket=cylinder(fixture,.022,.022,.46,[0,.06,.25],iron,6);bracket.rotation.x=Math.PI/2;
      fixture.rotation.y=Math.atan2(p.x-to.x,p.z-to.z);mergeRigidParts(fixture);
      const halo=ghostGlow(c.color??'#87ff66',2.4);halo.userData.ghostBillboard=true;fixture.add(halo);
      this.fixtureHalos.push({material:halo.material as THREE.ShaderMaterial,seed:this.cues.length*.61});return;
    }
    if(c.dkind==='ghostaxe'){
      const root=axeVisual(c.len??4);root.position.fromArray(c.p);root.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);this.levelRoot.add(root);return;
    }
    if(c.dkind==='ghostknight'||c.dkind==='ghostfood'||c.dkind==='ghostcake'){
      const visual=createGhostEnemyVisual('grunt',c.dkind,{height:c.s?.[1],variant:c.vr,lookAt:()=>this.focus});visual.group.position.fromArray(c.p);
      visual.group.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);this.levelRoot.add(visual.group);this.roots.add(visual.group);
      this.visuals.add(visual);this.displays.push({visual,seed:c.phase??this.displays.length*.41});this.pending.push(visual.ready);return;
    }
    if(c.dkind==='ghostcart'){
      const depth=c.w??c.s?.[2]??6.2,root=this.install('ghostcart',this.levelRoot,fallbackCart(depth*.511794,depth,depth*.500941),depth*.500941,undefined,a=>carriage(a,depth,[]));
      root.position.fromArray(c.p);root.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);root.rotation.z=THREE.MathUtils.degToRad(c.amp??0);this.cartFace(root,depth);return;
    }
    const size=c.s??[12,9,1.6],root=this.install('ghostarch',this.levelRoot,fallbackArch(...size),size[1],size);root.position.fromArray(c.p);root.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
  }
  async ready():Promise<void>{await Promise.all(this.pending);}
  update(dt:number,playerPos:THREE.Vector3):void {
    if(this.released)return;this.time+=Math.max(0,dt);this.focus.copy(playerPos);
    this.atmosphere.update(dt,playerPos);
    for(const halo of this.fixtureHalos)halo.material.uniforms.opacity.value=.70*ghostFlicker(this.time,halo.seed);
    for(const root of this.roots)if(root.userData.ghostStaticAsset||root.name==='Indoor castle stage lamp')root.visible=root.position.distanceToSquared(playerPos)<130*130;
    for(const display of this.displays){display.visual.group.visible=display.visual.group.position.distanceToSquared(playerPos)<105*105;
      if(display.visual.group.visible)display.visual.update(dt,{state:'display',stateTime:this.time,time:this.time+display.seed,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false});}
    for(const machine of this.machines){machine.visual.group.visible=machine.visual.group.position.distanceToSquared(playerPos)<105*105;if(machine.visual.group.visible)machine.visual.update(this.time);}
    for(const car of this.carts){const delta=car.mesh.position.clone().sub(car.last),yaw=car.mesh.rotation.y;
      const travel=delta.x*Math.sin(yaw)+delta.z*Math.cos(yaw);for(const wheel of car.wheels)wheel.rotation.x+=travel/car.radius;car.last.copy(car.mesh.position);
      car.mesh.updateWorldMatrix(true,true);for(const wall of car.walls)wall.box.setFromObject(wall.mesh);
    }
    const taken=new Set<number>();
    const active=this.actors().map(actor=>({actor,p:actor.getWorldPosition(new THREE.Vector3())})).filter(value=>value.p.distanceTo(playerPos)<23&&value.p.z<playerPos.z+2).sort((a,b)=>a.p.distanceToSquared(playerPos)-b.p.distanceToSquared(playerPos));
    const displays=[...this.displays,...this.machines].map(d=>({actor:d.visual.group,p:d.visual.group.getWorldPosition(new THREE.Vector3())})).filter(value=>value.p.distanceTo(playerPos)<18).sort((a,b)=>a.p.distanceToSquared(playerPos)-b.p.distanceToSquared(playerPos));
    for(let slot=0;slot<this.lightPool.length;slot++){
      const entry=this.lightPool[slot],performer=active[slot===2?1:0]??displays[slot===2?1:0];
      const target=performer?performer.p.clone():playerPos.clone();target.y+=performer?(performer.actor.userData.ghostHeight??2.8)*.52:1.35;
      if(slot===0&&performer){target.lerp(playerPos.clone().add(new THREE.Vector3(0,1.35,0)),.35);}
      let best=-1,distance=Infinity;
      for(let i=0;i<this.cues.length;i++){const cue=this.cues[i];if(taken.has(i))continue;
        const fixedStage=cue.fixed&&cue.family===slot&&cue.p.distanceTo(playerPos)<25;
        const d=(cue.fixed?cue.p.distanceToSquared(playerPos)*.35+cue.to.distanceToSquared(playerPos)*.15:cue.p.distanceToSquared(target))+(cue.family===slot?0:300)-(fixedStage?10000:0);
        if(d<distance&&cue.p.distanceTo(cue.fixed?playerPos:target)<cue.range+(cue.fixed?12:0)){distance=d;best=i;}}
      if(best<0){entry.light.intensity=0;entry.cue=-1;continue;}
      taken.add(best);const cue=this.cues[best],light=entry.light;entry.cue=best;
      const aim=cue.fixed?cue.to:target;light.position.copy(cue.p);light.target.position.lerp(aim,cue.fixed||dt===0||light.intensity===0?1:1-Math.exp(-12*dt));light.color.copy(cue.color);
      // Preserve usable illumination when a small staged room puts its next
      // sconce farther from the performer. This is bounded local light power,
      // not a global exposure or an extra light added for each character.
      const gain=THREE.MathUtils.clamp(cue.p.distanceToSquared(aim)/36,1,slot===0?3.8:3.0);
      light.intensity=Math.min(cue.fixed?1600:620,cue.power*(slot===0?1:.9)*gain*(cue.fixed?2.1:1))*ghostFlicker(this.time,(best+1)*.61);light.distance=cue.range;light.angle=cue.fixed?Math.max(.72,cue.cone):cue.cone;
      if(light.shadow.camera.far!==cue.range){light.shadow.camera.far=cue.range;light.shadow.camera.updateProjectionMatrix();}light.target.updateMatrixWorld();
    }
    const chandeliers=this.staticJobs.get('ghostchandelier');let nearest:THREE.Vector3|undefined,near=Infinity;
    if(chandeliers?.asset)for(const {c}of chandeliers.rows){const m=placementMetrics(chandeliers.asset,c,GHOST_STATIC_SIZES.ghostchandelier),p=new THREE.Vector3(...c.p).add(new THREE.Vector3(0,.31*m.scale,0));
      const d=p.distanceToSquared(playerPos);if(d<near&&d<26*26){near=d;nearest=p;}}
    if(nearest){this.candleLight.position.copy(nearest);this.candleLight.intensity=34;}else this.candleLight.intensity=0;
  }
  get diagnostics() {
    return {atmosphere:this.atmosphere.diagnostics,instances:this.roots.size,staticModels:[...this.staticJobs].map(([kind,job])=>({kind,placements:job.rows.length,status:job.status})),instanceDraws:this.instanceMeshes.size,showLights:{pool:this.lightPool.length,shadowed:this.lightPool.filter(p=>p.light.castShadow).length,cues:this.cues.length,active:this.lightPool.filter(p=>p.cue>=0).length},candleBounce:{power:this.candleLight.intensity,origin:this.candleLight.position.toArray()},lightTargets:this.lightPool.map(p=>({cue:p.cue,power:p.light.intensity,origin:p.light.position.toArray(),target:p.light.target.position.toArray(),fixed:p.cue>=0&&this.cues[p.cue].fixed})),carts:this.carts.map(c=>c.mesh.userData.ghostCartProportions),assets:Object.fromEntries([...templates].map(([kind,entry])=>[kind,{status:entry.status,...(entry.error?{error:entry.error}:{})}]))};
  }
  dispose():void{this.released=true;this.atmosphere.dispose();this.fixtureHalos.length=0;for(const visual of this.visuals)visual.dispose();this.visuals.clear();for(const root of this.roots)disposeOwned(root);this.roots.clear();
    for(const mesh of this.instanceMeshes)mesh.dispose();this.instanceMeshes.clear();this.staticJobs.clear();
    for(const machine of this.machines){for(const geometry of machine.merged)geometry.dispose();machine.visual.dispose();}this.machines.length=0;
    for(const {light}of this.lightPool){light.shadow.map?.dispose();light.shadow.mapPass?.dispose();light.shadow.map=null;light.shadow.mapPass=null;light.removeFromParent();light.target.removeFromParent();}this.candleLight.removeFromParent();this.lightPool.length=0;this.carts.length=0;this.cues.length=0;}
}

type Skin='ghostknight'|'ghostfood'|'ghostcake';
export interface GhostVisualOptions {height?:number;variant?:number;lookAt?:()=>THREE.Vector3;}
type Region='head'|'torso'|'jaw'|'chassis'|'upperArmL'|'lowerArmL'|'upperArmR'|'lowerArmR'|'thighL'|'shinL'|'footL'|'thighR'|'shinR'|'footR';
interface Part {root:THREE.Group;pivot:THREE.Vector3;}
interface Leg {side:number;upper:Part;lower:Part;foot:Part;hip:THREE.Vector3;kneeY:number;ankleY:number;planted:boolean;target:THREE.Vector3;}
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);
function part(parent:THREE.Group,name:string,pivot:THREE.Vector3):Part {
  const root=new THREE.Group();root.name=name;root.position.copy(pivot);parent.add(root);return{root,pivot:pivot.clone()};
}
/** Triangle-region segmentation is an explicit rigid armour articulation,
 * not an auto-rig. Surface UVs/materials are retained from the Meshy model. */
function segmented(a:Asset,height:number,parts:Record<string,Part>,skin:Skin):{triangles:number;meshes:number} {
  const base=0,modelHeight=height;
  const scale=modelHeight/(a.bounds.max.y-a.bounds.min.y),cx=(a.bounds.min.x+a.bounds.max.x)/2,cz=(a.bounds.min.z+a.bounds.max.z)/2;
  const normalize=new THREE.Matrix4().makeTranslation(0,base,0).multiply(new THREE.Matrix4().makeScale(scale,scale,scale)).multiply(new THREE.Matrix4().makeTranslation(-cx,-a.bounds.min.y,-cz));
  const nodeRegions:Record<string,Region>={Head:'head',Torso:'torso',LeftUpperArm:'upperArmL',LeftForearm:'lowerArmL',RightUpperArm:'upperArmR',RightForearm:'lowerArmR',LeftThigh:'thighL',LeftShin:'shinL',LeftFoot:'footL',RightThigh:'thighR',RightShin:'shinR',RightFoot:'footR'};
  const vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],centroid=new THREE.Vector3(),copies=new Map<THREE.Material,THREE.Material>();let total=0,meshCount=0;
  const region=(v:THREE.Vector3):Region=>{
    if(skin!=='ghostknight'){
      if(v.y<height*(skin==='ghostcake'?.18:.29))return 'chassis';
      const low=skin==='ghostcake'?.26:.40,high=skin==='ghostcake'?.48:.73,front=skin==='ghostcake'?.12:.27;
      return v.z>height*front&&v.y>height*low&&v.y<height*high?'jaw':'torso';
    }
    const side=v.x<0?'L':'R';
    if(v.y<1.18)return (v.y<.23?'foot':v.y<.67?'shin':'thigh')+side as Region;
    if(Math.abs(v.x)>.48&&v.y<2.24)return (v.y<1.65?'lowerArm':'upperArm')+side as Region;
    return v.y>2.12?'head':'torso';
  };
  a.scene.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh||(mesh as THREE.SkinnedMesh).isSkinnedMesh)return;
    const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();source.applyMatrix4(normalize.clone().multiply(mesh.matrixWorld));
    const pos=source.getAttribute('position'),buckets=new Map<string,number[]>();
    for(let i=0;i<pos.count;i+=3){for(let j=0;j<3;j++)vertices[j].fromBufferAttribute(pos,i+j);
      centroid.copy(vertices[0]).add(vertices[1]).add(vertices[2]).multiplyScalar(1/3);let name=nodeRegions[mesh.name]??region(centroid);
      // The measured armour export preserves every source triangle; a few
      // trailing cape triangles shared the leg regions. Keep that cloth on
      // the torso instead of letting the boots drag jagged strips through it.
      if(skin==='ghostknight'&&/^(thigh|shin|foot)/.test(name)&&centroid.z<-height*.075)name='torso';
      const group=source.groups.find(g=>i>=g.start&&i<g.start+g.count),materialIndex=group?.materialIndex??0,key=name+':'+materialIndex;
      const indices=buckets.get(key)??[];indices.push(i,i+1,i+2);buckets.set(key,indices);total++;
    }
    for(const [key,indices]of buckets){const [name,matIndex]=key.split(':'),target=parts[name];if(!target)continue;
      const geo=new THREE.BufferGeometry();for(const [attrName,attribute]of Object.entries(source.attributes)){
        const data:number[]=[];for(const index of indices)for(let k=0;k<attribute.itemSize;k++)data.push(attribute.array[index*attribute.itemSize+k]);
        geo.setAttribute(attrName,new THREE.Float32BufferAttribute(data,attribute.itemSize));
      }
      geo.translate(-target.pivot.x,-target.pivot.y,-target.pivot.z);geo.computeBoundingSphere();
      const sourceMat=Array.isArray(mesh.material)?mesh.material[Number(matIndex)]??mesh.material[0]:mesh.material;
      let mat=copies.get(sourceMat);if(!mat){mat=sourceMat.clone();mat.userData.shared=false;
        const standard=mat as THREE.MeshStandardMaterial;if(standard.isMeshStandardMaterial&&skin==='ghostknight'){
          standard.metalness=Math.min(standard.metalness,.18);standard.roughness=.58;standard.color.multiplyScalar(1.12);standard.emissive.set('#101924');standard.emissiveIntensity=.28;
        }copies.set(sourceMat,mat);}
      const piece=new THREE.Mesh(geo,mat);piece.castShadow=true;piece.receiveShadow=true;piece.name=`Meshy_${name}`;target.root.add(piece);
      meshCount++;
    }
    source.dispose();
  });return{triangles:total,meshes:meshCount};
}
function legSolve(leg:Leg,target:THREE.Vector3,compression:number):void {
  const hip=leg.hip,restKnee=leg.lower.pivot,restFoot=leg.foot.pivot;
  const upperLength=hip.distanceTo(restKnee),lowerLength=restKnee.distanceTo(restFoot);
  const direction=target.clone().sub(hip),distance=THREE.MathUtils.clamp(direction.length(),.12,upperLength+lowerLength-.002),unit=direction.normalize();
  const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
  const outward=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
  const restUnit=restFoot.clone().sub(hip).normalize(),restBend=restKnee.clone().sub(hip);
  restBend.addScaledVector(restUnit,-restBend.dot(restUnit));
  const bend=(restBend.lengthSq()>.000001?restBend:FORWARD.clone()).addScaledVector(unit,-restBend.dot(unit)).normalize();
  const knee=hip.clone().addScaledVector(unit,along).addScaledVector(bend,outward);
  for(const [segment,start,end,restStart,restEnd,length]of [[leg.upper,hip,knee,hip,restKnee,upperLength],[leg.lower,knee,target,restKnee,restFoot,lowerLength]] as const){
    segment.root.position.copy(start);segment.root.quaternion.setFromUnitVectors(restEnd.clone().sub(restStart).normalize(),end.clone().sub(start).normalize());
    // Small per-segment flex follows shared profiles; no actor-root scaling.
    segment.root.scale.y=1+compression;segment.root.position.addScaledVector(UP,-compression*length*.15);
  }
  leg.foot.root.position.copy(target);leg.foot.root.rotation.set(0,0,0);leg.foot.root.scale.set(1,1,1);
}
export function createGhostEnemyVisual(kind:EnemyKind,skin:Skin,options:GhostVisualOptions={}):EnemyVisual {
  const group=new THREE.Group();group.name=GHOST_DECOR_LABELS[skin];group.userData.ghostSkin=skin;
  const body=new THREE.Group();group.add(body);const rig=new THREE.Group();body.add(rig);
  const knight=skin==='ghostknight',referenceHeight=knight?2.62:1.20,height=THREE.MathUtils.clamp(options.height??(knight?3.05:1.8),.9,4.8),gain=height/referenceHeight,torsoBase=knight?1.18:.38;
  const parts:Record<string,Part>={},legs:Leg[]=[];
  const torso=parts.torso=part(rig,'Torso',new THREE.Vector3(0,torsoBase,0));
  const head=parts.head=part(rig,'Head',new THREE.Vector3(0,knight?2.12:.83,.06));
  const jaw=parts.jaw=part(rig,'Jaw',new THREE.Vector3(0,knight?2.12:.58,.23));
  parts.chassis=part(rig,'Source mechanical platter',new THREE.Vector3());
  const iron=material(0x626571),dark=material(0x202129),trim=material(0xaaa083),cream=material(0xf1cf94),brown=material(0x9b542b);
  const fallback=new THREE.Group();fallback.name='Loading artwork';rig.add(fallback);
  const placeholder:THREE.Mesh[]=[];
  const ownBox=(p:Part,s:[number,number,number],at:[number,number,number],mat:THREE.Material)=>{const m=box(p.root,s,at,mat);m.userData.keepFoodLimb=/Thigh|Shin|Foot/.test(p.root.name);placeholder.push(m);return m;};
  if(knight){
    ownBox(torso,[.85,.76,.51],[0,.42,0],iron);ownBox(torso,[.65,.23,.48],[0,.02,0],dark);
    ownBox(head,[.57,.46,.48],[0,.25,0],iron);ownBox(head,[.59,.14,.10],[0,.20,.27],dark);
    for(let i=-2;i<=2;i++)ownBox(head,[.025,.12,.03],[i*.075,.14,.33],trim);
    const crest=cylinder(head.root,.04,.13,.40,[0,.60,0],trim,5);placeholder.push(crest);
  }else{
    const core=new THREE.Mesh(skin==='ghostcake'?new THREE.CylinderGeometry(.44,.54,.6,9):new THREE.SphereGeometry(.52,10,7),skin==='ghostcake'?cream:brown);
    core.position.set(0,.40,0);torso.root.add(core);placeholder.push(core);
    ownBox(jaw,[.50,.11,.20],[0,-.015,.17],dark);
    for(let i=-2;i<=2;i++)ownBox(jaw,[.065,.11,.07],[i*.08,.065,.22],cream);
    if(skin==='ghostcake')for(const x of [-.22,0,.22]){const candle=cylinder(head.root,.025,.025,.23,[x,.27,0],trim,6);placeholder.push(candle);}
  }
  for(const side of [-1,1]){
    const suffix=side<0?'L':'R',hip=new THREE.Vector3(side*(knight?.23:.25),torsoBase,0),kneeY=knight?.67:.21,ankleY=knight?.16:.055;
    const upper=parts['thigh'+suffix]=part(rig,'Thigh'+suffix,hip),lower=parts['shin'+suffix]=part(rig,'Shin'+suffix,new THREE.Vector3(hip.x,kneeY,0));
    const foot=parts['foot'+suffix]=part(rig,'Foot'+suffix,new THREE.Vector3(hip.x,ankleY,0));
    ownBox(upper,[knight?.30:.09,torsoBase-kneeY,knight?.32:.1],[0,-(torsoBase-kneeY)/2,0],knight?iron:trim);
    ownBox(lower,[knight?.24:.075,kneeY-ankleY,knight?.28:.1],[0,-(kneeY-ankleY)/2,0],knight?iron:trim);
    if(knight)ownBox(foot,[.30,.17,.48],[0,-ankleY/2,.07],dark);
    else{const pad=cylinder(foot.root,.09,.12,.07,[0,-ankleY/2,.04],dark,8);pad.userData.keepFoodLimb=true;placeholder.push(pad);}
    legs.push({side,upper,lower,foot,hip,kneeY,ankleY,planted:false,target:new THREE.Vector3()});
    if(knight){
      const shoulder=new THREE.Vector3(side*.53,2.13,0),arm=parts['upperArm'+suffix]=part(rig,'UpperArm'+suffix,shoulder);
      const forearm=parts['lowerArm'+suffix]=part(rig,'Forearm'+suffix,new THREE.Vector3(side*.58,1.65,0));
      ownBox(arm,[.30,.49,.32],[0,-.23,0],iron);ownBox(forearm,[.22,.43,.27],[0,-.21,0],iron);
      ownBox(forearm,[.21,.17,.24],[0,-.48,0],dark);
    }
    // Emissive sockets remain independent from the moving visor/head surface.
    if(knight)greenLamp(head.root,[side*.068,.231,.223],.037);
  }
  // The Meshy food already includes a platter, mechanism and feet. Preserve
  // that ground contact instead of building a second support under the asset.
  if(!knight)for(const side of [-1,1]){const cam=cylinder(torso.root,.085,.085,.07,[side*.35,-.03,0],trim,10);cam.rotation.z=Math.PI/2;cam.name='Food camshaft gear';}
  for(const p of Object.values(parts)){p.pivot.multiplyScalar(gain);p.root.position.copy(p.pivot);
    for(const child of p.root.children){child.position.multiplyScalar(gain);const m=child as THREE.Mesh;if(m.isMesh)m.geometry.scale(gain,gain,gain);}}
  for(const leg of legs){leg.hip.copy(leg.upper.pivot);leg.kneeY=leg.lower.pivot.y;leg.ankleY=leg.foot.pivot.y;}
  group.userData.ghostHeight=height;group.userData.ghostVariant=options.variant??0;
  const diagnostics:EnemyVisualDiagnostics={kind,status:'loading',url:import.meta.env.BASE_URL+GHOST_ASSETS[skin],clips:['procedural clockwork gait'],activeClip:null,
    mappedNodes:Object.fromEntries(Object.entries(parts).map(([name,p])=>[name,p.root.name])),skinnedMeshes:0,meshes:0,animationTime:0,gaitPhase:0,state:'patrol'};
  group.userData.enemyVisual=diagnostics;group.userData.ghostArticulation={method:'Meshy surface triangle regions with rigid semantic armour joints',planting:'world-space foot anchors with analytic two-link knees',wholeRigScaleAnimation:false};
  let disposed=false,phase=0,lastHeading=0,headYaw=0,lastFrame:EnemyAnimationFrame={state:'patrol',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false},defeatTime=0;
  const ready=asset(skin).promise.then(a=>{
    if(disposed)return;
    if(a){
      if(knight){
        const names:Record<string,string>={Torso:'torso',Head:'head',LeftUpperArm:'upperArmL',LeftForearm:'lowerArmL',RightUpperArm:'upperArmR',RightForearm:'lowerArmR',LeftThigh:'thighL',LeftShin:'shinL',LeftFoot:'footL',RightThigh:'thighR',RightShin:'shinR',RightFoot:'footR'};
        let pivots:Record<string,[number,number,number]>|undefined;
        a.scene.traverse(node=>{if(node.userData.ghostTrainRig?.pivots)pivots=node.userData.ghostTrainRig.pivots;});
        if(pivots){const scale=height/(a.bounds.max.y-a.bounds.min.y),center=a.bounds.getCenter(new THREE.Vector3());
          for(const [name,value]of Object.entries(pivots)){const p=parts[names[name]];if(!p)continue;
            p.pivot.set((value[0]-center.x)*scale,(value[1]-a.bounds.min.y)*scale,(value[2]-center.z)*scale);p.root.position.copy(p.pivot);
          }
          for(const leg of legs){leg.hip.copy(leg.upper.pivot);leg.kneeY=leg.lower.pivot.y;leg.ankleY=leg.foot.pivot.y;leg.planted=false;}
          group.userData.ghostArticulation.measuredPivots=true;
        }
      }
      if(!knight){torso.pivot.set(0,height*(skin==='ghostcake'?.18:.29),0);torso.root.position.copy(torso.pivot);
        jaw.pivot.set(0,height*(skin==='ghostcake'?.28:.50),height*(skin==='ghostcake'?.14:.27));jaw.root.position.copy(jaw.pivot);}
      for(const mesh of placeholder){mesh.removeFromParent();mesh.geometry.dispose();}
      const retained=new Set<THREE.Material>();group.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])retained.add(m);});
      for(const mat of [iron,dark,trim,cream,brown])if(!retained.has(mat))mat.dispose();
      const result=segmented(a,height,parts,skin);diagnostics.meshes=result.meshes;group.userData.ghostTriangles=result.triangles;diagnostics.status='ready';group.userData.assetReady=true;update(0,lastFrame);
    }else {diagnostics.status='error';diagnostics.error=asset(skin).error;}
  });
  function update(dt:number,frame:EnemyAnimationFrame):void {
    if(disposed)return;lastFrame=frame;const moving=frame.speed>.03&&frame.grounded&&frame.alive;
    if(moving)phase=(phase+dt*frame.speed/((knight?1.10:.54)*gain))%1;
    if(!frame.alive)defeatTime+=dt;else defeatTime=0;
    const heading=group.rotation.y,turned=Math.abs(heading-lastHeading)>.4;lastHeading=heading;
    const beat=((frame.time*(skin==='ghostcake'?.52:.68)+(options.variant??0)*.19)%1+1)%1;
    const smooth=(v:number)=>{const t=THREE.MathUtils.clamp(v,0,1);return t*t*(3-2*t);};
    const mouth=beat<.12?0:beat<.25?smooth((beat-.12)/.13):beat<.53?1:beat<.62?1-smooth((beat-.53)/.09):0;
    const shared=characterElasticityAmplitudes(moving?'walk':'idle'),wave=frame.alive?Math.sin(moving?phase*Math.PI*4:frame.time*2.4+(options.variant??0)):0,pulse=enemyElasticPulse(defeatTime,.6);
    const anticipation=frame.alive&&kind==='hopper'?(frame.state==='crouch'?-Math.min(1,frame.stateTime/.45):frame.state==='leap'?Math.sin(Math.PI*Math.min(1,frame.stateTime/.36)):0):0;
    torso.root.position.copy(torso.pivot);torso.root.scale.y=1+(frame.alive?shared[0]*wave*(knight?.28:.7)+characterElasticityAmplitudes('jump')[0]*anticipation*.6+(knight?0:-mouth*.025):shared[0]*pulse);
    torso.root.rotation.z=moving?Math.sin(phase*Math.PI*2)*(knight?.027:.07):0;
    head.root.position.copy(head.pivot);head.root.rotation.x=frame.alive?(knight?-.09+Math.sin(frame.time*.65)*.025:Math.sin(frame.time*3)*.04):-.09*pulse;
    jaw.root.rotation.x=knight?0:frame.alive?.035+mouth*.36:.2*pulse;
    group.updateWorldMatrix(true,false);
    if(options.lookAt&&frame.alive){const target=options.lookAt(),local=group.worldToLocal(target.clone());
      const wanted=target.distanceTo(group.getWorldPosition(new THREE.Vector3()))<24?THREE.MathUtils.clamp(Math.atan2(local.x,local.z),-.95,.95):0;
      headYaw+=(wanted-headYaw)*(1-Math.exp(-Math.max(0,dt)*5));
    }else headYaw=frame.alive?headYaw:defeatTime>=.6?0:headYaw*Math.max(0,1-dt*12);
    head.root.rotation.y=headYaw;
    if(!knight)torso.root.rotation.y=frame.alive?headYaw*.22:0;
    for(const child of torso.root.children)if(child.name==='Food camshaft gear')child.rotation.x=frame.alive?beat*Math.PI*2:0;
    for(const leg of legs){
      const cycle=(phase+(leg.side<0?0:.5))%1,stance=!moving||cycle<.5;
      const stride=(knight?.275:.135)*gain,target=leg.foot.pivot.clone();
      if(moving){const swing=THREE.MathUtils.clamp((cycle-.5)*2,0,1);target.z+=stance?stride*Math.cos(cycle*Math.PI*2):-stride+2*stride*smooth((swing-.16)/.60);
        if(!stance)target.y+=Math.sin(Math.PI*smooth((swing-.10)/.84))*(knight?.20:.08)*gain;}
      if(stance&&frame.grounded&&frame.alive){
        if(!leg.planted||turned||!moving)leg.target.copy(group.localToWorld(target.clone()));
        target.copy(group.worldToLocal(leg.target.clone()));target.y=leg.ankleY;
      }
      leg.planted=stance&&frame.grounded&&frame.alive;
      const elastic=leg.planted?0:(frame.alive?shared[3]*Math.sin(cycle*Math.PI*2)*(knight?.32:.65):0)+pulse*.035;
      legSolve(leg,target,elastic);
      if(knight){const suffix=leg.side<0?'L':'R',arm=parts['upperArm'+suffix],forearm=parts['lowerArm'+suffix];
        // Four held servo poses communicate a mechanical procession. The
        // gameplay patrol remains smooth; only the independent joints hold.
        const swing=moving?Math.round(Math.sin(cycle*Math.PI*2)*4)*.05:0;
        arm.root.rotation.x=-.08-swing;arm.root.rotation.z=-Math.sign(arm.pivot.x)*.025;
        forearm.root.position.copy(forearm.pivot).sub(arm.pivot).applyQuaternion(arm.root.quaternion).add(arm.pivot);
        forearm.root.quaternion.copy(arm.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.08-swing*.35));
        forearm.root.scale.y=1+shared[2]*wave*.2;
      }
    }
    diagnostics.animationTime+=dt;diagnostics.gaitPhase=phase;diagnostics.state=frame.state;
    diagnostics.activeClip=moving?'servo step and hold':frame.alive?(knight?'watchful armour':'camshaft jaw show'):'finite defeat settle';
    group.userData.ghostServo={jaw:mouth,phase:beat,headYaw,stage:mouth===1?'held open':mouth===0?'latched':'actuating'};
    group.userData.ghostFootContacts=legs.map(l=>({side:l.side,planted:l.planted,target:l.target.toArray()}));
  }
  function reset():void {phase=0;defeatTime=0;headYaw=0;for(const leg of legs)leg.planted=false;update(0,{...lastFrame,alive:true,flung:false,speed:0,state:'patrol',stateTime:0});}
  update(0,lastFrame);
  return {group,body,ready,diagnostics,getMuzzlePosition:()=>false,update,reset,dispose:()=>{if(disposed)return;disposed=true;disposeOwned(group);diagnostics.status='disposed';}};
}
