import * as THREE from 'three';
import {createEcoPuffGeometry} from './greenEcoFire';
import {ParticleMotion,type LabParticle} from './jak-lab/particleMotion';
import {JAK_TORCH_GROUP,JAK_TORCH_PARTICLES} from './jakTorchSource.generated';

const CAPACITY=256,UNIT=1/4096;
const definitions=new Map(JAK_TORCH_PARTICLES.map(part=>[part.id,part]));
const vertexShader=/* glsl */`
  attribute vec4 puffProfile;
  attribute vec3 centre;
  attribute vec2 size;
  attribute vec4 rgba;
  attribute float roll;
  varying vec4 puffColor;
  #include <fog_pars_vertex>
  void main(){
    float c=cos(roll),s=sin(roll);
    vec2 offset=mat2(c,s,-s,c)*(position.xy*size);
    vec4 mvPosition=modelViewMatrix*vec4(centre,1.0);
    mvPosition.xy+=offset*length(modelMatrix[0].xyz);
    gl_Position=projectionMatrix*mvPosition;
    puffColor=rgba*puffProfile*vec4(2.0/255.0,2.0/255.0,2.0/255.0,4.0/255.0);
    #include <fog_vertex>
  }
`;
const fragmentShader=/* glsl */`
  varying vec4 puffColor;
  #include <fog_pars_fragment>
  void main(){
    if(puffColor.a<.016)discard;
    gl_FragColor=puffColor;
    #ifdef USE_FOG
      #ifdef FOG_EXP2
        float fogFactor=1.0-exp(-fogDensity*fogDensity*vFogDepth*vFogDepth);
      #else
        float fogFactor=smoothstep(fogNear,fogFar,vFogDepth);
      #endif
      // Fog retires flame coverage rather than adding another layer of fog.
      gl_FragColor.a*=1.0-fogFactor;
    #endif
  }
`;

class TorchBatch {
  readonly geometry=createEcoPuffGeometry('bigpuff');
  readonly material:THREE.ShaderMaterial;
  readonly mesh:THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  readonly positions=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*3),3).setUsage(THREE.DynamicDrawUsage);
  readonly sizes=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*2),2).setUsage(THREE.DynamicDrawUsage);
  readonly colors=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY*4),4).setUsage(THREE.DynamicDrawUsage);
  readonly rolls=new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY),1).setUsage(THREE.DynamicDrawUsage);
  readonly bounds=new THREE.Box3();
  private readonly corner=new THREE.Vector3();
  count=0;
  constructor(additive:boolean){
    this.material=new THREE.ShaderMaterial({vertexShader,fragmentShader,
      uniforms:THREE.UniformsUtils.clone(THREE.UniformsLib.fog),fog:true,
      transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,
      blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,toneMapped:false,forceSinglePass:true});
    this.material.name='Jak torch · Gouraud puffs';
    this.material.userData.gouraud=true;
    for(const [name,attribute]of Object.entries({centre:this.positions,size:this.sizes,rgba:this.colors,roll:this.rolls}))
      this.geometry.setAttribute(name,attribute);
    this.geometry.boundingSphere=new THREE.Sphere();
    this.mesh=new THREE.Mesh(this.geometry,this.material);
    this.mesh.name=additive?'Jak torch flame':'Jak torch cooling puffs';
    this.mesh.renderOrder=additive?5:4;
  }
  write(p:LabParticle,burn:number,cool:boolean){
    const v=p.values;if(!p.alive||!p.texture||v.a<=0||v['scale-x']<=0||v['scale-y']<=0)return;
    const i=this.count++,x=p.position.x*UNIT,y=p.position.y*UNIT,z=p.position.z*UNIT;
    const width=v['scale-x']*UNIT,height=v['scale-y']*UNIT,radius=Math.hypot(width,height)/2;
    this.positions.setXYZ(i,x,y,z);this.sizes.setXY(i,width,height);
    // Retain the phase-pad's blue/orange team cue; ordinary torches keep
    // the source RGB values, including its separate cooling layer.
    const red=v.r??0,green=v.g??0,blue=v.b??0;
    this.colors.setXYZW(i,cool?blue*.7:red,cool?Math.max(green,red*.58):green,cool?red:blue,v.a*burn);
    this.rolls.setX(i,(v['rot-z']??0)*Math.PI*2/65536);
    this.bounds.expandByPoint(this.corner.set(x-radius,y-radius,z-radius));
    this.bounds.expandByPoint(this.corner.set(x+radius,y+radius,z+radius));
  }
  upload(){
    this.geometry.instanceCount=this.count;this.mesh.visible=this.count>0;
    if(!this.count)return;
    this.bounds.getBoundingSphere(this.geometry.boundingSphere!);
    for(const a of [this.positions,this.sizes,this.colors,this.rolls]){
      a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;
    }
  }
}

/** Original Jak torch launch graph on the same texture-free puffs as green eco.
 * Two instanced draws preserve its additive flame and normal cooling layer.
 * All particles live under the torch mount, including movers and rotated pads;
 * billboards face each real render camera without advancing the clock twice. */
export class JakTorchFire {
  readonly root=new THREE.Group();
  readonly motion:ParticleMotion;
  private readonly batches=[new TorchBatch(false),new TorchBatch(true)];
  readonly meshes=this.batches.map(batch=>batch.mesh);
  constructor(scale=1,readonly cool=false,seed=1){
    this.root.name='Jak torch fire';this.root.scale.setScalar(.42*scale);
    this.root.userData.jakTorchSource=JAK_TORCH_GROUP.name;
    this.root.add(...this.meshes);
    this.motion=new ParticleMotion(JAK_TORCH_GROUP,definitions,CAPACITY,seed);
    // A placed torch is already burning when its level is revealed.
    for(let i=0;i<90;i++)this.motion.update(1/60);
    this.update(0,1);
  }
  update(dt:number,burn:number){
    const strength=THREE.MathUtils.clamp(burn,0,1);
    this.motion.hostEmission=strength>.03?'held':'off';
    if(Number.isFinite(dt)&&dt>0)this.motion.update(Math.min(dt,.1));
    for(const batch of this.batches){batch.count=0;batch.bounds.makeEmpty();}
    if(strength>.03)for(const p of this.motion.particles)
      this.batches[p.blend==='additive'?1:0].write(p,strength,this.cool);
    for(const batch of this.batches)batch.upload();
  }
  get diagnostics(){return {source:JAK_TORCH_GROUP.name,particles:this.batches.reduce((n,b)=>n+b.count,0),
    clock:this.motion.clock,dropped:this.motion.dropped,capacity:CAPACITY,
    draws:this.batches.filter(b=>b.count>0).length,textures:0};}
  dispose(){for(const b of this.batches){b.geometry.dispose();b.material.dispose();}this.root.removeFromParent();}
}
