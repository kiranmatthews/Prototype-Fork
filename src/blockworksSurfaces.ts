import {lightBlockworksMaterial} from './blockworksLighting';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {disposeBlockworksModel} from './blockworksAssets';
import type {CustomComponent} from './level';

export const BLOCKWORKS_SURFACE_KINDS=['bw-stone-deck','bw-roof-deck','bw-metal-deck','bw-ice-deck','bw-aqueduct-module'] as const;
export type BlockworksSurfaceKind=typeof BLOCKWORKS_SURFACE_KINDS[number];
export const BLOCKWORKS_SURFACE_LABELS=Object.fromEntries(BLOCKWORKS_SURFACE_KINDS.map(k=>[k,'Meshy '+k.slice(3).replace(/-/g,' ')])) as Record<BlockworksSurfaceKind,string>;
export const isBlockworksSurface=(k:unknown):k is BlockworksSurfaceKind=>typeof k==='string'&&(BLOCKWORKS_SURFACE_KINDS as readonly string[]).includes(k);
type Asset={scene:THREE.Group;box:THREE.Box3;size:THREE.Vector3;profile:number[];grid?:{size:number;heights:number[]}};
const mix=THREE.MathUtils.lerp;

/** Fit real, textured Meshy modules to the authored path. No generated
 * texture repetitions or procedural substitute surfaces are used. */
