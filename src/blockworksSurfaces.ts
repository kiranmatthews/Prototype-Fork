import {lightBlockworksMaterial} from './blockworksLighting';
import * as THREE from 'three';
import {loadBlockworksModel,blockworksDetail,blockworksSourceBox} from './blockworksModelLoader';
import {disposeBlockworksModel} from './blockworksAssets';
import type {CustomComponent} from './level';

export const BLOCKWORKS_SURFACE_KINDS=['bw-stone-deck','bw-roof-deck','bw-metal-deck','bw-ice-deck','bw-aqueduct-module','bw-flagstone-deck-v2','bw-aqueduct-v2','bw-flagstone-deck-v3','bw-aqueduct-v3','bw-rivet-deck-v2','bw-grind-rail','bw-aqueduct-coping','bw-flagstone-deck-v4','bw-stone-wedge','bw-metal-wedge'] as const;
export type BlockworksSurfaceKind=typeof BLOCKWORKS_SURFACE_KINDS[number];
export const BLOCKWORKS_SURFACE_LABELS=Object.fromEntries(BLOCKWORKS_SURFACE_KINDS.map(k=>[k,'Meshy '+k.slice(3).replace(/-/g,' ')])) as Record<BlockworksSurfaceKind,string>;
export const isBlockworksSurface=(k:unknown):k is BlockworksSurfaceKind=>typeof k==='string'&&(BLOCKWORKS_SURFACE_KINDS as readonly string[]).includes(k);
type Asset={scene:THREE.Group;box:THREE.Box3;size:THREE.Vector3;profile:number[];grid?:{size:number;heights:number[]};wedge?:{low:number;high:number;toeZ:number;base:number}};
const mix=THREE.MathUtils.lerp;

/** The Meshy paving is 24 separate sculpted stones. Close their deep joints
 * by fitting the existing blocks together, retaining every painted UV and face.
 * Only the lower sides flare into the joints; the chipped outer rim stays put. */
