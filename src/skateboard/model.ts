import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  DEFAULT_SKATEBOARD_SETTINGS,
  SKATEBOARD_DEFAULT_ARTWORK,
  SKATEBOARD_DEFAULT_TRUCK,
  clampSkateboardSettings,
  type SkateboardColor,
  type SkateboardSettingsValue,
} from "./settings";

export const SKATEBOARD_PLYWOOD_BANDS = 5;
export const SKATEBOARD_MATERIAL_COUNT = 2 + SKATEBOARD_PLYWOOD_BANDS;
export const SKATEBOARD_GRIP_TOP =
  DEFAULT_SKATEBOARD_SETTINGS.boardToGroundDistance;

export interface SkateboardGeometryStats {
  readonly vertices: number;
  readonly triangles: number;
  readonly materialGroups: number;
  readonly length: number;
  readonly width: number;
  readonly thickness: number;
}

interface Vec2 {
  x: number;
  y: number;
}

interface MeshBuffers {
  readonly positions: number[];
  readonly uvs: number[];
  readonly wearUvs: number[];
  readonly groups: number[][];
}

const assetUrl = (path: string): string => {
  if (/^(?:https?:|data:|blob:)/i.test(path)) return path;
  const clean = path.replace(/^\.?\//, "");
  return `${import.meta.env.BASE_URL}${clean}`;
};

const TRUCK_ATLAS_PATH = "skateboard/skateboard-truck.webp";

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));

