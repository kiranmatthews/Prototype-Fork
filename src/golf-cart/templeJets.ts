import * as THREE from 'three';
import {createTempleFlameGeometry,createTempleFlameMaterial,createTempleFlameSample,sampleTempleFlame,writeTempleFlame,TEMPLE_FLAME_INDICES} from '../templeFlame';

interface JetPacket {born:number;seed:number;strength:number;matrix:THREE.Matrix4;velocity:THREE.Vector3}
const FORWARD=new THREE.Vector3(0,0,1);

/** One bounded draw for all six mouths on every kart, using the exact Temple
 * of Embers flame surface. Each packet keeps its emitter's birth transform,
 * so steering and cutoff leave a moving tail instead of dragging fire around. */
export class CartTempleJets extends THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial> {
  private packets:JetPacket[];
  private cursor=0;
  private lastTime=-Infinity;
  private packetMatrix=new THREE.Matrix4();private inverse=new THREE.Matrix4();
  private packetRotation=new THREE.Quaternion();private scaleVector=new THREE.Vector3();
  private viewPoint=new THREE.Vector3(8,5,10);private packetView=new THREE.Vector3();
  private sample=createTempleFlameSample();
  readonly diagnostics={emitted:0,active:0,capacity:0,source:'Temple of Embers'};
  get count(){return this.diagnostics.active;}
  constructor(capacity:number){
    super(createTempleFlameGeometry(capacity),createTempleFlameMaterial());
    this.name='Six kart nozzles · Temple of Embers fire';this.visible=false;this.frustumCulled=false;this.renderOrder=5;
    this.geometry.setDrawRange(0,0);this.diagnostics.capacity=capacity;
    this.packets=Array.from({length:capacity},()=>({born:-Infinity,seed:0,strength:0,matrix:new THREE.Matrix4(),velocity:new THREE.Vector3()}));
    this.onBeforeRender=(_renderer,_scene,camera)=>{this.viewPoint.setFromMatrixPosition(camera.matrixWorld);this.worldToLocal(this.viewPoint);};
  }
  emit(time:number,position:THREE.Vector3,velocity:THREE.Vector3,direction:THREE.Vector3,scale:number,seed:number,strength=1){
    const packet=this.packets[this.cursor];this.cursor=(this.cursor+1)%this.packets.length;
    packet.born=time;packet.seed=seed;packet.strength=strength;packet.velocity.copy(velocity);
    this.packetRotation.setFromUnitVectors(FORWARD,direction);this.scaleVector.set(.22*scale,.22*scale,.48*scale);
    packet.matrix.compose(position,this.packetRotation,this.scaleVector);
    // Temple breath begins at the idol's mouth (0,1.03,1.08). Seat that same
    // mouth on the kart's bell, keeping its heat gradient and lobe proportions.
    const m=packet.matrix.elements;
    m[12]-=m[4]*1.03+m[8]*1.08;m[13]-=m[5]*1.03+m[9]*1.08;m[14]-=m[6]*1.03+m[10]*1.08;
    this.diagnostics.emitted++;this.lastTime=-Infinity;
  }
  present(time:number){
    if(time===this.lastTime)return;this.lastTime=time;
    const positions=this.geometry.getAttribute('position') as THREE.BufferAttribute,colors=this.geometry.getAttribute('color') as THREE.BufferAttribute;
    let count=0;
    for(const p of this.packets){
      const age=time-p.born;if(!sampleTempleFlame(age,p.seed,7.1,this.sample))continue;
      this.packetMatrix.copy(p.matrix);const m=this.packetMatrix.elements,travel=(1-Math.exp(-.65*age))/.65;
      m[12]+=p.velocity.x*travel;m[13]+=p.velocity.y*travel;m[14]+=p.velocity.z*travel;
      this.packetView.copy(this.viewPoint).applyMatrix4(this.inverse.copy(this.packetMatrix).invert());
      writeTempleFlame(this.sample,this.packetView,positions,colors,count,0,this.packetMatrix,p.strength);count++;
    }
    this.diagnostics.active=count;this.visible=count>0;this.geometry.setDrawRange(0,count*TEMPLE_FLAME_INDICES);
    if(count){positions.needsUpdate=true;colors.needsUpdate=true;}
  }
  destroy(){this.geometry.dispose();this.material.dispose();this.removeFromParent();}
}
