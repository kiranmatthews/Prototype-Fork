import * as THREE from 'three';
import type {CustomComponent} from './level';
import {createJungleAssetScope, type Template} from './jungleAssets';
import {ANCIENT_NATIVE_SIZE} from './ancientGatesAssetBounds';

type Kind=keyof typeof ANCIENT_NATIVE_SIZE;
type Piece={kind:Kind;matrix:THREE.Matrix4};
type State={active?:()=>boolean;attached?:()=>boolean};
type Binding={body:THREE.Mesh;root:THREE.Group;inverseScale:THREE.Matrix4;
  material:THREE.Material[];state:State;loaded:boolean;chains?:THREE.InstancedMesh;
  component:CustomComponent;size:THREE.Vector3;top:number};
const Y=new THREE.Vector3(0,1,0),FLOOR=-32;
const nativeSize=(kind:Kind,length:number,axis=0)=>new THREE.Vector3(...ANCIENT_NATIVE_SIZE[kind]).multiplyScalar(length/ANCIENT_NATIVE_SIZE[kind][axis]);
const piece=(kind:Kind,p:THREE.Vector3,length:number,yaw=0,axis=0):Piece=>({kind,
 matrix:new THREE.Matrix4().compose(p,new THREE.Quaternion().setFromAxisAngle(Y,yaw),nativeSize(kind,length,axis))});

/** Repeated complete models, each with one scalar. No fitted/stretched mesh axes. */
export function ancientDeckPieces(size:THREE.Vector3,center:THREE.Vector3,stone=false):Piece[]{
 const pieces:Piece[]=[],top=center.y+size.y/2;
 if(stone){
  const nx=Math.max(1,Math.ceil(size.x/3.2)),tile=size.x/nx,nz=Math.max(1,Math.round(size.z/tile));
  for(let x=0;x<nx;x++)for(let z=0;z<nz;z++)pieces.push(piece('stonepaver',new THREE.Vector3(
   center.x-size.x/2+(x+.5)*tile,top-nativeSize('stonepaver',tile).y+.015,center.z-size.z/2+(z+.5)*size.z/nz),tile));
 }else{
  const plank=nativeSize('trialsv2plank',size.x),count=Math.max(1,Math.round(size.z/plank.z));
  for(let i=0;i<count;i++)pieces.push(piece('trialsv2plank',new THREE.Vector3(center.x,top-plank.y+.015,
   center.z-size.z/2+(i+.5)*size.z/count),size.x));
 }
 const underside=top-(stone?nativeSize('stonepaver',size.x/Math.ceil(size.x/3.2)).y:nativeSize('trialsv2plank',size.x).y);
 const n=Math.max(1,Math.ceil(size.x/3.2)),span=size.x/n,beam=nativeSize('trialsv2beam',span);
 for(const side of [-1,1])for(let i=0;i<n;i++)pieces.push(piece('trialsv2beam',new THREE.Vector3(
  center.x-size.x/2+(i+.5)*span,underside-beam.y,center.z+side*size.z*.34),span));
 // Transverse end ties read clearly when the trap door stands upright.
 const ties=Math.max(1,Math.ceil(size.z/3.2)),tieSpan=size.z/ties,tie=nativeSize('trialsv2beam',tieSpan);
 for(const side of [-1,1])for(let i=0;i<ties;i++)pieces.push(piece('trialsv2beam',new THREE.Vector3(
  center.x+side*size.x*.36,underside-tie.y*.8,center.z-size.z/2+(i+.5)*tieSpan),tieSpan,Math.PI/2));
 return pieces;
}

/** Visual siblings follow the original collider. Keeping art out of its child
 * tree preserves spin hit boxes, collision bounds and recursive editor queries. */
export class AncientGatesMechanisms {
 private assets=createJungleAssetScope();
 private bindings:Binding[]=[];
 private jobs:Promise<void>[]=[];
 private materials=new Map<Kind,THREE.MeshStandardMaterial>();
 private frames:THREE.Group[]=[];
 private disposed=false;
 private errors:string[]=[];
 private inverseParent=new THREE.Matrix4();
 private world=new THREE.Matrix4();
 constructor(private parent:THREE.Group){}

