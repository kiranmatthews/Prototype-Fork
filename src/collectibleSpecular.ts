import * as THREE from "three";

// PS1-budget-inspired vertex lighting, not a claim to Naughty Dog's original
// undocumented equations. See docs/COLLECTIBLE_SPECULAR.md for the evidence.
export const COLLECTIBLE_SPECULAR_VERTEX = /* glsl */ `
uniform vec3 diffuse;
attribute vec3 aFacetNormal;
varying vec3 vCollectibleLight;
varying float vCollectibleSpecular;
float power8(float x) { x *= x; x *= x; return x * x; }
float power32(float x) { x = power8(x); x *= x; return x * x; }
float power64(float x) { x = power32(x); return x * x; }
void lightCollectible() {
  vec3 n = normalize(normalMatrix * normal);
  vec3 facet = normalize(normalMatrix * aFacetNormal);
  // A fixed camera-space studio rig keeps rewards readable in both the world
  // and the orthographic HUD. Object rotation, not a timer, moves the glints.
  float broad = max(dot(facet, vec3(-0.36, 0.48, 0.8)), 0.0);
  float rim = max(dot(facet, vec3(0.8, -0.36, 0.48)), 0.0);
  // Untinted white specular is added AFTER the body colour: a coloured gem
  // must still throw white flashes, rather than tinting every reflection.
  #if COLLECTIBLE_CRYSTAL
    // The supplied source clip alternates saturated violet, a long white
    // sliver, then a broad flash. One dominant light leaves the far cut dark.
    // A tall studio-strip lobe gives a travelling ribbon, and still catches
    // the long faces when the gameplay camera looks down at the crystal.
    vec2 stripNormal = n.xz * inversesqrt(max(dot(n.xz, n.xz), 0.0001));
    float key = max(dot(stripNormal, normalize(vec2(-0.10, 0.995))), 0.0);
    float longFace = 0.24 + max(-n.y, 0.0) * 0.76;
    float edge = max(dot(n, normalize(vec3(0.64, -0.65, 0.42))), 0.0);
    vec3 body = diffuse * (0.035 + broad * 0.60 + rim * 0.025);
    vec3 shoulder = diffuse * power8(key) * 0.16;
    vec3 luster = vec3(0.78, 0.65, 1.0) * power8(max(n.z, 0.0)) * 0.22;
    float flash = power64(key) * longFace * 3.4;
    float edgeFlash = power64(edge) * 0.55;
    vCollectibleSpecular = flash + edgeFlash;
    vCollectibleLight = body + shoulder + luster
      + vec3(1.0, 0.97, 0.93) * flash
      + vec3(0.93, 0.96, 1.0) * edgeFlash;
  #else
    // Clear/coloured gems need charcoal cuts between crown flashes, rather
    // than a silver diffuse fill and a permanently illuminated pavilion.
    float key = max(dot(n, normalize(vec3(-0.06, 0.47, 0.88))), 0.0);
    float edge = max(dot(n, normalize(vec3(0.68, -0.55, 0.49))), 0.0);
    vec3 body = diffuse * (0.018 + broad * 0.13 + rim * 0.025);
    float flash = power32(key) * 3.4;
    float edgeFlash = power64(edge) * 1.4;
    vCollectibleSpecular = flash + edgeFlash;
    vCollectibleLight = body + vec3(0.42, 0.53, 0.68) * power8(key) * 0.12
      + vec3(1.0, 0.97, 0.93) * flash
      + vec3(0.88, 0.95, 1.0) * edgeFlash;
  #endif
}
`;

/** Basic material keeps native opacity/fog/clone behavior; all lighting is vertex-side. */
export class CollectibleSpecularMaterial extends THREE.MeshBasicMaterial {
  constructor(color: THREE.ColorRepresentation = 0xb8c8de, profile: "crystal" | "gem" = "gem") {
    super({ color, toneMapped: false, transparent: true, depthWrite: true });
    this.name = "collectible vertex specular";
    // Material.copy preserves userData; HUD fade clones must retain the
    // crystal profile rather than silently compiling the default gem rig.
    this.userData.collectibleProfile = profile;
    this.onBeforeCompile = shader => {
      const profileDefine = `#define COLLECTIBLE_CRYSTAL ${this.userData.collectibleProfile === "crystal" ? 1 : 0}\n`;
      shader.vertexShader = profileDefine + COLLECTIBLE_SPECULAR_VERTEX + shader.vertexShader.replace(
        "#include <begin_vertex>", "#include <begin_vertex>\nlightCollectible();",
      );
      shader.fragmentShader = "varying vec3 vCollectibleLight;\nvarying float vCollectibleSpecular;\n" + shader.fragmentShader.replace(
        "vec3 outgoingLight = reflectedLight.indirectDiffuse;",
        // Interpolate the raw highlight BEFORE clamping coverage. Otherwise
        // a bright interpolated highlight can still inherit a translucent
        // alpha from its darker neighbouring vertices. opacity remains the
        // separate whole-icon reveal/fade, not the body's transmission.
        "vec3 outgoingLight = vCollectibleLight;\nfloat highlightCoverage = max(vCollectibleSpecular, min(min(outgoingLight.r, outgoingLight.g), outgoingLight.b));\ndiffuseColor.a = opacity * mix(0.86, 1.0, clamp(highlightCoverage, 0.0, 1.0));",
      );
    };
  }
  customProgramCacheKey(): string {
    return `collectible-vertex-specular-v3:${this.userData.collectibleProfile === "crystal" ? "crystal" : "gem"}`;
  }
}

