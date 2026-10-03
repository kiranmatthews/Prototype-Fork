import * as THREE from 'three';
import { Rail } from '../rails';
import { applyUnitySandMetricUvs } from '../unitySandMaterial';
import { characterElasticityAmplitudes } from '../animation/elasticity';
import { enemyElasticPulse } from '../enemies/elasticity';

export interface ChiefPhaseGeometryInstall {
  rails: Rail[];
  groundMeshes: THREE.Mesh[];
  /** Reuse the Level's MatrixRex sand, including its owned texture wrappers. */
  sandMaterial?: THREE.Material;
}
export interface ChiefRampSpec {
  /** Centre of the launch lip. The toe lies `length` metres in front (+Z). */
  lip?: THREE.Vector3;
  length?: number;
  width?: number;
  rise?: number;
}
const clamp = THREE.MathUtils.clamp;
const ease = (n:number):number => {const t=clamp(n,0,1);return t*t*(3-2*t);};
const TONGUE_SEGMENTS = 24, TONGUE_SIDES = 8, RAMP_ROWS = 10, RAMP_COLUMNS = 3;
const UP = new THREE.Vector3(0,1,0);

/** Transient encounter geometry built with production Rail and ordinary ramp
 * collision. A tongue grind is a real rail contact; the sand kicker launches
 * through the authored movement model, with no velocity/position overrides.
 * No enclosing character/skeleton scale is changed by either animation. */
