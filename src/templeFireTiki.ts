import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AssetCache, disposeTextures } from './assetLifetime';
import type { CustomComponent } from './level';

const assets=new AssetCache<string,THREE.Group>(async()=>{
  const gltf=await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}temple-night/tiki-head.glb`);
  const root=gltf.scene,box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3());
  const wrapper=new THREE.Group();root.position.sub(new THREE.Vector3(center.x,box.min.y,center.z));wrapper.add(root);
  wrapper.scale.set(2.8/size.x,3/size.y,2.4/size.z);
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
  return wrapper;
},root=>{
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;geometries.add(mesh.geometry);for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material]){materials.add(m);for(const v of Object.values(m))if(v instanceof THREE.Texture)textures.add(v);}});
  for(const g of geometries)g.dispose();for(const m of materials)m.dispose();disposeTextures(textures);
});
export interface TikiPhase { yaw:number; warning:number; fire:number; phase:'cool'|'warn'|'fire'; }
/** Deterministic telegraph: 4.2s cool, 1.2s amber warning, 1.8s breath,
 * then .6s cooling at the default 7.8s period. Frozen aim during warning. */
export function templeTikiPhase(time:number,cycle=7.8,phase=0,arc=28):TikiPhase {
  const t=((time+phase)%cycle+cycle)%cycle/cycle;
  const warning=t>=.54&&t<.70?(t-.54)/.16:0;
  const firing=t>=.70&&t<.93,u=(t-.70)/.23;
  const fire=firing?Math.min(1,u/.14,(1-u)/.12):0;
  const turn=t<.54?Math.sin(t/.54*Math.PI*2):t<.70?0:firing?Math.sin(u*Math.PI*2)*.65:0;
  return {yaw:THREE.MathUtils.degToRad(arc)*turn,warning,fire,phase:firing?'fire':warning>0?'warn':'cool'};
}

/** Environment hazard, sharing the game's ordinary contact/mask rules.
 * Flame segments and their contact volumes use the same rotating transform. */
export class TempleFireTiki {
  readonly group=new THREE.Group();
  readonly head=new THREE.Group();
  readonly boxes=Array.from({length:15},()=>new THREE.Box3().makeEmpty());
  readonly ready:Promise<void>;
  state:TikiPhase={yaw:0,warning:0,fire:0,phase:'cool'};
  private disposed=false;
  private model:THREE.Object3D|null=null;
  private lease=assets.acquire('head');
  private jets:THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>[]=[];
  private flameColor=new THREE.Color();
  private hot=new THREE.Color('#fff1aa');
  private gold=new THREE.Color('#ffb42c');
  private orange=new THREE.Color('#e7460c');
  private glow=new THREE.MeshBasicMaterial({color:0xff6418,transparent:true,opacity:.1});
  private mouth:THREE.Mesh;
  private point=new THREE.Vector3();
  private half=new THREE.Vector3();
  constructor(readonly spec:CustomComponent){
    this.group.position.set(...spec.p);this.group.rotation.y=THREE.MathUtils.degToRad(spec.yaw??0);
    this.group.name=spec.nm??'Turning flame tiki';this.group.add(this.head);
    this.head.scale.setScalar(spec.w??1);
    this.mouth=new THREE.Mesh(new THREE.SphereGeometry(.3,10,6),this.glow);this.mouth.position.set(0,1.03,1.05);this.mouth.scale.set(1.9,.65,.2);this.head.add(this.mouth);
    // Two continuous, vertex-shaded flowing flame skins. A connected plume
    // reads as breath; separate sphere billboards read as a string of bullets.
    for(let layer=0;layer<2;layer++){
      const geometry=new THREE.BufferGeometry(),indices:number[]=[];
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(26*10*3),3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute('color',new THREE.Float32BufferAttribute(new Float32Array(26*10*4),4).setUsage(THREE.DynamicDrawUsage));
      for(let ring=0;ring<25;ring++)for(let side=0;side<10;side++){
        const a=ring*10+side,b=ring*10+(side+1)%10;indices.push(a,b,a+10,b,b+10,a+10);
      }
      geometry.setIndex(indices);geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(0,0,1.12+(spec.range??7.1)/2),(spec.range??7.1)/2+1);
      const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,depthWrite:false,toneMapped:false,side:THREE.DoubleSide,forceSinglePass:true}));
      mesh.position.y=1.03;mesh.visible=false;mesh.name=layer?'Hot flowing fire core':'Tapered orange flame tongues';this.head.add(mesh);this.jets.push(mesh);
    }
    this.ready=this.lease.promise.then(template=>{if(this.disposed)return;this.model=template.clone(true);this.head.add(this.model);});
    // Asset loading is awaited by prepareJungleAssets; avoid an unhandled
    // rejection in headless geometry tests that intentionally have no fetch.
    void this.ready.catch(()=>{});
  }
  update(time:number,player:THREE.Vector3):void {
    this.state=templeTikiPhase(time,this.spec.cycle??7.8,this.spec.phase??0,this.spec.amp??28);
    this.head.rotation.y=this.state.yaw;this.group.updateMatrixWorld(true);
    const fire=this.state.fire,visible=this.group.position.distanceToSquared(player)<100*100;
    this.glow.opacity=.08+this.state.warning*.85+fire*.85;
    const range=this.spec.range??7.1,count=this.boxes.length;
    for(let i=0;i<count;i++){
      const u=i/(count-1),distance=range*u;
      const on=fire>0&&u<fire;
      const jetU=Math.min(.99,u/Math.max(.001,fire));
      const radius=(.32+jetU*.65)*Math.pow(1-jetU,.4)*.78;
      this.point.set(Math.sin((time*17-jetU*29)*.4)*jetU*.12,1.03+jetU*jetU*.10,1.12+distance);
      if(!on){this.boxes[i].makeEmpty();continue;}
      this.head.localToWorld(this.point);
      // A bounded segment can never burn behind the visible jet or during
      // its telegraph. Overlap closes small holes along the continuous plume.
      this.half.set(radius*.85,radius*.72,.30).multiplyScalar(this.spec.w??1);
      const yaw=this.group.rotation.y+this.head.rotation.y,c=Math.abs(Math.cos(yaw)),s=Math.abs(Math.sin(yaw));
      const x=this.half.x,z=this.half.z;this.half.set(x*c+z*s,this.half.y,x*s+z*c);
      this.boxes[i].min.copy(this.point).sub(this.half);this.boxes[i].max.copy(this.point).add(this.half);
    }
    for(const [layer,jet]of this.jets.entries()){
      jet.visible=fire>0&&visible;if(!jet.visible)continue;
      const positions=jet.geometry.getAttribute('position'),colors=jet.geometry.getAttribute('color');
      for(let ring=0;ring<26;ring++)for(let side=0;side<10;side++){
        const u=ring/25,angle=side/10*Math.PI*2,wave=time*17-u*29;
        const flicker=Math.sin(angle*3+wave)*.15+Math.cos(angle*2-wave*.7)*.08;
        const taper=Math.pow(Math.max(0,1-u),.4),radius=(.32+u*.65)*taper*(1+flicker)*(layer?.54:1);
        const bend=Math.sin(wave*.4)*u*.12,i=ring*10+side;
        positions.setXYZ(i,Math.cos(angle)*radius+bend,Math.sin(angle)*radius*.8+u*u*.10,
          1.12+range*fire*u+Math.sin(angle*3-wave)*.18*u);
        this.flameColor.copy(layer?this.hot:this.gold).lerp(this.orange,Math.min(1,u*(layer?.65:1)));
        colors.setXYZW(i,this.flameColor.r,this.flameColor.g,this.flameColor.b,(layer?.96:.62)*Math.min(1,(1-u)*7));
      }
      positions.needsUpdate=colors.needsUpdate=true;
    }
  }
  dispose():void {this.disposed=true;this.model?.removeFromParent();this.lease.release();}
}
