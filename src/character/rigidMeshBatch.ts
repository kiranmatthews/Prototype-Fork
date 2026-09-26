import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// 24 * (mat4 + mat3 + vec2) leaves room for the ordinary material uniforms
// even on the WebGL 2 minimum of 256 vertex uniform vectors.
const MAX_PARTS = 24;
const DEFAULT_COMPILE = THREE.Material.prototype.onBeforeCompile;
const DEFAULT_RENDER = THREE.Object3D.prototype.onBeforeRender;
const DEFAULT_SHADOW = THREE.Object3D.prototype.onBeforeShadow;
const DEFAULT_MATERIAL_RENDER = THREE.Material.prototype.onBeforeRender;
const LIVE_COLOR_FIELDS = ['color', 'emissive'] as const;
const LIVE_MATERIAL_FIELDS = new Set(['color', 'emissive', 'opacity', 'visible']);
const MATERIAL_METADATA = new Set(['id', 'uuid', 'name', 'userData', '_listeners', 'version']);

type Attribute = THREE.BufferAttribute | THREE.InterleavedBufferAttribute;
interface AttributeState {
  readonly attribute: Attribute;
  readonly array: ArrayLike<number>;
  readonly version: number;
  readonly count: number;
  readonly itemSize: number;
  readonly normalized: boolean;
  readonly offset: number;
  readonly stride: number;
}
interface GeometryState {
  readonly geometry: THREE.BufferGeometry;
  readonly attributes: ReadonlyArray<{ name: string; state: AttributeState }>;
  readonly morphs: ReadonlyArray<{ name: string; attributes: readonly Attribute[]; states: readonly AttributeState[] }>;
  readonly index: AttributeState | null;
  readonly relative: boolean;
  readonly drawStart: number;
  readonly drawCount: number;
  valid: boolean;
}
interface MaterialField {
  readonly owner: Record<string, unknown>;
  readonly key: string;
  readonly value: unknown;
}
interface MaterialState {
  readonly fields: readonly MaterialField[];
  readonly shapes: ReadonlyArray<{ object: Record<string, unknown>; count: number }>;
}

function attributeVersion(attribute: Attribute): number {
  return 'version' in attribute ? attribute.version : attribute.data.version;
}

function attributeState(attribute: Attribute): AttributeState {
  return {
    attribute, array: attribute.array, version: attributeVersion(attribute), count: attribute.count,
    itemSize: attribute.itemSize, normalized: attribute.normalized,
    offset: 'offset' in attribute ? attribute.offset : 0,
    stride: 'data' in attribute ? attribute.data.stride : 0,
  };
}

function attributeMatches(attribute: Attribute | undefined | null, state: AttributeState): boolean {
  return attribute === state.attribute && attribute.array === state.array &&
    attributeVersion(attribute) === state.version && attribute.count === state.count &&
    attribute.itemSize === state.itemSize && attribute.normalized === state.normalized &&
    ('offset' in attribute ? attribute.offset : 0) === state.offset &&
    ('data' in attribute ? attribute.data.stride : 0) === state.stride;
}

function geometryState(geometry: THREE.BufferGeometry): GeometryState {
  return {
    geometry, valid: true,
    attributes: Object.entries(geometry.attributes).map(([name, attribute]) => ({ name, state: attributeState(attribute) })),
    morphs: Object.entries(geometry.morphAttributes).map(([name, attributes]) => ({
      name, attributes, states: attributes.map(attributeState),
    })),
    index: geometry.index ? attributeState(geometry.index) : null,
    relative: geometry.morphTargetsRelative,
    drawStart: geometry.drawRange.start, drawCount: geometry.drawRange.count,
  };
}

