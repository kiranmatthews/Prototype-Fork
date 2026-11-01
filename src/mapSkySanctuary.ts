import * as THREE from 'three';
import {CAMPAIGN_ISLANDS} from './campaign';
import {MapScenery} from './mapDioramas';
import {createCloudPlatform} from './cloudPlatform';

type CloudMesh=THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;

/** Keep a small planted temple clearing. Its irregular lip sinks into the
 * cloud body; the outer coastline is now authored entirely in cloud volumes.
 * Hub pads and route support are independent of this visual terrain. */
export function shapeCloudIslandCore(geometry:THREE.BufferGeometry):void {
  const position=geometry.getAttribute('position'),inside:boolean[]=[];
  for(let i=0;i<position.count;i++){
    const x=position.getX(i),z=position.getZ(i),r=Math.hypot(x,z),angle=Math.atan2(z,x);
    const edge=36+Math.sin(angle*3+.4)*2.4+Math.cos(angle*5)*1.3;
    inside.push(r<edge);
    position.setY(i,position.getY(i)-THREE.MathUtils.smoothstep(r,24,edge)*16);
  }
  const source=geometry.getIndex()!,indices:number[]=[];
  for(let i=0;i<source.count;i+=3){
    const a=source.getX(i),b=source.getX(i+1),c=source.getX(i+2);
    if(inside[a]&&inside[b]&&inside[c])indices.push(a,b,c);
  }
  geometry.setIndex(indices);position.needsUpdate=true;
  geometry.computeVertexNormals();geometry.computeBoundingSphere();
}

/** One continuous cumulus volume forms the island's perimeter and underside.
 * Its baked light and density use the same 360p renderer as the cloud courses. */
export class MapSkySanctuary {
  readonly root=new THREE.Group();
  readonly ready:Promise<void>;
  private cloud:CloudMesh|null=null;
  private time=0;private disposed=false;
  constructor(scenery:MapScenery){
    const centre=CAMPAIGN_ISLANDS.find(i=>i.id==='hidden-shores')!.centre;
    this.root.name='world map heavenly tiki sanctuary';this.root.position.set(...centre);
    const temple=new THREE.Group();temple.position.set(0,10,0);temple.name='Meshy sky sanctuary centre';this.root.add(temple);
    const statue=scenery.addPiece(temple,{asset:'sky-tiki-sanctuary',p:[0,0,0],extent:35,yaw:-80});
    // Defer the volume bake to the asset-preparation barrier. The complete
    // density field and geometry remain identical in every view/reflection.
    const cloudLoad=Promise.resolve().then(()=>{
      if(this.disposed)return;
      const cloud=createCloudPlatform(20,20,7319,false,2.5,'island') as CloudMesh;
      cloud.name='Secret Island continuous cloud shelf';
      cloud.userData={...cloud.userData,mapCloudVolume:true};
      // Preserve highlights and the pale route dots under the map's exposure.
      cloud.material.uniforms.uLightScale.value=.7;
      cloud.scale.setScalar(7.5);this.root.add(cloud);this.cloud=cloud;
      this.update(0);
    });
    this.ready=Promise.all([statue,cloudLoad]).then(()=>{});
    this.ready.catch(()=>{});
  }
  update(dt:number,_selected?:THREE.Vector3):void{
    this.time+=Math.min(dt,.1);
    if(this.cloud)this.cloud.position.y=Math.sin(this.time*.1)*.08;
  }
  dispose():void{
    if(this.disposed)return;
    this.disposed=true;this.root.removeFromParent();
    this.cloud?.geometry.dispose();this.cloud?.material.dispose();this.cloud=null;this.root.clear();
  }
}
