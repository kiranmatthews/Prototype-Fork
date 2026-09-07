import * as THREE from "three";

// Independent low-cost approximation, not Naughty Dog's undocumented shader.
// Directional lighting stays vertex-side; an affine face-space strip supplies
// the glint envelope without making triangulation visible inside a cut.
export const COLLECTIBLE_SPECULAR_VERTEX = /* glsl */ `
uniform vec3 diffuse;
attribute vec3 aFacetNormal;
attribute vec3 aFaceTangent;
attribute vec2 aFaceUv;
attribute float aEdgeDistance;
varying vec3 vCollectibleLight;
varying vec4 vCollectibleSweep;
varying vec2 vCollectibleUv;
varying float vCollectibleEdge;
varying float vCollectibleEdgeDistance;
float power8(float x) { x *= x; x *= x; return x * x; }
float power16(float x) { x = power8(x); return x * x; }
float power64(float x) { x = power16(x); x *= x; return x * x; }
void lightCollectible() {
  vec3 n = normalize(normalMatrix * aFacetNormal);
  vec3 tangent = normalize(mat3(modelViewMatrix) * aFaceTangent);
  float broad = max(dot(n, vec3(-0.36, 0.48, 0.8)), 0.0);
  float rim = max(dot(n, vec3(0.8, -0.36, 0.48)), 0.0);
  vCollectibleUv = aFaceUv;
  vCollectibleEdgeDistance = aEdgeDistance;
  #if COLLECTIBLE_CRYSTAL
    vec2 radial = n.xz * inversesqrt(max(dot(n.xz, n.xz), 0.0001));
    vec2 side = tangent.xz * inversesqrt(max(dot(tangent.xz, tangent.xz), 0.0001));
    vec2 key = normalize(vec2(-0.325, 0.946));
    float facing = max(dot(radial, key), 0.0);
    float longFace = aFacetNormal.y < 0.0 ? 1.0 : 0.11;
    vCollectibleSweep = vec4(0.5 - dot(side, key) * 3.2,
      0.055 + power16(facing) * 0.80, power8(facing) * longFace * 2.3, 1.0);
    float bodyFacing = max(dot(n, normalize(vec3(-0.38, -0.24, 0.893))), 0.0);
    float cutGain = aFacetNormal.y < 0.0 ? 1.0 : 0.65;
    vCollectibleLight = (diffuse * (0.025 + bodyFacing * 1.06)
      + vec3(0.78, 0.65, 1.0) * power8(max(n.z, 0.0)) * 0.35)
      * mix(0.88, 1.08, aFaceUv.y) * cutGain;
    // The recording has a separate lower-edge sliver between broad flashes.
    // Its direction is distinct; it does not bloom from the face centre.
    float edgeFacing = max(dot(radial, normalize(vec2(0.65, 0.76))), 0.0);
    vCollectibleEdge = aFacetNormal.y < 0.0 && aFacetNormal.y > -0.99
      ? power16(edgeFacing) * 2.8 : 0.0;
  #else
    vec3 key = normalize(vec3(-0.06, 0.47, 0.88));
    float facing = max(dot(n, key), 0.0);
    vCollectibleSweep = vec4(0.5 - dot(tangent, key),
      0.9 + power16(facing) * 0.4, power16(facing) * 2.4, 0.0);
    float lowerFill = max(dot(n, normalize(vec3(-0.3, -0.8, 0.52))), 0.0);
    vCollectibleLight = diffuse * (0.018 + broad * 0.13 + rim * 0.025 + lowerFill * 0.12);
    vCollectibleEdge = power64(max(dot(n, normalize(vec3(0.68, -0.55, 0.49))), 0.0)) * 1.4;
  #endif
}
`;

