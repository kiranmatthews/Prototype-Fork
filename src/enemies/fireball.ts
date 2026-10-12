import * as THREE from 'three';

/** Shared by every sentry, including editor-authored and themed enemies. */
export const SENTRY_FIREBALL_SPEED = 15 * 0.7;

const FORWARD = new THREE.Vector3(0, 0, 1);
const HOT = new THREE.Color(0xfff2ae);
const GOLD = new THREE.Color(0xffbe32);
const ORANGE = new THREE.Color(0xf95312);
const RED = new THREE.Color(0xb91e08);
const COLOR = new THREE.Color();
const CAMERA_ROTATION = new THREE.Quaternion();
const PARENT_ROTATION = new THREE.Quaternion();
const SEGMENTS = 10;
const RINGS = 6;
const EMBERS = 5;
const EMBER_VERTICES = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const EMBER_INDICES = [0, 2, 4, 2, 1, 4, 1, 3, 4, 3, 0, 4, 2, 0, 5, 1, 2, 5, 3, 1, 5, 0, 3, 5];

/** Small untextured Gouraud meshes: a molten core, flickering tail and soft halo.
 * Flight/collision stay level-owned. Every buffer is allocated only at spawn;
 * the fixed-budget tail disappears with its projectile, including on respawn.
 */
export class SentryFireball extends THREE.Mesh<THREE.IcosahedronGeometry, THREE.MeshBasicMaterial> {
  private readonly rest: Float32Array;
  private readonly tail: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private readonly halo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  private age = 0;

