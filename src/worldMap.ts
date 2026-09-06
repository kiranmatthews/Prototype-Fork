import * as THREE from "three";
import {
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
  glowMaterial: THREE.MeshBasicMaterial;
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

function islandGeometry(
  radiusX: number,
  radiusZ: number,
  seed: number,
): THREE.BufferGeometry {
  const random = seeded(seed);
  const segments = 40;
  const rings = [
    { radius: 1.2, y: -3.35, color: 0x665248 },
    { radius: 1.12, y: -1.18, color: 0xc08b5d },
    { radius: 1, y: -0.32, color: 0xf3ca7d },
    { radius: 0.86, y: 0.34, color: 0x8fcf64 },
    { radius: 0.62, y: 0.88, color: 0x459850 },
  ] as const;
  const radialNoise = Array.from({ length: segments }, () => 0.84 + random() * 0.28);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings.length; ring++) {
    const band = rings[ring];
    const color = new THREE.Color(band.color);
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const ripple =
        radialNoise[index] *
        (1 + Math.sin(angle * 3 + seed) * 0.045 + Math.sin(angle * 7 - seed) * 0.025);
      positions.push(
        Math.cos(angle) * radiusX * band.radius * ripple,
        band.y + (random() - 0.5) * 0.12,
        Math.sin(angle) * radiusZ * band.radius * ripple,
      );
      colors.push(color.r, color.g, color.b);
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
  positions.push(0, 0.92, 0);
  const top = new THREE.Color(0x45934d);
  colors.push(top.r, top.g, top.b);
  const lastRing = (rings.length - 1) * segments;
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
  const segments = 48;
  const rings = [
    { radius: 1.48, y: -0.62, color: 0x438f83 },
    { radius: 1.28, y: -0.38, color: 0xb6b879 },
    { radius: 1.08, y: -0.2, color: 0xe8cd88 },
    { radius: 0.82, y: -0.12, color: 0xf6dda0 },
  ] as const;
  const outline = Array.from({ length: segments }, () => 0.88 + random() * 0.22);
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
  const segments = 14;
  const rings = 8;
  const radialNoise = Array.from({ length: segments }, () => 0.78 + random() * 0.38);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring <= rings; ring++) {
    const t = ring / rings;
    const taper = Math.max(0.025, Math.pow(1 - t, 0.72));
    const centreX = Math.sin(t * 4.4 + seed) * radius * 0.1 * t;
    const centreZ = Math.cos(t * 3.7 + seed * 0.31) * radius * 0.08 * t;
    const color = t < 0.3
      ? mixColor(0x477a55, 0x63705b, t / 0.3)
      : t < 0.78
        ? mixColor(0x63705b, 0x887763, (t - 0.3) / 0.48)
        : mixColor(0x887763, 0xc5a778, (t - 0.78) / 0.22);
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const ridge =
        radialNoise[index] *
        (1 + Math.sin(angle * 3 + t * 5 + seed) * 0.11 * (1 - t));
      positions.push(
        centreX + Math.cos(angle) * radius * taper * ridge,
        t * height,
        centreZ + Math.sin(angle) * radius * taper * ridge,
      );
      colors.push(color.r, color.g, color.b);
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
  const uvs: number[] = [];
  const indices: number[] = [];
  const segments = 7;
  for (let index = 0; index <= segments; index++) {
    const t = index / segments;
    const width = Math.sin(Math.pow(1 - t, 0.7) * Math.PI * 0.48) * 0.48;
    const z = t * 3.5;
    const y = -0.72 * t * t + Math.sin(t * Math.PI) * 0.16;
    positions.push(-width, y, z, width, y, z);
    uvs.push(0, t, 1, t);
  }
  for (let index = 0; index < segments; index++) {
    const a = index * 2;
    const b = a + 1;
    const c = a + 2;
    const d = a + 3;
    indices.push(a, c, b, b, c, d);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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
    new THREE.CylinderGeometry(0.16, 0.27, 4.4, 7, 3),
    new THREE.MeshStandardMaterial({ color: 0xa96e3e, roughness: 0.92 }),
    96,
  );
  const fronds = new THREE.InstancedMesh(
    palmFrondGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0x43a94f,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
    96 * 6,
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
    new THREE.Vector3(x, y + 2.05 * scale, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0.07, yaw, 0.06)),
    new THREE.Vector3(scale, scale, scale),
  );
  batches.trunks.setMatrixAt(batches.trunkIndex++, trunkMatrix);
  for (let index = 0; index < 6; index++) {
    const angle = yaw + (index / 6) * Math.PI * 2;
    const leafMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(
        x + Math.sin(angle) * 0.66 * scale,
        y + 4.24 * scale - (index % 2) * 0.12,
        z + Math.cos(angle) * 0.66 * scale,
      ),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-0.24 - (index % 2) * 0.09, angle, 0),
      ),
      new THREE.Vector3(scale, scale, scale),
    );
    batches.fronds.setMatrixAt(batches.frondIndex++, leafMatrix);
  }
  for (let index = 0; index < 3; index++) {
    const angle = yaw + (index / 3) * Math.PI * 2;
    const coconutMatrix = new THREE.Matrix4().compose(
      new THREE.Vector3(
        x + Math.cos(angle) * 0.22 * scale,
        y + 4.03 * scale - index * 0.05,
        z + Math.sin(angle) * 0.22 * scale,
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
    new THREE.IcosahedronGeometry(0.72, 1),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.96,
    }),
    220,
  );
  const flowers = new THREE.InstancedMesh(
    new THREE.OctahedronGeometry(0.13, 0),
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

function makeNodeLabel(text: string, boss: boolean): THREE.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 160;
  const context = canvas.getContext("2d")!;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.font = `${boss ? 76 : 64}px Roo, Impact, sans-serif`;
  context.lineWidth = 16;
  context.strokeStyle = "rgba(32,31,41,.92)";
  context.strokeText(text.toUpperCase(), 256, 80);
  context.fillStyle = boss ? "#ffd65a" : "#fff5c7";
  context.fillText(text.toUpperCase(), 256, 80);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }),
  );
  sprite.scale.set(boss ? 11 : 9, boss ? 3.45 : 2.82, 1);
  sprite.userData.noShadow = true;
  return sprite;
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

