import {lightBlockworksMaterial} from './blockworksLighting';
import * as THREE from 'three';
import {loadBlockworksModel,blockworksSourceBox} from './blockworksModelLoader';
import type {CustomComponent} from './level';

export const BLOCKWORKS_ASSET_KINDS=['bw-turret','bw-wall-bay','bw-buttress','bw-palm','bw-foliage','bw-lantern','bw-wheel','bw-winch','bw-rubble','bw-cliff','bw-parapet-v2','bw-spire-v2','bw-viaduct-v2','bw-jungle-shelf-v2','bw-coaster-v2','bw-steel-block','bw-hanging-vines','bw-steel-switch','bw-ghost-train-castle','bw-toxic-basin','bw-sludge-outfall','bw-sludge-stream'] as const;
export type BlockworksAssetKind=typeof BLOCKWORKS_ASSET_KINDS[number];
export const BLOCKWORKS_ASSET_LABELS:Record<BlockworksAssetKind,string>={
  'bw-ghost-train-castle':'Ruined ghost-train castle','bw-toxic-basin':'Toxic waste basin','bw-sludge-outfall':'Dripping sludge outfall','bw-sludge-stream':'Falling toxic sludge',
  'bw-turret':'Haunted castle turret','bw-wall-bay':'Haunted castle facade','bw-buttress':'Haunted stone buttress',
  'bw-palm':'Haunted island palm','bw-foliage':'Haunted island foliage','bw-lantern':'Amber park lantern',
  'bw-wheel':'Abandoned Ferris wheel','bw-winch':'Castle freight hoist','bw-rubble':'Chipped castle edge','bw-cliff':'Violet jungle crag',
  'bw-parapet-v2':'Storyboard stone coping','bw-spire-v2':'Slender haunted spire','bw-viaduct-v2':'Overgrown castle viaduct',
  'bw-jungle-shelf-v2':'Connected tropical canopy','bw-coaster-v2':'Abandoned coaster trestle',
  'bw-steel-block':'Weathered foundry steel block','bw-hanging-vines':'Trailing castle ivy','bw-steel-switch':'Brass foundry switch',
};
const HEIGHT:Record<BlockworksAssetKind,number>={'bw-ghost-train-castle':56,'bw-toxic-basin':4,'bw-sludge-outfall':3.4,'bw-sludge-stream':5,'bw-turret':16,'bw-wall-bay':7,'bw-buttress':9,'bw-palm':10,'bw-foliage':1.5,'bw-lantern':2.2,'bw-wheel':20,'bw-winch':3,'bw-rubble':.7,'bw-cliff':20,'bw-parapet-v2':.85,'bw-spire-v2':28,'bw-viaduct-v2':15,'bw-jungle-shelf-v2':8,'bw-coaster-v2':12,'bw-steel-block':.96,'bw-hanging-vines':3,'bw-steel-switch':.96};
type NativeBinding={proxy:THREE.Mesh;active:()=>boolean;ghostMaterial?:THREE.Material};
type BoundBatch={mesh:THREE.InstancedMesh;origin:THREE.Vector3;fit:THREE.Matrix4;source:THREE.Matrix4;rows:{index:number;binding:NativeBinding;last:THREE.Matrix4;active:boolean|null}[]};
type GhostBatch={faces:BoundBatch;lines:THREE.LineSegments;positions:THREE.BufferAttribute;edges:THREE.LineSegments[]};
export const isBlockworksAsset=(value:unknown):value is BlockworksAssetKind=>
  typeof value==='string'&&(BLOCKWORKS_ASSET_KINDS as readonly string[]).includes(value);

export function disposeBlockworksModel(model:THREE.Group):void{
  const geometry=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  model.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    geometry.add(mesh.geometry);for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      materials.add(mat);for(const value of Object.values(mat))if((value as THREE.Texture)?.isTexture)textures.add(value as THREE.Texture);
    }});
  for(const item of geometry)item.dispose();
  for(const item of materials)item.dispose();
  for(const item of textures){item.dispose();(item.image as {close?:()=>void})?.close?.();}
}