function geometryMatches(state: GeometryState): boolean {
  const geometry = state.geometry;
  if (geometry.morphTargetsRelative !== state.relative || geometry.drawRange.start !== state.drawStart ||
      geometry.drawRange.count !== state.drawCount ||
      (state.index ? !attributeMatches(geometry.index, state.index) : geometry.index !== null)) return false;
  let attributeCount = 0, morphCount = 0;
  // for-in avoids allocating Object.keys arrays in the per-frame audit.
  for (const _name in geometry.attributes) attributeCount++;
  if (attributeCount !== state.attributes.length) return false;
  for (const entry of state.attributes) if (!attributeMatches(geometry.attributes[entry.name], entry.state)) return false;
  for (const _name in geometry.morphAttributes) morphCount++;
  if (morphCount !== state.morphs.length) return false;
  const morphs = geometry.morphAttributes as Record<string, Attribute[]>;
  for (const entry of state.morphs) {
    const attributes = morphs[entry.name];
    if (attributes !== entry.attributes || attributes.length !== entry.states.length) return false;
    for (let i = 0; i < entry.states.length; i++) if (!attributeMatches(attributes[i], entry.states[i])) return false;
  }
  return true;
}

/** Snapshot unsupported mutable rendering state once. Scalars, vectors,
 * Euler angles, clipping planes, numeric arrays and shader defines can change
 * without material.version. Textures are shared by source/clone, so their
 * contents stay live; replacing a texture still changes its captured reference. */
function materialState(material: THREE.Material): MaterialState {
  const fields: MaterialField[] = [];
  const shapes: Array<{ object: Record<string, unknown>; count: number }> = [];
  const capture = (owner: Record<string, unknown>, key: string, depth: number): void => {
    const value = owner[key];
    fields.push({ owner, key, value });
    if (!value || typeof value !== 'object' || value instanceof THREE.Texture || depth > 3) return;
    const object = value as Record<string, unknown>;
    if (Array.isArray(value)) fields.push({ owner: object, key: 'length', value: value.length });
    const keys = Object.keys(object);
    shapes.push({ object, count: keys.length });
    for (const nested of keys) capture(object, nested, depth + 1);
  };
  const source = material as unknown as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!LIVE_MATERIAL_FIELDS.has(key) && !MATERIAL_METADATA.has(key)) capture(source, key, 0);
  }
  capture(source, 'customProgramCacheKey', 0);
  return { fields, shapes };
}

function materialMatches(state: MaterialState): boolean {
  for (const field of state.fields) if (field.owner[field.key] !== field.value) return false;
  for (const shape of state.shapes) {
    let count = 0;
    for (const key in shape.object) if (Object.prototype.hasOwnProperty.call(shape.object, key)) count++;
    if (count !== shape.count) return false;
  }
  return true;
}

interface Part {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  readonly geometryState: GeometryState;
  readonly layers: number;
  readonly mirrored: boolean;
}

interface Batch {
  readonly mesh: THREE.Mesh;
  readonly sourceMaterial: THREE.Material;
  readonly materialVersion: number;
  readonly materialState: MaterialState;
  readonly parts: Part[];
  readonly matrices: THREE.Matrix4[];
  readonly normals: THREE.Matrix3[];
  readonly state: THREE.Vector2[];
  readonly inverse: THREE.Matrix4;
  valid: boolean;
}

function affine(matrix: THREE.Matrix4): boolean {
  const elements = matrix.elements;
  // The palette stores xyz after its transform, with an implicit w of 1.
  // Ordinary TRS/shear composition retains this bottom row exactly. A custom
  // projective matrix must keep its original homogeneous rendering path.
  return elements[3] === 0 && elements[7] === 0 && elements[11] === 0 && elements[15] === 1;
}

function supported(mesh: THREE.Mesh): boolean {
  const material = mesh.material;
  const geometry = mesh.geometry;
  return !(mesh instanceof THREE.SkinnedMesh || mesh instanceof THREE.InstancedMesh) &&
    !Array.isArray(material) && !material.transparent && material.side === THREE.FrontSide &&
    // RawShaderMaterial inherits ShaderMaterial; neither promises the chunks
    // that this standard-material vertex patch uses.
    !(material instanceof THREE.ShaderMaterial) && affine(mesh.matrixWorld) &&
    material.onBeforeCompile === DEFAULT_COMPILE &&
    material.onBeforeRender === DEFAULT_MATERIAL_RENDER &&
    mesh.onBeforeRender === DEFAULT_RENDER && mesh.onBeforeShadow === DEFAULT_SHADOW &&
    !mesh.customDepthMaterial && !mesh.customDistanceMaterial &&
    geometry.drawRange.start === 0 && geometry.drawRange.count === Infinity &&
    !!geometry.getAttribute('position') &&
    (!!geometry.getAttribute('normal') || (material as THREE.MeshStandardMaterial).flatShading === true) &&
    (geometry.morphAttributes.position?.length ?? 0) <= 1 &&
    !(geometry.morphAttributes.normal?.length) && !(geometry.morphAttributes.color?.length);
}