export const COLLECTIBLE_SPECULAR_FRAGMENT = /* glsl */ `
float stripDistance = abs(vCollectibleUv.x - vCollectibleSweep.x);
float flash = (1.0 - smoothstep(vCollectibleSweep.y * 0.45, vCollectibleSweep.y, stripDistance))
  * vCollectibleSweep.z;
float edgeFlash = vCollectibleEdge * (1.0 - smoothstep(0.0, 0.16, vCollectibleEdgeDistance))
  * mix(1.0, 1.0 - smoothstep(0.45, 0.8, vCollectibleUv.y), vCollectibleSweep.w);
vec3 outgoingLight = vCollectibleLight + vec3(1.0, 0.98, 0.97) * flash
  + vec3(0.88, 0.94, 1.0) * edgeFlash;
float highlightCoverage = max(flash + edgeFlash, min(min(outgoingLight.r, outgoingLight.g), outgoingLight.b));
diffuseColor.a = opacity * mix(0.86, 1.0, clamp(highlightCoverage, 0.0, 1.0));
`;

/** Native opacity/clone/fog behavior, with vertex-lit affine facet highlights. */
export class CollectibleSpecularMaterial extends THREE.MeshBasicMaterial {
  constructor(color: THREE.ColorRepresentation = 0xb8c8de, profile: "crystal" | "gem" = "gem") {
    super({ color, toneMapped: false, transparent: true, depthWrite: true });
    this.name = "collectible vertex specular";
    this.userData.collectibleProfile = profile;
    this.onBeforeCompile = shader => {
      const profileDefine = `#define COLLECTIBLE_CRYSTAL ${this.userData.collectibleProfile === "crystal" ? 1 : 0}\n`;
      shader.vertexShader = profileDefine + COLLECTIBLE_SPECULAR_VERTEX + shader.vertexShader.replace(
        "#include <begin_vertex>", "#include <begin_vertex>\nlightCollectible();",
      );
      shader.fragmentShader = "varying vec3 vCollectibleLight;\nvarying vec4 vCollectibleSweep;\nvarying vec2 vCollectibleUv;\nvarying float vCollectibleEdge;\nvarying float vCollectibleEdgeDistance;\n" + shader.fragmentShader.replace(
        "vec3 outgoingLight = reflectedLight.indirectDiffuse;", COLLECTIBLE_SPECULAR_FRAGMENT,
      );
    };
  }
  customProgramCacheKey(): string {
    return `collectible-facet-sweep-v4:${this.userData.collectibleProfile === "crystal" ? "crystal" : "gem"}`;
  }
}

type Point = [number, number, number];

/** Semantic polygon boundaries, before the GPU's required triangulation. */
export function collectiblePolygons(kind: "crystal" | "gem", scale = 1): THREE.Vector3[][] {
  const point = (p: Point) => new THREE.Vector3(...p).multiplyScalar(scale);
  const ring = (radius: number, y: number, count: number, phase = 0) => Array.from({ length: count }, (_, i) => {
    const angle = (i + phase) * Math.PI * 2 / count;
    return point([Math.sin(angle) * radius, y, Math.cos(angle) * radius]);
  });
  const faces: THREE.Vector3[][] = [];
  if (kind === "crystal") {
    // Staggered shoulders, not two pyramids on a single equatorial ring.
    // The four upper kites are quads; clipping the lower pole makes the
    // four long body cuts pentagons, closed by a small quadrilateral foot.
    const count = 4, ratio = 1.15, radius = 0.40;
    const topY = 0.72, poleY = -1.61, height = topY - poleY;
    const cosine = Math.cos(Math.PI / count);
    const lowerDrop = height * (1 - cosine * ratio) / (1 - cosine * cosine);
    const upperDrop = cosine / ratio * lowerDrop;
    const upper = ring(radius / ratio, topY - upperDrop, count);
    const lower = ring(radius, topY - lowerDrop, count, 0.5);
    const top = point([0, topY, 0]), pole = point([0, poleY, 0]);
    const foot = lower.map(p => pole.clone().lerp(p, 0.11 / (height - lowerDrop)));
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      faces.push([top, upper[i], lower[i], upper[j]]);
      faces.push([upper[j], lower[i], foot[i], foot[j], lower[j]]);
    }
    faces.push(foot);
  } else {
    // The supplied clear-gem close-up has a brilliant-style crown: table,
    // star triangles, bezel kites and paired upper-girdle triangles. These
    // are actual cut planes, not subdivisions painted onto one frustum.
    const count = 8, radius = 0.72, tableRadius = 0.46, topY = 0.28;
    const cosine = Math.cos(Math.PI / count);
    const belt = ring(radius, 0, count * 2), table = ring(tableRadius, topY, count);
    const starRadius = 0.58;
    const stars = ring(starRadius, topY * (radius - starRadius * cosine) / (radius - tableRadius), count, 0.5);
    const bottomY = -0.45, lowerRadius = 0.34;
    const lower = ring(lowerRadius, bottomY * (1 - lowerRadius * cosine / radius), count, 0.5);
    const bottom = point([0, bottomY, 0]);
    faces.push(table);
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count, previous = (i + count - 1) % count;
      const a = belt[i * 2], b = belt[i * 2 + 1], c = belt[(i * 2 + 2) % (count * 2)];
      faces.push([table[i], table[j], stars[i]]);
      faces.push([table[i], stars[previous], a, stars[i]]);
      faces.push([stars[i], a, b], [stars[i], b, c]);
      faces.push([bottom, lower[i], a, lower[previous]]);
      faces.push([lower[i], b, a], [lower[i], c, b]);
    }
  }
  return faces;
}