function addBossCrown(root: THREE.Group, radius: number): void {
  const material = new THREE.MeshStandardMaterial({
    color: 0x6f5962,
    emissive: 0x251824,
    roughness: 0.75,
  });
  for (let index = 0; index < 7; index++) {
    const angle = (index / 7) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 6), material);
    spike.position.set(Math.cos(angle) * radius, 0.72, Math.sin(angle) * radius);
    spike.rotation.z = -Math.cos(angle) * 0.5;
    spike.rotation.x = Math.sin(angle) * 0.5;
    root.add(spike);
  }
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
        ? 0x53606b
        : node.cleared
          ? 0x4bbf9b
          : selected
            ? 0xffc84b
            : 0xf29b48;
      node.padMaterial.color.setHex(node.unlocked ? 0xe9b963 : 0x56616a);
      node.padMaterial.emissive.setHex(node.unlocked ? (selected ? 0x4a2607 : 0x1a260f) : 0x090d12);
      node.ring.material.color.setHex(color);
      node.ring.material.opacity = node.unlocked ? (selected ? 1 : 0.72) : 0.3;
      node.beacon.material.color.setHex(color);
      node.beacon.material.opacity = node.unlocked ? (selected ? 0.28 : 0.13) : 0.06;
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
        material.color.setHex(earned ? rewardColors[index] : 0x3c4650);
        material.emissive.setHex(earned ? new THREE.Color(rewardColors[index]).multiplyScalar(0.25).getHex() : 0x050709);
        reward.scale.setScalar(earned ? 1 : 0.72);
      });
    }
    for (const edge of this.edgeByKey.values()) {
      edge.unlocked =
        unlockedAt(edge.definition.from) && unlockedAt(edge.definition.to);
      const touchesSelection =
        edge.definition.from === selectedKey || edge.definition.to === selectedKey;
      edge.glowMaterial.color.setHex(
        !edge.unlocked ? 0x55616c : touchesSelection ? 0xffd45a : 0x8ee8d0,
      );
      edge.glowMaterial.opacity = !edge.unlocked ? 0.16 : touchesSelection ? 0.95 : 0.56;
      edge.bedMaterial.color.setHex(edge.unlocked ? 0x745332 : 0x3c4b52);
      edge.bedMaterial.opacity = edge.unlocked ? 0.88 : 0.18;
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
      const beaconBase = !node.unlocked ? 0.06 : selected ? 0.28 : 0.13;
      node.beacon.material.opacity = node.unlockReveal > 0
        ? Math.max(beaconBase, 0.24 + (1 - revealProgress) * 0.38)
        : beaconBase;
      node.rewards.forEach((reward, index) => {
        reward.rotation.y += dt * (0.65 + index * 0.12);
        reward.position.y = 0.58 + Math.sin(this.elapsed * 2.1 + index) * 0.05;
      });
    }
    for (const edge of this.edgeByKey.values()) {
      const selected =
        edge.definition.from === this.selectedKey ||
        edge.definition.to === this.selectedKey;
      const base = !edge.unlocked ? 0.16 : selected ? 0.9 : 0.52;
      edge.glowMaterial.opacity = base +
        (edge.unlocked ? Math.sin(this.elapsed * 3.1 + edge.length) * 0.055 : 0);
    }
    for (const ribbon of this.waterfallRibbons) {
      ribbon.mesh.position.x = ribbon.baseX +
        Math.sin(this.elapsed * 2.7 + ribbon.phase) * 0.075;
      ribbon.mesh.material.opacity =
        0.34 + Math.sin(this.elapsed * 3.4 + ribbon.phase) * 0.1;
    }
  }
}

