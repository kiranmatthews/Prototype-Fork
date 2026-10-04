import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CustomComponent } from './level';
import type { EnemyAnimationFrame, EnemyKind, EnemyVisual, EnemyVisualDiagnostics } from './enemies/types';
import { characterElasticityAmplitudes } from './animation/elasticity';
import { enemyElasticPulse } from './enemies/elasticity';

/** Presentation skins only. Movement, contacts and pendulum timing stay native. */
export const GHOST_DECOR_KINDS = ['ghostcart','ghostaxe','ghostknight','ghostfood','ghostcake','ghostarch'] as const;
export type GhostDecorKind = typeof GHOST_DECOR_KINDS[number];
export const GHOST_DECOR_LABELS:Record<GhostDecorKind,string> = {
  ghostcart:'Ghost train cart',ghostaxe:'Castle swinging axe',ghostknight:'Clockwork haunted armour',
  ghostfood:'Animatronic banquet turkey',ghostcake:'Animatronic banquet cake',ghostarch:'Haunted castle arch',
};
export const GHOST_ASSETS = {
  ghostcart:'ghost-train/ghost-cart.glb',ghostarch:'ghost-train/castle-arch.glb',
  ghostfood:'ghost-train/banquet-turkey.glb',ghostcake:'ghost-train/banquet-cake.glb',
  ghostknight:'ghost-train/clockwork-knight.glb',
} as const;
type AssetKind=keyof typeof GHOST_ASSETS;
type AssetStatus='loading'|'ready'|'error';
interface Asset {scene:THREE.Group;bounds:THREE.Box3;}
interface AssetEntry {status:AssetStatus;promise:Promise<Asset|null>;error?:string;}
const templates=new Map<AssetKind,AssetEntry>();
function asset(kind:AssetKind):AssetEntry {
  const existing=templates.get(kind);if(existing)return existing;
  const entry:AssetEntry={status:'loading',promise:Promise.resolve(null)};
  entry.promise=new Promise(resolve=>new GLTFLoader().load(import.meta.env.BASE_URL+GHOST_ASSETS[kind],gltf=>{
    gltf.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(gltf.scene);
    if(bounds.isEmpty()){entry.status='error';entry.error='Empty Meshy asset';resolve(null);return;}
    gltf.scene.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.geometry.userData.shared=true;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        material.userData.shared=true;
        for(const value of Object.values(material))if((value as THREE.Texture)?.isTexture){
          const texture=value as THREE.Texture;texture.userData.shared=true;texture.anisotropy=4;
        }
      }
    });
    entry.status='ready';resolve({scene:gltf.scene,bounds});
  },undefined,error=>{
    entry.status='error';entry.error=error instanceof Error?error.message:String(error);
    // The Node collision harness deliberately answers artwork requests 404.
    if((error as {response?:{url?:string}}).response?.url)console.warn('Ghost train Meshy artwork failed to load',kind,error);
    resolve(null);
  }));
  templates.set(kind,entry);return entry;
}
function material(color:number,emissive=0):THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({color,roughness:.83,metalness:.18,emissive,flatShading:true});
}
function box(parent:THREE.Object3D,size:[number,number,number],position:[number,number,number],mat:THREE.Material,name=''):THREE.Mesh {
  const m=new THREE.Mesh(new THREE.BoxGeometry(...size),mat);m.position.set(...position);m.name=name;
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function cylinder(parent:THREE.Object3D,top:number,bottom:number,height:number,position:[number,number,number],mat:THREE.Material,sides=8):THREE.Mesh {
  const m=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,sides),mat);m.position.set(...position);
  m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function disposeOwned(root:THREE.Object3D):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();
  root.traverse(object=>{const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    if(!mesh.geometry.userData.shared)geometries.add(mesh.geometry);
    for(const mat of Array.isArray(mesh.material)?mesh.material:[mesh.material])if(!mat.userData.shared)materials.add(mat);
  });
  for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();root.removeFromParent();root.clear();
}
function fitted(a:Asset,height:number,size?:[number,number,number]):THREE.Group {
  const root=new THREE.Group(),model=a.scene.clone(true),span=a.bounds.getSize(new THREE.Vector3());
  model.position.set(-(a.bounds.min.x+a.bounds.max.x)/2,-a.bounds.min.y,-(a.bounds.min.z+a.bounds.max.z)/2);
  root.add(model);root.scale.set(...(size?[size[0]/span.x,size[1]/span.y,size[2]/span.z] as [number,number,number]:[height/span.y,height/span.y,height/span.y] as [number,number,number]));
  root.userData.meshyAsset=true;return root;
}
function greenLamp(parent:THREE.Object3D,p:[number,number,number],size=.1):void {
  const m=new THREE.Mesh(new THREE.SphereGeometry(size,8,6),new THREE.MeshBasicMaterial({color:0x8cff3d}));m.position.set(...p);parent.add(m);
}
function fallbackCart(w:number,d:number,h:number):THREE.Group {
  const root=new THREE.Group(),oak=material(0x513328),iron=material(0x252329),gold=material(0xae8742);
  box(root,[w,h*.75,d],[0,h*.58,0],oak);box(root,[w+.08,.1,d+.08],[0,h*.9,0],gold);
  for(const side of [-1,1])for(const end of [-1,1]){
    const wheel=cylinder(root,.35,.35,.17,[side*(w/2+.03),.32,end*d*.32],iron,10);wheel.rotation.z=Math.PI/2;
    box(root,[.13,h*.55,.15],[side*w*.44,h*.74,end*d*.42],iron);
  }
  for(let i=0;i<5;i++)box(root,[w*.89,.06,d/5*.85],[0,h+.025,(i-2)*d/5],oak);
  return root;
}
function fallbackArch(w:number,h:number,d:number):THREE.Group {
  const root=new THREE.Group(),stone=material(0x423849),trim=material(0x765f7f),dark=material(0x211b2a);
  for(const side of [-1,1]){
    box(root,[w*.17,h*.8,d],[side*w*.42,h*.4,0],stone);
    box(root,[w*.21,.24,d*1.08],[side*w*.42,h*.77,0],trim);
    cylinder(root,w*.075,w*.095,h*.77,[side*w*.415,h*.4,d*.52],trim,6);
  }
  for(let i=0;i<9;i++){
    const a=Math.PI*i/8,brick=box(root,[w*.16,h*.1,d],[Math.cos(a)*w*.36,h*.77+Math.sin(a)*h*.23,0],i%2?stone:trim);
    brick.rotation.z=a-Math.PI/2;
  }
  box(root,[w*.12,h*.15,d*1.07],[0,h*.91,0],dark);return root;
}
function axeVisual(len:number):THREE.Group {
  const root=new THREE.Group(),shaft=material(0x54352d),steel=material(0xa8a6b7),edge=material(0xd5dac6),brass=material(0xb79048);
  cylinder(root,.10,.14,len,[0,-len/2,0],shaft);
  for(const side of [-1,1]){
    const shape=new THREE.Shape();shape.moveTo(0,-.48);shape.lineTo(side*.76,-.96);shape.lineTo(side*1.04,-.46);
    shape.lineTo(side*.94,.35);shape.lineTo(side*.45,.58);shape.lineTo(0,.37);shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:.2,bevelEnabled:false}),blade=new THREE.Mesh(geo,steel);
    blade.position.set(0,-len,.1);root.add(blade);
    const trim=box(root,[.1,.72,.24],[side*.96,-len-.16,.2],edge);trim.rotation.z=side*.14;
  }
  cylinder(root,.2,.2,.4,[0,-len,.18],brass);greenLamp(root,[0,-len,.36],.11);
  root.name='Castle pendulum double axe';return root;
}

