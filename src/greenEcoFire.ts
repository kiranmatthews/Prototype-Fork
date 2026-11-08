import * as THREE from 'three';
import {GreenEcoMotion, ECO_PARTICLE_CAPACITY, type EcoParticle, type EcoSprite} from './greenEcoMotion';

export interface GreenEcoVent {
  position: readonly [number, number, number];
  scale?: number;
  seed?: number;
}
export type GreenEcoRendering = 'gouraud' | 'original';
const KINDS: readonly EcoSprite[] = ['hotdot', 'bigpuff', 'starflash'];
const STEP = 1 / 60;
const vertexShader = /* glsl */`
  attribute vec4 puffProfile;
  attribute vec4 instancePositionSize;
  attribute vec4 instanceRGBA;
  attribute float instanceRoll;
  varying vec4 particleColor;
  varying vec2 particleUV;
  void main() {
    float c = cos(instanceRoll), s = sin(instanceRoll);
    vec2 offset = mat2(c, s, -s, c) * position.xy * instancePositionSize.w;
    vec4 centre = modelViewMatrix * vec4(instancePositionSize.xyz, 1.0);
    centre.xy += offset;
    gl_Position = projectionMatrix * centre;
    // Original PNGs retain PS2 alpha (0..128). OpenGOAL doubles vertex alpha,
    // then doubles the complete texture modulation in its fragment shader.
    particleColor = instanceRGBA * puffProfile * vec4(2.0/255.0, 2.0/255.0, 2.0/255.0, 4.0/255.0);
    particleUV = uv;
  }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D sourceTexture;
  varying vec4 particleColor;
  varying vec2 particleUV;
  void main() {
    vec4 color = particleColor;
    #ifdef SOURCE_TEXTURED
      color *= texture2D(sourceTexture, particleUV);
    #endif
    if (color.a < 0.016) discard;
    gl_FragColor = color;
  }
`;

/** Interpolated-RGBA puff shapes, with no texture, fragment noise or radial mask.
 * Distances are fractions of the source sprite's FULL width, not its radius.
 * Geometry supplies the soft profile; motion and colour come from the port.
 */
