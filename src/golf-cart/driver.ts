import * as THREE from 'three';
import { characterElasticityAmplitudes } from '../animation/elasticity';
import { bevelBox, coloured, merged, placed, strut, type XYZ } from './geometry';
import type { CartDriver, DriverMotion } from './model';

export type DriverStyle='captain'|'groundskeeper'|'robot';
export const DRIVER_STYLES:readonly DriverStyle[]=['captain','groundskeeper','robot'];
/** Editable amplitudes use the same deformation vocabulary as the character editor. */
export const CART_DRIVER_ELASTICITY={ride:characterElasticityAmplitudes('skate'),hit:characterElasticityAmplitudes('land'),breathingHz:1.2};
const white=new THREE.Color('#fff');
const shape=(w:number,h:number,d:number,p:XYZ,color:string,r:XYZ=[0,0,0])=>coloured(placed(bevelBox(w,h,d),p,r),color);
const sphere=(r:number,p:XYZ,color:string,scale:XYZ=[1,1,1])=>coloured(new THREE.IcosahedronGeometry(r,1).scale(...scale).translate(...p),color);
function buildHead(style:DriverStyle){
  const robot=style==='robot',skin=robot?'#c9e3de':style==='captain'?'#e8a46f':'#b96f47';
  const parts=robot?[shape(.33,.38,.30,[0,.15,0],skin),shape(.13,.12,.12,[0,.11,-.19],'#f2b43d')]:[sphere(.22,[0,.18,.015],skin,[.87,1.08,.87]),shape(.27,.16,.25,[0,.045,-.01],skin),sphere(.105,[0,.13,-.205],skin,[.83,.68,1.25])];
  parts.push(sphere(.068,[-.19,.16,0],skin,[.6,1,.7]),sphere(.068,[.19,.16,0],skin,[.6,1,.7]));
  for(const s of [-1,1]){
    parts.push(sphere(.067,[s*.082,.23,-.16],robot?'#ffe861':'#fff6df',[.85,1,.4]));
    parts.push(sphere(.034,[s*.077,.226,-.187],robot?'#229b98':'#263345',[.65,1,.36]));
    parts.push(shape(.12,.036,.04,[s*.08,.288,-.155],robot?'#415665':'#54362f',[0,0,s*.11]));
  }
  parts.push(shape(.12,.023,.027,[0,.044,-.162],robot?'#3e5868':'#603c34'));
  if(style==='captain'){
    parts.push(coloured(new THREE.SphereGeometry(.225,10,4,0,Math.PI*2,0,Math.PI/2).scale(1,.64,1).translate(0,.315,.015),'#f48741'),shape(.34,.035,.25,[0,.32,-.18],'#f48741',[.09,0,0]),shape(.10,.075,.035,[0,.38,-.19],'#ffefb9'));
    parts.push(shape(.30,.07,.035,[0,.28,.15],'#684439'));
  }else if(style==='groundskeeper'){
    parts.push(shape(.50,.055,.43,[0,.34,0],'#efbe61'),shape(.34,.17,.31,[0,.42,.01],'#efbe61'),shape(.36,.045,.32,[0,.345,.01],'#725247'));
    for(const s of [-1,1])parts.push(shape(.115,.055,.065,[s*.057,.085,-.19],'#f3dbac',[0,0,-s*.18]));
  }else{
    parts.push(strut([0,.36,.04],[0,.50,.04],.02),sphere(.048,[0,.52,.04],'#f26d41'));
    // strut initially has no colour attribute.
    parts[parts.length-2]=coloured(parts[parts.length-2],'#536d7a');
  }
  return merged(parts);
}

