/**
 * Unity coastline/ocean port.
 *
 * Provenance: this module is a clean Three.js implementation from the audited
 * MatrixRex Unity material and OceanPlaneGenerator values.  It deliberately
 * does not reuse the former four-wave/swash/wet-sand CoastWater simulation.
 * The same two Gerstner equations are evaluated in the GPU and by the public
 * CPU sampler so rendering and gameplay queries cannot drift apart.
 */
import * as THREE from "three";

const TAU = Math.PI * 2;
const GRAVITY = 9.8;
const SHORE_SAMPLE_METRES = 2;
const SHORE_OVERLAP = 6;
const OCEAN_WIDTH = 120;
const LATERAL_SEGMENTS = 128;
const UNITY_SOURCE_TO_THREE_Z = -1;
const UNITY_BEACHFRONT_PLAYABLE_SHORE_SAMPLES = 371;
const RIBBON_Y_OFFSET = 0;
const HORIZON_DISTANCES = [105, 130, 800] as const;
const HORIZON_ALPHAS = [0, 1, 1] as const;

export interface ShoreSample {
  x: number;
  z: number;
  sx: number;
  sz: number;
  beachSlope: number;
  bedSlope: number;
}

export interface CoastWaterOpts {
  shore: ShoreSample[];
  seaLevel: number;
  shoreDirX: number;
  shoreDirZ: number;
  course: { x: number; z: number }[];
  /** Retained only for drop-in constructor compatibility; shading uses depth. */
  terrainHeight: (x: number, z: number) => number;
  quality?: OceanQuality;
  /** Unity Beachfront's exact 50×2m pre-tail and 400×2m post-tail. */
  extendUnityTails?: boolean;
  /**
   * Marks source-authored Unity world coordinates for the Z-handedness
   * conversion. Native Three.js courses may still request the same ocean
   * tails without having their waves, textures, or reflection mirrored.
   */
  sourceCoordinates?: "unity" | "three";
}

export type OceanQuality = "full" | "lite";

export interface OceanColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface UnityOceanParams {
  wave1Length: number;
  wave1Height: number;
  wave1Speed: number;
  wave1DirX: number;
  wave1DirZ: number;
  wave1Sharpness: number;
  wave2Length: number;
  wave2Height: number;
  wave2Speed: number;
  wave2DirX: number;
  wave2DirZ: number;
  wave2Sharpness: number;
  shallow: OceanColor;
  deep: OceanColor;
  depthDistance: number;
  distanceStart: number;
  distanceFade: number;
  shoreFadeSmoothness: number;
  peak: OceanColor;
  normalStrength: number;
  normalPan: number;
  normalScale: number;
  normalDistanceStrength: number;
  shadow: OceanColor;
  specular: OceanColor;
  specularSpread: number;
  specularHardness: number;
  specularSize: number;
  refractionStrength: number;
  refractionDistance: number;
  refractionFade: number;
  reflectionStrength: number;
  reflectionFresnel: number;
  reflectionDistortion: number;
  causticsDepth: number;
  causticsPan: number;
  causticsScale: number;
  causticsStrength: number;
  causticsDistortion: number;
  causticsDistortionScale: number;
  causticsStart: number;
  causticsFade: number;
  intersection: OceanColor;
  intersectionWidth: number;
  intersectionDissolve: number;
  intersectionScale: number;
  intersectionTile: number;
  intersectionPanX: number;
  intersectionPanY: number;
  intersectionDistortion: number;
  intersectionSmoothness: number;
  intersectionInvert: number;
  intersectionGradient: number;
  intersectionEdgeFade: number;
  shorelineEnabled: number;
  shorelineAlpha: number;
}

export const UNITY_OCEAN_DEFAULTS: UnityOceanParams = {
  wave1Length: 59.3,
  wave1Height: 0.01,
  wave1Speed: 0.1,
  wave1DirX: 1,
  wave1DirZ: 0,
  wave1Sharpness: 1,
  wave2Length: 45.8,
  wave2Height: 0.015,
  wave2Speed: 0.15,
  wave2DirX: -0.49,
  wave2DirZ: 1,
  wave2Sharpness: 0.699,
  shallow: { r: 0.02352938, g: 0.82328343, b: 0.9882353, a: 0.688 },
  deep: { r: 0, g: 0.2462014, b: 0.503, a: 1 },
  depthDistance: 0.3,
  distanceStart: 0,
  distanceFade: 10,
  shoreFadeSmoothness: 0.033,
  peak: { r: 0.542453, g: 0.850634, b: 1, a: 0.47 },
  normalStrength: 7.79,
  normalPan: 0.31,
  normalScale: 0.32,
  normalDistanceStrength: 7.04,
  shadow: { r: 0, g: 0, b: 0, a: 0.649 },
  specular: { r: 14.27, g: 22.6274, b: 24.66, a: 1 },
  specularSpread: 0.145,
  specularHardness: 0.928,
  specularSize: 0.288,
  refractionStrength: 0.63,
  refractionDistance: 0.53,
  refractionFade: 0.01,
  reflectionStrength: 1,
  reflectionFresnel: 17.8,
  reflectionDistortion: 1.42,
  causticsDepth: -4,
  causticsPan: 1.11,
  causticsScale: 2,
  causticsStrength: 1.28,
  causticsDistortion: 1,
  causticsDistortionScale: 3,
  causticsStart: 0,
  causticsFade: 32.01,
  intersection: { r: 1, g: 1, b: 1, a: 1 },
  intersectionWidth: 0.95,
  intersectionDissolve: 2,
  intersectionScale: 4.16,
  intersectionTile: 1,
  intersectionPanX: 0.4,
  intersectionPanY: 0.02,
  intersectionDistortion: 0,
  intersectionSmoothness: 1,
  intersectionInvert: 0,
  intersectionGradient: 1,
  intersectionEdgeFade: 1,
  shorelineEnabled: 1,
  shorelineAlpha: 0,
};

/** Compatibility names for integrations that previously imported these. */
export type WaterParams = UnityOceanParams;
export const WATER_DEFAULTS = UNITY_OCEAN_DEFAULTS;

export interface SurfaceSample {
  height: number;
  nx: number;
  ny: number;
  nz: number;
  depth: number;
  shorePhase: number;
  shoreInfluence: number;
  displacementX: number;
  displacementZ: number;
}

export interface OceanDebug {
  water: boolean;
  horizon: boolean;
  reflection: boolean;
  prepass: boolean;
  refraction: boolean;
  caustics: boolean;
  intersection: boolean;
  freeze: boolean;
  wireframe: boolean;
}

export interface OceanStats {
  verts: number;
  tris: number;
  shoreSamples: number;
  /** Effective scene/pre-CRT pixel width used by all ocean passes. */
  sceneWidth: number;
  /** Effective scene/pre-CRT pixel height used by all ocean passes. */
  sceneHeight: number;
  /** Latest physical drawing-buffer width reported by the renderer. */
  nativeDrawingBufferWidth: number;
  /** Latest physical drawing-buffer height reported by the renderer. */
  nativeDrawingBufferHeight: number;
  /** True while sceneWidth/sceneHeight come from setPreCrtRenderSize. */
  preCrtSizeOverride: boolean;
  reflectionWidth: number;
  reflectionHeight: number;
  prepassWidth: number;
  prepassHeight: number;
  reflectionRenders: number;
  prepassRenders: number;
  quality: OceanQuality;
}

export interface OceanRenderSize {
  width: number;
  height: number;
}

interface DenseShoreSample extends ShoreSample {
  arc: number;
}

interface WaveEvaluation {
  height: number;
  dx: number;
  dz: number;
  nx: number;
  ny: number;
  nz: number;
}

const OCEAN_VERTEX = /* glsl */ `
attribute float aShoreDistance;
attribute vec4 aOceanTangent;
uniform float uTime;
uniform float uSeaLevel;
uniform vec4 uWave1;
uniform vec2 uWave1Dir;
uniform vec4 uWave2;
uniform vec2 uWave2Dir;
varying vec3 vWorld;
varying vec3 vWaveNormal;
varying vec3 vOceanTangent;
varying float vOceanTangentW;
varying float vShoreDistance;
varying float vViewDepth;
varying vec4 vClipPosition;
#include <common>
#include <shadowmap_pars_vertex>

void unityGerstner(
  vec2 worldXZ,
  vec4 wave,
  vec2 rawDirection,
  inout vec3 displacement,
  inout vec3 normalSum
) {
  float k = 6.283185307179586 / wave.x;
  vec2 direction = normalize(rawDirection);
  float phi = dot(worldXZ, direction * k)
    - sqrt(9.8 * k) * uTime * wave.z;
  // Exact audited Unity displacement:
  // (0,H*cos(phi),0) - normalize(dir)*(sharp/k)*sin(phi)
  displacement.y += wave.y * cos(phi);
  displacement.xz -= direction * (wave.w / k) * sin(phi);
  // Exact audited Unity normal contribution; the two bands are summed.
  normalSum += vec3(
    direction.x * k * wave.y * sin(phi),
    1.0 - wave.w * cos(phi),
    direction.y * k * wave.y * sin(phi)
  );
}

void main() {
  vec4 baseWorld = modelMatrix * vec4(position, 1.0);
  vec3 displacement = vec3(0.0);
  vec3 normalSum = vec3(0.0);
  unityGerstner(baseWorld.xz, uWave1, uWave1Dir, displacement, normalSum);
  unityGerstner(baseWorld.xz, uWave2, uWave2Dir, displacement, normalSum);
  vec4 world = baseWorld;
  world.xyz += displacement;
  // Meshes are authored at sea level. Keep the uniform in the interface for
  // reflection/depth consumers and protect against transformed authoring.
  world.y += uSeaLevel - (modelMatrix * vec4(0.0, uSeaLevel, 0.0, 1.0)).y;
  vWorld = world.xyz;
  // Shader Graph interpolates the raw summed vertex normal and renormalizes in
  // BuildSurfaceDescriptionInputs; normalizing per vertex changes that blend.
  vWaveNormal = mat3(modelMatrix) * normalSum;
  vOceanTangent = normalize(mat3(modelMatrix) * aOceanTangent.xyz);
  vOceanTangentW = aOceanTangent.w;
  vShoreDistance = aShoreDistance;
  vec4 mvPosition = viewMatrix * world;
  vViewDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
  vClipPosition = gl_Position;

  // Three's shadow chunk expects the same intermediates as its stock vertex
  // path. Feed it the displaced MatrixRex world position and wave normal.
  vec3 transformedNormal = normalize(normalMatrix * normalSum);
  vec4 worldPosition = world;
  #include <shadowmap_vertex>
}
`;