export class GhostTrainAssetKit {
  private roots=new Set<THREE.Group>();private pending:Promise<void>[]=[];private released=false;
  private visuals=new Set<EnemyVisual>();
  constructor(private levelRoot:THREE.Group){}
  private install(kind:AssetKind,parent:THREE.Object3D,fallback:THREE.Group,height:number,size?:[number,number,number]):THREE.Group {
    const root=new THREE.Group();root.name=GHOST_DECOR_LABELS[kind];root.userData.ghostAsset={kind,status:'loading',url:GHOST_ASSETS[kind]};
    parent.add(root);root.add(fallback);this.roots.add(root);
    this.pending.push(asset(kind).promise.then(a=>{
      if(this.released)return;
      if(a){disposeOwned(fallback);root.add(fitted(a,height,size));root.userData.assetReady=true;}
      (root.userData.ghostAsset as {status:string}).status=a?'ready':'error';
    }));return root;
  }
  cart(mesh:THREE.Mesh,c:CustomComponent,height:number):void {
    const [w,,d]=c.s??[4,.6,5],bodyH=1.8;
    mesh.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
    const root=this.install('ghostcart',mesh,fallbackCart(w,d,bodyH),bodyH,[w,bodyH,d]);
    // The generated cart's open upper walls project above its supported floor;
    // the player can read its skull nose and brass sides from the chase view.
    root.position.y=height/2-bodyH+.60;
    // This explicit roof/deck is the supported jumping surface. Imported seat
    // cavities below it never become collision or leave a rider floating.
    const oak=material(0x5e4030),gold=material(0xbc9656),iron=material(0x22242a),crimson=material(0x6f2c45);
    mesh.material=oak;mesh.name='Ghost cart walkable roof deck';mesh.userData.ghostSkin='ghostcart';
    for(let i=0;i<5;i++)box(mesh,[w*.97,.035,d/5*.92],[0,height/2+.014,(i-2)*d/5],oak);
    for(const side of [-1,1]){
      box(mesh,[.10,.35,d*.90],[side*w*.47,height/2+.175,0],crimson);
      box(mesh,[.13,.065,d*.92],[side*w*.47,height/2+.36,0],gold);
      for(const end of [-1,1]){box(mesh,[.10,.60,.10],[side*w*.44,height/2+.30,end*d*.41],iron);greenLamp(mesh,[side*w*.44,height/2+.65,end*d*.41],.10);}
    }
  }
  axe(pivot:THREE.Group,len:number):void {
    for(const child of [...pivot.children])disposeOwned(child);
    pivot.add(axeVisual(len));pivot.userData.ghostSkin='ghostaxe';
  }
  decorate(c:CustomComponent):void {
    if(c.dkind==='ghostaxe'){
      const root=axeVisual(c.len??4);root.position.fromArray(c.p);root.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);this.levelRoot.add(root);return;
    }
    if(c.dkind==='ghostknight'||c.dkind==='ghostfood'||c.dkind==='ghostcake'){
      const visual=createGhostEnemyVisual('grunt',c.dkind);visual.group.position.fromArray(c.p);
      visual.group.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);this.levelRoot.add(visual.group);this.roots.add(visual.group);
      this.visuals.add(visual);this.pending.push(visual.ready);return;
    }
    const kind=c.dkind==='ghostcart'?'ghostcart':'ghostarch',size=c.s??(kind==='ghostarch'?[12,9,1.6]:[4,1.8,5]);
    const fallback=kind==='ghostarch'?fallbackArch(...size):fallbackCart(size[0],size[2],size[1]);
    const root=this.install(kind,this.levelRoot,fallback,size[1],size);root.position.fromArray(c.p);root.rotation.y=THREE.MathUtils.degToRad(c.yaw??0);
  }
  async ready():Promise<void>{await Promise.all(this.pending);}
  get diagnostics():{instances:number;assets:Record<string,{status:AssetStatus;error?:string}>} {
    return {instances:this.roots.size,assets:Object.fromEntries([...templates].map(([kind,entry])=>[kind,{status:entry.status,...(entry.error?{error:entry.error}:{})}]))};
  }
  dispose():void{this.released=true;for(const visual of this.visuals)visual.dispose();this.visuals.clear();for(const root of this.roots)disposeOwned(root);this.roots.clear();}
}

