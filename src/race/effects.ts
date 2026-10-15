import * as THREE from 'three';
import { disposeRaceItemModel } from './items';

export function raceTargetRing(color:number):THREE.Mesh<THREE.TorusGeometry,THREE.MeshBasicMaterial> {
  const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.075,5,36),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false}));
  ring.rotation.x=-Math.PI/2;return ring;
}
/** Short world-space feedback, using existing Three materials and no UI renderer. */
export class RaceItemEffects {
  private effects:{root:THREE.Object3D;age:number;life:number;radius:number}[]=[];
  constructor(private root:THREE.Group){}
  pulse(at:THREE.Vector3,color:number,radius=3):void {
    const ring=raceTargetRing(color);ring.position.copy(at).y+=.3;
    this.root.add(ring);this.effects.push({root:ring,age:0,life:.45,radius});
  }
  lightning(at:THREE.Vector3):void {
    const group=new THREE.Group();group.name='lightning strike';group.position.copy(at);
    const material=new THREE.MeshBasicMaterial({color:0xeafaff,transparent:true,opacity:1,depthWrite:false});
    const points=[new THREE.Vector3(1.3,20,0),new THREE.Vector3(-.8,15,.2),new THREE.Vector3(.65,11,0),new THREE.Vector3(-.55,8,.3),new THREE.Vector3(.4,4,0),new THREE.Vector3(0,.1,0)];
    group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points,false,'catmullrom',0),24,.12,5,false),material));
    for(const side of [-1,1]){
      const branch=[new THREE.Vector3(-.55,8,.3),new THREE.Vector3(side*2,6,1),new THREE.Vector3(side*1.3,4,1.5)];
      group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(branch,false,'catmullrom',0),8,.065,4,false),material));
    }
    this.root.add(group);this.effects.push({root:group,age:0,life:.55,radius:0});this.pulse(at,0xffe568,4.5);
  }
  update(dt:number):void {
    for(const effect of this.effects){effect.age+=dt;const t=Math.min(1,effect.age/effect.life);
      if(effect.radius)effect.root.scale.setScalar(.5+t*effect.radius);
      effect.root.traverse(o=>{if(o instanceof THREE.Mesh)(o.material as THREE.MeshBasicMaterial).opacity=(1-t)*.95;});
    }
    this.effects=this.effects.filter(e=>{if(e.age<e.life)return true;disposeRaceItemModel(e.root);return false;});
  }
  clear():void {for(const e of this.effects)disposeRaceItemModel(e.root);this.effects=[];}
}