const OCEAN_FRAGMENT = /* glsl */ `
uniform sampler2D uNormalMap;
uniform sampler2D uShoreNoise;
uniform sampler2D uIntersectionNoise;
uniform sampler2D uCausticsDistortionMap;
uniform sampler2D uCausticsMap;
uniform sampler2D uSceneColor;
uniform sampler2D uSceneDepth;
uniform sampler2D uReflection;
uniform float uCameraNear;
uniform float uCameraFar;
uniform mat4 uInverseProjection;
uniform mat4 uInverseView;
uniform float uTime;
uniform float uHasPrepass;
uniform float uHasReflection;
uniform float uRefractionOn;
uniform float uCausticsOn;
uniform float uIntersectionOn;
uniform vec4 uWave1;
uniform vec2 uWave1Dir;
uniform vec4 uWave2;
uniform vec2 uWave2Dir;

uniform vec4 uShallow;
uniform vec4 uDeep;
uniform float uDepthDistance;
uniform float uDistanceStart;
uniform float uDistanceFade;
uniform float uShoreFadeSmoothness;
uniform vec4 uPeak;
uniform float uNormalStrength;
uniform float uNormalPan;
uniform float uNormalScale;
uniform float uNormalDistanceStrength;
uniform vec4 uShadow;
uniform vec4 uSpecular;
uniform float uSpecularSpread;
uniform float uSpecularHardness;
uniform float uSpecularSize;
uniform float uRefractionStrength;
uniform float uRefractionDistance;
uniform float uRefractionFade;
uniform float uReflectionStrength;
uniform float uReflectionFresnel;
uniform float uReflectionDistortion;
uniform float uCausticsDepth;
uniform float uCausticsPan;
uniform float uCausticsScale;
uniform float uCausticsStrength;
uniform float uCausticsDistortion;
uniform float uCausticsDistortionScale;
uniform float uCausticsStart;
uniform float uCausticsFade;
uniform vec4 uIntersection;
uniform float uIntersectionWidth;
uniform float uIntersectionDissolve;
uniform float uIntersectionScale;
uniform float uIntersectionTile;
uniform vec2 uIntersectionPan;
uniform float uIntersectionDistortion;
uniform float uIntersectionSmoothness;
uniform float uIntersectionInvert;
uniform float uIntersectionGradient;
uniform float uIntersectionEdgeFade;
uniform float uShorelineEnabled;
uniform float uShorelineAlpha;
uniform vec3 uMainLightDirection;
uniform float uSourceZSign;
uniform float uReflectionFlipX;

varying vec3 vWorld;
varying vec3 vWaveNormal;
varying vec3 vOceanTangent;
varying float vOceanTangentW;
varying float vShoreDistance;
varying float vViewDepth;
varying vec4 vClipPosition;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
#include <common>
#include <packing>
#include <shadowmap_pars_fragment>

float distanceMask(float start, float fade) {
  return saturate((distance(cameraPosition, vWorld) - start)
    / max(fade, 0.000001));
}

vec3 sceneWorldPosition(vec2 uv) {
  float sampledDepth = texture2D(uSceneDepth, uv).x;
  vec4 sceneClip = vec4(uv * 2.0 - 1.0, sampledDepth * 2.0 - 1.0, 1.0);
  vec4 sceneView = uInverseProjection * sceneClip;
  sceneView /= max(abs(sceneView.w), 0.000001);
  return (uInverseView * sceneView).xyz;
}

float sceneEyeDepth(vec2 uv) {
  return -perspectiveDepthToViewZ(
    texture2D(uSceneDepth, uv).x,
    uCameraNear,
    uCameraFar
  );
}

// MatrixRex DepthFadeWorldPosition with _WorldSpaceDepth enabled.
float waterDepth01(vec2 uv) {
  if (uHasPrepass < 0.5) return 0.0;
  float vertical = sceneWorldPosition(uv).y - vWorld.y;
  return saturate(exp(vertical / max(uDepthDistance, 0.000001)));
}

vec3 unpackUnityNormal(vec4 packedNormal) {
  // PC normal-map import uses BC5/RG. This is Unity's UnpackNormalMapRGorAG
  // result after texture decompression.
  vec2 xy = packedNormal.rg * 2.0 - 1.0;
  float z = sqrt(max(0.0000000000000001, 1.0 - saturate(dot(xy, xy))));
  return vec3(xy, z);
}

vec4 colorLayerAlpha(vec4 base, vec4 layer, float layerMask) {
  return mix(base, layer, layerMask * layer.a);
}

float gerstnerHeight(vec2 worldXZ, vec4 wave, vec2 rawDirection) {
  float k = 6.283185307179586 / wave.x;
  vec2 direction = normalize(rawDirection);
  float phi = dot(worldXZ, direction * k)
    - sqrt(9.8 * k) * uTime * wave.z;
  return wave.y * cos(phi);
}

vec2 parallaxUv(float parallaxDepth, vec3 viewTs) {
  vec3 v = normalize(viewTs);
  v.z += 0.42;
  float amplitude = parallaxDepth * 0.1;
  float height = -amplitude * 0.5; // the Shader Graph heightmap is black
  vec2 unityWorldXZ = vec2(vWorld.x, vWorld.z * uSourceZSign);
  return unityWorldXZ * 0.1 + height * (v.xy / max(abs(v.z), 0.000001))
    * sign(v.z);
}

void main() {
  vec2 screenUv = vClipPosition.xy / max(abs(vClipPosition.w), 0.0001);
  screenUv = screenUv * 0.5 + 0.5;

  // Exact MatrixRex two-way normal panners and Normal Strength node.
  // Preserve MatrixRex's Unity-world XZ texture phase after the source scene's
  // Z axis is mirrored into Three's right-handed -Z course convention.
  vec2 worldUv = vec2(vWorld.x, vWorld.z * uSourceZSign) * 0.1;
  vec2 uvA = worldUv * (uNormalScale * 0.5)
    + vec2(-uNormalPan * 0.05 * uTime);
  vec2 uvB = worldUv * uNormalScale
    + vec2(uNormalPan * 0.1 * uTime);
  vec3 mapA = unpackUnityNormal(texture2D(uNormalMap, uvA));
  vec3 mapB = unpackUnityNormal(texture2D(uNormalMap, uvB));
  vec3 rawNormalTs = mix(mapA, mapB, 0.5);
  float cameraDistance = distance(cameraPosition, vWorld);
  float normalStrength = mix(
    uNormalStrength,
    uNormalDistanceStrength,
    distanceMask(uDistanceStart, uDistanceFade)
  );
  vec3 normalTs = vec3(
    rawNormalTs.xy * normalStrength,
    mix(1.0, rawNormalTs.z, saturate(normalStrength))
  );
  vec3 geometricN = normalize(vWaveNormal);
  vec3 T = normalize(vOceanTangent);
  vec3 B = normalize(vOceanTangentW * cross(geometricN, T));
  vec3 detailN = normalize(T * normalTs.x + B * normalTs.y + geometricN * normalTs.z);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 viewTs = vec3(dot(T, V), dot(B, V), dot(geometricN, V));

  // Exact shore-fade alpha is evaluated at the undistorted screen position.
  float directDepth = waterDepth01(screenUv);
  float shoreAlpha = smoothstep(
    0.0,
    max(uShoreFadeSmoothness, 0.000001),
    saturate(1.0 - directDepth)
  );

  // MatrixRex screen refraction: camera-distance strength, raw tangent normal,
  // and a depth validity test that rejects foreground-crossing offsets.
  float refractionDistanceMask = saturate((cameraDistance - uRefractionFade) / 5.0);
  float refractionAmount = 0.1 * mix(
    shoreAlpha * uRefractionStrength,
    uRefractionDistance,
    refractionDistanceMask
  );
  vec2 candidateUv = screenUv + rawNormalTs.xy * refractionAmount;
  float candidateDepth = sceneEyeDepth(candidateUv);
  float validRefraction = step(vViewDepth - candidateDepth, 0.0);
  vec2 refractedUv = clamp(
    screenUv + rawNormalTs.xy * refractionAmount * validRefraction,
    0.001,
    0.999
  );

  // MatrixRex world-space exponential depth, sampled at the refracted UV.
  float depthValue = waterDepth01(refractedUv);
  vec4 waterColor = mix(uDeep, uShallow, depthValue);

  // Exact projected caustics subgraph: view parallax, anisotropic Noise4
  // distortion, two counter-panning Caustic1 samples, component minimum, HDR
  // white layer, shallow-depth mask and camera-distance fade.
  float causticParallaxDepth = (1.0 - depthValue) * uCausticsDepth;
  vec2 causticBase = parallaxUv(causticParallaxDepth, viewTs);
  vec2 causticDistortionUv = causticBase * uCausticsDistortionScale
    + vec2(-uCausticsPan * 0.1 * uTime, 0.0);
  float causticDistortionSample =
    texture2D(uCausticsDistortionMap, causticDistortionUv).r * 2.0 - 1.0;
  vec2 causticDistortion = causticDistortionSample * vec2(
    uCausticsDistortion * 0.0001,
    uCausticsDistortion * 0.02
  );
  vec2 causticUvA = causticBase * uCausticsScale
    + vec2(uCausticsPan * 0.1 * uTime) + causticDistortion;
  vec2 causticUvB = causticBase * (uCausticsScale * 1.3)
    - vec2(uCausticsPan * 0.1 * uTime) + causticDistortion;
  float causticPattern = min(
    texture2D(uCausticsMap, causticUvA).r,
    texture2D(uCausticsMap, causticUvB).r
  ) * uCausticsStrength;
  float causticMask = depthValue * causticPattern
    * (1.0 - distanceMask(uCausticsStart, uCausticsFade));
  if (uHasPrepass > 0.5 && uCausticsOn > 0.5) {
    waterColor = colorLayerAlpha(
      waterColor,
      vec4(4.0, 4.0, 4.0, 1.0),
      causticMask
    );
  }

  // Exact current IntersectionFoamGenerator path. Surface distortion is
  // retained even though the approved profile authors its amount to zero.
  float intersectionParallaxDepth = (1.0 - depthValue) * -4.0;
  vec2 intersectionBase = parallaxUv(intersectionParallaxDepth, viewTs);
  float surfaceDistortion = texture2D(
    uCausticsDistortionMap,
    worldUv + vec2(0.1 * uTime)
  ).r * 2.0 - 1.0;
  vec2 intersectionUv = intersectionBase * (uIntersectionTile * uIntersectionScale)
    + uIntersectionPan * (0.1 * uTime)
    + vec2(surfaceDistortion * uIntersectionDistortion * 0.1);
  float intersectionNoise = texture2D(uIntersectionNoise, intersectionUv).r;
  float gradientControl = mix(0.1, 1.0, uIntersectionGradient);
  float widthScale = mix(0.7, 1.0, gradientControl);
  float intersectionEdge = 1.0 - uIntersectionWidth * widthScale;
  float depthBand = smoothstep(
    intersectionEdge,
    intersectionEdge + gradientControl,
    depthValue
  );
  float selectedNoise = mix(
    1.0 - intersectionNoise,
    intersectionNoise,
    uIntersectionInvert
  );
  float dissolveScale = mix(2.5, 1.0, gradientControl);
  float combined = depthBand * (
    depthBand + 1.0 - selectedNoise * uIntersectionDissolve * dissolveScale
  );
  float foamBody = smoothstep(
    0.1,
    0.1 + max(uIntersectionSmoothness, 0.000001),
    combined
  );
  float foamEdge = smoothstep(intersectionEdge, intersectionEdge + 1.0, depthValue);
  float intersectionMask = saturate(mix(
    foamBody,
    foamBody * foamEdge,
    uIntersectionEdgeFade
  ));
  if (uHasPrepass > 0.5 && uIntersectionOn > 0.5) {
    waterColor = colorLayerAlpha(waterColor, uIntersection, intersectionMask);
  } else {
    intersectionMask = 0.0;
  }

  // Shoreline is enabled in Unity but its approved color alpha is exactly 0,
  // so the entire subgraph is mathematically inert in the active variant.

  // Wave-top layer uses summed vertical displacement at the fragment. The
  // Shader Graph Lerp is intentionally not saturated, so troughs extrapolate.
  float fragmentWaveHeight =
    gerstnerHeight(vWorld.xz, uWave1, uWave1Dir)
    + gerstnerHeight(vWorld.xz, uWave2, uWave2Dir);
  waterColor = colorLayerAlpha(waterColor, uPeak, fragmentWaveHeight * 10.0);

  // Refraction layer alpha is the depth-color alpha after intersection. It is
  // separate from the final material opacity, which is shoreAlpha below.
  float refractionLayerAlpha = mix(uDeep.a, uShallow.a, depthValue);
  refractionLayerAlpha = mix(
    refractionLayerAlpha,
    uIntersection.a,
    intersectionMask * uIntersection.a
  );
  vec3 refractedScene = texture2D(uSceneColor, refractedUv).rgb;
  vec3 finalColor = waterColor.rgb;
  if (uHasPrepass > 0.5 && uRefractionOn > 0.5) {
    finalColor = mix(finalColor, refractedScene, 1.0 - refractionLayerAlpha);
  }

  // Planar reflection samples the mirrored render with current-camera screen
  // UV plus the scaled tangent normal; it does not reproject world position.
  vec2 reflectionUv = clamp(
    screenUv + normalTs.xy * uReflectionDistortion * 0.1,
    0.001,
    0.999
  );
  // Unity renders with a determinant-negative reflected view and inverted
  // culling. Three's proper-handed reflected camera differs by exactly one
  // horizontal screen reflection, so flip the lookup for source-scene parity.
  reflectionUv.x = mix(reflectionUv.x, 1.0 - reflectionUv.x, uReflectionFlipX);
  vec3 reflectionColor = texture2D(uReflection, reflectionUv).rgb;
  float fresnel = pow(
    1.0 - saturate(dot(geometricN, V)),
    uReflectionFresnel
  );
  if (uHasReflection > 0.5) {
    finalColor = mix(
      finalColor,
      reflectionColor,
      fresnel * uReflectionStrength
    );
  }

  // Exact MatrixRex main-light reflect-vector specular and hardening graph.
  float specRaw = pow(
    saturate(dot(-reflect(normalize(uMainLightDirection), detailN), V)),
    exp2((1.0 - uSpecularSpread) * 10.0 + 1.0)
  );
  float specCut = smoothstep(
    1.0 - uSpecularSize,
    1.0 - uSpecularSize + 0.15,
    specRaw
  );
  float specularMask = mix(specRaw, specCut, uSpecularHardness);
  finalColor += uSpecular.rgb * specularMask;

  // Main-light shadow attenuation, with Unity's authored translucent black
  // overlay. Three supplies the live directional shadow map to this material.
  float shadowAttenuation = 1.0;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    DirectionalLightShadow shadowData = directionalLightShadows[0];
    shadowAttenuation = getShadow(
      directionalShadowMap[0],
      shadowData.shadowMapSize,
      shadowData.shadowIntensity,
      shadowData.shadowBias,
      shadowData.shadowRadius,
      vDirectionalShadowCoord[0]
    );
  #endif
  finalColor = mix(
    finalColor,
    uShadow.rgb,
    (1.0 - shadowAttenuation) * uShadow.a
  );

  // Unity linear fog (Three's stock Fog chunk uses smoothstep instead).
  float fogFactor = saturate((vViewDepth - fogNear) / max(fogFar - fogNear, 0.000001));
  finalColor = mix(finalColor, fogColor, fogFactor);

  // With refraction enabled, MatrixRex outputs shore fade alone as material
  // alpha—not the shallow/deep color alpha multiplied by it.
  gl_FragColor = vec4(finalColor, shoreAlpha);
  #include <colorspace_fragment>
}
`;