type Point = [number, number, number];

/** One closed shell, split normals at cut edges; no hidden caps or inner overdraw. */
export function buildCollectibleGeometry(kind: "crystal" | "gem", scale = 1): THREE.BufferGeometry {
  const faces: THREE.Vector3[][] = [];
  const point = (p: Point) => new THREE.Vector3(...p).multiplyScalar(scale);
  const ring = (radius: number, y: number, count: number) => Array.from({ length: count }, (_, i) => {
    const a = i * Math.PI * 2 / count;
    return point([Math.sin(a) * radius, y, Math.cos(a) * radius]);
  });
  if (kind === "crystal") {
    const belt = ring(0.52, 0, 5), top = point([0, 0.72, 0]), bottom = point([0, -1.5, 0]);
    for (let i = 0; i < 5; i++) {
      const next = (i + 1) % 5;
      faces.push([belt[i], belt[next], top], [belt[next], belt[i], bottom]);
    }
  } else {
    const belt = ring(0.72, 0, 8), table = ring(0.4, 0.42, 8), bottom = point([0, -0.8, 0]);
    faces.push(table);
    for (let i = 0; i < 8; i++) {
      const next = (i + 1) % 8;
      faces.push([table[i], belt[i], belt[next], table[next]], [belt[next], belt[i], bottom]);
    }
  }
  const interior = point([0, -0.15, 0]);
  const faceNormals = faces.map(face => {
    const n = new THREE.Vector3().subVectors(face[1], face[0]).cross(new THREE.Vector3().subVectors(face[2], face[0])).normalize();
    const center = face.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / face.length);
    if (n.dot(center.sub(interior)) < 0) { face.reverse(); n.negate(); }
    return n;
  });
  const key = (p: THREE.Vector3) => p.toArray().map(v => v.toFixed(6)).join(",");
  const cornerNormals = new Map<string, THREE.Vector3>();
  faces.forEach((face, i) => face.forEach(p => {
    const id = key(p); if (!cornerNormals.has(id)) cornerNormals.set(id, new THREE.Vector3());
    cornerNormals.get(id)!.add(faceNormals[i]);
  }));
  for (const n of cornerNormals.values()) n.normalize();
  const positions: number[] = [], normals: number[] = [], facets: number[] = [];
  const vertex = (p: THREE.Vector3, face: THREE.Vector3, center: boolean) => {
    positions.push(p.x, p.y, p.z); facets.push(face.x, face.y, face.z);
    // A small optical edge roll produces a gradient within each flat cut,
    // while retaining a hard normal discontinuity across adjacent facets.
    let n = face;
    if (!center) {
      const crystalBelt = kind === "crystal" && Math.hypot(p.x, p.z) > 1e-8;
      n = face.clone().lerp(cornerNormals.get(key(p))!, kind === "crystal" ? (crystalBelt ? 0.68 : 0.32) : 0.60);
      // Roll a crystal's belt highlight sideways, not through the hard
      // crown/pavilion ridge. This creates the source's narrow moving sliver
      // between face-wide flashes without rounding the physical silhouette.
      if (crystalBelt) n.y = face.y * Math.hypot(n.x, n.z) / Math.hypot(face.x, face.z);
      n.normalize();
    }
    normals.push(n.x, n.y, n.z);
  };
  faces.forEach((face, i) => {
    const center = face.reduce((sum, p) => sum.add(p), new THREE.Vector3()).multiplyScalar(1 / face.length);
    face.forEach((p, j) => {
      vertex(center, faceNormals[i], true);
      vertex(p, faceNormals[i], false);
      vertex(face[(j + 1) % face.length], faceNormals[i], false);
    });
  });
  const geometry = new THREE.BufferGeometry();
  geometry.name = `${kind} closed optical facets`;
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute("aFacetNormal", new THREE.Float32BufferAttribute(facets, 3));
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}

export function createCollectibleShell(kind: "crystal" | "gem", scale = 1, tint?: number): THREE.Mesh {
  const mesh = new THREE.Mesh(buildCollectibleGeometry(kind, scale), new CollectibleSpecularMaterial(tint ?? (kind === "crystal" ? 0xc83afa : 0xb8c8de), kind));
  mesh.name = `${kind} specular shell`;
  return mesh;
}