export class BlockworksSurfaces {
  private loads=new Map<string,Promise<Asset>>();
  private pending:Promise<void>[]=[];
  private models:THREE.Group[]=[];
  private pieces:THREE.Group[]=[];
  private owners:THREE.Group[]=[];
  private proxies=new Map<THREE.Group,THREE.Mesh>();
  private geometries:THREE.BufferGeometry[]=[];
  private states:Record<string,string>={};
  private disposed=false;
  constructor(private root:THREE.Group){}
  private load(kind:BlockworksSurfaceKind):Promise<Asset>{
    let promise=this.loads.get(kind);if(promise)return promise;
    this.states[kind]='loading';
    promise=(async()=>{
      const scene=(await new GLTFLoader().loadAsync(import.meta.env.BASE_URL+'blockworks-art/'+kind.slice(3)+'.glb')).scene;
      if(this.disposed){disposeBlockworksModel(scene);throw Error('Released level');}
      this.models.push(scene);scene.updateMatrixWorld(true);
      const box=new THREE.Box3().setFromObject(scene),size=box.getSize(new THREE.Vector3());
      scene.traverse(o=>{const mesh=o as THREE.Mesh;if(!mesh.isMesh)return;mesh.geometry.userData.shared=true;
        for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
          lightBlockworksMaterial(mat,kind);mat.userData.shared=true;for(const v of Object.values(mat))if((v as THREE.Texture)?.isTexture){const t=v as THREE.Texture;t.userData.shared=true;t.anisotropy=8;}
        }});
      const profile:number[]=[];
      const grid=scene.userData.bwRideSurface as Asset['grid'];
      if(kind==='bw-aqueduct-module'&&!grid){
        const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
        for(let i=0;i<=128;i++){
          const x=mix(box.min.x+.0001,box.max.x-.0001,i/128);
          ray.set(new THREE.Vector3(x,box.max.y+.1,(box.min.z+box.max.z)/2),down);ray.far=size.y+.2;
          profile.push(ray.intersectObject(scene,true)[0]?.point.y??box.min.y);
        }
      }
      this.states[kind]='ready';return {scene,box,size,profile,grid};
    })();this.loads.set(kind,promise);return promise;
  }
  decorate(c:CustomComponent):void {
    const kind=c.dkind as BlockworksSurfaceKind,owner=new THREE.Group();owner.name=BLOCKWORKS_SURFACE_LABELS[kind];this.root.add(owner);this.owners.push(owner);
    this.pending.push(this.load(kind).then(asset=>{if(!this.disposed)this.path(c,kind,asset,undefined,owner);}).catch(()=>{this.states[kind]='error';}));
  }
  fitNative(c:CustomComponent,proxy:THREE.Mesh):void{
    const kind=c.dkind as BlockworksSurfaceKind;
    proxy.geometry.computeBoundingBox();const b=proxy.geometry.boundingBox!;
    let from:[number,number,number]=[0,b.max.y,b.max.z],to:[number,number,number]=[0,b.max.y,b.min.z],width=b.max.x-b.min.x;
    if(c.t==='mesh'&&c.vertices&&c.vertices.length>=12){
      const v=c.vertices;
      from=[(v[0]+v[3])/2,(v[1]+v[4])/2,(v[2]+v[5])/2];
      to=[(v[6]+v[9])/2,(v[7]+v[10])/2,(v[8]+v[11])/2];
      width=Math.hypot(v[3]-v[0],v[5]-v[2]);
    }
    const surface:CustomComponent={t:'decor',dkind:kind,p:from,s:[width,Math.min(1.2,Math.max(.18,b.max.y-b.min.y)),6],
      pts:[[0,0,0,0],[to[0]-from[0],to[2]-from[2],0,to[1]-from[1]]]};
    this.pending.push(this.load(kind).then(a=>{if(!this.disposed)this.path(surface,kind,a,proxy);}).catch(()=>{this.states[kind]='error';}));
  }
  private path(c:CustomComponent,kind:BlockworksSurfaceKind,a:Asset,proxy?:THREE.Mesh,owner:THREE.Group=this.root):void{
    const points=(c.pts??[[0,0,0,0],[0,-(c.len??6),0,0]]).map(p=>new THREE.Vector3(p[0]+c.p[0],c.p[1]+(p[3]??0),p[1]+c.p[2]));
    const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+Math.hypot(points[i].x-points[i-1].x,points[i].z-points[i-1].z));
    const total=distances[distances.length-1];if(total<.01)return;
    const frame=(d:number)=>{
      d=THREE.MathUtils.clamp(d,0,total);let i=1;while(i<distances.length-1&&distances[i]<d)i++;
      const t=(d-distances[i-1])/Math.max(.0001,distances[i]-distances[i-1]);
      const centre=points[i-1].clone().lerp(points[i],t);
      const forward=points[i].clone().sub(points[i-1]);forward.y=0;forward.normalize();
      const width=mix(c.widths?.[i-1]??c.s?.[0]??8,c.widths?.[i]??c.s?.[0]??8,t);
      return {centre,right:new THREE.Vector3(-forward.z,0,forward.x),width};
    };
    const count=Math.ceil(total/7),length=total/count;
    const pipe=kind==='bw-aqueduct-module';
    const sampleGrid=(x:number,z:number)=>{
      if(!a.grid)return 0;const n=a.grid.size,fx=THREE.MathUtils.clamp(x,0,.999999)*(n-1),fz=THREE.MathUtils.clamp(z,0,.999999)*(n-1),ix=Math.floor(fx),iz=Math.floor(fz),h=a.grid.heights;
      return mix(mix(h[iz*n+ix],h[iz*n+ix+1],fx-ix),mix(h[(iz+1)*n+ix],h[(iz+1)*n+ix+1],fx-ix),fz-iz);
    };
    const floorSource=a.grid?sampleGrid(.5,.5):a.profile.length?a.profile[64]:0;
    const pipeScale=(c.rise??3.6)/Math.max(.001,Math.max(...(a.grid?.heights??a.profile))-floorSource);
    for(let index=0;index<count;index++){
      const start=index*length,origin=frame(start+length/2).centre,group=new THREE.Group();group.position.copy(origin);
      group.name=BLOCKWORKS_SURFACE_LABELS[kind];group.userData.blockworksModule={kind,originalUVs:true};
      (proxy??owner).add(group);this.pieces.push(group);if(proxy)this.proxies.set(group,proxy);
      a.scene.traverse(object=>{
        const source=object as THREE.Mesh;if(!source.isMesh)return;
        const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);
        const positions=geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          const nx=THREE.MathUtils.clamp((positions.getX(i)-a.box.min.x)/a.size.x,0,1);
          const rawNz=THREE.MathUtils.clamp((a.box.max.z-positions.getZ(i))/a.size.z,0,1);
          // The Meshy aqueduct has projecting support feet beyond each open
          // riding end. Join the measured riding span, allowing feet to overlap below.
          const nz=pipe?(rawNz-.12)/.76:rawNz;
          const current=frame(start-.025+nz*(length+.05)),u=(nx-.5)*current.width;
          let height:number;
          if(pipe){
            const radius=c.rise??3.6,flat=c.w??2.6,q=Math.min(radius,Math.max(0,Math.abs(u)-flat));
            const riding=radius-Math.sqrt(Math.max(0,radius*radius-q*q));
            const sample=nx*128,lo=Math.min(127,Math.floor(sample)),sourceTop=a.grid?sampleGrid(nx,THREE.MathUtils.clamp(1-rawNz,.12,.88)):mix(a.profile[lo],a.profile[lo+1],sample-lo);
            const delta=(positions.getY(i)-sourceTop)*pipeScale;
            height=riding+(delta>-.2?THREE.MathUtils.clamp(delta,-.035,.018):delta);
          }else{
            const ny=THREE.MathUtils.clamp((positions.getY(i)-a.box.min.y)/a.size.y,0,1);
            // Retain the modeled slabs and bevels while keeping their shallow
            // top relief within 4cm of the authoritative walkable plane.
            height=ny>.65?mix(-.04,.015,(ny-.65)/.35):mix(-(c.s?.[1]??1.2),-.04,ny/.65);
          }
          const p=current.centre.addScaledVector(current.right,u);p.y+=height;p.sub(origin);
          positions.setXYZ(i,p.x,p.y,p.z);
        }
        positions.needsUpdate=true;geometry.deleteAttribute('tangent');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
        this.geometries.push(geometry);
        const mesh=new THREE.Mesh(geometry,source.material);mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
      });
    }
  }
  setView(position:THREE.Vector3,far:number,secondary?:THREE.Vector3):void{
    const world=new THREE.Vector3();
    for(const p of this.pieces){
      const proxy=this.proxies.get(p),mat=proxy?.material as THREE.MeshLambertMaterial|undefined;
      const ghost=!!(proxy?.userData.outlinedSurface&&mat?.wireframe);
      if(proxy){for(const m of Array.isArray(proxy.material)?proxy.material:[proxy.material])m.visible=ghost;}
      p.getWorldPosition(world);p.visible=!ghost&&(world.distanceToSquared(position)<(far+25)**2||!!secondary&&world.distanceToSquared(secondary)<(far+25)**2);
    }
  }
  async ready():Promise<void>{await Promise.all(this.pending);}
  get diagnostics(){return {models:this.states,modules:this.pieces.length,geometrySource:'Meshy original topology and UVs fitted to native path'};}
  dispose():void{
    this.disposed=true;
    for(const p of this.pieces)p.removeFromParent();
    for(const owner of this.owners)owner.removeFromParent();
    for(const g of this.geometries)g.dispose();
    const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    for(const model of this.models)model.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;geos.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material]){mats.add(mat);for(const v of Object.values(mat))if((v as THREE.Texture)?.isTexture)textures.add(v as THREE.Texture);}});
    for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures){t.dispose();(t.image as {close?:()=>void})?.close?.();}
  }
}