function partGeometry(part: Part, index: number): THREE.BufferGeometry {
  const original = part.geometry;
  // Only the render copy gets palette attributes and reversed triangle
  // winding. Contact solvers and authoring retain their exact source geometry.
  const geometry = original.clone();
  // Flat imported bones intentionally have no normal attribute. Inventing
  // normals here changes their existing shadow-normal bias behavior.
  const position = original.getAttribute('position');
  const morph = original.morphAttributes.position?.[0];
  const delta = new Float32Array(position.count * 3);
  if (morph) {
    for (let vertex = 0; vertex < position.count; vertex++) {
      for (let axis = 0; axis < 3; axis++) {
        delta[vertex * 3 + axis] = morph.getComponent(vertex, axis) -
          (original.morphTargetsRelative ? 0 : position.getComponent(vertex, axis));
      }
    }
  }
  geometry.morphAttributes = {};
  geometry.morphTargetsRelative = false;
  geometry.clearGroups();
  geometry.setAttribute('rigidPart', new THREE.Float32BufferAttribute(new Float32Array(position.count).fill(index), 1));
  geometry.setAttribute('rigidMorphDelta', new THREE.Float32BufferAttribute(delta, 3));
  if (!geometry.index) geometry.setIndex(Array.from({ length: position.count }, (_, i) => i));
  if (part.mirrored) {
    const indices = geometry.index!;
    for (let i = 0; i < indices.count; i += 3) {
      const second = indices.getX(i + 1);
      indices.setX(i + 1, indices.getX(i + 2));
      indices.setX(i + 2, second);
    }
  }
  return geometry;
}

