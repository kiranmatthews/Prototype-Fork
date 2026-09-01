import * as THREE from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const STRETCHABLE_BONE_SCHEMA_VERSION = 1 as const;
export const STRETCHABLE_BONE_MIN_SCALE = 0.319;
export const STRETCHABLE_BONE_MAX_SCALE = 2.765;

export interface StretchableBoneOptions {
  id: string;
  length: number;
  shaftRadius: number;
  knobRadius: number;
  material?: THREE.Material;
  showProximalKnob?: boolean;
  showDistalKnob?: boolean;
  knobDepthScale?: number;
  knobTwist?: number;
  minScale?: number;
  maxScale?: number;
}

export interface StretchableBoneRuntimeMetadata {
  readonly schemaVersion: typeof STRETCHABLE_BONE_SCHEMA_VERSION;
  readonly kind: 'stretchable-cartoon-limb-bone';
  readonly id: string;
  readonly axis: readonly [0, -1, 0];
  readonly baseLength: number;
  readonly minScale: number;
  readonly maxScale: number;
  readonly shaftName: string;
  readonly proximalKnobName: string | null;
  readonly distalKnobName: string | null;
  readonly proximalSocketName: string;
  readonly distalSocketName: string;
  readonly invariantParts: readonly ('proximal-knob' | 'distal-knob')[];
  readonly spec: 'docs/STRETCH_BONE_SCULPT_SPEC.json';
}

export interface StretchableBoneComponent {
  readonly id: string;
  readonly root: THREE.Group;
  readonly shaft: THREE.Mesh;
  readonly proximalKnob: THREE.Mesh | null;
  readonly distalKnob: THREE.Mesh | null;
  readonly proximalSocket: THREE.Object3D;
  readonly distalSocket: THREE.Object3D;
  readonly baseLength: number;
  readonly minScale: number;
  readonly maxScale: number;
}

export interface ResolvedStretchableBoneParts {
  readonly root: THREE.Group;
  readonly metadata: StretchableBoneRuntimeMetadata;
  readonly shaft: THREE.Object3D;
  readonly proximalKnob: THREE.Object3D | null;
  readonly distalKnob: THREE.Object3D | null;
  readonly proximalSocket: THREE.Object3D;
  readonly distalSocket: THREE.Object3D;
}

function smoothstep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function createUnitShaftGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  const longitudinalSegments = 24;
  const proximalInset = 0.05;
  const distalInset = 0.95;
  for (let index = 0; index <= longitudinalSegments; index++) {
    // Lathe profile order controls winding and therefore outward normals.
    // Author distal → proximal so the radial normals face away from the axis.
    const t = 1 - index / longitudinalSegments;
    const fromNearestEnd = Math.min(t, 1 - t) * 2;
    const endBlend = 1 - smoothstep01(fromNearestEnd / 0.46);
    // Narrow the hidden ends well inside the double-lobe waist. The shaft
    // eases outward after leaving each knobble, preventing an intersection
    // curve from reading as a pointed cap in front view.
    const radius = 0.78 - endBlend * 0.2 + Math.sin(t * Math.PI) * 0.01;
    points.push(new THREE.Vector2(
      radius,
      -THREE.MathUtils.lerp(proximalInset, distalInset, t),
    ));
  }
  const surface = new THREE.LatheGeometry(points, 32);
  const capRadius = points[0].x;
  const proximalCap = new THREE.CircleGeometry(capRadius, 32);
  proximalCap.rotateX(-Math.PI / 2);
  proximalCap.translate(0, -proximalInset, 0);
  const distalCap = new THREE.CircleGeometry(capRadius, 32);
  distalCap.rotateX(Math.PI / 2);
  distalCap.translate(0, -distalInset, 0);
  const merged = mergeGeometries([surface, proximalCap, distalCap], false);
  if (!merged) throw new Error('failed to merge stretchable bone shaft geometry');
  merged.deleteAttribute('normal');
  merged.deleteAttribute('uv');
  const geometry = mergeVertices(merged, 1e-5);
  geometry.name = 'stretchable-bone-unit-shaft';
  geometry.computeVertexNormals();
  geometry.userData.sharedImmutable = true;
  return geometry;
}