  constructor(direction: THREE.Vector3, private readonly phase = 0) {
    const geometry = new THREE.IcosahedronGeometry(0.36, 1);
    (geometry.getAttribute('position') as THREE.BufferAttribute).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(
      new Float32Array(geometry.getAttribute('position').count * 3), 3,
    ).setUsage(THREE.DynamicDrawUsage));
    super(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
    this.name = 'Sentry Gouraud fireball';
    this.quaternion.setFromUnitVectors(FORWARD, direction.clone().normalize());
    this.rest = new Float32Array(geometry.getAttribute('position').array);
    // The core ripples slightly beyond its source icosahedron.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 0.4);

    const tailGeometry = new THREE.BufferGeometry();
    const count = RINGS * SEGMENTS + EMBERS * 6;
    tailGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * 3), 3).setUsage(THREE.DynamicDrawUsage));
    tailGeometry.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(count * 4), 4).setUsage(THREE.DynamicDrawUsage));
    const indices: number[] = [];
    for (let r = 0; r < RINGS - 1; r++) for (let s = 0; s < SEGMENTS; s++) {
      const a = r * SEGMENTS + s, b = r * SEGMENTS + (s + 1) % SEGMENTS;
      indices.push(a, b, a + SEGMENTS, b, b + SEGMENTS, a + SEGMENTS);
    }
    for (let e = 0; e < EMBERS; e++) for (const i of EMBER_INDICES) indices.push(RINGS * SEGMENTS + e * 6 + i);
    tailGeometry.setIndex(indices);
    tailGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -0.8), 1.6);
    this.tail = new THREE.Mesh(tailGeometry, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, depthWrite: false,
      side: THREE.DoubleSide, toneMapped: false, forceSinglePass: true,
    }));
    this.tail.name = 'Gouraud flame tongues and embers';
    this.add(this.tail);

    // A triangle fan with a transparent rim: interpolation supplies the glow,
    // just like the game's puffs. No texture, light, bloom or fragment shader.
    const haloGeometry = new THREE.CircleGeometry(0.53, 12);
    const haloColors = new Float32Array(haloGeometry.getAttribute('position').count * 4);
    for (let i = 0; i < haloColors.length / 4; i++) {
      haloColors.set([GOLD.r, GOLD.g, GOLD.b, i === 0 ? 0.5 : 0], i * 4);
    }
    haloGeometry.setAttribute('color', new THREE.Float32BufferAttribute(haloColors, 4));
    this.halo = new THREE.Mesh(haloGeometry, new THREE.MeshBasicMaterial({
      vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false, side: THREE.DoubleSide, forceSinglePass: true,
    }));
    this.halo.name = 'Gouraud fireball halo';
    this.halo.onBeforeRender = (_renderer, _scene, camera) => {
      camera.getWorldQuaternion(CAMERA_ROTATION);
      this.getWorldQuaternion(PARENT_ROTATION).invert();
      this.halo.quaternion.copy(PARENT_ROTATION).multiply(CAMERA_ROTATION);
      this.halo.updateMatrixWorld();
    };
    this.add(this.halo);
    this.update(0);
  }

  update(dt: number): void {
    this.age += dt;
    const t = this.age, wave = t * 9 + this.phase;
    const positions = this.geometry.getAttribute('position');
    const colors = this.geometry.getAttribute('color');
    for (let i = 0; i < positions.count; i++) {
      const x = this.rest[i * 3], y = this.rest[i * 3 + 1], z = this.rest[i * 3 + 2];
      const ripple = Math.sin(x * 15 + y * 11 + wave) * Math.cos(z * 12 - wave * 0.7);
      const radius = 1 + ripple * 0.065;
      positions.setXYZ(i, x * radius, y * radius, z * radius);
      const heat = THREE.MathUtils.clamp(0.5 + y * 0.6 + z * 0.6 + ripple * 0.18, 0, 1);
      if (heat < 0.5) COLOR.copy(ORANGE).lerp(GOLD, heat * 2);
      else COLOR.copy(GOLD).lerp(HOT, (heat - 0.5) * 2);
      colors.setXYZ(i, COLOR.r, COLOR.g, COLOR.b);
    }
    positions.needsUpdate = colors.needsUpdate = true;

    const tailPositions = this.tail.geometry.getAttribute('position');
    const tailColors = this.tail.geometry.getAttribute('color');
    // Grow out of the muzzle over the first 0.12s instead of flashing a tail
    // through the shooter. The head remains exactly on its flight trajectory.
    const growth = Math.min(1, t / 0.12);
    for (let r = 0; r < RINGS; r++) for (let s = 0; s < SEGMENTS; s++) {
      const u = r / (RINGS - 1), angle = s / SEGMENTS * Math.PI * 2;
      const flicker = Math.sin(angle * 3 - wave + u * 8);
      const radius = (0.28 * (1 - u) + Math.sin(u * Math.PI) * 0.075) * (1 + flicker * 0.2);
      const z = -0.12 - growth * (u * 1.12 + u * flicker * 0.12);
      const bend = Math.sin(wave * 0.65 - u * 5) * u * 0.09;
      const i = r * SEGMENTS + s;
      tailPositions.setXYZ(i, Math.cos(angle) * radius + bend, Math.sin(angle) * radius + u * u * 0.1, z);
      if (u < 0.4) COLOR.copy(GOLD).lerp(ORANGE, u / 0.4);
      else COLOR.copy(ORANGE).lerp(RED, (u - 0.4) / 0.6);
      tailColors.setXYZW(i, COLOR.r, COLOR.g, COLOR.b, (1 - u) * 0.88 * growth);
    }
    for (let e = 0; e < EMBERS; e++) {
      const u = (t * (1.1 + e * 0.07) + e / EMBERS) % 1;
      const angle = e * 2.4 + this.phase + u * 1.1;
      const spread = 0.12 + u * 0.28;
      const size = (1 - u) * 0.045;
      const x = Math.cos(angle) * spread, y = Math.sin(angle) * spread + u * u * 0.16;
      COLOR.copy(GOLD).lerp(ORANGE, u);
      for (let v = 0; v < 6; v++) {
        const i = RINGS * SEGMENTS + e * 6 + v, p = EMBER_VERTICES[v];
        tailPositions.setXYZ(i, x + p[0] * size, y + p[1] * size, -growth * (0.4 + u * 1.3) + p[2] * size * 2);
        tailColors.setXYZW(i, COLOR.r, COLOR.g, COLOR.b, (1 - u) * growth);
      }
    }
    tailPositions.needsUpdate = tailColors.needsUpdate = true;
    this.halo.scale.setScalar(1 + Math.sin(wave * 0.8) * 0.055);
  }

  dispose(): void {
    this.removeFromParent();
    for (const mesh of [this, this.tail, this.halo]) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
  }
}
