/**
 * Shared MatrixRex sand material used by Unity's Beachfront presentation.
 *
 * Geometry owns metric UVs; the three maps deliberately remain at repeat 1
 * so one material can be shared by independently cullable shoreline chunks.
 * `applyUnitySandMetricUvs` converts caller-selected local metre axes to the
 * authored 5.4 m repeat and can carry an along-course offset across chunks.
 */
import * as THREE from "three";

export const UNITY_SAND_TILE_METRES = 5.4;
export const UNITY_SAND_AO_PROGRAM_KEY = "unity-sand-ao-green-v1";
export const UNITY_SAND_ASSETS = Object.freeze({
  color: "sand-color.png",
  normal: "sand-normal.png",
  mask: "sand-mask.png",
});

export type UnitySandTextureRole = keyof typeof UNITY_SAND_ASSETS;
export type UnitySandTextureLoader = (url: string) => THREE.Texture;

export interface UnitySandMetricUvOptions {
  /** Metres represented by one texture repeat. */
  tileMetres?: number;
  /** Local-space direction used for texture U. Defaults to +X. */
  uAxis?: readonly [number, number, number];
  /** Local-space direction used for texture V. Defaults to -Z. */
  vAxis?: readonly [number, number, number];
  /** Metric U/V added before division, useful for seamless chunks. */
  offsetMetres?: readonly [number, number];
}

export interface UnitySandMaterialOptions {
  name?: string;
  /** Directory containing the three registered MatrixRex sand maps. */
  assetBaseUrl?: string;
  /** Injectable for tests, preloaders, or a future texture cache. */
  loadTexture?: UnitySandTextureLoader;
  /** Defaults true. Set false only when an external cache owns the maps. */
  ownsTextures?: boolean;
}

export interface UnitySandMaps {
  color: THREE.Texture;
  normal: THREE.Texture;
  mask: THREE.Texture;
}

const DEFAULT_U_AXIS = [1, 0, 0] as const;
const DEFAULT_V_AXIS = [0, 0, -1] as const;

function normalizedAxis(
  axis: readonly [number, number, number],
  label: string,
): readonly [number, number, number] {
  const length = Math.hypot(axis[0], axis[1], axis[2]);
  if (!Number.isFinite(length) || length < 1e-7) {
    throw new RangeError(`Unity sand ${label} axis must be finite and non-zero.`);
  }
  return [axis[0] / length, axis[1] / length, axis[2] / length];
}

/**
 * Writes UV/UV1/UV2 in metres, retaining the exact 5.4 m Beachfront repeat.
 * Apply this after geometry rotation so the supplied axes describe the final
 * local-space surface. Offset V by a chunk's course start to avoid seams.
 */
export function applyUnitySandMetricUvs<T extends THREE.BufferGeometry>(
  geometry: T,
  options: UnitySandMetricUvOptions = {},
): T {
  const position = geometry.getAttribute("position");
  if (!position) {
    throw new TypeError("Unity sand geometry needs a position attribute.");
  }
  const tileMetres = options.tileMetres ?? UNITY_SAND_TILE_METRES;
  if (!Number.isFinite(tileMetres) || tileMetres <= 0) {
    throw new RangeError("Unity sand tile size must be finite and positive.");
  }
  const uAxis = normalizedAxis(options.uAxis ?? DEFAULT_U_AXIS, "U");
  const vAxis = normalizedAxis(options.vAxis ?? DEFAULT_V_AXIS, "V");
  const offset = options.offsetMetres ?? [0, 0];
  if (!offset.every(Number.isFinite)) {
    throw new RangeError("Unity sand UV offset must be finite.");
  }

  const values = new Float32Array(position.count * 2);
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const z = position.getZ(index);
    values[index * 2] =
      (x * uAxis[0] + y * uAxis[1] + z * uAxis[2] + offset[0]) /
      tileMetres;
    values[index * 2 + 1] =
      (x * vAxis[0] + y * vAxis[1] + z * vAxis[2] + offset[1]) /
      tileMetres;
  }

  const uv = new THREE.BufferAttribute(values, 2);
  geometry.setAttribute("uv", uv);
  // Three revisions and shader paths disagree on whether AO uses uv1 or uv2.
  // Supplying both mirrors the existing literal Beachfront geometry contract.
  geometry.setAttribute("uv1", uv.clone());
  geometry.setAttribute("uv2", uv.clone());
  return geometry;
}