const HORIZON_VERTEX = /* glsl */ `
attribute float aHorizon;
attribute float aAlpha;
uniform float uTime;
uniform float uSourceZSign;
varying float vHorizon;
varying float vAlpha;
varying vec2 vWorldXZ;
varying float vViewDepth;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vHorizon = aHorizon;
  vAlpha = aAlpha;
  vWorldXZ = vec2(world.x, world.z * uSourceZSign);
  vec4 mvPosition = viewMatrix * world;
  vViewDepth = -mvPosition.z;
  gl_Position = projectionMatrix * mvPosition;
}
`;

const HORIZON_FRAGMENT = /* glsl */ `
uniform vec3 uNearColor;
uniform vec3 uFarFogColor;
uniform float uTime;
varying float vHorizon;
varying float vAlpha;
varying vec2 vWorldXZ;
varying float vViewDepth;
uniform vec3 fogColor;
uniform float fogNear;
uniform float fogFar;
void main() {
  float horizon = clamp(vHorizon * 1.12, 0.0, 1.0);
  vec3 color = mix(uNearColor, uFarFogColor, horizon);
  float ripple = sin(vWorldXZ.x * 0.037 + uTime * 0.17)
    + sin(vWorldXZ.y * 0.029 - uTime * 0.11);
  color += ripple * 0.008 * (1.0 - horizon);
  float fogFactor = clamp(
    (vViewDepth - fogNear) / max(fogFar - fogNear, 0.000001),
    0.0,
    1.0
  );
  color = mix(color, fogColor, fogFactor);
  gl_FragColor = vec4(color, vAlpha);
  #include <colorspace_fragment>
}
`;

function cloneParams(source: UnityOceanParams): UnityOceanParams {
  return {
    ...source,
    shallow: { ...source.shallow },
    deep: { ...source.deep },
    peak: { ...source.peak },
    shadow: { ...source.shadow },
    specular: { ...source.specular },
    intersection: { ...source.intersection },
  };
}

function unit2(x: number, z: number, fallbackX = 1, fallbackZ = 0): [number, number] {
  const length = Math.hypot(x, z);
  if (length < 1e-7) return [fallbackX, fallbackZ];
  return [x / length, z / length];
}

