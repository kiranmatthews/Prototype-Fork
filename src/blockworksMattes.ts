import * as THREE from 'three';
import type { CustomComponent } from './level';

export const BLOCKWORKS_MATTE_KINDS=['bw-castle-matte','bw-rides-matte','bw-jungle-matte','bw-cobweb'] as const;
type MatteKind=typeof BLOCKWORKS_MATTE_KINDS[number];
export const BLOCKWORKS_MATTE_LABELS:Record<MatteKind,string>={
  'bw-cobweb':'Ghost train entrance cobweb',
  'bw-castle-matte':'Haunted island · distant castle',
  'bw-rides-matte':'Haunted island · abandoned rides',
  'bw-jungle-matte':'Haunted island · jungle crags',
};
const FILES:Record<MatteKind,string>={
  'bw-cobweb':'entrance-cobweb',
  'bw-castle-matte':'island-castle','bw-rides-matte':'island-rides','bw-jungle-matte':'island-jungle',
};

/** World-anchored matte planes: parallax and silhouettes remain identical
 * between views. These never join the collision or camera blocker lists. */
export class BlockworksMattes {
  private roots:THREE.Mesh[]=[];
  private materials=new Map<MatteKind,THREE.MeshBasicMaterial>();
  private pending:Promise<void>[]=[];
  private states=new Map<MatteKind,string>();
  private disposed=false;
  private aspects=new Map<MatteKind,number>();
  constructor(private root:THREE.Group){}
  decorate(c:CustomComponent):void {
    const kind=c.dkind as MatteKind;
    let mat=this.materials.get(kind);
    if(!mat){
      mat=new THREE.MeshBasicMaterial({transparent:true,opacity:.92,depthWrite:false,
        side:THREE.DoubleSide,fog:kind==='bw-cobweb',toneMapped:kind==='bw-cobweb',color:kind==='bw-cobweb'?0x80778a:0xffffff,alphaTest:kind==='bw-cobweb'?.04:0});
      this.materials.set(kind,mat);this.states.set(kind,'loading');
      const material=mat;
      this.pending.push((async()=>{
        try{
          const response=await fetch(import.meta.env.BASE_URL+'blockworks-art/'+FILES[kind]+'.png');
          if(!response.ok)throw Error('Matte HTTP '+response.status);
          const bitmap=await createImageBitmap(await response.blob(),{imageOrientation:'flipY'});
          if(this.disposed){bitmap.close();return;}
          const texture=new THREE.Texture(bitmap);texture.colorSpace=THREE.SRGBColorSpace;
          texture.flipY=false;texture.needsUpdate=true;texture.anisotropy=4;texture.userData.shared=true;
          material.map=texture;material.needsUpdate=true;this.states.set(kind,'ready');
          this.aspects.set(kind,bitmap.width/bitmap.height);
          for(const mesh of this.roots)if(mesh.userData.matteKind===kind)this.fitAspect(mesh,bitmap.width/bitmap.height);
        }catch{if(!this.disposed)this.states.set(kind,'error');}
      })());
    }
    const [width,height]=c.s??[150,100,1];
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);
    mesh.position.fromArray(c.p);mesh.position.y+=height/2;
    mesh.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
    mesh.name=BLOCKWORKS_MATTE_LABELS[kind];mesh.renderOrder=-.5;
    mesh.userData.matteKind=kind;mesh.userData.matteWidth=width;mesh.userData.matteBaseY=c.p[1];
    if(this.aspects.has(kind))this.fitAspect(mesh,this.aspects.get(kind)!);
    mesh.userData.blockworksMatte=true;mesh.userData.solidSurface='none';mesh.userData.visualOnly=true;this.root.add(mesh);this.roots.push(mesh);
  }
  private fitAspect(mesh:THREE.Mesh,aspect:number):void{
    const width=mesh.userData.matteWidth,height=width/aspect;
    mesh.geometry.dispose();mesh.geometry=new THREE.PlaneGeometry(width,height);
    mesh.position.y=mesh.userData.matteBaseY+height/2;
    mesh.userData.naturalAspect=aspect;mesh.userData.renderedAspect=width/height;
  }
  async ready():Promise<void>{await Promise.all(this.pending);}
  get diagnostics(){return {instances:this.roots.length,textures:Object.fromEntries(this.states),proportions:this.roots.map(m=>({kind:m.userData.matteKind,natural:m.userData.naturalAspect,rendered:m.userData.renderedAspect}))};}
  dispose():void{
    this.disposed=true;
    for(const mesh of this.roots){mesh.removeFromParent();mesh.geometry.dispose();}
    for(const mat of this.materials.values()){mat.map?.dispose();(mat.map?.image as {close?:()=>void})?.close?.();mat.dispose();}
    this.roots.length=0;this.materials.clear();
  }
}
