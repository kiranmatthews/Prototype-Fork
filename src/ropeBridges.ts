import * as THREE from 'three';
import type {CustomComponent,CustomLevelData,Crate} from './level';
import {RopeBridgePhysics,type BridgeLoad,type BridgeSample} from './ropeBridgePhysics';
import {Rail} from './rails';
import {surfaceBoundaryEdges,joinSurfaceBoundaryEdges} from './surfaceEdges';
import {braidedRopeOwners} from './ropeGeometry';
import {sfx} from './audio';

export type BridgeAnchors=[[number,number,number],[number,number,number]];
const UP=new THREE.Vector3(0,1,0);
const p=new THREE.Vector3(),q=new THREE.Vector3(),matrix=new THREE.Matrix4(),delta=new THREE.Matrix4();
const sample:BridgeSample={height:0,along:0,pitch:0,velocity:0};
const translate=new THREE.Matrix4(),rotate=new THREE.Matrix4();

export class RopeBridgeSpan {
  readonly start:THREE.Vector3;
  readonly end:THREE.Vector3;
  readonly direction:THREE.Vector3;
  readonly right:THREE.Vector3;
  readonly physics:RopeBridgePhysics;
  readonly loads=new Map<object,BridgeLoad>();
  constructor(anchors:BridgeAnchors,readonly gain=1){
    this.start=new THREE.Vector3(...anchors[0]);this.end=new THREE.Vector3(...anchors[1]);
    this.direction=this.end.clone().sub(this.start).setY(0);const length=this.direction.length();
    this.direction.divideScalar(length);this.right=new THREE.Vector3(-this.direction.z,0,this.direction.x);
    this.physics=new RopeBridgePhysics(length);
  }
  distance(world:THREE.Vector3):number{return p.copy(world).sub(this.start).dot(this.direction);}
  press(actor:object,world:THREE.Vector3):void {
    const distance=this.distance(world);
    if(distance<0||distance>this.physics.length)return;
    this.loads.set(actor,{distance,across:p.copy(world).sub(this.start).dot(this.right)});
  }
  /** A rigid board rotates about its local place on the suspended centreline.
   * No mesh simplification, global deck scaling, roll or invented wind cycle. */
  transform(distance:number,out:THREE.Matrix4):THREE.Matrix4 {
    this.physics.sample(distance,sample);
    const t=THREE.MathUtils.clamp(distance/this.physics.length,0,1);
    p.copy(this.start).lerp(this.end,t);
    const slope=(this.end.y-this.start.y)/this.physics.length;
    const pitch=Math.atan(slope+Math.tan(sample.pitch)*this.gain)-Math.atan(slope);
    translate.makeTranslation(-p.x,-p.y,-p.z);
    rotate.makeRotationAxis(this.right,pitch);
    out.makeTranslation(p.x+this.direction.x*sample.along*this.gain,p.y+sample.height*this.gain,
      p.z+this.direction.z*sample.along*this.gain).multiply(rotate).multiply(translate);
    return out;
  }
}
interface Pose { object:THREE.Object3D; base:THREE.Matrix4; inverseParent:THREE.Matrix4; distance:number; span:RopeBridgeSpan; }
interface Instances {mesh:THREE.InstancedMesh; base:THREE.Matrix4[]; world:THREE.Matrix4; inverse:THREE.Matrix4; distances:number[]; span:RopeBridgeSpan;}
interface Deck {mesh:THREE.Mesh;geometry:THREE.BufferGeometry;colliders:THREE.Mesh[];span:RopeBridgeSpan;}
interface Contact {span:RopeBridgeSpan;previous:THREE.Matrix4;current:THREE.Matrix4;owner:THREE.Mesh;}
interface Edge {rail:Rail;owner:THREE.Mesh;rest:THREE.Matrix4;points:THREE.Vector3[];span:RopeBridgeSpan;}
interface Rider {mesh:THREE.Object3D|null;velocity:number;slam:boolean;position:THREE.Vector3;carried:number;}