/** Closed physical cuts. No face-centre vertices or interpolated optical normals. */
export function buildCollectibleGeometry(kind: "crystal" | "gem", scale = 1): THREE.BufferGeometry {
  const faces = collectiblePolygons(kind, scale);
  const interior = new THREE.Vector3(0, kind === "crystal" ? -0.39 : -0.08, 0).multiplyScalar(scale);
  const positions: number[] = [], normals: number[] = [], tangents: number[] = [], coordinates: number[] = [], edgeDistances: number[] = [];
  for (const face of faces) {
    const normal = face[1].clone().sub(face[0]).cross(face[2].clone().sub(face[0])).normalize();
    const center = face.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / face.length);
    if (normal.dot(center.clone().sub(interior)) < 0) { face.reverse(); normal.negate(); }
    const tangent = Math.abs(normal.y) > 0.99
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(normal.z, 0, -normal.x).normalize();
    const bitangent = normal.clone().cross(tangent).normalize();
    const u = face.map(p => p.dot(tangent)), v = face.map(p => p.dot(bitangent));
    const minU = Math.min(...u), minV = Math.min(...v);
    const spanU = Math.max(1e-8, Math.max(...u) - minU), spanV = Math.max(1e-8, Math.max(...v) - minV);
    const uv = face.map((_, i) => [(u[i] - minU) / spanU, (v[i] - minV) / spanV]);
    const left = uv.reduce((a, b) => b[0] < a[0] ? b : a);
    const foot = uv.filter(p => p[1] < 1e-6).reduce((a, b) => b[0] < a[0] ? b : a);
    const edgeSlope = (foot[0] - left[0]) / Math.max(1e-8, left[1] - foot[1]);
    // Triangulate from a perimeter corner. Face-local coordinates remain
    // affine across every diagonal: triangulation must not become shading.
    for (let j = 1; j < face.length - 1; j++) for (const i of [0, j, j + 1]) {
      positions.push(...face[i].toArray()); normals.push(...normal.toArray());
      tangents.push(...tangent.toArray()); coordinates.push(...uv[i]);
      edgeDistances.push(kind === "crystal" && face.length === 5
        ? uv[i][0] - foot[0] + edgeSlope * (uv[i][1] - foot[1]) : 1 - uv[i][1]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.name = `${kind} closed planar cuts`;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aFacetNormal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aFaceTangent", new THREE.Float32BufferAttribute(tangents, 3));
  geometry.setAttribute("aFaceUv", new THREE.Float32BufferAttribute(coordinates, 2));
  geometry.setAttribute("aEdgeDistance", new THREE.Float32BufferAttribute(edgeDistances, 1));
  geometry.userData.faceVertexCounts = faces.map(face => face.length);
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createCollectibleShell(kind: "crystal" | "gem", scale = 1, tint?: number): THREE.Mesh {
  const mesh = new THREE.Mesh(buildCollectibleGeometry(kind, scale), new CollectibleSpecularMaterial(tint ?? (kind === "crystal" ? 0xc83afa : 0xb8c8de), kind));
  mesh.name = `${kind} specular shell`;
  return mesh;
}
