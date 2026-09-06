import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  CAMPAIGN_ISLANDS,
  CAMPAIGN_LEVELS,
  CAMPAIGN_MAP_EDGES,
  campaignLevelByKey,
  type CampaignLevelProgress,
  type CampaignMapDirection,
  type CampaignMapEdgeDefinition,
  type CampaignMapTravelStyle,
} from "./campaign";
import { CoastWater } from "./water";

export interface CampaignMapPose {
  position: THREE.Vector3;
  heading: THREE.Vector3;
}

export interface CampaignMapTravelSample {
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  style: CampaignMapTravelStyle;
  duration: number;
}

interface MapNodeVisual {
  key: string;
  position: THREE.Vector3;
  padMaterial: THREE.MeshStandardMaterial;
  rimMaterial: THREE.MeshStandardMaterial;
  ring: THREE.Mesh<THREE.TorusGeometry, THREE.MeshBasicMaterial>;
  beacon: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshBasicMaterial>;
  lock: THREE.Group;
  rewards: THREE.Object3D[];
  cleared: boolean;
  unlocked: boolean;
  unlockReveal: number;
}

interface MapEdgeVisual {
  definition: CampaignMapEdgeDefinition;
  curve: THREE.CatmullRomCurve3;
  length: number;
  bedMaterial: THREE.MeshStandardMaterial;
  glowMaterial: THREE.MeshStandardMaterial;
  railMaterial: THREE.MeshStandardMaterial | null;
  supportMaterial: THREE.MeshStandardMaterial | null;
  unlocked: boolean;
}

interface MapWaterfallRibbon {
  mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  baseX: number;
  phase: number;
}

export interface CampaignWorldMapBuild {
  runtime: CampaignWorldMapRuntime;
  water: CoastWater;
  groundMeshes: THREE.Mesh[];
}

const MAP_FORWARD = new THREE.Vector3(0, 0, -1);
const MAP_SEA_LEVEL = -1.15;
const MAP_HUB_SCALE = 0.7;
const hubRadius = (boss?: boolean): number => (boss ? 2.9 : 2.35) * MAP_HUB_SCALE;

function seeded(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function stableSeed(value: string): number {
  let seed = 0x811c9dc5;
  for (let index = 0; index < value.length; index++)
    seed = Math.imul(seed ^ value.charCodeAt(index), 0x01000193);
  return seed >>> 0;
}

function mixColor(a: number, b: number, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), t);
}

function organicIslandOutline(segments: number, seed: number): number[] {
  const random = seeded(seed ^ 0x6ac690c5);
  const phaseA = random() * Math.PI * 2;
  const phaseB = random() * Math.PI * 2;
  let noise = Array.from({ length: segments }, () => random() - 0.5);
  for (let pass = 0; pass < 3; pass++)
    noise = noise.map((value, index) =>
      value * 0.42 +
      noise[(index + segments - 1) % segments] * 0.29 +
      noise[(index + 1) % segments] * 0.29,
    );
  return noise.map((value, index) => {
    const angle = (index / segments) * Math.PI * 2;
    return 1 +
      Math.sin(angle + phaseA) * 0.105 +
      Math.cos(angle * 2 - phaseB) * 0.075 +
      Math.sin(angle * 4 + phaseB * 0.7) * 0.035 +
      value * 0.2;
  });
}