/** Creaky wood is contact foley in Jak's effect-control.gc, not an idle
 * oscillation loop. Both feet and landings use the existing sound bus. */
export const ropeBridgeContacts=new WeakMap<THREE.Object3D,{step(side:'left'|'right',speed:number):void}>();

export class RopeBridges {
  readonly spans:RopeBridgeSpan[]=[];
  readonly edges:Edge[]=[];
  private readonly byAnchors=new Map<string,RopeBridgeSpan>();
  private readonly decks:Deck[]=[];
  private readonly poses:Pose[]=[];
  private readonly instances:Instances[]=[];
  private readonly cables:{span:RopeBridgeSpan;update:()=>void}[]=[];
  private readonly contacts=new WeakMap<THREE.Object3D,Contact>();
  private riders=new WeakMap<object,Rider>();
  private ground:THREE.Mesh[]=[];
  private tick=0;
  private readonly cargo:{crate:Crate;span:RopeBridgeSpan;position:THREE.Vector3;box:THREE.Box3;groundY:number;distance:number}[]=[];
  bindCrates(crates:Crate[]):void {
    const ray=new THREE.Raycaster();ray.ray.direction.set(0,-1,0);ray.far=.5;
    for(const crate of crates){
      ray.ray.origin.copy(crate.mesh.position).setY(crate.box.min.y+.2);
      const hit=ray.intersectObjects(this.ground,false).find(h=>this.contacts.has(h.object));
      if(!hit)continue;
      const span=this.contacts.get(hit.object)!.span;
      this.cargo.push({crate,span,position:crate.mesh.position.clone(),box:crate.box.clone(),groundY:crate.mesh.userData.groundBaseY??crate.box.min.y,distance:span.distance(crate.mesh.position)});
    }
  }
  updateCrates():void {
    for(const {crate,span,position,box,groundY,distance} of this.cargo){
      if(!crate.alive||crate.pending)continue;
      const pose=span.physics.sample(distance);q.copy(span.direction).multiplyScalar(pose.along*span.gain);q.y=pose.height*span.gain;
      crate.mesh.position.copy(position).add(q);crate.box.copy(box).translate(q);
      crate.mesh.userData.baseY=crate.mesh.position.y;crate.mesh.userData.groundBaseY=groundY+q.y;
    }
  }
  pressEdge(rail:Rail,position:THREE.Vector3,rider:object=rail):void {
    const edge=this.edges.find(e=>e.rail===rail);edge?.span.press(rider,position);
  }
  readonly diagnostics={decks:0,boards:0,landings:0,steps:0,carried:0};
  span(anchors:BridgeAnchors,gain=1):RopeBridgeSpan {
    const key=JSON.stringify(anchors);let span=this.byAnchors.get(key);
    if(!span){span=new RopeBridgeSpan(anchors,gain);this.byAnchors.set(key,span);this.spans.push(span);}
    return span;
  }
  bind(data:CustomLevelData,root:THREE.Group,ground:THREE.Mesh[]):void {
    this.ground=ground;root.updateMatrixWorld(true);
    const native=new Set(ground);
    for(const object of [...root.children]){
      const c=data.components[object.userData.editorIdx];
      if(!c?.bridgeSpan||c.t==='rope'||object.userData.assetBatchRoot)continue;
      const span=this.span(c.bridgeSpan);
      if(!native.has(object as THREE.Mesh))object.traverse(child=>{child.userData.solidSurface='none';});
      const rope=braidedRopeOwners.get(object);
      if(rope){
        const rest=object.matrixWorld.clone(),inverse=rest.clone().invert(),length=rope.len;
        this.cables.push({span,update:()=>rope.update((d,out)=>{
          out.set(0,0,length/2-d).applyMatrix4(rest);
          const s=span.distance(out),pose=span.physics.sample(s);
          out.addScaledVector(span.direction,pose.along*span.gain);out.y+=pose.height*span.gain;return out.applyMatrix4(inverse);
        })});
      }else if(c.nm==='Long escape bridge cable'&&(object as THREE.Mesh).isMesh){
        const mesh=object as THREE.Mesh,geometry=mesh.geometry,positions=geometry.getAttribute('position');
        const rest=Array.from(positions.array),world=mesh.matrixWorld.clone(),inverse=world.clone().invert();
        this.cables.push({span,update:()=>{
          for(let i=0;i<positions.count;i++){
            q.fromArray(rest,i*3).applyMatrix4(world);const s=span.distance(q),pose=span.physics.sample(s);
            q.addScaledVector(span.direction,pose.along*span.gain);q.y+=pose.height*span.gain;q.applyMatrix4(inverse);
            positions.setXYZ(i,q.x,q.y,q.z);
          }
          positions.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
        }});
      }else if((object as THREE.Mesh).isMesh&&native.has(object as THREE.Mesh)){
        this.bindDeck(object as THREE.Mesh,c,span);
      }else this.bindPose(object,span);
    }
    this.diagnostics.decks=this.decks.length;
    if(this.spans.length)void sfx.prepare(['bridgeStepLeft','bridgeStepRight','bridgeLand']);
  }
  private bindPose(object:THREE.Object3D,span:RopeBridgeSpan):void {
    object.updateWorldMatrix(true,false);
    const base=object.matrixWorld.clone();
    // Baked authored cable segments carry their vertices in world space.
    if((object as THREE.Mesh).isMesh){const mesh=object as THREE.Mesh;mesh.geometry.computeBoundingBox();mesh.geometry.boundingBox!.getCenter(q).applyMatrix4(base);}
    else q.setFromMatrixPosition(base);
    const distance=span.distance(q);
    this.poses.push({object,base,inverseParent:object.parent!.matrixWorld.clone().invert(),distance,span});
    object.matrixAutoUpdate=false;object.userData.solidDynamic=true;
  }
  private bindDeck(mesh:THREE.Mesh,c:CustomComponent,span:RopeBridgeSpan):void {
    const geometry=mesh.geometry,rest=mesh.matrixWorld.clone(),inverse=rest.clone().invert();
    const edges=c.edgeGrinding===false?[]:joinSurfaceBoundaryEdges(surfaceBoundaryEdges(mesh));
    for(const path of edges){
      // Subdivide the original perimeter for its deformation, never make the
      // internal collision strips into new grindable seams.
      const points:THREE.Vector3[]=[];
      for(let i=1;i<path.length;i++){
        const n=Math.max(1,Math.ceil(path[i].distanceTo(path[i-1])/.5));
        for(let j=0;j<n;j++)points.push(path[i-1].clone().lerp(path[i],j/n));
      }
      points.push(path[path.length-1].clone());
      const rail=new Rail(points.map(v=>v.clone().addScaledVector(UP,.05)),false);
      this.edges.push({rail,owner:mesh,rest:inverse.clone(),points,span});
    }
    const positions=geometry.getAttribute('position'),index=geometry.index;
    let lo=Infinity,hi=-Infinity;
    for(let i=0;i<positions.count;i++){q.fromBufferAttribute(positions,i).applyMatrix4(rest);const s=span.distance(q);lo=Math.min(lo,s);hi=Math.max(hi,s);}
    const n=Math.max(1,Math.min(320,Math.ceil((hi-lo)/.58))),width=(hi-lo)/n,colliders:THREE.Mesh[]=[];
    // Clip existing solid triangles into rigid board-sized strips. This keeps
    // angled decks, their thickness, ragged outline and authored gaps exact.
    for(let strip=0;strip<n;strip++){
      const start=lo+strip*width,end=start+width,vertices:number[]=[],uvs:number[]=[],colors:number[]=[],groups:{start:number;count:number;materialIndex:number}[]=[];
      for(let i=0;i<(index?.count??positions.count);i+=3){
        let poly=Array.from({length:3},(_,k)=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+k):i+k).applyMatrix4(rest));
        const triangle=[...poly],ids=[0,1,2].map(k=>index?index.getX(i+k):i+k),bary=new THREE.Vector3();
        const first=vertices.length/3;
        for(const [cut,sign] of [[start-(strip? .006:0),1],[end+(strip<n-1?.006:0),-1]]){
          const clipped:THREE.Vector3[]=[];
          for(let j=0;j<poly.length;j++){
            const a=poly[j],b=poly[(j+1)%poly.length],da=(span.distance(a)-cut)*sign,db=(span.distance(b)-cut)*sign;
            if(da>=-1e-7)clipped.push(a);
            if((da>=0)!==(db>=0))clipped.push(a.clone().lerp(b,da/(da-db)));
          }
          poly=clipped;
        }
        for(let j=1;j<poly.length-1;j++)for(const v of [poly[0],poly[j],poly[j+1]]){
          vertices.push(v.x,v.y,v.z);THREE.Triangle.getBarycoord(v,triangle[0],triangle[1],triangle[2],bary);
          const uv=geometry.getAttribute('uv'),color=geometry.getAttribute('color');
          if(uv)for(let axis=0;axis<2;axis++)uvs.push(ids.reduce((sum,id,k)=>sum+uv.getComponent(id,axis)*bary.getComponent(k),0));
          if(color)for(let axis=0;axis<3;axis++)colors.push(ids.reduce((sum,id,k)=>sum+color.getComponent(id,axis)*bary.getComponent(k),0));
        }
        const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count);
        if(group&&vertices.length/3>first)groups.push({start:first,count:vertices.length/3-first,materialIndex:group.materialIndex??0});
      }
      if(!vertices.length)continue;
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
      if(uvs.length)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      if(colors.length)g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.groups=groups;
      g.applyMatrix4(inverse);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
      const board=new THREE.Mesh(g,mesh.material);board.name=mesh.name;board.matrixAutoUpdate=false;
      board.userData={...mesh.userData,bridgeBoard:true,solidDynamic:true,edgeGrinding:false};
      delete board.userData.carlisleTimberDeck;delete board.userData.carlisleTimberDressed;
      mesh.add(board);colliders.push(board);this.ground.push(board);
      this.poses.push({object:board,base:rest.clone(),inverseParent:inverse.clone(),distance:(start+end)/2,span});
      board.updateWorldMatrix(true,false);
      this.contacts.set(board,{span,owner:mesh,previous:board.matrixWorld.clone(),current:board.matrixWorld.clone()});
      ropeBridgeContacts.set(board,{step:(side,speed)=>{
        this.diagnostics.steps++;sfx.play(side==='left'?'bridgeStepLeft':'bridgeStepRight',.26+.15*Math.min(1,speed),1,.025);
      }});
    }
    this.diagnostics.boards+=colliders.length;
    mesh.traverse(child=>{
      const instance=child as THREE.InstancedMesh;
      if(child!==mesh&&!child.userData.bridgeBoard)child.userData.solidSurface='none';
      if(!instance.isInstancedMesh)return;
      instance.updateWorldMatrix(true,false);
      const base:THREE.Matrix4[]=[],distances:number[]=[];
      for(let i=0;i<instance.count;i++){
        instance.getMatrixAt(i,matrix);base.push(matrix.clone());
        q.setFromMatrixPosition(matrix).applyMatrix4(instance.matrixWorld);distances.push(span.distance(q));
      }
      this.instances.push({mesh:instance,base,distances,world:instance.matrixWorld.clone(),inverse:instance.matrixWorld.clone().invert(),span});
      instance.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    });
    // The original mesh keeps ownership, its art and collapse lifecycle.
    // Only its former rigid contact geometry is replaced by the board strips.
    mesh.geometry=new THREE.BufferGeometry();mesh.userData.bridgeDeck=true;
    this.decks.push({mesh,geometry,colliders,span});
  }
  carry(actor:object,mesh:THREE.Object3D|undefined,position:THREE.Vector3):void {
    if(!mesh)return;const contact=this.contacts.get(mesh),rider=this.riders.get(actor);
    if(!contact||!rider||rider.carried===this.tick||!this.ground.includes(contact.owner))return;
    matrix.copy(contact.previous).invert();position.applyMatrix4(matrix).applyMatrix4(contact.current);
    rider.carried=this.tick;this.diagnostics.carried++;
  }
  observe(actor:object,mesh:THREE.Object3D|null,position:THREE.Vector3,verticalVelocity:number,slam:boolean):void {
    const contact=mesh?this.contacts.get(mesh):undefined,previous=this.riders.get(actor);
    if(contact&&this.ground.includes(contact.owner)){
      contact.span.press(actor,position);
      if(previous&&!previous.mesh&&previous.position.distanceTo(position)<3){
        const speed=Math.max(0,-previous.velocity);
        if(contact.span.physics.impact(contact.span.distance(position),speed,previous.slam)){
          this.diagnostics.landings++;sfx.play('bridgeLand',Math.min(.65,.3+speed*.016),1,.035);
        }
      }
    }
    this.riders.set(actor,{mesh:contact?mesh:null,velocity:verticalVelocity,slam,position:position.clone(),carried:previous?.carried??-1});
  }
  update(dt:number):void {
    this.tick++;
    const changed=new Set<RopeBridgeSpan>();
    for(const span of this.spans){if(span.physics.update(dt,[...span.loads.values()]))changed.add(span);span.loads.clear();}
    for(const deck of this.decks){
      const active=this.ground.includes(deck.mesh);
      for(const board of deck.colliders){
        const index=this.ground.indexOf(board);
        if(active&&index<0)this.ground.push(board);else if(!active&&index>=0)this.ground.splice(index,1);
        const contact=this.contacts.get(board)!;contact.previous.copy(contact.current);
      }
    }
    this.apply(changed);
    for(const deck of this.decks)for(const board of deck.colliders){board.updateWorldMatrix(true,false);this.contacts.get(board)!.current.copy(board.matrixWorld);}
  }
  private apply(changed:Set<RopeBridgeSpan>):void {
    for(const binding of this.poses){
      if(!changed.has(binding.span))continue;
      binding.span.transform(binding.distance,delta);
      binding.object.matrix.copy(binding.inverseParent).multiply(delta).multiply(binding.base);
      binding.object.matrixWorldNeedsUpdate=true;
    }
    for(const binding of this.instances){
      if(!changed.has(binding.span))continue;
      binding.base.forEach((base,i)=>{
        binding.span.transform(binding.distances[i],delta);
        matrix.copy(binding.inverse).multiply(delta).multiply(binding.world).multiply(base);binding.mesh.setMatrixAt(i,matrix);
      });
      binding.mesh.instanceMatrix.needsUpdate=true;binding.mesh.computeBoundingBox();binding.mesh.computeBoundingSphere();
    }
    for(const cable of this.cables)if(changed.has(cable.span))cable.update();
    for(const edge of this.edges){
      edge.rail.grindable=this.ground.includes(edge.owner);
      if(!changed.has(edge.span)&&edge.owner.userData.crumbleId===undefined)continue;
      edge.owner.updateWorldMatrix(true,false);matrix.copy(edge.owner.matrixWorld).multiply(edge.rest);
      edge.points.forEach((point,i)=>{
        edge.span.transform(edge.span.distance(point),delta);edge.rail.points[i].copy(point).applyMatrix4(delta).applyMatrix4(matrix).addScaledVector(UP,.05);
      });edge.rail.rebake();
    }
  }
  reset():void {
    for(const span of this.spans){span.physics.reset();span.loads.clear();}
    this.riders=new WeakMap();this.apply(new Set(this.spans));this.update(0);this.updateCrates();
    for(const deck of this.decks)for(const board of deck.colliders){const c=this.contacts.get(board)!;c.previous.copy(c.current);}
  }
  dispose():void {
    // Level's normal ownership traversal disposes restored source geometry
    // and all proxy geometry/materials exactly once.
    for(const deck of this.decks){deck.mesh.geometry.dispose();deck.mesh.geometry=deck.geometry;for(const board of deck.colliders)ropeBridgeContacts.delete(board);}
    this.riders=new WeakMap();
  }
}
