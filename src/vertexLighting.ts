import * as THREE from 'three';
import { vertexLightingSettings, type VertexLightingSettings } from './render-quality/vertexLightingSettings';

type Shader = Parameters<THREE.Material['onBeforeCompile']>[0];
type Binding = {
  compile: THREE.Material['onBeforeCompile'];
  key: THREE.Material['customProgramCacheKey'];
  wrappedCompile: THREE.Material['onBeforeCompile'];
  wrappedKey: THREE.Material['customProgramCacheKey'];
  dispose: () => void;
};

const lightKinds = [
  { count: 'NUM_DIR_LIGHTS', varying: 'vVertexDirectional', type: 'DirectionalLight', uniform: 'directionalLights', info: 'getDirectionalLightInfo' },
  { count: 'NUM_POINT_LIGHTS', varying: 'vVertexPoint', type: 'PointLight', uniform: 'pointLights', info: 'getPointLightInfo' },
  { count: 'NUM_SPOT_LIGHTS', varying: 'vVertexSpot', type: 'SpotLight', uniform: 'spotLights', info: 'getSpotLightInfo' },
] as const;

// Two scalar irradiances per light preserve independent shadow/cookie masks,
// without spending a vec3 varying on each light colour or doing light falloff
// and N dot L per pixel. Both faces are needed by foliage and other two-sided art.
const varyings = `
varying vec3 vVertexAmbientFront;
varying vec3 vVertexAmbientBack;
${lightKinds.map(light => `
#if ${light.count} > 0
varying vec2 ${light.varying}[ ${light.count} ];
#endif`).join('\n')}
`;

const vertexLights = `
vec3 vertexLightNormal = normalize( transformedNormal );
vVertexAmbientFront = getAmbientLightIrradiance( ambientLightColor );
vVertexAmbientBack = vVertexAmbientFront;
#ifdef USE_LIGHT_PROBES
vVertexAmbientFront += getLightProbeIrradiance( lightProbe, vertexLightNormal );
vVertexAmbientBack += getLightProbeIrradiance( lightProbe, -vertexLightNormal );
#endif
#if NUM_HEMI_LIGHTS > 0
for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
  vVertexAmbientFront += getHemisphereLightIrradiance( hemisphereLights[ i ], vertexLightNormal );
  vVertexAmbientBack += getHemisphereLightIrradiance( hemisphereLights[ i ], -vertexLightNormal );
}
#endif
${lightKinds.map(light => `
#if ${light.count} > 0
for ( int i = 0; i < ${light.count}; i ++ ) {
  ${light.type} vertexSource = ${light.uniform}[ i ];
  vertexSource.color = vec3( 1.0 );
  IncidentLight vertexLight;
  ${light.info}( vertexSource, ${light.count === 'NUM_DIR_LIGHTS' ? '' : 'mvPosition.xyz, '}vertexLight );
  float vertexDot = dot( vertexLightNormal, vertexLight.direction );
  ${light.varying}[ i ] = max( vec2( vertexDot, -vertexDot ), vec2( 0.0 ) ) * vertexLight.color.r;
}
#endif`).join('\n')}
`;

function fragmentLights(): string {
  let source = THREE.ShaderChunk.lights_fragment_begin;
  for (const light of lightKinds) {
    const variable = light.type[0].toLowerCase() + light.type.slice(1);
    const call = `${light.info}( ${variable}, ${light.count === 'NUM_DIR_LIGHTS' ? '' : 'geometryPosition, '}directLight );`;
    source = source.replace(call, `
      directLight.color = ${variable}.color * ( vertexFrontFace ? ${light.varying}[ i ].x : ${light.varying}[ i ].y );
      directLight.visible = any( greaterThan( directLight.color, vec3( 0.0 ) ) );
    `);
  }
  source = source.split(
    'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );',
  ).join('reflectedLight.directDiffuse += directLight.color * BRDF_Lambert( material.diffuseColor );');
  // Keep lightmaps and the material's existing environment/reflection path in
  // lights_fragment_maps/end. Only scene-light illumination becomes Gouraud.
  const ambientStart = source.indexOf('vec3 irradiance = getAmbientLightIrradiance');
  const ambientEnd = source.indexOf('#if defined( RE_IndirectSpecular )', ambientStart);
  source = source.slice(0, ambientStart) + `
    vec3 irradiance = vertexFrontFace ? vVertexAmbientFront : vVertexAmbientBack;
    #endif
  ` + source.slice(ambientEnd);
  return `
    bool vertexFrontFace = true;
    #ifdef DOUBLE_SIDED
    vertexFrontFace = gl_FrontFacing;
    #endif
  ` + source;
}

const fragmentLightChunk = fragmentLights();
const normalChunk = THREE.ShaderChunk.beginnormal_vertex.replace('vec3( normal )', 'vec3( vertexLightingNormal )');
const geometryNormals = new WeakMap<THREE.BufferGeometry, {
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
  positionVersion: number;
  index: THREE.BufferAttribute | null;
  indexVersion: number;
  normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
}>();

function prepareNormals(geometry: THREE.BufferGeometry): void {
  const normal = geometry.getAttribute('normal');
  if (normal) {
    if (geometry.getAttribute('vertexLightingNormal') !== normal) geometry.setAttribute('vertexLightingNormal', normal);
    return;
  }
  // Flat imported/elastic character parts deliberately omit normal attributes.
  // A separate lighting-only attribute leaves their authored topology and
  // derivative shading/shadow bias untouched when this debug mode is off.
  const position = geometry.getAttribute('position');
  if (!position) return;
  const positionVersion = 'version' in position ? position.version : position.data.version;
  const indexVersion = geometry.index?.version ?? -1;
  const cached = geometryNormals.get(geometry);
  if (cached?.position === position && cached.positionVersion === positionVersion && cached.index === geometry.index && cached.indexVersion === indexVersion) return;
  const scratch = new THREE.BufferGeometry();
  scratch.setAttribute('position', position);
  scratch.setIndex(geometry.index);
  const previous = cached?.normal;
  if (previous?.count === position.count) scratch.setAttribute('normal', previous);
  scratch.computeVertexNormals();
  geometry.setAttribute('vertexLightingNormal', scratch.getAttribute('normal'));
  geometryNormals.set(geometry, { position, positionVersion, index: geometry.index, indexVersion, normal: scratch.getAttribute('normal') });
}

/** Classic diffuse Gouraud treatment; authored maps, emissive, fog, shadows
 * and environment reflections keep their original material pipeline. */
export function applyVertexLighting(shader: Shader): void {
  if (shader.vertexShader.includes('vVertexAmbientFront')) return;
  if (!shader.fragmentShader.includes('#include <lights_fragment_begin>')) return;
  shader.vertexShader = shader.vertexShader
    .replace('#include <common>', '#include <common>\n#include <lights_pars_begin>\nattribute vec3 vertexLightingNormal;\n' + varyings)
    .replace('#include <beginnormal_vertex>', normalChunk)
    .replace('#include <fog_vertex>', '#include <fog_vertex>\n' + vertexLights);
  shader.fragmentShader = varyings + shader.fragmentShader.replace('#include <lights_fragment_begin>', fragmentLightChunk);
}

function isLit(material: THREE.Material): boolean {
  const lit = material as THREE.MeshLambertMaterial & THREE.MeshPhongMaterial & THREE.MeshStandardMaterial;
  return !!(lit.isMeshLambertMaterial || lit.isMeshPhongMaterial || lit.isMeshStandardMaterial);
}

/** The renderer's draw entry also covers streamed meshes, material arrays,
 * skinned/instanced characters, secondary views and reflection captures. */
export class GlobalVertexLighting {
  private readonly bindings = new Map<THREE.Material, Binding>();
  private readonly originalDraw: THREE.WebGLRenderer['renderBufferDirect'];
  private readonly draw: THREE.WebGLRenderer['renderBufferDirect'];
  private readonly originalRender: THREE.WebGLRenderer['render'];
  private readonly render: THREE.WebGLRenderer['render'];
  private readonly unsubscribe: () => void;

  constructor(private readonly renderer: THREE.WebGLRenderer, private readonly settings: VertexLightingSettings = vertexLightingSettings) {
    this.originalDraw = renderer.renderBufferDirect;
    this.originalRender = renderer.render;
    this.render = (scene, camera) => {
      // Attributes must exist BEFORE Three uploads geometry and builds VAOs.
      // Preparing them in renderBufferDirect is one frame too late for new
      // normal-free meshes. The disabled path does not walk the scene.
      if (this.settings.enabled) scene.traverseVisible(object => {
        const mesh = object as THREE.Mesh;
        if (!mesh.isMesh) return;
        const lit = Array.isArray(mesh.material) ? mesh.material.some(isLit) : isLit(mesh.material);
        if (lit) prepareNormals(mesh.geometry);
      });
      this.originalRender.call(renderer, scene, camera);
    };
    renderer.render = this.render;
    this.draw = (camera, scene, geometry, material, object, group) => {
      if (this.settings.enabled && isLit(material)) this.bind(material);
      this.originalDraw.call(renderer, camera, scene, geometry, material, object, group);
    };
    renderer.renderBufferDirect = this.draw;
    this.unsubscribe = settings.subscribe(enabled => { if (!enabled) this.restore(); });
  }

  get diagnostics(): { enabled: boolean; materials: number } {
    return { enabled: this.settings.enabled, materials: this.bindings.size };
  }

  dispose(): void {
    this.unsubscribe();
    this.restore();
    if (this.renderer.renderBufferDirect === this.draw) this.renderer.renderBufferDirect = this.originalDraw;
    if (this.renderer.render === this.render) this.renderer.render = this.originalRender;
  }

  private bind(material: THREE.Material): void {
    const existing = this.bindings.get(material);
    if (existing?.wrappedCompile === material.onBeforeCompile && existing.wrappedKey === material.customProgramCacheKey) return;
    // An authoring effect may install a new hook after a material first draws.
    // Chain that hook too; applyVertexLighting is idempotent for copied hooks.
    if (existing) material.removeEventListener('dispose', existing.dispose);
    const compile = material.onBeforeCompile;
    const key = material.customProgramCacheKey;
    const settings = this.settings;
    const wrappedCompile: THREE.Material['onBeforeCompile'] = function(this: THREE.Material, shader, renderer) {
      compile.call(this, shader, renderer);
      if (settings.enabled) applyVertexLighting(shader);
    };
    const wrappedKey = function(this: THREE.Material): string {
      const original = key === THREE.Material.prototype.customProgramCacheKey ? compile.toString() : key.call(this);
      return original + (settings.enabled ? '|global-vertex-diffuse-v1' : '');
    };
    const dispose = () => { this.release(material); };
    this.bindings.set(material, { compile, key, wrappedCompile, wrappedKey, dispose });
    material.onBeforeCompile = wrappedCompile;
    material.customProgramCacheKey = wrappedKey;
    material.addEventListener('dispose', dispose);
    material.needsUpdate = true;
  }

  private release(material: THREE.Material): void {
    const binding = this.bindings.get(material);
    if (!binding) return;
    if (material.onBeforeCompile === binding.wrappedCompile) material.onBeforeCompile = binding.compile;
    if (material.customProgramCacheKey === binding.wrappedKey) material.customProgramCacheKey = binding.key;
    material.removeEventListener('dispose', binding.dispose);
    this.bindings.delete(material);
    material.needsUpdate = true;
  }

  private restore(): void {
    for (const material of this.bindings.keys()) this.release(material);
  }
}
