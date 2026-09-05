import * as THREE from "three";
import {
  CAMPAIGN_ISLANDS,
  CAMPAIGN_LEVELS,
  CAMPAIGN_MAP_EDGES,
  campaignLevelByKey,
  type CampaignLevelProgress,
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
}

interface MapEdgeVisual {
  definition: CampaignMapEdgeDefinition;
  curve: THREE.CatmullRomCurve3;
  length: number;
  bedMaterial: THREE.MeshStandardMaterial;
  glowMaterial: THREE.MeshBasicMaterial;
  railMaterial: THREE.MeshStandardMaterial | null;
  unlocked: boolean;
}

export interface CampaignWorldMapBuild {
  runtime: CampaignWorldMapRuntime;
  water: CoastWater;
  groundMeshes: THREE.Mesh[];
}

const MAP_FORWARD = new THREE.Vector3(0, 0, -1);

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
    { radius: 0.7, y: -3.5, color: 0x715442 },
    { radius: 1.04, y: -1.45, color: 0xcf8f59 },
    { radius: 1, y: -0.42, color: 0xf6cf82 },
    { radius: 0.88, y: 0.34, color: 0x8fcf64 },
    { radius: 0.67, y: 0.84, color: 0x4c9d55 },
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

function mountainGeometry(radius: number, height: number, seed: number): THREE.BufferGeometry {
  const geometry = new THREE.ConeGeometry(radius, height, 10, 6, false);
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  for (let index = 0; index < positions.count; index++) {
    const y = positions.getY(index);
    const heightT = THREE.MathUtils.clamp(y / height + 0.5, 0, 1);
    const angle = Math.atan2(positions.getZ(index), positions.getX(index));
    const ridge = 1 + Math.sin(angle * 3 + seed * 0.7) * 0.1 * (1 - heightT);
    positions.setX(index, positions.getX(index) * ridge);
    positions.setZ(index, positions.getZ(index) * ridge);
    const color = heightT > 0.7
      ? mixColor(0x596263, 0x8b7965, (heightT - 0.7) / 0.3)
      : mixColor(0x365c46, 0x655d55, heightT / 0.7);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function makePalmBatches(root: THREE.Group): {
  trunks: THREE.InstancedMesh;
  fronds: THREE.InstancedMesh;
  trunkIndex: number;
  frondIndex: number;
} {
  const trunks = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.16, 0.27, 4.4, 7, 3),
    new THREE.MeshStandardMaterial({ color: 0xa96e3e, roughness: 0.92 }),
    48,
  );
  const leafGeometry = new THREE.SphereGeometry(1, 7, 4);
  leafGeometry.scale(0.32, 0.1, 1.7);
  const fronds = new THREE.InstancedMesh(
    leafGeometry,
    new THREE.MeshStandardMaterial({
      color: 0x43a94f,
      roughness: 0.85,
      side: THREE.DoubleSide,
    }),
    48 * 6,
  );
  trunks.name = "world map palms";
  fronds.name = "world map palm fronds";
  root.add(trunks, fronds);
  return { trunks, fronds, trunkIndex: 0, frondIndex: 0 };
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
  const geometry = kind === 3
    ? new THREE.TorusGeometry(0.28, 0.1, 7, 14)
    : new THREE.OctahedronGeometry(kind === 0 ? 0.34 : 0.29, 0);
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

  constructor(nodes: MapNodeVisual[], edges: MapEdgeVisual[]) {
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
    tangent.y = 0;
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
    const source = this.nodeByKey.get(key);
    if (!source) return null;
    const intentLength = Math.hypot(screenX, screenY);
    if (intentLength < 0.25) return null;
    const ix = screenX / intentLength;
    const iy = screenY / intentLength;
    let best: { key: string; score: number } | null = null;
    for (const definition of CAMPAIGN_MAP_EDGES) {
      const candidateKey = definition.from === key
        ? definition.to
        : definition.to === key
          ? definition.from
          : null;
      if (!candidateKey || !unlockedAt(candidateKey)) continue;
      const candidate = this.nodeByKey.get(candidateKey);
      if (!candidate) continue;
      const dx = candidate.position.x - source.position.x;
      const dy = source.position.z - candidate.position.z + (candidate.position.y - source.position.y) * 0.22;
      const length = Math.hypot(dx, dy) || 1;
      const alignment = (dx / length) * ix + (dy / length) * iy;
      if (alignment < 0.22) continue;
      const score = alignment * 12 - length * 0.012;
      if (!best || score > best.score) best = { key: candidateKey, score };
    }
    return best?.key ?? null;
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
      }
    }
  }

  update(dt: number): void {
    this.elapsed += dt;
    for (const node of this.nodeByKey.values()) {
      const selected = node.key === this.selectedKey;
      const pulse = selected ? 1 + Math.sin(this.elapsed * 4.2) * 0.08 : 1;
      node.ring.scale.setScalar(pulse);
      node.ring.rotation.z += dt * (selected ? 0.72 : 0.18);
      node.beacon.scale.y = selected ? 1 + Math.sin(this.elapsed * 2.8) * 0.08 : 1;
      node.rewards.forEach((reward, index) => {
        reward.rotation.y += dt * (0.65 + index * 0.12);
        reward.position.y = 0.58 + Math.sin(this.elapsed * 2.1 + index) * 0.05;
      });
    }
    for (const edge of this.edgeByKey.values()) {
      if (!edge.unlocked) continue;
      edge.glowMaterial.opacity +=
        (0.03 * Math.sin(this.elapsed * 3.1 + edge.length) - edge.glowMaterial.opacity * 0.002) * dt;
    }
  }
}

