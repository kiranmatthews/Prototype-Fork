import * as THREE from 'three';
import { createTripleNozzleParts, type NozzleMaterial } from './sideNozzle';
import { sculptedGeometry, sculptedTexture } from './sculpted';
import { bevelBox, loft, placed, merged, strut, type XYZ } from './geometry';

export interface CartPalette { paint:string; cream:string; seat:string; trim:string; cargo:string }
export const CART_PALETTES:readonly CartPalette[] = [
  {paint:'#08a89e',cream:'#fff0bd',seat:'#f4c786',trim:'#273346',cargo:'#f16a45'},
  {paint:'#f15c50',cream:'#fff1cf',seat:'#ffc56d',trim:'#332e47',cargo:'#47babc'},
  {paint:'#edb12b',cream:'#fff4d5',seat:'#855638',trim:'#30374a',cargo:'#875bc1'},
  {paint:'#608ff1',cream:'#fff1d3',seat:'#e7ac77',trim:'#273248',cargo:'#f5a338'},
  {paint:'#a278d2',cream:'#fff1bc',seat:'#f1bc79',trim:'#343047',cargo:'#4eb7a8'},
];
export interface DriverMotion { time:number; steer:number; roll:number; pitch:number; impact:number; speed:number }
/** Root origin is the seated hip; local forward -Z. Attachment never transfers resource ownership. */
export interface CartDriver { root:THREE.Object3D; update(motion:DriverMotion):void; dispose():void }
export const CART_DIMENSIONS = Object.freeze({length:3.13,width:1.95,height:2.18,wheelbase:1.72,track:1.48,wheelRadius:.41});
export interface CartPose extends DriverMotion { wheelTravel:number; suspension:readonly number[]; damage:readonly number[]; health?:number;landingCompression?:number }
type MaterialKey=keyof CartPalette|NozzleMaterial|'lamp'|'red'|'metal'|'glass'|'wheel'|'canopyArt'|'bagArt'|'bagDetail';
type Part={name:string;geometry:THREE.BufferGeometry;material:MaterialKey;parent:string};
const pt=(w:number,h:number,d:number,p:XYZ,r:XYZ=[0,0,0],cut?:number)=>placed(bevelBox(w,h,d,cut),p,r);

