import * as THREE from 'three';
import type {LabParticle} from './particleMotion';

export const DISTORTION_LAYER = 1;
export const PARTICLE_SPRITE_LAYER = 2;
export const DISTORTION_LIMIT = 256;

/** sprite-distort.gc's flag is an integer slice count, not a rotation. */
export function distortionSlices(flag: number): number {
  const count = Math.trunc(flag);
  return count >= 3 && count <= 11 ? count : 11;
}

/** The pinned VU/PC path emits one continuous five-vertex-per-wedge strip.
 * Keep its joins and winding rather than replacing it with a smooth disc.
 * position.z selects outer (0), inner (1), or centre (2). Screen Y is inverted
 * relative to GS coordinates, so angle zero points down in camera space. */
export function distortionTopology(slices: number): {vertices: Float32Array; indices: Uint16Array} {
  if (!Number.isInteger(slices) || slices < 3 || slices > 11) throw new Error('Invalid distortion slice count');
  const vertices: number[] = [], indices: number[] = [];
  for (let i = 0; i < slices; i++) {
    const a = i * Math.PI * 2 / slices, b = (i + 1) * Math.PI * 2 / slices;
    for (const [angle, ring] of [[a,0],[b,0],[a,1],[b,1]]) vertices.push(Math.sin(angle), -Math.cos(angle), ring);
    vertices.push(0,0,2);
  }
  for (let i = 2; i < slices * 5; i++) indices.push(...(i % 2 ? [i-1,i-2,i] : [i-2,i-1,i]));
  return {vertices: new Float32Array(vertices), indices: new Uint16Array(indices)};
}

const vertexShader = /* glsl */`
  uniform sampler2D sceneTexture;
  attribute vec3 centre;
  attribute vec3 radii;
  varying vec2 sourceUV;
  varying vec4 vertexColour;
  void main() {
    vec4 viewed = modelViewMatrix * vec4(centre, 1.0);
    vec4 projected = projectionMatrix * viewed;
    sourceUV = vec2(0.0); vertexColour = vec4(0.0);
    // The source clips particle centres against its four-screen guard band.
    if (projected.w <= 0.0 || abs(projected.x) > 4.0 * projected.w ||
        abs(projected.y) > 4.0 * projected.w || abs(projected.z) > projected.w) {
      gl_Position = vec4(2.0,2.0,2.0,1.0); return;
    }
    vec3 radius = radii * length(modelMatrix[0].xyz);
    // Source camera d=1024, colour/Q radius cap=128. The inspector uses its
    // own camera projection with unit FOV correction, retaining that cap.
    float projectedOuter = radius.x * 1024.0 / projected.w;
    float sourceY = (1.0 - projected.y / projected.w) * 112.0 / 256.0;
    float sourceAspectY = projectionMatrix[1][1] * 112.0 / 1024.0;
    float limit = min(128.0, (224.0 - sourceY) / sourceAspectY);
    radius *= min(1.0, limit / max(projectedOuter, 0.000001));
    float geometryRadius = position.z < 0.5 ? radius.x : position.z < 1.5 ? radius.y : 0.0;
    float samplingRadius = position.z < 0.5 ? radius.x : position.z < 1.5 ? radius.z : 0.0;
    vec4 vertex = viewed, sampled = viewed;
    vertex.xy += position.xy * geometryRadius;
    sampled.xy += position.xy * samplingRadius;
    gl_Position = projectionMatrix * vertex;
    vec4 sampleClip = projectionMatrix * sampled;
    sourceUV = sampleClip.xy / sampleClip.w * 0.5 + 0.5;
    #ifdef GOURAUD_DISTORTION
      // A colour-only approximation must disappear when the inner UV and
      // geometry rings coincide. Preserve the untouched scene at the outer
      // ring/centre, where the source displacement is always zero.
      float strength = clamp(abs(samplingRadius - geometryRadius) /
        max(abs(radius.x - radius.y), 0.000001), 0.0, 1.0);
      vertexColour = vec4(texture2D(sceneTexture, sourceUV).rgb * (256.0 / 255.0), strength);
    #endif
  }
`;
const fragmentShader = /* glsl */`
  uniform sampler2D sceneTexture;
  varying vec2 sourceUV;
  varying vec4 vertexColour;
  void main() {
    #ifdef GOURAUD_DISTORTION
      gl_FragColor = vertexColour;
    #else
      gl_FragColor = vec4(texture2D(sceneTexture, sourceUV).rgb * (256.0 / 255.0), 1.0);
    #endif
  }
`;

function material(gouraud: boolean, texture: THREE.IUniform): THREE.ShaderMaterial {
  // The frozen framebuffer is already display encoded. Do not tone map it or
  // apply sRGB conversion a second time. The source constant alpha clamps to 1.
  return new THREE.ShaderMaterial({vertexShader, fragmentShader,
    defines: gouraud ? {GOURAUD_DISTORTION: 1} : {}, uniforms: {sceneTexture: texture},
    transparent: true, depthWrite: false, depthTest: true, side: THREE.DoubleSide, toneMapped: false});
}

