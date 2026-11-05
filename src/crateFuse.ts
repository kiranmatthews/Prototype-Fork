import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONST } from './tuning';

export interface CrateFuse {
  root: THREE.Group;
  tip: THREE.Group;
  sparks: THREE.InstancedMesh;
  fraction: { value: number };
  lit: { value: number };
  clock: { value: number };
  bend: { value: number };
  velocity: number;
}
let braidGeometry: THREE.BufferGeometry | undefined;
let glowMap: THREE.CanvasTexture | undefined;
const SPARK_COUNT = 18;
// Braid, collar, ember, two glow cards and the eight-sided spark volumes.
export const CRATE_FUSE_TRIANGLES = 1728 + 192 + 80 + 4 + SPARK_COUNT * 8;
let sparkGeometry: THREE.OctahedronGeometry | undefined;
const sparkHead = new THREE.Vector3(), sparkTail = new THREE.Vector3();
const sparkAxis = new THREE.Vector3(), sparkUp = new THREE.Vector3(0, 1, 0);
const sparkPose = new THREE.Object3D(), sparkColor = new THREE.Color();
function point(t: number, target = new THREE.Vector3()): THREE.Vector3 {
  return target.set(.34 * t * t, .468 + .68 * t - .30 * t * t, .055 * Math.sin(t * Math.PI));
}
function braid(): THREE.BufferGeometry {
  if (braidGeometry) return braidGeometry;
  const pieces: THREE.BufferGeometry[] = [];
  for (let strand = 0; strand < 3; strand++) {
    class Fibre extends THREE.Curve<THREE.Vector3> {
      constructor() { super(); }
      getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
        point(t, target); const a = t * Math.PI * 10 + strand * Math.PI * 2 / 3;
        const tx = .68 * t, ty = .68 - .60 * t, length = Math.hypot(tx, ty);
        target.x += Math.cos(a) * .021 * ty / length;
        target.y -= Math.cos(a) * .021 * tx / length;
        target.z += Math.sin(a) * .021; return target;
      }
    }
    const g = new THREE.TubeGeometry(new Fibre(), 48, .0175, 6, false);
    const along = new Float32Array(g.getAttribute('position').count);
    for (let i = 0; i < along.length; i++) along[i] = g.getAttribute('uv').getX(i);
    g.setAttribute('fuseAlong', new THREE.Float32BufferAttribute(along, 1)); pieces.push(g);
  }
  braidGeometry = mergeGeometries(pieces)!; pieces.forEach(p => p.dispose()); braidGeometry.userData.shared = true;
  return braidGeometry;
}
function glow(): THREE.CanvasTexture {
  if (glowMap) return glowMap;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const c = canvas.getContext('2d')!, g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, '#fffde7'); g.addColorStop(.18, '#ffe29c'); g.addColorStop(.48, '#ff9f2677'); g.addColorStop(1, '#ff520000');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  glowMap = new THREE.CanvasTexture(canvas); glowMap.colorSpace = THREE.SRGBColorSpace; glowMap.userData.shared = true; return glowMap;
}
export function createCrateFuse(): CrateFuse {
  const root = new THREE.Group(); root.name = 'Chunky braided TNT fuse with flexible follow-through';
  const fraction = { value: 1 }, lit = { value: 0 }, clock = { value: 0 }, bend = { value: 0 };
  const rope = new THREE.MeshStandardMaterial({ color: 0xd6a452, roughness: .86 });
  rope.userData.levelDepthFade = false;
  rope.onBeforeCompile = shader => {
    shader.uniforms.fuseFraction = fraction; shader.uniforms.fuseLit = lit; shader.uniforms.fuseClock = clock; shader.uniforms.fuseBend = bend;
    shader.vertexShader = `attribute float fuseAlong; varying float vFuseAlong; uniform float fuseClock; uniform float fuseBend; uniform float fuseLit;\n${shader.vertexShader}`.replace('#include <begin_vertex>', `#include <begin_vertex>
      vFuseAlong = fuseAlong;
      float weight = fuseAlong * fuseAlong;
      transformed.x += weight * (.018 * sin(fuseClock * 2.2 - fuseAlong * 2.0) + fuseBend * .13 + fuseLit * .004 * sin(fuseClock * 29.0 - fuseAlong * 5.0));
      transformed.z += weight * .016 * sin(fuseClock * 1.8 - fuseAlong * 2.6);
    `);
    shader.fragmentShader = `uniform float fuseFraction; uniform float fuseLit; varying float vFuseAlong;\n${shader.fragmentShader}`.replace('#include <color_fragment>', `#include <color_fragment>
      if (vFuseAlong > fuseFraction) discard;
      float scorch = (1.0 - smoothstep(0.0, .085, fuseFraction - vFuseAlong)) * fuseLit;
      diffuseColor.rgb *= .9 + .1 * sin(vFuseAlong * 360.0);
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.025, .009, .003), scorch);
    `);
  };
  rope.customProgramCacheKey = () => 'chunky-tnt-braid-v3';
  const mesh = new THREE.Mesh(braid(), rope); root.add(mesh);
  const collar = new THREE.Mesh(new THREE.TorusGeometry(.047, .011, 6, 16), new THREE.MeshStandardMaterial({ color: 0x6b3e20, roughness: .8 }));
  collar.rotation.x = Math.PI / 2; collar.position.y = .465; root.add(collar);
  const tip = new THREE.Group(), ember = new THREE.Mesh(new THREE.IcosahedronGeometry(.072, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.65, .28), toneMapped: false }));
  ember.name = 'White-hot fuse ember';
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xffbe45, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  halo.scale.setScalar(.52);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xfff4c4, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, toneMapped: false }));
  corona.scale.setScalar(.23);
  tip.add(ember, halo, corona); tip.visible = false; root.add(tip);
  // Tapered volumes retain a visible width from every side, including at 480p.
  // Share their eight-triangle geometry; each fuse updates one instanced draw.
  if (!sparkGeometry) { sparkGeometry = new THREE.OctahedronGeometry(1, 0); sparkGeometry.userData.shared = true; }
  const sparks = new THREE.InstancedMesh(sparkGeometry, new THREE.MeshBasicMaterial({ transparent: true, opacity: .95, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }), SPARK_COUNT);
  sparks.name = 'TNT fuse spark spray'; sparks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparkPose.position.setScalar(0); sparkPose.quaternion.identity(); sparkPose.scale.setScalar(0); sparkPose.updateMatrix();
  for (let i = 0; i < SPARK_COUNT; i++) { sparks.setMatrixAt(i, sparkPose.matrix); sparks.setColorAt(i, sparkColor.setRGB(3, 1.6, .25)); }
  sparks.instanceColor!.setUsage(THREE.DynamicDrawUsage);
  sparks.visible = false; sparks.frustumCulled = false; root.add(sparks);
  return { root, tip, sparks, fraction, lit, clock, bend, velocity: 0 };
}
export function kickCrateFuse(fuse: CrateFuse, strength: number): void { fuse.velocity += strength * 3.5; }
export function updateCrateFuse(fuse: CrateFuse, remaining: number | undefined, time: number, dt: number): void {
  const active = remaining !== undefined && remaining > 0;
  fuse.fraction.value = remaining === undefined ? 1 : THREE.MathUtils.clamp(remaining / CONST.tntFuse, 0, 1);
  fuse.lit.value = active ? 1 : 0; fuse.clock.value = time; fuse.tip.visible = fuse.sparks.visible = active;
  const step = Math.min(.04, Math.max(0, dt));
  fuse.velocity += (-fuse.bend.value * 64 - fuse.velocity * 7) * step;
  fuse.bend.value += fuse.velocity * step;
  if (!active) return;
  point(fuse.fraction.value, fuse.tip.position); fuse.tip.scale.setScalar(1 + Math.sin(time * 67) * .09 + Math.sin(time * 109) * .04);
  const t = fuse.fraction.value, weight = t * t;
  fuse.tip.position.x += weight * (.018 * Math.sin(time * 2.2 - t * 2) + fuse.bend.value * .13 + fuse.lit.value * .004 * Math.sin(time * 29 - t * 5));
  fuse.tip.position.z += weight * .016 * Math.sin(time * 1.8 - t * 2.6);
  const tip = fuse.tip.position;
  for (let i = 0; i < SPARK_COUNT; i++) {
    const age = (time * 2.6 + i / SPARK_COUNT) % 1, a = i * 2.39996;
    const speed = .24 + (i % 4) * .05, x = Math.cos(a) * speed, z = Math.sin(a) * speed, y = .32 + (i % 3) * .09;
    const tail = Math.max(0, age - .22);
    sparkHead.set(tip.x + x * age, tip.y + y * age - .34 * age * age, tip.z + z * age);
    sparkTail.set(tip.x + x * tail, tip.y + y * tail - .34 * tail * tail, tip.z + z * tail);
    sparkAxis.subVectors(sparkHead, sparkTail);
    const length = sparkAxis.length(), fade = 1 - age * age;
    sparkPose.position.copy(sparkHead).add(sparkTail).multiplyScalar(.5);
    sparkPose.quaternion.setFromUnitVectors(sparkUp, length > 1e-6 ? sparkAxis.divideScalar(length) : sparkUp);
    const width = (.012 + (i % 3) * .003) * fade;
    sparkPose.scale.set(width, Math.max(.003, length * .5), width); sparkPose.updateMatrix();
    fuse.sparks.setMatrixAt(i, sparkPose.matrix);
    fuse.sparks.setColorAt(i, sparkColor.setRGB(3 * fade, (1.7 - age) * fade, .22 * fade));
  }
  fuse.sparks.instanceMatrix.needsUpdate = true; fuse.sparks.instanceColor!.needsUpdate = true;
}