function evaluateWavePair(
  x: number,
  z: number,
  time: number,
  p: UnityOceanParams,
  sourceZSign = 1,
): WaveEvaluation {
  let height = 0;
  let dx = 0;
  let dz = 0;
  let nx = 0;
  let ny = 0;
  let nz = 0;
  const waves: [number, number, number, number, number, number][] = [
    [p.wave1Length, p.wave1Height, p.wave1Speed, p.wave1DirX, p.wave1DirZ, p.wave1Sharpness],
    [p.wave2Length, p.wave2Height, p.wave2Speed, p.wave2DirX, p.wave2DirZ, p.wave2Sharpness],
  ];
  for (const [length, waveHeight, speed, rawX, rawSourceZ, sharpness] of waves) {
    const k = TAU / Math.max(length, 1e-5);
    const rawZ = rawSourceZ * sourceZSign;
    const [dirX, dirZ] = unit2(rawX, rawZ);
    const phi = (x * dirX + z * dirZ) * k - Math.sqrt(GRAVITY * k) * time * speed;
    const sinPhi = Math.sin(phi);
    const cosPhi = Math.cos(phi);
    height += waveHeight * cosPhi;
    dx -= dirX * (sharpness / k) * sinPhi;
    dz -= dirZ * (sharpness / k) * sinPhi;
    nx += dirX * k * waveHeight * sinPhi;
    ny += 1 - sharpness * cosPhi;
    nz += dirZ * k * waveHeight * sinPhi;
  }
  const normalLength = Math.hypot(nx, ny, nz) || 1;
  return {
    height,
    dx,
    dz,
    nx: nx / normalLength,
    ny: ny / normalLength,
    nz: nz / normalLength,
  };
}

function resampleShore(
  coarse: ShoreSample[],
  fallbackX: number,
  fallbackZ: number,
  sampleMetres = SHORE_SAMPLE_METRES,
): DenseShoreSample[] {
  if (coarse.length === 0) {
    return [
      { x: -1, z: 0, sx: fallbackX, sz: fallbackZ, beachSlope: 0, bedSlope: 0, arc: 0 },
      { x: 1, z: 0, sx: fallbackX, sz: fallbackZ, beachSlope: 0, bedSlope: 0, arc: 2 },
    ];
  }
  if (coarse.length === 1) {
    const c = coarse[0];
    const tangentX = -fallbackZ;
    const tangentZ = fallbackX;
    return [
      { ...c, x: c.x - tangentX, z: c.z - tangentZ, sx: fallbackX, sz: fallbackZ, arc: 0 },
      { ...c, x: c.x + tangentX, z: c.z + tangentZ, sx: fallbackX, sz: fallbackZ, arc: 2 },
    ];
  }
  const cumulative = [0];
  for (let i = 1; i < coarse.length; i++) {
    cumulative.push(cumulative[i - 1] + Math.hypot(
      coarse[i].x - coarse[i - 1].x,
      coarse[i].z - coarse[i - 1].z,
    ));
  }
  const total = cumulative[cumulative.length - 1];
  const count = Math.max(2, Math.ceil(total / sampleMetres) + 1);
  const dense: DenseShoreSample[] = [];
  let segment = 0;
  for (let i = 0; i < count; i++) {
    const arc = (i / (count - 1)) * total;
    while (segment < cumulative.length - 2 && cumulative[segment + 1] < arc) segment++;
    const a = coarse[segment];
    const b = coarse[Math.min(segment + 1, coarse.length - 1)];
    const segmentLength = cumulative[segment + 1] - cumulative[segment] || 1;
    const t = THREE.MathUtils.clamp((arc - cumulative[segment]) / segmentLength, 0, 1);
    dense.push({
      x: THREE.MathUtils.lerp(a.x, b.x, t),
      z: THREE.MathUtils.lerp(a.z, b.z, t),
      sx: THREE.MathUtils.lerp(a.sx, b.sx, t),
      sz: THREE.MathUtils.lerp(a.sz, b.sz, t),
      beachSlope: THREE.MathUtils.lerp(a.beachSlope, b.beachSlope, t),
      bedSlope: THREE.MathUtils.lerp(a.bedSlope, b.bedSlope, t),
      arc,
    });
  }
  // Recompute local seaward normals from the resampled curve, choosing the
  // perpendicular that agrees with the authored/global sea direction.
  for (let i = 0; i < dense.length; i++) {
    const before = dense[Math.max(0, i - 1)];
    const after = dense[Math.min(dense.length - 1, i + 1)];
    const [tx, tz] = unit2(after.x - before.x, after.z - before.z, -fallbackZ, fallbackX);
    let sx = tz;
    let sz = -tx;
    const authored = unit2(dense[i].sx, dense[i].sz, fallbackX, fallbackZ);
    const refX = Math.abs(authored[0]) + Math.abs(authored[1]) > 0 ? authored[0] : fallbackX;
    const refZ = Math.abs(authored[0]) + Math.abs(authored[1]) > 0 ? authored[1] : fallbackZ;
    if (sx * refX + sz * refZ < 0) {
      sx = -sx;
      sz = -sz;
    }
    dense[i].sx = sx;
    dense[i].sz = sz;
  }
  return dense;
}

/**
 * Preserve Unity Beachfront's authored rows one-for-one. Its playable ribbon
 * deliberately alternates 5/3m and 5/2m intervals so every original 5m
 * course frame remains a vertex; uniformly resampling those rows moves the
 * shoreline and no longer reproduces the source mesh.
 */
function preserveShoreRows(
  coarse: ShoreSample[],
  fallbackX: number,
  fallbackZ: number,
): DenseShoreSample[] {
  const dense: DenseShoreSample[] = coarse.map((sample) => ({ ...sample, arc: 0 }));
  for (let index = 1; index < dense.length; index++) {
    dense[index].arc = dense[index - 1].arc + Math.hypot(
      dense[index].x - dense[index - 1].x,
      dense[index].z - dense[index - 1].z,
    );
  }
  for (let index = 0; index < dense.length; index++) {
    const before = dense[Math.max(0, index - 1)];
    const after = dense[Math.min(dense.length - 1, index + 1)];
    const [tx, tz] = unit2(
      after.x - before.x,
      after.z - before.z,
      -fallbackZ,
      fallbackX,
    );
    let sx = tz;
    let sz = -tx;
    const [authoredX, authoredZ] = unit2(
      dense[index].sx,
      dense[index].sz,
      fallbackX,
      fallbackZ,
    );
    if (sx * authoredX + sz * authoredZ < 0) {
      sx = -sx;
      sz = -sz;
    }
    dense[index].sx = sx;
    dense[index].sz = sz;
  }
  return dense;
}

function extendUnityShoreTails(coarse: ShoreSample[]): ShoreSample[] {
  if (coarse.length < 2) return coarse;
  const first = coarse[0];
  // The 371-row playable ribbon retains 149 exact 5m course frames among its
  // alternating 3/2 subdivisions. Unity derives tail headings from those
  // source frames (indices 3 and length-3), not the immediately adjacent
  // dense rows.
  const exactBeachfront = coarse.length === UNITY_BEACHFRONT_PLAYABLE_SHORE_SAMPLES;
  const second = coarse[exactBeachfront ? 3 : 1];
  const last = coarse[coarse.length - 1];
  const beforeLast = coarse[coarse.length - (exactBeachfront ? 3 : 2)];
  const [firstTx, firstTz] = unit2(second.x - first.x, second.z - first.z);
  const [lastTx, lastTz] = unit2(last.x - beforeLast.x, last.z - beforeLast.z);
  const extended: ShoreSample[] = [];
  for (let index = 50; index > 0; index--) {
    extended.push({
      ...first,
      x: first.x - firstTx * index * 2,
      z: first.z - firstTz * index * 2,
    });
  }
  extended.push(...coarse);
  for (let index = 1; index <= 400; index++) {
    extended.push({
      ...last,
      x: last.x + lastTx * index * 2,
      z: last.z + lastTz * index * 2,
    });
  }
  return extended;
}

function setOceanAttributes(
  geometry: THREE.BufferGeometry,
  shoreDistances: Float32Array,
  tangents: Float32Array,
): void {
  geometry.setAttribute("aShoreDistance", new THREE.BufferAttribute(shoreDistances, 1));
  geometry.setAttribute("aOceanTangent", new THREE.BufferAttribute(tangents, 4));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 16;
}

