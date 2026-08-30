import * as THREE from "three";

const TAU = Math.PI * 2;
const DEFAULT_SEGMENTS = 72;
const MINIMUM_SEGMENTS = 12;
const MAXIMUM_SEGMENTS = 256;
const MAXIMUM_OVALS = 512;

/** Exact Island Hopper shoreline-ring geometry authored in Unity. */
export const ISLAND_SHORE_FOAM_GEOMETRY = Object.freeze({
  segments: DEFAULT_SEGMENTS,
  innerScale: 1.01,
  outerScale: 1.105,
  innerLift: 0.035,
  outerLift: 0.04,
  broadShapeAmount: 0.045,
  fineShapeAmount: 0.022,
});

/** Exact IslandHopper_ShoreFoam material values from the Unity source. */
export const ISLAND_SHORE_FOAM_LOOK = Object.freeze({
  color: Object.freeze([0.88, 0.98, 1, 0.78] as const),
  pulseSpeed: 0.58,
  pulseAmount: 0.42,
  detailFrequency: 4.8,
  edgePower: 0.62,
});

export type IslandShoreFoamVec2 = readonly [x: number, z: number];
export type IslandShoreFoamVec3 = readonly [x: number, y: number, z: number];

/**
 * One horizontal oval in converted Three.js world coordinates.
 *
 * `center.y` is the ocean sea level. `right` and `forward` are planar basis
 * vectors; they are normalized before authoring so callers can pass a course
 * frame directly. `axes` are the source half-width and half-length.
 */
export interface IslandShoreFoamOval {
  center: IslandShoreFoamVec3;
  right: IslandShoreFoamVec3;
  forward: IslandShoreFoamVec3;
  axes: IslandShoreFoamVec2;
  phase: number;
}

export interface IslandShoreFoamOptions {
  /** Source uses 72. Lower values are available for explicitly reduced modes. */
  segments?: number;
  /** Converted Unity coordinates need -1; native Three.js authoring can use 1. */
  sourceZSign?: -1 | 1;
  /** Unity ocean ribbon is renderOrder 0, so the source accent defaults to 1. */
  renderOrder?: number;
  color?: readonly [r: number, g: number, b: number, a: number];
  pulseSpeed?: number;
  pulseAmount?: number;
  detailFrequency?: number;
  edgePower?: number;
}

export interface IslandShoreFoamDiagnostics {
  ovalCount: number;
  segmentsPerOval: number;
  vertexCount: number;
  triangleCount: number;
  drawCalls: 0 | 1;
  sourceZSign: -1 | 1;
  renderOrder: number;
  time: number;
  disposed: boolean;
}

export interface IslandShoreFoamSample {
  r: number;
  g: number;
  b: number;
  a: number;
  motion: number;
  edge: number;
}

interface NormalizedOval {
  cx: number;
  cy: number;
  cz: number;
  rx: number;
  rz: number;
  fx: number;
  fz: number;
  halfWidth: number;
  halfLength: number;
  phase: number;
}

interface ResolvedOptions {
  segments: number;
  sourceZSign: -1 | 1;
  renderOrder: number;
  color: readonly [number, number, number, number];
  pulseSpeed: number;
  pulseAmount: number;
  detailFrequency: number;
  edgePower: number;
}

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  vUv = uv;
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec4 uBaseColor;
uniform float uPulseSpeed;
uniform float uPulseAmount;
uniform float uDetailFrequency;
uniform float uEdgePower;
uniform float uSourceZSign;
uniform float uTime;
varying vec2 vUv;
varying vec3 vWorldPosition;

