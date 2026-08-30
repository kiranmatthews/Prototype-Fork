import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  BEACHFRONT_COURSE_LENGTH,
  BEACHFRONT_SAND_MAXIMUM_LATERAL,
  beachfrontFrameAtDistance,
  beachfrontSandHeight,
} from "./beachfrontCourse";

export const BEACHFRONT_CLIFF_PATH =
  "beachfront/stonecliff-bastion.glb";
export const BEACHFRONT_CLIFF_PRIMARY_INSTANCE_COUNT = 100;
export const BEACHFRONT_CLIFF_BACKING_INSTANCE_COUNT = 50;
export const BEACHFRONT_CLIFF_INSTANCE_COUNT =
  BEACHFRONT_CLIFF_PRIMARY_INSTANCE_COUNT +
  BEACHFRONT_CLIFF_BACKING_INSTANCE_COUNT;
export const BEACHFRONT_CLIFF_CHUNK_SIZE = 10;
export const BEACHFRONT_CLIFF_CHUNK_COUNT = 15;

const CLIFF_COLLISION_LATERAL = 8.42;
const CLIFF_COLLISION_HALF_THICKNESS = 0.38;
const CLIFF_VISUAL_CLEARANCE = 0.18;
// Source-space Stonecliff bounds after Unity's deterministic FBX import.
const SOURCE_BOUNDS_MAX_Z = 0.2773439884185791;

export interface BeachfrontCliffTransform {
  index: number;
  backing: boolean;
  distance: number;
  variant: number;
  mirrored: boolean;
  sheared: boolean;
  uniform: boolean;
  scale: readonly [x: number, y: number, z: number];
  position: readonly [x: number, y: number, z: number];
  lean: number;
  yaw: number;
  roll: number;
  shear: number;
  cropDepth: number;
}

interface CliffAsset {
  geometry: THREE.BufferGeometry;
  mirroredGeometry: THREE.BufferGeometry;
  material: THREE.Material;
}

let asset: CliffAsset | null = null;
let started = false;
let settled: (() => void) | null = null;
const pending = new Set<THREE.Group>();

/** Settles after the shared Stonecliff GLB either loads or fails. */
export const beachfrontCliffReady = new Promise<void>((resolve) => {
  settled = resolve;
});

const degrees = THREE.MathUtils.degToRad;

/** Exact uint32 hash used by the Unity source builder. */
export function beachfrontCliffVariation01(index: number, salt: number): number {
  let value = (
    Math.imul((index + 1) >>> 0, 747_796_405) +
    Math.imul(salt >>> 0, 2_891_336_453)
  ) >>> 0;
  value = Math.imul((value ^ (value >>> 16)) >>> 0, 2_246_822_519) >>> 0;
  value = Math.imul((value ^ (value >>> 13)) >>> 0, 3_266_489_917) >>> 0;
  value = (value ^ (value >>> 16)) >>> 0;
  return (value & 0x00ff_ffff) / 16_777_215;
}

const cliffToeBurialHeight = (distance: number, lateral: number): number => {
  let toe = THREE.MathUtils.clamp((lateral - 5.8) / 2.6, 0, 1);
  toe = toe * toe * (3 - 2 * toe);
  return toe * (0.52 + 0.08 * Math.sin(distance * 0.061 + 0.7));
};

