import * as THREE from 'three';
import {
  mergeGeometries,
  mergeVertices,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MESHY_LIMB_BONE_ASSETS } from './meshyLimbBone.generated';

export const STRETCHABLE_BONE_SCHEMA_VERSION = 3 as const;
export const STRETCHABLE_BONE_MIN_SCALE = 0.319;
export const STRETCHABLE_BONE_MAX_SCALE = 2.765;
export type StretchableBoneSurface =
  | 'procedural'
  | 'ivory-bone'
  | 'ivory-rattle'
  | 'ivory-bone-rattle-hybrid';
type ImportedSurface = Exclude<StretchableBoneSurface, 'procedural'>;
type ImportedAssetSurface = Exclude<ImportedSurface, 'ivory-bone-rattle-hybrid'>;

interface StretchableBoneCommonOptions {
  id: string;
  length: number;
  knobRadius: number;
  material?: THREE.Material;
  knobTwist?: number;
  minScale?: number;
  maxScale?: number;
  mirrorX?: boolean;
}

export interface ProceduralStretchableBoneOptions extends StretchableBoneCommonOptions {
  surface?: 'procedural';
  shaftRadius: number;
  showProximalKnob?: boolean;
  showDistalKnob?: boolean;
  knobDepthScale?: number;
}

export interface ImportedStretchableBoneOptions extends StretchableBoneCommonOptions {
  surface: ImportedSurface;
  shaftRadius?: never;
  showProximalKnob?: never;
  showDistalKnob?: never;
  knobDepthScale?: never;
}

export type StretchableBoneOptions =
  | ProceduralStretchableBoneOptions
  | ImportedStretchableBoneOptions;

