import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import { sceneryLoads } from './assetLoadQueue';
import type { CustomComponent, CustomLevelData } from './level';
import { carlislePoint, CARLISLE_RELAY_SECTIONS, CARLISLE_RELAY_STOPS } from './levels/carlisle-tidal-relay';
import { harbourSurface, harbourOcean, harbourSky, harbourContactFoam } from './carlisleShipyardMaterials';
import { CarlisleMarineNet, marineFrameHeight } from './carlisleMarineNet';
import { CarlisleBoardwalk, carlisleDeckBoundary, type DeckTriangle } from './carlisleBoardwalk';
import { CarlisleCoastalBanks } from './carlisleCoastalBanks';

type P = [number, number, number];
const v = (p: P) => new THREE.Vector3(...p);
const names = ['net-housing','dock-winch','rotary-hub','work-skiff','cargo-crane','counterweight-hoist',
  'piling-fender','boathouse','cable-spool','dredger-pump','harbour-beacon','dock-lantern'];
type Kit = 'net-housing'|'dock-winch'|'rotary-hub'|'work-skiff'|'cargo-crane'|'counterweight-hoist'|
  'piling-fender'|'boathouse'|'cable-spool'|'dredger-pump'|'harbour-beacon'|'dock-lantern';
const cache=new AssetCache<Kit,GLTF>(async (name,_dependency,wanted)=>{
  const url=`${import.meta.env.BASE_URL}props/carlisle-shipyard/${String(names.indexOf(name)+1).padStart(2,'0')}-${name}.glb`;
  const gltf=await sceneryLoads.run(()=>new GLTFLoader().loadAsync(url),wanted);
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;
    m.geometry.userData.shared=true;
    for(const material of Array.isArray(m.material)?m.material:[m.material]) {
      material.userData.shared=true;
      for(const texture of Object.values(material))if(texture?.isTexture){texture.userData.shared=true;texture.anisotropy=8;}
      const pbr=material as THREE.MeshStandardMaterial;
      if(pbr.isMeshStandardMaterial){
        pbr.roughness=Math.max(.55,pbr.roughness);pbr.metalness=Math.min(.38,pbr.metalness);
        if(['boathouse','harbour-beacon','dock-lantern'].includes(name)){
          // Use the painted glass itself as the emissive mask, retaining its exact shape.
          pbr.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
            float glassMask=smoothstep(.25,.50,diffuseColor.g/max(diffuseColor.r,.001))*smoothstep(.15,.4,diffuseColor.r)*(1.-smoothstep(.35,.75,diffuseColor.b/max(diffuseColor.g,.001)));
            totalEmissiveRadiance+=vec3(1.,.21,.025)*glassMask*.85;
          `);};
          pbr.customProgramCacheKey=()=>`carlisle-glass-${name}`;
        }
      }
    }
  });return gltf;
},gltf=>{
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  gltf.scene.traverse(n=>{const m=n as THREE.Mesh;if(!m.isMesh)return;geometry.add(m.geometry);
    for(const a of Array.isArray(m.material)?m.material:[m.material])materials.add(a);});
  for(const m of materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}
  geometry.forEach(g=>g.dispose());disposeTextures(textures);
});

export function isCarlisleShipyard(data?: CustomLevelData) {
  return !!data && (data.name==='Carlisle Coast' && data.components.some(c=>c.nm==='Carlisle Coast · 4 km') || data.name==='Bonus: Springtide Skippers');
}
/** These old visual-only massing blocks are replaced by piers and harbour buildings. */
export function isCarlisleMassing(c: CustomComponent) {
  return c.solid===false && !c.lethal && (c.nm==='Grey sea'||c.nm==='Coastal strata'||c.nm==='Outer sea stack'||
    c.nm==='Beacon tower buttress'||/ · cliff$|^Act \d · sea stack/.test(c.nm??''));
}

type Placement={kind:Kit;p:P;size:P;yaw:number;parent?:THREE.Object3D};
type Batch={geometry:THREE.BufferGeometry;material:THREE.Material;matrices:THREE.Matrix4[];chunk:number;parent?:THREE.Object3D};

/** Presentation owns no collision, support, travel, input, or camera state. */
export class CarlisleShipyard {
  readonly ready:Promise<void>;
  readonly group=new THREE.Group();
  private readonly boardwalk=new CarlisleBoardwalk();
  private readonly coast=new CarlisleCoastalBanks();
  readonly diagnostics={status:'loading',sections:0,models:0,props:0,nets:0,mountedMovers:0,decorativeColliders:0,timber:this.boardwalk.diagnostics,coast:this.coast.diagnostics,water:{staticWash:0,movingWash:0},errors:[] as string[]};
  private readonly assets=cache.scope();
  private disposed=false;
  private readonly placements:Placement[]=[];
  private readonly attached:THREE.Object3D[]=[];
  private readonly restored:{mesh:THREE.Mesh;material:THREE.Material|THREE.Material[]}[]=[];
  private readonly chunks=new Map<number,THREE.Group>();
  private readonly batches=new Map<string,Batch>();
  private readonly geometries=new Set<THREE.BufferGeometry>();
  private readonly materials=new Set<THREE.Material>();
  private readonly lights:THREE.PointLight[]=[];
  private readonly lamps:THREE.Vector3[]=[];
  private readonly nets:{mesh:THREE.Object3D;net:CarlisleMarineNet;impact:number}[]=[];
  private readonly wood=this.own(harbourSurface('wood'));
  private readonly frameWood=this.own(harbourSurface('wood'));
  private readonly boatDeck=this.own(harbourSurface('wood',true));
  private readonly steel=this.own(harbourSurface('steel',true));
  private readonly wet=this.own(harbourSurface('wet'));
  private readonly navy=this.own(new THREE.MeshStandardMaterial({color:0x183047,roughness:.66,metalness:.35}));
  private readonly orange=this.own(new THREE.MeshStandardMaterial({color:0xd94f15,roughness:.68,metalness:.18}));
  private readonly iron=this.own(new THREE.MeshStandardMaterial({color:0x111f2a,roughness:.85}));
  private readonly glow=this.own(new THREE.MeshBasicMaterial({color:0xff782b,toneMapped:false}));
  private readonly foam=this.own(harbourContactFoam());
  private readonly hidden=this.own(new THREE.MeshBasicMaterial({visible:false}));
  private readonly shapes={box:this.geom(new THREE.BoxGeometry(1,1,1)),pole:this.geom(new THREE.CylinderGeometry(.5,.56,1,10)),
    bolt:this.geom(new THREE.SphereGeometry(.5,8,6)),ring:this.geom(new THREE.TorusGeometry(.5,.12,8,20)),
    wash:this.geom(new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2))};
  private readonly sky=harbourSky();
  private readonly ocean:ReturnType<typeof harbourOcean>;
  private readonly bonus:boolean;
  private time=0;
  private lightingCooldown=0;
  private lightingPosition=new THREE.Vector3(Infinity,Infinity,Infinity);
  constructor(root:THREE.Group,private data:CustomLevelData,ground:THREE.Mesh[]) {
    this.bonus=data.name==='Bonus: Springtide Skippers';
    this.frameWood.color.set(0xffb36c);
    this.group.name='Carlisle shipyard art';this.group.userData.visualOnly=true;root.add(this.group);
    this.group.add(this.sky);this.geometries.add(this.sky.geometry);this.materials.add(this.sky.material);
    this.ocean=harbourOcean(this.makeSea());this.group.add(this.ocean.mesh);this.materials.add(this.ocean.mesh.material);
    const source=new Map(ground.map(mesh=>[mesh.userData.editorIdx,mesh]));
    data.components.forEach((c,index)=>{
      const mesh=source.get(index);
      if(mesh && ['mesh','platform','mover','trampoline'].includes(c.t) && !c.invisible) this.surface(c,mesh);
      if(this.bonus && c.nm==='Springtide harbour water') {
        root.children.filter(n=>n.userData.editorIdx===index).forEach(n=>{const m=n as THREE.Mesh;if(m.isMesh)this.replace(m,this.hidden);});
      }
    });
    if(this.bonus)this.bonusYard();else this.mainYard();
    this.flushPrimitives();
    for(let i=0;i<6;i++){const light=new THREE.PointLight(0xff692c,0,27,1.6);this.group.add(light);this.lights.push(light);}
    this.ready=Promise.all([Promise.all(names.map(name=>this.assets.load(name as Kit))),this.boardwalk.load(),
      this.bonus?Promise.resolve():this.coast.load(this.ocean.mesh.geometry,z=>this.chunk(z))]).then(([assets])=>{
      if(this.disposed)return;
      assets.forEach((gltf,i)=>this.install(names[i] as Kit,gltf));
      this.diagnostics.models=assets.length;this.diagnostics.props=this.placements.length;this.diagnostics.status='ready';
    }).catch(error=>{if(!this.disposed){this.diagnostics.status='error';this.diagnostics.errors.push(String(error));}});
  }
  private own<T extends THREE.Material>(material:T):T{this.materials.add(material);return material;}
  private geom<T extends THREE.BufferGeometry>(geometry:T):T{this.geometries.add(geometry);return geometry;}
  private replace(mesh:THREE.Mesh,material:THREE.Material) {this.restored.push({mesh,material:mesh.material});mesh.material=material;}
  private chunk(z:number) {
    const id=Math.floor(-z/180);let group=this.chunks.get(id);
    if(!group){group=new THREE.Group();group.name=`Harbour scenery ${id}`;this.group.add(group);this.chunks.set(id,group);}
    return group;
  }
  private part(shape:keyof CarlisleShipyard['shapes'],p:P,size:P,mat:THREE.Material,yaw=0,parent?:THREE.Object3D,quaternion?:THREE.Quaternion) {
    const matrix=new THREE.Matrix4().compose(v(p),quaternion??new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),v(size));
    const chunk=Math.floor(-p[2]/180),key=`${shape}:${mat.uuid}:${parent?.uuid??chunk}`;
    let batch=this.batches.get(key);if(!batch){batch={geometry:this.shapes[shape],material:mat,matrices:[],chunk,parent};this.batches.set(key,batch);}
    batch.matrices.push(matrix);
  }
  private beam(a:P,b:P,width:number,material:THREE.Material,parent?:THREE.Object3D,round=false) {
    const delta=v(b).sub(v(a)),length=delta.length();if(length<.02)return;
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
    this.part(round?'pole':'box',v(a).add(v(b)).multiplyScalar(.5).toArray() as P,[width,length,width],material,0,parent,q);
  }
  private prop(kind:Kit,p:P,size:P,yaw=0,parent?:THREE.Object3D) {
    this.placements.push({kind,p,size,yaw,parent});
  }
  private lamp(p:P,height=4,parent?:THREE.Object3D) {
    this.prop('dock-lantern',p,[height*.44,height,height*.83],0,parent);
    const bulb:P=[p[0],p[1]+height*.78,p[2]+height*.21];
    this.part('bolt',bulb,[height*.13,height*.24,height*.13],this.glow,0,parent);
    if(!parent)this.lamps.push(v(bulb));
  }
  private waterlineWash(p:P,width:number,depth:number,yaw=0) {
    const slope=(this.seaY(p[2]+.5)-this.seaY(p[2]-.5));
    const q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(0,1,-slope).normalize());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
    this.part('wash',[p[0],this.seaY(p[2])+.04,p[2]],[width,1,depth],this.foam,0,undefined,q);
    this.diagnostics.water.staticWash++;
  }
  private pile(p:P,height:number,parent?:THREE.Object3D) {
    // Full authored fender prop at the water-facing cap, timber continues below.
    this.prop('piling-fender',[p[0],p[1]-3.9,p[2]],[2.25,4.1,2],0,parent);
    this.part('pole',[p[0],p[1]-height/2-1,p[2]],[1.5,height,1.5],this.wood,0,parent);
    if(!parent) {
      for(const offset of [-.55,.55])this.part('pole',[p[0]+offset,p[1]-height/2-1.5,p[2]+.42],[.7,height,.7],this.wood);
      for(const y of [p[1]-1.2,p[1]-1.45])this.part('ring',[p[0],y,p[2]],[1.4,1.4,1.4],this.orange,0,undefined,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI/2));
      this.waterlineWash(p,5.4,6.5);
    }
  }
  private surface(c:CustomComponent,mesh:THREE.Mesh) {
    const spring=c.t==='trampoline'||c.t==='mover'&&c.bounce!==undefined;
    const mover=c.t==='mover';
    if(spring){this.replace(mesh,this.hidden);this.net(c,mesh);}
    else this.replace(mesh,c.slip?this.wet:mover?(this.bonus?this.boatDeck:this.steel):/foot|piling|buoy/i.test(c.nm??'')?this.navy:this.wood);
    if(mover){this.diagnostics.mountedMovers++;this.movingDress(c,mesh,spring);return;}
    if(c.t==='mesh'&&c.solid&&c.grindTopTriangles){
      if(!c.slip){
        mesh.material=this.hidden;
        const triangles=this.deckTriangles(c,mesh),s=this.station(c.p[2]);
        const direction=v(carlislePoint(s+5,0)).sub(v(carlislePoint(s-5,0)));
        this.boardwalk.add(triangles,direction,this.chunk(c.p[2]));
      }
      this.dockEdges(c,mesh);
    }
    else if(c.t==='platform'&&c.s&&!/foot|piling|buoy/i.test(c.nm??'')){
      const [w,h,d]=c.s,holder=new THREE.Group();holder.name='Dock edge fittings';mesh.add(holder);this.attached.push(holder);
      if(!c.slip){
        mesh.material=this.hidden;
        const points=[v([-w/2,h/2,-d/2]),v([w/2,h/2,-d/2]),v([w/2,h/2,d/2]),v([-w/2,h/2,d/2])];
        this.boardwalk.add([[points[0],points[2],points[1]],[points[0],points[3],points[2]]],new THREE.Vector3(this.bonus?1:0,0,this.bonus?0:1),holder);
      }
      for(const x of [-w/2,w/2])this.beam([x,h/2-.2,-d/2],[x,h/2-.2,d/2],.32,this.navy,holder);
      for(const x of [-w/2+.3,w/2-.3])for(const z of [-d/2+.3,d/2-.3])this.part('box',[x,h/2-.12,z],[.8,.24,.8],this.orange,0,holder);
    }
  }
  private deckTriangles(c:CustomComponent,mesh:THREE.Mesh):DeckTriangle[] {
    mesh.updateMatrixWorld(true);const point=(i:number)=>v(c.vertices!.slice(i*3,i*3+3) as P).applyMatrix4(mesh.matrixWorld),triangles:DeckTriangle[]=[];
    for(let i=0;i<c.grindTopTriangles!*3;i+=3)triangles.push(c.indices!.slice(i,i+3).map(point) as DeckTriangle);
    return triangles;
  }
  private net(c:CustomComponent,mesh:THREE.Mesh) {
    const [w,h,d]=c.s!,mount=new THREE.Group();mount.name='Orange marine spring';mesh.add(mount);this.attached.push(mount);
    const frameH=marineFrameHeight(w,d),top=h/2,lip=Math.min(.15,Math.min(w,d)*.012);
    this.prop('net-housing',[0,top+lip-frameH*.87,0],[w,frameH,d],0,mount);
    const net=new CarlisleMarineNet(w,d,frameH);net.group.position.y=top+lip;mount.add(net.group);
    mesh.userData.marineNet=net.diagnostics;
    this.nets.push({mesh,net,impact:mesh.userData.trampolineVisualImpact?.id??0});this.diagnostics.nets++;
    // Under-deck mooring legs, never posts in the landing area.
    if(c.t==='trampoline'&&!this.bonus)for(const x of [-w*.37,w*.37])for(const z of [-d*.37,d*.37])
      this.part('pole',[x,top-5.5,z],[.7,9,.7],this.navy,0,mount);
  }
  private movingDress(c:CustomComponent,mesh:THREE.Mesh,spring:boolean) {
    const [w,h,d]=c.s!,group=new THREE.Group();group.name='Machinery riding native deck';mesh.add(group);this.attached.push(group);
    const top=h/2;
    if(this.bonus){
      // The visible top remains the native outline; the generated hull fits below it.
      this.prop('work-skiff',[0,top-1.88,0],[w,2.05,d],0,group);
      const wash=new THREE.Mesh(this.shapes.wash,this.foam);wash.name='Moving hull wash';wash.scale.set(w*1.35,1,d*1.8);
      // Bonus hulls translate along X at a fixed Y. Parenting the wash retains
      // native render interpolation instead of following one simulation tick late.
      mesh.updateWorldMatrix(true,false);wash.position.copy(mesh.worldToLocal(v([c.p[0],this.seaY(c.p[2])+.04,c.p[2]])));
      wash.renderOrder=2;wash.userData.visualOnly=true;mesh.add(wash);this.attached.push(wash);this.diagnostics.water.movingWash++;
      return;
    }
    if(!spring){
      for(const x of [-w/2+.3,w/2-.3])this.beam([x,top-.16,-d/2],[x,top-.16,d/2],.36,this.navy,group);
      for(let z=-d/2+2;z<d/2-1;z+=6){
        this.beam([-w/2,-h/2-.35,z],[w/2,-h/2-.35,z],.6,this.navy,group);
        for(const x of [-w/2+.38,w/2-.38]){
          this.part('box',[x,top-.08,z],[.76,.16,1.1],this.orange,0,group);
          this.part('bolt',[x,top+.025,z],[.28,.08,.28],this.iron,0,group);
        }
      }
      for(const z of [-d/2+.45,d/2-.45]){
        this.part('box',[0,top-.12,z],[w,.24,.75],this.orange,0,group);
        for(const x of [-w/2+.45,w/2-.45])this.part('bolt',[x,top+.035,z],[.23,.08,.23],this.iron,0,group);
      }
    }
    // The hub and cross bracing remain below the contact plane throughout motion.
    const springClearance=spring?Math.min(3,Math.min(w,d)*.2):0;
    this.prop(c.spin?'rotary-hub':/winch/i.test(c.nm??'')?'dock-winch':'counterweight-hoist',
      [0,-Math.min(w,d)*.38-h/2-springClearance,0],[Math.min(w,d)*.75,Math.min(w,d)*.35,Math.min(w,d)*.75],0,group);
    for(const side of [-1,1])this.beam([side*w*.4,-h/2-springClearance,-d*.4],[-side*w*.4,-h/2-2-springClearance,d*.4],.45,this.navy,group);
    if(spring)for(const x of [-w*.4,w*.4])for(const z of [-d*.4,d*.4])
      this.beam([x,-h/2,z],[x,-h/2-springClearance,z],.38,this.navy,group);
  }
  private dockEdges(c:CustomComponent,mesh:THREE.Mesh) {
    const boundary=carlisleDeckBoundary(this.deckTriangles(c,mesh));
    for(const {a,b} of boundary){
      const pa=a.clone(),pb=b.clone();pa.y-=c.slip?.22:.55;pb.y-=c.slip?.22:.55;
      this.beam(pa.toArray() as P,pb.toArray() as P,c.slip?.28:.48,c.slip?this.navy:this.frameWood);
    }
    const box=new THREE.Box3().setFromBufferAttribute(mesh.geometry.attributes.position as THREE.BufferAttribute).applyMatrix4(mesh.matrixWorld);
    const length=box.max.z-box.min.z;
    if(length<7)return;
    // Select real outer boundary samples, so supports never bridge authored cut-outs.
    for(let z=box.min.z+3;z<box.max.z-2;z+=11){
      const cuts:P[]=[];
      for(const e of boundary){const a=e.a,b=e.b;if((a.z<=z&&b.z>z)||(b.z<=z&&a.z>z)){
        const t=(z-a.z)/(b.z-a.z);cuts.push(a.clone().lerp(b,t).toArray() as P);}}
      cuts.sort((a,b)=>a[0]-b[0]);
      if(cuts.length<2)continue;
      for(const p of [cuts[0],cuts[cuts.length-1]]){
        const sea=this.seaY(p[2]),h=Math.max(5,p[1]-sea+1);
        this.pile([p[0],p[1]-.9,p[2]],h);
        this.part('box',[p[0],p[1]-.12,p[2]],[.75,.24,.85],this.orange);
      }
      if(Math.round(z/11)%3===0){const p=cuts[cuts.length-1];this.lamp([p[0]+1.6,p[1]-1,p[2]],3.8);}
      this.beam([cuts[0][0],cuts[0][1]-1.8,z],[cuts[cuts.length-1][0],cuts[cuts.length-1][1]-1.8,z],.5,this.wood);
    }
  }
  private seaY(z:number) {
    if(this.bonus)return -.05;
    // Follow the already-authored descending reset water, not the player/camera.
    const s=this.station(z);return carlislePoint(s,-8)[1];
  }
  private station(z:number) {let a=-150,b=4200;for(let i=0;i<15;i++){const m=(a+b)/2;if(carlislePoint(m,0)[2]>z)a=m;else b=m;}return(a+b)/2;}
  private makeSea() {
    const vertices:number[]=[],indices:number[]=[];
    if(this.bonus){vertices.push(-1200,-.05,-1200,1400,-.05,-1200,-1200,-.05,1200,1400,-.05,1200);indices.push(0,2,1,1,2,3);}
    else for(let i=0;i<=210;i++){
      const p=carlislePoint(-500+i*25,-8);vertices.push(-4400,p[1],p[2],4400,p[1],p[2]);
      if(i){const k=(i-1)*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}
    }
    const geo=this.geom(new THREE.BufferGeometry());geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
  }
  private quay(p:P,w:number,d:number,yaw=0) {
    // Decorative quays are built to whole-module dimensions. Their boards
    // retain the generated proportions and the same full geometry in reflections.
    const moduleWidth=24*.56/.954;w=Math.ceil(w/moduleWidth)*moduleWidth;d=Math.ceil(d/24)*24;
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const points=[[-w/2,0,-d/2],[w/2,0,-d/2],[w/2,0,d/2],[-w/2,0,d/2]].map(a=>v(a as P).applyQuaternion(q).add(v(p)));
    this.boardwalk.add([[points[0],points[2],points[1]],[points[0],points[3],points[2]]],new THREE.Vector3(0,0,1).applyQuaternion(q),this.chunk(p[2]),true);
    const posts:P[]=[];
    for(const x of [-w/2+1,w/2-1])for(let z=-d/2+1;z<=d/2;z+=Math.max(5,(d-2)/5)){
      const at=v([x,0,z]).applyQuaternion(q).add(v(p)).toArray() as P;
      this.pile(at,Math.max(7,at[1]-this.seaY(at[2])+2));
      posts.push(at);
    }
    const transform=(local:P)=>v(local).applyQuaternion(q).add(v(p)).toArray() as P;
    for(const side of [-1,1]) {
      this.beam(transform([side*w/2,-.45,-d/2]),transform([side*w/2,-.45,d/2]),.8,this.navy);
      this.beam(transform([-w/2,-.45,side*d/2]),transform([w/2,-.45,side*d/2]),.8,this.navy);
      // Scenery handrails live on the off-course wharves only.
      this.beam(transform([side*w/2,2,-d/2]),transform([side*w/2,2,d/2]),.12,this.orange,undefined,true);
    }
    for(const at of posts)this.beam(at,[at[0],at[1]+2.2,at[2]],.18,this.navy);
  }
  private landmark(kind:Kit,s:number,y:number,u:number,size:P,yaw=0) {
    const p=carlislePoint(s,y,u);this.prop(kind,p,size,yaw);return p;
  }
  private mainYard() {
    // Each section is authored as an identifiable working yard, not a repeated backdrop.
    const motifs:Kit[][]=[['boathouse','cargo-crane'],['cargo-crane','rotary-hub'],['counterweight-hoist','work-skiff'],
      ['boathouse','piling-fender'],['dock-winch','dock-winch'],['harbour-beacon','cargo-crane'],
      ['dredger-pump','rotary-hub'],['rotary-hub','cargo-crane'],['dredger-pump','dredger-pump'],
      ['cargo-crane','work-skiff'],['counterweight-hoist','dock-winch'],['cargo-crane','rotary-hub'],
      ['piling-fender','boathouse'],['rotary-hub','dredger-pump'],['cargo-crane','counterweight-hoist'],
      ['dock-winch','cable-spool'],['cargo-crane','harbour-beacon'],['harbour-beacon','boathouse']];
    const sizes:Record<Kit,P>={'net-housing':[13,2,14],'dock-winch':[15,15,28],'rotary-hub':[29,12,29],
      'work-skiff':[27,7.5,12.4],'cargo-crane':[18,38,45],'counterweight-hoist':[14,42,26],
      'piling-fender':[5,9,4.4],'boathouse':[35,22,31],'cable-spool':[13,13,12],
      'dredger-pump':[21,33,37],'harbour-beacon':[26,64,26],'dock-lantern':[2,4,3]};
    CARLISLE_RELAY_SECTIONS.forEach(([name,a,b],i)=>{
      const y=CARLISLE_RELAY_STOPS[i].y,side=i%2?-1:1,mid=(a+b)/2;
      const title=this.chunk(carlislePoint(mid,0)[2]);title.userData.sections??=[];title.userData.sections.push(name);
      for(let j=0;j<2;j++){
        const kind=motifs[i][j],s=a+(b-a)*(j?.75:.3),u=side*(j?-84:76),p=carlislePoint(s,y-3,u),size=sizes[kind];
        p[1]=Math.max(p[1],this.seaY(p[2])+4);
        this.quay(p,Math.max(24,size[0]+8),Math.max(26,size[2]+8));
        this.prop(kind,p,size,kind==='boathouse'?(u>0?Math.PI:0):j?Math.PI:0);
        this.lamp([p[0]-size[0]/2-2,p[1],p[2]+size[2]/2],6);
        this.lamp([p[0]+size[0]/2+2,p[1],p[2]+size[2]/2],6);
        if(kind!=='boathouse'&&i<12){
          const shed:P=[p[0]+side*26,p[1],p[2]-22];this.quay(shed,30,28);
          this.prop('boathouse',shed,[24,15,22],shed[0]>carlislePoint(s,0)[0]?Math.PI:0);
        }
        this.prop('cable-spool',[p[0]+size[0]/2+4,p[1],p[2]+3],[5,5,4.7]);
      }
      // Separate moorings leave dark lanes between the wharf and playable route.
      const density=i<6?4:i<12?3:2;
      for(let j=0;j<density;j++){
        const s=a+18+j*(b-a-35)/density,p=carlislePoint(s,y-1,-side*(28+(j%2)*7));
        this.pile(p,Math.max(8,p[1]-this.seaY(p[2])));if(j%2===0)this.lamp([p[0],p[1]+.4,p[2]],5);
      }
      if([0,2,3,9,12,17].includes(i)){
        const mooring=carlislePoint(mid,0,side*122);mooring[1]=this.seaY(mooring[2])-3;
        this.fishingBoat(mooring,i*.6);
      }
      if(i<6)this.receivingWharf(a+18,b-20,y,-side);
      this.diagnostics.sections++;
    });
    // Signature assemblies tie the machinery silhouette to the unique native challenge.
    this.landmark('harbour-beacon',1160,8,47,[34,84,34]);
    const dial=carlislePoint(1390,9,-57);this.part('pole',[dial[0],dial[1]-3,dial[2]],[54,6,54],this.navy);
    this.prop('dredger-pump',dial,[19,39,34]);
    for(const s of [1566,1605,1644,2626])this.landmark('rotary-hub',s,(s>2000?24:16)-14,0,[14,12,14]);
    for(const s of [1817,1858,1890]){const p=carlislePoint(s,14,-48);this.prop('dredger-pump',p,[19,34,32],Math.PI/2);}
    const turbine=carlislePoint(3020,3,35);this.part('pole',[turbine[0],turbine[1]+24,turbine[2]],[7,48,7],this.navy);
    for(let j=0;j<4;j++)this.prop('rotary-hub',[turbine[0],turbine[1]+j*13,turbine[2]],[19,6,19],j*.5);
    // Sparse rigging: cables are outlined by winches on their endpoints, never a false bridge.
    for(const c of this.data.components.filter(c=>c.t==='rail'&&c.pts&&/cable/.test(c.nm??''))){
      for(const q of [c.pts![0],c.pts![c.pts!.length-1]]){
        const p:P=[c.p[0]+q[0],c.p[1]+(q[3]??0),c.p[2]+q[1]];
        this.beam([p[0],this.seaY(p[2])-2,p[2]],[p[0],p[1]-1.2,p[2]],1.3,this.navy);
        this.prop('cable-spool',[p[0],p[1]-4.5,p[2]],[3.8,3.1,3.5]);
        this.lamp([p[0]+2,p[1]-3,p[2]],2.8);
      }
    }
  }
  private fishingBoat(p:P,yaw:number) {
    if(!this.bonus){
      // Moor long boats in a level reach of the authored water profile.
      let best=p[2],score=Infinity;
      for(let dz=-65;dz<=65;dz+=2){const z=p[2]+dz,span=18*Math.abs(Math.sin(yaw))+8*Math.abs(Math.cos(yaw));
        const a=this.seaY(z-span),b=this.seaY(z+span),candidate=Math.abs(a-b)+Math.abs(dz)*.001;
        if(candidate<score){best=z;score=candidate;}}
      p=[p[0],this.seaY(best)-3,best];
    }
    this.prop('work-skiff',p,[36,7,15],yaw);
    this.waterlineWash(p,45,24,yaw);
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw);
    const point=(local:P)=>v(local).applyQuaternion(q).add(v(p)).toArray() as P;
    this.part('box',point([-7,6,0]),[9,6,10],this.navy,yaw);
    this.part('box',point([-7,9.3,0]),[10,.7,11],this.orange,yaw);
    for(const z of [-5.06,5.06])for(const x of [-9,-5])this.part('box',point([x,7.7,z]),[2,2,.08],this.glow,yaw);
    this.beam(point([4,5,0]),point([4,32,0]),.45,this.wood);
    this.beam(point([4,26,0]),point([-12,8,5]),.10,this.iron,undefined,true);
    this.beam(point([4,26,0]),point([14,6,-5]),.10,this.iron,undefined,true);
    this.beam(point([-5,8,0]),point([10,19,0]),.5,this.orange);
    this.lamp(point([-10,10,0]),3);
  }
  private receivingWharf(a:number,b:number,y:number,side:number) {
    for(let s=a;s<b;s+=46) {
      const p=carlislePoint(s,y-4,side*134);p[1]=Math.max(p[1],this.seaY(p[2])+4);
      this.quay(p,46,40);
      this.prop('boathouse',[p[0]+side*5,p[1],p[2]-5],[30+(s%3)*4,19,29],side>0?Math.PI:0);
      this.lamp([p[0]-side*20,p[1],p[2]+12],5.5);
      this.prop('cable-spool',[p[0]-side*16,p[1],p[2]-12],[4,4,3.8]);
      // Bunched fishing traps and timber cross braces give the quay a working scale.
      for(let j=0;j<3;j++)this.part('box',[p[0]-side*16,p[1]+1.2+j%2*2.2,p[2]+j*2.5],[2.4,2.4,2.4],j%2?this.navy:this.orange);
    }
  }
  private bonusYard() {
    this.diagnostics.sections=1;
    for(const [i,x] of [-12,37,82,136].entries()){
      const p:P=[x,1.1,-22-i%2*5];this.quay(p,25,14);
      this.prop(i===2?'cargo-crane':'boathouse',p,i===2?[7,15,18]:[20,13,18],-Math.PI/2);
      this.lamp([x-10,1.2,-13],4);this.lamp([x+9,1.2,-13],4);
      this.prop('cable-spool',[x+9,1.2,-19],[3,3,2.8]);
    }
    for(let x=-15;x<146;x+=14){this.pile([x,.5,-8],5);if(x%28===13)this.lamp([x,1,-8],3.6);}
    this.fishingBoat([42,-1.8,-62],.2);this.fishingBoat([114,-1.8,-73],-.4);
  }
  private install(kind:Kit,gltf:GLTF) {
    const bounds=new THREE.Box3().setFromObject(gltf.scene,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
    const normalization=new THREE.Matrix4().makeScale(1/size.x,1/size.y,1/size.z).multiply(new THREE.Matrix4().makeTranslation(-center.x,-center.y,-center.z));
    const staticBatches=new Map<string,{original:THREE.Mesh;matrices:THREE.Matrix4[];chunk:number}>();
    for(const placement of this.placements.filter(p=>p.kind===kind)){
      const {p,size,yaw,parent}=placement;
      const transform=new THREE.Matrix4().compose(v([p[0],p[1]+size[1]/2,p[2]]),new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),v(size)).multiply(normalization);
      gltf.scene.traverse(n=>{
        const original=n as THREE.Mesh;if(!original.isMesh)return;
        const matrix=transform.clone().multiply(original.matrixWorld);
        if(parent){const mesh=new THREE.Mesh(original.geometry,original.material);mesh.name=kind;mesh.applyMatrix4(matrix);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);}
        else {const chunk=Math.floor(-p[2]/180),key=`${original.uuid}:${chunk}`;let batch=staticBatches.get(key);
          if(!batch){batch={original,matrices:[],chunk};staticBatches.set(key,batch);}batch.matrices.push(matrix);}
      });
    }
    for(const {original,matrices,chunk} of staticBatches.values()){
      const mesh=new THREE.InstancedMesh(original.geometry,original.material,matrices.length);mesh.name=kind;
      matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();this.chunk(-chunk*180).add(mesh);
    }
  }
  private flushPrimitives() {
    for(const {geometry,material,matrices,chunk,parent} of this.batches.values()){
      const mesh=new THREE.InstancedMesh(geometry,material,matrices.length);matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
      const wash=material===this.foam;
      mesh.castShadow=!wash;mesh.receiveShadow=!wash;if(wash){mesh.name='Tidal contact wash';mesh.renderOrder=2;mesh.userData.visualOnly=true;}
      mesh.computeBoundingSphere();(parent??this.chunk(-chunk*180)).add(mesh);
    }this.batches.clear();
  }
  update(dt:number,player:THREE.Vector3) {
    this.time+=dt;this.ocean.uniforms.time.value=this.time;this.foam.uniforms.time.value=this.time;this.sky.position.copy(player);
    this.coast.update(this.time);
    for(const [id,group] of this.chunks)group.visible=Math.abs(player.z+id*180)<800;
    this.lightingCooldown-=dt;
    if(this.lightingCooldown<=0||this.lightingPosition.distanceToSquared(player)>400){
      this.lightingCooldown=.2;this.lightingPosition.copy(player);
      const lamps=[...this.lamps].sort((a,b)=>a.distanceToSquared(player)-b.distanceToSquared(player));
      for(let i=0;i<24;i++)this.ocean.uniforms.lamps.value[i].copy(lamps[i]??new THREE.Vector3(1e6,0,1e6));
      this.lights.forEach((light,i)=>{const p=lamps[i];light.intensity=p&&p.distanceToSquared(player)<10000?85:0;if(p)light.position.copy(p);});
    }
    for(const entry of this.nets){
      const impact=entry.mesh.userData.trampolineVisualImpact;
      if(impact&&impact.id!==entry.impact){entry.impact=impact.id;entry.net.impact(impact.x,impact.z,impact.speed);}
      entry.net.update(dt);
    }
  }
  dispose() {
    this.disposed=true;
    this.boardwalk.dispose();
    this.coast.dispose();
    for(const {mesh,net}of this.nets){delete mesh.userData.marineNet;net.dispose();}this.nets.length=0;
    for(const node of [...this.attached,this.group])node.traverse(n=>{if((n as THREE.InstancedMesh).isInstancedMesh)(n as THREE.InstancedMesh).dispose();});
    this.attached.forEach(n=>n.removeFromParent());this.group.removeFromParent();
    this.restored.forEach(({mesh,material})=>mesh.material=material);
    const textures=new Set<THREE.Texture>();for(const m of this.materials){for(const t of Object.values(m))if(t?.isTexture)textures.add(t);m.dispose();}
    this.geometries.forEach(g=>g.dispose());disposeTextures(textures);this.assets.dispose();
  }
}

export function createCarlisleShipyard(root:THREE.Group,data:CustomLevelData,ground:THREE.Mesh[]) {
  return isCarlisleShipyard(data)?new CarlisleShipyard(root,data,ground):null;
}
