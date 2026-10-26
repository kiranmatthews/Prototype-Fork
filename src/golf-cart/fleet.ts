import * as THREE from 'three';
import { GolfCartKit, CART_PALETTES, CART_DIMENSIONS, type GolfCartModel } from './model';
import { GolfDriverKit, DRIVER_STYLES, type DriverStyle } from './driver';
import { GolfCartPhysics, CartAutopilot, CART_PHYSICS, type CartGround, type CartSpawn, type CartObstacle, type CartRoute, type CartInput, type CartPhysicsOptions, type CartImpact } from './physics';

export interface FleetOptions {damageVisuals?:boolean;onImpact?:(hit:CartImpact)=>void;ground:CartGround;spawns:readonly CartSpawn[];routes?:readonly CartRoute[];obstacles?:readonly CartObstacle[];physics?:CartPhysicsOptions}
export interface FleetPose {x:number;y:number;z:number;yaw:number}
interface Chip {x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;spin:number}
/** Fleet owns meshes/materials/drivers; kit buffers are disposed exactly once on unload. */
export class GolfCartFleet {
  readonly root=new THREE.Group();readonly kit:GolfCartKit;readonly drivers=new GolfDriverKit();readonly models:GolfCartModel[];
  readonly physics:GolfCartPhysics;readonly pilots:CartAutopilot[];readonly driverStyles:DriverStyle[];
  selected=-1;input:CartInput={throttle:0,steer:0,brake:0,handbrake:false};
  private chips:Chip[]=Array.from({length:48},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,spin:0}));
  private chipMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.08,.035,.13),new THREE.MeshStandardMaterial({color:'#ffe2a4',roughness:.9}),48);
  private nextChip=0;private dummy=new THREE.Object3D();private disposed=false;
  private batches:{mesh:THREE.InstancedMesh;sources:{mesh:THREE.Mesh;cart:number}[]}[]=[];
  private visible:boolean[]=[];
  private viewBounds=new THREE.Box2();private viewPoint=new THREE.Vector3();
  private poses:readonly FleetPose[]|undefined;
  private inverseRoot=new THREE.Matrix4();private instanceMatrix=new THREE.Matrix4();
  constructor(private options:FleetOptions){
    this.kit=new GolfCartKit(options.damageVisuals);this.root.name='GolfCartFleet';this.physics=new GolfCartPhysics(options.ground,options.spawns,options.obstacles,options.physics);
    this.pilots=(options.routes??[]).map(r=>new CartAutopilot(r));this.driverStyles=options.spawns.map((_,i)=>DRIVER_STYLES[i%3]);
    this.models=options.spawns.map((_,i)=>{const model=this.kit.create(CART_PALETTES[i%CART_PALETTES.length]);model.setDriver(this.drivers.create(this.driverStyles[i]));model.root.name=`GolfCart-${i+1}`;model.root.scale.setScalar(this.physics.scale);this.root.add(model.root);return model;});
    // Batch identical component geometry across the fleet, including all wheels.
    // Originals keep their hierarchy for driver sockets/export, on a non-rendered layer.
    const kitGeometry=new Set([...this.kit.parts.map(p=>p.geometry),this.kit.wheel,this.kit.steering]);
    const groups=new Map<THREE.BufferGeometry,{mesh:THREE.Mesh;cart:number}[]>();
    this.visible=this.models.map(()=>true);
    this.models.forEach((model,cart)=>model.root.traverse(o=>{if(o instanceof THREE.Mesh&&kitGeometry.has(o.geometry)){const list=groups.get(o.geometry)??[];list.push({mesh:o,cart});groups.set(o.geometry,list);o.layers.set(31);}}));
    groups.forEach((sources,geometry)=>{const material=(sources[0].mesh.material as THREE.MeshStandardMaterial).clone();material.color.set('#ffffff');if(options.damageVisuals)material.emissive.set('#000000');
      const mesh=new THREE.InstancedMesh(geometry,material,sources.length);mesh.name=`Fleet-${sources[0].mesh.name}`;mesh.castShadow=sources[0].mesh.castShadow;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(mesh);this.batches.push({mesh,sources});});
    this.chipMesh.name='BoundedImpactChips';this.chipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.chipMesh.frustumCulled=false;this.root.add(this.chipMesh);this.present(0);
  }
  setDriver(index:number,style:DriverStyle|null){const previous=this.models[index].setDriver(style?this.drivers.create(style):null);previous?.dispose();if(style)this.driverStyles[index]=style;}
  update(dt:number,control?:(world:GolfCartPhysics)=>void,present=true){
    this.physics.advance(dt,control??(world=>{world.carts.forEach((c,i)=>{world.inputs[i]=i===this.selected?this.input:this.pilots[i]?.sample(c,CART_PHYSICS.step)??{throttle:0,steer:0,brake:0,handbrake:false};});}));
    for(const hit of this.physics.impacts){
      this.options.onImpact?.(hit);
      const n=Math.min(8,Math.ceil(hit.strength));for(let i=0;i<n;i++){
        const chip=this.chips[this.nextChip++%this.chips.length],a=(this.nextChip*2.39996323)% (Math.PI*2);
        Object.assign(chip,{x:hit.x,y:hit.y,z:hit.z,vx:Math.sin(a)*hit.strength*.24,vy:2+i*.27,vz:Math.cos(a)*hit.strength*.24,life:.8+(i%3)*.2,spin:a});
      }
    }
    this.physics.impacts.length=0;
    if(present)this.present(Math.min(dt,.1));else this.updateChips(Math.min(dt,.1));
  }
  /** Conservative X/Z bounds retain the complete model in the ocean reflection.
   * No distance-dependent geometry substitutes; hidden carts still simulate. */
  updateView(camera:THREE.Camera){
    this.viewBounds.makeEmpty();
    for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1]){
      this.viewPoint.set(x,y,z).unproject(camera);
      this.viewBounds.min.x=Math.min(this.viewBounds.min.x,this.viewPoint.x);this.viewBounds.max.x=Math.max(this.viewBounds.max.x,this.viewPoint.x);
      this.viewBounds.min.y=Math.min(this.viewBounds.min.y,this.viewPoint.z);this.viewBounds.max.y=Math.max(this.viewBounds.max.y,this.viewPoint.z);
    }
    this.viewBounds.expandByScalar(8*this.physics.scale);
    let changed=false;
    this.models.forEach((m,i)=>{const p=this.poses?.[i]??this.physics.carts[i],b=this.viewBounds;
      const visible=p.x>=b.min.x&&p.x<=b.max.x&&p.z>=b.min.y&&p.z<=b.max.y;
      if(visible!==this.visible[i]){this.visible[i]=visible;changed=true;}m.root.visible=visible;
    });
    if(changed)this.present(0,this.poses);
  }
  isPresented(index:number){return this.visible[index];}
  present(dt:number,poses?:readonly FleetPose[]){
    this.poses=poses;
    this.root.updateWorldMatrix(true,false);this.inverseRoot.copy(this.root.matrixWorld).invert();
    this.models.forEach((m,i)=>{if(!this.visible[i])return;const c=this.physics.carts[i],p=poses?.[i]??c,angle=c.tumbleAngle;
      // Rotate the whole vehicle, wheels and driver around the rounded support envelope.
      const lift=Math.max(1-Math.cos(angle),.96*Math.abs(Math.sin(angle))+(CART_DIMENSIONS.height+this.kit.cabinRise)*Math.max(0,-Math.cos(angle)));
      m.root.position.set(p.x,p.y+lift*this.physics.scale,p.z);m.root.rotation.set(0,p.yaw,angle,'YXZ');m.update({time:this.physics.time,steer:c.steer,roll:c.roll,pitch:c.pitch,impact:c.impact,speed:c.speed,wheelTravel:c.travel/this.physics.scale,suspension:c.wheels,landingCompression:c.landingCompression,damage:c.damage,health:c.health});
      m.root.updateWorldMatrix(false,true);
    });
    for(const {mesh,sources} of this.batches){let count=0,colorsChanged=false;
      for(const {mesh:source,cart} of sources){if(!this.visible[cart])continue;
        let visible=true;for(let o:THREE.Object3D|null=source;o&&o!==this.root;o=o.parent)if(!o.visible){visible=false;break;}
        if(!visible)continue;
        this.instanceMatrix.multiplyMatrices(this.inverseRoot,source.matrixWorld);mesh.setMatrixAt(count,this.instanceMatrix);
        const color=(source.material as THREE.MeshStandardMaterial).color,buffer=mesh.instanceColor;
        if(!buffer||buffer.getX(count)!==Math.fround(color.r)||buffer.getY(count)!==Math.fround(color.g)||buffer.getZ(count)!==Math.fround(color.b)){mesh.setColorAt(count,color);colorsChanged=true;}count++;
      }
      mesh.count=count;mesh.visible=count>0;if(count)mesh.instanceMatrix.needsUpdate=true;if(colorsChanged&&mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
    this.updateChips(dt);
  }
  private updateChips(dt:number){
    let alive=0;
    for(const p of this.chips){
      p.life=Math.max(0,p.life-dt);if(!p.life)continue;
      p.vy-=12*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.spin+p.life*6,p.life*8,p.spin);this.dummy.scale.setScalar(Math.min(1,p.life*4));
      this.dummy.updateMatrix();this.chipMesh.setMatrixAt(alive++,this.dummy.matrix);
    }
    this.chipMesh.count=alive;this.chipMesh.visible=alive>0;if(alive)this.chipMesh.instanceMatrix.needsUpdate=true;
  }
  get stats(){let driverCalls=0;this.models.forEach(m=>m.socket.traverse(o=>{if(o instanceof THREE.Mesh)driverCalls++;}));return {count:this.models.length,presented:this.visible.filter(Boolean).length,scale:this.physics.scale,cartTriangles:this.models[0]?.stats.triangles??0,fleetTriangles:this.models.reduce((n,m)=>n+m.stats.triangles,0),fleetDrawCalls:this.batches.length+driverCalls,geometryBuffers:this.kit.parts.length+2,steps:this.physics.steps,droppedTime:this.physics.droppedTime,activeDebris:this.chips.filter(c=>c.life>0).length};}
  dispose(){if(this.disposed)return;this.disposed=true;this.models.forEach(m=>{m.setDriver(null)?.dispose();m.dispose();});this.batches.forEach(b=>{(b.mesh.material as THREE.Material).dispose();b.mesh.dispose();});this.kit.dispose();this.drivers.dispose();this.chipMesh.geometry.dispose();(this.chipMesh.material as THREE.Material).dispose();this.chipMesh.dispose();this.root.removeFromParent();}
}