function islandGeometry(
  radiusX: number,
  radiusZ: number,
  seed: number,
  supports: readonly THREE.Vector3[] = [],
): THREE.BufferGeometry {
  const segments = 128;
  const rings = 36;
  const outline = organicIslandOutline(segments, seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings; ring++) {
    const radius = 1.1 * (1 - ring / rings);
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const x = Math.cos(angle) * radiusX * radius * outline[index];
      const z = Math.sin(angle) * radiusZ * radius * outline[index];
      const interior = 1 - THREE.MathUtils.smoothstep(radius, 0.72, 0.99);
      let y = radius > 1
        ? -0.36 - Math.pow((radius - 1) / 0.1, 1.35) * 3.1
        : -0.36 + THREE.MathUtils.smoothstep(1 - radius, 0, 0.3) * 1.25;
      const hills = Math.sin(x * 0.17 + 0.7) * Math.cos(z * 0.2 - 1.2) * 0.42 +
        Math.sin(x * 0.34 + z * 0.16) * 0.16;
      y += interior * (hills + 0.35);
      const baseY = y;
      let nearestDistance = Infinity;
      let nearestY = y;
      for (const support of supports) {
        const distanceSq = (x - support.x) ** 2 + (z - support.z) ** 2;
        const weight = Math.exp(-distanceSq / 14);
        y = Math.max(y, baseY + Math.max(0, support.y - 0.38 - baseY) * weight);
        if (distanceSq < nearestDistance) {
          nearestDistance = distanceSq;
          nearestY = support.y - 0.38;
        }
      }
      if (nearestDistance < 12)
        y = THREE.MathUtils.lerp(y, nearestY, 1 - THREE.MathUtils.smoothstep(nearestDistance, 1, 12));
      const beachEdge = 0.81 + Math.sin(angle * 3 + 1) * 0.035;
      const grass = 1 - THREE.MathUtils.smoothstep(radius, beachEdge - 0.07, beachEdge + 0.02);
      const sand = mixColor(0xd59d65, 0xffe5ad, THREE.MathUtils.smoothstep(y, -0.8, 0.25));
      const meadow = mixColor(0x3f8c57, 0x92c96c, 0.48 + hills * 0.6);
      const color = sand.lerp(meadow, grass);
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let ring = 0; ring < rings - 1; ring++) {
    for (let index = 0; index < segments; index++) {
      const next = (index + 1) % segments;
      const a = ring * segments + index;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + index;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const centre = positions.length / 3;
  positions.push(0, 1.15, 0);
  const top = new THREE.Color(0x6fa45d);
  colors.push(top.r, top.g, top.b);
  const lastRing = (rings - 1) * segments;
  for (let index = 0; index < segments; index++) {
    indices.push(lastRing + index, centre, lastRing + ((index + 1) % segments));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function shallowShelfGeometry(
  radiusX: number,
  radiusZ: number,
  seed: number,
): THREE.BufferGeometry {
  const random = seeded(seed ^ 0x5f3759df);
  const segments = 64;
  const rings = [
    { radius: 1.34, y: -0.68, color: 0x318b86 },
    { radius: 1.21, y: -0.42, color: 0x9fba78 },
    { radius: 1.1, y: -0.22, color: 0xe5ca82 },
    { radius: 1.01, y: -0.11, color: 0xf8dfa1 },
  ] as const;
  const outline = organicIslandOutline(segments, seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings.length; ring++) {
    const band = rings[ring];
    const color = new THREE.Color(band.color);
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = band.radius * outline[index];
      const x = Math.cos(angle) * radiusX * radius;
      const z = Math.sin(angle) * radiusZ * radius;
      positions.push(x, band.y + (random() - 0.5) * 0.035, z);
      colors.push(color.r, color.g, color.b);
      uvs.push(x / 12, z / 12);
    }
  }
  for (let ring = 0; ring < rings.length - 1; ring++) {
    for (let index = 0; index < segments; index++) {
      const next = (index + 1) % segments;
      const a = ring * segments + index;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + index;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const centre = positions.length / 3;
  positions.push(0, -0.1, 0);
  const centreColor = new THREE.Color(0xf9e5ad);
  colors.push(centreColor.r, centreColor.g, centreColor.b);
  uvs.push(0, 0);
  const innerRing = (rings.length - 1) * segments;
  for (let index = 0; index < segments; index++)
    indices.push(innerRing + index, centre, innerRing + ((index + 1) % segments));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function mountainGeometry(radius: number, height: number, seed: number): THREE.BufferGeometry {
  const random = seeded(seed * 1879);
  const segments = 64;
  const rings = 36;
  const phase = random() * Math.PI * 2;
  const profile = [1, 0.98, 0.84, 0.85, 0.65, 0.66, 0.5, 0.48, 0.34, 0.27, 0.045];
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const profileT = t * (profile.length - 1);
    const band = Math.min(profile.length - 2, Math.floor(profileT));
    const taper = THREE.MathUtils.lerp(
      profile[band], profile[band + 1],
      THREE.MathUtils.smoothstep(profileT - band, 0, 1),
    );
    const centreX = Math.sin(t * 3.7 + phase) * radius * 0.2 * t;
    const centreZ = Math.cos(t * 4 + phase) * radius * 0.14 * t;
    const color = t < 0.25
      ? mixColor(0x557953, 0x82968e, t / 0.25)
      : mixColor(0x82968e, 0xb9b49d, (t - 0.25) / 0.75);
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const ridge = 1 + Math.sin(angle * 5 + phase) * 0.09 +
        Math.sin(angle * 3 - phase + t * 3.8) * 0.07 +
        Math.sin(angle * 9 + t * 5) * 0.022;
      const faceLight = 0.9 + Math.sin(angle * 5 + phase) * 0.07;
      positions.push(
        centreX + Math.cos(angle) * radius * taper * ridge,
        t * height + Math.sin(angle * 3 + phase) * Math.sin(t * Math.PI) * height * 0.018,
        centreZ + Math.sin(angle) * radius * taper * ridge,
      );
      colors.push(
        Math.min(1, color.r * faceLight),
        Math.min(1, color.g * faceLight),
        Math.min(1, color.b * faceLight),
      );
    }
  }
  for (let ring = 0; ring < rings; ring++) {
    for (let index = 0; index < segments; index++) {
      const next = (index + 1) % segments;
      const a = ring * segments + index;
      const b = ring * segments + next;
      const c = (ring + 1) * segments + index;
      const d = (ring + 1) * segments + next;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function palmFrondGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const segments = 18;
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const width = Math.pow(Math.sin(t * Math.PI), 0.68) * 0.68 * (index % 2 ? 0.89 : 1);
    const z = t * 3.7;
    const y = Math.sin(t * Math.PI) * 0.9 - t * t * 1.05;
    for (const side of [-1, 0, 1]) {
      positions.push(side * width, y + (side === 0 ? width * 0.24 : 0), z);
      const color = mixColor(0x296c4e, 0x84ba5c, Math.sin(t * Math.PI * 0.85) * 0.8 + (side === 0 ? 0.15 : 0));
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let index = 0; index < segments; index++) {
    for (let side = 0; side < 2; side++) {
      const a = index * 3 + side;
      indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function palmTrunkGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(0.14, 0.29, 4.7, 12, 22);
  geometry.translate(0, 2.35, 0);
  const points = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < points.count; i++) {
    const t = points.getY(i) / 4.7;
    points.setX(i, points.getX(i) + 0.85 * t * t - Math.sin(t * Math.PI) * 0.2);
    const rib = Math.cos(t * Math.PI * 38) * 0.08;
    const color = mixColor(0x8d6044, 0xdbb878, THREE.MathUtils.clamp(t * 0.7 + 0.18 + rib, 0, 1));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function foliageGeometry(): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = i * 2.4;
    const piece = new THREE.SphereGeometry(0.55, 12, 8);
    piece.scale(1, 0.86 + (i % 2) * 0.35, 0.85);
    piece.translate(Math.cos(angle) * 0.34, (i % 2) * 0.28, Math.sin(angle) * 0.34);
    pieces.push(piece);
  }
  const geometry = mergeGeometries(pieces)!;
  pieces.forEach((piece) => piece.dispose());
  const points = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < points.count; i++) {
    const brightness = THREE.MathUtils.smoothstep(points.getY(i), -0.5, 0.9);
    const color = mixColor(0x65866a, 0xc6e1bb, brightness);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function rockGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.SphereGeometry(1, 20, 14);
  const points = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), y = points.getY(i), z = points.getZ(i);
    const bulge = 1 + Math.sin(x * 3.7 + z * 2.3) * Math.sin(y * 4) * 0.08;
    points.setXYZ(i, x * bulge, y * (0.91 + Math.cos(z * 4) * 0.06), z * bulge);
    const color = mixColor(0x687e79, 0xc0c4a4, THREE.MathUtils.smoothstep(y, -0.8, 0.9));
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function flowerGeometry(): THREE.BufferGeometry {
  const petals: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const angle = i * Math.PI * 2 / 5;
    const petal = new THREE.SphereGeometry(1, 8, 6);
    petal.scale(0.16, 0.075, 0.27);
    petal.translate(0, 0, 0.19);
    petal.rotateY(angle);
    petals.push(petal);
  }
  const geometry = mergeGeometries(petals)!;
  petals.forEach((petal) => petal.dispose());
  return geometry;
}

function waterfallTexture(seed: number): THREE.DataTexture {
  const width = 64, height = 256;
  const data = new Uint8Array(width * height * 4);
  const random = seeded(seed);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const edge = Math.pow(Math.sin(x / (width - 1) * Math.PI), 0.7);
      const streak = Math.pow(Math.max(0, Math.sin(x * 1.2 + Math.sin(y * 0.04) * 0.6)), 8);
      const pulse = 0.74 + Math.sin(y / height * Math.PI * 8 + x * 0.12) * 0.2;
      const i = (y * width + x) * 4;
      data[i] = 205 + Math.floor(streak * 50);
      data[i + 1] = 242;
      data[i + 2] = 255;
      data[i + 3] = Math.floor(edge * (0.24 + streak * 0.62 + random() * 0.09) * pulse * 255);
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function makePalmBatches(root: THREE.Group): {
  trunks: THREE.InstancedMesh;
  fronds: THREE.InstancedMesh;
  coconuts: THREE.InstancedMesh;
  trunkIndex: number;
  frondIndex: number;
  coconutIndex: number;
} {
  const trunks = new THREE.InstancedMesh(
    palmTrunkGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.86 }),
    96,
  );
  const fronds = new THREE.InstancedMesh(
    palmFrondGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.68,
      side: THREE.DoubleSide,
    }),
    96 * 8,
  );
  const coconuts = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.18, 1),
    new THREE.MeshStandardMaterial({ color: 0x6e492e, roughness: 0.9 }),
    96 * 3,
  );
  trunks.name = "world map palms";
  fronds.name = "world map palm fronds";
  coconuts.name = "world map coconuts";
  root.add(trunks, fronds, coconuts);
  return {
    trunks,
    fronds,
    coconuts,
    trunkIndex: 0,
    frondIndex: 0,
    coconutIndex: 0,
  };
}

function addPalm(
  batches: ReturnType<typeof makePalmBatches>,
  x: number,
  y: number,
  z: number,
  scale: number,
  yaw: number,
): void {
  const trunkMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(scale, scale, scale),
  );
  batches.trunks.setMatrixAt(batches.trunkIndex++, trunkMatrix);
  const crownX = x + Math.cos(yaw) * 0.85 * scale;
  const crownZ = z - Math.sin(yaw) * 0.85 * scale;
  for (let index = 0; index < 8; index++) {
    const angle = yaw + (index / 8) * Math.PI * 2;
    const leafMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(
        crownX,
        y + 4.68 * scale - (index % 2) * 0.1,
        crownZ,
      ),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-0.05 - (index % 2) * 0.14, angle, 0),
      ),
      new THREE.Vector3(scale, scale, scale),
    );
    batches.fronds.setMatrixAt(batches.frondIndex++, leafMatrix);
  }
  for (let index = 0; index < 3; index++) {
    const angle = yaw + (index / 3) * Math.PI * 2;
    const coconutMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(
        crownX + Math.cos(angle) * 0.22 * scale,
        y + 4.49 * scale - index * 0.05,
        crownZ + Math.sin(angle) * 0.22 * scale,
      ),
      new THREE.Quaternion(),
      new THREE.Vector3(scale, scale, scale),
    );
    batches.coconuts.setMatrixAt(batches.coconutIndex++, coconutMatrix);
  }
}