function buildTransform(
  index: number,
  distance: number,
  backing: boolean,
): BeachfrontCliffTransform {
  const variant = (index * 7 + (backing ? 5 : 0)) % 12;
  const uniform = variant === 0 || variant === 7;
  const mirrored =
    variant === 1 ||
    variant === 4 ||
    variant === 6 ||
    variant === 9 ||
    variant === 11;
  const sheared =
    !uniform &&
    (variant === 2 || variant === 5 || variant === 8 || variant === 10);
  const widthRandom = beachfrontCliffVariation01(index, backing ? 31 : 11);
  const heightRandom = beachfrontCliffVariation01(index, backing ? 47 : 17);
  const depthRandom = beachfrontCliffVariation01(index, backing ? 59 : 23);
  const uniformScale =
    (backing ? 10.2 : 8.8) + (backing ? 2.8 : 2.4) * widthRandom;
  const scale: [number, number, number] = uniform
    ? [uniformScale, uniformScale, uniformScale]
    : [
        (backing ? 10.6 : 9) + (backing ? 4.2 : 3.5) * widthRandom,
        (backing ? 9.2 : 8) + (backing ? 4.8 : 4.6) * heightRandom,
        (backing ? 5.2 : 4) + (backing ? 2.8 : 2.6) * depthRandom,
      ];
  const cropDepth =
    (backing ? 0.8 : 0.24) +
    (backing ? 1.35 : 0.92) *
      beachfrontCliffVariation01(index, backing ? 71 : 29);
  const yaw = THREE.MathUtils.lerp(
    backing ? -7 : -4.5,
    backing ? 7 : 4.5,
    beachfrontCliffVariation01(index, backing ? 83 : 37),
  );
  const lean = THREE.MathUtils.lerp(
    backing ? -6 : -3.5,
    backing ? 6 : 3.5,
    beachfrontCliffVariation01(index, backing ? 97 : 41),
  );
  const roll = THREE.MathUtils.lerp(
    -4.2,
    4.2,
    beachfrontCliffVariation01(index, backing ? 101 : 43),
  );
  let shear = sheared
    ? THREE.MathUtils.lerp(
        -8,
        8,
        beachfrontCliffVariation01(index, backing ? 107 : 53),
      )
    : 0;
  if (sheared && Math.abs(shear) < 2.4) shear = shear < 0 ? -2.4 : 2.4;

  const frame = beachfrontFrameAtDistance(distance);
  const sandBaseline =
    beachfrontSandHeight(distance, BEACHFRONT_SAND_MAXIMUM_LATERAL) -
    cliffToeBurialHeight(distance, BEACHFRONT_SAND_MAXIMUM_LATERAL);
  const faceLateral =
    CLIFF_COLLISION_LATERAL -
    CLIFF_COLLISION_HALF_THICKNESS +
    CLIFF_VISUAL_CLEARANCE +
    (backing ? 0.8 : 0);
  const centerLateral = faceLateral + SOURCE_BOUNDS_MAX_Z * scale[2];
  const verticalVariation =
    0.14 * Math.sin(index * 1.73 + (backing ? 0.8 : 0));

  return {
    index,
    backing,
    distance,
    variant,
    mirrored,
    sheared,
    uniform,
    scale,
    position: [
      frame.x + frame.rx * centerLateral,
      sandBaseline + verticalVariation,
      frame.z + frame.rz * centerLateral,
    ],
    lean,
    yaw,
    roll,
    shear,
    cropDepth,
  };
}

/** The exact 100 primary plus 50 staggered Unity Stonecliff transforms. */
export function buildBeachfrontCliffTransforms(): BeachfrontCliffTransform[] {
  const result: BeachfrontCliffTransform[] = [];
  for (let index = 0; index < BEACHFRONT_CLIFF_PRIMARY_INSTANCE_COUNT; index++) {
    result.push(
      buildTransform(
        index,
        (BEACHFRONT_COURSE_LENGTH * index) /
          (BEACHFRONT_CLIFF_PRIMARY_INSTANCE_COUNT - 1),
        false,
      ),
    );
  }
  for (let index = 0; index < BEACHFRONT_CLIFF_BACKING_INSTANCE_COUNT; index++) {
    result.push(
      buildTransform(
        index,
        (BEACHFRONT_COURSE_LENGTH * (index + 0.5)) /
          BEACHFRONT_CLIFF_BACKING_INSTANCE_COUNT,
        true,
      ),
    );
  }
  return result;
}

function instanceMatrix(
  transform: BeachfrontCliffTransform,
  target: THREE.Matrix4,
): THREE.Matrix4 {
  const frame = beachfrontFrameAtDistance(transform.distance);
  const base = new THREE.Matrix4().makeBasis(
    new THREE.Vector3(frame.fx, 0, frame.fz),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(frame.rx, 0, frame.rz),
  );
  const convertedUnityEuler = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(
      degrees(-transform.lean),
      degrees(-transform.yaw),
      degrees(transform.roll),
      "ZXY",
    ),
  );
  const rootRotation = new THREE.Quaternion()
    .setFromRotationMatrix(base)
    .multiply(convertedUnityEuler);
  target.compose(
    new THREE.Vector3(...transform.position),
    rootRotation,
    new THREE.Vector3(1, 1, 1),
  );
  target.multiply(new THREE.Matrix4().makeTranslation(0, -transform.cropDepth, 0));
  target.multiply(new THREE.Matrix4().makeScale(...transform.scale));
  // The baked GLB already contains Unity's -90° FBX correction plus the web
  // handedness conversion; source Z shear therefore becomes -Y rotation.
  target.multiply(new THREE.Matrix4().makeRotationY(degrees(-transform.shear)));
  return target;
}

function reversedXGeometry(source: THREE.BufferGeometry): THREE.BufferGeometry {
  const geometry = source.clone();
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  for (let index = 0; index < position.count; index++) {
    position.setX(index, -position.getX(index));
    if (normal) normal.setX(index, -normal.getX(index));
  }
  position.needsUpdate = true;
  if (normal) normal.needsUpdate = true;
  const indices = geometry.index;
  if (indices) {
    for (let offset = 0; offset < indices.count; offset += 3) {
      const b = indices.getX(offset + 1);
      indices.setX(offset + 1, indices.getX(offset + 2));
      indices.setX(offset + 2, b);
    }
    indices.needsUpdate = true;
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.userData.shared = true;
  geometry.name = "StonecliffBastion_Mirrored_Geometry";
  return geometry;
}

function markShared(geometry: THREE.BufferGeometry, material: THREE.Material): void {
  geometry.userData.shared = true;
  material.userData.shared = true;
  for (const value of Object.values(material)) {
    const texture = value as THREE.Texture | null;
    if (!texture?.isTexture) continue;
    texture.userData.shared = true;
    texture.anisotropy = 8;
  }
}

function findTemplate(root: THREE.Object3D): THREE.Mesh {
  const meshes: THREE.Mesh[] = [];
  root.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
  });
  const result = meshes[0];
  if (!result) throw new Error("Stonecliff GLB contains no mesh");
  if (Array.isArray(result.material))
    throw new Error("Stonecliff GLB unexpectedly contains multiple materials");
  return result;
}