/** Original Meshy geometry/materials, shared in small spatial instance batches. */
export class BlockworksAssetKit {
  private jobs=new Map<BlockworksAssetKind,{rows:CustomComponent[];state:string;promise:Promise<void>}>();
  private models:THREE.Group[]=[];
  private roots:THREE.Group[]=[];
  private instances:THREE.InstancedMesh[]=[];
  private editorRoots=new Map<CustomComponent,THREE.Group>();
  private released=false;
  private lamps:THREE.Vector3[]=[];
  private interiors:THREE.Mesh[]=[];
  private interiorTexture:THREE.Texture|null=null;
  private lights:THREE.PointLight[]=[];
  private bindings=new Map<CustomComponent,NativeBinding>();
  private boundBatches:BoundBatch[]=[];
  private ghostBatches:GhostBatch[]=[];
  private ghostProxies=new Set<THREE.Mesh>();
  constructor(private root:THREE.Group,private instanced=true,private clock={value:0}){
    for(let i=0;i<4;i++){const lamp=new THREE.PointLight(0xffb35b,0,16,2);lamp.name='Pooled amber park lantern';root.add(lamp);this.lights.push(lamp);}
  }
  /** A visual instance follows the existing crate and its real switch state.
   * The original mesh remains the sole collision and interaction owner. */
  bindNative(c:CustomComponent,proxy:THREE.Mesh,active:()=>boolean,ghostMaterial?:THREE.Material):void{
    const row:CustomComponent={...c,t:'decor',p:[proxy.position.x,proxy.position.y-.48,proxy.position.z],s:[.96,.96,.96]};
    this.bindings.set(row,{proxy,active,ghostMaterial});this.decorate(row);
  }
  decorate(c:CustomComponent):void{
    const kind=c.dkind as BlockworksAssetKind;
    if(kind==='bw-lantern')this.lamps.push(new THREE.Vector3(...c.p).add(new THREE.Vector3(0,(c.rise??c.s?.[1]??2.2)*.72,0)));
    if(!this.instanced){const group=new THREE.Group();group.position.fromArray(c.p);group.name=BLOCKWORKS_ASSET_LABELS[kind];this.root.add(group);this.roots.push(group);this.editorRoots.set(c,group);}
    let job=this.jobs.get(kind);
    if(!job){
      job={rows:[],state:'loading',promise:Promise.resolve()};
      this.jobs.set(kind,job);const batch=job;
      batch.promise=(async()=>{
        try{
          const model=await loadBlockworksModel(kind);
          if(this.released){disposeBlockworksModel(model);return;}
          model.updateMatrixWorld(true);this.models.push(model);
          const box=blockworksSourceBox(model),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
          model.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
            mesh.geometry.userData.shared=true;
            for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
              lightBlockworksMaterial(mat,kind,this.clock);mat.userData.shared=true;
              for(const value of Object.values(mat))if((value as THREE.Texture)?.isTexture){const tex=value as THREE.Texture;tex.anisotropy=8;tex.userData.shared=true;}
            }});
          if(kind==='bw-ghost-train-castle'){
            const texture=await new THREE.TextureLoader().loadAsync(import.meta.env.BASE_URL+'blockworks-art/ghost-train-interior.png');
            if(this.released){texture.dispose();return;}
            texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;this.interiorTexture=texture;
          }
          const cells=new Map<string,CustomComponent[]>();
          for(const row of batch.rows){const key=this.instanced?Math.floor(row.p[0]/48)+':'+Math.floor(row.p[2]/48):String(cells.size);const rows=cells.get(key)??[];rows.push(row);cells.set(key,rows);}
          for(const rows of cells.values()){
            const origin=new THREE.Vector3(...rows[0].p),group=this.editorRoots.get(rows[0])??new THREE.Group();
            group.name=BLOCKWORKS_ASSET_LABELS[kind];group.position.copy(origin);
            group.userData.blockworksAsset={kind,instances:rows.length,originalMeshySurfaces:true};group.updateMatrix();group.matrixAutoUpdate=false;
            if(!this.editorRoots.has(rows[0])){this.root.add(group);this.roots.push(group);}
            model.traverse(object=>{
              const source=object as THREE.Mesh;if(!source.isMesh)return;
              const mesh=new THREE.InstancedMesh(source.geometry,source.material,rows.length);
              mesh.name=BLOCKWORKS_ASSET_LABELS[kind];mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.bwLod=source.userData.bwLod??0;mesh.matrixAutoUpdate=false;
              const bound:BoundBatch={mesh,origin,fit:new THREE.Matrix4().makeScale(.96/size.x,.96/size.y,.96/size.z)
                .multiply(new THREE.Matrix4().makeTranslation(-centre.x,-centre.y,-centre.z)),source:source.matrixWorld.clone(),rows:[]};
              rows.forEach((row,i)=>{
                const binding=this.bindings.get(row);
                if(binding){bound.rows.push({index:i,binding,last:new THREE.Matrix4(),active:null});return;}
                const scale=row.w??(row.rise??row.s?.[1]??HEIGHT[kind])/size.y;
                const rotation=new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,THREE.MathUtils.degToRad(row.yaw??0));
                const position=new THREE.Vector3(...row.p).sub(origin);
                const placement=new THREE.Matrix4().compose(position,rotation,(row.s?new THREE.Vector3(row.s[0]/size.x,row.s[1]/size.y,row.s[2]/size.z):new THREE.Vector3(scale,scale,scale)));
                placement.multiply(new THREE.Matrix4().makeTranslation(-centre.x,-box.min.y,-centre.z));
                placement.multiply(source.matrixWorld);mesh.setMatrixAt(i,placement);
              });
              if(bound.rows.length){this.boundBatches.push(bound);this.updateBoundBatch(bound);}
              mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);this.instances.push(mesh);
            });
            // Preserve the native outline geometry and state, but submit each
            // cell as two draws instead of two draws for every ghost cube.
            const ghosts=rows.map(row=>this.bindings.get(row)).filter((b):b is NativeBinding=>!!b&&!!b.proxy.children.find(o=>(o as THREE.LineSegments).isLineSegments));
            if(this.instanced&&ghosts.length)this.buildGhostBatch(ghosts,origin,group);
            if(kind==='bw-ghost-train-castle')for(const row of rows){
              const dimensions=row.s??[65,40,24],yaw=THREE.MathUtils.degToRad(row.yaw??0);
              // The supplied castle is open at the back. A recessed dark end
              // wall prevents bright sky leaking through the ghost-train portal.
              const dark=new THREE.MeshBasicMaterial({color:0x05040a,toneMapped:false}),depth=new THREE.MeshBasicMaterial({map:this.interiorTexture,toneMapped:false});
              const backing=new THREE.Mesh(new THREE.BoxGeometry(dimensions[0]*.27,dimensions[0]*.27,dimensions[2]*.3),[dark,dark,dark,dark,depth,dark]);
              const offset=new THREE.Vector3(0,dimensions[1]*.19,-dimensions[2]*.25).applyAxisAngle(THREE.Object3D.DEFAULT_UP,yaw);
              backing.position.fromArray(row.p).sub(origin).add(offset);backing.rotation.y=yaw;backing.updateMatrix();backing.matrixAutoUpdate=false;
              backing.userData.noShadow=true;backing.userData.visualOnly=true;backing.userData.solidSurface='none';
              group.add(backing);this.interiors.push(backing);
            }
            group.updateWorldMatrix(true,true);
            const sphere=new THREE.Box3().setFromObject(group).getBoundingSphere(new THREE.Sphere());
            group.userData.viewSphere=sphere;
          }
          batch.state='ready';
        }catch{if(!this.released)batch.state='error';}
      })();
    }
    job.rows.push(c);
  }
  private updateBoundBatch(batch:BoundBatch):boolean{
    let dirty=false;const placement=new THREE.Matrix4(),shift=new THREE.Matrix4().makeTranslation(-batch.origin.x,-batch.origin.y,-batch.origin.z);
    for(const row of batch.rows){
      const {proxy,active:readActive}=row.binding,active=readActive();
      proxy.updateMatrix();
      if(row.active===active&&row.last.equals(proxy.matrix))continue;
      row.active=active;row.last.copy(proxy.matrix);
      if(active)placement.copy(shift).multiply(proxy.matrix).multiply(batch.fit).multiply(batch.source);
      else placement.makeScale(0,0,0);
      batch.mesh.setMatrixAt(row.index,placement);dirty=true;
    }
    if(dirty){batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingBox();batch.mesh.computeBoundingSphere();}
    return dirty;
  }
  private buildGhostBatch(bindings:NativeBinding[],origin:THREE.Vector3,group:THREE.Group):void{
    const edges=bindings.map(b=>b.proxy.children.find(o=>(o as THREE.LineSegments).isLineSegments) as THREE.LineSegments);
    const material=(bindings[0].ghostMaterial??bindings[0].proxy.material as THREE.Material).clone();material.visible=true;
    const mesh=new THREE.InstancedMesh(bindings[0].proxy.geometry,material,bindings.length);
    mesh.name='Batched native ghost shells';mesh.userData.noShadow=true;mesh.userData.visualOnly=true;mesh.userData.solidSurface='none';group.add(mesh);this.instances.push(mesh);
    const faces:BoundBatch={mesh,origin,fit:new THREE.Matrix4(),source:new THREE.Matrix4(),rows:bindings.map((b,index)=>({index,last:new THREE.Matrix4(),active:null,
      binding:{proxy:b.proxy,active:()=>edges[index].visible&&b.proxy.visible}}))};
    const count=edges.reduce((n,e)=>n+e.geometry.getAttribute('position').count,0),positions=new THREE.BufferAttribute(new Float32Array(count*3),3);
    const geometry=new THREE.BufferGeometry().setAttribute('position',positions),lineMaterial=(edges[0].material as THREE.Material).clone();lineMaterial.visible=true;
    const lines=new THREE.LineSegments(geometry,lineMaterial);lines.userData.visualOnly=true;lines.userData.noShadow=true;lines.userData.solidSurface='none';group.add(lines);
    for(const b of bindings){this.ghostProxies.add(b.proxy);b.proxy.userData.blockworksGhostBatch=true;}
    for(const e of edges)for(const mat of Array.isArray(e.material)?e.material:[e.material])mat.visible=false;
    const batch={faces,lines,positions,edges};this.ghostBatches.push(batch);this.updateGhostBatch(batch);
  }
  private updateGhostBatch(batch:GhostBatch):void{
    if(!this.updateBoundBatch(batch.faces))return;
    let offset=0;const matrix=new THREE.Matrix4(),point=new THREE.Vector3();
    for(let i=0;i<batch.faces.rows.length;i++){
      const source=batch.edges[i].geometry.getAttribute('position');batch.faces.mesh.getMatrixAt(i,matrix);
      for(let j=0;j<source.count;j++){
        point.fromBufferAttribute(source,j).applyMatrix4(matrix);batch.positions.setXYZ(offset++,point.x,point.y,point.z);
      }
    }
    batch.positions.needsUpdate=true;batch.lines.geometry.computeBoundingBox();batch.lines.geometry.computeBoundingSphere();
  }
  setView(position:THREE.Vector3,far:number,secondary?:THREE.Vector3):void{
    for(const batch of this.boundBatches)this.updateBoundBatch(batch);
    for(const batch of this.ghostBatches)this.updateGhostBatch(batch);
    // Several visual states may share one native switch. Hide its original
    // material only when at least one successfully loaded variant is active.
    const covered=new Map<THREE.Mesh,boolean>();
    for(const batch of this.boundBatches)for(const row of batch.rows)covered.set(row.binding.proxy,!!row.active||covered.get(row.binding.proxy)===true);
    for(const [proxy,active]of covered)for(const mat of Array.isArray(proxy.material)?proxy.material:[proxy.material])mat.visible=!active&&!this.ghostProxies.has(proxy);
    for(const root of this.roots){
      const sphere=root.userData.viewSphere as THREE.Sphere|undefined,centre=sphere?.center??root.position;
      const distance=Math.max(0,Math.sqrt(Math.min(centre.distanceToSquared(position),secondary?centre.distanceToSquared(secondary):Infinity))-(sphere?.radius??0));
      root.visible=distance<Math.min(far,225);
      for(const child of root.children){const mesh=child as THREE.Mesh;if(!mesh.isMesh)continue;
        mesh.visible=true;
        mesh.castShadow=distance<38&&!mesh.userData.noShadow;mesh.receiveShadow=distance<85;
      }
    }
    const nearby=this.lamps.map(p=>({p,d:p.distanceToSquared(position)})).sort((a,b)=>a.d-b.d);
    for(let i=0;i<this.lights.length;i++){const cue=nearby[i];this.lights[i].intensity=cue&&cue.d<625?27:0;if(cue)this.lights[i].position.copy(cue.p);}
  }
  async ready():Promise<void>{await Promise.all([...this.jobs.values()].map(j=>j.promise));}
  get diagnostics(){return {models:Object.fromEntries([...this.jobs].map(([kind,j])=>[kind,{status:j.state,instances:j.rows.length}])),drawBatches:this.instances.length,
    ghostBatches:this.ghostBatches.length,visibleGhosts:this.ghostBatches.reduce((n,b)=>n+b.faces.rows.filter(r=>r.active).length,0),
    boundCrates:new Set([...this.bindings.values()].map(b=>b.proxy)).size,visibleBoundCrates:new Set(this.boundBatches.flatMap(b=>b.rows.filter(r=>r.active).map(r=>r.binding.proxy))).size};}
  dispose():void{
    this.released=true;for(const light of this.lights)light.removeFromParent();
    for(const group of this.roots)group.removeFromParent();
    for(const mesh of this.instances)mesh.dispose();
    for(const batch of this.ghostBatches){batch.lines.geometry.dispose();(batch.lines.material as THREE.Material).dispose();(batch.faces.mesh.material as THREE.Material).dispose();}
    this.ghostBatches.length=0;this.ghostProxies.clear();
    for(const mesh of this.interiors){mesh.geometry.dispose();for(const mat of new Set(Array.isArray(mesh.material)?mesh.material:[mesh.material]))mat.dispose();}
    this.interiorTexture?.dispose();this.interiorTexture=null;
    this.interiors.length=0;
    for(const model of this.models)disposeBlockworksModel(model);
    this.roots.length=0;this.instances.length=0;this.models.length=0;this.jobs.clear();this.bindings.clear();this.boundBatches.length=0;
  }
}
