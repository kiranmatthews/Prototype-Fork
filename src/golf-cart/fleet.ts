import * as THREE from 'three';
import { GolfCartKit, CART_PALETTES, CART_DIMENSIONS, type GolfCartModel } from './model';
import { GolfDriverKit, DRIVER_STYLES, type DriverStyle } from './driver';
import { GolfCartPhysics, CartAutopilot, CART_PHYSICS, type CartGround, type CartSpawn, type CartObstacle, type CartRoute, type CartInput, type CartPhysicsOptions } from './physics';

export interface FleetOptions {ground:CartGround;spawns:readonly CartSpawn[];routes?:readonly CartRoute[];obstacles?:readonly CartObstacle[];physics?:CartPhysicsOptions}
interface Chip {x:number;y:number;z:number;vx:number;vy:number;vz:number;life:number;spin:number}
/** Fleet owns meshes/materials/drivers; kit buffers are disposed exactly once on unload. */
export class GolfCartFleet {
  readonly root=new THREE.Group();readonly kit=new GolfCartKit();readonly drivers=new GolfDriverKit();readonly models:GolfCartModel[];
  readonly physics:GolfCartPhysics;readonly pilots:CartAutopilot[];readonly driverStyles:DriverStyle[];
  selected=-1;input:CartInput={throttle:0,steer:0,brake:0,handbrake:false};
  private chips:Chip[]=Array.from({length:48},()=>({x:0,y:0,z:0,vx:0,vy:0,vz:0,life:0,spin:0}));
  private chipMesh=new THREE.InstancedMesh(new THREE.BoxGeometry(.08,.035,.13),new THREE.MeshStandardMaterial({color:'#ffe2a4',roughness:.9}),48);
  private nextChip=0;private dummy=new THREE.Object3D();private disposed=false;
  private batches:{mesh:THREE.InstancedMesh;sources:THREE.Mesh[]}[]=[];
  private inverseRoot=new THREE.Matrix4();private instanceMatrix=new THREE.Matrix4();
  constructor(options:FleetOptions){
    this.root.name='GolfCartFleet';this.physics=new GolfCartPhysics(options.ground,options.spawns,options.obstacles,options.physics);
    this.pilots=(options.routes??[]).map(r=>new CartAutopilot(r));this.driverStyles=options.spawns.map((_,i)=>DRIVER_STYLES[i%3]);
    this.models=options.spawns.map((_,i)=>{const model=this.kit.create(CART_PALETTES[i%CART_PALETTES.length]);model.setDriver(this.drivers.create(this.driverStyles[i]));model.root.name=`GolfCart-${i+1}`;model.root.scale.setScalar(this.physics.scale);this.root.add(model.root);return model;});
    // Batch identical component geometry across the fleet, including all wheels.
    // Originals keep their hierarchy for driver sockets/export, on a non-rendered layer.
    const kitGeometry=new Set([...this.kit.parts.map(p=>p.geometry),this.kit.wheel,this.kit.steering]);
    const groups=new Map<THREE.BufferGeometry,THREE.Mesh[]>();
    this.models.forEach(model=>model.root.traverse(o=>{if(o instanceof THREE.Mesh&&kitGeometry.has(o.geometry)){const list=groups.get(o.geometry)??[];list.push(o);groups.set(o.geometry,list);o.layers.set(31);}}));
    groups.forEach((sources,geometry)=>{const material=(sources[0].material as THREE.MeshStandardMaterial).clone();material.color.set('#ffffff');
      const mesh=new THREE.InstancedMesh(geometry,material,sources.length);mesh.name=`Fleet-${sources[0].name}`;mesh.castShadow=sources[0].castShadow;mesh.receiveShadow=true;mesh.frustumCulled=false;mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(mesh);this.batches.push({mesh,sources});});
    this.chipMesh.name='BoundedImpactChips';this.chipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.chipMesh.frustumCulled=false;this.root.add(this.chipMesh);this.present(0);
  }
  setDriver(index:number,style:DriverStyle|null){const previous=this.models[index].setDriver(style?this.drivers.create(style):null);previous?.dispose();if(style)this.driverStyles[index]=style;}
  update(dt:number,control?:(world:GolfCartPhysics)=>void){
    this.physics.advance(dt,control??(world=>{world.carts.forEach((c,i)=>{world.inputs[i]=i===this.selected?this.input:this.pilots[i]?.sample(c,CART_PHYSICS.step)??{throttle:0,steer:0,brake:0,handbrake:false};});}));
    for(const hit of this.physics.impacts){
      const n=Math.min(8,Math.ceil(hit.strength));for(let i=0;i<n;i++){
        const chip=this.chips[this.nextChip++%this.chips.length],a=(this.nextChip*2.39996323)% (Math.PI*2);
        Object.assign(chip,{x:hit.x,y:hit.y,z:hit.z,vx:Math.sin(a)*hit.strength*.24,vy:2+i*.27,vz:Math.cos(a)*hit.strength*.24,life:.8+(i%3)*.2,spin:a});
      }
    }
    this.physics.impacts.length=0;
    this.present(Math.min(dt,.1));
  }
  present(dt:number){
    this.models.forEach((m,i)=>{const c=this.physics.carts[i],angle=c.tumbleAngle;
      // Rotate the whole vehicle, including wheels and seated driver, about its centre.
      // The rounded support envelope keeps the roof/side above the ground during a roll.
      const lift=Math.max(1-Math.cos(angle),.96*Math.abs(Math.sin(angle))+CART_DIMENSIONS.height*Math.max(0,-Math.cos(angle)));
      m.root.position.set(c.x,c.y+lift*this.physics.scale,c.z);m.root.rotation.set(0,c.yaw,angle,'YXZ');m.update({time:this.physics.time,steer:c.steer,roll:c.roll,pitch:c.pitch,impact:c.impact,speed:c.speed,wheelTravel:c.travel/this.physics.scale,suspension:c.wheels,damage:c.damage});});
    this.root.updateMatrixWorld(true);this.inverseRoot.copy(this.root.matrixWorld).invert();
    for(const {mesh,sources} of this.batches){sources.forEach((source,i)=>{let visible=true;for(let o:THREE.Object3D|null=source;o&&o!==this.root;o=o.parent)visible&&=o.visible;
      if(visible)this.instanceMatrix.multiplyMatrices(this.inverseRoot,source.matrixWorld);else this.instanceMatrix.makeScale(0,0,0);
      mesh.setMatrixAt(i,this.instanceMatrix);mesh.setColorAt(i,(source.material as THREE.MeshStandardMaterial).color);
    });mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
    let alive=0;
    this.chips.forEach((p,i)=>{
      if(p.life>0){p.life-=dt;p.vy-=12*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;this.dummy.position.set(p.x,p.y,p.z);this.dummy.rotation.set(p.spin+p.life*6,p.life*8,p.spin);this.dummy.scale.setScalar(Math.min(1,p.life*4));alive++;}
      else this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();this.chipMesh.setMatrixAt(i,this.dummy.matrix);
    });this.chipMesh.visible=alive>0;this.chipMesh.instanceMatrix.needsUpdate=true;
  }
  get stats(){let driverCalls=0;this.models.forEach(m=>m.socket.traverse(o=>{if(o instanceof THREE.Mesh)driverCalls++;}));return {count:this.models.length,scale:this.physics.scale,cartTriangles:this.models[0]?.stats.triangles??0,fleetTriangles:this.models.reduce((n,m)=>n+m.stats.triangles,0),fleetDrawCalls:this.batches.length+driverCalls,geometryBuffers:this.kit.parts.length+2,steps:this.physics.steps,droppedTime:this.physics.droppedTime,activeDebris:this.chips.filter(c=>c.life>0).length};}
  dispose(){if(this.disposed)return;this.disposed=true;this.models.forEach(m=>{m.setDriver(null)?.dispose();m.dispose();});this.batches.forEach(b=>{(b.mesh.material as THREE.Material).dispose();b.mesh.dispose();});this.kit.dispose();this.drivers.dispose();this.chipMesh.geometry.dispose();(this.chipMesh.material as THREE.Material).dispose();this.chipMesh.dispose();this.root.removeFromParent();}
}
