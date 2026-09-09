import * as THREE from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const MILK_SIZE = 0.7;
export const MILK_VARIANTS = ['Drip', 'Hook', 'Leaning drop', 'Teardrop', 'Swoosh', 'Soft splash'] as const;
const clock = { value: 0 };

const deformation = /* glsl */ `
uniform float milkTime;
attribute float milkSeed;
vec3 milkStretch() {
  float wave = sin(milkTime * 1.65 + milkSeed);
  return vec3(1.0 + 0.025 * wave, 1.0 - 0.025 * wave,
    1.0 + 0.018 * sin(milkTime * 1.3 + milkSeed + 1.4));
}
`;
const optics = /* glsl */ `
vec3 n = normalize(vMilkNormal);
vec3 eye = normalize(vMilkEye);
float wrap = clamp((dot(n, normalize(vec3(-0.45, 0.65, 0.6))) + 0.55) / 1.55, 0.0, 1.0);
float edge = pow(1.0 - max(dot(n, eye), 0.0), 3.0);
// Opaque milk: cool body shadows, warm cream in the light, no glass centre.
vec3 body = mix(vec3(0.48, 0.59, 0.66), vec3(0.96, 0.94, 0.87), wrap);
vec3 reflection = reflect(-eye, n);
float key = max(dot(reflection, normalize(vec3(-0.48, 0.65, 0.65))), 0.0);
float fill = max(dot(reflection, normalize(vec3(0.8, 0.15, 0.6))), 0.0);
float wet = 0.28 * pow(key, 10.0) + 0.52 * pow(key, 48.0) + 0.16 * pow(fill, 22.0);
vec3 outgoingLight = body * diffuseColor.rgb + vec3(wet) + vec3(0.11, 0.13, 0.14) * edge;
`;

/** Texture-free creamy body and broad wet reflections; native fog/fades retained. */
export class MilkMaterial extends THREE.MeshBasicMaterial {
  constructor() {
    super({ color: 0xffffff, toneMapped: false });
    this.name = 'opaque milk';
    this.onBeforeCompile = shader => {
      shader.uniforms.milkTime = clock;
      shader.vertexShader = deformation + 'varying vec3 vMilkNormal;\nvarying vec3 vMilkEye;\n' + shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= milkStretch();')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvMilkNormal = normalMatrix * (normal / milkStretch());\nvMilkEye = -mvPosition.xyz;');
      shader.fragmentShader = 'varying vec3 vMilkNormal;\nvarying vec3 vMilkEye;\n' + shader.fragmentShader
        .replace('vec3 outgoingLight = reflectedLight.indirectDiffuse;', optics);
    };
  }
  customProgramCacheKey(): string { return 'milk-opaque-v1'; }
}

/** Closed, smooth radial surfaces, normalized inside a one-unit pickup envelope. */
export function buildMilkGeometry(variant: number): THREE.BufferGeometry {
  const id = ((Math.trunc(variant) % MILK_VARIANTS.length) + MILK_VARIANTS.length) % MILK_VARIANTS.length;
  const sphere = new THREE.SphereGeometry(1, 32, 24);
  sphere.deleteAttribute('normal'); sphere.deleteAttribute('uv');
  const geometry = mergeVertices(sphere); sphere.dispose();
  const position = geometry.getAttribute('position');
  // A rounded reservoir pulled into a narrow, curved liquid tip. Ellipsoid
  // stretching alone reads as an egg; the neck and pointed tail must be part
  // of the surface itself, with a broad lower bulb and asymmetric shoulders.
  const profiles = [
    [1, .58, .18, .05], [.94, .72, .72, .08], [1.08, .45, -.55, .16],
    [.9, .83, .04, -.04], [1.18, .38, .92, -.18], [1.12, .56, -.38, .32],
  ];
  const [width, length, bend, twist] = profiles[id];
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const upper = Math.max(0, y), neck = upper * upper * (3 - 2 * upper);
    const lobe = 1 + .055 * Math.sin(x * 4 + id) * Math.sin(z * 3 + y * 2);
    const shoulder = (1 - .79 * neck) * (1 + .12 * Math.max(0, -y));
    const splash = id === 5 ? 1 + .11 * Math.sin(Math.atan2(z, x) * 3) * (1 - y * y) : 1;
    position.setXYZ(i,
      x * shoulder * width * lobe * splash + bend * upper * upper,
      y + length * upper * upper * upper,
      z * shoulder * .94 * lobe * splash + twist * upper * upper);
  }
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!, center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
  geometry.translate(-center.x, -center.y, -center.z);
  // Leave room for shader stretch so even the wobble fits the pickup envelope.
  const scale = .97 / Math.max(size.x, size.y, size.z);
  geometry.scale(scale, scale, scale); geometry.computeVertexNormals();
  geometry.setAttribute('milkSeed', new THREE.Float32BufferAttribute(new Array(position.count).fill(id * 1.713), 1));
  geometry.computeBoundingBox(); geometry.boundingBox!.expandByScalar(.016);
  geometry.computeBoundingSphere(); geometry.boundingSphere!.radius *= 1.03;
  geometry.name = `milk ${MILK_VARIANTS[id]}`;
  geometry.userData.shared = true;
  return geometry;
}

const shapes = MILK_VARIANTS.map((_, i) => buildMilkGeometry(i));
const material = new MilkMaterial(); material.userData.shared = true;
const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
depth.userData.shared = true;
depth.onBeforeCompile = shader => {
  shader.uniforms.milkTime = clock;
  shader.vertexShader = deformation + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= milkStretch();');
};
depth.customProgramCacheKey = () => 'milk-depth-v1';
let nextVariant = 0;

export function setMilkVariant(root: THREE.Object3D, variant: number): void {
  const id = ((Math.trunc(variant) % shapes.length) + shapes.length) % shapes.length;
  root.traverse(object => {
    if (object instanceof THREE.Mesh && object.userData.milkBlob) object.geometry = shapes[id];
  });
  root.userData.milkVariant = id;
}

/** One shared-geometry blob; spin/bob the group using the existing pickup motion. */
export function milkBlob(size = 1, variant = nextVariant++): THREE.Group {
  const group = new THREE.Group(), mesh = new THREE.Mesh(shapes[0], material);
  mesh.userData.milkBlob = true;
  mesh.castShadow = true; mesh.receiveShadow = false;
  mesh.customDepthMaterial = depth;
  mesh.onBeforeRender = () => { clock.value = performance.now() * .001; };
  mesh.onBeforeShadow = mesh.onBeforeRender;
  group.add(mesh); group.scale.setScalar(size);
  setMilkVariant(group, variant);
  group.name = 'hovering milk';
  return group;
}
