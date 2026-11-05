import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexHull } from 'three/examples/jsm/math/ConvexHull.js';
import { crateSculptFragments, type CrateFragment } from './crateSculpt';
import { solidContact, type SolidQuery } from './worldSolids';
import type { CrateArtKind } from './crateArt';
import type { CrateDebrisWorld } from './crateEffects';
import { explosiveFragments } from './crateExplosive';
import { currentMetalCrate, isMetalCrate } from './crateMetal';

type FragmentBody = {
  bone: THREE.Bone; source: CrateFragment; position: THREE.Vector3;
  velocity: THREE.Vector3; rotation: THREE.Quaternion; angular: THREE.Vector3;
  lifetime: number; settled: boolean; bounces: number;
  contactHull: THREE.Vector3[];
  burnRate: number;
};
type Assembly = { root: THREE.Group; mesh: THREE.SkinnedMesh; bodies: FragmentBody[]; age: number; size: number;
  motion?: { value: number }; ownedMaterials: THREE.MeshStandardMaterial[] };
const fractureGeometries = new Map<string, THREE.BufferGeometry>();
const contactHulls = new WeakMap<CrateFragment, THREE.Vector3[]>();
function contactHull(fragment: CrateFragment): THREE.Vector3[] {
  const cached = contactHulls.get(fragment); if (cached) return cached;
  const points = new Map<string, THREE.Vector3>();
  for (const g of [fragment.exterior, fragment.interior]) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).sub(fragment.center);
      points.set(`${v.x},${v.y},${v.z}`, v);
    }
  }
  // Convex support has exactly the same extremum as the full source surface.
  // These are physics points only; render geometry stays completely intact.
  const hull = new ConvexHull().setFromPoints([...points.values()]);
  const outer = new Set<THREE.Vector3>();
  for (const face of hull.faces) { let edge = face.edge; do { outer.add(edge.head().point); edge = edge.next; } while (edge !== face.edge); }
  const result = [...outer]; contactHulls.set(fragment, result); return result;
}
let cutMaterial: THREE.MeshStandardMaterial | undefined;
let steelCutMaterial: THREE.MeshStandardMaterial | undefined;
function sourceFragments(kind: CrateArtKind): CrateFragment[] | undefined {
  return kind === 'tnt' || kind === 'nitro' ? explosiveFragments()
    : isMetalCrate(kind) ? currentMetalCrate()?.fragments : crateSculptFragments(kind);
}
function geometry(kind: CrateArtKind): THREE.BufferGeometry | undefined {
  const explosive = kind === 'tnt' || kind === 'nitro';
  const fragments = sourceFragments(kind); if (!fragments) return undefined;
  const key = explosive ? 'bundle' : isMetalCrate(kind) ? 'steel' : kind === 'multihit' ? 'multihit' : kind === 'wood' || kind === 'empty' ? 'braced' : 'plain';
  const cached = fractureGeometries.get(key); if (cached) return cached;
  const exterior: THREE.BufferGeometry[] = [], interior: THREE.BufferGeometry[] = [];
  fragments.forEach((fragment, index) => {
    for (const [key, bucket] of [['exterior', exterior], ['interior', interior]] as const) {
      const g = fragment[key].clone(), count = g.getAttribute('position').count;
      if (!count) { g.dispose(); continue; }
      const indices = new Uint16Array(count * 4), weights = new Float32Array(count * 4);
      const centers = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) { indices[i * 4] = index; weights[i * 4] = 1; }
      for (let i = 0; i < count; i++) fragment.center.toArray(centers, i * 3);
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
      g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
      g.setAttribute('fractureCenter', new THREE.Float32BufferAttribute(centers, 3)); bucket.push(g);
    }
  });
  const outside = mergeGeometries(exterior)!, inside = interior.length ? mergeGeometries(interior)! : undefined;
  const fractureGeometry = mergeGeometries(inside ? [outside, inside] : [outside], true)!;
  fractureGeometry.userData.shared = true;
  for (const g of [...exterior, ...interior, outside, ...(inside ? [inside] : [])]) g.dispose();
  fractureGeometries.set(key, fractureGeometry);
  return fractureGeometry;
}
/** Do the one-time partition merge and contact-hull work during asset loading,
 * keeping the first actual smash within the same frame cost as later ones. */