export class ChiefPhaseGeometry {
  readonly root = new THREE.Group();
  readonly tongueRail: Rail;
  readonly tongueMesh: THREE.Mesh;
  readonly sandRamp: THREE.Mesh;
  private readonly mouthOpening: THREE.Mesh;
  readonly tongueEntry = new THREE.Vector3(0,.66,-4);
  readonly tongueMouth = new THREE.Vector3(0,6.4,-23);
  readonly launchPoint = new THREE.Vector3(0,4.1,-18);
  readonly launchZone = new THREE.Box3();
  readonly rampToe = new THREE.Vector3(0,0,-5);
  readonly rampFacing = new THREE.Vector3(0,0,-1);
  readonly requiredSpeed = 9.5;
  private installed: ChiefPhaseGeometryInstall | null = null;
  private readonly ownedGeometries = new Set<THREE.BufferGeometry>();
  private readonly ownedMaterials = new Set<THREE.Material>();
  private readonly tongueCentres = Array.from({length:TONGUE_SEGMENTS+1},()=>new THREE.Vector3());
  private readonly fullTongue = Array.from({length:TONGUE_SEGMENTS+1},()=>new THREE.Vector3());
  private readonly rampRest: Float32Array;
  private readonly rampVertexProgress: number[] = [];
  private readonly sandDust: THREE.InstancedMesh;
  private readonly dustTransform = new THREE.Object3D();
  private readonly defaultSandMaterial: THREE.MeshLambertMaterial;
  private readonly rampSpec: Required<ChiefRampSpec>;
  private disposed = false;
  private tongueProgressValue = 0;
  private rampProgressValue = 0;
  constructor(parent:THREE.Object3D, options:ChiefRampSpec={}) {
    this.root.name='Chief tongue rail and formed sand kicker';parent.add(this.root);
    this.rampSpec={lip:options.lip?.clone()??this.launchPoint.clone(),length:options.length??13,width:options.width??6.4,rise:options.rise??4.1};
    this.launchPoint.copy(this.rampSpec.lip);this.launchPoint.y=this.rampSpec.rise;
    this.rampToe.copy(this.launchPoint).add(new THREE.Vector3(0,-this.rampSpec.rise,this.rampSpec.length));
    this.launchZone.set(new THREE.Vector3(-this.rampSpec.width*.5,0,this.launchPoint.z-.35),
      new THREE.Vector3(this.rampSpec.width*.5,this.rampSpec.rise+.9,this.launchPoint.z+1.5));
    this.launchZone.translate(new THREE.Vector3(this.launchPoint.x,0,0));
    this.tongueRail=new Rail(this.fullTongue,false);this.tongueRail.object.name='Crab chief tongue · real uphill grind';this.tongueRail.grindable=false;
    this.root.add(this.tongueRail.object);this.tongueRail.object.visible=false;
    // Rail(false) currently owns no render resources. Register any future
    // visual descendants explicitly, so this encounter always owns cleanup.
    this.tongueRail.object.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      this.ownedGeometries.add(mesh.geometry);
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])this.ownedMaterials.add(material);
    });
    const tongueGeometry=this.makeTongueGeometry();
    const tongueMaterial=new THREE.MeshLambertMaterial({color:0xffffff,vertexColors:true,emissive:0x310d18,emissiveIntensity:.13});
    this.ownedMaterials.add(tongueMaterial);
    this.tongueMesh=new THREE.Mesh(tongueGeometry,tongueMaterial);this.tongueMesh.name='Unfurling coral-pink tongue';
    this.tongueMesh.castShadow=true;this.tongueMesh.receiveShadow=true;this.tongueMesh.frustumCulled=false;this.root.add(this.tongueMesh);
    // A shallow, dark oral recess sits behind the actual tongue at the
    // generated model's closed lip seam. It opens locally as the tongue
    // unfurls; the Meshy face, head and enclosing actor retain their scales.
    const mouthGeometry=new THREE.SphereGeometry(1,12,6),mouthMaterial=new THREE.MeshLambertMaterial({color:0x2c1020});
    this.ownedGeometries.add(mouthGeometry);this.ownedMaterials.add(mouthMaterial);
    this.mouthOpening=new THREE.Mesh(mouthGeometry,mouthMaterial);this.mouthOpening.name='Chief oral recess behind unfurled tongue';this.root.add(this.mouthOpening);
    this.defaultSandMaterial=new THREE.MeshLambertMaterial({color:0xd7b685});this.ownedMaterials.add(this.defaultSandMaterial);
    const rampGeometry=this.makeRampGeometry();
    this.rampRest=new Float32Array(rampGeometry.getAttribute('position').array);
    this.sandRamp=new THREE.Mesh(rampGeometry,this.defaultSandMaterial);this.sandRamp.name='Chief formed sand skating ramp';
    this.sandRamp.userData.vert=false;this.sandRamp.userData.bossRamp=true;this.sandRamp.userData.texKind='sand';
    this.sandRamp.castShadow=true;this.sandRamp.receiveShadow=true;this.sandRamp.frustumCulled=false;this.root.add(this.sandRamp);
    const dustGeometry=new THREE.IcosahedronGeometry(.12,0),dustMaterial=new THREE.MeshLambertMaterial({color:0xe7c796});
    this.ownedGeometries.add(dustGeometry);this.ownedMaterials.add(dustMaterial);
    this.sandDust=new THREE.InstancedMesh(dustGeometry,dustMaterial,28);this.sandDust.name='Sand rising around the kicker';this.sandDust.frustumCulled=false;this.root.add(this.sandDust);
    this.reset();
  }
  /** Install once after the encounter is constructed, retaining the actual
   * Level arrays. The forming ramp is never a hidden raycast floor. */
  install(target:ChiefPhaseGeometryInstall):void {
    if(this.disposed)throw new Error('Cannot install disposed chief geometry');
    if(this.installed&&this.installed!==target)this.uninstall();
    this.installed=target;
    if(!target.rails.includes(this.tongueRail))target.rails.push(this.tongueRail);
    if(target.sandMaterial&&this.sandRamp.material===this.defaultSandMaterial){
      // Shared texture ownership stays with Level. A shader-bearing material's
      // onBeforeCompile function is intentionally retained by the clone.
      const material=target.sandMaterial.clone();material.onBeforeCompile=target.sandMaterial.onBeforeCompile;
      material.customProgramCacheKey=target.sandMaterial.customProgramCacheKey.bind(material);
      material.name='Chief ramp · existing MatrixRex sand';this.ownedMaterials.add(material);this.sandRamp.material=material;
    }
    this.syncRampCollision();
  }
  get tongueActive():boolean {return this.tongueRail.grindable;}
  get rampActive():boolean {return !!this.installed?.groundMeshes.includes(this.sandRamp);}
  get tongueProgress():number {return this.tongueProgressValue;}
  get rampProgress():number {return this.rampProgressValue;}
  /** Unfurl from the live Meshy mouth. `progress` reaches one over ~1 second;
   * the end settles, then the ordinary rail becomes catchable. Entry is low
   * enough for a normal board ollie; the tongue climbs toward the mouth. */
  setTongue(mouth:THREE.Vector3,progress:number,time=0):void {
    if(this.disposed)return;
    this.tongueMouth.copy(mouth);this.tongueEntry.set(mouth.x,.66,Math.max(-7,mouth.z+19));
    const p=clamp(progress,0,1);this.tongueProgressValue=p;this.tongueMesh.visible=p>0;
    const mouthOpen=ease(p/.16);this.mouthOpening.visible=p>0;
    this.mouthOpening.position.copy(mouth).add(new THREE.Vector3(0,-.14,-.025));
    this.mouthOpening.scale.set(.78*mouthOpen,.185*mouthOpen,.07);
    this.tongueRail.grindable=p>=.999;
    const stretch=characterElasticityAmplitudes('jump')[0];
    const curl=(1-p)*1.25+Math.abs(enemyElasticPulse(time,1.1))*stretch*(1-p);
    for(let i=0;i<=TONGUE_SEGMENTS;i++){
      const u=i/TONGUE_SEGMENTS,full=this.fullTongue[i];
      // Gentle authored bends keep every production Rail corner below the
      // sharp-corner exit threshold. Increasing t always climbs to the chief.
      full.copy(this.tongueEntry).lerp(mouth,u);
      full.x+=Math.sin(u*Math.PI*2)*.18*Math.sin(u*Math.PI);
      full.y+=Math.sin(u*Math.PI)*.16;
      const fraction=1-(1-u)*p;
      const visible=this.tongueCentres[i];visible.copy(this.tongueEntry).lerp(mouth,fraction);
      visible.x+=Math.sin(fraction*Math.PI*2)*.18*Math.sin(fraction*Math.PI);
      visible.y+=Math.sin(fraction*Math.PI)*.16+curl*Math.exp(-u*7);
    }
    this.tongueRail.rebake();
    const positions=this.tongueMesh.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<=TONGUE_SEGMENTS;i++){
      const centre=this.tongueCentres[i],next=this.tongueCentres[Math.min(TONGUE_SEGMENTS,i+1)],prev=this.tongueCentres[Math.max(0,i-1)];
      const tangent=next.clone().sub(prev).normalize();if(tangent.lengthSq()<.1)tangent.set(0,0,-1);
      const across=new THREE.Vector3().crossVectors(tangent,UP).normalize(),normal=new THREE.Vector3().crossVectors(across,tangent).normalize();
      const u=i/TONGUE_SEGMENTS,roundTip=.5+.5*clamp(u*12,0,1),width=(.54+.16*u)*roundTip;
      for(let side=0;side<TONGUE_SIDES;side++){
        const angle=side/TONGUE_SIDES*Math.PI*2;
        const v=centre.clone().addScaledVector(across,Math.cos(angle)*width).addScaledVector(normal,Math.sin(angle)*.12-.14);
        positions.setXYZ(i*TONGUE_SIDES+side,v.x,v.y,v.z);
      }
    }
    positions.needsUpdate=true;this.tongueMesh.geometry.computeVertexNormals();this.tongueMesh.geometry.computeBoundingSphere();
    this.root.updateMatrixWorld(true);
  }
  /** Raise each cross-section separately from the same native sand floor.
   * Once formed, the ground mesh remains byte-stable for raycast/BVH safety. */
  setRamp(progress:number,time=0):void {
    if(this.disposed)return;
    const p=clamp(progress,0,1);this.rampProgressValue=p;this.sandRamp.visible=p>0;
    const position=this.sandRamp.geometry.getAttribute('position') as THREE.BufferAttribute;
    for(let i=0;i<position.count;i++){
      const delay=this.rampVertexProgress[i]*.45,formed=ease((p-delay)/(1-delay));
      const restY=this.rampRest[i*3+1];position.setY(i,restY*formed);
    }
    position.needsUpdate=true;this.sandRamp.geometry.computeVertexNormals();this.sandRamp.geometry.computeBoundingSphere();
    this.sandDust.visible=p>0&&p<1;
    for(let i=0;i<this.sandDust.count;i++){
      const fraction=(i*.61803398875)%1,along=(i*.38268343236)%1;
      const rise=1-((time*.9+fraction)%1),swell=Math.sin(p*Math.PI);
      this.dustTransform.position.set(this.launchPoint.x+(fraction-.5)*(this.rampSpec.width+2),
        Math.pow(along,1.45)*this.rampSpec.rise*p+rise*swell*2.4,
        this.rampToe.z-along*this.rampSpec.length);
      this.dustTransform.rotation.set(i+time*.5,time+i*.3,i*.7);
      this.dustTransform.scale.setScalar((.5+rise)*swell);this.dustTransform.updateMatrix();this.sandDust.setMatrixAt(i,this.dustTransform.matrix);
    }
    this.sandDust.instanceMatrix.needsUpdate=true;this.syncRampCollision();this.root.updateMatrixWorld(true);
  }
  hideTongue():void {this.tongueProgressValue=0;this.tongueRail.grindable=false;this.tongueMesh.visible=false;this.mouthOpening.visible=false;}
  hideRamp():void {this.rampProgressValue=0;this.sandRamp.visible=false;this.sandDust.visible=false;this.syncRampCollision();}
  reset():void {this.hideTongue();this.hideRamp();}
  /** Arc coverage, rather than generic charge on unrelated terrace rails. */
  tongueFraction(position:THREE.Vector3):number {return this.tongueRail.closest(position).t/Math.max(.001,this.tongueRail.totalLength);}
  private syncRampCollision():void {
    const meshes=this.installed?.groundMeshes;if(!meshes)return;
    const index=meshes.indexOf(this.sandRamp),active=this.rampProgressValue>=.999;
    if(active&&index<0)meshes.push(this.sandRamp);else if(!active&&index>=0)meshes.splice(index,1);
  }
  private makeTongueGeometry():THREE.BufferGeometry {
    const positions=new Float32Array((TONGUE_SEGMENTS+1)*TONGUE_SIDES*3),colors=new Float32Array(positions.length),indices:number[]=[];
    const dark=new THREE.Color(0xb84566),pink=new THREE.Color(0xf49b9a),body=new THREE.Color(0xdb6d80);
    for(let i=0;i<=TONGUE_SEGMENTS;i++)for(let side=0;side<TONGUE_SIDES;side++){
      const top=Math.sin(side/TONGUE_SIDES*Math.PI*2),color=top>.5?pink:top<-.5?dark:body;
      color.toArray(colors,(i*TONGUE_SIDES+side)*3);
      if(i<TONGUE_SEGMENTS){const a=i*TONGUE_SIDES+side,b=i*TONGUE_SIDES+(side+1)%TONGUE_SIDES,c=a+TONGUE_SIDES,d=b+TONGUE_SIDES;indices.push(a,c,b,b,c,d);}
    }
    for(const [row,reverse] of [[0,false],[TONGUE_SEGMENTS,true]] as const)for(let s=1;s<TONGUE_SIDES-1;s++){
      const base=row*TONGUE_SIDES;indices.push(base,base+(reverse?s+1:s),base+(reverse?s:s+1));
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);this.ownedGeometries.add(geometry);return geometry;
  }
  private makeRampGeometry():THREE.BufferGeometry {
    const vertices:number[]=[],indices:number[]=[],spec=this.rampSpec;
    const vertex=(x:number,y:number,z:number,progress:number):number=>{const index=vertices.length/3;vertices.push(x,y,z);this.rampVertexProgress.push(progress);return index;};
    const width=(u:number)=>spec.width*(1+.18*Math.sin(u*Math.PI));
    for(let row=0;row<=RAMP_ROWS;row++){
      const u=row/RAMP_ROWS,y=Math.pow(u,1.45)*spec.rise;
      for(let column=0;column<=RAMP_COLUMNS;column++){
        const x=column/RAMP_COLUMNS-.5;vertex(spec.lip.x+x*width(u),y,this.rampToe.z-u*spec.length,u);
      }
    }
    for(let row=0;row<RAMP_ROWS;row++)for(let column=0;column<RAMP_COLUMNS;column++){
      const a=row*(RAMP_COLUMNS+1)+column,b=a+1,c=a+RAMP_COLUMNS+1,d=c+1;indices.push(a,b,c,b,d,c);
    }
    // Closed sand skirt below the authored ride surface; no coplanar underlay
    // over the central course, no visual-only slope hiding a flat collider.
    for(const side of [0,RAMP_COLUMNS])for(let row=0;row<RAMP_ROWS;row++){
      const a=row*(RAMP_COLUMNS+1)+side,b=a+RAMP_COLUMNS+1;
      const c=vertex(vertices[a*3],-.06,vertices[a*3+2],row/RAMP_ROWS),d=vertex(vertices[b*3],-.06,vertices[b*3+2],(row+1)/RAMP_ROWS);
      if(side===0)indices.push(a,b,c,c,b,d);else indices.push(a,c,b,b,c,d);
    }
    const lipStart=RAMP_ROWS*(RAMP_COLUMNS+1),a=lipStart,b=lipStart+RAMP_COLUMNS;
    const c=vertex(vertices[a*3],-.06,spec.lip.z,1),d=vertex(vertices[b*3],-.06,spec.lip.z,1);indices.push(a,b,c,b,d,c);
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();applyUnitySandMetricUvs(geometry);this.ownedGeometries.add(geometry);return geometry;
  }
  private uninstall():void {
    if(!this.installed)return;
    const railIndex=this.installed.rails.indexOf(this.tongueRail);if(railIndex>=0)this.installed.rails.splice(railIndex,1);
    const groundIndex=this.installed.groundMeshes.indexOf(this.sandRamp);if(groundIndex>=0)this.installed.groundMeshes.splice(groundIndex,1);
    this.installed=null;
  }
  dispose():void {
    if(this.disposed)return;this.reset();this.uninstall();this.disposed=true;this.root.removeFromParent();this.root.clear();
    for(const geometry of this.ownedGeometries)geometry.dispose();for(const material of this.ownedMaterials)material.dispose();
    this.sandDust.dispose();
  }
}