function puffGeometry(kind: EcoSprite): THREE.InstancedBufferGeometry {
  const positions: number[] = [], profiles: number[] = [], indices: number[] = [];
  const n = kind === 'starflash' ? 16 : 8;
  const centre = kind === 'bigpuff' ? .9 : 1;
  positions.push(0,0,0); profiles.push(centre,centre,centre,centre*128/255);
  const rings = kind === 'hotdot' ? [.12,.29,.5] : kind === 'bigpuff' ? [.15,.32,.5] : [.06,.5];
  for(let ring=0;ring<rings.length;ring++)for(let i=0;i<n;i++) {
    const angle=i/n*Math.PI*2;
    let radius=rings[ring], gray=1, alpha=0;
    if(kind==='hotdot')alpha=[116/255,30/255,0][ring];
    else if(kind==='bigpuff') {
      radius*=1+.1*Math.sin(angle*3+.6)+.05*Math.cos(angle*5);
      gray=[.86,.38,0][ring]*(1+.11*Math.sin(angle*2-.4));
      alpha=gray*128/255;
    } else {
      // Eight tapered points, with longer horizontal/vertical arms.
      if(ring===1)radius*=i%2 ? .22 : i%4 ? .72 : 1;
      gray=ring===0 ? .96 : 0; alpha=ring===0 ? 128/255 : 0;
    }
    positions.push(Math.cos(angle)*radius,Math.sin(angle)*radius,0);
    profiles.push(gray,gray,gray,alpha);
    const a=1+ring*n+i,b=1+ring*n+(i+1)%n;
    if(ring===0)indices.push(0,a,b);
    else {const c=a-n,d=b-n;indices.push(c,a,b,c,b,d);}
  }
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.flatMap((v,i)=>i%3===2?[]:[v+.5]),2));
  geometry.setAttribute('puffProfile',new THREE.Float32BufferAttribute(profiles,4));
  geometry.setIndex(indices);geometry.instanceCount=0;
  return geometry;
}
function quadGeometry(): THREE.InstancedBufferGeometry {
  const geometry=new THREE.InstancedBufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1],2));
  geometry.setAttribute('puffProfile',new THREE.Float32BufferAttribute(new Array(16).fill(1),4));
  geometry.setIndex([0,1,2,0,2,3]);geometry.instanceCount=0;
  return geometry;
}
function material(textured: boolean): THREE.ShaderMaterial {
  const result=new THREE.ShaderMaterial({vertexShader,fragmentShader,
    defines:textured ? {SOURCE_TEXTURED:1} : {},uniforms:{sourceTexture:{value:null}},
    transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    side:THREE.DoubleSide,toneMapped:false});
  result.forceSinglePass=true;
  return result;
}
class EcoBatch {
  readonly gouraud: THREE.InstancedBufferGeometry;
  readonly original=quadGeometry();
  readonly puffMaterial=material(false);
  readonly sourceMaterial=material(true);
  readonly positions: THREE.InstancedBufferAttribute;
  readonly colors: THREE.InstancedBufferAttribute;
  readonly rolls: THREE.InstancedBufferAttribute;
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  count=0;
  constructor(readonly kind: EcoSprite,capacity: number) {
    this.gouraud=puffGeometry(kind);
    this.positions=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
    this.colors=new THREE.InstancedBufferAttribute(new Float32Array(capacity*4),4).setUsage(THREE.DynamicDrawUsage);
    this.rolls=new THREE.InstancedBufferAttribute(new Float32Array(capacity),1).setUsage(THREE.DynamicDrawUsage);
    for(const geometry of [this.gouraud,this.original]) {
      geometry.setAttribute('instancePositionSize',this.positions);
      geometry.setAttribute('instanceRGBA',this.colors);
      geometry.setAttribute('instanceRoll',this.rolls);
    }
    this.mesh=new THREE.Mesh(this.gouraud,this.puffMaterial);
    this.mesh.name=`Green eco ${kind}`;this.mesh.frustumCulled=false;this.mesh.renderOrder=2;
  }
  write(p: EcoParticle,origin: THREE.Vector3,scale: number): void {
    if(!p.alive || p.size<=0 || p.a<=0)return;
    const i=this.count++;
    this.positions.setXYZW(i,origin.x+p.x*scale,origin.y+p.y*scale,origin.z+p.z*scale,p.size*scale);
    this.colors.setXYZW(i,p.r,p.g,p.b,p.a);this.rolls.setX(i,p.rotation);
  }
  upload(): void {
    this.gouraud.instanceCount=this.original.instanceCount=this.count;
    this.mesh.visible=this.count>0;
    if(!this.count)return;
    for(const attr of [this.positions,this.colors,this.rolls]) {
      attr.clearUpdateRanges();attr.addUpdateRange(0,this.count*attr.itemSize);attr.needsUpdate=true;
    }
  }
  setRendering(mode: GreenEcoRendering): void {
    this.mesh.geometry=mode==='gouraud' ? this.gouraud : this.original;
    this.mesh.material=mode==='gouraud' ? this.puffMaterial : this.sourceMaterial;
  }
  dispose(): void {
    this.gouraud.dispose();this.original.dispose();this.puffMaterial.dispose();this.sourceMaterial.dispose();
    (this.sourceMaterial.uniforms.sourceTexture.value as THREE.Texture | null)?.dispose();
  }
}

/** Source green-vent simulation with swappable textured / Gouraud billboards.
 * Default is texture-free. Original textures are an optional local reference.
 * Update once per render frame. Billboards face each actual render camera,
 * including reflections, without stepping the simulation again.
 */