function addInstances(
  parent: THREE.Group,
  chunkName: string,
  transforms: readonly BeachfrontCliffTransform[],
  mirrored: boolean,
  backing: boolean,
): void {
  if (!asset || transforms.length === 0) return;
  const geometry = mirrored ? asset.mirroredGeometry : asset.geometry;
  const mesh = new THREE.InstancedMesh(geometry, asset.material, transforms.length);
  mesh.name = `${chunkName}_${mirrored ? "MirrorH" : "Regular"}`;
  mesh.castShadow = !backing;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const matrix = new THREE.Matrix4();
  for (let index = 0; index < transforms.length; index++)
    mesh.setMatrixAt(index, instanceMatrix(transforms[index], matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.computeBoundingBox();
  mesh.computeBoundingSphere();
  mesh.userData.visualOnly = true;
  mesh.userData.backing = backing;
  mesh.userData.sourceInstanceCount = transforms.length;
  parent.add(mesh);
}

function install(root: THREE.Group): void {
  if (!asset || root.userData.beachfrontCliffReleased) return;
  const presentation = new THREE.Group();
  presentation.name = "StonecliffBastion_150InstancePresentation";
  const transforms = buildBeachfrontCliffTransforms();
  const streams = [
    transforms.slice(0, BEACHFRONT_CLIFF_PRIMARY_INSTANCE_COUNT),
    transforms.slice(BEACHFRONT_CLIFF_PRIMARY_INSTANCE_COUNT),
  ];
  let chunkCount = 0;
  for (const stream of streams) {
    const backing = stream[0]?.backing ?? false;
    for (let start = 0; start < stream.length; start += BEACHFRONT_CLIFF_CHUNK_SIZE) {
      const values = stream.slice(start, start + BEACHFRONT_CLIFF_CHUNK_SIZE);
      const chunk = new THREE.Group();
      const streamName = backing ? "Backing" : "Primary";
      chunk.name = `Stonecliff_${streamName}_Chunk_${String(chunkCount + 1).padStart(2, "0")}`;
      addInstances(
        chunk,
        chunk.name,
        values.filter((value) => !value.mirrored),
        false,
        backing,
      );
      addInstances(
        chunk,
        chunk.name,
        values.filter((value) => value.mirrored),
        true,
        backing,
      );
      presentation.add(chunk);
      chunkCount++;
    }
  }
  presentation.userData.visualOnly = true;
  presentation.userData.sourceInstanceCount = transforms.length;
  presentation.userData.cullChunkCount = chunkCount;
  root.add(presentation);
  root.userData.assetReady = true;
  root.userData.sourceInstanceCount = transforms.length;
  root.userData.cullChunkCount = chunkCount;
}

function load(): void {
  if (started) return;
  started = true;
  new GLTFLoader().load(
    import.meta.env.BASE_URL + BEACHFRONT_CLIFF_PATH,
    (gltf) => {
      const template = findTemplate(gltf.scene);
      asset = {
        geometry: template.geometry,
        mirroredGeometry: reversedXGeometry(template.geometry),
        material: template.material as THREE.Material,
      };
      markShared(asset.geometry, asset.material);
      for (const target of pending) install(target);
      pending.clear();
      settled?.();
    },
    undefined,
    (error) => {
      for (const target of pending) target.userData.assetError = true;
      pending.clear();
      const responseUrl = (error as { response?: { url?: string } }).response?.url;
      if (responseUrl) console.warn("Stonecliff presentation failed to load", error);
      settled?.();
    },
  );
}

/**
 * Return an immediate visual-only root. One cached GLB template supplies shared
 * geometry/material to 15 distance-cullable chunks after the asset resolves.
 */
export function createBeachfrontCliffVisual(): THREE.Group {
  const root = new THREE.Group();
  root.name = "StonecliffBastion_VisualOnly";
  root.userData.assetReady = false;
  root.userData.visualOnly = true;
  if (asset) install(root);
  else {
    pending.add(root);
    load();
  }
  return root;
}

/** Prevent a disposed level from receiving a late async GLB attachment. */
export function releaseBeachfrontCliffVisual(root: THREE.Group): void {
  root.userData.beachfrontCliffReleased = true;
  pending.delete(root);
  root.clear();
}