function patchMaterial(material: THREE.Material, batch: Batch): void {
  const count = batch.parts.length;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.rigidMatrices = { value: batch.matrices };
    shader.uniforms.rigidNormals = { value: batch.normals };
    shader.uniforms.rigidState = { value: batch.state };
    shader.vertexShader = `
      attribute float rigidPart;
      attribute vec3 rigidMorphDelta;
      uniform mat4 rigidMatrices[${count}];
      uniform mat3 rigidNormals[${count}];
      uniform vec2 rigidState[${count}];
    ` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <beginnormal_vertex>', `
      #include <beginnormal_vertex>
      objectNormal = rigidNormals[int(rigidPart)] * objectNormal;
      #ifdef USE_TANGENT
        objectTangent = mat3(rigidMatrices[int(rigidPart)]) * objectTangent;
      #endif
    `).replace('#include <begin_vertex>', `
      vec3 transformed = (rigidMatrices[int(rigidPart)] * vec4(
        position + rigidMorphDelta * rigidState[int(rigidPart)].x, 1.0)).xyz;
      // Collapse hidden parts to a degenerate point in both colour and shadow
      // passes. The visible flag on the authored mesh is never commandeered.
      if (rigidState[int(rigidPart)].y < 0.5) transformed = vec3(0.0);
    `);
  };
  material.customProgramCacheKey = () => `character-rigid-palette-v1:${count}`;
}

/**
 * One draw per material for small rigid character surfaces. These are GPU
 * render proxies, deliberately outside the rider's measured hierarchy. The
 * original meshes still own transforms, morphs, names, visibility and bounds.
 *
 * An affine palette preserves shear from nonuniform parent scales. Mirrored
 * parts reverse their copied index winding, retaining ordinary front-face
 * culling without double-sided shading. No skeleton or physics is modified.
 */
export class CharacterRigidMeshBatches {
  readonly root = new THREE.Group();
  private readonly batches: Batch[] = [];
  private readonly geometryStates = new Map<THREE.BufferGeometry, GeometryState>();
  private readonly geometryChecks: GeometryState[] = [];
  private enabled = true;
  private disposed = false;

  constructor(private readonly host: THREE.Object3D, sources: readonly THREE.Mesh[]) {
    this.root.name = 'character-rigid-render-batches';
    this.root.userData.characterRenderProxy = true;
    host.updateWorldMatrix(true, true);
    const hostAffine = affine(host.matrixWorld);
    const groups = new Map<string, THREE.Mesh[]>();
    for (const mesh of sources) {
      if (!hostAffine || !supported(mesh)) continue;
      const layout = Object.keys(mesh.geometry.attributes).sort().map((name) => {
        const attribute = mesh.geometry.getAttribute(name);
        return `${name}:${attribute.itemSize}:${attribute.normalized}:${attribute.array.constructor.name}`;
      }).join(',');
      const key = `${(mesh.material as THREE.Material).uuid}:${mesh.layers.mask}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${layout}`;
      const group = groups.get(key);
      if (group) group.push(mesh); else groups.set(key, [mesh]);
    }
    for (const meshes of groups.values()) {
      for (let start = 0; start < meshes.length; start += MAX_PARTS) {
        const members = meshes.slice(start, start + MAX_PARTS);
        if (members.length > 1) this.createBatch(members);
      }
    }
    host.add(this.root);
    // Validate while world matrices are current, before Three collects either
    // render list. Uniform matrices update only when a batch is actually drawn.
    this.root.updateMatrixWorld = (force?: boolean) => {
      THREE.Group.prototype.updateMatrixWorld.call(this.root, force);
      this.validate();
    };
  }

  get diagnostics(): { enabled: boolean; sources: number; batches: number; savedDrawsPerPass: number } {
    const active = this.batches.filter((batch) => batch.valid);
    const sources = active.reduce((sum, batch) => sum + batch.parts.length, 0);
    return { enabled: this.enabled, sources, batches: active.length, savedDrawsPerPass: sources - active.length };
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.enabled = enabled;
    for (const batch of this.batches) {
      batch.mesh.visible = enabled && batch.valid;
      if (batch.valid) for (const part of batch.parts) part.mesh.layers.mask = enabled ? 0 : part.layers;
    }
  }

  /** Release only owned render copies and restore every original draw layer. */
  dispose(): void {
    if (this.disposed) return;
    this.setEnabled(false);
    this.disposed = true;
    this.root.removeFromParent();
    for (const batch of this.batches) {
      batch.mesh.geometry.dispose();
      (batch.mesh.material as THREE.Material).dispose();
      batch.mesh.customDepthMaterial?.dispose();
      batch.mesh.customDistanceMaterial?.dispose();
    }
    this.batches.length = 0;
    this.geometryStates.clear();
    this.geometryChecks.length = 0;
  }

  private createBatch(sources: THREE.Mesh[]): void {
    const reference = sources[0];
    const sourceMaterial = reference.material as THREE.Material;
    const parts = sources.map((mesh): Part => {
      let state = this.geometryStates.get(mesh.geometry);
      if (!state) {
        state = geometryState(mesh.geometry);
        this.geometryStates.set(mesh.geometry, state);
        this.geometryChecks.push(state);
      }
      return {
        mesh, geometry: mesh.geometry, geometryState: state, layers: mesh.layers.mask,
        mirrored: mesh.matrixWorld.determinant() * this.host.matrixWorld.determinant() < 0,
      };
    });
    const geometries = parts.map(partGeometry);
    const geometry = mergeGeometries(geometries, false);
    for (const part of geometries) part.dispose();
    if (!geometry) return;
    geometry.name = `character-rigid-palette-${sourceMaterial.name || sourceMaterial.type}`;
    // Generic Box3.setFromObject authoring/frame helpers already measure the
    // original meshes. Palette-space vertices must not add fictitious bounds.
    geometry.boundingBox = new THREE.Box3();
    const material = sourceMaterial.clone();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = geometry.name;
    mesh.castShadow = reference.castShadow;
    mesh.receiveShadow = reference.receiveShadow;
    mesh.layers.mask = reference.layers.mask;
    mesh.renderOrder = reference.renderOrder;
    // The source geometry is in per-part coordinates until the vertex shader
    // applies its live palette. Three's ordinary sphere cannot bound that.
    mesh.frustumCulled = false;
    mesh.userData.characterRenderProxy = true;
    const batch: Batch = {
      mesh, sourceMaterial, materialVersion: sourceMaterial.version, parts, valid: true,
      materialState: materialState(sourceMaterial),
      matrices: parts.map(() => new THREE.Matrix4()),
      normals: parts.map(() => new THREE.Matrix3()),
      state: parts.map(() => new THREE.Vector2()),
      inverse: new THREE.Matrix4(),
    };
    patchMaterial(material, batch);
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    mesh.customDistanceMaterial = new THREE.MeshDistanceMaterial();
    patchMaterial(mesh.customDepthMaterial, batch);
    patchMaterial(mesh.customDistanceMaterial, batch);
    mesh.onBeforeRender = () => this.sync(batch);
    mesh.onBeforeShadow = () => this.sync(batch);
    this.root.add(mesh);
    this.batches.push(batch);
    for (const part of parts) part.mesh.layers.mask = 0;
  }

  private validate(): void {
    if (!this.enabled || this.disposed) return;
    const hostSign = this.host.matrixWorld.determinant();
    const hostAffine = affine(this.host.matrixWorld);
    // Shared footwear/limb geometry is audited once, not once per occurrence.
    for (const state of this.geometryChecks) if (state.valid) state.valid = geometryMatches(state);
    for (const batch of this.batches) {
      if (!batch.valid) continue;
      const reference = batch.mesh;
      (reference.material as THREE.Material).visible = batch.sourceMaterial.visible;
      const materialValid = batch.sourceMaterial.version === batch.materialVersion && materialMatches(batch.materialState);
      for (const part of batch.parts) {
        const source = part.mesh;
        if (source.geometry !== part.geometry || source.material !== batch.sourceMaterial ||
            !part.geometryState.valid || !materialValid || !hostAffine ||
            !supported(source) || source.castShadow !== reference.castShadow ||
            source.receiveShadow !== reference.receiveShadow || source.renderOrder !== reference.renderOrder ||
            source.layers.mask !== 0 ||
            (source.matrixWorld.determinant() * hostSign < 0) !== part.mirrored) {
          // Authoring may replace a surface or change its winding. Fall back
          // before render-list collection rather than displaying a stale proxy.
          batch.valid = false;
          reference.visible = false;
          for (const original of batch.parts) {
            if (original.mesh.layers.mask === 0) original.mesh.layers.mask = original.layers;
          }
          break;
        }
      }
    }
  }

  private sync(batch: Batch): void {
    batch.inverse.copy(batch.mesh.matrixWorld).invert();
    const material = batch.mesh.material as THREE.Material;
    // Colour objects remain live for debug/material edits without recopying
    // large material state or allocating during animation.
    for (const key of LIVE_COLOR_FIELDS) {
      const target = material as THREE.MeshLambertMaterial;
      const source = batch.sourceMaterial as THREE.MeshLambertMaterial;
      if (source[key]) target[key].copy(source[key]);
    }
    material.opacity = batch.sourceMaterial.opacity;
    material.visible = batch.sourceMaterial.visible;
    for (let i = 0; i < batch.parts.length; i++) {
      const source = batch.parts[i].mesh;
      batch.matrices[i].multiplyMatrices(batch.inverse, source.matrixWorld);
      batch.normals[i].getNormalMatrix(batch.matrices[i]);
      let visible = source.visible;
      let ancestor = source.parent;
      while (visible && ancestor && ancestor !== this.host) {
        visible = ancestor.visible;
        ancestor = ancestor.parent;
      }
      batch.state[i].set(source.morphTargetInfluences?.[0] ?? 0, visible && ancestor === this.host ? 1 : 0);
    }
  }
}
