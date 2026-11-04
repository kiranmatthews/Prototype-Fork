import * as THREE from 'three';
import {ParticleMotion, type LabParticle} from './particleMotion';
import {assetURL, type Catalogue, type EffectDefinition, type HostReplay, type RenderingMode} from './types';
import {DistortionBatch, PARTICLE_SPRITE_LAYER} from './distortion';
import {SourceAssembly} from './sourceAssemblies';
import {ParticleLighting} from './particleLighting';

const vertexShader = /* glsl */`
  attribute vec4 profile;
  attribute vec3 centre;
  attribute vec2 size;
  attribute vec4 rgba;
  attribute vec4 orientation;
  attribute vec3 rotationMode;
  varying vec4 ink;
  varying vec2 sourceUV;
  vec3 turn(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
  void main() {
    vec2 offset = position.xy * size;
    vec4 viewed;
    if (rotationMode.y > 0.5) {
      // Source cdata[12..15]: 3D sprites occupy XZ; Y is the normal axis.
      viewed = modelViewMatrix * vec4(centre + turn(orientation, vec3(offset.x, 0.0, offset.y)), 1.0);
    } else {
      // cdata[4..7] anchors the left edge at the origin (needles, ribbons).
      offset.x += rotationMode.z * size.x;
      viewed = modelViewMatrix * vec4(centre, 1.0);
      float c = cos(rotationMode.x), s = sin(rotationMode.x);
      // Include the exhibit's uniform inspection scale in billboard offsets.
      viewed.xy += mat2(c, s, -s, c) * offset * length(modelMatrix[0].xyz);
    }
    gl_Position = projectionMatrix * viewed;
    ink = rgba * profile * vec4(2.0/255.0, 2.0/255.0, 2.0/255.0, 4.0/255.0);
    sourceUV = uv;
  }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D sourceTexture;
  varying vec4 ink;
  varying vec2 sourceUV;
  void main() {
    vec4 result = ink;
    #ifdef ORIGINAL_TEXTURE
      result *= texture2D(sourceTexture, sourceUV);
    #endif
    if (result.a < 0.016) discard;
    gl_FragColor = result;
  }
`;

function originalGeometry(): THREE.InstancedBufferGeometry {
  const result = new THREE.InstancedBufferGeometry();
  result.setAttribute('position', new THREE.Float32BufferAttribute([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,.5,0], 3));
  result.setAttribute('uv', new THREE.Float32BufferAttribute([0,0,1,0,1,1,0,1], 2));
  result.setAttribute('profile', new THREE.Float32BufferAttribute(new Array(16).fill(1), 4));
  result.setIndex([0,1,2,0,2,3]); return result;
}

/** A fixed, texture-free colour mesh derived from the original sprite. Cells
 * refine where interpolated RGBA misses the source, never by camera distance. */
function gouraudGeometry(texture: THREE.Texture): THREE.InstancedBufferGeometry {
  const image = texture.image as HTMLImageElement;
  const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
  const context = canvas.getContext('2d', {willReadFrequently: true})!; context.drawImage(image, 0, 0);
  const data = context.getImageData(0, 0, image.width, image.height).data;
  const positions: number[] = [], colors: number[] = [], indices: number[] = [], uvs: number[] = [];
  const sample = (u: number, v: number): number[] => {
    const x = Math.max(0, Math.min(image.width - 1, u * image.width - .5));
    const y = Math.max(0, Math.min(image.height - 1, (1 - v) * image.height - .5));
    const x0 = Math.floor(x), y0 = Math.floor(y), output = [0,0,0,0];
    for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
      const at = (Math.min(y0+j,image.height-1)*image.width + Math.min(x0+i,image.width-1))*4;
      const weight = (i ? x-x0 : 1-x+x0) * (j ? y-y0 : 1-y+y0) / 255;
      for (let c = 0; c < 4; c++) output[c] += data[at+c]*weight;
    }
    return output;
  };
  const probes = [[.5,0],[0,.5],[1,.5],[.5,1],[.5,.5],[.25,.25],[.75,.25],[.25,.75],[.75,.75]];
  const cell = (x: number, y: number, width: number, depth: number) => {
    const corners = [sample(x,y),sample(x+width,y),sample(x+width,y+width),sample(x,y+width)];
    let error = 0, alpha = Math.max(...corners.map(color => color[3]));
    for (const [u,v] of probes) {
      const actual = sample(x+u*width,y+v*width); alpha = Math.max(alpha,actual[3]);
      for (let c = 0; c < 4; c++) {
        const linear = u >= v ? corners[0][c]*(1-u)+corners[1][c]*(u-v)+corners[2][c]*v :
          corners[0][c]*(1-v)+corners[2][c]*u+corners[3][c]*(v-u);
        error = Math.max(error,Math.abs(linear-actual[c]));
      }
    }
    if (error > .045 && depth < 6) {
      for (let j=0;j<2;j++)for(let i=0;i<2;i++)cell(x+i*width/2,y+j*width/2,width/2,depth+1);
      return;
    }
    if (alpha < 1/255) return;
    const offset = positions.length/3;
    [[x,y],[x+width,y],[x+width,y+width],[x,y+width]].forEach(([u,v],i)=>{
      positions.push(u-.5,v-.5,0);uvs.push(u,v);colors.push(...corners[i]);
    });
    indices.push(offset,offset+1,offset+2,offset,offset+2,offset+3);
  };
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)cell(x/4,y/4,1/4,2);
  const result = new THREE.InstancedBufferGeometry();
  result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  result.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  result.setAttribute('profile',new THREE.Float32BufferAttribute(colors,4));
  result.setIndex(indices);return result;
}