type Skin='ghostknight'|'ghostfood'|'ghostcake';
type Region='head'|'torso'|'jaw'|'upperArmL'|'lowerArmL'|'upperArmR'|'lowerArmR'|'thighL'|'shinL'|'footL'|'thighR'|'shinR'|'footR';
interface Part {root:THREE.Group;pivot:THREE.Vector3;}
interface Leg {side:number;upper:Part;lower:Part;foot:Part;hip:THREE.Vector3;kneeY:number;ankleY:number;planted:boolean;target:THREE.Vector3;}
const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,1);
function part(parent:THREE.Group,name:string,pivot:THREE.Vector3):Part {
  const root=new THREE.Group();root.name=name;root.position.copy(pivot);parent.add(root);return{root,pivot:pivot.clone()};
}
/** Triangle-region segmentation is an explicit rigid armour articulation,
 * not an auto-rig. Surface UVs/materials are retained from the Meshy model. */
function segmented(a:Asset,height:number,parts:Record<string,Part>,skin:Skin):{triangles:number;meshes:number} {
  const base=skin==='ghostknight'?0:.38,modelHeight=height-base;
  const scale=modelHeight/(a.bounds.max.y-a.bounds.min.y),cx=(a.bounds.min.x+a.bounds.max.x)/2,cz=(a.bounds.min.z+a.bounds.max.z)/2;
  const normalize=new THREE.Matrix4().makeTranslation(0,base,0).multiply(new THREE.Matrix4().makeScale(scale,scale,scale)).multiply(new THREE.Matrix4().makeTranslation(-cx,-a.bounds.min.y,-cz));
  const nodeRegions:Record<string,Region>={Head:'head',Torso:'torso',LeftUpperArm:'upperArmL',LeftForearm:'lowerArmL',RightUpperArm:'upperArmR',RightForearm:'lowerArmR',LeftThigh:'thighL',LeftShin:'shinL',LeftFoot:'footL',RightThigh:'thighR',RightShin:'shinR',RightFoot:'footR'};
  const vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()],centroid=new THREE.Vector3();let total=0,meshCount=0;
  const region=(v:THREE.Vector3):Region=>{
    if(skin!=='ghostknight')return v.z>.23&&v.y<base+modelHeight*.52?'jaw':'torso';
    const side=v.x<0?'L':'R';
    if(v.y<1.18)return (v.y<.23?'foot':v.y<.67?'shin':'thigh')+side as Region;
    if(Math.abs(v.x)>.48&&v.y<2.24)return (v.y<1.65?'lowerArm':'upperArm')+side as Region;
    return v.y>2.12?'head':'torso';
  };
  a.scene.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh||(mesh as THREE.SkinnedMesh).isSkinnedMesh)return;
    const source=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();source.applyMatrix4(normalize.clone().multiply(mesh.matrixWorld));
    const pos=source.getAttribute('position'),buckets=new Map<string,number[]>();
    for(let i=0;i<pos.count;i+=3){for(let j=0;j<3;j++)vertices[j].fromBufferAttribute(pos,i+j);
      centroid.copy(vertices[0]).add(vertices[1]).add(vertices[2]).multiplyScalar(1/3);const name=nodeRegions[mesh.name]??region(centroid);
      const group=source.groups.find(g=>i>=g.start&&i<g.start+g.count),materialIndex=group?.materialIndex??0,key=name+':'+materialIndex;
      const indices=buckets.get(key)??[];indices.push(i,i+1,i+2);buckets.set(key,indices);total++;
    }
    for(const [key,indices]of buckets){const [name,matIndex]=key.split(':'),target=parts[name];if(!target)continue;
      const geo=new THREE.BufferGeometry();for(const [attrName,attribute]of Object.entries(source.attributes)){
        const data:number[]=[];for(const index of indices)for(let k=0;k<attribute.itemSize;k++)data.push(attribute.array[index*attribute.itemSize+k]);
        geo.setAttribute(attrName,new THREE.Float32BufferAttribute(data,attribute.itemSize));
      }
      geo.translate(-target.pivot.x,-target.pivot.y,-target.pivot.z);geo.computeBoundingSphere();
      const mat=Array.isArray(mesh.material)?mesh.material[Number(matIndex)]??mesh.material[0]:mesh.material;
      const piece=new THREE.Mesh(geo,mat);piece.castShadow=true;piece.receiveShadow=true;piece.name=`Meshy_${name}`;target.root.add(piece);
      meshCount++;
    }
    source.dispose();
  });return{triangles:total,meshes:meshCount};
}
function legSolve(leg:Leg,target:THREE.Vector3,compression:number):void {
  const hip=leg.hip,restKnee=leg.lower.pivot,restFoot=leg.foot.pivot;
  const upperLength=hip.distanceTo(restKnee),lowerLength=restKnee.distanceTo(restFoot);
  const direction=target.clone().sub(hip),distance=THREE.MathUtils.clamp(direction.length(),.12,upperLength+lowerLength-.002),unit=direction.normalize();
  const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
  const outward=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
  const restUnit=restFoot.clone().sub(hip).normalize(),restBend=restKnee.clone().sub(hip);
  restBend.addScaledVector(restUnit,-restBend.dot(restUnit));
  const bend=(restBend.lengthSq()>.000001?restBend:FORWARD.clone()).addScaledVector(unit,-restBend.dot(unit)).normalize();
  const knee=hip.clone().addScaledVector(unit,along).addScaledVector(bend,outward);
  for(const [segment,start,end,restStart,restEnd,length]of [[leg.upper,hip,knee,hip,restKnee,upperLength],[leg.lower,knee,target,restKnee,restFoot,lowerLength]] as const){
    segment.root.position.copy(start);segment.root.quaternion.setFromUnitVectors(restEnd.clone().sub(restStart).normalize(),end.clone().sub(start).normalize());
    // Small per-segment flex follows shared profiles; no actor-root scaling.
    segment.root.scale.y=1+compression;segment.root.position.addScaledVector(UP,-compression*length*.15);
  }
  leg.foot.root.position.copy(target);leg.foot.root.rotation.set(0,0,0);leg.foot.root.scale.set(1,1,1);
}
export function createGhostEnemyVisual(kind:EnemyKind,skin:Skin):EnemyVisual {
  const group=new THREE.Group();group.name=GHOST_DECOR_LABELS[skin];group.userData.ghostSkin=skin;
  const body=new THREE.Group();group.add(body);const rig=new THREE.Group();body.add(rig);
  const knight=skin==='ghostknight',height=knight?2.62:1.20,torsoBase=knight?1.18:.38;
  const parts:Record<string,Part>={},legs:Leg[]=[];
  const torso=parts.torso=part(rig,'Torso',new THREE.Vector3(0,torsoBase,0));
  const head=parts.head=part(rig,'Head',new THREE.Vector3(0,knight?2.12:.83,.06));
  const jaw=parts.jaw=part(rig,'Jaw',new THREE.Vector3(0,knight?2.12:.58,.23));
  const iron=material(0x626571),dark=material(0x202129),trim=material(0xaaa083),cream=material(0xf1cf94),brown=material(0x9b542b);
  const fallback=new THREE.Group();fallback.name='Loading artwork';rig.add(fallback);
  const placeholder:THREE.Mesh[]=[];
  const ownBox=(p:Part,s:[number,number,number],at:[number,number,number],mat:THREE.Material)=>{const m=box(p.root,s,at,mat);m.userData.keepFoodLimb=/Thigh|Shin|Foot/.test(p.root.name);placeholder.push(m);return m;};
  if(knight){
    ownBox(torso,[.85,.76,.51],[0,.42,0],iron);ownBox(torso,[.65,.23,.48],[0,.02,0],dark);
    ownBox(head,[.57,.46,.48],[0,.25,0],iron);ownBox(head,[.59,.14,.10],[0,.20,.27],dark);
    for(let i=-2;i<=2;i++)ownBox(head,[.025,.12,.03],[i*.075,.14,.33],trim);
    const crest=cylinder(head.root,.04,.13,.40,[0,.60,0],trim,5);placeholder.push(crest);
  }else{
    const core=new THREE.Mesh(skin==='ghostcake'?new THREE.CylinderGeometry(.44,.54,.6,9):new THREE.SphereGeometry(.52,10,7),skin==='ghostcake'?cream:brown);
    core.position.set(0,.40,0);torso.root.add(core);placeholder.push(core);
    ownBox(jaw,[.50,.11,.20],[0,-.015,.17],dark);
    for(let i=-2;i<=2;i++)ownBox(jaw,[.065,.11,.07],[i*.08,.065,.22],cream);
    if(skin==='ghostcake')for(const x of [-.22,0,.22]){const candle=cylinder(head.root,.025,.025,.23,[x,.27,0],trim,6);placeholder.push(candle);greenLamp(head.root,[x,.41,0],.045);}
  }
  for(const side of [-1,1]){
    const suffix=side<0?'L':'R',hip=new THREE.Vector3(side*(knight?.23:.25),torsoBase,0),kneeY=knight?.67:.21,ankleY=knight?.16:.055;
    const upper=parts['thigh'+suffix]=part(rig,'Thigh'+suffix,hip),lower=parts['shin'+suffix]=part(rig,'Shin'+suffix,new THREE.Vector3(hip.x,kneeY,0));
    const foot=parts['foot'+suffix]=part(rig,'Foot'+suffix,new THREE.Vector3(hip.x,ankleY,0));
    ownBox(upper,[knight?.30:.09,torsoBase-kneeY,knight?.32:.1],[0,-(torsoBase-kneeY)/2,0],knight?iron:trim);
    ownBox(lower,[knight?.24:.075,kneeY-ankleY,knight?.28:.1],[0,-(kneeY-ankleY)/2,0],knight?iron:trim);
    ownBox(foot,[knight?.30:.18,knight?.17:.07,knight?.48:.25],[0,-ankleY/2,.07],dark);
    legs.push({side,upper,lower,foot,hip,kneeY,ankleY,planted:false,target:new THREE.Vector3()});
    if(knight){
      const shoulder=new THREE.Vector3(side*.53,2.13,0),arm=parts['upperArm'+suffix]=part(rig,'UpperArm'+suffix,shoulder);
      const forearm=parts['lowerArm'+suffix]=part(rig,'Forearm'+suffix,new THREE.Vector3(side*.58,1.65,0));
      ownBox(arm,[.30,.49,.32],[0,-.23,0],iron);ownBox(forearm,[.22,.43,.27],[0,-.21,0],iron);
      ownBox(forearm,[.21,.17,.24],[0,-.48,0],dark);
    }
    // Emissive sockets remain independent from the moving visor/head surface.
    greenLamp(head.root,[side*(knight?.068:.16),knight?.231:.08,knight?.223:.37],knight?.037:.072);
  }
  const diagnostics:EnemyVisualDiagnostics={kind,status:'loading',url:import.meta.env.BASE_URL+GHOST_ASSETS[skin],clips:['procedural clockwork gait'],activeClip:null,
    mappedNodes:Object.fromEntries(Object.entries(parts).map(([name,p])=>[name,p.root.name])),skinnedMeshes:0,meshes:0,animationTime:0,gaitPhase:0,state:'patrol'};
  group.userData.enemyVisual=diagnostics;group.userData.ghostArticulation={method:'Meshy surface triangle regions with rigid semantic armour joints',planting:'world-space foot anchors with analytic two-link knees',wholeRigScaleAnimation:false};
  let disposed=false,phase=0,lastHeading=0,lastFrame:EnemyAnimationFrame={state:'patrol',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false},defeatTime=0;
  const ready=asset(skin).promise.then(a=>{
    if(disposed)return;
    if(a){
      if(knight){
        const names:Record<string,string>={Torso:'torso',Head:'head',LeftUpperArm:'upperArmL',LeftForearm:'lowerArmL',RightUpperArm:'upperArmR',RightForearm:'lowerArmR',LeftThigh:'thighL',LeftShin:'shinL',LeftFoot:'footL',RightThigh:'thighR',RightShin:'shinR',RightFoot:'footR'};
        let pivots:Record<string,[number,number,number]>|undefined;
        a.scene.traverse(node=>{if(node.userData.ghostTrainRig?.pivots)pivots=node.userData.ghostTrainRig.pivots;});
        if(pivots){const scale=height/(a.bounds.max.y-a.bounds.min.y),center=a.bounds.getCenter(new THREE.Vector3());
          for(const [name,value]of Object.entries(pivots)){const p=parts[names[name]];if(!p)continue;
            p.pivot.set((value[0]-center.x)*scale,(value[1]-a.bounds.min.y)*scale,(value[2]-center.z)*scale);p.root.position.copy(p.pivot);
          }
          for(const leg of legs){leg.hip.copy(leg.upper.pivot);leg.kneeY=leg.lower.pivot.y;leg.ankleY=leg.foot.pivot.y;leg.planted=false;}
          group.userData.ghostArticulation.measuredPivots=true;
        }
      }
      for(const mesh of placeholder)if(knight||!mesh.userData.keepFoodLimb){mesh.removeFromParent();mesh.geometry.dispose();}
      const retained=new Set<THREE.Material>();group.traverse(object=>{const mesh=object as THREE.Mesh;if(mesh.isMesh)for(const m of Array.isArray(mesh.material)?mesh.material:[mesh.material])retained.add(m);});
      for(const mat of [iron,dark,trim,cream,brown])if(!retained.has(mat))mat.dispose();
      const result=segmented(a,height,parts,skin);diagnostics.meshes=result.meshes;group.userData.ghostTriangles=result.triangles;diagnostics.status='ready';group.userData.assetReady=true;update(0,lastFrame);
    }else {diagnostics.status='error';diagnostics.error=asset(skin).error;}
  });
  function update(dt:number,frame:EnemyAnimationFrame):void {
    if(disposed)return;lastFrame=frame;const moving=frame.speed>.03&&frame.grounded&&frame.alive;
    if(moving)phase=(phase+dt*frame.speed/(knight?1.10:.54))%1;
    if(!frame.alive)defeatTime+=dt;else defeatTime=0;
    const heading=group.rotation.y,turned=Math.abs(heading-lastHeading)>.4;lastHeading=heading;
    const shared=characterElasticityAmplitudes(moving?'walk':'idle'),wave=frame.alive?Math.sin(phase*Math.PI*4):0,pulse=enemyElasticPulse(defeatTime,.6);
    const anticipation=frame.alive&&kind==='hopper'?(frame.state==='crouch'?-Math.min(1,frame.stateTime/.45):frame.state==='leap'?Math.sin(Math.PI*Math.min(1,frame.stateTime/.36)):0):0;
    torso.root.position.copy(torso.pivot);torso.root.scale.y=1+(frame.alive?shared[0]*wave*(knight?.28:.7)+characterElasticityAmplitudes('jump')[0]*anticipation*.6:shared[0]*pulse);
    torso.root.rotation.z=moving?Math.sin(phase*Math.PI*2)*(knight?.027:.07):0;
    head.root.position.copy(head.pivot);head.root.rotation.x=frame.alive?(knight?-.09+Math.sin(frame.time*.65)*.025:Math.sin(frame.time*3)*.04):-.09*pulse;
    jaw.root.rotation.x=knight?0:frame.alive?.16+Math.max(0,Math.sin(frame.time*4.2))*.43:.2*pulse;
    group.updateWorldMatrix(true,false);
    for(const leg of legs){
      const cycle=(phase+(leg.side<0?0:.5))%1,stance=!moving||cycle<.5;
      const target=leg.foot.pivot.clone();if(moving)target.z+=(knight?.275:.135)*Math.cos(cycle*Math.PI*2);
      if(moving&&!stance)target.y+=Math.sin((cycle-.5)*Math.PI*2)*(knight?.19:.08);
      if(stance&&frame.grounded&&frame.alive){
        if(!leg.planted||turned||!moving)leg.target.copy(group.localToWorld(target.clone()));
        target.copy(group.worldToLocal(leg.target.clone()));target.y=leg.ankleY;
      }
      leg.planted=stance&&frame.grounded&&frame.alive;
      const elastic=leg.planted?0:(frame.alive?shared[3]*Math.sin(cycle*Math.PI*2)*(knight?.32:.65):0)+pulse*.035;
      legSolve(leg,target,elastic);
      if(knight){const suffix=leg.side<0?'L':'R',arm=parts['upperArm'+suffix],forearm=parts['lowerArm'+suffix];
        // Four held servo poses communicate a mechanical procession. The
        // gameplay patrol remains smooth; only the independent joints hold.
        const swing=moving?Math.round(Math.sin(cycle*Math.PI*2)*4)*.05:0;
        arm.root.rotation.x=-.08-swing;arm.root.rotation.z=-Math.sign(arm.pivot.x)*.025;
        forearm.root.position.copy(forearm.pivot).sub(arm.pivot).applyQuaternion(arm.root.quaternion).add(arm.pivot);
        forearm.root.quaternion.copy(arm.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-.08-swing*.35));
        forearm.root.scale.y=1+shared[2]*wave*.2;
      }
    }
    diagnostics.animationTime+=dt;diagnostics.gaitPhase=phase;diagnostics.state=frame.state;
    diagnostics.activeClip=moving?'clockwork walk':frame.alive?'menacing idle':'finite defeat settle';
    group.userData.ghostFootContacts=legs.map(l=>({side:l.side,planted:l.planted,target:l.target.toArray()}));
  }
  function reset():void {phase=0;defeatTime=0;for(const leg of legs)leg.planted=false;update(0,{...lastFrame,alive:true,flung:false,speed:0,state:'patrol',stateTime:0});}
  update(0,lastFrame);
  return {group,body,ready,diagnostics,getMuzzlePosition:()=>false,update,reset,dispose:()=>{if(disposed)return;disposed=true;disposeOwned(group);diagnostics.status='disposed';}};
}
