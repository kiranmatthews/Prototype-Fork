import {lightBlockworksMaterial} from './blockworksLighting';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import type {CustomComponent} from './level';

export const BLOCKWORKS_ASSET_KINDS=['bw-turret','bw-wall-bay','bw-buttress','bw-palm','bw-foliage','bw-lantern','bw-wheel','bw-winch','bw-rubble','bw-cliff','bw-parapet-v2','bw-spire-v2','bw-viaduct-v2','bw-jungle-shelf-v2','bw-coaster-v2'] as const;
export type BlockworksAssetKind=typeof BLOCKWORKS_ASSET_KINDS[number];
export const BLOCKWORKS_ASSET_LABELS:Record<BlockworksAssetKind,string>={
  'bw-turret':'Haunted castle turret','bw-wall-bay':'Haunted castle facade','bw-buttress':'Haunted stone buttress',
  'bw-palm':'Haunted island palm','bw-foliage':'Haunted island foliage','bw-lantern':'Amber park lantern',
  'bw-wheel':'Abandoned Ferris wheel','bw-winch':'Castle freight hoist','bw-rubble':'Chipped castle edge','bw-cliff':'Violet jungle crag',
  'bw-parapet-v2':'Storyboard stone coping','bw-spire-v2':'Slender haunted spire','bw-viaduct-v2':'Overgrown castle viaduct',
  'bw-jungle-shelf-v2':'Connected tropical canopy','bw-coaster-v2':'Abandoned coaster trestle',
};
const HEIGHT:Record<BlockworksAssetKind,number>={'bw-turret':16,'bw-wall-bay':7,'bw-buttress':9,'bw-palm':10,'bw-foliage':1.5,'bw-lantern':2.2,'bw-wheel':20,'bw-winch':3,'bw-rubble':.7,'bw-cliff':20,'bw-parapet-v2':.85,'bw-spire-v2':28,'bw-viaduct-v2':15,'bw-jungle-shelf-v2':8,'bw-coaster-v2':12};
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
  private lights:THREE.PointLight[]=[];
  constructor(private root:THREE.Group,private instanced=true){
    for(let i=0;i<4;i++){const lamp=new THREE.PointLight(0xffb35b,0,16,2);lamp.name='Pooled amber park lantern';root.add(lamp);this.lights.push(lamp);}
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
          const gltf=await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'blockworks-art/'+kind.slice(3)+'.glb');
          const model=gltf.scene;
          if(this.released){disposeBlockworksModel(model);return;}
          model.updateMatrixWorld(true);this.models.push(model);
          const box=new THREE.Box3().setFromObject(model),size=box.getSize(new THREE.Vector3()),centre=box.getCenter(new THREE.Vector3());
          model.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
            mesh.geometry.userData.shared=true;
            for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
              lightBlockworksMaterial(mat,kind);mat.userData.shared=true;
              for(const value of Object.values(mat))if((value as THREE.Texture)?.isTexture){const tex=value as THREE.Texture;tex.anisotropy=8;tex.userData.shared=true;}
            }});
          const cells=new Map<string,CustomComponent[]>();
          for(const row of batch.rows){const key=this.instanced?Math.floor(row.p[0]/48)+':'+Math.floor(row.p[2]/48):String(cells.size);const rows=cells.get(key)??[];rows.push(row);cells.set(key,rows);}
          for(const rows of cells.values()){
            const origin=new THREE.Vector3(...rows[0].p),group=this.editorRoots.get(rows[0])??new THREE.Group();
            group.name=BLOCKWORKS_ASSET_LABELS[kind];group.position.copy(origin);
            group.userData.blockworksAsset={kind,instances:rows.length,originalMeshySurfaces:true};
            if(!this.editorRoots.has(rows[0])){this.root.add(group);this.roots.push(group);}
            model.traverse(object=>{
              const source=object as THREE.Mesh;if(!source.isMesh)return;
              const mesh=new THREE.InstancedMesh(source.geometry,source.material,rows.length);
              mesh.name=BLOCKWORKS_ASSET_LABELS[kind];mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;mesh.castShadow=true;mesh.receiveShadow=true;
              rows.forEach((row,i)=>{
                const scale=row.w??(row.rise??row.s?.[1]??HEIGHT[kind])/size.y;
                const rotation=new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,THREE.MathUtils.degToRad(row.yaw??0));
                const position=new THREE.Vector3(...row.p).sub(origin);
                const placement=new THREE.Matrix4().compose(position,rotation,(row.s?new THREE.Vector3(row.s[0]/size.x,row.s[1]/size.y,row.s[2]/size.z):new THREE.Vector3(scale,scale,scale)));
                placement.multiply(new THREE.Matrix4().makeTranslation(-centre.x,-box.min.y,-centre.z));
                placement.multiply(source.matrixWorld);mesh.setMatrixAt(i,placement);
              });
              mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();group.add(mesh);this.instances.push(mesh);
            });
          }
          batch.state='ready';
        }catch{if(!this.released)batch.state='error';}
      })();
    }
    job.rows.push(c);
  }
  setView(position:THREE.Vector3,far:number,secondary?:THREE.Vector3):void{
    for(const root of this.roots){const radius=far+80;root.visible=root.position.distanceToSquared(position)<radius*radius||!!secondary&&root.position.distanceToSquared(secondary)<radius*radius;}
    const nearby=this.lamps.map(p=>({p,d:p.distanceToSquared(position)})).sort((a,b)=>a.d-b.d);
    for(let i=0;i<this.lights.length;i++){const cue=nearby[i];this.lights[i].intensity=cue&&cue.d<625?16:0;if(cue)this.lights[i].position.copy(cue.p);}
  }
  async ready():Promise<void>{await Promise.all([...this.jobs.values()].map(j=>j.promise));}
  get diagnostics(){return {models:Object.fromEntries([...this.jobs].map(([kind,j])=>[kind,{status:j.state,instances:j.rows.length}])),drawBatches:this.instances.length};}
  dispose():void{
    this.released=true;for(const light of this.lights)light.removeFromParent();
    for(const group of this.roots)group.removeFromParent();
    for(const mesh of this.instances)mesh.dispose();
    for(const model of this.models)disposeBlockworksModel(model);
    this.roots.length=0;this.instances.length=0;this.models.length=0;this.jobs.clear();
  }
}