void main() {
  float phase = vUv.y * 6.28318530718 * uDetailFrequency
    + vWorldPosition.x * 0.115
    + vWorldPosition.z * 0.087 * uSourceZSign
    + uTime * uPulseSpeed * 6.28318530718;
  float broad = sin(phase);
  float fine = sin(phase * 1.79 + sin(phase * 0.43) * 1.6);
  float motion = clamp(0.58 + broad * 0.27 + fine * 0.15, 0.0, 1.0);
  float edge = pow(
    clamp(sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265359), 0.0, 1.0),
    max(0.25, uEdgePower)
  );
  float animatedAlpha = mix(1.0 - uPulseAmount, 1.0, motion);
  float brightness = mix(0.92, 1.12, motion * uPulseAmount);
  gl_FragColor = vec4(
    clamp(uBaseColor.rgb * brightness, 0.0, 1.0),
    uBaseColor.a * edge * animatedAlpha
  );
}
`;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value))
    throw new RangeError(`Island shore foam ${label} must be finite.`);
  return value;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalizeOval(source: IslandShoreFoamOval, index: number): NormalizedOval {
  const center = source.center;
  const right = source.right;
  const forward = source.forward;
  const axes = source.axes;
  if (
    !Array.isArray(center) || center.length !== 3 ||
    !Array.isArray(right) || right.length !== 3 ||
    !Array.isArray(forward) || forward.length !== 3 ||
    !Array.isArray(axes) || axes.length !== 2
  )
    throw new TypeError(`Island shore foam oval ${index} has an invalid tuple.`);

  const cx = finite(center[0], `oval ${index} center.x`);
  const cy = finite(center[1], `oval ${index} center.y`);
  const cz = finite(center[2], `oval ${index} center.z`);
  let rx = finite(right[0], `oval ${index} right.x`);
  let rz = finite(right[2], `oval ${index} right.z`);
  let fx = finite(forward[0], `oval ${index} forward.x`);
  let fz = finite(forward[2], `oval ${index} forward.z`);
  const rightLength = Math.hypot(rx, rz);
  const forwardLength = Math.hypot(fx, fz);
  if (rightLength < 1e-6 || forwardLength < 1e-6)
    throw new RangeError(`Island shore foam oval ${index} needs two planar basis vectors.`);
  rx /= rightLength;
  rz /= rightLength;
  fx /= forwardLength;
  fz /= forwardLength;
  if (Math.abs(rx * fx + rz * fz) > 0.999)
    throw new RangeError(`Island shore foam oval ${index} basis vectors are parallel.`);

  const halfWidth = finite(axes[0], `oval ${index} half-width`);
  const halfLength = finite(axes[1], `oval ${index} half-length`);
  if (halfWidth <= 0 || halfLength <= 0)
    throw new RangeError(`Island shore foam oval ${index} axes must be positive.`);
  return {
    cx,
    cy,
    cz,
    rx,
    rz,
    fx,
    fz,
    halfWidth,
    halfLength,
    phase: finite(source.phase, `oval ${index} phase`),
  };
}

function resolveOptions(options: IslandShoreFoamOptions): ResolvedOptions {
  const rawSegments = options.segments ?? DEFAULT_SEGMENTS;
  if (!Number.isInteger(rawSegments) || rawSegments < MINIMUM_SEGMENTS || rawSegments > MAXIMUM_SEGMENTS)
    throw new RangeError(
      `Island shore foam segments must be an integer from ${MINIMUM_SEGMENTS} to ${MAXIMUM_SEGMENTS}.`,
    );
  const sourceZSign = options.sourceZSign ?? -1;
  if (sourceZSign !== -1 && sourceZSign !== 1)
    throw new RangeError("Island shore foam sourceZSign must be -1 or 1.");
  const renderOrder = finite(options.renderOrder ?? 1, "render order");
  const color = options.color ?? ISLAND_SHORE_FOAM_LOOK.color;
  if (!Array.isArray(color) || color.length !== 4)
    throw new TypeError("Island shore foam color must be an RGBA tuple.");
  const resolvedColor = color.map((value, index) =>
    finite(value, `color channel ${index}`),
  ) as [number, number, number, number];
  if (resolvedColor.some((value) => value < 0 || value > 1))
    throw new RangeError("Island shore foam color channels must be between 0 and 1.");

  const pulseSpeed = finite(options.pulseSpeed ?? ISLAND_SHORE_FOAM_LOOK.pulseSpeed, "pulse speed");
  const pulseAmount = finite(options.pulseAmount ?? ISLAND_SHORE_FOAM_LOOK.pulseAmount, "pulse amount");
  const detailFrequency = finite(
    options.detailFrequency ?? ISLAND_SHORE_FOAM_LOOK.detailFrequency,
    "detail frequency",
  );
  const edgePower = finite(options.edgePower ?? ISLAND_SHORE_FOAM_LOOK.edgePower, "edge power");
  if (pulseSpeed < 0 || pulseAmount < 0 || pulseAmount > 1 || detailFrequency <= 0 || edgePower <= 0)
    throw new RangeError("Island shore foam animation settings are outside their valid range.");
  return {
    segments: rawSegments,
    sourceZSign,
    renderOrder,
    color: resolvedColor,
    pulseSpeed,
    pulseAmount,
    detailFrequency,
    edgePower,
  };
}

/** Builds every oval into one indexed geometry, so five source rings remain one draw. */
export function buildIslandShoreFoamGeometry(
  sources: readonly IslandShoreFoamOval[],
  segments = DEFAULT_SEGMENTS,
): THREE.BufferGeometry {
  if (!Array.isArray(sources) || sources.length < 1 || sources.length > MAXIMUM_OVALS)
    throw new RangeError(`Island shore foam needs 1-${MAXIMUM_OVALS} oval specs.`);
  if (!Number.isInteger(segments) || segments < MINIMUM_SEGMENTS || segments > MAXIMUM_SEGMENTS)
    throw new RangeError(
      `Island shore foam segments must be an integer from ${MINIMUM_SEGMENTS} to ${MAXIMUM_SEGMENTS}.`,
    );
  const ovals = sources.map(normalizeOval);
  const vertexCount = ovals.length * segments * 2;
  const positions = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const IndexArray = vertexCount > 65_535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(ovals.length * segments * 6);

  let vertexCursor = 0;
  let indexCursor = 0;
  for (const oval of ovals) {
    const firstVertex = vertexCursor;
    const phaseOffset = oval.phase / TAU;
    for (let index = 0; index < segments; index++) {
      const angle = (index / segments) * TAU;
      const wave = 1
        + ISLAND_SHORE_FOAM_GEOMETRY.broadShapeAmount * Math.sin(angle * 4 + oval.phase)
        + ISLAND_SHORE_FOAM_GEOMETRY.fineShapeAmount * Math.sin(angle * 9 - oval.phase);
      const dx = oval.rx * Math.cos(angle) * oval.halfWidth
        + oval.fx * Math.sin(angle) * oval.halfLength;
      const dz = oval.rz * Math.cos(angle) * oval.halfWidth
        + oval.fz * Math.sin(angle) * oval.halfLength;
      const inner = vertexCursor++;
      positions[inner * 3] = oval.cx + dx * ISLAND_SHORE_FOAM_GEOMETRY.innerScale * wave;
      positions[inner * 3 + 1] = oval.cy + ISLAND_SHORE_FOAM_GEOMETRY.innerLift;
      positions[inner * 3 + 2] = oval.cz + dz * ISLAND_SHORE_FOAM_GEOMETRY.innerScale * wave;
      uvs[inner * 2] = 0;
      uvs[inner * 2 + 1] = index / segments + phaseOffset;

      const outer = vertexCursor++;
      positions[outer * 3] = oval.cx + dx * ISLAND_SHORE_FOAM_GEOMETRY.outerScale * wave;
      positions[outer * 3 + 1] = oval.cy + ISLAND_SHORE_FOAM_GEOMETRY.outerLift;
      positions[outer * 3 + 2] = oval.cz + dz * ISLAND_SHORE_FOAM_GEOMETRY.outerScale * wave;
      uvs[outer * 2] = 1;
      uvs[outer * 2 + 1] = index / segments + phaseOffset;
    }
    for (let index = 0; index < segments; index++) {
      const next = (index + 1) % segments;
      const inner = firstVertex + index * 2;
      const outer = inner + 1;
      const nextInner = firstVertex + next * 2;
      const nextOuter = nextInner + 1;
      indices[indexCursor++] = inner;
      indices[indexCursor++] = nextInner;
      indices[indexCursor++] = outer;
      indices[indexCursor++] = outer;
      indices[indexCursor++] = nextInner;
      indices[indexCursor++] = nextOuter;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.name = "Island shore foam merged rings";
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** CPU parity probe for tests, authoring previews and deterministic diagnostics. */
export function evaluateIslandShoreFoam(
  uv: IslandShoreFoamVec2,
  worldX: number,
  worldZ: number,
  time: number,
  options: IslandShoreFoamOptions = {},
): IslandShoreFoamSample {
  const resolved = resolveOptions(options);
  const phase = finite(uv[1], "sample uv.y") * TAU * resolved.detailFrequency
    + finite(worldX, "sample world.x") * 0.115
    + finite(worldZ, "sample world.z") * 0.087 * resolved.sourceZSign
    + finite(time, "sample time") * resolved.pulseSpeed * TAU;
  const broad = Math.sin(phase);
  const fine = Math.sin(phase * 1.79 + Math.sin(phase * 0.43) * 1.6);
  const motion = clamp01(0.58 + broad * 0.27 + fine * 0.15);
  const edge = Math.pow(
    clamp01(Math.sin(clamp01(finite(uv[0], "sample uv.x")) * Math.PI)),
    Math.max(0.25, resolved.edgePower),
  );
  const animatedAlpha = THREE.MathUtils.lerp(1 - resolved.pulseAmount, 1, motion);
  const brightness = THREE.MathUtils.lerp(0.92, 1.12, motion * resolved.pulseAmount);
  return {
    r: clamp01(resolved.color[0] * brightness),
    g: clamp01(resolved.color[1] * brightness),
    b: clamp01(resolved.color[2] * brightness),
    a: resolved.color[3] * edge * animatedAlpha,
    motion,
    edge,
  };
}

/**
 * One lifecycle owner for the merged source rings. Add `group` to Level.root,
 * call `update(dt)` from Level.update, and call `dispose()` during teardown.
 */
export class IslandShoreFoam {
  readonly group = new THREE.Group();
  readonly geometry: THREE.BufferGeometry;
  readonly material: THREE.ShaderMaterial;
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;

  private readonly ovalCount: number;
  private readonly segments: number;
  private readonly sourceZSign: -1 | 1;
  private elapsed = 0;
  private disposed = false;

  constructor(
    sources: readonly IslandShoreFoamOval[],
    options: IslandShoreFoamOptions = {},
  ) {
    const resolved = resolveOptions(options);
    this.ovalCount = sources.length;
    this.segments = resolved.segments;
    this.sourceZSign = resolved.sourceZSign;
    this.geometry = buildIslandShoreFoamGeometry(sources, resolved.segments);
    this.material = new THREE.ShaderMaterial({
      name: "Unity Island Hopper shore foam",
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
      uniforms: {
        uBaseColor: {
          value: new THREE.Vector4(
            resolved.color[0],
            resolved.color[1],
            resolved.color[2],
            resolved.color[3],
          ),
        },
        uPulseSpeed: { value: resolved.pulseSpeed },
        uPulseAmount: { value: resolved.pulseAmount },
        uDetailFrequency: { value: resolved.detailFrequency },
        uEdgePower: { value: resolved.edgePower },
        uSourceZSign: { value: resolved.sourceZSign },
        uTime: { value: 0 },
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.name = "Island shore foam (merged)";
    this.mesh.renderOrder = resolved.renderOrder;
    this.mesh.castShadow = false;
    this.mesh.receiveShadow = false;
    this.group.name = "Animated island shoreline accents";
    this.group.userData.noShadow = true;
    this.group.add(this.mesh);
  }

  update(dt: number): void {
    if (this.disposed || !Number.isFinite(dt) || dt <= 0) return;
    this.elapsed += dt;
    this.material.uniforms.uTime.value = this.elapsed;
  }

  setTime(seconds: number): void {
    if (this.disposed) return;
    this.elapsed = Math.max(0, finite(seconds, "time"));
    this.material.uniforms.uTime.value = this.elapsed;
  }

  get diagnostics(): IslandShoreFoamDiagnostics {
    return {
      ovalCount: this.ovalCount,
      segmentsPerOval: this.segments,
      vertexCount: this.geometry.getAttribute("position")?.count ?? 0,
      triangleCount: (this.geometry.getIndex()?.count ?? 0) / 3,
      drawCalls: this.disposed ? 0 : 1,
      sourceZSign: this.sourceZSign,
      renderOrder: this.mesh.renderOrder,
      time: this.elapsed,
      disposed: this.disposed,
    };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.group.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}

export function createIslandShoreFoam(
  sources: readonly IslandShoreFoamOval[],
  options: IslandShoreFoamOptions = {},
): IslandShoreFoam {
  return new IslandShoreFoam(sources, options);
}
