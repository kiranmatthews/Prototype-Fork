import * as THREE from 'three';
import {CAMPAIGN_ISLANDS} from './campaign';
import {MapScenery} from './mapDioramas';
import {createCloudPlatform} from './cloudPlatform';

type CloudMesh=THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;

/** Seeded cumulus volumes drift around the elevated sanctuary. Three density
 * fields serve every bank, using the same 360p composite as the cloud courses. */
export class MapSkySanctuary {
  readonly root=new THREE.Group();
  readonly ready:Promise<void>;
  private readonly templates:CloudMesh[]=[];
  private readonly clouds:{mesh:CloudMesh;angle:number;radius:number;baseY:number;speed:number}[]=[];
  private readonly toward=new THREE.Vector3();
  private time=0;private disposed=false;
  constructor(scenery:MapScenery){
    const centre=CAMPAIGN_ISLANDS.find(i=>i.id==='hidden-shores')!.centre;
    this.root.name='world map heavenly tiki sanctuary';this.root.position.set(...centre);
    const temple=new THREE.Group();temple.position.set(0,10,0);temple.name='Meshy sky sanctuary centre';this.root.add(temple);
    const statue=scenery.addPiece(temple,{asset:'sky-tiki-sanctuary',p:[0,0,0],extent:35,yaw:-80});
    // A full-detail Meshy mesa gives the floating land a substantial rock underside.
    const underside=new THREE.Group();this.root.add(underside);
    const stone=scenery.addPiece(underside,{asset:'sanctuary-mesa',p:[0,-43,0],extent:1,yaw:18,size:[118,45,106]});
    // Defer the shared volume bake to the existing asset-preparation barrier.
    // Geometry and voxel detail remain identical at every viewing distance.
    const cloudLoad=Promise.resolve().then(()=>{
      if(this.disposed)return;
      for(let i=0;i<3;i++)this.templates.push(createCloudPlatform(16,10,7319+i*3761,false,2.5) as CloudMesh);
      for(let i=0;i<18;i++){
        const template=this.templates[i%this.templates.length],material=template.material.clone();
        material.uniforms.uVolume.value=template.material.uniforms.uVolume.value;
        const mesh=new THREE.Mesh(template.geometry,material);
        mesh.name='Secret Island drifting cumulus';
        mesh.userData={visualOnly:true,cloudRoadVisual:true,mapCloudVolume:true};
        mesh.scale.set(3.4+(i%5)*.4,2.1+(i%3)*.3,2.6+(i%4)*.3);
        this.root.add(mesh);
        this.clouds.push({mesh,angle:i*2.399963,radius:72+(i%5)*8,baseY:-8-(i%4)*4,
          speed:(i%2?1:-1)*(.006+(i%3)*.002)});
      }
      this.update(0);
    });
    this.ready=Promise.all([statue,stone,cloudLoad]).then(()=>{});
    this.ready.catch(()=>{});
  }
  update(dt:number,selected?:THREE.Vector3):void{
    this.time+=Math.min(dt,.1);
    if(selected)this.toward.copy(selected).sub(this.root.position).setY(0).normalize();
    for(const c of this.clouds){
      const angle=c.angle+this.time*c.speed;
      c.mesh.position.set(Math.sin(angle)*c.radius,c.baseY+Math.sin(this.time*.12+c.angle)*1.7,Math.cos(angle)*c.radius);
      const front=selected?Math.max(0,this.toward.x*Math.sin(angle)+this.toward.z*Math.cos(angle)):0;
      c.mesh.material.uniforms.uOpacity.value=.9-front*.3;
    }
  }
  dispose():void{
    if(this.disposed)return;
    this.disposed=true;this.root.removeFromParent();
    for(const c of this.clouds)c.mesh.material.dispose();
    for(const template of this.templates){template.geometry.dispose();template.material.dispose();}
    this.clouds.length=this.templates.length=0;this.root.clear();
  }
}