export class GreenEcoFire {
  readonly root=new THREE.Group();
  enabled=true;
  paused=false;
  private readonly batches: Record<EcoSprite,EcoBatch>;
  private readonly frustum=new THREE.Frustum();
  private readonly projection=new THREE.Matrix4();
  private readonly bounds=new THREE.Sphere();
  private carry=0;
  private visibleVents=0;
  private disposed=false;
  private renderingMode: GreenEcoRendering='gouraud';
  private sourceReady=false;
  private sourceLoading: Promise<void> | null=null;
  private readonly vents;
  constructor(scene: THREE.Object3D,vents: readonly GreenEcoVent[]) {
    this.vents=vents.map((vent,i)=>{
      const scale=vent.scale ?? 1;
      if(!(scale>0 && Number.isFinite(scale)) || !vent.position.every(Number.isFinite))
        throw new RangeError('Green eco vents require finite positions and positive scales');
      return {position:new THREE.Vector3(...vent.position),scale,visible:true,motion:new GreenEcoMotion(vent.seed ?? i+1)};
    });
    const capacity=Math.max(1,vents.length)*(ECO_PARTICLE_CAPACITY+15);
    this.batches={hotdot:new EcoBatch('hotdot',capacity),bigpuff:new EcoBatch('bigpuff',capacity),starflash:new EcoBatch('starflash',capacity)};
    this.root.name='Green eco fire';
    for(const kind of KINDS)this.root.add(this.batches[kind].mesh);
    scene.add(this.root);
  }
  get rendering(): GreenEcoRendering {return this.renderingMode;}
  set rendering(mode: GreenEcoRendering) {
    if(mode==='original' && !this.sourceReady)throw new Error('Load local source textures before selecting Original textures');
    this.renderingMode=mode;
    for(const kind of KINDS)this.batches[kind].setRendering(mode);
  }
  /** Caller supplies a local study endpoint; no game assets are bundled. */
  loadSourceTextures(baseURL: string): Promise<void> {
    if(this.sourceLoading)return this.sourceLoading;
    this.sourceLoading=(async()=>{
      const loader=new THREE.TextureLoader();
      const results=await Promise.allSettled(KINDS.map(kind=>loader.loadAsync(`${baseURL}/${kind}.png`)));
      if(this.disposed || results.some(result=>result.status==='rejected')) {
        for(const result of results)if(result.status==='fulfilled')result.value.dispose();
        this.sourceLoading=null;
        if(!this.disposed)throw new Error('Local green eco textures unavailable');
        return;
      }
      results.forEach((result,i)=>{
        if(result.status!=='fulfilled')return;
        const texture=result.value;
        texture.colorSpace=THREE.NoColorSpace;texture.minFilter=THREE.LinearFilter;
        texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;
        this.batches[KINDS[i]].sourceMaterial.uniforms.sourceTexture.value=texture;
      });
      this.sourceReady=true;
    })();
    return this.sourceLoading;
  }
  update(dt: number,camera: THREE.Camera): void {
    if(this.disposed || !Number.isFinite(dt) || dt<=0)return;
    this.root.visible=this.enabled;
    if(!this.enabled) {
      for(const vent of this.vents)vent.motion.clear();
      for(const kind of KINDS){this.batches[kind].count=0;this.batches[kind].upload();}
      this.carry=0;this.visibleVents=0;return;
    }
    this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);this.visibleVents=0;
    for(const vent of this.vents) {
      this.bounds.center.copy(vent.position);this.bounds.center.y+=5*vent.scale;
      this.bounds.radius=7*vent.scale;
      vent.visible=this.frustum.intersectsSphere(this.bounds);
      if(vent.visible)this.visibleVents++;
    }
    if(!this.paused)this.carry+=Math.min(dt,.1);
    while(this.carry+1e-8>=STEP) {
      this.carry-=STEP;
      for(const vent of this.vents)vent.motion.step(vent.visible);
    }
    for(const kind of KINDS)this.batches[kind].count=0;
    for(const vent of this.vents) {
      // Existing particles retire normally offscreen. Cull whole emitter
      // launches, without distance LOD, density reduction or mesh swaps.
      for(const o of vent.motion.orbiters)this.batches.hotdot.write(o.particle,vent.position,vent.scale);
      for(const p of vent.motion.particles)this.batches[p.kind].write(p,vent.position,vent.scale);
    }
    for(const kind of KINDS)this.batches[kind].upload();
  }
  get diagnostics() {
    let particles=0,batches=0,triangles=0,dropped=0;
    for(const kind of KINDS) {
      const batch=this.batches[kind];particles+=batch.count;
      if(batch.count){batches++;triangles+=batch.count*(batch.mesh.geometry.index!.count/3);}
    }
    for(const vent of this.vents)dropped+=vent.motion.dropped;
    return {enabled:this.enabled,paused:this.paused,rendering:this.renderingMode,sourceReady:this.sourceReady,
      clock300Hz:this.vents[0]?.motion.clock ?? 0,
      vents:this.vents.length,visibleVents:this.visibleVents,particles,
      capacity:this.vents.length*(ECO_PARTICLE_CAPACITY+15),dropped,batches,
      drawCallsPerView:batches,trianglesPerView:triangles,textures:this.renderingMode==='original'?3:0,lights:0};
  }
  dispose(): void {
    if(this.disposed)return;
    this.disposed=true;for(const kind of KINDS)this.batches[kind].dispose();this.root.removeFromParent();
  }
}