function makeRibbonGeometry(
  shore: DenseShoreSample[],
  seaLevel: number,
  lateralSegments = LATERAL_SEGMENTS,
  tangentW = -1,
): THREE.BufferGeometry {
  const rows = lateralSegments + 1;
  const count = shore.length * rows;
  const positions = new Float32Array(count * 3);
  const shoreDistances = new Float32Array(count);
  const tangents = new Float32Array(count * 4);
  for (let i = 0; i < shore.length; i++) {
    const sample = shore[i];
    for (let r = 0; r < rows; r++) {
      // Unity columns run offshore -> land overlap (-120m -> +6m in its
      // right-vector coordinate). `d` is positive seaward here, so the exact
      // equivalent is 120m -> -6m. Reversing it flips every triangle down and
      // Cull Back silently removes the ocean on a +Z shoreline.
      const d = OCEAN_WIDTH
        - (r / lateralSegments) * (OCEAN_WIDTH + SHORE_OVERLAP);
      const vertex = i * rows + r;
      positions[vertex * 3] = sample.x + sample.sx * d;
      positions[vertex * 3 + 1] = seaLevel + RIBBON_Y_OFFSET;
      positions[vertex * 3 + 2] = sample.z + sample.sz * d;
      shoreDistances[vertex] = d;
      // Unity's curved ribbon tangent is course-right/landward. Mirroring one
      // source axis flips tangent-space handedness, so source w=-1 becomes
      // Three w=+1 for the exact Beachfront conversion.
      tangents[vertex * 4] = -sample.sx;
      tangents[vertex * 4 + 1] = 0;
      tangents[vertex * 4 + 2] = -sample.sz;
      tangents[vertex * 4 + 3] = tangentW;
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < shore.length - 1; i++) {
    for (let r = 0; r < lateralSegments; r++) {
      const a = i * rows + r;
      const b = a + rows;
      if (tangentW > 0) {
        // C=diag(1,1,-1) has negative determinant, so source triangle order
        // must reverse when the Unity Beachfront rows enter Three space.
        indices.push(a, a + 1, b, a + 1, b + 1, b);
      } else {
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  setOceanAttributes(geometry, shoreDistances, tangents);
  return geometry;
}

function makeHorizonGeometry(shore: DenseShoreSample[], seaLevel: number): THREE.BufferGeometry {
  const rows = HORIZON_DISTANCES.length;
  const count = shore.length * rows;
  const positions = new Float32Array(count * 3);
  const horizon = new Float32Array(count);
  const alpha = new Float32Array(count);
  for (let i = 0; i < shore.length; i++) {
    const sample = shore[i];
    for (let r = 0; r < rows; r++) {
      const distance = HORIZON_DISTANCES[r];
      const vertex = i * rows + r;
      positions[vertex * 3] = sample.x + sample.sx * distance;
      positions[vertex * 3 + 1] = seaLevel;
      positions[vertex * 3 + 2] = sample.z + sample.sz * distance;
      horizon[vertex] = (distance - HORIZON_DISTANCES[0])
        / (HORIZON_DISTANCES[2] - HORIZON_DISTANCES[0]);
      alpha[vertex] = HORIZON_ALPHAS[r];
    }
  }
  const indices: number[] = [];
  for (let i = 0; i < shore.length - 1; i++) {
    for (let r = 0; r < rows - 1; r++) {
      const a = i * rows + r;
      const b = a + rows;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aHorizon", new THREE.BufferAttribute(horizon, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));
  geometry.setIndex(indices);
  geometry.computeBoundingSphere();
  return geometry;
}

function rgbaUniform(color: OceanColor): THREE.Vector4 {
  return new THREE.Vector4(color.r, color.g, color.b, color.a);
}

function solidTexture(r: number, g: number, b: number, a = 255): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([r, g, b, a]), 1, 1, THREE.RGBAFormat);
  texture.needsUpdate = true;
  texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  return texture;
}

export class UnityOcean {
  readonly group = new THREE.Group();
  readonly params = cloneParams(UNITY_OCEAN_DEFAULTS);
  readonly debug: OceanDebug;
  readonly stats: OceanStats;
  readonly seaLevel: number;
  readonly shore: DenseShoreSample[];
  private readonly sourceZSign: number;

  quality: OceanQuality;
  reflectionScale = 0.3;
  prepassScale = 1;

  private readonly oceanMaterial: THREE.ShaderMaterial;
  private readonly horizonMaterial: THREE.ShaderMaterial;
  private readonly ribbon: THREE.Mesh;
  private readonly horizon: THREE.Mesh;
  private readonly ownedTextures: THREE.Texture[] = [];
  private readonly fallbackColor = solidTexture(0, 63, 128);
  private readonly fallbackDepth = solidTexture(255, 255, 255);
  private readonly reflectionMatrix = new THREE.Matrix4();
  private reflectionCamera: THREE.PerspectiveCamera | THREE.OrthographicCamera | null = null;
  private reflectedSource: THREE.Camera | null = null;
  private reflectionRenderTarget: THREE.WebGLRenderTarget | null = null;
  private prepassRenderTarget: THREE.WebGLRenderTarget | null = null;
  private nativeBufferWidth = 1;
  private nativeBufferHeight = 1;
  private nativePixelRatio = 1;
  private bufferWidth = 1;
  private bufferHeight = 1;
  private preCrtWidth: number | null = null;
  private preCrtHeight: number | null = null;
  private time = 0;
  private disposed = false;
  private currentSkyUrl = "";
  private pendingTextureLoads = 0;
  private textureLoadFailed = false;

  constructor(opts: CoastWaterOpts) {
    this.seaLevel = opts.seaLevel;
    this.quality = opts.quality ?? detectQuality();
    const lite = this.quality === "lite";
    const exactUnitySource = opts.sourceCoordinates === "unity";
    // The source Beachfront is converted with C=diag(1,1,-1). Native web
    // levels keep their existing Three coordinate convention even when they
    // reuse Unity's finite ocean-tail layout.
    this.sourceZSign = exactUnitySource ? UNITY_SOURCE_TO_THREE_Z : 1;
    const fallbackDirection = unit2(opts.shoreDirX, opts.shoreDirZ);
    const sourceShore = opts.extendUnityTails
      ? extendUnityShoreTails(opts.shore)
      : opts.shore;
    this.shore = exactUnitySource && opts.extendUnityTails && !lite
      ? preserveShoreRows(sourceShore, fallbackDirection[0], fallbackDirection[1])
      : resampleShore(
          sourceShore,
          fallbackDirection[0],
          fallbackDirection[1],
          lite ? 8 : SHORE_SAMPLE_METRES,
        );
    const renderShore = lite
      ? this.shore.filter(
          (_, index) => index % 2 === 0 || index === this.shore.length - 1,
        )
      : this.shore;
    this.debug = {
      water: true,
      horizon: true,
      reflection: !lite,
      prepass: !lite,
      refraction: !lite,
      caustics: !lite,
      intersection: !lite,
      freeze: false,
      wireframe: false,
    };
    if (lite) {
      this.reflectionScale = 0.15;
      this.prepassScale = 0.5;
    }

    this.ownedTextures.push(this.fallbackColor, this.fallbackDepth);
    const normalMap = this.loadTexture("normal-2.png", false);
    const shoreNoise = this.loadTexture("noise-1.png", false);
    const intersectionNoise = this.loadTexture("noise-3.png", false);
    const causticsDistortion = this.loadTexture("noise-4.png", false);
    const caustics = this.loadTexture("caustic-1.png", false);

    this.oceanMaterial = new THREE.ShaderMaterial({
      name: "Unity MatrixRex ocean",
      vertexShader: OCEAN_VERTEX,
      fragmentShader: OCEAN_FRAGMENT,
      fog: true,
      lights: true,
      transparent: true,
      // MatrixRex's transparent beach forward pass is SrcAlpha blend,
      // ZWrite Off, Cull Back.
      depthWrite: false,
      side: THREE.FrontSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        THREE.UniformsLib.lights,
        {
          uTime: { value: 0 },
          uSeaLevel: { value: this.seaLevel },
          uWave1: { value: new THREE.Vector4() },
          uWave1Dir: { value: new THREE.Vector2() },
          uWave2: { value: new THREE.Vector4() },
          uWave2Dir: { value: new THREE.Vector2() },
          uNormalMap: { value: normalMap },
          uShoreNoise: { value: shoreNoise },
          uIntersectionNoise: { value: intersectionNoise },
          uCausticsDistortionMap: { value: causticsDistortion },
          uCausticsMap: { value: caustics },
          uSceneColor: { value: this.fallbackColor },
          uSceneDepth: { value: this.fallbackDepth },
          uReflection: { value: this.fallbackColor },
          uReflectionMatrix: { value: this.reflectionMatrix },
          uViewport: { value: new THREE.Vector2(1, 1) },
          uCameraNear: { value: 0.1 },
          uCameraFar: { value: 1000 },
          uInverseProjection: { value: new THREE.Matrix4() },
          uInverseView: { value: new THREE.Matrix4() },
          uHasPrepass: { value: 0 },
          uHasReflection: { value: 0 },
          uRefractionOn: { value: 0 },
          uCausticsOn: { value: 0 },
          uIntersectionOn: { value: 0 },
          uShallow: { value: rgbaUniform(this.params.shallow) },
          uDeep: { value: rgbaUniform(this.params.deep) },
          uDepthDistance: { value: this.params.depthDistance },
          uDistanceStart: { value: this.params.distanceStart },
          uDistanceFade: { value: this.params.distanceFade },
          uShoreFadeSmoothness: { value: this.params.shoreFadeSmoothness },
          uPeak: { value: rgbaUniform(this.params.peak) },
          uNormalStrength: { value: this.params.normalStrength },
          uNormalPan: { value: this.params.normalPan },
          uNormalScale: { value: this.params.normalScale },
          uNormalDistanceStrength: { value: this.params.normalDistanceStrength },
          uShadow: { value: rgbaUniform(this.params.shadow) },
          uSpecular: { value: rgbaUniform(this.params.specular) },
          uSpecularSpread: { value: this.params.specularSpread },
          uSpecularHardness: { value: this.params.specularHardness },
          uSpecularSize: { value: this.params.specularSize },
          uRefractionStrength: { value: this.params.refractionStrength },
          uRefractionDistance: { value: this.params.refractionDistance },
          uRefractionFade: { value: this.params.refractionFade },
          uReflectionStrength: { value: this.params.reflectionStrength },
          uReflectionFresnel: { value: this.params.reflectionFresnel },
          uReflectionDistortion: { value: this.params.reflectionDistortion },
          uCausticsDepth: { value: this.params.causticsDepth },
          uCausticsPan: { value: this.params.causticsPan },
          uCausticsScale: { value: this.params.causticsScale },
          uCausticsStrength: { value: this.params.causticsStrength },
          uCausticsDistortion: { value: this.params.causticsDistortion },
          uCausticsDistortionScale: { value: this.params.causticsDistortionScale },
          uCausticsStart: { value: this.params.causticsStart },
          uCausticsFade: { value: this.params.causticsFade },
          uIntersection: { value: rgbaUniform(this.params.intersection) },
          uIntersectionWidth: { value: this.params.intersectionWidth },
          uIntersectionDissolve: { value: this.params.intersectionDissolve },
          uIntersectionScale: { value: this.params.intersectionScale },
          uIntersectionTile: { value: this.params.intersectionTile },
          uIntersectionPan: {
            value: new THREE.Vector2(this.params.intersectionPanX, this.params.intersectionPanY),
          },
          uIntersectionDistortion: { value: this.params.intersectionDistortion },
          uIntersectionSmoothness: { value: this.params.intersectionSmoothness },
          uIntersectionInvert: { value: this.params.intersectionInvert },
          uIntersectionGradient: { value: this.params.intersectionGradient },
          uIntersectionEdgeFade: { value: this.params.intersectionEdgeFade },
          uShorelineEnabled: { value: this.params.shorelineEnabled },
          uShorelineAlpha: { value: this.params.shorelineAlpha },
          uSourceZSign: { value: this.sourceZSign },
          uReflectionFlipX: {
            value: this.sourceZSign === UNITY_SOURCE_TO_THREE_Z ? 1 : 0,
          },
          uMainLightDirection: {
            value: new THREE.Vector3(
              -0.7557116095,
              0.6441236771,
              0.1183413868 * this.sourceZSign,
            ),
          },
        },
      ]),
    });

    this.horizonMaterial = new THREE.ShaderMaterial({
      name: "Unity ocean horizon fill",
      vertexShader: HORIZON_VERTEX,
      fragmentShader: HORIZON_FRAGMENT,
      fog: true,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        {
          uTime: { value: 0 },
          uSourceZSign: { value: this.sourceZSign },
          uNearColor: {
            value: new THREE.Color(this.params.deep.r, this.params.deep.g, this.params.deep.b),
          },
          uFarFogColor: { value: new THREE.Color(0.58, 0.79, 0.88) },
        },
      ]),
    });

    this.horizon = new THREE.Mesh(
      makeHorizonGeometry(renderShore, this.seaLevel),
      this.horizonMaterial,
    );
    this.horizon.name = "Unity ocean horizon fill";
    this.horizon.frustumCulled = false;
    this.horizon.renderOrder = -20;

    this.ribbon = new THREE.Mesh(
      makeRibbonGeometry(
        renderShore,
        this.seaLevel,
        lite ? 16 : LATERAL_SEGMENTS,
        -this.sourceZSign,
      ),
      this.oceanMaterial,
    );
    this.ribbon.name = "Unity curved shoreline ocean ribbon";
    this.ribbon.frustumCulled = false;
    this.ribbon.receiveShadow = true;
    this.ribbon.renderOrder = 0;
    this.group.name = "Unity MatrixRex ocean";
    this.group.userData.noShadow = true;
    this.group.userData.editorGhost = true;
    this.group.add(this.horizon, this.ribbon);
    this.group.visible = this.pendingTextureLoads === 0;

    const geometries = [this.horizon.geometry, this.ribbon.geometry];
    this.stats = {
      verts: geometries.reduce((sum, geometry) => sum + geometry.getAttribute("position").count, 0),
      tris: geometries.reduce((sum, geometry) => sum + (geometry.getIndex()?.count ?? 0) / 3, 0),
      shoreSamples: this.shore.length,
      sceneWidth: 1,
      sceneHeight: 1,
      nativeDrawingBufferWidth: 1,
      nativeDrawingBufferHeight: 1,
      preCrtSizeOverride: false,
      reflectionWidth: 0,
      reflectionHeight: 0,
      prepassWidth: 0,
      prepassHeight: 0,
      reflectionRenders: 0,
      prepassRenders: 0,
      quality: this.quality,
    };
    this.syncUniforms();
  }

  private loadTexture(file: string, srgb: boolean): THREE.Texture {
    const base = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "/");
    this.pendingTextureLoads++;
    const texture = new THREE.TextureLoader().load(
      `${base}water/matrixrex/${file}`,
      () => this.settleTextureLoad(),
      undefined,
      () => {
        this.textureLoadFailed = true;
        this.settleTextureLoad();
      },
    );
    texture.name = `MatrixRex ${file}`;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapNearestFilter;
    texture.generateMipmaps = true;
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    this.ownedTextures.push(texture);
    return texture;
  }

  private settleTextureLoad(): void {
    this.pendingTextureLoads = Math.max(0, this.pendingTextureLoads - 1);
    if (
      !this.disposed &&
      !this.textureLoadFailed &&
      this.pendingTextureLoads === 0
    )
      this.group.visible = true;
  }

  private syncUniforms(): void {
    const p = this.params;
    const uniforms = this.oceanMaterial.uniforms;
    uniforms.uTime.value = this.time;
    uniforms.uSeaLevel.value = this.seaLevel;
    (uniforms.uWave1.value as THREE.Vector4).set(
      p.wave1Length, p.wave1Height, p.wave1Speed, p.wave1Sharpness,
    );
    (uniforms.uWave1Dir.value as THREE.Vector2).set(
      p.wave1DirX,
      p.wave1DirZ * this.sourceZSign,
    );
    (uniforms.uWave2.value as THREE.Vector4).set(
      p.wave2Length, p.wave2Height, p.wave2Speed, p.wave2Sharpness,
    );
    (uniforms.uWave2Dir.value as THREE.Vector2).set(
      p.wave2DirX,
      p.wave2DirZ * this.sourceZSign,
    );
    (uniforms.uShallow.value as THREE.Vector4).set(
      p.shallow.r, p.shallow.g, p.shallow.b, p.shallow.a,
    );
    (uniforms.uDeep.value as THREE.Vector4).set(p.deep.r, p.deep.g, p.deep.b, p.deep.a);
    (uniforms.uPeak.value as THREE.Vector4).set(p.peak.r, p.peak.g, p.peak.b, p.peak.a);
    (uniforms.uShadow.value as THREE.Vector4).set(
      p.shadow.r, p.shadow.g, p.shadow.b, p.shadow.a,
    );
    (uniforms.uSpecular.value as THREE.Vector4).set(
      p.specular.r, p.specular.g, p.specular.b, p.specular.a,
    );
    (uniforms.uIntersection.value as THREE.Vector4).set(
      p.intersection.r, p.intersection.g, p.intersection.b, p.intersection.a,
    );
    uniforms.uDepthDistance.value = p.depthDistance;
    uniforms.uDistanceStart.value = p.distanceStart;
    uniforms.uDistanceFade.value = p.distanceFade;
    uniforms.uShoreFadeSmoothness.value = p.shoreFadeSmoothness;
    uniforms.uNormalStrength.value = p.normalStrength;
    uniforms.uNormalPan.value = p.normalPan;
    uniforms.uNormalScale.value = p.normalScale;
    uniforms.uNormalDistanceStrength.value = p.normalDistanceStrength;
    uniforms.uSpecularSpread.value = p.specularSpread;
    uniforms.uSpecularHardness.value = p.specularHardness;
    uniforms.uSpecularSize.value = p.specularSize;
    uniforms.uRefractionStrength.value = p.refractionStrength;
    uniforms.uRefractionDistance.value = p.refractionDistance;
    uniforms.uRefractionFade.value = p.refractionFade;
    uniforms.uReflectionStrength.value = p.reflectionStrength;
    uniforms.uReflectionFresnel.value = p.reflectionFresnel;
    uniforms.uReflectionDistortion.value = p.reflectionDistortion;
    uniforms.uCausticsDepth.value = p.causticsDepth;
    uniforms.uCausticsPan.value = p.causticsPan;
    uniforms.uCausticsScale.value = p.causticsScale;
    uniforms.uCausticsStrength.value = p.causticsStrength;
    uniforms.uCausticsDistortion.value = p.causticsDistortion;
    uniforms.uCausticsDistortionScale.value = p.causticsDistortionScale;
    uniforms.uCausticsStart.value = p.causticsStart;
    uniforms.uCausticsFade.value = p.causticsFade;
    uniforms.uIntersectionWidth.value = p.intersectionWidth;
    uniforms.uIntersectionDissolve.value = p.intersectionDissolve;
    uniforms.uIntersectionScale.value = p.intersectionScale;
    uniforms.uIntersectionTile.value = p.intersectionTile;
    (uniforms.uIntersectionPan.value as THREE.Vector2).set(
      p.intersectionPanX, p.intersectionPanY,
    );
    uniforms.uIntersectionDistortion.value = p.intersectionDistortion;
    uniforms.uIntersectionSmoothness.value = p.intersectionSmoothness;
    uniforms.uIntersectionInvert.value = p.intersectionInvert;
    uniforms.uIntersectionGradient.value = p.intersectionGradient;
    uniforms.uIntersectionEdgeFade.value = p.intersectionEdgeFade;
    uniforms.uShorelineEnabled.value = p.shorelineEnabled;
    uniforms.uShorelineAlpha.value = p.shorelineAlpha;
    uniforms.uRefractionOn.value = this.debug.refraction ? 1 : 0;
    uniforms.uCausticsOn.value = this.debug.caustics ? 1 : 0;
    uniforms.uIntersectionOn.value = this.debug.intersection ? 1 : 0;
    this.oceanMaterial.wireframe = this.debug.wireframe;
    this.horizonMaterial.wireframe = this.debug.wireframe;
    this.ribbon.visible = this.debug.water;
    this.horizon.visible = this.debug.horizon;
    this.horizonMaterial.uniforms.uTime.value = this.time;
    (this.horizonMaterial.uniforms.uNearColor.value as THREE.Color).setRGB(
      p.deep.r, p.deep.g, p.deep.b,
    );
  }

  update(dt: number, camera: THREE.Camera): void {
    if (this.disposed) return;
    if (!this.debug.freeze) this.time += dt;
    if (camera instanceof THREE.PerspectiveCamera || camera instanceof THREE.OrthographicCamera) {
      this.oceanMaterial.uniforms.uCameraNear.value = camera.near;
      this.oceanMaterial.uniforms.uCameraFar.value = camera.far;
      camera.updateMatrixWorld(true);
      (this.oceanMaterial.uniforms.uInverseProjection.value as THREE.Matrix4)
        .copy(camera.projectionMatrixInverse);
      (this.oceanMaterial.uniforms.uInverseView.value as THREE.Matrix4)
        .copy(camera.matrixWorld);
    }
    this.syncUniforms();
  }

  sampleWaterSurface(x: number, z: number, time = this.time): SurfaceSample {
    const wave = evaluateWavePair(x, z, time, this.params, this.sourceZSign);
    return {
      height: this.seaLevel + wave.height,
      nx: wave.nx,
      ny: wave.ny,
      nz: wave.nz,
      depth: 0,
      shorePhase: 0,
      shoreInfluence: 0,
      displacementX: wave.dx,
      displacementZ: wave.dz,
    };
  }

  heightAt(x: number, z: number, time = this.time): number {
    return this.sampleWaterSurface(x, z, time).height;
  }

  /** Uniforms are synchronized each frame; retained for old studio callers. */
  markWavesDirty(): void {
    this.syncUniforms();
  }

  setQuality(quality: OceanQuality): void {
    if (quality === this.quality) return;
    this.quality = quality;
    this.stats.quality = quality;
    if (quality === "lite") {
      this.reflectionScale = 0.15;
      this.prepassScale = 0.5;
      this.debug.reflection = false;
      this.debug.prepass = false;
      this.debug.refraction = false;
      this.debug.caustics = false;
      this.debug.intersection = false;
    } else {
      this.reflectionScale = 0.3;
      this.prepassScale = 1;
      this.debug.reflection = true;
      this.debug.prepass = true;
      this.debug.refraction = true;
      this.debug.caustics = true;
      this.debug.intersection = true;
    }
    this.disposeTargets();
  }

  resize(width: number, height: number, pixelRatio = 1): void {
    if (this.disposed) return;
    const ratio = finitePixelScale(pixelRatio);
    this.setNativeBufferSize(width * ratio, height * ratio, ratio);
    this.syncPassSize();
  }

  resizeFromRenderer(renderer: THREE.WebGLRenderer): void {
    if (this.disposed) return;
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    this.setNativeBufferSize(size.x, size.y, renderer.getPixelRatio());
    this.syncPassSize();
  }

  /**
   * Pin every ocean render pass to the scene size feeding CRT/post-processing.
   * Width and height are physical pixels, not CSS pixels, and are deliberately
   * independent of the renderer's final high-DPR drawing buffer.
   */
  setPreCrtRenderSize(width: number, height: number): void {
    if (this.disposed) return;
    const nextWidth = finitePixelDimension(width, "width");
    const nextHeight = finitePixelDimension(height, "height");
    this.preCrtWidth = nextWidth;
    this.preCrtHeight = nextHeight;
    this.syncPassSize();
  }

  /** Resume native drawing-buffer sizing after setPreCrtRenderSize. */
  clearPreCrtRenderSize(): void {
    if (this.disposed) return;
    this.preCrtWidth = null;
    this.preCrtHeight = null;
    this.syncPassSize();
  }

  /** The configured fixed scene size, or null while native sizing is active. */
  get preCrtRenderSize(): OceanRenderSize | null {
    if (this.preCrtWidth === null || this.preCrtHeight === null) return null;
    return { width: this.preCrtWidth, height: this.preCrtHeight };
  }

  private setNativeBufferSize(
    width: number,
    height: number,
    pixelRatio: number,
  ): void {
    const nextWidth = finitePixelDimension(width, "width");
    const nextHeight = finitePixelDimension(height, "height");
    const nextPixelRatio = finitePixelRatio(pixelRatio);
    this.nativeBufferWidth = nextWidth;
    this.nativeBufferHeight = nextHeight;
    this.nativePixelRatio = nextPixelRatio;
    this.stats.nativeDrawingBufferWidth = this.nativeBufferWidth;
    this.stats.nativeDrawingBufferHeight = this.nativeBufferHeight;
  }

  private syncPassSize(): void {
    if (this.disposed) return;
    const width = this.preCrtWidth ?? this.nativeBufferWidth;
    const height = this.preCrtHeight ?? this.nativeBufferHeight;
    this.bufferWidth = width;
    this.bufferHeight = height;
    this.stats.sceneWidth = width;
    this.stats.sceneHeight = height;
    this.stats.preCrtSizeOverride = this.preCrtWidth !== null;
    (this.oceanMaterial.uniforms.uViewport.value as THREE.Vector2).set(
      width,
      height,
    );

    // Disabled ocean passes stay allocation-free. If a debug/presentation
    // caller re-enables them after a resize, the concrete target dimensions
    // below detect the stale allocation even though the effective size is
    // already current.
    if (
      (this.debug.reflection || this.debug.prepass)
      && !this.targetsMatchPassSize()
    ) {
      this.allocateTargets();
    }
  }

  private targetsMatchPassSize(): boolean {
    const {
      reflectionWidth,
      reflectionHeight,
      prepassWidth,
      prepassHeight,
    } = this.passTargetDimensions();
    return this.reflectionRenderTarget?.width === reflectionWidth
      && this.reflectionRenderTarget.height === reflectionHeight
      && this.prepassRenderTarget?.width === prepassWidth
      && this.prepassRenderTarget.height === prepassHeight;
  }

  private passTargetDimensions(): {
    reflectionWidth: number;
    reflectionHeight: number;
    prepassWidth: number;
    prepassHeight: number;
  } {
    const reflectionWidth = Math.max(
      1,
      Math.round(this.bufferWidth * this.reflectionScale),
    );
    const reflectionHeight = Math.max(
      1,
      Math.round(this.bufferHeight * this.reflectionScale),
    );
    const prepassWidth = Math.max(
      1,
      Math.round(this.bufferWidth * this.prepassScale),
    );
    const prepassHeight = Math.max(
      1,
      Math.round(this.bufferHeight * this.prepassScale),
    );
    return {
      reflectionWidth,
      reflectionHeight,
      prepassWidth,
      prepassHeight,
    };
  }

  private allocateTargets(): void {
    if (this.disposed) return;
    // Unity scales from the actual camera pixel target. bufferWidth/Height are
    // native drawing-buffer pixels by default, or the explicitly supplied
    // scene/pre-CRT pixels while fixed-resolution presentation is active.
    const {
      reflectionWidth,
      reflectionHeight,
      prepassWidth,
      prepassHeight,
    } = this.passTargetDimensions();
    if (!this.reflectionRenderTarget) {
      this.reflectionRenderTarget = new THREE.WebGLRenderTarget(reflectionWidth, reflectionHeight, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: true,
      });
      this.reflectionRenderTarget.texture.name = "Unity ocean planar reflection 30 percent";
      this.reflectionRenderTarget.texture.generateMipmaps = true;
    } else {
      this.reflectionRenderTarget.setSize(reflectionWidth, reflectionHeight);
    }
    if (!this.prepassRenderTarget) {
      this.prepassRenderTarget = new THREE.WebGLRenderTarget(prepassWidth, prepassHeight, {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        wrapS: THREE.ClampToEdgeWrapping,
        wrapT: THREE.ClampToEdgeWrapping,
        depthBuffer: true,
      });
      this.prepassRenderTarget.texture.name = "Unity ocean opaque color prepass";
      this.prepassRenderTarget.depthTexture = new THREE.DepthTexture(
        prepassWidth, prepassHeight, THREE.UnsignedIntType,
      );
      this.prepassRenderTarget.depthTexture.name = "Unity ocean opaque depth prepass";
      this.prepassRenderTarget.depthTexture.minFilter = THREE.NearestFilter;
      this.prepassRenderTarget.depthTexture.magFilter = THREE.NearestFilter;
    } else {
      this.prepassRenderTarget.setSize(prepassWidth, prepassHeight);
    }
    this.stats.reflectionWidth = reflectionWidth;
    this.stats.reflectionHeight = reflectionHeight;
    this.stats.prepassWidth = prepassWidth;
    this.stats.prepassHeight = prepassHeight;
    const uniforms = this.oceanMaterial.uniforms;
    uniforms.uViewport.value.set(
      this.bufferWidth,
      this.bufferHeight,
    );
    uniforms.uReflection.value = this.reflectionRenderTarget.texture;
    uniforms.uSceneColor.value = this.prepassRenderTarget.texture;
    uniforms.uSceneDepth.value = this.prepassRenderTarget.depthTexture;
  }

  private ensureSize(renderer: THREE.WebGLRenderer): void {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    const width = finitePixelDimension(size.x, "width");
    const height = finitePixelDimension(size.y, "height");
    const pixelRatio = finitePixelRatio(renderer.getPixelRatio());
    if (
      width !== this.nativeBufferWidth
      || height !== this.nativeBufferHeight
      || pixelRatio !== this.nativePixelRatio
    ) {
      this.setNativeBufferSize(width, height, pixelRatio);
    }
    this.syncPassSize();
  }

  private makeReflectionCamera(source: THREE.Camera): THREE.PerspectiveCamera | THREE.OrthographicCamera | null {
    let reflected: THREE.PerspectiveCamera | THREE.OrthographicCamera;
    if (source instanceof THREE.PerspectiveCamera) {
      if (!(this.reflectionCamera instanceof THREE.PerspectiveCamera) || this.reflectedSource !== source) {
        this.reflectionCamera = new THREE.PerspectiveCamera();
      }
      reflected = this.reflectionCamera as THREE.PerspectiveCamera;
      reflected.copy(source, false);
    } else if (source instanceof THREE.OrthographicCamera) {
      if (!(this.reflectionCamera instanceof THREE.OrthographicCamera) || this.reflectedSource !== source) {
        this.reflectionCamera = new THREE.OrthographicCamera();
      }
      reflected = this.reflectionCamera as THREE.OrthographicCamera;
      reflected.copy(source, false);
    } else {
      return null;
    }
    this.reflectedSource = source;
    const position = source.getWorldPosition(new THREE.Vector3());
    const forward = source.getWorldDirection(new THREE.Vector3());
    const quaternion = source.getWorldQuaternion(new THREE.Quaternion());
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(quaternion);
    position.y = this.seaLevel * 2 - position.y;
    forward.y = -forward.y;
    up.y = -up.y;
    reflected.position.copy(position);
    reflected.up.copy(up).normalize();
    reflected.lookAt(position.clone().add(forward));
    reflected.layers.mask = source.layers.mask;
    reflected.updateMatrixWorld(true);
    reflected.matrixWorldInverse.copy(reflected.matrixWorld).invert();

    // Unity clips with an oblique projection plane, not per-material shader
    // clipping. This catches custom/Basic materials too and prevents anything
    // below the sea from leaking into the mirrored capture.
    const waterPlane = new THREE.Plane(
      new THREE.Vector3(0, 1, 0),
      -this.seaLevel,
    ).applyMatrix4(reflected.matrixWorldInverse);
    const clip = new THREE.Vector4(
      waterPlane.normal.x,
      waterPlane.normal.y,
      waterPlane.normal.z,
      waterPlane.constant,
    );
    const projection = reflected.projectionMatrix;
    const elements = projection.elements;
    const q = new THREE.Vector4(
      (Math.sign(clip.x) + elements[8]) / elements[0],
      (Math.sign(clip.y) + elements[9]) / elements[5],
      -1,
      (1 + elements[10]) / elements[14],
    );
    const denominator = clip.dot(q);
    if (Math.abs(denominator) > 1e-6) {
      clip.multiplyScalar(2 / denominator);
      elements[2] = clip.x;
      elements[6] = clip.y;
      elements[10] = clip.z + 1;
      elements[14] = clip.w;
      reflected.projectionMatrixInverse.copy(projection).invert();
    }
    this.reflectionMatrix.multiplyMatrices(
      reflected.projectionMatrix,
      reflected.matrixWorldInverse,
    );
    return reflected;
  }

  /**
   * Render the audited 30%-scale planar reflection. Call before the main scene
   * render. This is a direct scene pass, so post-processing is intentionally
   * absent; ocean objects, fog, shadows, and geometry below sea level are
   * excluded for the pass and all renderer/scene state is restored.
   */
  renderReflection(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.debug.reflection) {
      this.oceanMaterial.uniforms.uHasReflection.value = 0;
      return;
    }
    this.ensureSize(renderer);
    const target = this.reflectionRenderTarget;
    const reflected = this.makeReflectionCamera(camera);
    if (!target || !reflected) {
      this.oceanMaterial.uniforms.uHasReflection.value = 0;
      return;
    }
    const oldTarget = renderer.getRenderTarget();
    const oldXr = renderer.xr.enabled;
    const oldAutoClear = renderer.autoClear;
    const oldShadowEnabled = renderer.shadowMap.enabled;
    const oldShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const oldFog = scene.fog;
    const oldVisible = this.group.visible;
    try {
      this.group.visible = false;
      scene.fog = null;
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      renderer.shadowMap.enabled = false;
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      renderer.render(scene, reflected);
      this.stats.reflectionRenders++;
      this.oceanMaterial.uniforms.uHasReflection.value = 1;
    } finally {
      renderer.setRenderTarget(oldTarget);
      renderer.xr.enabled = oldXr;
      renderer.autoClear = oldAutoClear;
      renderer.shadowMap.enabled = oldShadowEnabled;
      renderer.shadowMap.autoUpdate = oldShadowAutoUpdate;
      scene.fog = oldFog;
      this.group.visible = oldVisible;
    }
  }

  /**
   * Render opaque scene color plus hardware depth for refraction, depth tint,
   * caustics and intersection foam. Transparent drawables are omitted and the
   * ocean group is excluded. Call after renderReflection and before the main
   * scene render.
   */
  renderPrepass(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    if (this.disposed || !this.debug.prepass) {
      this.oceanMaterial.uniforms.uHasPrepass.value = 0;
      return;
    }
    this.ensureSize(renderer);
    const target = this.prepassRenderTarget;
    if (!target) {
      this.oceanMaterial.uniforms.uHasPrepass.value = 0;
      return;
    }
    const hidden: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (!object.visible || object === this.group || this.group.getObjectById(object.id)) return;
      const renderable = object as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
      const materials = renderable.material
        ? Array.isArray(renderable.material) ? renderable.material : [renderable.material]
        : [];
      if (
        !object.userData.oceanOpaqueBackdrop &&
        materials.some((material) => material.transparent || material.opacity < 1)
      ) {
        hidden.push(object);
        object.visible = false;
      }
    });
    const oldTarget = renderer.getRenderTarget();
    const oldXr = renderer.xr.enabled;
    const oldAutoClear = renderer.autoClear;
    const oldShadowAutoUpdate = renderer.shadowMap.autoUpdate;
    const oldVisible = this.group.visible;
    try {
      this.group.visible = false;
      renderer.xr.enabled = false;
      renderer.autoClear = true;
      // Unity copies the opaque buffer; it does not rerender its shadow map.
      // Reuse the previous/main shadow texture for this extra scene pass.
      renderer.shadowMap.autoUpdate = false;
      renderer.setRenderTarget(target);
      renderer.clear(true, true, true);
      renderer.render(scene, camera);
      this.stats.prepassRenders++;
      this.oceanMaterial.uniforms.uHasPrepass.value = 1;
    } finally {
      renderer.setRenderTarget(oldTarget);
      renderer.xr.enabled = oldXr;
      renderer.autoClear = oldAutoClear;
      renderer.shadowMap.autoUpdate = oldShadowAutoUpdate;
      this.group.visible = oldVisible;
      for (const object of hidden) object.visible = true;
    }
  }

  renderPasses(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
  ): void {
    // Paused/editor/model-studio frames bypass the normal water update but can
    // still move the camera. Refresh matrices without advancing wave time.
    this.update(0, camera);
    this.renderReflection(renderer, scene, camera);
    this.renderPrepass(renderer, scene, camera);
  }

  get reflectionTarget(): THREE.WebGLRenderTarget | null {
    return this.reflectionRenderTarget;
  }

  get prepassTarget(): THREE.WebGLRenderTarget | null {
    return this.prepassRenderTarget;
  }

  /** The Unity shader does not sample the sky panorama; kept for main.ts. */
  setSkyUrl(url: string, _fogHex: number, _horizonV = 1 - 600 / 887): void {
    this.currentSkyUrl = url;
  }

  get skyUrl(): string {
    return this.currentSkyUrl;
  }

  get skyReady(): boolean {
    return true;
  }

  private disposeTargets(): void {
    this.reflectionRenderTarget?.dispose();
    this.prepassRenderTarget?.depthTexture?.dispose();
    this.prepassRenderTarget?.dispose();
    this.reflectionRenderTarget = null;
    this.prepassRenderTarget = null;
    this.oceanMaterial.uniforms.uReflection.value = this.fallbackColor;
    this.oceanMaterial.uniforms.uSceneColor.value = this.fallbackColor;
    this.oceanMaterial.uniforms.uSceneDepth.value = this.fallbackDepth;
    this.oceanMaterial.uniforms.uHasReflection.value = 0;
    this.oceanMaterial.uniforms.uHasPrepass.value = 0;
    this.stats.reflectionWidth = 0;
    this.stats.reflectionHeight = 0;
    this.stats.prepassWidth = 0;
    this.stats.prepassHeight = 0;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.disposeTargets();
    this.ribbon.geometry.dispose();
    this.horizon.geometry.dispose();
    this.oceanMaterial.dispose();
    this.horizonMaterial.dispose();
    for (const texture of this.ownedTextures) texture.dispose();
    this.group.clear();
  }
}

/** Drop-in class name for the old `CoastWater` import. */
export { UnityOcean as CoastWater };

function detectQuality(): OceanQuality {
  if (typeof window === "undefined") return "full";
  return new URLSearchParams(window.location.search).has("lite") ? "lite" : "full";
}

function finitePixelDimension(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new RangeError(`Ocean render ${label} must be finite.`);
  }
  return Math.max(1, Math.floor(value));
}

function finitePixelRatio(value: number): number {
  return Math.max(1, finitePixelScale(value));
}

function finitePixelScale(value: number): number {
  if (!Number.isFinite(value)) {
    throw new RangeError("Ocean render pixel ratio must be finite.");
  }
  return value;
}