export function smootherStep(value: number): number {
  const t = clamp01(value);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export function evaluateSkateboardHalfWidth(
  source: Readonly<SkateboardSettingsValue>,
  normalizedLongitudinalPosition: number,
): number {
  const u = THREE.MathUtils.clamp(normalizedLongitudinalPosition, -1, 1);
  const halfWidth = source.deckHalfWidth;
  if (u < source.centralTailTransition) {
    const taper = clamp01(
      (source.centralTailTransition - u) /
        (source.centralTailTransition + 1),
    );
    const baseValue = Math.max(
      0,
      1 - Math.pow(taper, source.tailTaperLongitudinalExponent),
    );
    return (
      halfWidth *
      Math.pow(baseValue, 1 / source.tailTaperTransverseExponent)
    );
  }
  if (u > source.centralNoseTransition) {
    const taper = clamp01(
      (u - source.centralNoseTransition) /
        (1 - source.centralNoseTransition),
    );
    const baseValue = Math.max(
      0,
      1 - Math.pow(taper, source.noseTaperLongitudinalExponent),
    );
    return (
      halfWidth *
      Math.pow(baseValue, 1 / source.noseTaperTransverseExponent)
    );
  }
  return halfWidth;
}

export function evaluateSkateboardSurfaceHeight(
  source: Readonly<SkateboardSettingsValue>,
  x: number,
  z: number,
): number {
  const length = source.deckTailLength + source.deckNoseLength;
  const u = THREE.MathUtils.clamp((2 * z) / length, -1, 1);
  const noseKick =
    source.noseKickRise *
    smootherStep(
      (u - source.noseKickStart) / (1 - source.noseKickStart),
    );
  const tailKick =
    source.tailKickRise *
    smootherStep(
      (source.tailKickStart - u) / (source.tailKickStart + 1),
    );
  const concaveFade = smootherStep(
    (Math.abs(u) - source.concaveFadeStart) /
      (1 - source.concaveFadeStart),
  );
  const localConcave = THREE.MathUtils.lerp(
    source.concaveDepth,
    source.concaveDepth * source.concaveTipMultiplier,
    concaveFade,
  );
  const halfWidth = evaluateSkateboardHalfWidth(source, u);
  const across =
    halfWidth > 0.000001 ? THREE.MathUtils.clamp(x / halfWidth, -1, 1) : 0;
  return noseKick + tailKick + localConcave * across * across;
}

function normalized(v: Vec2): Vec2 {
  const length = Math.hypot(v.x, v.y);
  return length > 0.0000001
    ? { x: v.x / length, y: v.y / length }
    : { x: 0, y: 0 };
}

function buildFullPerimeter(
  settings: Readonly<SkateboardSettingsValue>,
): Vec2[] {
  const rows = settings.deckLengthSegments;
  const result: Vec2[] = new Array(2 * rows - 2);
  const halfLength = (settings.deckTailLength + settings.deckNoseLength) * 0.5;
  result[0] = { x: 0, y: -halfLength };
  for (let row = 1; row < rows - 1; row++) {
    const u = -1 + (2 * row) / (rows - 1);
    result[row] = {
      x: evaluateSkateboardHalfWidth(settings, u),
      y: u * halfLength,
    };
  }
  result[rows - 1] = { x: 0, y: halfLength };
  let write = rows;
  for (let row = rows - 2; row >= 1; row--) {
    const u = -1 + (2 * row) / (rows - 1);
    result[write++] = {
      x: -evaluateSkateboardHalfWidth(settings, u),
      y: u * halfLength,
    };
  }
  return result;
}

function buildInwardMiters(perimeter: readonly Vec2[]): Vec2[] {
  return perimeter.map((current, index) => {
    const previous = perimeter[(index + perimeter.length - 1) % perimeter.length];
    const next = perimeter[(index + 1) % perimeter.length];
    const incoming = normalized({
      x: current.x - previous.x,
      y: current.y - previous.y,
    });
    const outgoing = normalized({
      x: next.x - current.x,
      y: next.y - current.y,
    });
    const incomingInward = { x: -incoming.y, y: incoming.x };
    const outgoingInward = { x: -outgoing.y, y: outgoing.x };
    let bisector = {
      x: incomingInward.x + outgoingInward.x,
      y: incomingInward.y + outgoingInward.y,
    };
    if (bisector.x * bisector.x + bisector.y * bisector.y <= 0.0000001)
      return outgoingInward;
    bisector = normalized(bisector);
    const denominator = Math.max(
      0.5,
      bisector.x * outgoingInward.x + bisector.y * outgoingInward.y,
    );
    bisector = {
      x: bisector.x / denominator,
      y: bisector.y / denominator,
    };
    const magnitude = Math.hypot(bisector.x, bisector.y);
    if (magnitude <= 2) return bisector;
    return { x: (bisector.x / magnitude) * 2, y: (bisector.y / magnitude) * 2 };
  });
}

function railInset(
  settings: Readonly<SkateboardSettingsValue>,
  normalizedDepth: number,
): number {
  if (settings.railBevelRadius <= 0) return 0;
  const radius = Math.min(settings.railBevelRadius, settings.deckThickness * 0.5);
  const distanceFromMiddle =
    Math.abs(clamp01(normalizedDepth) - 0.5) * settings.deckThickness;
  const flatHalfHeight = settings.deckThickness * 0.5 - radius;
  if (distanceFromMiddle <= flatHalfHeight) return 0;
  const arcHeight = clamp01(
    (distanceFromMiddle - flatHalfHeight) / Math.max(radius, 0.000001),
  );
  const outward = radius * Math.sqrt(Math.max(0, 1 - arcHeight * arcHeight));
  return radius - outward;
}

function offsetPerimeter(
  perimeter: readonly Vec2[],
  miters: readonly Vec2[],
  inset: number,
): Vec2[] {
  return perimeter.map((point, index) => ({
    x: point.x + miters[index].x * inset,
    y: point.y + miters[index].y * inset,
  }));
}

function parametricWearUv(
  settings: Readonly<SkateboardSettingsValue>,
  point: Vec2,
): Vec2 {
  const length = settings.deckTailLength + settings.deckNoseLength;
  const u = THREE.MathUtils.clamp((2 * point.y) / length, -1, 1);
  const halfWidth = evaluateSkateboardHalfWidth(settings, u);
  return {
    x: halfWidth <= 0.000001 ? 0.5 : clamp01(point.x / (2 * halfWidth) + 0.5),
    y: u * 0.5 + 0.5,
  };
}

function addVertex(
  buffers: MeshBuffers,
  point: Vec2,
  settings: Readonly<SkateboardSettingsValue>,
  thicknessDepth: number,
  wearUv: Vec2,
): number {
  const length = settings.deckTailLength + settings.deckNoseLength;
  const width = settings.deckHalfWidth * 2;
  const index = buffers.positions.length / 3;
  buffers.positions.push(
    point.x,
    evaluateSkateboardSurfaceHeight(settings, point.x, point.y) -
      settings.deckThickness * thicknessDepth,
    point.y,
  );
  buffers.uvs.push(point.x / width + 0.5, point.y / length + 0.5);
  buffers.wearUvs.push(wearUv.x, wearUv.y);
  return index;
}

const triangle = (target: number[], a: number, b: number, c: number): void => {
  target.push(a, b, c);
};

export function buildSkateboardDeckGeometry(
  source: Readonly<SkateboardSettingsValue> = DEFAULT_SKATEBOARD_SETTINGS,
): THREE.BufferGeometry {
  const settings = clampSkateboardSettings(source);
  const rows = settings.deckLengthSegments;
  const columns = settings.deckWidthSegments;
  const perimeter = buildFullPerimeter(settings);
  const miters = buildInwardMiters(perimeter);
  const topPerimeter = offsetPerimeter(
    perimeter,
    miters,
    railInset(settings, 0),
  );
  const buffers: MeshBuffers = {
    positions: [],
    uvs: [],
    wearUvs: [],
    groups: Array.from({ length: SKATEBOARD_MATERIAL_COUNT }, () => []),
  };
  const topBoundary = new Array<number>(perimeter.length);
  const rowStarts = new Array<number>(rows).fill(-1);
  const tailTip = addVertex(
    buffers,
    topPerimeter[0],
    settings,
    0,
    { x: 0.5, y: 0 },
  );
  topBoundary[0] = tailTip;
  rowStarts[0] = tailTip;
  for (let row = 1; row < rows - 1; row++) {
    const rightIndex = row;
    const leftIndex = 2 * rows - 2 - row;
    const left = topPerimeter[leftIndex];
    const right = topPerimeter[rightIndex];
    rowStarts[row] = buffers.positions.length / 3;
    for (let column = 0; column < columns; column++) {
      const across = column / (columns - 1);
      addVertex(
        buffers,
        {
          x: THREE.MathUtils.lerp(left.x, right.x, across),
          y: THREE.MathUtils.lerp(left.y, right.y, across),
        },
        settings,
        0,
        { x: across, y: row / (rows - 1) },
      );
    }
    topBoundary[leftIndex] = rowStarts[row];
    topBoundary[rightIndex] = rowStarts[row] + columns - 1;
  }
  const noseIndex = rows - 1;
  const noseTip = addVertex(
    buffers,
    topPerimeter[noseIndex],
    settings,
    0,
    { x: 0.5, y: 1 },
  );
  topBoundary[noseIndex] = noseTip;
  rowStarts[rows - 1] = noseTip;

  const top = buffers.groups[0];
  for (let column = 0; column < columns - 1; column++)
    triangle(top, tailTip, rowStarts[1] + column, rowStarts[1] + column + 1);
  for (let row = 1; row < rows - 2; row++) {
    const current = rowStarts[row];
    const next = rowStarts[row + 1];
    for (let column = 0; column < columns - 1; column++) {
      const lowerLeft = current + column;
      const lowerRight = lowerLeft + 1;
      const upperLeft = next + column;
      const upperRight = upperLeft + 1;
      triangle(top, lowerLeft, upperLeft, lowerRight);
      triangle(top, lowerRight, upperLeft, upperRight);
    }
  }
  const finalRow = rowStarts[rows - 2];
  for (let column = 0; column < columns - 1; column++)
    triangle(top, finalRow + column, noseTip, finalRow + column + 1);

  const topVertexCount = buffers.positions.length / 3;
  for (let index = 0; index < topVertexCount; index++) {
    buffers.positions.push(
      buffers.positions[index * 3],
      buffers.positions[index * 3 + 1] - settings.deckThickness,
      buffers.positions[index * 3 + 2],
    );
    buffers.uvs.push(buffers.uvs[index * 2], buffers.uvs[index * 2 + 1]);
    buffers.wearUvs.push(
      buffers.wearUvs[index * 2],
      buffers.wearUvs[index * 2 + 1],
    );
  }
  const bottomBoundary = topBoundary.map((index) => index + topVertexCount);
  const bottom = buffers.groups[1];
  for (let index = 0; index < top.length; index += 3)
    triangle(
      bottom,
      top[index + 2] + topVertexCount,
      top[index + 1] + topVertexCount,
      top[index] + topVertexCount,
    );

  const bevelSegments = settings.railBevelSegments;
  const sideSlices = SKATEBOARD_PLYWOOD_BANDS * bevelSegments;
  const rings: number[][] = new Array(sideSlices + 1);
  rings[0] = topBoundary;
  rings[sideSlices] = bottomBoundary;
  for (let slice = 1; slice < sideSlices; slice++) {
    const depth = slice / sideSlices;
    const ringPerimeter = offsetPerimeter(
      perimeter,
      miters,
      railInset(settings, depth),
    );
    rings[slice] = ringPerimeter.map((point) =>
      addVertex(
        buffers,
        point,
        settings,
        depth,
        parametricWearUv(settings, point),
      ),
    );
  }
  for (let slice = 0; slice < sideSlices; slice++) {
    const band = Math.min(
      SKATEBOARD_PLYWOOD_BANDS - 1,
      Math.floor((slice * SKATEBOARD_PLYWOOD_BANDS) / sideSlices),
    );
    const indices = buffers.groups[2 + band];
    const upper = rings[slice];
    const lower = rings[slice + 1];
    for (let point = 0; point < perimeter.length; point++) {
      const next = (point + 1) % perimeter.length;
      triangle(indices, upper[point], upper[next], lower[point]);
      triangle(indices, upper[next], lower[next], lower[point]);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(buffers.positions, 3),
  );
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(buffers.uvs, 2));
  geometry.setAttribute(
    "wearUv",
    new THREE.Float32BufferAttribute(buffers.wearUvs, 2),
  );
  const joined: number[] = [];
  for (let materialIndex = 0; materialIndex < buffers.groups.length; materialIndex++) {
    const start = joined.length;
    joined.push(...buffers.groups[materialIndex]);
    geometry.addGroup(start, joined.length - start, materialIndex);
  }
  geometry.setIndex(new THREE.Uint32BufferAttribute(joined, 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = "SurfCruiserDeck_Baked_Web";
  geometry.userData.stats = {
    vertices: buffers.positions.length / 3,
    triangles: joined.length / 3,
    materialGroups: buffers.groups.length,
    length: settings.deckTailLength + settings.deckNoseLength,
    width: settings.deckHalfWidth * 2,
    thickness: settings.deckThickness,
  } satisfies SkateboardGeometryStats;
  return geometry;
}

let gripTexture: THREE.DataTexture | null = null;

function pixelHash(x: number, y: number, seed: number): number {
  let value = (seed ^ Math.imul(x, 0x9e3779b9) ^ Math.imul(y, 0x85ebca6b)) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  value = Math.imul(value, 0x7feb352d) >>> 0;
  value = (value ^ (value >>> 15)) >>> 0;
  value = Math.imul(value, 0x846ca68b) >>> 0;
  return (value ^ (value >>> 16)) >>> 0;
}

function getGripTexture(): THREE.DataTexture {
  if (gripTexture) return gripTexture;
  const width = 256;
  const height = 512;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hash = pixelHash(x, y, 0x8d26a3f1);
      const grit = 24 + (hash & 0x1f);
      const stripe = Math.abs((x + 0.5) / width - 0.5) < 0.008;
      const offset = (y * width + x) * 4;
      pixels[offset] = stripe ? 191 + ((hash >>> 8) & 0x0f) : grit;
      pixels[offset + 1] = stripe
        ? 126 + (((hash >>> 8) & 0x0f) >> 1)
        : grit;
      pixels[offset + 2] = stripe
        ? 65 + Math.floor(((hash >>> 8) & 0x0f) / 3)
        : Math.min(255, grit + 3);
      pixels[offset + 3] = 255;
    }
  }
  gripTexture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  gripTexture.name = "SkateboardDeck_Grip_Default_Web";
  gripTexture.colorSpace = THREE.SRGBColorSpace;
  gripTexture.wrapS = gripTexture.wrapT = THREE.ClampToEdgeWrapping;
  gripTexture.minFilter = THREE.LinearMipmapLinearFilter;
  gripTexture.magFilter = THREE.LinearFilter;
  gripTexture.generateMipmaps = true;
  gripTexture.anisotropy = 2;
  gripTexture.needsUpdate = true;
  return gripTexture;
}

const artworkTextures = new Map<string, THREE.Texture>();

function getArtworkTexture(path: string): THREE.Texture {
  const resolved = assetUrl(path || SKATEBOARD_DEFAULT_ARTWORK);
  const cached = artworkTextures.get(resolved);
  if (cached) return cached;
  const fallback = new Uint8Array([207, 113, 49, 255]);
  const texture = new THREE.DataTexture(fallback, 1, 1, THREE.RGBAFormat);
  texture.name = "SurfCruiser_OrangeSun_Loading";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  artworkTextures.set(resolved, texture);
  new THREE.TextureLoader().load(
    resolved,
    (loaded) => {
      loaded.name = "SurfCruiser_OrangeSun_BaseArtwork_Web";
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.wrapS = loaded.wrapT = THREE.ClampToEdgeWrapping;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.magFilter = THREE.LinearFilter;
      loaded.generateMipmaps = true;
      loaded.anisotropy = 4;
      loaded.needsUpdate = true;
      // Keep the stable uniform object while its image becomes available.
      texture.image = loaded.image;
      texture.source = loaded.source;
      texture.name = loaded.name;
      texture.wrapS = loaded.wrapS;
      texture.wrapT = loaded.wrapT;
      texture.minFilter = loaded.minFilter;
      texture.magFilter = loaded.magFilter;
      texture.generateMipmaps = loaded.generateMipmaps;
      texture.needsUpdate = true;
    },
    undefined,
    (error) => console.warn(`Could not load skateboard artwork ${resolved}`, error),
  );
  return texture;
}

const SURFACE_VERTEX = `
  attribute vec2 wearUv;
  varying vec2 vUv;
  varying vec2 vWearUv;
  void main() {
    vUv = uv;
    vWearUv = wearUv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const SURFACE_FRAGMENT = `
  uniform sampler2D baseMap;
  uniform vec3 baseColor;
  uniform vec3 wearColor;
  uniform vec4 baseMapTransform;
  uniform float deckAspect;
  uniform float wearInset;
  uniform float wearWidth;
  uniform float wearRoughness;
  uniform float wearFrequency;
  uniform float wearOpacity;
  varying vec2 vUv;
  varying vec2 vWearUv;

  float hash21(vec2 value) {
    value = fract(value * vec2(123.34, 456.21));
    value += dot(value, value + 45.32);
    return fract(value.x * value.y);
  }
  float perimeterDistance(vec2 value) {
    vec2 nearEdge = min(value, 1.0 - value);
    return min(nearEdge.x, nearEdge.y * max(0.01, deckAspect));
  }
  float wearStroke(vec2 value) {
    float frequency = max(2.0, wearFrequency);
    float coarse = hash21(floor(value * frequency));
    float fine = hash21(floor(value * frequency * 2.37 + 17.0));
    float rough = ((coarse * 0.7 + fine * 0.3) - 0.5)
      * wearRoughness * wearWidth * 2.0;
    float edge = perimeterDistance(value);
    float primary = 1.0 - smoothstep(
      wearWidth * 0.35,
      wearWidth,
      abs(edge - (wearInset + rough))
    );
    float secondary = 1.0 - smoothstep(
      wearWidth * 0.2,
      wearWidth * 0.7,
      abs(edge - (wearInset + wearWidth * 1.85 - rough * 0.55))
    );
    return clamp(primary + secondary * 0.38, 0.0, 1.0) * wearOpacity;
  }
  void main() {
    vec2 baseUv = vUv * baseMapTransform.xy + baseMapTransform.zw;
    vec3 color = texture2D(baseMap, baseUv).rgb * baseColor;
    float wear = wearStroke(vWearUv);
    color = mix(color, wearColor, wear);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function colorVector(color: SkateboardColor): THREE.Vector3 {
  return new THREE.Vector3(color.r, color.g, color.b);
}

function surfaceMaterial(
  name: string,
  texture: THREE.Texture,
  settings: Readonly<SkateboardSettingsValue>,
  bottom: boolean,
): THREE.ShaderMaterial {
  const artworkTiling = bottom ? 1 / settings.artworkScale : 1;
  const artworkOffset = bottom ? 0.5 - 0.5 * artworkTiling : 0;
  return new THREE.ShaderMaterial({
    name,
    uniforms: {
      baseMap: { value: texture },
      baseColor: { value: new THREE.Vector3(1, 1, 1) },
      baseMapTransform: {
        value: new THREE.Vector4(
          artworkTiling,
          artworkTiling,
          artworkOffset,
          artworkOffset,
        ),
      },
      deckAspect: {
        value:
          (settings.deckTailLength + settings.deckNoseLength) /
          (settings.deckHalfWidth * 2),
      },
      wearColor: { value: colorVector(settings.plywoodLightColor) },
      wearInset: { value: bottom ? 0.035 : 0.032 },
      wearWidth: { value: bottom ? 0.016 : 0.013 },
      wearRoughness: {
        value: bottom
          ? settings.bottomWearRoughness
          : settings.topWearRoughness,
      },
      wearFrequency: { value: bottom ? 88 : 112 },
      wearOpacity: { value: bottom ? settings.bottomWear : settings.topWear },
    },
    vertexShader: SURFACE_VERTEX,
    fragmentShader: SURFACE_FRAGMENT,
    side: THREE.FrontSide,
  });
}

function deckMaterials(
  settings: Readonly<SkateboardSettingsValue>,
): THREE.Material[] {
  const materials: THREE.Material[] = [
    surfaceMaterial(
      "SkateboardDeck_TopGrip_Flat_Web",
      getGripTexture(),
      settings,
      false,
    ),
    surfaceMaterial(
      "SkateboardDeck_BottomArt_Flat_Web",
      getArtworkTexture(settings.bottomArtworkPath),
      settings,
      true,
    ),
  ];
  for (let index = 0; index < SKATEBOARD_PLYWOOD_BANDS; index++) {
    const color =
      (index & 1) === 0
        ? settings.plywoodLightColor
        : settings.plywoodDarkColor;
    materials.push(
      new THREE.MeshBasicMaterial({
        name: `SkateboardDeck_PlyBand_${index + 1}_Flat_Web`,
        color: new THREE.Color(color.r, color.g, color.b),
      }),
    );
  }
  return materials;
}

function markUnlit(root: THREE.Object3D): void {
  root.traverse((object) => {
    object.userData.noShadow = true;
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
}

function createFallbackTruck(
  name: string,
  z: number,
  settings: Readonly<SkateboardSettingsValue>,
): THREE.Group {
  const root = new THREE.Group();
  root.name = name;
  const material = new THREE.MeshBasicMaterial({
    name: "SkateboardTruck_Fallback_Flat",
    color: 0xb9bfc9,
  });
  const underside = settings.boardToGroundDistance - settings.deckThickness;
  const baseplate = new THREE.Mesh(
    new THREE.BoxGeometry(
      settings.truckBaseplateWidth,
      settings.truckBaseplateThickness,
      settings.truckBaseplateLength,
    ),
    material,
  );
  baseplate.position.set(
    0,
    underside - settings.truckBaseplateThickness * 0.5,
    z,
  );
  root.add(baseplate);
  const hanger = new THREE.Mesh(
    new THREE.CylinderGeometry(
      settings.truckHangerRadius,
      settings.truckHangerRadius,
      settings.wheelTrackHalfWidth * 2 + settings.wheelWidth * 0.4,
      12,
    ),
    material,
  );
  hanger.rotation.z = Math.PI * 0.5;
  hanger.position.set(0, settings.wheelRadius, z);
  root.add(hanger);
  const kingpinHeight = Math.max(0.02, underside - settings.wheelRadius);
  const kingpin = new THREE.Mesh(
    new THREE.CylinderGeometry(
      settings.truckHangerRadius * 0.725,
      settings.truckHangerRadius * 0.725,
      kingpinHeight,
      10,
    ),
    material,
  );
  kingpin.position.set(0, settings.wheelRadius + kingpinHeight * 0.5, z);
  root.add(kingpin);
  markUnlit(root);
  return root;
}

function createWheels(
  settings: Readonly<SkateboardSettingsValue>,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "Wheels_Procedural";
  const material = new THREE.MeshBasicMaterial({
    name: "SkateboardWheel_Purple_Flat",
    color: new THREE.Color(117 / 255, 96 / 255, 128 / 255),
  });
  const geometry = new THREE.CylinderGeometry(
    settings.wheelRadius,
    settings.wheelRadius,
    settings.wheelWidth,
    18,
    1,
  );
  for (const [endName, z] of [
    ["Front", settings.frontTruckLocalZ],
    ["Rear", settings.rearTruckLocalZ],
  ] as const) {
    for (const [sideName, x] of [
      ["Left", -settings.wheelTrackHalfWidth],
      ["Right", settings.wheelTrackHalfWidth],
    ] as const) {
      const wheel = new THREE.Mesh(geometry, material);
      wheel.name = `Wheel_${endName}_${sideName}`;
      wheel.rotation.z = Math.PI * 0.5;
      wheel.position.set(x, settings.wheelRadius, z);
      root.add(wheel);
    }
  }
  markUnlit(root);
  return root;
}

let truckTemplatePromise: Promise<THREE.Group> | null = null;
let truckAtlas: THREE.Texture | null = null;

function getTruckAtlas(): THREE.Texture {
  if (truckAtlas) return truckAtlas;
  truckAtlas = new THREE.TextureLoader().load(assetUrl(TRUCK_ATLAS_PATH));
  truckAtlas.name = "SkateboardTruck_BaseColor_Web";
  truckAtlas.colorSpace = THREE.SRGBColorSpace;
  truckAtlas.flipY = false; // glTF UV convention
  truckAtlas.wrapS = truckAtlas.wrapT = THREE.ClampToEdgeWrapping;
  truckAtlas.minFilter = THREE.LinearMipmapLinearFilter;
  truckAtlas.magFilter = THREE.LinearFilter;
  truckAtlas.generateMipmaps = true;
  truckAtlas.anisotropy = 8;
  return truckAtlas;
}

function getTruckTemplate(path: string): Promise<THREE.Group> {
  if (truckTemplatePromise) return truckTemplatePromise;
  truckTemplatePromise = new Promise((resolve, reject) => {
    new GLTFLoader().load(
      assetUrl(path || SKATEBOARD_DEFAULT_TRUCK),
      (gltf) => {
        const template = gltf.scene;
        template.name = "SkateboardTruck_Prefab_Web";
        template.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.material = new THREE.MeshBasicMaterial({
            name: "SkateboardTruck_FlatUnlit_Web",
            map: getTruckAtlas(),
            color: 0xffffff,
          });
        });
        markUnlit(template);
        resolve(template);
      },
      undefined,
      reject,
    );
  });
  return truckTemplatePromise;
}

function addSockets(
  root: THREE.Group,
  settings: Readonly<SkateboardSettingsValue>,
): void {
  const sockets: ReadonlyArray<readonly [string, number, number]> = [
    ["socket-board-left", settings.deckHalfWidth, 0],
    ["socket-board-right", -settings.deckHalfWidth, 0],
    ["socket-board-nose", 0, settings.deckNoseLength],
    ["socket-board-tail", 0, -settings.deckTailLength],
  ];
  for (const [name, x, z] of sockets) {
    const socket = new THREE.Object3D();
    socket.name = name;
    socket.position.set(x, settings.boardToGroundDistance, z);
    socket.userData.gripNormal = [0, 1, 0];
    root.add(socket);
  }
}

function disposeRebuiltParts(root: THREE.Group): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  for (const name of [
    "Deck_ContinuousRoundedKick",
    "Wheels_Procedural",
    "Hardware_Fallback",
  ]) {
    root.getObjectByName(name)?.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      geometries.add(object.geometry);
      const source = Array.isArray(object.material)
        ? object.material
        : [object.material];
      for (const material of source) materials.add(material);
    });
  }
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
}