function seatStoneBlocks(geometry:THREE.BufferGeometry):void{
  const p=geometry.getAttribute('position'),index=geometry.index;if(!index)return;
  const parent=Int32Array.from({length:p.count},(_,i)=>i),weld=new Map<string,number>();
  const find=(i:number):number=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;};
  for(let i=0;i<p.count;i++){
    const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(':');
    const other=weld.get(key);if(other!==undefined)parent[find(i)]=find(other);else weld.set(key,i);
  }
  for(let i=0;i<index.count;i+=3){const a=find(index.getX(i));parent[find(index.getX(i+1))]=a;parent[find(index.getX(i+2))]=a;}
  const bounds=new Map<number,THREE.Box3>(),v=new THREE.Vector3();
  geometry.computeBoundingBox();const box=geometry.boundingBox!,size=box.getSize(new THREE.Vector3());
  for(let i=0;i<p.count;i++){const id=find(i),b=bounds.get(id)??new THREE.Box3();b.expandByPoint(v.fromBufferAttribute(p,i));bounds.set(id,b);}
  const centres=new Map([...bounds].map(([id,b])=>[id,b.getCenter(new THREE.Vector3())]));
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),centre=centres.get(find(i))!;
    const ny=(y-box.min.y)/size.y,amount=.06+.34*(1-THREE.MathUtils.smoothstep(ny,.6,.94));
    const ex=THREE.MathUtils.smoothstep(Math.min(x-box.min.x,box.max.x-x)/size.x,0,.09);
    const ez=THREE.MathUtils.smoothstep(Math.min(z-box.min.z,box.max.z-z)/size.z,0,.09);
    p.setXYZ(i,x+(x-centre.x)*amount*ex,y,z+(z-centre.z)*amount*ez);
  }
  p.needsUpdate=true;geometry.computeBoundingBox();geometry.computeBoundingSphere();
}

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
  private mortar=new THREE.MeshStandardMaterial({color:0x30352a,roughness:1});
  private disposed=false;
  constructor(private root:THREE.Group,private staticScene=true){}
  private load(kind:BlockworksSurfaceKind):Promise<Asset>{
    let promise=this.loads.get(kind);if(promise)return promise;
    this.states[kind]='loading';
    promise=(async()=>{
      const scene=await loadBlockworksModel(kind);
      if(this.disposed){disposeBlockworksModel(scene);throw Error('Released level');}
      this.models.push(scene);scene.updateMatrixWorld(true);
      if(kind==='bw-flagstone-deck-v4')scene.traverse(o=>{
        const m=o as THREE.Mesh;if(!m.isMesh)return;
        m.geometry.applyMatrix4(m.matrixWorld);seatStoneBlocks(m.geometry);
        m.geometry.applyMatrix4(m.matrixWorld.clone().invert());
      });
      const box=blockworksSourceBox(scene),size=box.getSize(new THREE.Vector3());
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
      this.states[kind]='ready';return {scene,box,size,profile,grid,wedge:scene.userData.bwWedge};
    })();this.loads.set(kind,promise);return promise;
  }
  decorate(c:CustomComponent):void {
    const kind=c.dkind as BlockworksSurfaceKind,owner=new THREE.Group();owner.name=BLOCKWORKS_SURFACE_LABELS[kind];this.root.add(owner);this.owners.push(owner);
    this.pending.push(this.load(kind).then(asset=>{
      if(this.disposed)return;
      if(kind==='bw-stone-wedge'||kind==='bw-metal-wedge'){
        // The editor's loose scenery placement keeps the complete wedge form.
        // Native ramp skins instead use the measured endpoint fit below.
        const metal=kind==='bw-metal-wedge',size=c.s??[c.w??(metal?1.8:2.6),c.rise??(metal?1:2.4),c.len??(metal?4:8)];
        const model=asset.scene.clone(true),centre=asset.box.getCenter(new THREE.Vector3());
        owner.position.fromArray(c.p);owner.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
        model.scale.set(size[0]/asset.size.x,size[1]/asset.size.y,size[2]/asset.size.z);
        model.position.set(-centre.x*model.scale.x,-asset.box.min.y*model.scale.y,-centre.z*model.scale.z);
        model.traverse(o=>{const m=o as THREE.Mesh;if(m.isMesh){m.userData.solidSurface='none';m.userData.visualOnly=true;m.castShadow=m.receiveShadow=true;}});
        owner.add(model);this.pieces.push(model);
      }else this.path(c,kind,asset,undefined,owner);
    }).catch(()=>{this.states[kind]='error';}));
  }
  fitRail(points:THREE.Vector3[],rail:THREE.Group,postHeights:number[]=[1.2,1.2]):void{
    const kind='bw-grind-rail',native=rail.children.filter(o=>(o as THREE.Mesh).isMesh),owner=new THREE.Group();
    owner.name='Meshy rail and matching posts';rail.add(owner);this.owners.push(owner);
    const p=points[0],c:CustomComponent={t:'decor',dkind:kind,p:p.toArray() as [number,number,number],s:[.18,.18,2],
      pts:points.map(q=>[q.x-p.x,q.z-p.z,0,q.y-p.y])};
    this.pending.push(this.load(kind).then(asset=>{
      if(this.disposed)return;
      this.path(c,kind,asset,undefined,owner);
      [points[0],points[points.length-1]].forEach((point,i)=>{if(postHeights[i]>.1)this.railPost(asset,point,owner,postHeights[i]);});
      for(const o of native){const mesh=o as THREE.Mesh;for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])mat.visible=false;}
    }).catch(()=>{this.states[kind]='error';}));
  }
  private railPost(a:Asset,point:THREE.Vector3,owner:THREE.Group,height:number):void{
    const group=new THREE.Group();group.position.copy(point);owner.add(group);this.pieces.push(group);
    const centre=a.box.getCenter(new THREE.Vector3());
    a.scene.traverse(o=>{
      const source=o as THREE.Mesh;if(!source.isMesh)return;
      const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),p=geometry.getAttribute('position');
      for(let i=0;i<p.count;i++){
        const x=(p.getX(i)-centre.x)/a.size.x*.15,y=(p.getZ(i)-centre.z)/a.size.z*height-height/2,z=-(p.getY(i)-centre.y)/a.size.y*.15;
        p.setXYZ(i,x,y,z);
      }
      p.needsUpdate=true;geometry.deleteAttribute('tangent');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,source.material);mesh.userData.bwLod=source.userData.bwLod??0;mesh.matrixAutoUpdate=false;mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    });
  }
  fitNative(c:CustomComponent,proxy:THREE.Mesh):void{
    const kind=c.dkind as BlockworksSurfaceKind;
    proxy.userData.blockworksMoving=c.t==='mover';
    proxy.geometry.computeBoundingBox();const b=proxy.geometry.boundingBox!;
    let from:[number,number,number]=[0,b.max.y,b.max.z],to:[number,number,number]=[0,b.max.y,b.min.z],width=b.max.x-b.min.x;
    if(c.t==='mesh'&&c.vertices&&c.vertices.length>=12){
      const v=c.vertices;
      from=[(v[0]+v[3])/2,(v[1]+v[4])/2,(v[2]+v[5])/2];
      to=[(v[6]+v[9])/2,(v[7]+v[10])/2,(v[8]+v[11])/2];
      width=Math.hypot(v[3]-v[0],v[5]-v[2]);
    }
    if(kind==='bw-stone-wedge'||kind==='bw-metal-wedge'){
      this.pending.push(this.load(kind).then(a=>{if(!this.disposed)this.wedge(kind,a,proxy,from,to,width,b.min.y);}).catch(()=>{this.states[kind]='error';}));
      return;
    }
    const surface:CustomComponent={t:'decor',dkind:kind,p:from,s:[width,Math.min(1.2,Math.max(.18,b.max.y-b.min.y)),6],
      pts:[[0,0,0,0],[to[0]-from[0],to[2]-from[2],0,to[1]-from[1]]]};
    this.pending.push(this.load(kind).then(a=>{if(!this.disposed)this.path(surface,kind,a,proxy);}).catch(()=>{this.states[kind]='error';}));
  }
  private wedge(kind:BlockworksSurfaceKind,a:Asset,proxy:THREE.Mesh,from:[number,number,number],to:[number,number,number],width:number,bottom:number):void{
    if(!a.wedge)throw Error('Meshy wedge riding plane missing');
    const fit=a.wedge,start=new THREE.Vector3(...from),end=new THREE.Vector3(...to),forward=end.clone().sub(start);forward.y=0;forward.normalize();
    const right=new THREE.Vector3(-forward.z,0,forward.x),group=new THREE.Group();
    group.position.copy(start).lerp(end,.5);group.name=BLOCKWORKS_SURFACE_LABELS[kind];group.userData.blockworksModule={kind,originalUVs:true,dedicatedWedge:true};
    proxy.add(group);this.pieces.push(group);this.proxies.set(group,proxy);
    a.scene.traverse(o=>{
      const source=o as THREE.Mesh;if(!source.isMesh)return;
      const geometry=source.geometry.clone().applyMatrix4(source.matrixWorld),p=geometry.getAttribute('position');
      for(let i=0;i<p.count;i++){
        const nx=(p.getX(i)-a.box.min.x)/a.size.x,nz=(p.getZ(i)-a.box.min.z)/a.size.z,t=fit.toeZ>0?1-nz:nz;
        const support=mix(from[1],to[1],t),sourceTop=mix(fit.low,fit.high,t);
        const y=bottom+(p.getY(i)-fit.base)/Math.max(.001,sourceTop-fit.base)*(support-bottom);
        const point=start.clone().lerp(end,t).addScaledVector(right,(nx-.5)*width*(fit.toeZ>0?1:-1));
        point.y=Math.min(support+.035,y);point.sub(group.position);p.setXYZ(i,point.x,point.y,point.z);
      }
      p.needsUpdate=true;geometry.deleteAttribute('tangent');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometries.push(geometry);
      const mesh=new THREE.Mesh(geometry,source.material);mesh.userData.bwLod=source.userData.bwLod??0;mesh.matrixAutoUpdate=false;mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    });
    if(kind==='bw-stone-wedge'){
      // A recessed, untextured mortar bed closes tiny open generator seams.
      // It stays inside the Meshy silhouette and never changes native collision.
      const geometry=proxy.geometry.clone(),p=geometry.getAttribute('position');
      for(let i=0;i<p.count;i++)p.setXYZ(i,(p.getX(i)-group.position.x)*.96,p.getY(i)-group.position.y-.16,(p.getZ(i)-group.position.z)*.96);
      geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();this.geometries.push(geometry);
      const bed=new THREE.Mesh(geometry,this.mortar);bed.userData.solidSurface='none';bed.userData.visualOnly=true;bed.userData.mortarBed=true;bed.receiveShadow=true;group.add(bed);
    }
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
    const detail=kind==='bw-grind-rail'||kind==='bw-aqueduct-coping';
    const stone=kind.includes('flagstone');
    const sculpted=kind==='bw-flagstone-deck-v4';
    const pipe=kind.startsWith('bw-aqueduct-')&&!detail;
    const moduleLength=kind==='bw-grind-rail'?2.4:kind==='bw-aqueduct-coping'?4:pipe?16:sculpted?8:stone?12:kind==='bw-rivet-deck-v2'?8:7;
    const count=Math.ceil(total/moduleLength),length=total/count;
    const sampleGrid=(x:number,z:number)=>{
      if(!a.grid)return 0;const n=a.grid.size,fx=THREE.MathUtils.clamp(x,0,.999999)*(n-1),fz=THREE.MathUtils.clamp(z,0,.999999)*(n-1),ix=Math.floor(fx),iz=Math.floor(fz),h=a.grid.heights;
      return mix(mix(h[iz*n+ix],h[iz*n+ix+1],fx-ix),mix(h[(iz+1)*n+ix],h[(iz+1)*n+ix+1],fx-ix),fz-iz);
    };
    const floorSource=a.grid?sampleGrid(.5,.5):a.profile.length?a.profile[64]:0;
    const pipeScale=(c.rise??3.6)/Math.max(.001,Math.max(...(a.grid?.heights??a.profile))-floorSource);
    for(let index=0;index<count;index++){
      const start=index*length,origin=frame(start+length/2).centre,group=new THREE.Group();group.position.copy(origin);group.updateMatrix();group.matrixAutoUpdate=false;
      group.name=BLOCKWORKS_SURFACE_LABELS[kind];group.userData.blockworksModule={kind,originalUVs:true};
      (proxy??owner).add(group);this.pieces.push(group);if(proxy)this.proxies.set(group,proxy);
      a.scene.traverse(object=>{
        const source=object as THREE.Mesh;if(!source.isMesh)return;
        const geometry=source.geometry.clone();geometry.applyMatrix4(source.matrixWorld);
        const positions=geometry.getAttribute('position');
        for(let i=0;i<positions.count;i++){
          let nx=THREE.MathUtils.clamp((positions.getX(i)-a.box.min.x)/a.size.x,0,1);
          let rawNz=THREE.MathUtils.clamp((a.box.max.z-positions.getZ(i))/a.size.z,0,1);
          const ny=THREE.MathUtils.clamp((positions.getY(i)-a.box.min.y)/a.size.y,0,1);
          // Turn alternate physical flagstone modules 180 degrees. The original
          // painted UVs travel with each mesh, avoiding a stamped repeating row.
          if(kind.includes('flagstone-deck')&&index%2){nx=1-nx;rawNz=1-rawNz;}
          // The Meshy aqueduct has projecting support feet beyond each open
          // riding end. Join the measured riding span, allowing feet to overlap below.
          const nz=kind==='bw-aqueduct-module'?(rawNz-.12)/.76:rawNz;
          // The Meshy model already contains the stone joints and bevels.
          // Let those same features break the silhouette, rather than cutting
          // every painted stone back to a perfectly straight rectangular rim.
          const edgeCut=stone&&!sculpted?.015+.11*(1-THREE.MathUtils.smoothstep(ny,.87,.975)):0;
          // The new Meshy component has independently chipped perimeter stones.
          // Preserve that outline at exposed ends; overlap only internal joins.
          const overlap=sculpted?Math.min(.6,length*.1):.025;
          const before=sculpted&&index===0?0:overlap,after=sculpted&&index===count-1?0:overlap;
          const distance=THREE.MathUtils.clamp(start-before+nz*(length+before+after),edgeCut,total-edgeCut);
          const current=frame(distance);
          // Narrow landing decks take the centre of the actual component;
          // collapsing its outboard strip avoids shrinking full-size stones
          // into miniature bricks. The native footprint remains the limit.
          const sourceWidth=stone&&!sculpted?Math.max(8,current.width):current.width;
          const u=THREE.MathUtils.clamp((nx-.5)*sourceWidth,-current.width/2+edgeCut,current.width/2-edgeCut);
          let height:number;
          if(detail){
            height=(ny-.5)*(c.s?.[1]??.18);
          }else if(pipe){
            const radius=c.rise??3.6,flat=c.w??2.6,q=Math.min(radius,Math.max(0,Math.abs(u)-flat));
            const riding=radius-Math.sqrt(Math.max(0,radius*radius-q*q));
            const sample=nx*128,lo=Math.min(127,Math.floor(sample)),sourceTop=a.grid?sampleGrid(nx,THREE.MathUtils.clamp(1-rawNz,kind==='bw-aqueduct-module'?.12:.015,kind==='bw-aqueduct-module'?.88:.985)):mix(a.profile[lo],a.profile[lo+1],sample-lo);
            const delta=(positions.getY(i)-sourceTop)*pipeScale;
            // Compress top relief continuously. The old hard threshold jumped
            // 16cm at shallow beveled seams and produced transverse dark ribs.
            height=riding+(delta>=-.15?Math.min(.018,delta*.2):-.03+(delta+.15)*.8);
          }else if(stone){
            // Keep the real Meshy relief in world units. Previously the entire
            // upper 35% was squeezed into 5.5cm, flattening the individual slabs.
            // The measured 97%-height plane seats the broad stone faces near the
            // authored support; joints recess and high chipped corners remain.
            const scale=Math.sqrt(sourceWidth*length)*1.6;
            const relief=(ny-.97)*a.size.y*scale;
            const lowerRelief=(.72-.97)*a.size.y*scale;
            height=Math.min(.035,ny>.72?relief:mix(-(c.s?.[1]??.65),lowerRelief,ny/.72));
          }else{
            // Retain the modeled slabs and bevels while keeping their shallow
            // top relief within 4cm of the authoritative walkable plane.
            height=ny>.65?mix(-.04,.015,(ny-.65)/.35):mix(-(c.s?.[1]??1.2),-.04,ny/.65);
          }
          const p=current.centre.addScaledVector(current.right,u);p.y+=height;p.sub(origin);
          positions.setXYZ(i,p.x,p.y,p.z);
        }
        positions.needsUpdate=true;geometry.deleteAttribute('tangent');geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
        this.geometries.push(geometry);
        const mesh=new THREE.Mesh(geometry,source.material);mesh.userData.bwLod=source.userData.bwLod??0;mesh.matrixAutoUpdate=false;mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;mesh.receiveShadow=true;mesh.castShadow=true;group.add(mesh);
      });
    }
  }
  setView(position:THREE.Vector3,far:number,secondary?:THREE.Vector3):void{
    const world=new THREE.Vector3();
    for(const p of this.pieces){
      const proxy=this.proxies.get(p),mat=proxy?.material as THREE.MeshLambertMaterial|undefined;
      const ghost=!!(proxy?.userData.outlinedSurface&&mat?.wireframe);
      if(proxy){for(const m of Array.isArray(proxy.material)?proxy.material:[proxy.material])m.visible=ghost;}
      if(!p.userData.viewPosition){p.getWorldPosition(world);p.userData.viewPosition=world.clone();}
      // Only native movers need a fresh parent transform; static path modules
      // keep their cached centres instead of walking the whole hierarchy.
      if(!this.staticScene||proxy?.userData.blockworksMoving)p.getWorldPosition(world);
      else world.copy(p.userData.viewPosition);
      const distance=Math.sqrt(Math.min(world.distanceToSquared(position),secondary?world.distanceToSquared(secondary):Infinity));
      p.visible=!ghost&&distance<Math.min(far+12,235);
      const meshes:THREE.Mesh[]=p.userData.lodMeshes??=[];if(!meshes.length)p.traverse(o=>{if((o as THREE.Mesh).isMesh)meshes.push(o as THREE.Mesh);});
      const maxLod=p.userData.maxLod??=Math.max(...meshes.map(m=>m.userData.bwLod??0));
      const lod=Math.min(maxLod,blockworksDetail(Math.max(0,distance-6)));
      for(const mesh of meshes){
        mesh.visible=mesh.userData.mortarBed||(mesh.userData.bwLod??0)===lod;
        mesh.castShadow=distance<42&&!mesh.userData.mortarBed;mesh.receiveShadow=distance<90;
      }
    }
  }
  async ready():Promise<void>{await Promise.all(this.pending);}
  get diagnostics(){return {models:this.states,modules:this.pieces.length,geometrySource:'Meshy original topology and UVs fitted to native path'};}
  dispose():void{
    this.disposed=true;
    for(const p of this.pieces)p.removeFromParent();
    for(const owner of this.owners)owner.removeFromParent();
    for(const g of this.geometries)g.dispose();
    this.mortar.dispose();
    const geos=new Set<THREE.BufferGeometry>(),mats=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
    for(const model of this.models)model.traverse(o=>{const m=o as THREE.Mesh;if(!m.isMesh)return;geos.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:[m.material]){mats.add(mat);for(const v of Object.values(mat))if((v as THREE.Texture)?.isTexture)textures.add(v as THREE.Texture);}});
    for(const g of geos)g.dispose();for(const m of mats)m.dispose();for(const t of textures){t.dispose();(t.image as {close?:()=>void})?.close?.();}
  }
}