function createUnitDoubleLobeGeometry(): THREE.BufferGeometry {
  const points: THREE.Vector2[] = [];
  const longitudinalSegments = 28;
  const lobeCentre = 0.62;
  const extent = 1 + lobeCentre;
  const smoothPower = 8;
  for (let index = 0; index <= longitudinalSegments; index++) {
    const axial = THREE.MathUtils.lerp(-extent, extent, index / longitudinalSegments);
    const left = Math.sqrt(Math.max(0, 1 - (axial + lobeCentre) ** 2));
    const right = Math.sqrt(Math.max(0, 1 - (axial - lobeCentre) ** 2));
    const radius = Math.max(
      0.001,
      (left ** smoothPower + right ** smoothPower) ** (1 / smoothPower),
    );
    points.push(new THREE.Vector2(radius, axial));
  }
  const surface = new THREE.LatheGeometry(points, 32);
  const capRadius = points[0].x;
  const firstCap = new THREE.CircleGeometry(capRadius, 32);
  firstCap.rotateX(Math.PI / 2);
  firstCap.translate(0, -extent, 0);
  const secondCap = new THREE.CircleGeometry(capRadius, 32);
  secondCap.rotateX(-Math.PI / 2);
  secondCap.translate(0, extent, 0);
  const merged = mergeGeometries([surface, firstCap, secondCap], false);
  if (!merged) throw new Error('failed to merge stretchable bone knobble geometry');
  merged.deleteAttribute('normal');
  merged.deleteAttribute('uv');
  const geometry = mergeVertices(merged, 1e-5);
  // LatheGeometry revolves around Y. Rotate the continuous peanut volume so
  // its two lobes spread across local X while the limb still runs along -Y.
  geometry.rotateZ(Math.PI / 2);
  // Pull one central underside region into a short fixed neck. This stays part
  // of the rigid knobble and hides the shaft intersection without turning the
  // two outer lobes into a generic pill. Distal instances flip this neck +Y.
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const centreWeight = (1 - smoothstep01(Math.abs(x) / 0.72)) ** 2;
    const undersideWeight = smoothstep01(Math.max(0, -y) / 0.72);
    position.setY(index, y - 0.28 * centreWeight * undersideWeight);
  }
  position.needsUpdate = true;
  geometry.name = 'stretchable-bone-unit-double-lobe';
  geometry.computeVertexNormals();
  geometry.userData.sharedImmutable = true;
  return geometry;
}

const UNIT_SHAFT_GEOMETRY = createUnitShaftGeometry();
const UNIT_DOUBLE_LOBE_GEOMETRY = createUnitDoubleLobeGeometry();

let sharedDefaultMaterial: THREE.MeshPhysicalMaterial | null = null;

function defaultClayMaterial(): THREE.MeshPhysicalMaterial {
  if (!sharedDefaultMaterial) {
    sharedDefaultMaterial = new THREE.MeshPhysicalMaterial({
      name: 'stretchable-bone-clay',
      color: 0xe8dcc7,
      roughness: 0.7,
      metalness: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.75,
      flatShading: false,
    });
  }
  return sharedDefaultMaterial;
}

function markMesh(mesh: THREE.Mesh, name: string, role: string): THREE.Mesh {
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.characterPart = name;
  mesh.userData.stretchableBonePart = role;
  mesh.userData.explodeWithParent = true;
  return mesh;
}