 private material(kind:Kind,t:Template):THREE.MeshStandardMaterial{
  let m=this.materials.get(kind);if(m)return m;
  m=new THREE.MeshStandardMaterial({map:t.map,normalMap:t.normalMap,roughnessMap:t.roughnessMap,
   roughness:.9,metalness:kind==='hazardironlink'?.55:0,normalScale:new THREE.Vector2(.12,.12)});
  m.name='Ancient Gates native '+kind;this.materials.set(kind,m);return m;
 }
 private async populate(root:THREE.Group,pieces:Piece[]):Promise<void>{
  const buckets=new Map<Kind,THREE.Matrix4[]>();
  for(const p of pieces){if(!buckets.has(p.kind))buckets.set(p.kind,[]);buckets.get(p.kind)!.push(p.matrix);}
  await Promise.all([...buckets].map(async([kind,matrices])=>{
   const t=await this.assets.load(kind);if(this.disposed)return;
   const mesh=new THREE.InstancedMesh(t.geometry,this.material(kind,t),matrices.length);
   mesh.name='Complete native '+kind;matrices.forEach((m,i)=>mesh.setMatrixAt(i,m));
   mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();
   mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.visualOnly=true;
   mesh.userData.nativeAsset=kind;root.add(mesh);
  }));
 }

 bind(body:THREE.Mesh,c:CustomComponent,state:State={}):void{
  body.geometry.computeBoundingBox();const bounds=body.geometry.boundingBox!;
  const originalScale=body.scale.clone(),size=bounds.getSize(new THREE.Vector3()).multiply(originalScale);
  const center=bounds.getCenter(new THREE.Vector3()).multiply(originalScale);
  // This small scenery recipe is bounded even if its skin is assigned to an
  // unusually large editor component. Keep that component's normal fallback.
  if(this.bindings.length>=256||size.toArray().some(v=>!Number.isFinite(v)||v<.05||v>64)||
   c.p[1]<-28||c.p[1]>150||Math.abs(c.amp??0)>24)return;
  const root=new THREE.Group();root.name='Native mechanism · '+(c.nm??c.t);root.matrixAutoUpdate=false;root.visible=false;
  root.userData.visualOnly=true;this.parent.add(root);
  const b:Binding={body,root,inverseScale:new THREE.Matrix4().makeScale(1/originalScale.x,1/originalScale.y,1/originalScale.z),
   material:(Array.isArray(body.material)?body.material:[body.material]),state,loaded:false,component:c,size,top:0};
  this.bindings.push(b);
  this.jobs.push((async()=>{
   const stone=c.dkind==='stonepaver';
   const parts=c.t==='crusher'?this.hammerPieces(size):ancientDeckPieces(size,center,stone);
   if(stone){
    // Revealed galleries carry their own rear supports so the return lane
    // remains open below. The complete assembly follows the switch state.
    const n=Math.max(2,Math.ceil(size.x/7)),floor=FLOOR-c.p[1],bearing=center.y-size.y/2;
    for(let k=0;k<n;k++){
     const px=center.x-size.x/2+(k+.5)*size.x/n,h=bearing-floor,count=Math.ceil(h/8),tier=h/(1+.97*(count-1));
     for(let i=0;i<count;i++)parts.push(piece('ancienttikipier',new THREE.Vector3(px,floor+i*tier*.97,-size.z/2-2),tier,0,1));
     const length=size.z*.84+2,ties=Math.ceil(length/3.2),span=length/ties;
     for(let i=0;i<ties;i++)parts.push(piece('trialsv2beam',new THREE.Vector3(px,bearing-.1,-size.z/2-2+(i+.5)*span),span,Math.PI/2));
    }
   }
   await this.populate(root,parts);
   if(['mover','crumble','phasepad','crusher'].includes(c.t))await this.suspend(b);
   if(this.disposed)return;b.loaded=true;this.update();
  })().catch(error=>{if(!this.disposed){this.errors.push(String(error));console.error('Ancient Gates mechanism asset failed',error);}}));
 }

 private hammerPieces(size:THREE.Vector3):Piece[]{
  const out:Piece[]=[],native=new THREE.Vector3(...ANCIENT_NATIVE_SIZE.ancientcanyonrock);
  const count=Math.max(1,Math.ceil(size.z/size.x)),depth=size.z/count;
  const scale=Math.min(size.x/native.x,(size.y-.2)/native.y,depth/native.z),height=native.y*scale;
  for(let i=0;i<count;i++)out.push(piece('ancientcanyonrock',new THREE.Vector3(0,-size.y/2,-size.z/2+(i+.5)*depth),height,0,1));
  const cap=nativeSize('trialsv2beam',size.x);
  for(const side of [-1,1])out.push(piece('trialsv2beam',new THREE.Vector3(0,size.y/2-cap.y,side*size.z*.32),size.x));
  return out;
 }