function material(texture: THREE.Texture, original: boolean, blend: LabParticle['blend'], depthWrite: boolean): THREE.ShaderMaterial {
  const result = new THREE.ShaderMaterial({vertexShader,fragmentShader,
    defines: original ? {ORIGINAL_TEXTURE: 1} : {}, uniforms: {sourceTexture:{value:texture}},
    transparent:true,depthWrite,side:THREE.DoubleSide,
    blending:blend==='additive'?THREE.AdditiveBlending:THREE.NormalBlending,
    toneMapped:false,forceSinglePass:true});
  if(blend==='subtractive') {
    // GS ALPHA 0x42: destination - source * sourceAlpha.
    result.blending=THREE.CustomBlending;result.blendEquation=THREE.ReverseSubtractEquation;
    result.blendSrc=THREE.SrcAlphaFactor;result.blendDst=THREE.OneFactor;
    result.blendEquationAlpha=THREE.AddEquation;result.blendSrcAlpha=THREE.ZeroFactor;result.blendDstAlpha=THREE.OneFactor;
  }
  return result;
}

export class SpriteBatch {
  readonly original: THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  readonly gouraud: THREE.Mesh<THREE.InstancedBufferGeometry,THREE.ShaderMaterial>;
  private capacity = 0;
  private attributes: Record<string,THREE.InstancedBufferAttribute> = {};
  constructor(readonly texture: THREE.Texture, blend: LabParticle['blend'], depthWrite: boolean) {
    this.original = new THREE.Mesh(originalGeometry(),material(texture,true,blend,depthWrite));
    this.gouraud = new THREE.Mesh(gouraudGeometry(texture),material(texture,false,blend,depthWrite));
    for(const mesh of [this.original,this.gouraud]) {mesh.frustumCulled=false;mesh.renderOrder=2;mesh.layers.set(PARTICLE_SPRITE_LAYER);}
  }
  write(particles: LabParticle[]): void {
    if(particles.length>this.capacity) {
      this.capacity = 2**Math.ceil(Math.log2(Math.max(16,particles.length)));
      for(const [name,width] of Object.entries({centre:3,size:2,rgba:4,orientation:4,rotationMode:3})) {
        const attribute = new THREE.InstancedBufferAttribute(new Float32Array(this.capacity*width),width).setUsage(THREE.DynamicDrawUsage);
        this.attributes[name]=attribute;
        for(const mesh of [this.original,this.gouraud])mesh.geometry.setAttribute(name,attribute);
      }
    }
    for(let index=0;index<particles.length;index++) {
      const particle=particles[index],v=particle.values;
      this.attributes.centre.setXYZ(index,particle.position.x/4096,particle.position.y/4096,particle.position.z/4096);
      this.attributes.size.setXY(index,(v['scale-x']??0)/4096,(v['scale-y']??0)/4096);
      this.attributes.rgba.setXYZW(index,v.r??0,v.g??0,v.b??0,v.a??0);
      const q=particle.orientation;this.attributes.orientation.setXYZW(index,q.x,q.y,q.z,q.w);
      this.attributes.rotationMode.setXYZ(index,(v['rot-z']??0)*Math.PI*2/65536,particle.is3d?1:0,
        !particle.is3d&&(Math.trunc(v['rot-x']??0)&15)===4?.5:0);
    }
    for(const attribute of Object.values(this.attributes)) {
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,particles.length*attribute.itemSize);attribute.needsUpdate=true;
    }
    for(const mesh of [this.original,this.gouraud])mesh.geometry.instanceCount=particles.length;
  }
  dispose(): void {
    for(const mesh of [this.original,this.gouraud]){mesh.geometry.dispose();mesh.material.dispose();}
  }
}