export function prepareCrateFracture(kind: CrateArtKind): void {
  const fragments = sourceFragments(kind); if (!fragments) return;
  geometry(kind);
  for (const fragment of fragments) contactHull(fragment);
}
function freshWood(): THREE.MeshStandardMaterial {
  if (cutMaterial) return cutMaterial;
  cutMaterial = new THREE.MeshStandardMaterial({ color: 0xcf6427, roughness: .86, flatShading: true });
  cutMaterial.name = 'Orange timber through the broken faces'; cutMaterial.userData.shared = true;
  cutMaterial.onBeforeCompile = shader => {
    shader.vertexShader = `varying vec3 vSplitLocal;\n${shader.vertexShader}`.replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplitLocal = position;');
    shader.fragmentShader = `varying vec3 vSplitLocal;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      float fibres = sin(vSplitLocal.x * 98.0 + sin(vSplitLocal.z * 17.0) * 1.5);
      float rings = sin(length(vSplitLocal.xz + vec2(.18, .11)) * 65.0);
      diffuseColor.rgb *= .94 + .035 * fibres + .025 * rings;
    `);
  };
  cutMaterial.customProgramCacheKey = () => 'fresh-split-wood-v1';
  return cutMaterial;
}
function freshSteel(): THREE.MeshStandardMaterial {
  if (steelCutMaterial) return steelCutMaterial;
  steelCutMaterial = new THREE.MeshStandardMaterial({ color: 0x77858e, roughness: .72, metalness: .25, flatShading: true });
  steelCutMaterial.name = 'Fresh torn steel edges'; steelCutMaterial.userData.shared = true;
  return steelCutMaterial;
}
function fadingMaterial(source: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial {
  const material = source.clone(); material.userData.shared = false;
  material.onBeforeCompile = source.onBeforeCompile;
  material.customProgramCacheKey = () => source.customProgramCacheKey();
  material.transparent = true; material.depthWrite = true;
  return material;
}

/** Rigid bones carry the exact surface pieces in two draws per break.
 * The budget caps whole assemblies, preserving coherent silhouettes at birth. */
export class CrateFracturePool {
  readonly root = new THREE.Group();
  private assemblies: Assembly[] = [];
  private seed = 0x81412a71;
  private axis = new THREE.Vector3();
  private localNormal = new THREE.Vector3();
  private inverse = new THREE.Quaternion();
  private delta = new THREE.Quaternion();
  private from = new THREE.Vector3();
  private next = new THREE.Vector3();
  private contact = solidContact();
  private ray = new THREE.Raycaster();
  private groundNormal = new THREE.Vector3();
  private normalMatrix = new THREE.Matrix3();
  private collisionBody: FragmentBody | undefined;
  private collisionSize = 1;
  private query: SolidQuery = { low: 0, high: 0, radius: .1, supportRadius: normal => this.support(normal) };
  constructor() { this.root.name = 'Authored crate fracture assemblies'; this.root.userData.editorGhost = true; }
  private roll(): number { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }

  emit(kind: CrateArtKind, center: THREE.Vector3, size: number, material: THREE.MeshStandardMaterial, explosion: boolean): boolean {
    const explosive = kind === 'tnt' || kind === 'nitro', metal = isMetalCrate(kind);
    const fragments = sourceFragments(kind), g = geometry(kind);
    if (!fragments || !g) return false;
    // The open cage has more pieces than the other shells. Retire complete
    // older effects so simultaneous impacts keep the existing physics budget.
    while (this.assemblies.length && (this.assemblies.length >= 6 || this.diagnostics.shards + fragments.length > 168))
      this.retire(this.assemblies[0]);
    const root = new THREE.Group(); root.position.copy(center); root.scale.setScalar(size);
    root.name = `${kind} · ${fragments.length} matching surface fragments`;
    const surface = fadingMaterial(material);
    const motion = explosive ? { value: 0 } : undefined;
    if (motion) {
      surface.onBeforeCompile = (shader, renderer) => {
        material.onBeforeCompile(shader, renderer);
        shader.uniforms.fractureAge = motion;
        shader.vertexShader = `attribute vec3 fractureCenter; uniform float fractureAge;\n${shader.vertexShader}`
          .replace('#include <skinning_vertex>', `
            if (bundleSurface.x > .5 && bundleSurface.x < 1.5) {
              vec3 clothLocal = position - fractureCenter;
              float release = 1.0 - exp(-fractureAge * 18.0);
              float phase = fractureAge * 19.0 + fractureCenter.x * 9.0 + fractureCenter.z * 7.0;
              transformed.y += sin(phase + (clothLocal.x + clothLocal.z) * 12.0) * .075 * release;
              transformed.x += sin(phase * .7 + clothLocal.y * 14.0) * .025 * release;
            }
            #include <skinning_vertex>`);
      };
      surface.customProgramCacheKey = () => `${material.customProgramCacheKey()}:torn-canvas-v1`;
    }
    const inside = fadingMaterial(metal ? freshSteel() : freshWood());
    const mesh = new THREE.SkinnedMesh(g, [surface, inside]);
    mesh.name = 'Rigid surface fragments and closed cut faces'; mesh.frustumCulled = false;
    mesh.castShadow = false; mesh.receiveShadow = true; root.add(mesh);
    const bones = fragments.map((fragment, i) => {
      const bone = new THREE.Bone(); bone.name = `Fracture ${i}`; bone.position.copy(fragment.center); mesh.add(bone); return bone;
    });
    // Bind before positioning the assembly; attached bind mode cancels its
    // world matrix while bones retain their independent rigid transforms.
    root.updateMatrixWorld(true); const skeleton = new THREE.Skeleton(bones); mesh.bind(skeleton);
    const bodies = fragments.map((fragment, i): FragmentBody => {
      // Bottom pieces receive the same upward kick as the top pieces, so
      // none are driven into the floor before their short fade completes.
      const radial = fragment.center.clone(); radial.y = 0; radial.normalize();
      const heavy = (i < 8 ? .8 : 1) * (metal ? .72 : 1);
      const power = (explosion ? 5.3 : 3.4) * heavy * (.85 + this.roll() * .45);
      return {
        bone: bones[i], source: fragment, position: center.clone().addScaledVector(fragment.center, size),
        velocity: radial.multiplyScalar(power).add(new THREE.Vector3((this.roll() - .5) * .8, 5.5 * (.9 + this.roll() * .25), (this.roll() - .5) * .8)),
        rotation: new THREE.Quaternion(), angular: new THREE.Vector3((this.roll() - .5) * 12, (this.roll() - .5) * 10, (this.roll() - .5) * 12).multiplyScalar(heavy),
        lifetime: .24 + this.roll() * .08,
        settled: false, bounces: 0, contactHull: contactHull(fragment), burnRate: explosive ? (i < 18 ? 5.2 : 2.3) : 0,
      };
    });
    this.root.add(root); this.assemblies.push({ root, mesh, bodies, age: 0, size, motion, ownedMaterials: [surface, inside] });
    return true;
  }
  private support(normal: THREE.Vector3): number {
    const body = this.collisionBody; if (!body) return .01;
    this.inverse.copy(body.rotation).invert(); this.localNormal.copy(normal).applyQuaternion(this.inverse);
    const n = this.localNormal;
    let support = 0;
    // Use the actual hull surface for contact. An AABB makes irregular shards
    // hover on imaginary corners when they settle.
    for (const p of body.contactHull) support = Math.max(support, -p.dot(n));
    return Math.max(.002, support * this.collisionSize);
  }
  update(dt: number, world: CrateDebrisWorld): void {
    const step = Math.max(0, Math.min(dt, .04));
    for (const assembly of this.assemblies.slice()) {
      assembly.age += step; let alive = false;
      if (assembly.motion) assembly.motion.value = assembly.age;
      // A brief, readable outward kick, then an airborne fade. The source
      // crate's shared material must never fade with its detached fragments.
      const opacity = 1 - THREE.MathUtils.smoothstep(assembly.age, .10, .32);
      for (const material of assembly.ownedMaterials) material.opacity = opacity;
      for (const body of assembly.bodies) {
        if (assembly.age >= body.lifetime || body.position.y < world.killY - 3) { body.bone.scale.setScalar(.00001); continue; }
        const combustion = Math.exp(-Math.max(0, assembly.age - .035) * body.burnRate);
        alive = true; this.collisionBody = body; this.collisionSize = assembly.size * combustion;
        if (!body.settled) {
          const spin = body.angular.length();
          if (spin > .0001) { this.axis.copy(body.angular).divideScalar(spin); this.delta.setFromAxisAngle(this.axis, spin * step); body.rotation.premultiply(this.delta); }
          body.velocity.y -= 17.5 * step; body.velocity.multiplyScalar(Math.exp(-step * .3));
          this.from.copy(body.position); this.next.copy(body.position).addScaledVector(body.velocity, step);
          this.query.radius = body.source.halfSize.length() * this.collisionSize;
          // Resolve every contacting triangle, including the two halves of a
          // floor seam. One contact can leave a rotated shard partly embedded.
          const collided = world.worldSolids?.enabled && world.worldSolids.resolve(this.from, this.next, this.query, this.contact);
          let hit = !!collided;
          if (collided) {
            body.position.copy(this.next);
          } else {
            if (!world.worldSolids?.enabled && body.velocity.y < 0) {
              this.ray.set(this.from, this.axis.set(0, -1, 0));
              this.ray.far = this.from.y - this.next.y + this.support(this.axis.set(0, 1, 0));
              const intersections = world.raycastGround?.(this.ray) ?? this.ray.intersectObjects(world.groundMeshes, false);
              if (intersections.length) {
                hit = true; this.next.y = intersections[0].point.y + this.support(this.axis.set(0, 1, 0)) + .003;
                this.contact.normal.set(0, 1, 0);
              }
            }
            body.position.copy(this.next);
          }
          if (hit) {
            const n = this.contact.normal, into = body.velocity.dot(n);
            if (into < 0) body.velocity.addScaledVector(n, -into * 1.27);
            body.velocity.multiplyScalar(.63); body.angular.multiplyScalar(.52); body.bounces++;
            if (n.y > .65 && body.bounces >= 2) {
              const oldSupport = this.support(n), half = body.source.halfSize;
              this.axis.set(half.x <= half.y && half.x <= half.z ? 1 : 0, half.y < half.x && half.y <= half.z ? 1 : 0, half.z < half.x && half.z < half.y ? 1 : 0);
              this.axis.applyQuaternion(body.rotation); if (this.axis.dot(n) < 0) this.axis.negate();
              this.delta.setFromUnitVectors(this.axis, n); body.rotation.premultiply(this.delta);
              body.position.addScaledVector(n, this.support(n) - oldSupport);
              if (body.velocity.lengthSq() < 1.4 || body.bounces >= 4) { body.settled = true; body.velocity.setScalar(0); }
            }
            if (n.y > .65) {
              // A triangle edge can report a diagonal separation normal.
              // Seat the final rotated hull against the actual supporting
              // surface plane, including after the last settling rotation.
              const reach = body.source.halfSize.length() * this.collisionSize;
              this.ray.set(this.next.copy(body.position).add(this.axis.set(0, reach + .02, 0)), this.groundNormal.set(0,-1,0));
              this.ray.far = reach * 2 + .08;
              const floor = (world.raycastGround?.(this.ray) ?? this.ray.intersectObjects(world.groundMeshes,false))[0];
              if (floor?.face) {
                this.normalMatrix.getNormalMatrix(floor.object.matrixWorld);
                this.groundNormal.copy(floor.face.normal).applyNormalMatrix(this.normalMatrix);
                if (this.groundNormal.y > .65) {
                  const depth = this.support(this.groundNormal) - this.next.copy(body.position).sub(floor.point).dot(this.groundNormal);
                  if (depth > -.003) body.position.addScaledVector(this.groundNormal, depth + .003);
                }
              }
            }
          }
        }
        body.bone.position.copy(body.position).sub(assembly.root.position).divideScalar(assembly.size);
        body.bone.quaternion.copy(body.rotation);
        const fade = THREE.MathUtils.smoothstep(body.lifetime - assembly.age, 0, .10);
        body.bone.scale.setScalar((.65 + .35 * fade) * combustion);
      }
      if (!alive) this.retire(assembly);
    }
  }
  private retire(assembly: Assembly): void {
    assembly.root.removeFromParent(); assembly.mesh.skeleton.dispose();
    for (const material of assembly.ownedMaterials) material.dispose();
    this.assemblies.splice(this.assemblies.indexOf(assembly), 1);
  }
  clear(): void { for (const assembly of this.assemblies.slice()) this.retire(assembly); }
  dispose(): void { this.clear(); this.root.removeFromParent(); }
  get diagnostics(): { shards: number; draws: number; assemblies: number } {
    return { shards: this.assemblies.reduce((n, a) => n + a.bodies.filter(b => a.age < b.lifetime).length, 0), draws: this.assemblies.reduce((n, a) => n + a.mesh.geometry.groups.length, 0), assemblies: this.assemblies.length };
  }
}