export interface StretchableBoneRuntimeMetadata {
  readonly schemaVersion: typeof STRETCHABLE_BONE_SCHEMA_VERSION;
  readonly kind: 'stretchable-cartoon-limb-bone';
  readonly id: string;
  readonly surface: StretchableBoneSurface;
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
  readonly stretchStart: number;
  readonly stretchEnd: number;
  readonly proximalKind: string;
  readonly distalKind: string;
  readonly sourceSha256: string | null;
  readonly deformationSurface?: ImportedAssetSurface;
  readonly proximalSourceSpan?: number;
  readonly partSurfaces?: Readonly<{
    proximal: ImportedAssetSurface;
    shaft: ImportedAssetSurface;
    distal: ImportedAssetSurface;
  }>;
  readonly sourceSha256s?: Readonly<{
    proximal: string;
    shaft: string;
    distal: string;
  }>;
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

let unitShaftGeometryValue: THREE.BufferGeometry | null = null;
let unitDoubleLobeGeometryValue: THREE.BufferGeometry | null = null;

function unitShaftGeometry(): THREE.BufferGeometry {
  unitShaftGeometryValue ??= createUnitShaftGeometry();
  return unitShaftGeometryValue;
}

function unitDoubleLobeGeometry(): THREE.BufferGeometry {
  unitDoubleLobeGeometryValue ??= createUnitDoubleLobeGeometry();
  return unitDoubleLobeGeometryValue;
}

interface GeneratedPart {
  readonly vertices: number;
  readonly triangles: number;
  readonly positionsBase64: string;
  readonly normalsBase64: string;
}

interface GeneratedLimbAsset {
  readonly sourceFile: string;
  readonly sourceSha256: string;
  readonly sourceTriangles: number;
  readonly bakedTriangles: number;
  readonly sourceMaxRadius: number;
  readonly stretchStart: number;
  readonly stretchEnd: number;
  readonly thicknessStart: number;
  readonly thicknessEnd: number;
  readonly thicknessMorph: {
    readonly proximalFade: number;
    readonly distalFade: number;
    readonly closedRestVolume: number;
    readonly volumeA: number;
    readonly volumeB: number;
  };
  readonly proximalKind: string;
  readonly distalKind: string;
  readonly parts: {
    readonly proximal: GeneratedPart;
    readonly shaft: GeneratedPart;
    readonly distal: GeneratedPart;
  };
}

const IMPORTED_ASSETS: Readonly<Record<ImportedAssetSurface, GeneratedLimbAsset>> = {
  'ivory-bone': MESHY_LIMB_BONE_ASSETS.ivoryBone,
  'ivory-rattle': MESHY_LIMB_BONE_ASSETS.ivoryRattle,
};

function importedPartSurfaces(surface: ImportedSurface): Readonly<{
  proximal: ImportedAssetSurface;
  shaft: ImportedAssetSurface;
  distal: ImportedAssetSurface;
}> {
  return surface === 'ivory-bone-rattle-hybrid'
    ? { proximal: 'ivory-bone', shaft: 'ivory-rattle', distal: 'ivory-rattle' }
    : { proximal: surface, shaft: surface, distal: surface };
}

const importedGeometryCache = new Map<string, THREE.BufferGeometry>();

function decodeFloat32(source: string): Float32Array {
  const binary = atob(source);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Float32Array(bytes.buffer);
}

function importedGeometry(
  surface: ImportedAssetSurface,
  role: keyof GeneratedLimbAsset['parts'],
): THREE.BufferGeometry {
  const key = `${surface}:${role}`;
  const cached = importedGeometryCache.get(key);
  if (cached) return cached;
  const part = IMPORTED_ASSETS[surface].parts[role];
  const geometry = new THREE.BufferGeometry();
  geometry.name = `meshy-${surface}-${role}`;
  geometry.setAttribute('position', new THREE.BufferAttribute(decodeFloat32(part.positionsBase64), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(decodeFloat32(part.normalsBase64), 3));
  if (role === 'shaft') {
    const position = geometry.getAttribute('position');
    const delta = new Float32Array(position.count * 3);
    const asset = IMPORTED_ASSETS[surface];
    const fraction = asset.stretchEnd - asset.stretchStart;
    for (let index = 0; index < position.count; index++) {
      const t = THREE.MathUtils.clamp(-position.getY(index) / fraction, 0, 1);
      const fromBoundary = Math.min(
        t / asset.thicknessMorph.proximalFade,
        (1 - t) / asset.thicknessMorph.distalFade,
      );
      const weight = smoothstep01(fromBoundary);
      delta[index * 3] = position.getX(index) * weight;
      delta[index * 3 + 2] = position.getZ(index) * weight;
    }
    geometry.morphAttributes.position = [new THREE.BufferAttribute(delta, 3)];
    geometry.morphTargetsRelative = true;
    geometry.userData.thicknessMorph = true;
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.sharedImmutable = true;
  geometry.userData.source = IMPORTED_ASSETS[surface].sourceFile;
  geometry.userData.sourceSha256 = IMPORTED_ASSETS[surface].sourceSha256;
  geometry.userData.sourceTriangles = IMPORTED_ASSETS[surface].sourceTriangles;
  importedGeometryCache.set(key, geometry);
  return geometry;
}

let sharedDefaultProceduralMaterial: THREE.MeshPhysicalMaterial | null = null;
let sharedDefaultImportedMaterial: THREE.MeshPhysicalMaterial | null = null;

function defaultClayMaterial(flatShading: boolean): THREE.MeshPhysicalMaterial {
  const existing = flatShading
    ? sharedDefaultImportedMaterial
    : sharedDefaultProceduralMaterial;
  if (existing) return existing;
  const material = new THREE.MeshPhysicalMaterial({
      name: 'stretchable-bone-clay',
      color: 0xe8dcc7,
      roughness: 0.7,
      metalness: 0,
      clearcoat: 0.2,
      clearcoatRoughness: 0.75,
      // Imported Meshy data ships face normals. Derivative normals keep those
      // faces correct while the boundary-tapered thickness morph moves them.
      flatShading,
    });
  if (flatShading) sharedDefaultImportedMaterial = material;
  else sharedDefaultProceduralMaterial = material;
  return material;
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

function createImportedStretchableBone(
  options: ImportedStretchableBoneOptions,
  id: string,
  surface: ImportedSurface,
  length: number,
  knobRadius: number,
  minScale: number,
  maxScale: number,
  material: THREE.Material,
  knobTwist: number,
): StretchableBoneComponent {
  const partSurfaces = importedPartSurfaces(surface);
  const proximalAsset = IMPORTED_ASSETS[partSurfaces.proximal];
  const deformationAsset = IMPORTED_ASSETS[partSurfaces.shaft];
  const distalAsset = IMPORTED_ASSETS[partSurfaces.distal];
  const proximalRadialScale = knobRadius / proximalAsset.sourceMaxRadius;
  const shaftRadialScale = knobRadius / deformationAsset.sourceMaxRadius;
  const distalRadialScale = knobRadius / distalAsset.sourceMaxRadius;
  const root = new THREE.Group();
  root.name = `stretch-bone-${id}`;
  root.scale.x = options.mirrorX ? -1 : 1;
  root.rotation.y = knobTwist;

  const proximalKnob = markMesh(
    new THREE.Mesh(importedGeometry(partSurfaces.proximal, 'proximal'), material),
    `stretch-bone-proximal-knob-${id}`,
    'proximal-rigid',
  );
  proximalKnob.scale.set(proximalRadialScale, length, proximalRadialScale);
  proximalKnob.userData.lengthDeformationInvariant = true;
  proximalKnob.userData.rigidEndKind = proximalAsset.proximalKind;
  proximalKnob.userData.sourceSurface = partSurfaces.proximal;
  root.add(proximalKnob);

  const shaft = markMesh(
    new THREE.Mesh(importedGeometry(partSurfaces.shaft, 'shaft'), material),
    `stretch-bone-shaft-${id}`,
    'shaft',
  );
  shaft.position.y = -length * deformationAsset.stretchStart;
  shaft.scale.set(shaftRadialScale, length, shaftRadialScale);
  shaft.updateMorphTargets();
  shaft.frustumCulled = false;
  shaft.userData.sourceSurface = partSurfaces.shaft;
  root.add(shaft);

  const distalKnob = markMesh(
    new THREE.Mesh(importedGeometry(partSurfaces.distal, 'distal'), material),
    `stretch-bone-distal-knob-${id}`,
    'distal-rigid',
  );
  distalKnob.position.y = -length * deformationAsset.stretchEnd;
  distalKnob.scale.set(distalRadialScale, length, distalRadialScale);
  distalKnob.userData.lengthDeformationInvariant = true;
  distalKnob.userData.rigidEndKind = distalAsset.distalKind;
  distalKnob.userData.sourceSurface = partSurfaces.distal;
  root.add(distalKnob);

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
    surface,
    axis: [0, -1, 0],
    baseLength: length,
    minScale,
    maxScale,
    shaftName: shaft.name,
    proximalKnobName: proximalKnob.name,
    distalKnobName: distalKnob.name,
    proximalSocketName: proximalSocket.name,
    distalSocketName: distalSocket.name,
    invariantParts: ['proximal-knob', 'distal-knob'],
    stretchStart: deformationAsset.stretchStart,
    stretchEnd: deformationAsset.stretchEnd,
    proximalKind: proximalAsset.proximalKind,
    distalKind: distalAsset.distalKind,
    sourceSha256: surface === partSurfaces.shaft
      ? deformationAsset.sourceSha256
      : null,
    deformationSurface: partSurfaces.shaft,
    proximalSourceSpan: proximalAsset.stretchStart,
    partSurfaces,
    sourceSha256s: {
      proximal: proximalAsset.sourceSha256,
      shaft: deformationAsset.sourceSha256,
      distal: distalAsset.sourceSha256,
    },
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

export function createStretchableBone(
  options: StretchableBoneOptions,
): StretchableBoneComponent {
  const id = options.id.trim();
  if (!id) throw new Error('stretchable bone id must be non-empty');
  const length = finitePositive(options.length, 1);
  const knobRadius = finitePositive(options.knobRadius, 0.14);
  const minScale = THREE.MathUtils.clamp(
    finitePositive(options.minScale ?? STRETCHABLE_BONE_MIN_SCALE, STRETCHABLE_BONE_MIN_SCALE),
    0.05,
    1,
  );
  const maxScale = Math.max(
    1,
    finitePositive(options.maxScale ?? STRETCHABLE_BONE_MAX_SCALE, STRETCHABLE_BONE_MAX_SCALE),
  );
  const knobTwist = Number.isFinite(options.knobTwist) ? options.knobTwist ?? 0 : 0;
  const surface = options.surface ?? 'procedural';
  const material = options.material ?? defaultClayMaterial(surface !== 'procedural');
  if (surface !== 'procedural') {
    for (const unsupported of [
      'shaftRadius',
      'showProximalKnob',
      'showDistalKnob',
      'knobDepthScale',
    ] as const) {
      if (Object.prototype.hasOwnProperty.call(options, unsupported)) {
        throw new Error(`${unsupported} is procedural-only; imported surfaces preserve authored ends and proportions`);
      }
    }
    const importedOptions = options as ImportedStretchableBoneOptions;
    return createImportedStretchableBone(
      importedOptions,
      id,
      surface,
      length,
      knobRadius,
      minScale,
      maxScale,
      material,
      knobTwist,
    );
  }

  const proceduralOptions = options as ProceduralStretchableBoneOptions;
  const shaftRadius = finitePositive(proceduralOptions.shaftRadius, 0.12);
  const knobDepthScale = finitePositive(proceduralOptions.knobDepthScale ?? 0.94, 0.94);

  const root = new THREE.Group();
  root.name = `stretch-bone-${id}`;
  root.scale.x = proceduralOptions.mirrorX ? -1 : 1;
  const shaft = markMesh(
    new THREE.Mesh(unitShaftGeometry(), material),
    `stretch-bone-shaft-${id}`,
    'shaft',
  );
  shaft.scale.set(shaftRadius, length, shaftRadius);
  root.add(shaft);

  const makeKnob = (end: 'proximal' | 'distal'): THREE.Mesh => {
    const knob = markMesh(
      new THREE.Mesh(unitDoubleLobeGeometry(), material),
      `stretch-bone-${end}-knob-${id}`,
      `${end}-knob`,
    );
    knob.scale.set(knobRadius, knobRadius * 0.92, knobRadius * knobDepthScale);
    if (end === 'distal') knob.rotation.x = Math.PI;
    knob.rotation.y = knobTwist;
    knob.userData.lengthDeformationInvariant = true;
    return knob;
  };

  const proximalKnob = proceduralOptions.showProximalKnob === false ? null : makeKnob('proximal');
  if (proximalKnob) root.add(proximalKnob);
  const distalKnob = proceduralOptions.showDistalKnob === false ? null : makeKnob('distal');
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
    surface: 'procedural',
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
    stretchStart: 0,
    stretchEnd: 1,
    proximalKind: proximalKnob ? 'double-lobe-knob' : 'none',
    distalKind: distalKnob ? 'double-lobe-knob' : 'none',
    sourceSha256: null,
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
    (candidate.surface === 'procedural' ||
      candidate.surface === 'ivory-bone' ||
      candidate.surface === 'ivory-rattle' ||
      candidate.surface === 'ivory-bone-rattle-hybrid') &&
    Number.isFinite(candidate.baseLength) &&
    Number.isFinite(candidate.stretchStart) &&
    Number.isFinite(candidate.stretchEnd) &&
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

export function stretchableBoneLengthScale(
  component: ResolvedStretchableBoneParts,
): number {
  return THREE.MathUtils.clamp(
    -component.distalSocket.position.y / component.metadata.baseLength,
    component.metadata.minScale,
    component.metadata.maxScale,
  );
}

/** Longitudinal scale of the deformable shaft for a requested endpoint scale. */
export function stretchableBoneShaftLengthScale(
  component: ResolvedStretchableBoneParts,
  requestedScale: number,
): number {
  const metadata = component.metadata;
  const scale = THREE.MathUtils.clamp(
    Number.isFinite(requestedScale) ? requestedScale : 1,
    metadata.minScale,
    metadata.maxScale,
  );
  if (metadata.surface === 'procedural') return scale;
  const stretchFraction = metadata.stretchEnd - metadata.stretchStart;
  const rigidFraction = 1 - stretchFraction;
  return Math.max(0.01, scale - rigidFraction) / stretchFraction;
}

/** Relative shaft-span change between two endpoint scales. */
export function stretchableBoneShaftLengthRatio(
  component: ResolvedStretchableBoneParts,
  fromScale: number,
  toScale: number,
): number {
  return stretchableBoneShaftLengthScale(component, toScale) /
    stretchableBoneShaftLengthScale(component, fromScale);
}

/** Imported-shaft volume correction, exact until fixed collars make it impossible. */
export function stretchableBoneVolumeMorphInfluence(
  component: ResolvedStretchableBoneParts,
  shaftLengthRatio: number,
  baselineInfluence = 0,
): number {
  const ratio = finitePositive(shaftLengthRatio, 1);
  const baseline = Number.isFinite(baselineInfluence) ? baselineInfluence : 0;
  if (component.metadata.surface === 'procedural') {
    return (1 + baseline) / Math.sqrt(ratio) - 1;
  }
  const deformationSurface = component.metadata.deformationSurface ??
    (component.metadata.surface === 'ivory-bone-rattle-hybrid'
      ? 'ivory-rattle'
      : component.metadata.surface);
  const morph = IMPORTED_ASSETS[deformationSurface].thicknessMorph;
  const baselineVolume = 1 + 2 * morph.volumeA * baseline + morph.volumeB * baseline ** 2;
  const targetVolume = baselineVolume / ratio;
  const discriminant = morph.volumeA ** 2 + morph.volumeB * (targetVolume - 1);
  const influence = (-morph.volumeA + Math.sqrt(Math.max(0, discriminant))) /
    morph.volumeB;
  // This guard is reached by the deliberately tested thinnest+longest Bone
  // corner, and by unsupported future ratios, when its fixed collars alone
  // make exact volume preservation geometrically impossible.
  return Math.max(-0.98, influence);
}

/** Absolute piecewise length deformation; rigid source ends only translate. */
export function applyResolvedStretchableBoneLength(
  component: ResolvedStretchableBoneParts,
  requestedScale: number,
): number {
  const metadata = component.metadata;
  const scale = THREE.MathUtils.clamp(
    Number.isFinite(requestedScale) ? requestedScale : 1,
    metadata.minScale,
    metadata.maxScale,
  );
  if (metadata.surface === 'procedural') {
    component.shaft.scale.y = metadata.baseLength * scale;
    if (component.distalKnob) component.distalKnob.position.y = -metadata.baseLength * scale;
  } else {
    component.shaft.position.y = -metadata.baseLength * metadata.stretchStart;
    component.shaft.scale.y = metadata.baseLength * stretchableBoneShaftLengthScale(
      component,
      scale,
    );
    if (component.distalKnob) {
      component.distalKnob.position.y = -metadata.baseLength * (
        scale - (1 - metadata.stretchEnd)
      );
    }
  }
  component.distalSocket.position.y = -metadata.baseLength * scale;
  component.root.updateMatrixWorld(true);
  return scale;
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
  const resolved = resolveStretchableBone(component.root);
  if (!resolved) throw new Error(`cannot resolve stretchable bone ${component.id}`);
  applyResolvedStretchableBoneLength(resolved, length / component.baseLength);
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