export function rebuildSkateboardPresentation(
  root: THREE.Group,
  source: Readonly<SkateboardSettingsValue>,
): void {
  const settings = clampSkateboardSettings(source);
  const token = Number(root.userData.buildToken ?? 0) + 1;
  root.userData.buildToken = token;
  // Lab boards are not cloned, so a slider rebuild can immediately reclaim
  // its generated deck/wheel/fallback resources. Player boards opt out: their
  // loose-board and spin-flip clones intentionally share the old resources.
  if (!root.userData.preserveResourcesOnRebuild) disposeRebuiltParts(root);
  root.clear();
  root.name ||= "board";
  root.userData.gripTop = settings.boardToGroundDistance;
  root.userData.settings = settings;
  root.userData.assetReady = false;
  const geometry = buildSkateboardDeckGeometry(settings);
  root.userData.geometryStats = geometry.userData.stats;
  const deck = new THREE.Mesh(geometry, deckMaterials(settings));
  deck.name = "Deck_ContinuousRoundedKick";
  deck.position.y = settings.boardToGroundDistance;
  deck.castShadow = false;
  deck.receiveShadow = false;
  root.add(deck);

  const fallback = new THREE.Group();
  fallback.name = "Hardware_Fallback";
  fallback.add(
    createFallbackTruck("FrontTruck_Fallback", settings.frontTruckLocalZ, settings),
    createFallbackTruck("RearTruck_Fallback", settings.rearTruckLocalZ, settings),
  );
  root.add(fallback, createWheels(settings));
  addSockets(root, settings);
  markUnlit(root);

  getTruckTemplate(settings.truckModelPath).then(
    (template) => {
      if (root.userData.buildToken !== token) return;
      const underside = settings.boardToGroundDistance - settings.deckThickness;
      const trucks = new THREE.Group();
      trucks.name = "Hardware_Imported";
      const ratio =
        settings.replacementTruckScale /
        DEFAULT_SKATEBOARD_SETTINGS.replacementTruckScale;
      for (const [name, z, yaw] of [
        ["FrontTruck_Model", settings.frontTruckLocalZ, 0],
        ["RearTruck_Model", settings.rearTruckLocalZ, Math.PI],
      ] as const) {
        const truck = template.clone(true);
        truck.name = name;
        truck.position.set(0, underside, z);
        truck.rotation.y = yaw;
        truck.scale.setScalar(ratio);
        trucks.add(truck);
      }
      fallback.removeFromParent();
      root.add(trucks);
      root.userData.assetReady = true;
      markUnlit(trucks);
    },
    (error) => {
      root.userData.assetError = String(error);
      console.warn("Using procedural skateboard trucks", error);
    },
  );
}