/** Original and Gouraud use exactly the same authored mesh and particle order.
 * Gouraud samples the frozen scene at vertices and interpolates their colours;
 * it does not sample the framebuffer in the fragment shader. */
export class DistortionBatch {
  readonly geometry = new THREE.BufferGeometry();
  readonly original: THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
  readonly gouraud: THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;
  private capacity = 0;
  private readonly topology = new Map<number,ReturnType<typeof distortionTopology>>();
  count = 0;
  constructor(texture: THREE.IUniform) {
    this.original = new THREE.Mesh(this.geometry,material(false,texture));
    this.gouraud = new THREE.Mesh(this.geometry,material(true,texture));
    for (const mesh of [this.original,this.gouraud]) {mesh.frustumCulled=false;mesh.layers.set(DISTORTION_LAYER);}
    this.geometry.setDrawRange(0,0);
  }
  write(particles: readonly LabParticle[]): void {
    const active = particles.filter(p=>p.alive&&p.values['rot-x']!==0).slice(0,DISTORTION_LIMIT);
    this.count = active.length;
    if (active.length > this.capacity) {
      // Release previous GPU attributes before replacing a growing buffer set.
      this.geometry.dispose();
      this.capacity = Math.min(DISTORTION_LIMIT,2**Math.ceil(Math.log2(Math.max(16,active.length))));
      for (const name of ['position','centre','radii']) this.geometry.setAttribute(name,
        new THREE.BufferAttribute(new Float32Array(this.capacity*55*3),3).setUsage(THREE.DynamicDrawUsage));
      this.geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(this.capacity*53*3),1).setUsage(THREE.DynamicDrawUsage));
    }
    if (!active.length) {this.geometry.setDrawRange(0,0);return;}
    const position=this.geometry.getAttribute('position') as THREE.BufferAttribute;
    const centre=this.geometry.getAttribute('centre') as THREE.BufferAttribute;
    const radii=this.geometry.getAttribute('radii') as THREE.BufferAttribute;
    const index=this.geometry.index!;
    let vertices=0, indices=0;
    for (const particle of active) {
      const v=particle.values,slices=distortionSlices(v['rot-x']);
      // Draw-time invalid-count correction mutates the original sprite flag.
      v['rot-x']=slices;
      let mesh=this.topology.get(slices);
      if(!mesh){mesh=distortionTopology(slices);this.topology.set(slices,mesh);}
      (position.array as Float32Array).set(mesh.vertices,vertices*3);
      for(let i=0;i<mesh.vertices.length/3;i++) {
        centre.setXYZ(vertices+i,particle.position.x/4096,particle.position.y/4096,particle.position.z/4096);
        radii.setXYZ(vertices+i,(v.r??0)/4096,(v.g??0)/4096,(v.b??0)/4096);
      }
      for(const element of mesh.indices)index.setX(indices++,vertices+element);
      vertices+=mesh.vertices.length/3;
    }
    for(const attribute of [position,centre,radii,index]) {
      attribute.clearUpdateRanges();attribute.addUpdateRange(0,attribute===index?indices:vertices*3);attribute.needsUpdate=true;
    }
    this.geometry.setDrawRange(0,indices);
  }
  dispose():void {this.geometry.dispose();this.original.material.dispose();this.gouraud.material.dispose();}
}

/** Source sprite-draw order: existing scene → frozen colour copy → distorters
 * → ordinary sprites. Retain the original depth buffer throughout all passes. */
export class ParticleRenderPass {
  readonly sceneTexture: THREE.IUniform<THREE.FramebufferTexture|null> = {value:null};
  private readonly size = new THREE.Vector2();
  render(renderer:THREE.WebGLRenderer,scene:THREE.Scene,camera:THREE.Camera,distort:boolean):void {
    const mask=camera.layers.mask,background=scene.background,autoClear=renderer.autoClear;
    try {
      if(!distort) {
        camera.layers.disable(DISTORTION_LAYER);camera.layers.enable(PARTICLE_SPRITE_LAYER);
        renderer.render(scene,camera);return;
      }
      camera.layers.disable(DISTORTION_LAYER);camera.layers.disable(PARTICLE_SPRITE_LAYER);
      renderer.render(scene,camera);
      renderer.getDrawingBufferSize(this.size);
      let texture=this.sceneTexture.value;
      if(!texture||texture.image.width!==this.size.x||texture.image.height!==this.size.y) {
        texture?.dispose();texture=new THREE.FramebufferTexture(this.size.x,this.size.y);
        texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.colorSpace=THREE.NoColorSpace;
        this.sceneTexture.value=texture;
      }
      renderer.copyFramebufferToTexture(texture);
      renderer.autoClear=false;scene.background=null;
      camera.layers.set(DISTORTION_LAYER);renderer.render(scene,camera);
      camera.layers.set(PARTICLE_SPRITE_LAYER);renderer.render(scene,camera);
    } finally {camera.layers.mask=mask;scene.background=background;renderer.autoClear=autoClear;}
  }
  dispose():void {this.sceneTexture.value?.dispose();this.sceneTexture.value=null;}
}