/** Shared immutable drivers. Moving segments have independent transforms; hips/feet stay planted. */
export class GolfDriverKit {
  private heads=new Map<DriverStyle,THREE.BufferGeometry>();
  private bodies=new Map<DriverStyle,THREE.BufferGeometry>();
  private legs:THREE.BufferGeometry;
  private upper:THREE.BufferGeometry;
  private lower=new Map<DriverStyle,THREE.BufferGeometry>();
  readonly material=new THREE.MeshStandardMaterial({color:white,vertexColors:true,roughness:.85,flatShading:true});
  constructor(){
    for(const style of DRIVER_STYLES){
      this.heads.set(style,buildHead(style));
      const shirt=style==='captain'?'#f26439':style==='groundskeeper'?'#1d877f':'#e8ad31';
      this.bodies.set(style,merged([coloured(new THREE.CylinderGeometry(.235,.16,.40,8).scale(1,1,.63).translate(0,.20,0),shirt),shape(.065,.29,.018,[0,.23,-.133],'#ffefcc'),shape(.17,.08,.06,[0,.40,-.11],'#ffefcc'),shape(.10,.10,.024,[-.115,.29,-.141],'#f9dc84')]));
      this.lower.set(style,coloured(new THREE.CylinderGeometry(.052,.045,1,6).translate(0,.5,0),style==='robot'?'#c9e3de':style==='captain'?'#e8a46f':'#b96f47'));
    }
    this.upper=coloured(new THREE.CylinderGeometry(.075,.065,1,6).translate(0,.5,0),'#eee2c2');
    this.legs=merged([-1,1].flatMap(s=>[
      coloured(strut([s*.12,.01,.0],[s*.15,-.09,-.32],.082),'#ead49e'),
      coloured(strut([s*.15,-.09,-.32],[s*.16,-.40,-.46],.065),'#ead49e'),
      shape(.15,.10,.25,[s*.16,-.42,-.51],'#f3eada'),
    ]));
  }
  create(style:DriverStyle='captain'):CartDriver {
    const root=new THREE.Group();root.name=`Driver-${style}`;
    const torso=new THREE.Mesh(this.bodies.get(style)!,this.material),head=new THREE.Mesh(this.heads.get(style)!,this.material),legs=new THREE.Mesh(this.legs,this.material);
    torso.name='ElasticTorso';head.name='HeadRebound';legs.name='PlantedLegs';root.add(torso,head,legs);
    const arms=Array.from({length:4},(_,i)=>new THREE.Mesh(i%2?this.lower.get(style)!:this.upper,this.material));arms.forEach((a,i)=>{a.name=`${i<2?'Left':'Right'}${i%2?'Forearm':'UpperArm'}`;root.add(a);});
    const up=new THREE.Vector3(0,1,0),a=new THREE.Vector3(),b=new THREE.Vector3(),dir=new THREE.Vector3(),mat=new THREE.Matrix4();
    root.traverse(o=>{if(o instanceof THREE.Mesh)o.castShadow=true;});let disposed=false;
    const segment=(mesh:THREE.Mesh,from:THREE.Vector3,to:THREE.Vector3)=>{dir.copy(to).sub(from);const length=dir.length();mesh.position.copy(from);mesh.quaternion.setFromUnitVectors(up,dir.normalize());mesh.scale.set(1,length,1);};
    return {root,update(m:DriverMotion){
      if(disposed)return;
      const spring=m.impact,ride=Math.min(1,Math.abs(m.speed)/8)*Math.sin(m.time*9)*CART_DRIVER_ELASTICITY.ride[0];
      const compress=1-spring*CART_DRIVER_ELASTICITY.hit[0]*1.7+ride;
      torso.scale.y=compress;torso.rotation.z=-m.roll*.55;torso.rotation.x=-m.pitch*.45;torso.position.y=0;
      torso.updateMatrix();mat.copy(torso.matrix);
      head.position.set(-m.roll*.14,.42*compress,-m.pitch*.11);head.rotation.set(-m.pitch*.65,Math.max(-.28,Math.min(.28,-m.steer*.22)),m.roll*.35);
      for(let i=0;i<2;i++){
        const s=i?1:-1;
        a.set(s*.205,.34,0).applyMatrix4(mat);
        // Wheel grip follows the steering ring, independently of torso compression.
        const angle=-m.steer*.48*1.3,rx=s*.18*Math.cos(angle),ry=s*.18*Math.sin(angle);
        const hand=new THREE.Vector3(rx-.01,.195+ry,-.60+ry*.6);
        b.copy(a).lerp(hand,.53);b.y-=.12+spring*.018;b.x+=s*.035;
        segment(arms[i*2],a,b);segment(arms[i*2+1],b,hand);
      }
    },dispose(){disposed=true;root.removeFromParent();}};
  }
  dispose(){this.heads.forEach(g=>g.dispose());this.bodies.forEach(g=>g.dispose());this.lower.forEach(g=>g.dispose());this.legs.dispose();this.upper.dispose();this.material.dispose();}
}