export function createCampaignWorldMap(root: THREE.Group): CampaignWorldMapBuild {
  const groundMeshes: THREE.Mesh[] = [];
  const water = new CoastWater({
    shore: [
      { x: -130, z: 76, sx: 0, sz: -1, beachSlope: 0, bedSlope: 0 },
      { x: 130, z: 76, sx: 0, sz: -1, beachSlope: 0, bedSlope: 0 },
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
    shoreSampleMetres: 4,
    lateralSegments: 96,
  });
  // Keep the audited shader/passes, but tune its public parameters for the
  // elevated map lens: broader colour separation and readable rolling glints
  // survive the high, toy-diorama camera better than the gameplay-coast preset.
  water.params.shallow = { r: 0.03, g: 0.72, b: 0.79, a: 0.9 };
  water.params.deep = { r: 0.005, g: 0.23, b: 0.39, a: 1 };
  water.params.peak = { r: 0.68, g: 0.94, b: 1, a: 0.58 };
  water.params.wave1Height = 0.08;
  water.params.wave2Height = 0.045;
  water.params.normalStrength = 8.4;
  water.params.reflectionStrength = 0.82;
  water.markWavesDirty();
  water.group.name = "world map ocean";
  root.add(water.group);

  const islandMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
  });
  const islandSpecs = [
    { x: -28, z: 13, rx: 35, rz: 27, seed: 418 },
    { x: 31, z: 2, rx: 29, rz: 25, seed: 907 },
  ] as const;
  for (const spec of islandSpecs) {
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
    emissive: 0x121a15,
    emissiveIntensity: 0.38,
  });
  for (const mountain of [
    { x: -32, z: -4, r: 8.4, h: 19, s: 31 },
    { x: -39, z: 3, r: 5.8, h: 13, s: 47 },
    { x: -20, z: -1, r: 5.2, h: 11, s: 59 },
    { x: 34, z: -13, r: 8.1, h: 18, s: 71 },
    { x: 42, z: -7, r: 5.7, h: 12, s: 83 },
    { x: 22, z: -8, r: 4.8, h: 10, s: 97 },
  ]) {
    const mesh = new THREE.Mesh(
      mountainGeometry(mountain.r, mountain.h, mountain.s),
      mountainMaterial.clone(),
    );
    mesh.position.set(mountain.x, mountain.h * 0.5 - 0.15, mountain.z);
    mesh.name = "world map mountain";
    mesh.userData.edgeGrinding = false;
    mesh.userData.visualOnly = true;
    root.add(mesh);
    const crown = new THREE.Mesh(
      new THREE.ConeGeometry(
        mountain.r * 0.94,
        mountain.h * 0.46,
        10,
        4,
        true,
      ),
      new THREE.MeshStandardMaterial({
        color: 0x3f9650,
        roughness: 1,
        flatShading: false,
      }),
    );
    crown.position.set(
      mountain.x,
      mountain.h * 0.23 - 0.12,
      mountain.z,
    );
    crown.name = "world map mountain canopy";
    crown.userData.visualOnly = true;
    root.add(crown);
    const scrubMaterial = new THREE.MeshStandardMaterial({
      color: 0x45a052,
      roughness: 1,
      emissive: 0x07160a,
    });
    for (let patchIndex = 0; patchIndex < 5; patchIndex++) {
      const angle = (patchIndex / 5) * Math.PI * 2 + mountain.s * 0.13;
      const scrub = new THREE.Mesh(
        new THREE.IcosahedronGeometry(mountain.r * (0.19 + (patchIndex % 2) * 0.035), 1),
        scrubMaterial,
      );
      scrub.scale.y = 0.58;
      scrub.position.set(
        mountain.x + Math.cos(angle) * mountain.r * 0.58,
        mountain.h * (0.2 + (patchIndex % 3) * 0.045),
        mountain.z + Math.sin(angle) * mountain.r * 0.58,
      );
      scrub.name = "world map mountain scrub";
      scrub.userData.visualOnly = true;
      root.add(scrub);
    }
  }

  const waterfallMaterial = new THREE.MeshBasicMaterial({
    color: 0x79e7ef,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  for (const [x, y, z, height] of [
    [-27.8, 5.4, 4.3, 8.2],
    [35.2, 5.2, -4.3, 7.5],
  ] as const) {
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.05, height, 1, 8), waterfallMaterial.clone());
    fall.position.set(x, y, z);
    fall.rotation.y = Math.PI;
    fall.name = "world map waterfall";
    fall.userData.noShadow = true;
    root.add(fall);
  }

  const palms = makePalmBatches(root);
  const random = seeded(7727);
  for (const island of islandSpecs) {
    for (let index = 0; index < 20; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.38 + random() * 0.43;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      const tooClose = CAMPAIGN_LEVELS.some((level) =>
        Math.hypot(x - level.mapPosition[0], z - level.mapPosition[2]) < 4.2,
      );
      if (tooClose) continue;
      addPalm(palms, x, 0.56, z, 0.72 + random() * 0.42, angle + Math.PI);
    }
  }
  palms.trunks.count = palms.trunkIndex;
  palms.fronds.count = palms.frondIndex;
  palms.trunks.instanceMatrix.needsUpdate = true;
  palms.fronds.instanceMatrix.needsUpdate = true;
  palms.trunks.computeBoundingSphere();
  palms.fronds.computeBoundingSphere();

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
    const underlay = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(18, Math.ceil(length * 1.5)), 0.34, 7, false),
      bedMaterial,
    );
    underlay.name = "world map route bed";
    underlay.userData.noShadow = true;
    root.add(underlay);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0x53616c,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(
      new THREE.TubeGeometry(curve, Math.max(18, Math.ceil(length * 1.5)), 0.13, 6, false),
      glowMaterial,
    );
    glow.name = "world map glowing route";
    glow.userData.noShadow = true;
    root.add(glow);
    let railMaterial: THREE.MeshStandardMaterial | null = null;
    if (definition.travel === "boardslide") {
      railMaterial = new THREE.MeshStandardMaterial({
        color: 0x53616c,
        emissive: 0x07090b,
        metalness: 0.72,
        roughness: 0.22,
      });
      const rail = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.max(24, Math.ceil(length * 1.8)), 0.09, 8, false),
        railMaterial,
      );
      rail.name = "world map boardslide rail";
      root.add(rail);
    }
    edgeVisuals.push({
      definition,
      curve,
      length,
      bedMaterial,
      glowMaterial,
      railMaterial,
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
    const padMaterial = new THREE.MeshStandardMaterial({
      color: 0x56616a,
      emissive: 0x090d12,
      roughness: 0.82,
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
    const label = makeNodeLabel(definition.boss ? `${index + 1} · BOSS` : `${index + 1}`, definition.boss === true);
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
    });
  }

  for (const island of CAMPAIGN_ISLANDS) {
    const marker = makeNodeLabel(island.name, false);
    marker.position.set(island.centre[0], 1.25, island.centre[2] + 17);
    marker.scale.multiplyScalar(1.2);
    marker.material.opacity = 0.56;
    root.add(marker);
  }

  return {
    runtime: new CampaignWorldMapRuntime(nodeVisuals, edgeVisuals),
    water,
    groundMeshes,
  };
}