function withTrailingSlash(value: string): string {
  return `${value.replace(/\/+$/, "")}/`;
}

function defaultAssetBaseUrl(): string {
  const appBase = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
  return `${appBase}water/matrixrex/`;
}

export function unitySandAssetUrls(assetBaseUrl?: string): Record<UnitySandTextureRole, string> {
  const base = withTrailingSlash(assetBaseUrl ?? defaultAssetBaseUrl());
  return {
    color: `${base}${UNITY_SAND_ASSETS.color}`,
    normal: `${base}${UNITY_SAND_ASSETS.normal}`,
    mask: `${base}${UNITY_SAND_ASSETS.mask}`,
  };
}

function configureMap(
  texture: THREE.Texture,
  file: string,
  srgb: boolean,
): THREE.Texture {
  texture.name = `MatrixRex ${file}`;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  texture.offset.set(0, 0);
  texture.minFilter = THREE.LinearMipmapNearestFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  return texture;
}

/** Owns one exact Beachfront sand material and, by default, its three maps. */
export class UnitySandMaterialOwner {
  readonly material: THREE.MeshStandardMaterial;
  readonly maps: UnitySandMaps;
  readonly urls: Record<UnitySandTextureRole, string>;
  readonly ownsTextures: boolean;
  private disposedValue = false;

  constructor(options: UnitySandMaterialOptions = {}) {
    this.urls = unitySandAssetUrls(options.assetBaseUrl);
    this.ownsTextures = options.ownsTextures ?? true;
    const load =
      options.loadTexture ??
      ((url: string): THREE.Texture => new THREE.TextureLoader().load(url));
    this.maps = {
      color: configureMap(
        load(this.urls.color),
        UNITY_SAND_ASSETS.color,
        true,
      ),
      normal: configureMap(
        load(this.urls.normal),
        UNITY_SAND_ASSETS.normal,
        false,
      ),
      mask: configureMap(
        load(this.urls.mask),
        UNITY_SAND_ASSETS.mask,
        false,
      ),
    };

    this.material = new THREE.MeshStandardMaterial({
      name: options.name ?? "BeachfrontRun_Showcase1Sand",
      color: 0xffffff,
      map: this.maps.color,
      normalMap: this.maps.normal,
      normalScale: new THREE.Vector2(0.5, 0.5),
      aoMap: this.maps.mask,
      aoMapIntensity: 1,
      metalness: 0,
      roughness: 1,
      emissive: 0x000000,
      emissiveIntensity: 0,
    });
    // MatrixRex's terrain mask packs ambient occlusion in G. Three's standard
    // material samples ORM red unless the generated lookup is corrected.
    this.material.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "texture2D( aoMap, vAoMapUv ).r",
        "texture2D( aoMap, vAoMapUv ).g",
      );
    };
    this.material.customProgramCacheKey = () => UNITY_SAND_AO_PROGRAM_KEY;
    this.material.userData.unitySandTileMetres = UNITY_SAND_TILE_METRES;
  }

  get disposed(): boolean {
    return this.disposedValue;
  }

  dispose(): void {
    if (this.disposedValue) return;
    this.disposedValue = true;
    this.material.dispose();
    if (!this.ownsTextures) return;
    const uniqueMaps = new Set<THREE.Texture>(Object.values(this.maps));
    for (const texture of uniqueMaps) texture.dispose();
  }
}

export function createUnitySandMaterial(
  options: UnitySandMaterialOptions = {},
): UnitySandMaterialOwner {
  return new UnitySandMaterialOwner(options);
}
