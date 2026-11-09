import * as THREE from 'three';
import type { CrateArtKind } from './crateArt';
import {FlameHeatSamples} from './flameHeatSource';

type Particle = {
  position: THREE.Vector3; velocity: THREE.Vector3; tile: number; age: number;
  life: number; size: number; rotation: number; spin: number; tint: THREE.Color;
  nitro: number; squash: number;
};
let atlas: THREE.Texture | undefined;
function texture(): THREE.Texture {
  if (atlas) return atlas;
  atlas = typeof window === 'undefined' ? new THREE.Texture() : new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}props/crate-family/crate-vfx-atlas.png`);
  atlas.colorSpace = THREE.SRGBColorSpace; atlas.userData.shared = true; return atlas;
}
const CAPACITY = 128;

/** Painted dust, fire, smoke and directional brush accents in one bounded
 * billboard draw. Their opacity drops quickly enough to keep debris readable. */
export class CrateVfx {
  private readonly heat=new FlameHeatSamples(CAPACITY);
  readonly root = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private parameters: THREE.InstancedBufferAttribute;
  private particles: Particle[] = [];
  private events: number[] = [];
  private seed = 0x79fd077a;
  private matrix = new THREE.Matrix4();
  private scale = new THREE.Vector3();
  private identity = new THREE.Quaternion();
  constructor() {
    this.root.name = 'Painted crate dust, fire and smoke';
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.parameters = new THREE.InstancedBufferAttribute(new Float32Array(CAPACITY * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('crateParticle', this.parameters);
    const material = new THREE.MeshBasicMaterial({ map: texture(), transparent: true, opacity: 1, alphaTest: .01, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute vec4 crateParticle; varying vec4 vCrateParticle;\n${shader.vertexShader}`
        .replace('#include <uv_vertex>', `#include <uv_vertex>
          vCrateParticle = crateParticle;
          vMapUv = uv * .5 + vec2(mod(crateParticle.x, 2.0) * .5, crateParticle.x < 1.5 ? .5 : 0.0);
        `)
        .replace('#include <project_vertex>', `
          vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
          float angle = crateParticle.z;
          vec2 billboard = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * position.xy;
          billboard *= vec2(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz));
          mvPosition.xy += billboard;
          gl_Position = projectionMatrix * mvPosition;
        `);
      shader.fragmentShader = `varying vec4 vCrateParticle;\n${shader.fragmentShader}`
        .replace('#include <map_fragment>', `#include <map_fragment>
          diffuseColor.a *= vCrateParticle.y;
          if (vCrateParticle.w > .5 && vCrateParticle.x > 1.5 && vCrateParticle.x < 2.5) {
            float energy = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
            diffuseColor.rgb = mix(vec3(.16, .58, .035), vec3(.91, 1.0, .58), energy);
          }
        `);
    };
    material.customProgramCacheKey = () => 'painted-crate-vfx-v1';
    this.mesh = new THREE.InstancedMesh(geometry, material, CAPACITY);
    // Legacy Gouraud puff batches use 10. Paint stays in front of that cloud;
    // depth testing still lets solid world geometry occlude both treatments.
    this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.renderOrder = 11;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.setColorAt(0, new THREE.Color(0xffffff)); this.root.add(this.mesh);
    this.heat.attach(this.mesh);
  }
  private roll(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(kind: CrateArtKind, center: THREE.Vector3, size: number, groundY: number, explosion: boolean): void {
    this.events.push(0); if (this.events.length > 12) this.events.shift();
    const add = (tile: number, position: THREE.Vector3, velocity: THREE.Vector3, scale: number, life: number, delay = 0, squash = 1) => {
      if (this.particles.length >= CAPACITY) this.particles.shift();
      this.particles.push({ position, velocity, tile, age: -delay, life, size: scale, rotation: (this.roll() - .5) * (tile === 3 ? 6.28 : .45),
        spin: (this.roll() - .5) * (tile === 3 ? 5 : .5), tint: new THREE.Color(kind === 'checkpoint' && tile === 3 ? 0xc6ffdb : 0xffffff), nitro: kind === 'nitro' ? 1 : 0, squash });
    };
    // Low billows travel outwards along the contact plane, leaving a clear
    // window around the large wood fragments instead of filling it with smoke.
    for (let i = 0; i < (explosion ? 9 : 6); i++) {
      const a = i * Math.PI * 2 / (explosion ? 9 : 6) + this.roll() * .25;
      const radius = size * (.24 + this.roll() * .18);
      const p = new THREE.Vector3(center.x + Math.cos(a) * radius, groundY + size * .28, center.z + Math.sin(a) * radius);
      add(0, p, new THREE.Vector3(Math.cos(a) * (explosion ? 3.0 : 1.4), .25 + this.roll() * .5, Math.sin(a) * (explosion ? 3.0 : 1.4)),
        size * (.68 + this.roll() * .3), explosion ? .48 + this.roll() * .25 : .20 + this.roll() * .12, i * .005, .5);
    }
    for (let i = 0; i < (explosion ? 5 : 3); i++) {
      const a = i * 2.39996 + this.roll() * .3;
      add(3, center.clone().add(new THREE.Vector3(Math.cos(a) * size * .25, (this.roll() - .4) * size * .3, Math.sin(a) * size * .25)),
        new THREE.Vector3(Math.cos(a) * 1.5, .8, Math.sin(a) * 1.5), size * (explosion ? 1.6 : 1.05), .15 + this.roll() * .09, 0, .68);
    }
    if (explosion) {
      for (let i = 0; i < 4; i++) {
        const a = i * 2.39996;
        add(2, center.clone().add(new THREE.Vector3(Math.cos(a) * size * .17, (i % 2) * size * .15, Math.sin(a) * size * .17)),
          new THREE.Vector3(Math.cos(a) * .7, 1.6 + i * .18, Math.sin(a) * .7), size * (i === 0 ? 2.7 : 1.65), .24 + i * .035, i * .018);
      }
      for (let i = 0; i < 5; i++) {
        const a = i * 2.39996;
        add(1, center.clone().add(new THREE.Vector3(Math.cos(a) * size * .16, size * .12, Math.sin(a) * size * .16)),
          new THREE.Vector3(Math.cos(a) * 1.2, 1 + this.roll() * .6, Math.sin(a) * 1.2), size * (.85 + this.roll() * .45), .65 + this.roll() * .35, .12 + i * .025);
      }
    }
    this.write();
  }
  update(dt: number): void {
    const step = Math.min(Math.max(dt, 0), .05);
    this.events = this.events.map(age => age + step).filter(age => age < 1.3);
    for (const p of this.particles) {
      p.age += step; if (p.age < 0) continue;
      p.position.addScaledVector(p.velocity, step);
      p.velocity.multiplyScalar(Math.exp(-step * (p.tile === 0 ? 3 : 1.4)));
      if (p.tile === 1) p.velocity.y += step * .35;
      p.rotation += p.spin * step;
    }
    this.particles = this.particles.filter(p => p.age < p.life); this.write();
  }
  private write(): void {
    let count = 0;this.heat.clear();
    for (const p of this.particles) {
      if (p.age < 0) continue;
      const t = p.age / p.life, enter = Math.min(1, p.age / .035);
      const opacity = enter * Math.pow(1 - t, p.tile === 2 ? .85 : 1.35) * (p.tile === 1 ? .66 : p.tile === 0 ? .65 : 1);
      const expansion = p.tile === 3 ? .7 + t * .8 : .4 + Math.pow(t, .38) * .95;
      this.scale.set(p.size * expansion, p.size * expansion * p.squash, 1);
      if(p.tile===2)this.heat.add(p.position.x,p.position.y,p.position.z,this.scale.x*.7,this.scale.y*.7,opacity*1.6,p.rotation*7);
      this.matrix.compose(p.position, this.identity, this.scale); this.mesh.setMatrixAt(count, this.matrix);
      this.mesh.setColorAt(count, p.tint); this.parameters.setXYZW(count, p.tile, opacity, p.rotation, p.nitro); count++;
    }
    this.mesh.count = count; this.mesh.visible = count > 0;
    if (count) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor!.needsUpdate = true; this.parameters.needsUpdate = true; }
  }
  clear(): void { this.heat.clear(); this.particles.length = 0; this.events.length = 0; this.mesh.count = 0; this.mesh.visible = false; }
  dispose(): void { this.clear(); this.mesh.geometry.dispose(); (this.mesh.material as THREE.Material).dispose(); this.mesh.dispose(); this.root.removeFromParent(); }
  get diagnostics(): { particles: number; bursts: number; draws: number } { return { particles: this.particles.length, bursts: this.events.length, draws: this.mesh.count ? 1 : 0 }; }
}