function makeFoliageBatches(root: THREE.Group): {
  shrubs: THREE.InstancedMesh;
  flowers: THREE.InstancedMesh;
  shrubIndex: number;
  flowerIndex: number;
} {
  const shrubs = new THREE.InstancedMesh(
    foliageGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      vertexColors: true,
      roughness: 0.88,
    }),
    600,
  );
  const flowers = new THREE.InstancedMesh(
    flowerGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0x18070f,
      roughness: 0.74,
    }),
    180,
  );
  shrubs.name = "world map lush shrubs";
  flowers.name = "world map tropical flowers";
  root.add(shrubs, flowers);
  return { shrubs, flowers, shrubIndex: 0, flowerIndex: 0 };
}

function addShrub(
  batches: ReturnType<typeof makeFoliageBatches>,
  x: number,
  y: number,
  z: number,
  scale: number,
  color: number,
  flowerColor: number | null,
): void {
  if (batches.shrubIndex >= batches.shrubs.count) return;
  const shrubMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y + 0.32 * scale, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, x * 0.17 + z * 0.11, 0)),
    new THREE.Vector3(scale * 1.18, scale * 0.72, scale),
  );
  batches.shrubs.setMatrixAt(batches.shrubIndex, shrubMatrix);
  batches.shrubs.setColorAt(batches.shrubIndex++, new THREE.Color(color));
  if (flowerColor === null || batches.flowerIndex >= batches.flowers.count) return;
  const flowerMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x + scale * 0.18, y + scale * 0.78, z - scale * 0.08),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), x + z),
    new THREE.Vector3(scale, scale, scale),
  );
  batches.flowers.setMatrixAt(batches.flowerIndex, flowerMatrix);
  batches.flowers.setColorAt(batches.flowerIndex++, new THREE.Color(flowerColor));
}

function makeReefBatches(root: THREE.Group, clusterCapacity: number): {
  heads: THREE.InstancedMesh;
  fingers: THREE.InstancedMesh;
  headIndex: number;
  fingerIndex: number;
} {
  const heads = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.42, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
    }),
    clusterCapacity,
  );
  const fingers = new THREE.InstancedMesh(
    new THREE.ConeGeometry(0.12, 0.7, 6, 2),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.78,
    }),
    clusterCapacity * 4,
  );
  heads.name = "world map shallow reef heads";
  fingers.name = "world map shallow coral fingers";
  heads.userData.oceanOpaqueBackdrop = true;
  fingers.userData.oceanOpaqueBackdrop = true;
  root.add(heads, fingers);
  return { heads, fingers, headIndex: 0, fingerIndex: 0 };
}

function addReefCluster(
  batches: ReturnType<typeof makeReefBatches>,
  x: number,
  z: number,
  scale: number,
  color: number,
  yaw: number,
): void {
  if (batches.headIndex >= batches.heads.count)
    throw new Error("World-map reef head capacity exhausted");
  const headMatrix = new THREE.Matrix4().compose(
    new THREE.Vector3(x, MAP_SEA_LEVEL - 0.23, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)),
    new THREE.Vector3(scale * 1.2, scale * 0.55, scale),
  );
  batches.heads.setMatrixAt(batches.headIndex, headMatrix);
  batches.heads.setColorAt(batches.headIndex++, new THREE.Color(color));
  const fingerCount = 2 + (Math.abs(Math.round(x + z)) % 3);
  for (let index = 0; index < fingerCount; index++) {
    if (batches.fingerIndex >= batches.fingers.count)
      throw new Error("World-map coral finger capacity exhausted");
    const angle = yaw + (index / fingerCount) * Math.PI * 2;
    const fingerMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(
        x + Math.cos(angle) * 0.28 * scale,
        MAP_SEA_LEVEL - 0.36 + 0.34 * scale,
        z + Math.sin(angle) * 0.28 * scale,
      ),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.sin(angle) * 0.2, angle, Math.cos(angle) * 0.2),
      ),
      new THREE.Vector3(scale, scale, scale * (0.8 + index * 0.08)),
    );
    batches.fingers.setMatrixAt(batches.fingerIndex, fingerMatrix);
    batches.fingers.setColorAt(
      batches.fingerIndex++,
      new THREE.Color(index % 2 === 0 ? color : 0xf28a7e),
    );
  }
}

function finalizeInstances(mesh: THREE.InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function makeLock(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0x4f5363,
    emissive: 0x111521,
    roughness: 0.7,
    metalness: 0.25,
  });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.18, 0.95, 0.42), material);
  body.position.y = 0.45;
  const shackle = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.12, 7, 14, Math.PI),
    material,
  );
  shackle.position.y = 1;
  group.add(body, shackle);
  group.userData.noShadow = true;
  return group;
}

function makeReward(kind: number): THREE.Object3D {
  const material = new THREE.MeshStandardMaterial({
    color: 0x394657,
    emissive: 0x070a0d,
    roughness: 0.35,
    metalness: 0.08,
  });
  let geometry: THREE.BufferGeometry;
  if (kind === 0) {
    geometry = new THREE.OctahedronGeometry(0.34, 0);
    geometry.scale(0.58, 1.48, 0.58);
  } else if (kind === 1) {
    geometry = new THREE.DodecahedronGeometry(0.31, 0);
    geometry.scale(1, 0.78, 1);
  } else if (kind === 2) {
    geometry = new THREE.OctahedronGeometry(0.31, 0);
    geometry.rotateZ(Math.PI / 4);
    geometry.scale(1.08, 0.82, 0.72);
  } else {
    geometry = new THREE.TorusGeometry(0.28, 0.1, 7, 14);
  }
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.rewardKind = kind;
  mesh.userData.noShadow = true;
  return mesh;
}

function edgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function makeEdgeCurve(definition: CampaignMapEdgeDefinition): THREE.CatmullRomCurve3 {
  const from = campaignLevelByKey(definition.from)!;
  const to = campaignLevelByKey(definition.to)!;
  const a = new THREE.Vector3(...from.mapPosition);
  const b = new THREE.Vector3(...to.mapPosition);
  if (definition.waypoints?.length)
    return new THREE.CatmullRomCurve3(
      [a, ...definition.waypoints.map((point) => new THREE.Vector3(...point)), b],
      false,
      "catmullrom",
      0.42,
    );
  const delta = b.clone().sub(a);
  const lateral = new THREE.Vector3(-delta.z, 0, delta.x)
    .normalize()
    .multiplyScalar(Math.min(4, delta.length() * 0.08) * (definition.travel === "boardslide" ? 1 : -0.35));
  const midpoint = a.clone().lerp(b, 0.5).add(lateral);
  midpoint.y = Math.max(a.y, b.y) + (definition.lift ?? 0.45);
  return new THREE.CatmullRomCurve3([a, midpoint, b], false, "catmullrom", 0.42);
}

function pathRibbonGeometry(
  curve: THREE.CatmullRomCurve3,
  width: number,
  segments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const side = new THREE.Vector3();
  const length = curve.getLength();
  for (let index = 0; index <= segments; index++) {
    const u = index / segments;
    const point = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u);
    side.set(-tangent.z, 0, tangent.x);
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    else side.normalize();
    for (const direction of [-1, 1]) {
      positions.push(
        point.x + side.x * width * 0.5 * direction,
        point.y - 0.17,
        point.z + side.z * width * 0.5 * direction,
      );
      uvs.push(direction < 0 ? 0 : 1, u * length / 3);
    }
    if (index < segments) {
      const a = index * 2;
      const b = a + 1;
      const c = a + 2;
      const d = a + 3;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

export class CampaignWorldMapRuntime {
  private elapsed = 0;
  private readonly nodeByKey = new Map<string, MapNodeVisual>();
  private readonly edgeByKey = new Map<string, MapEdgeVisual>();
  private selectedKey = CAMPAIGN_LEVELS[0].progressKey;

  constructor(
    nodes: MapNodeVisual[],
    edges: MapEdgeVisual[],
    private readonly waterfallRibbons: MapWaterfallRibbon[],
  ) {
    for (const node of nodes) this.nodeByKey.set(node.key, node);
    for (const edge of edges)
      this.edgeByKey.set(edgeKey(edge.definition.from, edge.definition.to), edge);
  }

  keys(): readonly string[] {
    return CAMPAIGN_LEVELS.map((level) => level.progressKey);
  }

  has(key: string): boolean {
    return this.nodeByKey.has(key);
  }

  pose(key: string): CampaignMapPose | null {
    const node = this.nodeByKey.get(key);
    if (!node) return null;
    return {
      position: node.position.clone(),
      heading: MAP_FORWARD.clone(),
    };
  }

  route(from: string, to: string, progress: number): CampaignMapTravelSample | null {
    const edge = this.edgeByKey.get(edgeKey(from, to));
    if (!edge) return null;
    const forward = edge.definition.from === from;
    const u = forward ? progress : 1 - progress;
    const tangent = edge.curve.getTangentAt(THREE.MathUtils.clamp(u, 0, 1));
    if (!forward) tangent.negate();
    if (tangent.lengthSq() < 1e-6) tangent.copy(MAP_FORWARD);
    else tangent.normalize();
    const speed = edge.definition.travel === "boardslide" ? 23 : 12;
    return {
      position: edge.curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1)),
      tangent,
      style: edge.definition.travel,
      duration: THREE.MathUtils.clamp(edge.length / speed, 0.62, 1.65),
    };
  }

  neighbor(
    key: string,
    screenX: number,
    screenY: number,
    unlockedAt: (key: string) => boolean,
  ): string | null {
    if (!this.nodeByKey.has(key)) return null;
    const intentLength = Math.hypot(screenX, screenY);
    if (intentLength < 0.25) return null;
    const ix = screenX / intentLength;
    const iy = screenY / intentLength;
    const direction: CampaignMapDirection = Math.abs(ix) >= Math.abs(iy)
      ? ix >= 0 ? "right" : "left"
      : iy >= 0 ? "up" : "down";
    for (const definition of CAMPAIGN_MAP_EDGES) {
      const leavingFrom = definition.from === key;
      const leavingTo = definition.to === key;
      if (!leavingFrom && !leavingTo) continue;
      if ((leavingFrom ? definition.fromDirection : definition.toDirection) !== direction)
        continue;
      const candidateKey = leavingFrom ? definition.to : definition.from;
      if (!candidateKey || !unlockedAt(candidateKey)) continue;
      if (this.nodeByKey.has(candidateKey)) return candidateKey;
    }
    return null;
  }

  sync(
    selectedKey: string,
    progressAt: (levelId: string) => CampaignLevelProgress | null,
    unlockedAt: (key: string) => boolean,
  ): void {
    this.selectedKey = selectedKey;
    for (const definition of CAMPAIGN_LEVELS) {
      const node = this.nodeByKey.get(definition.progressKey);
      if (!node) continue;
      const progress = progressAt(definition.levelId);
      node.cleared = progress?.cleared === true;
      node.unlocked = unlockedAt(definition.progressKey);
      const selected = definition.progressKey === selectedKey;
      const color = !node.unlocked
        ? 0x56636a
        : selected
          ? 0x8cff62
          : node.cleared
            ? 0x3ed37b
            : 0x5ce66f;
      node.padMaterial.color.setHex(color);
      node.padMaterial.emissive.setHex(
        !node.unlocked ? 0x070a0c : selected ? 0x285c1d : 0x10391d,
      );
      node.padMaterial.emissiveIntensity = selected ? 1.35 : 0.75;
      node.rimMaterial.color.setHex(node.unlocked ? 0xf4ffff : 0x87979d);
      node.rimMaterial.emissive.setHex(
        !node.unlocked ? 0x263b42 : selected ? 0x79dfff : 0x326f7a,
      );
      node.rimMaterial.emissiveIntensity = selected ? 1.15 : node.unlocked ? 0.72 : 0.58;
      node.ring.material.color.setHex(node.unlocked ? 0xf8ffff : 0x9aacb2);
      node.ring.material.opacity = node.unlocked ? (selected ? 1 : 0.82) : 0.48;
      node.beacon.material.color.setHex(color);
      node.beacon.material.opacity = node.unlocked ? (selected ? 0.14 : 0.035) : 0;
      node.lock.visible = !node.unlocked;
      const rewardFlags = [
        progress?.crystal,
        progress?.boxGem,
        progress?.comboGem,
        progress?.timeRelic,
      ];
      const rewardColors = [0xd967ff, 0xeefaff, 0x69ef83, 0x59baff];
      node.rewards.forEach((reward, index) => {
        const material = (reward as THREE.Mesh).material as THREE.MeshStandardMaterial;
        const earned = rewardFlags[index] === true;
        reward.visible = earned && !selected;
        material.color.setHex(earned ? rewardColors[index] : 0x3c4650);
        material.emissive.setHex(earned ? new THREE.Color(rewardColors[index]).multiplyScalar(0.25).getHex() : 0x050709);
        reward.scale.setScalar(earned ? 0.72 : 0.48);
      });
    }
    for (const edge of this.edgeByKey.values()) {
      edge.unlocked =
        unlockedAt(edge.definition.from) && unlockedAt(edge.definition.to);
      const touchesSelection =
        edge.definition.from === selectedKey || edge.definition.to === selectedKey;
      edge.glowMaterial.color.setHex(
        !edge.unlocked ? 0x75848a : touchesSelection ? 0xffffff : 0xdffcff,
      );
      edge.glowMaterial.emissive.setHex(
        !edge.unlocked ? 0x1c3036 : touchesSelection ? 0x8fe9ff : 0x438c9a,
      );
      edge.glowMaterial.emissiveIntensity = touchesSelection ? 1.8 : 1.05;
      edge.glowMaterial.opacity = !edge.unlocked ? 0.36 : touchesSelection ? 1 : 0.8;
      edge.bedMaterial.color.setHex(edge.unlocked ? 0xaa8758 : 0x4b5357);
      edge.bedMaterial.opacity = edge.unlocked ? 0.3 : 0.06;
      if (edge.railMaterial) {
        edge.railMaterial.color.setHex(edge.unlocked ? 0xeaf7ff : 0x4b5660);
        edge.railMaterial.emissive.setHex(edge.unlocked ? (touchesSelection ? 0x356a72 : 0x182f36) : 0x07090b);
        edge.railMaterial.opacity = edge.unlocked ? 0.96 : 0.1;
      }
      if (edge.supportMaterial) {
        edge.supportMaterial.opacity = edge.unlocked ? 0.88 : 0.12;
        edge.supportMaterial.color.setHex(edge.unlocked ? 0x76513b : 0x40515a);
      }
    }
  }

  reveal(progressKeys: readonly string[]): void {
    for (const key of progressKeys) {
      const node = this.nodeByKey.get(key);
      if (node?.unlocked) node.unlockReveal = 2.4;
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    for (const node of this.nodeByKey.values()) {
      const selected = node.key === this.selectedKey;
      node.unlockReveal = Math.max(0, node.unlockReveal - dt);
      const revealProgress = node.unlockReveal > 0
        ? 1 - node.unlockReveal / 2.4
        : 1;
      const revealPulse = node.unlockReveal > 0
        ? Math.sin(revealProgress * Math.PI) * 0.34 +
          Math.sin(revealProgress * Math.PI * 7) * (1 - revealProgress) * 0.08
        : 0;
      const pulse = (selected ? 1 + Math.sin(this.elapsed * 4.2) * 0.08 : 1) + revealPulse;
      node.ring.scale.setScalar(pulse);
      node.ring.rotation.z += dt * (selected ? 0.72 : 0.18);
      node.beacon.scale.y = selected ? 1 + Math.sin(this.elapsed * 2.8) * 0.08 : 1;
      const beaconBase = !node.unlocked ? 0 : selected ? 0.14 : 0.035;
      node.beacon.material.opacity = node.unlockReveal > 0
        ? Math.max(beaconBase, 0.24 + (1 - revealProgress) * 0.38)
        : beaconBase;
      node.rewards.forEach((reward, index) => {
        reward.rotation.y += dt * (0.65 + index * 0.12);
        reward.position.y = 0.24 + Math.sin(this.elapsed * 2.1 + index) * 0.025;
      });
    }
    for (const edge of this.edgeByKey.values()) {
      const selected =
        edge.definition.from === this.selectedKey ||
        edge.definition.to === this.selectedKey;
      const base = !edge.unlocked ? 0.36 : selected ? 0.96 : 0.78;
      edge.glowMaterial.opacity = base +
        (edge.unlocked ? Math.sin(this.elapsed * 3.1 + edge.length) * 0.055 : 0);
    }
    for (const ribbon of this.waterfallRibbons) {
      ribbon.mesh.position.x = ribbon.baseX +
        Math.sin(this.elapsed * 2.7 + ribbon.phase) * 0.075;
      ribbon.mesh.material.opacity =
        0.76 + Math.sin(this.elapsed * 3.4 + ribbon.phase) * 0.08;
      if (ribbon.mesh.material.map)
        ribbon.mesh.material.map.offset.y += dt * 0.65;
    }
  }
}

export function createCampaignWorldMap(root: THREE.Group): CampaignWorldMapBuild {
  const groundMeshes: THREE.Mesh[] = [];
  const landMeshes: THREE.Mesh[] = [];
  const terrainSupports = CAMPAIGN_LEVELS.map((level) => new THREE.Vector3(...level.mapPosition));
  const edgeCurves = new Map(CAMPAIGN_MAP_EDGES.map((edge) => [edge, makeEdgeCurve(edge)]));
  for (const [edge, curve] of edgeCurves) {
    if (edge.travel !== "trail") continue;
    const count = Math.ceil(curve.getLength() / 2);
    for (let i = 0; i <= count; i++) terrainSupports.push(curve.getPointAt(i / count));
  }
  const water = new CoastWater({
    shore: [
      { x: 130, z: 76, sx: 0, sz: -1, beachSlope: 0, bedSlope: 0 },
      { x: -130, z: 76, sx: 0, sz: -1, beachSlope: 0, bedSlope: 0 },
    ],
    seaLevel: -1.15,
    shoreDirX: 0,
    shoreDirZ: -1,
    course: CAMPAIGN_LEVELS.map((level) => ({
      x: level.mapPosition[0],
      z: level.mapPosition[2],
    })),
    terrainHeight: () => -4,
    sourceCoordinates: "three",
    oceanWidth: 230,
    shoreOverlap: 42,
    shoreSampleMetres: 2,
    lateralSegments: 128,
  });
  // Keep the audited shader/passes, but tune its public parameters for the
  // elevated map lens: broader colour separation and readable rolling glints
  // survive the high, toy-diorama camera better than the gameplay-coast preset.
  water.params.shallow = { r: 0.026, g: 0.58, b: 0.57, a: 0.78 };
  water.params.deep = { r: 0.008, g: 0.18, b: 0.3, a: 1 };
  water.params.peak = { r: 0.57, g: 0.85, b: 0.89, a: 0.35 };
  water.params.wave1Height = 0.08;
  water.params.wave2Height = 0.045;
  water.params.normalStrength = 3.2;
  water.params.normalDistanceStrength = 2.4;
  water.params.normalScale = 0.48;
  water.params.reflectionStrength = 0.28;
  water.params.reflectionDistortion = 0.28;
  water.params.reflectionFresnel = 2.6;
  water.params.depthDistance = 0.72;
  water.params.causticsStart = 38;
  water.params.causticsFade = 150;
  water.params.causticsScale = 1.05;
  water.params.causticsStrength = 1.55;
  water.params.intersectionWidth = 0.42;
  water.params.intersectionScale = 2.1;
  water.reflectionScale = 0.42;
  water.markWavesDirty();
  water.group.name = "world map ocean";
  root.add(water.group);

  const islandMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  const shelfMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x071713,
    emissiveIntensity: 0.24,
  });
  const playableIslandSpecs = CAMPAIGN_ISLANDS.map((island) => {
    const hubs = island.levelKeys
      .map((key) => campaignLevelByKey(key))
      .filter((level) => level !== null);
    const x = island.centre[0];
    const z = island.centre[2];
    return {
      x,
      z,
      rx: Math.max(
        22,
        ...hubs.map((level) => Math.abs(level.mapPosition[0] - x) + 8.5),
      ),
      rz: Math.max(
        20,
        ...hubs.map((level) => Math.abs(level.mapPosition[2] - z) + 8.5),
      ),
      seed: stableSeed(island.id),
      scenic: false,
      campaignIslandId: island.id,
    };
  });
  const scenicIslandSpecs = [
    { x: -59, z: 2, rx: 3.2, rz: 2.5, seed: 1009, scenic: true, campaignIslandId: null },
    { x: 1, z: 33, rx: 2.8, rz: 2.2, seed: 1031, scenic: true, campaignIslandId: null },
    { x: 63, z: 23, rx: 3.5, rz: 2.7, seed: 1061, scenic: true, campaignIslandId: null },
    { x: 2, z: -20, rx: 3, rz: 2.3, seed: 1091, scenic: true, campaignIslandId: null },
  ] as const;
  const islandSpecs = [...playableIslandSpecs, ...scenicIslandSpecs];
  for (const spec of islandSpecs) {
    const shelf = new THREE.Mesh(
      shallowShelfGeometry(spec.rx, spec.rz, spec.seed),
      shelfMaterial,
    );
    shelf.position.set(spec.x, MAP_SEA_LEVEL, spec.z);
    shelf.name = "world map shallow caustic shelf";
    shelf.userData.edgeGrinding = false;
    shelf.userData.visualOnly = true;
    shelf.userData.oceanOpaqueBackdrop = true;
    shelf.receiveShadow = true;
    root.add(shelf);
    const mesh = new THREE.Mesh(
      islandGeometry(spec.rx, spec.rz, spec.seed, spec.scenic ? [] :
        terrainSupports.map((point) => point.clone().sub(new THREE.Vector3(spec.x, 0, spec.z)))),
      islandMaterial.clone(),
    );
    mesh.position.set(spec.x, -0.05, spec.z);
    mesh.name = spec.scenic
      ? "world map offshore islet"
      : `world map campaign island ${spec.campaignIslandId}`;
    mesh.userData.edgeGrinding = false;
    mesh.userData.visualOnly = true;
    root.add(mesh);
    landMeshes.push(mesh);
  }

  const mountainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    emissive: 0x101810,
    emissiveIntensity: 0.18,
  });
  const mountainSpecs = [
    { x: -28, z: 7, r: 7.5, h: 18.5, s: 31 },
    { x: -34, z: 8, r: 4.8, h: 13.5, s: 47 },
    { x: -23, z: 5, r: 4.3, h: 11.5, s: 59 },
    { x: 31, z: 1, r: 7.7, h: 18, s: 71 },
    { x: 25, z: 3, r: 5, h: 13.2, s: 83 },
    { x: 37, z: 0, r: 4.5, h: 11.8, s: 97 },
  ] as const;
  const mountainMeshes: THREE.Mesh[] = [];
  for (const mountain of mountainSpecs) {
    const mesh = new THREE.Mesh(
      mountainGeometry(mountain.r, mountain.h, mountain.s),
      mountainMaterial.clone(),
    );
    mesh.position.set(mountain.x, -0.08, mountain.z);
    mesh.name = "world map mountain";
    mesh.userData.edgeGrinding = false;
    mesh.userData.visualOnly = true;
    root.add(mesh);
    mountainMeshes.push(mesh);
  }
  for (const islet of scenicIslandSpecs) {
    const stack = new THREE.Mesh(
      mountainGeometry(Math.min(islet.rx, islet.rz) * 0.72, 4.5 + (islet.seed % 4), islet.seed),
      mountainMaterial.clone(),
    );
    stack.position.set(islet.x, MAP_SEA_LEVEL - 0.5, islet.z);
    stack.name = "world map offshore sea stack";
    stack.userData.edgeGrinding = false;
    stack.userData.visualOnly = true;
    root.add(stack);
  }

  // Scatter against the actual sculpt so plants meet sand, hills and shelves.
  root.updateMatrixWorld(true);
  const landRay = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 80);
  const terrainY = (x: number, z: number): number => {
    landRay.ray.origin.set(x, 50, z);
    return landRay.intersectObjects(landMeshes, false)[0]?.point.y ?? 0;
  };
  const routeSamples = [...edgeCurves.values()].flatMap((curve) => curve.getSpacedPoints(45));
  const clearsRoute = (x: number, z: number, clearance: number): boolean =>
    !routeSamples.some((point) => Math.hypot(point.x - x, point.z - z) < clearance) &&
    !CAMPAIGN_LEVELS.some((level) => Math.hypot(level.mapPosition[0] - x, level.mapPosition[2] - z) < clearance + 1.8);

  const waterfallRibbons: MapWaterfallRibbon[] = [];
  for (const [x, y, z, height] of [
    [-31.2, 4.1, 13.6, 5.6],
    [33.1, 4.1, 7.5, 5.4],
  ] as const) {
    for (let layer = 0; layer < 3; layer++) {
      const geometry = new THREE.PlaneGeometry(
        0.58 + layer * 0.23,
        height * (0.94 + layer * 0.03),
        3,
        12,
      );
      const position = geometry.getAttribute("position");
      for (let vertex = 0; vertex < position.count; vertex++) {
        const localY = position.getY(vertex);
        const t = localY / height + 0.5;
        position.setX(
          vertex,
          position.getX(vertex) +
            Math.sin(t * Math.PI * 3 + layer * 1.7) * (0.07 + t * 0.08),
        );
        position.setZ(vertex, -(t - 0.5) * 3.8);
      }
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({
        color: layer === 0 ? 0xf2ffff : layer === 1 ? 0x91e8e4 : 0x53b8c3,
        map: waterfallTexture(layer * 97 + Math.round(x * 12)),
        transparent: true,
        opacity: 0.76,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: layer === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const fall = new THREE.Mesh(geometry, material);
      fall.position.set(x + (layer - 1) * 0.17, y, z + layer * 0.025);
      fall.rotation.y = 0;
      fall.name = "world map waterfall ribbon";
      fall.userData.noShadow = true;
      root.add(fall);
      waterfallRibbons.push({ mesh: fall, baseX: fall.position.x, phase: layer * 2.1 + x });
    }
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.05, 40),
      new THREE.MeshBasicMaterial({
        color: 0x64c1c4,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(1.1, 0.68, 1);
    pool.position.set(x, terrainY(x, z + 2) + 0.08, z + 2);
    pool.name = "world map waterfall pool";
    pool.userData.noShadow = true;
    root.add(pool);
  }

  const palms = makePalmBatches(root);
  const foliage = makeFoliageBatches(root);
  const rocks = new THREE.InstancedMesh(
    rockGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }), 96,
  );
  rocks.name = "world map rounded coastal boulders";
  root.add(rocks);
  let rockCount = 0;
  const groundLeaves = new THREE.InstancedMesh(
    palmFrondGeometry(),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, side: THREE.DoubleSide }),
    600,
  );
  groundLeaves.name = "world map tropical understory";
  root.add(groundLeaves);
  let groundLeafCount = 0;
  const reefClusterCapacity = islandSpecs.reduce(
    (total, island) => total + (island.scenic ? 5 : 18),
    0,
  );
  const reefs = makeReefBatches(root, reefClusterCapacity);
  const random = seeded(7727);
  for (const island of islandSpecs) {
    const palmAttempts = island.scenic ? 2 : 58;
    for (let index = 0; index < palmAttempts; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.35 + random() * 0.42;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      const coversHub = CAMPAIGN_LEVELS.some((level) =>
        Math.abs(x - level.mapPosition[0]) < 4.3 &&
        z > level.mapPosition[2] - 1 && z < level.mapPosition[2] + 10,
      );
      if (coversHub || !clearsRoute(x, z, 4.2) || palms.trunkIndex >= palms.trunks.count) continue;
      addPalm(palms, x, terrainY(x, z), z, 0.78 + random() * 0.5, angle + Math.PI);
    }
    const shrubAttempts = island.scenic ? 8 : 180;
    for (let index = 0; index < shrubAttempts; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.28 + random() * 0.55;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      if (!clearsRoute(x, z, 1.8)) continue;
      const greens = [0x82c976, 0xa4d96d, 0x95c868, 0x75bb8d] as const;
      const flowers = [0xf35e8f, 0xff8a55, 0xaa6cf2, 0xffd65c] as const;
      addShrub(
        foliage,
        x,
        terrainY(x, z),
        z,
        0.72 + random() * 1.3,
        greens[(index + island.seed) % greens.length],
        index % 4 === 0 ? flowers[(index + island.seed) % flowers.length] : null,
      );
      if (index % 5 === 0 && groundLeafCount + 5 <= groundLeaves.count) {
        for (let leaf = 0; leaf < 5; leaf++) {
          groundLeaves.setMatrixAt(groundLeafCount++, new THREE.Matrix4().compose(
            new THREE.Vector3(x + 0.8, terrainY(x + 0.8, z), z),
            new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, leaf * 2.4 + angle, 0)),
            new THREE.Vector3(0.46, 0.6, 0.5),
          ));
        }
      }
    }
    const reefClusters = island.scenic ? 5 : 18;
    for (let index = 0; index < reefClusters; index++) {
      const angle = (index / reefClusters) * Math.PI * 2 + random() * 0.35;
      const radius = 1.11 + random() * 0.2;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      const reefColors = [0xf07d6e, 0xd55bb6, 0x6aaf83, 0xe3a35f] as const;
      addReefCluster(
        reefs,
        x,
        z,
        0.55 + random() * 0.55,
        reefColors[(index + island.seed) % reefColors.length],
        angle,
      );
    }
  }
  for (const [mountainIndex, mountain] of mountainSpecs.entries()) {
    for (let i = 0; i < 12; i++) {
      const angle = i * 2.399 + mountain.s;
      const x = mountain.x + Math.cos(angle) * mountain.r * (0.62 + random() * 0.35);
      const z = mountain.z + Math.sin(angle) * mountain.r * (0.62 + random() * 0.35);
      if (!clearsRoute(x, z, 2.7)) continue;
      const size = 1 + random() * 1.5;
      rocks.setMatrixAt(rockCount++, new THREE.Matrix4().compose(
        new THREE.Vector3(x, terrainY(x, z) + size * 0.48, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, angle, 0.15)),
        new THREE.Vector3(size * 1.2, size * (1 + random()), size),
      ));
    }
    for (let index = 0; index < 7; index++) {
      const angle = (index / 7) * Math.PI * 2 + mountain.s * 0.13;
      addShrub(
        foliage,
        mountain.x + Math.cos(angle) * mountain.r * 0.78,
        0.58 + (index % 3) * 0.16,
        mountain.z + Math.sin(angle) * mountain.r * 0.78,
        0.7 + (index % 2) * 0.2,
        index % 2 === 0 ? 0x3f9149 : 0x56a44e,
        index % 3 === 0 ? 0xee6b91 : null,
      );
    }
    const rockSurface = mountainMeshes[mountainIndex].geometry.getAttribute("position");
    for (let index = 0; index < 24; index++) {
      const row = [5, 12, 21, 29][index % 4];
      const segment = (index * 11 + mountain.s) % 64;
      const vertex = row * 64 + segment;
      addShrub(
        foliage,
        mountain.x + rockSurface.getX(vertex),
        rockSurface.getY(vertex) - 0.12,
        mountain.z + rockSurface.getZ(vertex),
        (1 - row / 48) * (0.9 + (index % 3) * 0.4),
        index % 2 === 0 ? 0x8cbd75 : 0xa3cd74,
        index % 9 === 0 ? 0xec9b95 : null,
      );
    }
  }
  finalizeInstances(palms.trunks, palms.trunkIndex);
  finalizeInstances(palms.fronds, palms.frondIndex);
  finalizeInstances(palms.coconuts, palms.coconutIndex);
  finalizeInstances(foliage.shrubs, foliage.shrubIndex);
  finalizeInstances(foliage.flowers, foliage.flowerIndex);
  finalizeInstances(rocks, rockCount);
  finalizeInstances(groundLeaves, groundLeafCount);
  finalizeInstances(reefs.heads, reefs.headIndex);
  finalizeInstances(reefs.fingers, reefs.fingerIndex);

  const edgeVisuals: MapEdgeVisual[] = [];
  for (const definition of CAMPAIGN_MAP_EDGES) {
    const curve = edgeCurves.get(definition)!;
    const length = curve.getLength();
    const bedMaterial = new THREE.MeshStandardMaterial({
      color: 0x4b5357,
      roughness: 0.97,
      metalness: 0,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
    });
    if (definition.travel === "trail") {
      const path = new THREE.Mesh(
        pathRibbonGeometry(curve, 1.42, Math.max(18, Math.ceil(length * 1.4))),
        bedMaterial,
      );
      path.name = "world map route bed";
      path.userData.noShadow = true;
      path.userData.visualOnly = true;
      root.add(path);
    } else {
      const underlay = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          Math.max(18, Math.ceil(length * 1.5)),
          0.12,
          7,
          false,
        ),
        bedMaterial,
      );
      underlay.name = "world map route bed";
      underlay.userData.noShadow = true;
      root.add(underlay);
    }
    const glowMaterial = new THREE.MeshStandardMaterial({
      color: 0x59636c,
      emissive: 0x050708,
      emissiveIntensity: 0.4,
      roughness: 0.26,
      metalness: 0.02,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    const fromRadius = hubRadius(campaignLevelByKey(definition.from)?.boss);
    const toRadius = hubRadius(campaignLevelByKey(definition.to)?.boss);
    const startU = Math.min(0.22, (fromRadius + 0.55) / length);
    const endU = Math.min(0.22, (toRadius + 0.55) / length);
    const usableLength = length * Math.max(0.25, 1 - startU - endU);
    const dashCount = Math.max(3, Math.floor(usableLength / 2));
    const dashGeometry = new THREE.CapsuleGeometry(0.3, 0.66, 3, 8);
    dashGeometry.rotateX(Math.PI / 2);
    dashGeometry.scale(1.16, 0.34, 1.08);
    const glow = new THREE.InstancedMesh(
      dashGeometry,
      glowMaterial,
      dashCount,
    );
    for (let index = 0; index < dashCount; index++) {
      const u = THREE.MathUtils.lerp(
        startU,
        1 - endU,
        (index + 0.5) / dashCount,
      );
      const point = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u).normalize();
      glow.setMatrixAt(
        index,
        new THREE.Matrix4().compose(
          point.add(new THREE.Vector3(0, 0.12, 0)),
          new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 0, 1),
            tangent,
          ),
          new THREE.Vector3(1, 1, 1),
        ),
      );
    }
    glow.instanceMatrix.needsUpdate = true;
    glow.computeBoundingSphere();
    glow.name = "world map glowing route";
    glow.userData.noShadow = true;
    root.add(glow);
    let railMaterial: THREE.MeshStandardMaterial | null = null;
    let supportMaterial: THREE.MeshStandardMaterial | null = null;
    if (definition.travel === "boardslide") {
      railMaterial = new THREE.MeshStandardMaterial({
        color: 0x53616c,
        emissive: 0x07090b,
        metalness: 0.72,
        roughness: 0.22,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
      });
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(24, Math.ceil(length * 1.8)), 0.09, 8, false),
        railMaterial,
      );
      rail.name = "world map boardslide rail";
      root.add(rail);
      const supportCount = Math.max(2, Math.floor(length / 6));
      supportMaterial = new THREE.MeshStandardMaterial({
        color: 0x40515a,
        roughness: 0.88,
        transparent: true,
        opacity: 0.12,
        depthWrite: false,
      });
      const supports = new THREE.InstancedMesh(
        new THREE.CylinderGeometry(0.11, 0.18, 1, 7),
        supportMaterial,
        supportCount,
      );
      for (let index = 0; index < supportCount; index++) {
        const point = curve.getPointAt((index + 0.5) / supportCount);
        const height = Math.max(0.45, point.y - MAP_SEA_LEVEL - 0.08);
        supports.setMatrixAt(
          index,
          new THREE.Matrix4().compose(
            new THREE.Vector3(point.x, MAP_SEA_LEVEL + height * 0.5, point.z),
            new THREE.Quaternion(),
            new THREE.Vector3(1, height, 1),
          ),
        );
      }
      supports.instanceMatrix.needsUpdate = true;
      supports.computeBoundingSphere();
      supports.name = "world map boardslide supports";
      root.add(supports);
    }
    edgeVisuals.push({
      definition,
      curve,
      length,
      bedMaterial,
      glowMaterial,
      railMaterial,
      supportMaterial,
      unlocked: false,
    });
  }

  const nodeVisuals: MapNodeVisual[] = [];
  for (const definition of CAMPAIGN_LEVELS) {
    const position = new THREE.Vector3(...definition.mapPosition);
    const group = new THREE.Group();
    // mapPosition is a feet pose. The pad top sits exactly 10 cm below it,
    // matching the campaign return-pose contract used by ordinary levels.
    group.position.copy(position).add(new THREE.Vector3(0, -0.1, 0));
    group.name = `world map hub ${definition.progressKey}`;
    root.add(group);
    const radius = hubRadius(definition.boss);
    const foundationHeight = Math.max(0.3, position.y - 1.05);
    const foundation = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 1.08,
        radius * 1.2,
        foundationHeight,
        20,
        2,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x46544d,
        emissive: 0x08100d,
        roughness: 0.9,
      }),
    );
    foundation.position.y = -0.26 - foundationHeight * 0.5;
    foundation.name = "world map hub foundation";
    foundation.userData.edgeGrinding = false;
    foundation.userData.visualOnly = true;
    group.add(foundation);
    const turf = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.13, radius * 1.16, 0.12, 24),
      new THREE.MeshStandardMaterial({
        color: 0x365b47,
        roughness: 0.98,
      }),
    );
    turf.position.y = -0.27;
    turf.name = "world map hub turf terrace";
    turf.userData.visualOnly = true;
    group.add(turf);
    const rimMaterial = new THREE.MeshStandardMaterial({
      color: 0x68727a,
      emissive: 0x080b0d,
      emissiveIntensity: 0.25,
      roughness: 0.24,
      metalness: 0.18,
    });
    const rimPlate = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.03, radius * 1.09, 0.3, 32, 1),
      rimMaterial,
    );
    rimPlate.position.y = -0.17;
    rimPlate.name = "world map luminous marker rim";
    rimPlate.userData.edgeGrinding = false;
    group.add(rimPlate);
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x59636b,
      emissive: 0x070a0c,
      emissiveIntensity: 0.7,
      roughness: 0.32,
      metalness: 0.02,
    });
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.73, radius * 0.76, 0.18, 32),
      padMaterial,
    );
    pad.position.y = -0.09;
    pad.name = "world map level hub";
    pad.userData.edgeGrinding = false;
    group.add(pad);
    groundMeshes.push(pad);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.87, 0.18 * MAP_HUB_SCALE, 12, 64),
      new THREE.MeshBasicMaterial({
        color: 0x68747d,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.075;
    ring.userData.noShadow = true;
    group.add(ring);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.54, radius * 0.7, 1.15, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x59636b,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beacon.position.y = 0.58;
    beacon.userData.noShadow = true;
    group.add(beacon);
    const lock = makeLock();
    lock.position.y = 0.4;
    lock.scale.setScalar(definition.boss ? 1.18 : 1);
    group.add(lock);
    const rewards: THREE.Object3D[] = [];
    for (let rewardIndex = 0; rewardIndex < 4; rewardIndex++) {
      const reward = makeReward(rewardIndex);
      const angle = THREE.MathUtils.lerp(-0.95, 0.95, rewardIndex / 3);
      reward.position.set(
        Math.sin(angle) * radius * 0.56,
        0.24,
        Math.cos(angle) * radius * 0.56,
      );
      group.add(reward);
      rewards.push(reward);
    }
    nodeVisuals.push({
      key: definition.progressKey,
      position,
      padMaterial,
      rimMaterial,
      ring,
      beacon,
      lock,
      rewards,
      cleared: false,
      unlocked: false,
      unlockReveal: 0,
    });
  }

  return {
    runtime: new CampaignWorldMapRuntime(
      nodeVisuals,
      edgeVisuals,
      waterfallRibbons,
    ),
    water,
    groundMeshes,
  };
}