export function createSkateboardPresentation(
  source: Readonly<SkateboardSettingsValue> = DEFAULT_SKATEBOARD_SETTINGS,
): THREE.Group {
  const root = new THREE.Group();
  root.name = "board";
  rebuildSkateboardPresentation(root, source);
  return root;
}

export function skateboardGeometryStats(
  geometry: THREE.BufferGeometry,
): SkateboardGeometryStats {
  const saved = geometry.userData.stats as SkateboardGeometryStats | undefined;
  if (saved) return saved;
  return {
    vertices: geometry.getAttribute("position")?.count ?? 0,
    triangles: (geometry.index?.count ?? 0) / 3,
    materialGroups: geometry.groups.length,
    length: 0,
    width: 0,
    thickness: 0,
  };
}

/** Additional pivot lift for a detached deck resting artwork-up. */
export function skateboardRestingPivotLift(
  board: THREE.Object3D,
  worldAttitude: THREE.Quaternion,
): number {
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(worldAttitude);
  if (up.y >= 0) return 0;
  const settings = (board.userData.settings ??
    DEFAULT_SKATEBOARD_SETTINGS) as SkateboardSettingsValue;
  const deck = board.getObjectByName("Deck_ContinuousRoundedKick") as
    | THREE.Mesh<THREE.BufferGeometry>
    | undefined;
  const highest = deck?.geometry.boundingBox?.max.y ??
    Math.max(settings.tailKickRise, settings.noseKickRise) + settings.concaveDepth;
  return settings.boardToGroundDistance + Math.max(0, highest);
}
