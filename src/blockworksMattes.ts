import * as THREE from 'three';
import type { CustomComponent } from './level';

export const BLOCKWORKS_MATTE_KINDS=['bw-castle-matte','bw-rides-matte','bw-jungle-matte'] as const;
type MatteKind=typeof BLOCKWORKS_MATTE_KINDS[number];
export const BLOCKWORKS_MATTE_LABELS:Record<MatteKind,string>={
  'bw-castle-matte':'Haunted island · distant castle',
  'bw-rides-matte':'Haunted island · abandoned rides',
  'bw-jungle-matte':'Haunted island · jungle crags',
};
const FILES:Record<MatteKind,string>={
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
  constructor(private root:THREE.Group){}
  decorate(c:CustomComponent):void {
    const kind=c.dkind as MatteKind;
    let mat=this.materials.get(kind);
    if(!mat){
      mat=new THREE.MeshBasicMaterial({transparent:true,opacity:.92,depthWrite:false,
        side:THREE.DoubleSide,fog:false,toneMapped:false,color:0xffffff});
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
        }catch{if(!this.disposed)this.states.set(kind,'error');}
      })());
    }
    const [width,height]=c.s??[150,100,1];
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);
    mesh.position.fromArray(c.p);mesh.position.y+=height/2;
    mesh.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
    mesh.name=BLOCKWORKS_MATTE_LABELS[kind];mesh.renderOrder=-.5;
    mesh.userData.blockworksMatte=true;this.root.add(mesh);this.roots.push(mesh);
  }
  async ready():Promise<void>{await Promise.all(this.pending);}
  get diagnostics(){return {instances:this.roots.length,textures:Object.fromEntries(this.states)};}
  dispose():void{
    this.disposed=true;
    for(const mesh of this.roots){mesh.removeFromParent();mesh.geometry.dispose();}
    for(const mat of this.materials.values()){mat.map?.dispose();(mat.map?.image as {close?:()=>void})?.close?.();mat.dispose();}
    this.roots.length=0;this.materials.clear();
  }
}