export class ParticleExhibit {
  readonly root = new THREE.Group();
  readonly motion: ParticleMotion;
  readonly issues: Set<string>;
  readonly replays: HostReplay[];
  readonly assembly:SourceAssembly|null;
  readonly lighting:ParticleLighting|null;
  readonly original = new THREE.Group();
  readonly alternative = new THREE.Group();
  private readonly batches = new Map<string,SpriteBatch>();
  private readonly textures = new Map<string,THREE.Texture>();
  private distortion: DistortionBatch | null = null;
  private extent: number;
  private sourceRadius: number;
  private mode: RenderingMode = 'compare';
  private nativeScale=false;
  private readonly cameraPoint=new THREE.Vector3();
  private nextDirectLaunch = 300;
  private constructor(readonly definition: EffectDefinition, catalogue: Catalogue, private readonly sceneTexture: THREE.IUniform) {
    this.motion = new ParticleMotion(definition,new Map(catalogue.particles.map(p=>[p.id,p])),12000,definition.id+1,catalogue.callbackPrograms);
    this.lighting=catalogue.particleLighting?new ParticleLighting(catalogue.particleLighting,definition.source.file):null;
    this.refreshLighting();
    if(!this.lighting&&this.motion.hostInputs.has('particle lighting'))this.motion.issues.add('Source lighting tables unavailable');
    this.assembly=definition.sourceAssembly?new SourceAssembly(definition.sourceAssembly):null;
    if(this.assembly) {
      this.motion.sourceEmitter=motion=>this.assembly!.emit(motion);
      this.motion.hostInputs.delete('particle quaternion');
    }
    this.issues=this.motion.issues;
    const timings=new Set<string>();
    this.replays=(catalogue.sourceInventory?.partTrackerLaunches??[]).flatMap(entry=>{
      const replay=entry.replay;if(!replay||replay.group!==definition.name)return [];
      const key=`${replay.duration}/${replay.linger}`;
      if(timings.has(key))return [];timings.add(key);return [replay];
    });
    const patches=catalogue.sourceInventory?.runtimeParticlePatches.filter(patch=>patch.particles.some(id=>
      typeof id==='number'&&this.motion.referencedParticleIds.has(id))&&
      !(definition.sourceAssembly==='eco-beam'&&patch.source.file==='engine/common-obs/generic-obs.gc'&&patch.source.line===1491))??[];
    if(patches.length)this.issues.add(`Host emission changes: ${patches.length} source sites`);
    const bounds=definition.bounds;
    this.sourceRadius=this.assembly?.radius??Math.max(1,bounds?.[4]??1);
    this.extent=Math.min(1,3.5/this.sourceRadius);
    const centre=this.assembly?.centre??(bounds?new THREE.Vector3(bounds[1],bounds[2],bounds[3]):new THREE.Vector3());
    for(const group of [this.original,this.alternative]) {
      const display=new THREE.Group();display.position.copy(centre).negate();display.position.y+=this.sourceRadius;group.add(display);
    }
    this.root.add(this.original,this.alternative);this.setRendering('compare');
  }
  static async load(definition: EffectDefinition,catalogue: Catalogue,sceneTexture: THREE.IUniform): Promise<ParticleExhibit> {
    const exhibit=new ParticleExhibit(definition,catalogue,sceneTexture);
    const textures=new Map(catalogue.textures.map(texture=>[texture.id,texture]));
    const loader=new THREE.TextureLoader();
    // Bound image decoding bursts when an effect contains many sprite types.
    try {
      for(const id of exhibit.motion.textureIds) {
        const reference=textures.get(id);
        if(!reference){exhibit.issues.add(`Texture requires host assignment: ${id}`);continue;}
        const texture=await loader.loadAsync(assetURL(reference.path));texture.colorSpace=THREE.NoColorSpace;
        exhibit.textures.set(id,texture);
      }
      // Start at a readable moment, with both displays reading one simulation.
      exhibit.update(definition.directLaunch?1/60:.5);
      if(exhibit.motion.hostInputs.has('racer speed')||exhibit.motion.hostInputs.has('racer heat')) {
        // The HUD's source sphere is a culling bound (100 m for its pie
        // slices), not their visible size. Fit the isolated live sprites;
        // their source positions, dimensions and native-scale option stay exact.
        exhibit.sourceRadius=Math.max(1,...exhibit.motion.particles.map(p=>
          (p.position.length()+.5*Math.hypot(p.values['scale-x']??0,p.values['scale-y']??0))/4096));
        exhibit.extent=Math.min(1,3.5/exhibit.sourceRadius);
        for(const group of [exhibit.original,exhibit.alternative])group.children[0].position.set(0,exhibit.sourceRadius,0);
        exhibit.setNativeScale(false);
      }
      return exhibit;
    } catch(error) {
      exhibit.dispose();throw error;
    }
  }
  get scale(): number{return this.original.scale.x;}
  get distortions(): number{return this.distortion?.count??0;}
  get inspectionSize():THREE.Vector3 {
    const radius=this.sourceRadius*this.scale;
    return new THREE.Vector3(this.mode==='compare'?2*(Math.abs(this.original.position.x)+radius):2*radius,2*radius,2*radius);
  }
  setReplay(index: number): void {this.motion.replay=this.replays[index]??null;this.restart();}
  setRendering(mode:RenderingMode):void {
    this.mode=mode;this.original.visible=mode!=='gouraud';this.alternative.visible=mode!=='original';
    this.setNativeScale(false);
  }
  setNativeScale(native:boolean):void {
    this.nativeScale=native;
    for(const group of [this.original,this.alternative])group.scale.setScalar(native?1:this.extent);
    const offset=this.mode==='compare'?Math.max(2.6,this.sourceRadius*this.scale+.6):0;
    this.original.position.x=-offset;this.alternative.position.x=offset;
  }
  refreshAssembly():void {
    if(!this.assembly)return;
    this.sourceRadius=this.assembly.radius;this.extent=Math.min(1,3.5/this.sourceRadius);
    for(const group of [this.original,this.alternative]) {
      group.children[0].position.copy(this.assembly.centre).negate();group.children[0].position.y+=this.sourceRadius;
    }
    this.setNativeScale(this.nativeScale);
  }
  setInspectionCamera(position:THREE.Vector3):void {
    if(!this.assembly)return;
    this.root.updateWorldMatrix(true,false);
    this.cameraPoint.copy(position);this.root.worldToLocal(this.cameraPoint);
    this.assembly.camera.copy(this.cameraPoint).divideScalar(this.scale)
      .sub(this.original.children[0].position).multiplyScalar(4096);
  }
  refreshLighting():void {
    if(this.lighting)this.motion.host.particleColor.fromArray(this.lighting.sample(this.motion.hour));
  }
  update(dt:number):void {
    if(this.definition.directLaunch&&this.motion.clock>=this.nextDirectLaunch) {
      this.motion.triggerDirect();this.nextDirectLaunch=this.motion.clock+300;
    }
    this.motion.update(dt);
    const grouped=new Map<string,LabParticle[]>();
    for(const particle of this.motion.particles) {
      if(particle.callback==='add-to-sprite-aux-list')continue;
      const key=`${particle.texture}:${particle.blend}:${particle.depthWrite}`;
      if(!this.batches.has(key)) {
        const texture=this.textures.get(particle.texture);if(!texture)continue;
        const batch=new SpriteBatch(texture,particle.blend,particle.depthWrite);this.batches.set(key,batch);
        this.original.children[0].add(batch.original);this.alternative.children[0].add(batch.gouraud);
      }
      let list=grouped.get(key);if(!list)grouped.set(key,list=[]);list.push(particle);
    }
    for(const [id,batch] of this.batches)batch.write(grouped.get(id)??[]);
    if(this.motion.auxiliaryParticles.length&&!this.distortion) {
      this.distortion=new DistortionBatch(this.sceneTexture);
      this.original.children[0].add(this.distortion.original);this.alternative.children[0].add(this.distortion.gouraud);
    }
    this.distortion?.write(this.motion.auxiliaryParticles);
  }
  restart():void {this.nextDirectLaunch=300;this.motion.reset();this.update(1/60);}
  get diagnostics(){return {view:this.mode,particles:this.motion.particles.length,ticks:this.motion.clock,
    dropped:this.motion.dropped,sourceQueueDrops:this.motion.queueDrops,batches:this.batches.size,
    distortions:this.distortions,auxiliaryDrops:this.motion.auxiliaryDrops,
    assembly:this.assembly?.kind,sourceCalls:this.assembly?.calls,
    lighting:this.lighting?.selected.id,hour:this.motion.hour,particleColor:this.motion.host.particleColor.toArray(),
    replay:this.motion.replayPhase,replaySource:this.motion.replay?.source,hostInputs:[...this.motion.hostInputs],issues:[...this.issues]};}
  dispose():void {
    for(const batch of this.batches.values())batch.dispose();
    for(const texture of this.textures.values())texture.dispose();
    this.distortion?.dispose();
    this.batches.clear();this.textures.clear();this.root.removeFromParent();
  }
}