/** One immutable geometry kit per fleet. All five carts share these GPU buffers. */
export class GolfCartKit {
  readonly parts:Part[]=[];
  readonly wheel=sculptedGeometry('wheel');
  readonly textures={wheel:sculptedTexture('wheel'),canopy:sculptedTexture('canopy'),bag:sculptedTexture('bag'),bagPaint:sculptedTexture('bag',true)};
  readonly steering=merged([new THREE.TorusGeometry(.205,.028,5,12).rotateX(-.65),strut([-.19,0,0],[.19,0,0],.018),strut([0,0,0],[0,-.14,.10],.018)]);
  private disposed=false;
  readonly steeringPosition:THREE.Vector3;
  readonly cabinRise:number;
  constructor(damageVisuals=false){
    this.steeringPosition=new THREE.Vector3(-.34,damageVisuals?1.43:1.23,damageVisuals?-.20:-.28);
    const cabinRise=this.cabinRise=damageVisuals?.60:0;
    const add=(name:string,material:MaterialKey,parts:THREE.BufferGeometry[],parent='body')=>this.parts.push({name,material,geometry:merged(parts),parent});
    add('chassis','trim',[
      pt(1.35,.18,2.7,[0,.47,0]),pt(1.62,.10,1.35,[0,.52,.05]),pt(1.65,.17,.18,[0,.4,-.85]),pt(1.65,.17,.18,[0,.4,.87]),
      pt(1.26,.10,.58,[0,.58,1.15]),pt(1.12,.33,.15,[0,.93,-.49],[.16,0,0]),
      ...[-1,1].flatMap(s=>[pt(.11,.14,1.2,[s*.76,.62,.08]),strut([s*.73,.70,.20],[s*.73,1.02,.2],.038),strut([s*.73,1.02,.2],[s*.73,1.02,.61],.038)]),
      strut([-.34,.78,-.43],[-.34,this.steeringPosition.y-.04,this.steeringPosition.z-.01],.035),
    ]);
    add('rear-body','paint',[
      pt(1.43,.40,.66,[0,.80,.80],[.035,0,0],.12),
      ...[-1,1].map(s=>placed(loft([[-.28,.25,.61,.76,.06],[.35,.31,.62,1.02,.08],[.98,.35,.67,1.08,.09],[1.25,.28,.65,.95,.06]]),[s*.67,0,0])),
    ]);
    add('nose-shell','paint',[loft([[-1.48,1.23,.65,.87,.09],[-1.28,1.60,.64,.99,.10],[-.80,1.53,.72,1.12,.12],[-.43,1.25,.72,1.06,.10]])],'nose');
    const stripe=new THREE.BufferGeometry();stripe.setAttribute('position',new THREE.Float32BufferAttribute([-.155,.878,-1.48,.155,.878,-1.48,-.155,.998,-1.28,.155,.998,-1.28,-.155,1.128,-.80,.155,1.128,-.80,-.155,1.068,-.43,.155,1.068,-.43],3));stripe.setIndex([0,2,1,1,2,3,2,4,3,3,4,5,4,6,5,5,6,7]);stripe.computeVertexNormals();add('nose-cream-inlay','cream',[stripe],'nose');
    add('lamp-sockets','trim',[-1,1].map(s=>pt(.43,.21,.085,[s*.49,.835,-1.425],[.13,s*.07,-s*.10],.055)),'nose');
    add('headlights','lamp',[-1,1].map(s=>pt(.33,.125,.032,[s*.49,.85,-1.48],[.13,s*.07,-s*.10],.028)),'nose');
    add('front-bumper','trim',[pt(1.64,.19,.22,[0,.57,-1.5],[0,0,0],.055)],'frontBumper');
    add('bumper-inlay','metal',[pt(.70,.075,.025,[0,.60,-1.62])],'frontBumper');
    add('rear-bumper','trim',[pt(1.55,.17,.24,[0,.54,1.37])],'rearBumper');
    add('tail-lamps','red',[-1,1].map(s=>pt(.21,.12,.04,[s*.59,.88,1.14])));
    add('bench-seat','seat',[-1,1].flatMap(s=>[pt(.58,.18,.52,[s*.32,.94,.36],[0,0,0],.06),pt(.58,.48,.15,[s*.32,1.23,.66],[-.14,0,0],.065)]));
    add('seat-piping','cream',[-1,1].map(s=>pt(.49,.026,.022,[s*.32,1.08,.105])));
    add('roof-posts','trim',[-1,1].flatMap(s=>[strut([s*.64,1.03,-.70],[s*.66,1.98+cabinRise,-.53],.031),strut([s*.64,.85,.84],[s*.66,1.98+cabinRise,.78],.033)]),'roof');
    add('windscreen','glass',[pt(1.20,.30,.016,[0,1.28,-.666],[.18,0,0],.006)],'roof');
    if(damageVisuals){
      for(const part of createTripleNozzleParts())this.parts.push({...part,parent:'body'});
      // Actual fracture/scuff geometry follows the original damaged body groups.
      const crack=(a:XYZ,b:XYZ)=>strut(a,b,.006,3);
      add('windscreen-cracks','metal',[
        crack([-.18,1.29,-.685],[-.48,1.38,-.67]),crack([-.18,1.29,-.685],[.04,1.40,-.664]),
        crack([-.18,1.29,-.685],[-.38,1.16,-.709]),crack([-.18,1.29,-.685],[.20,1.23,-.697]),
        crack([.20,1.23,-.697],[.47,1.34,-.677]),crack([.20,1.23,-.697],[.41,1.17,-.708]),
        crack([-.30,1.33,-.677],[-.24,1.40,-.664]),
      ],'roof');
      add('nose-scuffs','trim',[
        crack([-.51,.995,-1.26],[-.23,1.047,-1.07]),crack([-.46,1.014,-1.18],[-.13,1.067,-.99]),
        crack([.26,1.06,-1.02],[.49,1.10,-.85]),crack([.34,1.072,-.98],[.57,1.109,-.82]),
      ],'nose');
      add('rear-scuffs','trim',[
        crack([-.54,.85,1.138],[-.17,.72,1.138]),crack([-.47,.88,1.141],[-.14,.78,1.14]),
        crack([.17,.89,1.14],[.42,.77,1.14]),
      ]);
    }
    // Keep the authored chassis/damage groups; replace only detachable art modules.
    this.parts.push({name:'canopy',material:'canopyArt',geometry:sculptedGeometry('canopy').translate(0,cabinRise,0),parent:'roof'});
    this.parts.push({name:'golf-bag',material:'bagArt',geometry:sculptedGeometry('bag'),parent:'cargo'});
    this.parts.push({name:'bag-straps',material:'bagDetail',geometry:sculptedGeometry('bag','detail'),parent:'cargo'});
    add('golf-clubs','metal',[-.1,0,.10].flatMap((x,i)=>[strut([.3+x,1.2,1.14],[.35+x,1.65+i*.08,1.24],.015),pt(.15,.065,.07,[.40+x,1.65+i*.08,1.24],[0,0,-.35])]),'cargo');
  }
  create(palette:CartPalette=CART_PALETTES[0]):GolfCartModel {if(this.disposed)throw Error('Disposed cart kit');return new GolfCartModel(this,palette);}
  /** Call after all fleet instances have been disposed. */
  dispose(){if(this.disposed)return;this.disposed=true;this.parts.forEach(p=>p.geometry.dispose());this.wheel.dispose();this.steering.dispose();Object.values(this.textures).forEach(t=>t.dispose());}
}