export function createCampaignWorldMap(root: THREE.Group): CampaignWorldMapBuild {
  const groundMeshes: THREE.Mesh[] = [];
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
  water.params.shallow = { r: 0.025, g: 0.78, b: 0.86, a: 0.68 };
  water.params.deep = { r: 0.004, g: 0.19, b: 0.36, a: 1 };
  water.params.peak = { r: 0.68, g: 0.94, b: 1, a: 0.58 };
  water.params.wave1Height = 0.08;
  water.params.wave2Height = 0.045;
  water.params.normalStrength = 8.4;
  water.params.normalScale = 0.64;
  water.params.reflectionStrength = 0.82;
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
  const playableIslandSpecs = CAMPAIGN_LEVELS.map((definition) => {
    const seed = stableSeed(definition.progressKey);
    const shape = seeded(seed);
    return {
      x: definition.mapPosition[0],
      z: definition.mapPosition[2],
      rx: (definition.boss ? 10.1 : 7.9) + shape() * 2.1,
      rz: (definition.boss ? 8.5 : 7.1) + shape() * 1.7,
      seed,
      scenic: false,
    };
  });
  const scenicIslandSpecs = [
    { x: -55, z: 8, rx: 4.8, rz: 3.8, seed: 1009, scenic: true },
    { x: 1, z: 25, rx: 4.5, rz: 3.5, seed: 1031, scenic: true },
    { x: 57, z: 22, rx: 5.2, rz: 4.1, seed: 1061, scenic: true },
    { x: 4, z: -15, rx: 4.6, rz: 3.6, seed: 1091, scenic: true },
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
      islandGeometry(spec.rx, spec.rz, spec.seed),
      islandMaterial.clone(),
    );
    mesh.position.set(spec.x, -0.05, spec.z);
    mesh.name = "procedural tropical island";
    mesh.userData.edgeGrinding = false;
    mesh.userData.visualOnly = true;
    root.add(mesh);
  }

  const mountainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x20251b,
    emissiveIntensity: 0.52,
  });
  const mountainSpecs = [
    { x: -37, z: -11, r: 5.5, h: 18, s: 31 },
    { x: -22, z: -10, r: 4.3, h: 12.5, s: 47 },
    { x: -31, z: -14, r: 3.8, h: 10, s: 59 },
    { x: 38, z: -21, r: 5.5, h: 17.5, s: 71 },
    { x: 25, z: -21, r: 4.4, h: 12, s: 83 },
    { x: 32, z: -25, r: 3.7, h: 9.5, s: 97 },
  ] as const;
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
  }

  const waterfallRibbons: MapWaterfallRibbon[] = [];
  for (const [x, y, z, height] of [
    [-36.6, 4.9, -5.8, 8.6],
    [37.6, 4.8, -15.7, 8.2],
  ] as const) {
    for (let layer = 0; layer < 3; layer++) {
      const geometry = new THREE.PlaneGeometry(
        0.42 + layer * 0.18,
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
      }
      geometry.computeVertexNormals();
      const material = new THREE.MeshBasicMaterial({
        color: layer === 0 ? 0xb9ffff : layer === 1 ? 0x5ce6ed : 0x2bbccf,
        transparent: true,
        opacity: 0.42 - layer * 0.05,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: layer === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      const fall = new THREE.Mesh(geometry, material);
      fall.position.set(x + (layer - 1) * 0.17, y, z + layer * 0.025);
      fall.rotation.y = Math.PI;
      fall.name = "world map waterfall ribbon";
      fall.userData.noShadow = true;
      root.add(fall);
      waterfallRibbons.push({ mesh: fall, baseX: fall.position.x, phase: layer * 2.1 + x });
    }
    const pool = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.16, 7, 24),
      new THREE.MeshBasicMaterial({
        color: 0xc9ffff,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    pool.rotation.x = Math.PI / 2;
    pool.position.set(x, 0.32, z + 0.4);
    pool.name = "world map waterfall pool";
    pool.userData.noShadow = true;
    root.add(pool);
  }

  const palms = makePalmBatches(root);
  const foliage = makeFoliageBatches(root);
  const reefClusterCapacity = islandSpecs.reduce(
    (total, island) => total + (island.scenic ? 5 : 9),
    0,
  );
  const reefs = makeReefBatches(root, reefClusterCapacity);
  const random = seeded(7727);
  for (const island of islandSpecs) {
    const palmAttempts = island.scenic ? 4 : 8;
    for (let index = 0; index < palmAttempts; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.35 + random() * 0.42;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      const tooClose = CAMPAIGN_LEVELS.some((level) =>
        Math.hypot(x - level.mapPosition[0], z - level.mapPosition[2]) < 6.2,
      );
      if (tooClose) continue;
      addPalm(palms, x, 0.78, z, 0.66 + random() * 0.4, angle + Math.PI);
    }
    const shrubAttempts = island.scenic ? 7 : 15;
    for (let index = 0; index < shrubAttempts; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.28 + random() * 0.55;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      const tooClose = CAMPAIGN_LEVELS.some((level) =>
        Math.hypot(x - level.mapPosition[0], z - level.mapPosition[2]) < 4.1,
      );
      if (tooClose) continue;
      const greens = [0x3a8f49, 0x53a94d, 0x6fbd54, 0x2f7650] as const;
      const flowers = [0xf35e8f, 0xff8a55, 0xaa6cf2, 0xffd65c] as const;
      addShrub(
        foliage,
        x,
        0.74,
        z,
        0.5 + random() * 0.72,
        greens[(index + island.seed) % greens.length],
        index % 4 === 0 ? flowers[(index + island.seed) % flowers.length] : null,
      );
    }
    const reefClusters = island.scenic ? 5 : 9;
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
  for (const mountain of mountainSpecs) {
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
  }
  finalizeInstances(palms.trunks, palms.trunkIndex);
  finalizeInstances(palms.fronds, palms.frondIndex);
  finalizeInstances(palms.coconuts, palms.coconutIndex);
  finalizeInstances(foliage.shrubs, foliage.shrubIndex);
  finalizeInstances(foliage.flowers, foliage.flowerIndex);
  finalizeInstances(reefs.heads, reefs.headIndex);
  finalizeInstances(reefs.fingers, reefs.fingerIndex);

  const edgeVisuals: MapEdgeVisual[] = [];
  for (const definition of CAMPAIGN_MAP_EDGES) {
    const curve = makeEdgeCurve(definition);
    const length = curve.getLength();
    const bedMaterial = new THREE.MeshStandardMaterial({
      color: 0x3c4b52,
      roughness: 0.92,
      metalness: 0,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    });
    if (definition.travel === "trail") {
      const stepCount = Math.max(5, Math.floor(length / 1.35));
      const steps = new THREE.InstancedMesh(
        new THREE.BoxGeometry(0.82, 0.16, 0.98, 2, 1, 2),
        bedMaterial,
        stepCount,
      );
      for (let index = 0; index < stepCount; index++) {
        const u = (index + 0.5) / stepCount;
        const point = curve.getPointAt(u);
        const tangent = curve.getTangentAt(u);
        const yaw = Math.atan2(tangent.x, tangent.z);
        steps.setMatrixAt(
          index,
          new THREE.Matrix4().compose(
            point.add(new THREE.Vector3(0, -0.13, 0)),
            new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw),
            new THREE.Vector3(0.9 + (index % 3) * 0.05, 1, 0.88),
          ),
        );
      }
      steps.instanceMatrix.needsUpdate = true;
      steps.computeBoundingSphere();
      steps.name = "world map route bed";
      root.add(steps);
    } else {
      const underlay = new THREE.Mesh(
        new THREE.TubeGeometry(
          curve,
          Math.max(18, Math.ceil(length * 1.5)),
          0.16,
          7,
          false,
        ),
        bedMaterial,
      );
      underlay.name = "world map route bed";
      underlay.userData.noShadow = true;
      root.add(underlay);
    }
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x53616c,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const dashCount = Math.max(4, Math.floor(length / 2.15));
    const glow = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.22, 0.055, 0.62),
      glowMaterial,
      dashCount,
    );
    for (let index = 0; index < dashCount; index++) {
      const u = (index + 0.5) / dashCount;
      const point = curve.getPointAt(u);
      const tangent = curve.getTangentAt(u);
      glow.setMatrixAt(
        index,
        new THREE.Matrix4().compose(
          point.add(new THREE.Vector3(0, 0.1, 0)),
          new THREE.Quaternion().setFromAxisAngle(
            new THREE.Vector3(0, 1, 0),
            Math.atan2(tangent.x, tangent.z),
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
  for (const [index, definition] of CAMPAIGN_LEVELS.entries()) {
    const position = new THREE.Vector3(...definition.mapPosition);
    const group = new THREE.Group();
    // mapPosition is a feet pose. The pad top sits exactly 10 cm below it,
    // matching the campaign return-pose contract used by ordinary levels.
    group.position.copy(position).add(new THREE.Vector3(0, -0.1, 0));
    group.name = `world map hub ${definition.progressKey}`;
    root.add(group);
    const radius = definition.boss ? 3.05 : 2.35;
    const foundationHeight = Math.max(0.28, position.y - 1.17);
    const foundation = new THREE.Mesh(
      new THREE.CylinderGeometry(
        radius * 1.05,
        radius * 1.32,
        foundationHeight,
        definition.boss ? 14 : 12,
        3,
      ),
      new THREE.MeshStandardMaterial({
        color: definition.boss ? 0x6d665b : 0x8a765d,
        emissive: 0x0c100c,
        roughness: 0.94,
      }),
    );
    foundation.position.y = -0.42 - foundationHeight * 0.5;
    foundation.name = "world map hub foundation";
    foundation.userData.edgeGrinding = false;
    foundation.userData.visualOnly = true;
    group.add(foundation);
    const turf = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 1.08, radius * 1.12, 0.16, 16),
      new THREE.MeshStandardMaterial({
        color: definition.boss ? 0x59684a : 0x599f54,
        roughness: 0.98,
      }),
    );
    turf.position.y = -0.48;
    turf.name = "world map hub turf terrace";
    turf.userData.visualOnly = true;
    group.add(turf);
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x56616a,
      emissive: 0x090d12,
      roughness: 0.76,
      metalness: 0.04,
    });
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius * 1.13, 0.42, definition.boss ? 12 : 16),
      padMaterial,
    );
    pad.position.y = -0.21;
    pad.name = "world map level hub";
    pad.userData.edgeGrinding = false;
    group.add(pad);
    groundMeshes.push(pad);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(radius * 0.78, 0.15, 7, 28),
      new THREE.MeshBasicMaterial({
        color: 0x53616c,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
      }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    ring.userData.noShadow = true;
    group.add(ring);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(radius * 0.58, radius * 0.85, definition.boss ? 4.8 : 3.4, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x53616c,
        transparent: true,
        opacity: 0.08,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beacon.position.y = definition.boss ? 2.35 : 1.65;
    beacon.userData.noShadow = true;
    group.add(beacon);
    const label = makeNodeLabel(`${index + 1}`, definition.boss === true);
    label.position.y = definition.boss ? 5.7 : 4.5;
    group.add(label);
    const lock = makeLock();
    lock.position.y = 0.7;
    group.add(lock);
    const rewards: THREE.Object3D[] = [];
    for (let rewardIndex = 0; rewardIndex < 4; rewardIndex++) {
      const reward = makeReward(rewardIndex);
      const angle = THREE.MathUtils.lerp(-0.95, 0.95, rewardIndex / 3);
      reward.position.set(
        Math.sin(angle) * radius * 0.88,
        0.58,
        Math.cos(angle) * radius * 0.88,
      );
      group.add(reward);
      rewards.push(reward);
    }
    if (definition.boss) addBossCrown(group, radius * 0.9);
    nodeVisuals.push({
      key: definition.progressKey,
      position,
      padMaterial,
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