function finitePositive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function createStretchableBone(
  options: StretchableBoneOptions,
): StretchableBoneComponent {
  const id = options.id.trim();
  if (!id) throw new Error('stretchable bone id must be non-empty');
  const length = finitePositive(options.length, 1);
  const shaftRadius = finitePositive(options.shaftRadius, 0.12);
  const knobRadius = finitePositive(options.knobRadius, shaftRadius * 1.2);
  const minScale = THREE.MathUtils.clamp(
    finitePositive(options.minScale ?? STRETCHABLE_BONE_MIN_SCALE, STRETCHABLE_BONE_MIN_SCALE),
    0.05,
    1,
  );
  const maxScale = Math.max(
    1,
    finitePositive(options.maxScale ?? STRETCHABLE_BONE_MAX_SCALE, STRETCHABLE_BONE_MAX_SCALE),
  );
  const material = options.material ?? defaultClayMaterial();
  const knobDepthScale = finitePositive(options.knobDepthScale ?? 0.94, 0.94);
  const knobTwist = Number.isFinite(options.knobTwist) ? options.knobTwist ?? 0 : 0;

  const root = new THREE.Group();
  root.name = `stretch-bone-${id}`;
  const shaft = markMesh(
    new THREE.Mesh(UNIT_SHAFT_GEOMETRY, material),
    `stretch-bone-shaft-${id}`,
    'shaft',
  );
  shaft.scale.set(shaftRadius, length, shaftRadius);
  root.add(shaft);

  const makeKnob = (end: 'proximal' | 'distal'): THREE.Mesh => {
    const knob = markMesh(
      new THREE.Mesh(UNIT_DOUBLE_LOBE_GEOMETRY, material),
      `stretch-bone-${end}-knob-${id}`,
      `${end}-knob`,
    );
    knob.scale.set(knobRadius, knobRadius * 0.92, knobRadius * knobDepthScale);
    if (end === 'distal') knob.rotation.x = Math.PI;
    knob.rotation.y = knobTwist;
    knob.userData.lengthDeformationInvariant = true;
    return knob;
  };

  const proximalKnob = options.showProximalKnob === false ? null : makeKnob('proximal');
  if (proximalKnob) root.add(proximalKnob);
  const distalKnob = options.showDistalKnob === false ? null : makeKnob('distal');
  if (distalKnob) {
    distalKnob.position.y = -length;
    root.add(distalKnob);
  }

  const proximalSocket = new THREE.Object3D();
  proximalSocket.name = `socket-stretch-bone-${id}-proximal`;
  proximalSocket.userData.axis = [0, -1, 0];
  proximalSocket.userData.stretchableBonePart = 'proximal-socket';
  root.add(proximalSocket);
  const distalSocket = new THREE.Object3D();
  distalSocket.name = `socket-stretch-bone-${id}-distal`;
  distalSocket.position.y = -length;
  distalSocket.userData.axis = [0, -1, 0];
  distalSocket.userData.stretchableBonePart = 'distal-socket';
  root.add(distalSocket);

  const metadata: StretchableBoneRuntimeMetadata = {
    schemaVersion: STRETCHABLE_BONE_SCHEMA_VERSION,
    kind: 'stretchable-cartoon-limb-bone',
    id,
    axis: [0, -1, 0],
    baseLength: length,
    minScale,
    maxScale,
    shaftName: shaft.name,
    proximalKnobName: proximalKnob?.name ?? null,
    distalKnobName: distalKnob?.name ?? null,
    proximalSocketName: proximalSocket.name,
    distalSocketName: distalSocket.name,
    invariantParts: [
      ...(proximalKnob ? ['proximal-knob' as const] : []),
      ...(distalKnob ? ['distal-knob' as const] : []),
    ],
    spec: 'docs/STRETCH_BONE_SCULPT_SPEC.json',
  };
  root.userData.stretchableBoneRuntime = metadata;
  root.userData.characterPart = root.name;

  return {
    id,
    root,
    shaft,
    proximalKnob,
    distalKnob,
    proximalSocket,
    distalSocket,
    baseLength: length,
    minScale,
    maxScale,
  };
}

function isMetadata(value: unknown): value is StretchableBoneRuntimeMetadata {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StretchableBoneRuntimeMetadata>;
  return (
    candidate.schemaVersion === STRETCHABLE_BONE_SCHEMA_VERSION &&
    candidate.kind === 'stretchable-cartoon-limb-bone' &&
    typeof candidate.id === 'string' &&
    Number.isFinite(candidate.baseLength) &&
    typeof candidate.shaftName === 'string' &&
    typeof candidate.proximalSocketName === 'string' &&
    typeof candidate.distalSocketName === 'string'
  );
}

export function resolveStretchableBone(
  root: THREE.Object3D,
): ResolvedStretchableBoneParts | null {
  const metadata = root.userData.stretchableBoneRuntime;
  if (!isMetadata(metadata) || !(root instanceof THREE.Group)) return null;
  const shaft = root.getObjectByName(metadata.shaftName);
  const proximalKnob = metadata.proximalKnobName
    ? root.getObjectByName(metadata.proximalKnobName) ?? null
    : null;
  const distalKnob = metadata.distalKnobName
    ? root.getObjectByName(metadata.distalKnobName) ?? null
    : null;
  const proximalSocket = root.getObjectByName(metadata.proximalSocketName);
  const distalSocket = root.getObjectByName(metadata.distalSocketName);
  if (!shaft || !proximalSocket || !distalSocket) return null;
  return { root, metadata, shaft, proximalKnob, distalKnob, proximalSocket, distalSocket };
}

export function directStretchableBones(anchor: THREE.Object3D): ResolvedStretchableBoneParts[] {
  const result: ResolvedStretchableBoneParts[] = [];
  for (const child of anchor.children) {
    const resolved = resolveStretchableBone(child);
    if (resolved) result.push(resolved);
  }
  return result;
}

/** Absolute authoring helper used by isolated previews and deterministic tests. */
export function setStretchableBoneLength(
  component: StretchableBoneComponent,
  requestedLength: number,
): number {
  const length = THREE.MathUtils.clamp(
    Number.isFinite(requestedLength) ? requestedLength : component.baseLength,
    component.baseLength * component.minScale,
    component.baseLength * component.maxScale,
  );
  component.shaft.scale.y = length;
  if (component.distalKnob) component.distalKnob.position.y = -length;
  component.distalSocket.position.y = -length;
  component.root.updateMatrixWorld(true);
  return length;
}

export function stretchableBoneTriangleCount(component: StretchableBoneComponent): number {
  let triangles = 0;
  component.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  });
  return triangles;
}
