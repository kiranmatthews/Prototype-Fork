import * as THREE from "three";

// PS1-budget-inspired vertex lighting, not a claim to Naughty Dog's original
// undocumented equations. See docs/COLLECTIBLE_SPECULAR.md for the evidence.
export const COLLECTIBLE_SPECULAR_VERTEX = /* glsl */ `
uniform vec3 diffuse;
attribute vec3 aFacetNormal;
varying vec3 vCollectibleLight;
float power8(float x) { x *= x; x *= x; return x * x; }
float power32(float x) { x = power8(x); x *= x; return x * x; }
void lightCollectible() {
  vec3 n = normalize(normalMatrix * normal);
  vec3 facet = normalize(normalMatrix * aFacetNormal);
  // A fixed camera-space studio rig keeps rewards readable in both the world
  // and the orthographic HUD. Object rotation, not a timer, moves the glints.
  float broad = max(dot(facet, vec3(-0.36, 0.48, 0.8)), 0.0);
  float rim = max(dot(facet, vec3(0.8, -0.36, 0.48)), 0.0);
  float key = max(dot(n, normalize(vec3(-0.32, -0.22, 0.92))), 0.0);
  float fill = max(dot(n, normalize(vec3(0.45, 0.45, 0.78))), 0.0);
  float lower = max(dot(n, normalize(vec3(0.24, -0.70, 0.67))), 0.0);
  vec3 body = diffuse * (0.12 + broad * 0.4 + rim * 0.12);
  vec3 sheen = vec3(0.56, 0.72, 1.0) * power8(key) * 0.24;
  // Untinted white specular is added AFTER the body colour: a coloured gem
  // must still throw white flashes, rather than tinting every reflection.
  vCollectibleLight = body + sheen + vec3(1.0, 0.97, 0.93) * power32(key) * 2.1
    + vec3(0.82, 0.94, 1.0) * (power8(fill) * 0.25 + power32(fill) * 1.6)
    + vec3(0.9, 0.96, 1.0) * power32(lower) * 2.0;
}
`;

/** Basic material keeps native opacity/fog/clone behavior; all lighting is vertex-side. */
export class CollectibleSpecularMaterial extends THREE.MeshBasicMaterial {
  constructor(color: THREE.ColorRepresentation = 0xb8c8de) {
    super({ color, toneMapped: false });
    this.name = "collectible vertex specular";
    this.onBeforeCompile = shader => {
      shader.vertexShader = COLLECTIBLE_SPECULAR_VERTEX + shader.vertexShader.replace(
        "#include <begin_vertex>", "#include <begin_vertex>\nlightCollectible();",
      );
      shader.fragmentShader = "varying vec3 vCollectibleLight;\n" + shader.fragmentShader.replace(
        "vec3 outgoingLight = reflectedLight.indirectDiffuse;",
        "vec3 outgoingLight = vCollectibleLight;",
      );
    };
  }
  customProgramCacheKey(): string { return "collectible-vertex-specular-v1"; }
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
    const n = center ? face : face.clone().lerp(cornerNormals.get(key(p))!, 0.48).normalize();
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
  const mesh = new THREE.Mesh(buildCollectibleGeometry(kind, scale), new CollectibleSpecularMaterial(tint ?? (kind === "crystal" ? 0xb86be8 : 0xb8c8de)));
  mesh.name = `${kind} specular shell`;
  return mesh;
}