 private async suspend(b:Binding):Promise<void>{
  const c=b.component,[x,y,z]=c.p,w=b.size.x,d=b.size.z;
  const travel=c.t==='mover'&&c.axis==='x'?Math.abs(c.amp??0):0;
  b.top=y+(c.t==='crusher'?b.size.y+4.4+1.8:(c.t==='mover'&&c.axis==='y'?Math.abs(c.amp??0):0)+5.8);
  const a=x-travel-w*.38,far=x+travel+w*.38,back=z-d*.34,front=z+d*.34;
  const frame=new THREE.Group();frame.name='Supported native winch frame · '+c.nm;frame.userData.visualOnly=true;
  this.parent.add(frame);this.frames.push(frame);const parts:Piece[]=[];
  // Two rear towers carry crossarms and continuous rails over the travel path.
  for(const px of [a,far]){
   const h=b.top-FLOOR,count=Math.ceil(h/8),tier=h/(1+.97*(count-1));
   for(let i=0;i<count;i++)parts.push(piece('ancienttikipier',new THREE.Vector3(px,FLOOR+i*tier*.97,z-d/2-2),tier,0,1));
   const length=d*.84+2,n=Math.ceil(length/3.2),step=length/n;
   for(let i=0;i<n;i++)parts.push(piece('trialsv2beam',new THREE.Vector3(px,b.top-.1,z-d/2-2+(i+.5)*step),step,Math.PI/2));
  }
  for(const pz of [back,front]){
   const n=Math.max(1,Math.ceil((far-a)/3.2)),step=(far-a)/n;
   for(let i=0;i<n;i++)parts.push(piece('trialsv2beam',new THREE.Vector3(a+(i+.5)*step,b.top-.1,pz),step));
  }
  await this.populate(frame,parts);
  const link=await this.assets.load('hazardironlink');if(this.disposed)return;
  b.chains=new THREE.InstancedMesh(link.geometry,this.material('hazardironlink',link),400);
  b.chains.name='Native interlocking suspension chains · '+c.nm;b.chains.userData.visualOnly=true;
  b.chains.userData.nativeAsset='hazardironlink';b.chains.castShadow=true;b.chains.receiveShadow=true;
  this.parent.add(b.chains);
 }

 update():void{
  if(this.disposed)return;
  this.parent.updateWorldMatrix(true,false);this.inverseParent.copy(this.parent.matrixWorld).invert();
  for(const b of this.bindings){
   if(!b.loaded)continue;
   b.body.updateWorldMatrix(true,false);
   b.root.matrix.copy(this.inverseParent).multiply(b.body.matrixWorld).multiply(b.inverseScale);b.root.matrixWorldNeedsUpdate=true;
   const active=b.state.active?.()??true;
   b.root.visible=b.body.visible&&active;b.material.forEach(m=>m.visible=!active);
   b.body.userData.ancientNativeReady=true;
   if(!b.chains)continue;
   const c=b.component,follow=b.state.attached?.()??true;
   let index=0;
   for(const sx of [-1,1])for(const sz of [-1,1]){
    const bottom=new THREE.Vector3(sx*b.size.x*.34,b.size.y/2,sz*b.size.z*.34);
    if(follow)bottom.applyMatrix4(b.root.matrix);
    else bottom.set(c.p[0]+sx*b.size.x*.34,c.p[1],c.p[2]+sz*b.size.z*.34);
    const span=Math.max(.2,b.top-bottom.y),count=Math.max(1,Math.min(100,Math.ceil(span/.44)));
    const length=span/(1+.73*(count-1)),scale=nativeSize('hazardironlink',length,1);
    for(let i=0;i<count;i++){
     this.world.compose(new THREE.Vector3(bottom.x,b.top-length-i*length*.73,bottom.z),
      new THREE.Quaternion().setFromAxisAngle(Y,(i%2)*Math.PI/2),scale);
     b.chains.setMatrixAt(index++,this.world);
    }
   }
   b.chains.count=index;b.chains.instanceMatrix.needsUpdate=true;b.chains.computeBoundingBox();b.chains.computeBoundingSphere();
  }
 }
 async ready():Promise<void>{await Promise.all(this.jobs);}
 get diagnostics(){return{requested:this.bindings.length,ready:this.bindings.filter(b=>b.loaded).length,errors:[...this.errors],
  mechanisms:this.bindings.map(b=>({name:b.component.nm,type:b.component.t,ready:b.loaded,visible:b.root.visible,
   active:b.state.active?.()??true,chains:b.chains?.count??0}))};}
 dispose():void{
  this.disposed=true;
  for(const root of [...this.frames,...this.bindings.map(b=>b.root),...this.bindings.flatMap(b=>b.chains?[b.chains]:[])]){
   root.removeFromParent();root.traverse(o=>{if(o instanceof THREE.InstancedMesh)o.dispose();});
  }
  for(const b of this.bindings)b.material.forEach(m=>m.visible=true);
  for(const material of this.materials.values())material.dispose();this.assets.dispose();
 }
}