export class GolfCartModel {
  readonly root=new THREE.Group();readonly body=new THREE.Group();
  readonly socket=new THREE.Group();readonly wheels:THREE.Group[]=[];
  readonly modules:Record<string,THREE.Group>={};readonly materials:Record<MaterialKey,THREE.MeshStandardMaterial>;
  private driver:CartDriver|null=null;readonly steering:THREE.Mesh;private wheelMeshes:THREE.Mesh[]=[];private lastImpact=0;private disposed=false;
  private damageMarks:THREE.Mesh[]=[];
  private originalColors=new Map<THREE.MeshStandardMaterial,THREE.Color>();
  private scorched=false;
  palette:CartPalette;
  constructor(kit:GolfCartKit,palette:CartPalette){
    this.palette={...palette};this.root.name='GolfCart';this.body.name='SuspendedBody';this.root.add(this.body);
    const mat=(name:string,color:string,roughness=.72)=>{const m=new THREE.MeshStandardMaterial({color,roughness,flatShading:true});m.name=name;return m;};
    this.materials={nozzleRing:mat('Nozzle charge rings','#eaa03a',.4),nozzleCream:mat('Nozzle cream housing','#f2dfb5',.68),nozzleBrass:mat('Nozzle brass lips','#c39543',.35),nozzleSoot:mat('Nozzle dark interior','#282b2e',.8),nozzleOrange:mat('Nozzle cooling fins','#e87729',.52),paint:mat('Paint · recolour',palette.paint,.48),cream:mat('Canopy & stripe · recolour',palette.cream),seat:mat('Upholstery · recolour',palette.seat),trim:mat('Frame & bumpers · recolour',palette.trim),cargo:mat('Golf bag · recolour',palette.cargo),lamp:mat('Warm headlamps','#fff1b1',.35),red:mat('Rear lights','#ec5945',.4),metal:mat('Metal','#9eacb5',.45),glass:mat('Windscreen','#93d8e1',.2),wheel:mat('Tyres & hubs','#ffffff'),canopyArt:mat('Sculpted canopy · recolour',palette.cream),bagArt:mat('Sculpted bag · recolour',palette.cargo),bagDetail:mat('Bag piping & straps','#ffffff')};
    for(const [key,map] of [['wheel',kit.textures.wheel],['canopyArt',kit.textures.canopy],['bagArt',kit.textures.bagPaint],['bagDetail',kit.textures.bag]] as const){const material=this.materials[key];material.map=map;material.flatShading=false;material.roughness=.85;}this.materials.glass.transparent=true;this.materials.glass.opacity=.22;this.materials.glass.depthWrite=false;
    this.materials.nozzleBrass.metalness=.7;this.materials.nozzleSoot.metalness=.15;
    this.materials.lamp.emissive.set('#ffbb55');this.materials.lamp.emissiveIntensity=.2;
    this.modules.body=this.body;
    for(const name of ['nose','frontBumper','rearBumper','roof','cargo']){const g=new THREE.Group();g.name=name;this.modules[name]=g;this.body.add(g);}
    for(const part of kit.parts){const mesh=new THREE.Mesh(part.geometry,this.materials[part.material]);mesh.name=part.name;mesh.castShadow=part.material!=='glass';mesh.receiveShadow=true;this.modules[part.parent].add(mesh);if(part.name.endsWith('-cracks')||part.name.endsWith('-scuffs')){mesh.visible=false;this.damageMarks.push(mesh);}}
    for(let i=0;i<4;i++){
      const pivot=new THREE.Group();pivot.name=['FrontLeft','FrontRight','RearLeft','RearRight'][i];pivot.position.set(i%2?.74:-.74,.41,i<2?-.86:.86);
      const mesh=new THREE.Mesh(kit.wheel,this.materials.wheel);mesh.castShadow=true;mesh.name='WheelSpin';pivot.add(mesh);this.root.add(pivot);this.wheels.push(pivot);this.wheelMeshes.push(mesh);
    }
    this.steering=new THREE.Mesh(kit.steering,this.materials.trim);this.steering.position.copy(kit.steeringPosition);this.steering.name='SteeringWheel';this.body.add(this.steering);
    this.socket.name='DriverSocket';this.socket.position.set(-.33,1.035,.32);this.body.add(this.socket);
    this.root.userData={asset:'sol-golf-cart',revision:2,units:'metres',forward:'-Z',driverOrigin:'seated hip',modules:Object.keys(this.modules),palette:{...palette}};
  }
  setPalette(patch:Partial<CartPalette>){for(const key of Object.keys(patch) as (keyof CartPalette)[]){const value=patch[key];if(value){this.palette[key]=value;this.materials[key].color.set(value);}}this.materials.canopyArt.color.set(this.palette.cream);this.materials.bagArt.color.set(this.palette.cargo);this.root.userData.palette={...this.palette};}
  /** Previous driver is returned, detached, for reuse or disposal by its owner. */
  setDriver(next:CartDriver|null){const old=this.driver;if(old)this.socket.remove(old.root);this.driver=next;if(next)this.socket.add(next.root);return old;}
  setModule(name:'roof'|'cargo',visible:boolean){this.modules[name].visible=visible;}
  /** The six outlet rings show the chamber, independently of the brass mounts. */
  setFlameReady(ready:boolean){if(!this.scorched)this.materials.nozzleRing.color.set(ready?'#62f06b':'#eaa03a');}
  setScorched(value:boolean){
    if(this.scorched===value)return;this.scorched=value;
    if(value){for(const material of Object.values(this.materials)){this.originalColors.set(material,material.color.clone());material.color.set('#181a1c');}}
    else{for(const [material,color]of this.originalColors)material.color.copy(color);this.originalColors.clear();}
  }
  update(pose:CartPose){
    this.body.position.y=Math.max(-.10,Math.min(.10,pose.suspension.reduce((a,b)=>a+b,0)/4))-(pose.landingCompression??0);
    this.body.rotation.set(pose.pitch,0,pose.roll);
    const steer=pose.steer*.48;
    for(let i=0;i<4;i++){this.wheels[i].position.y=.41+(pose.suspension[i]||0);this.wheels[i].rotation.y=i<2?steer*(i===(steer>0?1:0)?1.12:.90):0;this.wheelMeshes[i].rotation.x=-pose.wheelTravel/.41;}
    this.steering.rotation.z=-steer*1.3;
    const severity=this.damageMarks.length?1-(pose.health??1):0;
    const front=Math.max(pose.damage[0]||0,severity*.75),rear=Math.max(pose.damage[1]||0,severity*.55),side=Math.max(pose.damage[2]||0,severity*.8);
    this.damageMarks.forEach((mesh,i)=>mesh.visible=severity>(i===0?.35:.18));
    this.modules.roof.rotation.x=severity*.12;
    this.modules.nose.position.z=front*.15;this.modules.nose.rotation.z=front*.09;this.modules.nose.rotation.x=-front*.08;
    this.modules.frontBumper.rotation.z=front*.24;this.modules.frontBumper.position.y=-front*.12;
    this.modules.rearBumper.rotation.z=-rear*.22;this.modules.rearBumper.position.z=-rear*.10;
    this.modules.roof.rotation.z=side*.07;this.modules.cargo.rotation.x=rear*.18;
    this.materials.lamp.emissiveIntensity=front>.65?.06:.2;
    this.lastImpact=pose.impact;this.driver?.update(pose);
  }
  get stats(){let triangles=0,drawCalls=0;this.root.traverse(o=>{if(o instanceof THREE.Mesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;drawCalls++;}});return {triangles,drawCalls,impact:this.lastImpact};}
  dispose(){if(this.disposed)return;this.disposed=true;this.setDriver(null);Object.values(this.materials).forEach(m=>m.dispose());this.root.removeFromParent();}
}
