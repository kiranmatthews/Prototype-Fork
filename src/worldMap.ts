import * as THREE from "three";
import {
  CAMPAIGN_ISLANDS,
  CAMPAIGN_LEVELS,
  CAMPAIGN_MAP_EDGES,
  campaignLevelByKey,
  type CampaignLevelProgress,
  type CampaignMapDirection,
  type CampaignMapEdgeDefinition,
  type CampaignMapTravelStyle,
  type CampaignLevelDefinition,
} from "./campaign";
import { CoastWater } from "./water";
import { createUnitySandMaterial, applyUnitySandMetricUvs } from "./unitySandMaterial";
import { createIslandShoreFoam, type IslandShoreFoam } from "./islandShoreFoam";
import { TropicalPlantKit, TROPICAL_PLANT_KINDS, type TropicalPlantKind } from "./tropicalPlants";
import { createMapOceanDefaults } from "./mapOceanPreset";
import { MAP_OUTLINE_BASE_WIDTH_METRES } from "./mapIslandOutline";
import { oceanTuning } from "./oceanTuning";

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
const MAP_COAST_SEGMENTS = 128;
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
  const segments = MAP_COAST_SEGMENTS;
  const rings = 36;
  const outline = organicIslandOutline(segments, seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const sandBlend: number[] = [];
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
      const supportInfluence = 1 - THREE.MathUtils.smoothstep(radius, 0.985, 1.075);
      let nearestDistance = Infinity;
      let nearestY = y;
      for (const support of supports) {
        const distanceSq = (x - support.x) ** 2 + (z - support.z) ** 2;
        const weight = Math.exp(-distanceSq / 14) * supportInfluence;
        y = Math.max(y, baseY + Math.max(0, support.y - 0.38 - baseY) * weight);
        if (distanceSq < nearestDistance) {
          nearestDistance = distanceSq;
          nearestY = support.y - 0.38;
        }
      }
      if (nearestDistance < 12)
        y = THREE.MathUtils.lerp(y, nearestY, (1 - THREE.MathUtils.smoothstep(nearestDistance, 1, 12)) * supportInfluence);
      const beachEdge = 0.81 + Math.sin(angle * 3 + 1) * 0.035;
      const grass = 1 - THREE.MathUtils.smoothstep(radius, beachEdge - 0.07, beachEdge + 0.02);
      const sand = mixColor(0xd59d65, 0xffe5ad, THREE.MathUtils.smoothstep(y, -0.8, 0.25));
      const meadow = mixColor(0x3f8c57, 0x92c96c, 0.48 + hills * 0.6);
      const color = sand.lerp(meadow, grass);
      positions.push(x, y, z);
      colors.push(color.r, color.g, color.b);
      sandBlend.push(1 - grass);
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
  sandBlend.push(0);
  const lastRing = (rings - 1) * segments;
  for (let index = 0; index < segments; index++) {
    indices.push(lastRing + index, centre, lastRing + ((index + 1) % segments));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aSandBlend", new THREE.Float32BufferAttribute(sandBlend, 1));
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
  const segments = MAP_COAST_SEGMENTS;
  // The exponential depth shader needs a long, gradual bed slope. The old
  // three-metre drop across the outer two rings made a hard turquoise edge.
  const rings = Array.from({length:65},(_,index)=>{
    const radius=THREE.MathUtils.lerp(4,1.01,index/64);
    const offshore=THREE.MathUtils.clamp((radius-1.3)/2.6,0,1);
    const depth=0.11+0.11*THREE.MathUtils.smoothstep(radius,1.01,1.3)+6.8*Math.pow(offshore,2.05);
    const color=mixColor(0xf8dfa1,0x529da2,THREE.MathUtils.smoothstep(radius,1.15,2.4))
      .lerp(new THREE.Color(0x254e69),THREE.MathUtils.smoothstep(radius,2.2,4));
    return {radius,y:-depth,color};
  });
  const outline = organicIslandOutline(segments, seed);
  const positions: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let ring = 0; ring < rings.length; ring++) {
    const band = rings[ring];
    const color = band.color;
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * Math.PI * 2;
      const radius = band.radius * outline[index];
      const x = Math.cos(angle) * radiusX * radius;
      const z = Math.sin(angle) * radiusZ * radius;
      positions.push(x, band.y, z);
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

/** Derive every coast sample from the rendered terrain's sea-level crossing. */
function bindBeachCoordinates(
  geometry: THREE.BufferGeometry,
  localSeaLevel: number,
  worldX: number,
  worldZ: number,
): THREE.Vector3[] {
  const positions=geometry.getAttribute("position");
  const segments=MAP_COAST_SEGMENTS;
  const rows=(positions.count-1)/segments;
  const coast:THREE.Vector3[]=[];
  for(let column=0;column<segments;column++){
    let below=new THREE.Vector3().fromBufferAttribute(positions,column);
    for(let row=1;row<rows;row++){
      const above=new THREE.Vector3().fromBufferAttribute(positions,row*segments+column);
      if(above.y>=localSeaLevel){
        const crossing=below.clone().lerp(above,(localSeaLevel-below.y)/(above.y-below.y));
        coast.push(crossing);
        break;
      }
      below=above;
    }
  }
  if(coast.length!==segments)throw new Error("Map island needs a closed submerged perimeter");
  const values=new Float32Array(positions.count*2);
  for(let i=0;i<positions.count;i++){
    const edge=coast[i%segments];
    values[i*2]=Math.hypot(edge.x,edge.z)-Math.hypot(positions.getX(i),positions.getZ(i));
    values[i*2+1]=(positions.getX(i)+worldX)*0.16+(positions.getZ(i)+worldZ)*0.11;
  }
  geometry.setAttribute("aMapBeach",new THREE.BufferAttribute(values,2));
  return coast;
}

function mapSandMaterial(beachTime:{value:number}): THREE.MeshStandardMaterial {
  const owner = createUnitySandMaterial({name:"World map fine sand and pebbles"});
  const material = owner.material;
  material.vertexColors = true;
  material.normalScale.set(0.24, 0.24);
  material.aoMapIntensity = 0.3;
  material.userData.unitySandTileMetres = 2.7;
  material.userData.mapBeachClock = beachTime;
  for (const map of Object.values(owner.maps)) {
    map.anisotropy = 8;
    map.minFilter = THREE.LinearMipmapLinearFilter;
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uMapBeachTime=beachTime;
    shader.vertexShader = "attribute float aSandBlend;\nattribute vec2 aMapBeach;\nvarying vec2 vMapBeach;\nvarying float vMapSand;\n" +
      shader.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\nvMapSand = aSandBlend;\nvMapBeach = aMapBeach;");
    shader.fragmentShader = "uniform float uMapBeachTime;\nvarying vec2 vMapBeach;\nvarying float vMapSand;\n" + shader.fragmentShader
      .replace("#include <map_fragment>", `
        float mapLap = 0.5 + 0.5 * sin(uMapBeachTime * 1.130973 + vMapBeach.y);
        float mapLapFront = 0.35 + pow(mapLap, 1.5) * 1.45;
        float mapFreshWet = 1.0 - smoothstep(mapLapFront - 0.2, mapLapFront + 0.4, vMapBeach.x);
        float mapDampSand = (1.0 - smoothstep(1.7, 3.6, vMapBeach.x)) * 0.42;
        float mapWetness = max(mapFreshWet, mapDampSand) * vMapSand;
        #ifdef USE_MAP
          vec3 sandSample = texture2D(map, vMapUv).rgb;
          float sandDetail = dot(sandSample, vec3(0.2126, 0.7152, 0.0722)) * 1.72;
          diffuseColor.rgb *= mix(vec3(1.0), vec3(clamp(sandDetail, 0.66, 1.36)), vMapSand * 0.88);
        #endif
        diffuseColor.rgb *= mix(vec3(1.0), vec3(0.52, 0.63, 0.68), mapWetness * 0.82);
      `)
      .replace("#include <roughnessmap_fragment>", `
        #include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.17, mapWetness);
      `)
      .replace("#include <normal_fragment_maps>", `
        vec3 sandBaseNormal = normal;
        #include <normal_fragment_maps>
        normal = normalize(mix(sandBaseNormal, normal, vMapSand));
      `)
      .replace("#include <aomap_fragment>", THREE.ShaderChunk.aomap_fragment.replace(
        "texture2D( aoMap, vAoMapUv ).r",
        "mix(1.0, texture2D( aoMap, vAoMapUv ).g, vMapSand)",
      ));
  };
  material.customProgramCacheKey = () => "world-map-matrixrex-lapping-wet-sand-v2";
  return material;
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


function finalizeInstances(mesh: THREE.InstancedMesh, count: number): void {
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.computeBoundingSphere();
}

function edgeKey(from: string, to: string): string {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

function makeEdgeCurve(
  definition: CampaignMapEdgeDefinition,
  levels: readonly CampaignLevelDefinition[] = CAMPAIGN_LEVELS,
): THREE.CatmullRomCurve3 {
  const from = levels.find((level) => level.progressKey === definition.from)!;
  const to = levels.find((level) => level.progressKey === definition.to)!;
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
    private readonly plants: TropicalPlantKit,
    readonly shoreline: IslandShoreFoam,
    readonly beachTime:{value:number},
    private readonly frame?: THREE.Group,
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
    this.frame?.updateWorldMatrix(true, false);
    return {
      position: this.frame ? node.position.clone().applyMatrix4(this.frame.matrixWorld) : node.position.clone(),
      heading: this.frame ? MAP_FORWARD.clone().transformDirection(this.frame.matrixWorld) : MAP_FORWARD.clone(),
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
    const position = edge.curve.getPointAt(THREE.MathUtils.clamp(u, 0, 1));
    if (this.frame) {
      this.frame.updateWorldMatrix(true, false);
      position.applyMatrix4(this.frame.matrixWorld);
      tangent.transformDirection(this.frame.matrixWorld);
    }
    return {
      position,
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
    this.beachTime.value=this.elapsed;
    this.plants.update(dt);
    oceanTuning.applyOutline(this.shoreline);
    this.shoreline.update(dt);
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

  dispose(): void {
    this.plants.dispose();
    this.shoreline.group.removeFromParent();
    this.shoreline.dispose();
  }
}

export interface CampaignWorldMapAuthoring {
  p: readonly [number, number, number];
  yaw?: number;
  hubs?: readonly (readonly [number, number, number])[];
}

export function createCampaignWorldMap(
  parentRoot: THREE.Group,
  authoring?: CampaignWorldMapAuthoring,
): CampaignWorldMapBuild {
  const frame = authoring ? new THREE.Group() : undefined;
  const root = frame ?? parentRoot;
  if (frame && authoring) {
    frame.name = "editable campaign world map";
    frame.position.set(...authoring.p);
    frame.rotation.y = THREE.MathUtils.degToRad(authoring.yaw ?? 0);
    frame.updateMatrix();
    parentRoot.add(frame);
  }
  const levels = CAMPAIGN_LEVELS.map((level, index) => ({
    ...level, mapPosition: authoring?.hubs?.[index] ?? level.mapPosition,
  }));
  const byKey = (key: string) => levels.find((level) => level.progressKey === key) ?? null;
  const worldPoint = (x: number, y: number, z: number): THREE.Vector3 => {
    const point = new THREE.Vector3(x, y, z);
    return frame ? point.applyMatrix4(frame.matrix) : point;
  };
  const worldShore = (x: number, z: number) => {
    const point = worldPoint(x, 0, z);
    const direction = new THREE.Vector3(0, 0, -1);
    if (frame) direction.transformDirection(frame.matrix);
    return { x: point.x, z: point.z, sx: direction.x, sz: direction.z, beachSlope: 0, bedSlope: 0 };
  };
  const groundMeshes: THREE.Mesh[] = [];
  const landMeshes: THREE.Mesh[] = [];
  const terrainSupports = levels.map((level) => new THREE.Vector3(...level.mapPosition));
  const edgeCurves = new Map(CAMPAIGN_MAP_EDGES.map((edge) => [edge, makeEdgeCurve(edge, levels)]));
  for (const [edge, curve] of edgeCurves) {
    if (edge.travel !== "trail") continue;
    const count = Math.max(1, Math.ceil(curve.getLength() / 2));
    for (let i = 0; i <= count; i++) terrainSupports.push(curve.getPointAt(i / count));
  }
  const water = new CoastWater({
    shore: [
      worldShore(200, 76),
      worldShore(-200, 76),
    ],
    seaLevel: -1.15 + (authoring?.p[1] ?? 0),
    shoreDirX: 0,
    shoreDirZ: -1,
    course: levels.map((level) => {
      const point = worldPoint(...level.mapPosition);
      return { x: point.x, z: point.z };
    }),
    terrainHeight: () => -4 + (authoring?.p[1] ?? 0),
    sourceCoordinates: "three",
    oceanWidth: 230,
    shoreOverlap: 42,
    shoreSampleMetres: 2,
    lateralSegments: 128,
  });
  // Keep the audited shader/passes, but tune its public parameters for the
  // elevated map lens: broader colour separation and readable rolling glints
  // survive the high, toy-diorama camera better than the gameplay-coast preset.
  Object.assign(water.params, createMapOceanDefaults());
  water.reflectionScale = 0.42;
  water.markWavesDirty();
  water.group.name = "world map ocean";
  parentRoot.add(water.group);

  const beachTime={value:0};
  const islandMaterial = mapSandMaterial(beachTime);
  const coastlines:THREE.Vector3[][]=[];
  const shelfMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
    emissive: 0x071713,
    emissiveIntensity: 0.24,
  });
  const playableIslandSpecs = CAMPAIGN_ISLANDS.map((island) => {
    const hubs = island.levelKeys
      .map(byKey)
      .filter((level) => level !== null);
    const x = island.centre[0];
    const z = island.centre[2];
    const rx = Math.max(22, ...hubs.map(level => Math.abs(level.mapPosition[0] - x) + 8.5));
    const rz = Math.max(20, ...hubs.map(level => Math.abs(level.mapPosition[2] - z) + 8.5));
    const outline = organicIslandOutline(MAP_COAST_SEGMENTS, stableSeed(island.id));
    // Fit hubs inside the actual irregular outline, not just its rectangular
    // bounds. Side-path corner hubs otherwise overhang the beach.
    const fit = Math.max(1, ...hubs.map(level => {
      const dx = (level.mapPosition[0] - x) / rx, dz = (level.mapPosition[2] - z) / rz;
      const angle = (Math.atan2(dz, dx) + Math.PI * 2) % (Math.PI * 2);
      const index = Math.round(angle / (Math.PI * 2) * outline.length) % outline.length;
      return Math.hypot(dx, dz) / (outline[index] * 0.82);
    }));
    return {
      x,
      z,
      rx: rx * fit,
      rz: rz * fit,
      seed: stableSeed(island.id),
      scenic: false,
      campaignIslandId: island.id,
    };
  });
  const scenicIslandSpecs = [
    { x: -91, z: 0, rx: 3.2, rz: 2.5, seed: 1009, scenic: true, campaignIslandId: null },
    { x: 3, z: 40, rx: 2.8, rz: 2.2, seed: 1031, scenic: true, campaignIslandId: null },
    { x: 100, z: 34, rx: 3.5, rz: 2.7, seed: 1061, scenic: true, campaignIslandId: null },
    { x: 5, z: -23, rx: 3, rz: 2.3, seed: 1091, scenic: true, campaignIslandId: null },
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
    const geometry = islandGeometry(spec.rx, spec.rz, spec.seed, spec.scenic ? [] :
      terrainSupports.map((point) => point.clone().sub(new THREE.Vector3(spec.x, 0, spec.z))));
    coastlines.push(bindBeachCoordinates(geometry,MAP_SEA_LEVEL+0.05,spec.x,spec.z));
    applyUnitySandMetricUvs(geometry, {tileMetres:2.7,offsetMetres:[spec.x,-spec.z]});
    const mesh = new THREE.Mesh(geometry, islandMaterial);
    mesh.position.set(spec.x, -0.05, spec.z);
    mesh.name = spec.scenic
      ? "world map offshore islet"
      : `world map campaign island ${spec.campaignIslandId}`;
    mesh.userData.edgeGrinding = false;
    mesh.userData.visualOnly = true;
    root.add(mesh);
    landMeshes.push(mesh);
  }

  const shoreline = createIslandShoreFoam(islandSpecs.map((spec) => ({
    center:[spec.x,MAP_SEA_LEVEL,spec.z] as const,
    right:[1,0,0] as const, forward:[0,0,1] as const,
    axes:[spec.rx,spec.rz] as const, phase:spec.seed % 31,
  })), {segments:128,sourceZSign:1,color:[1,1,1,0.97],pulseSpeed:0.18,pulseAmount:0.18,edgePower:0.5});
  const shorePositions = shoreline.geometry.getAttribute("position");
  islandSpecs.forEach((spec,islandIndex) => {
    // One world-space width: a fixed inward tuner offset must not swallow
    // a smaller islet's entire bright band while leaving mainland foam wide.
    const width = MAP_OUTLINE_BASE_WIDTH_METRES;
    for(let i=0;i<128;i++) {
      const edge=coastlines[islandIndex][i];
      const length=Math.hypot(edge.x,edge.z);
      for(let band=0;band<2;band++) {
        const radial=1+(0.16+(band?width:0))/length;
        shorePositions.setXYZ(islandIndex*256+i*2+band,spec.x+edge.x*radial,MAP_SEA_LEVEL+0.09,spec.z+edge.z*radial);
      }
    }
  });
  shorePositions.needsUpdate=true;
  shoreline.geometry.computeBoundingSphere();
  shoreline.geometry.computeBoundingBox();
  shoreline.mesh.name="world map white shoreline";
  oceanTuning.applyOutline(shoreline);
  root.add(shoreline.group);

  const mountainMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.82,
    metalness: 0,
    emissive: 0x101810,
    emissiveIntensity: 0.18,
  });
  const mountainSpecs = [
    { x: -55, z: -8, r: 7.5, h: 18.5, s: 31 },
    { x: -49, z: -11, r: 4.8, h: 13.5, s: 47 },
    { x: -19, z: -8, r: 4.3, h: 11.5, s: 59 },
    { x: 55, z: -4, r: 7.7, h: 18, s: 71 },
    { x: 46, z: -7, r: 5, h: 13.2, s: 83 },
    { x: 64, z: -5, r: 4.5, h: 11.8, s: 97 },
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
    !levels.some((level) => Math.hypot(level.mapPosition[0] - x, level.mapPosition[2] - z) < clearance + 1.8);

  const waterfallRibbons: MapWaterfallRibbon[] = [];
  for (const [x, y, z, height] of [
    [-55.2, 4.1, -1.4, 5.6],
    [55.1, 4.1, 2.5, 5.4],
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
  const plants = new TropicalPlantKit(root);
  const tropicalPlacements = new Map<TropicalPlantKind,THREE.Matrix4[]>(
    TROPICAL_PLANT_KINDS.map((kind)=>[kind,[]]),
  );
  const placeTropical = (kind:TropicalPlantKind,x:number,z:number,scale:number,yaw:number):void => {
    tropicalPlacements.get(kind)!.push(new THREE.Matrix4().compose(
      new THREE.Vector3(x,terrainY(x,z),z),
      new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),
      new THREE.Vector3(scale,scale,scale),
    ));
  };
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
  const random = seeded(7727);
  for (const island of islandSpecs) {
    const palmAttempts = island.scenic ? 2 : 58;
    for (let index = 0; index < palmAttempts; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.35 + random() * 0.42;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      const coversHub = levels.some((level) =>
        Math.abs(x - level.mapPosition[0]) < 4.3 &&
        z > level.mapPosition[2] - 1 && z < level.mapPosition[2] + 10,
      );
      if (coversHub || !clearsRoute(x, z, 4.2) || palms.trunkIndex >= palms.trunks.count) continue;
      const scale=0.78+random()*0.5;
      if(!island.scenic&&index%4!==0) {
        const kind=(['fanpalm','bananatree','seagrape'] as const)[index%3];
        placeTropical(kind,x,z,scale,angle+Math.PI);
      } else addPalm(palms, x, terrainY(x, z), z, scale, angle + Math.PI);
    }
    const understoryAttempts = island.scenic ? 8 : 180;
    for (let index = 0; index < understoryAttempts; index++) {
      const angle = random() * Math.PI * 2;
      const radius = 0.28 + random() * 0.55;
      const x = island.x + Math.cos(angle) * island.rx * radius;
      const z = island.z + Math.sin(angle) * island.rz * radius;
      if (!clearsRoute(x, z, 1.8)) continue;
      if (!island.scenic && index % 7 === 0) {
        placeTropical(index%2===0?'monstera':'birdofparadise',x,z,0.8+random()*0.25,angle);
        continue;
      }
      random(); // Preserve the authored tree/reef distribution after removing bushes.
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
      // Keep the later vegetation/boulder placements identical without reefs.
      random(); random(); random();
    }
  }
  for (const mountain of mountainSpecs) {
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
  }
  finalizeInstances(palms.trunks, palms.trunkIndex);
  finalizeInstances(palms.fronds, palms.frondIndex);
  finalizeInstances(palms.coconuts, palms.coconutIndex);
  finalizeInstances(rocks, rockCount);
  finalizeInstances(groundLeaves, groundLeafCount);
  plants.decorate(palms.trunks,"trunk");
  plants.decorate(palms.fronds,"leaf");
  plants.decorate(palms.coconuts,"flower");
  plants.decorate(groundLeaves,"leaf");
  for(const [kind,transforms] of tropicalPlacements)
    if(transforms.length)root.add(plants.batch(kind,transforms,{flowers:kind!=="birdofparadise"}));

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
      underlay.renderOrder = shoreline.mesh.renderOrder + 1;
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
      // Both are translucent/depth-write-free. Draw above the shoreline
      // accent (order 1), retaining depth tests against solid island scenery.
      rail.renderOrder = shoreline.mesh.renderOrder + 1;
      glow.renderOrder = rail.renderOrder;
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
      supports.renderOrder = rail.renderOrder;
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
  for (const definition of levels) {
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
    nodeVisuals.push({
      key: definition.progressKey,
      position,
      padMaterial,
      rimMaterial,
      ring,
      beacon,
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
      plants,
      shoreline,
      beachTime,
      frame,
    ),
    water,
    groundMeshes,
  };
}
