import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const TROPICAL_PLANT_KINDS = ["fanpalm", "bananatree", "seagrape", "monstera", "birdofparadise"] as const;
export type TropicalPlantKind = (typeof TROPICAL_PLANT_KINDS)[number];
export const TROPICAL_PLANT_LABELS: Record<TropicalPlantKind, string> = {
  fanpalm: "fan palm", bananatree: "banana tree", seagrape: "sea grape tree",
  monstera: "monstera", birdofparadise: "bird of paradise",
};

type Flex = "leaf" | "canopy" | "trunk" | "flower";
interface Part { geometry: THREE.BufferGeometry; flex: Flex; }

const WIND_HEADER = /* glsl */ `
uniform float uPlantTime;
attribute vec2 aPlantFlex;
`;
const WIND_VERTEX = /* glsl */ `
vec4 plantOrigin = vec4(0.0, 0.0, 0.0, 1.0);
#ifdef USE_INSTANCING
  plantOrigin = instanceMatrix * plantOrigin;
#endif
plantOrigin = modelMatrix * plantOrigin;
float plantPhase = uPlantTime * 0.82 + plantOrigin.x * 0.13 + plantOrigin.z * 0.17 + aPlantFlex.y;
float plantSwing = sin(plantPhase) * 0.12 + sin(plantPhase * 0.61 + 1.7) * 0.055;
transformed.x += plantSwing * aPlantFlex.x;
transformed.y += sin(plantPhase * 1.13 + 0.4) * 0.062 * aPlantFlex.x;
transformed.z += cos(plantPhase * 0.77) * 0.095 * aPlantFlex.x;
`;
const LIGHT_VERTEX = /* glsl */ `
vec3 plantNormal = normal;
plantNormal.xz += vec2(plantSwing * 0.16, cos(plantPhase) * 0.025) * aPlantFlex.x;
#ifdef USE_INSTANCING
  mat3 plantInstance = mat3(instanceMatrix);
  plantNormal /= vec3(dot(plantInstance[0], plantInstance[0]), dot(plantInstance[1], plantInstance[1]), dot(plantInstance[2], plantInstance[2]));
  plantNormal = plantInstance * plantNormal;
#endif
plantNormal = normalize(mat3(modelMatrix) * plantNormal);
float plantSky = plantNormal.y * 0.5 + 0.5;
float plantKey = max(dot(plantNormal, normalize(uPlantKeyDirection)), 0.0);
float plantFill = max(dot(plantNormal, normalize(vec3(0.6, 0.35, -0.5))), 0.0);
vPlantLight = mix(vec3(0.49, 0.57, 0.39), vec3(0.7, 0.82, 0.83), plantSky) * uPlantLightStrength.x
  + uPlantKeyColor * plantKey * 0.57 * uPlantLightStrength.y
  + vec3(0.46, 0.65, 0.72) * plantFill * 0.18 * uPlantLightStrength.x;
`;

function mix(a: number, b: number, t: number): THREE.Color {
  return new THREE.Color(a).lerp(new THREE.Color(b), THREE.MathUtils.clamp(t, 0, 1));
}

/** Leaf color, veins and light pools are vertex attributes, never bitmap maps. */
function finishLeaf(geometry: THREE.BufferGeometry, length: number, dark: number, light: number): THREE.BufferGeometry {
  const points = geometry.getAttribute("position");
  const colors: number[] = [], flex: number[] = [];
  for (let i = 0; i < points.count; i++) {
    const x = points.getX(i), z = points.getZ(i);
    const t = THREE.MathUtils.clamp(z / length, 0, 1);
    const midrib = Math.exp(-Math.abs(x) * 18);
    const veins = Math.pow(Math.max(0, Math.cos(t * 42 - Math.abs(x) * 8)), 8);
    const pool = Math.sin(t * 7 + x * 4) * 0.09;
    const color = mix(dark, light, 0.27 + Math.sin(t * Math.PI) * 0.36 + midrib * 0.19 + veins * 0.13 + pool);
    colors.push(color.r, color.g, color.b);
    flex.push(Math.pow(t, 1.6), 0);
  }
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute("aPlantFlex", new THREE.Float32BufferAttribute(flex, 2));
  geometry.computeVertexNormals();
  const normals=geometry.getAttribute("normal");
  let top=0;
  for(let i=0;i<normals.count;i++)top+=normals.getY(i);
  if(top<0&&geometry.index){
    const index=geometry.index;
    for(let i=0;i<index.count;i+=3){
      const b=index.getX(i+1);index.setX(i+1,index.getX(i+2));index.setX(i+2,b);
    }
    geometry.computeVertexNormals();
  }
  geometry.computeBoundingSphere();
  if (geometry.boundingSphere) geometry.boundingSphere.radius += 0.4;
  return geometry;
}

function blade(length: number, width: number, dark: number, light: number, rows=24, columns=8): THREE.BufferGeometry {
  const positions: number[] = [], indices: number[] = [];
  for (let row = 0; row <= rows; row++) {
    const t = row / rows;
    const w = Math.pow(Math.sin(t * Math.PI), 0.65) * width;
    for (let col = 0; col <= columns; col++) {
      const across = col / columns * 2 - 1;
      positions.push(across * w, Math.sin(t * Math.PI) * length * 0.23 - t * t * length * 0.24 + (1 - Math.abs(across)) * w * 0.16, t * length);
      if (row < rows && col < columns) {
        const a = row * (columns + 1) + col;
        indices.push(a, a + columns + 1, a + 1, a + 1, a + columns + 1, a + columns + 2);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return finishLeaf(g, length, dark, light);
}

function monsteraLeaf(): THREE.BufferGeometry {
  const length = 2.1;
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  for (const side of [-1, 1]) {
    for (let step = 0; step <= 36; step++) {
      const t = side === -1 ? step / 36 : 1 - step / 36;
      const split = [8, 15, 22, 28].includes(Math.round(t * 36)) ? 0.22 : 1;
      const width = Math.pow(Math.sin(t * Math.PI), 0.61) * 0.93 * split;
      shape.lineTo(side * width, t * length);
    }
  }
  shape.closePath();
  for (const side of [-1, 1]) {
    for (const t of [0.31, 0.51, 0.68]) {
      const hole = new THREE.Path();
      hole.absellipse(side * 0.22, t * length, 0.07, 0.11, 0, Math.PI * 2, true, side * -0.5);
      shape.holes.push(hole);
    }
  }
  const g = new THREE.ShapeGeometry(shape, 8);
  const p = g.getAttribute("position");
  for (let i = 0; i < p.count; i++) {
    const z = p.getY(i), t = z / length, x = p.getX(i);
    p.setXYZ(i, x, Math.sin(t * Math.PI) * 0.28 - t * t * 0.32 + Math.abs(x) * 0.12, z);
  }
  return finishLeaf(g, length, 0x155b49, 0x86c977);
}

function fanLeaf(): THREE.BufferGeometry {
  const positions: number[] = [0, 0, 0], indices: number[] = [];
  for (let i = 0; i <= 36; i++) {
    const angle = -1.12 + i / 36 * 2.24;
    const radius = i % 2 ? 1.72 : 2.05;
    positions.push(Math.sin(angle) * radius, 0.22 + (i % 2 ? -0.12 : 0.12), Math.cos(angle) * radius);
    if (i < 36) indices.push(0, i + 1, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return finishLeaf(g, 2.05, 0x356e46, 0xb0d76c);
}

function tintedStem(a: THREE.Vector3, b: THREE.Vector3, radius: number, color: number): THREE.BufferGeometry {
  const direction = b.clone().sub(a);
  const g = new THREE.CylinderGeometry(radius * 0.62, radius, direction.length(), 8, 4);
  g.translate(0, direction.length() * 0.5, 0);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
  g.translate(a.x, a.y, a.z);
  const p = g.getAttribute("position");
  const colors: number[] = [];
  for (let i = 0; i < p.count; i++) {
    const c = new THREE.Color(color).lerp(new THREE.Color(0xd0bc84), THREE.MathUtils.clamp(p.getY(i) / 8, 0, 0.45));
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  return g;
}

function merged(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  // Primitive normals/UVs are not identical across families. All shading uses
  // position, normal and vertex colors, so normalize the merge contract.
  for (const g of parts) {
    for (const name of Object.keys(g.attributes))
      if (!["position", "normal", "color", "aPlantFlex"].includes(name)) g.deleteAttribute(name);
    if (!g.hasAttribute("aPlantFlex")) g.setAttribute("aPlantFlex", new THREE.Float32BufferAttribute(new Float32Array(g.getAttribute("position").count * 2), 2));
  }
  const result = mergeGeometries(parts.map((g) => g.index ? g.toNonIndexed() : g))!;
  for (const g of parts) g.dispose();
  return result;
}

function plantGeometry(kind: TropicalPlantKind): Part[] {
  const leaves: THREE.BufferGeometry[] = [], stems: THREE.BufferGeometry[] = [];
  const flowers: THREE.BufferGeometry[] = [];
  const origin = new THREE.Vector3();
  const addLeaf = (g: THREE.BufferGeometry, position: THREE.Vector3, yaw: number, pitch: number, size = 1): void => {
    g.scale(size, size, size);
    g.applyQuaternion(new THREE.Quaternion().setFromEuler(new THREE.Euler(pitch, yaw, 0, "YXZ")));
    g.translate(position.x, position.y, position.z);
    const flex = g.getAttribute("aPlantFlex");
    for (let i = 0; i < flex.count; i++) flex.setY(i, yaw * 0.4);
    leaves.push(g);
  };
  if (kind === "fanpalm" || kind === "bananatree") {
    const height = kind === "fanpalm" ? 4.4 : 2.5;
    stems.push(tintedStem(origin, new THREE.Vector3(0.35, height, 0), kind === "fanpalm" ? 0.2 : 0.25, kind === "fanpalm" ? 0x987448 : 0x719b53));
    for (let i = 0; i < 9; i++) {
      const yaw = i * 2.4;
      const start = new THREE.Vector3(0.35, height - (i % 3) * 0.16, 0);
      if (kind === "fanpalm") {
        const tip = new THREE.Vector3(Math.sin(yaw) * 1.15, height + 0.28, Math.cos(yaw) * 1.15);
        stems.push(tintedStem(start, tip, 0.05, 0x629353));
        addLeaf(fanLeaf(), tip, yaw, -0.22 + (i % 3) * 0.16, 0.85);
      } else addLeaf(blade(3.25, 0.73, 0x367a4c, 0xa7d26f), start, yaw, -0.26 + (i % 3) * 0.12, 0.9 + (i % 2) * 0.12);
    }
  } else if (kind === "seagrape") {
    stems.push(tintedStem(origin, new THREE.Vector3(0, 3.3, 0), 0.27, 0x806950));
    for (let branch = 0; branch < 7; branch++) {
      const yaw = branch * 2.4;
      const end = new THREE.Vector3(Math.sin(yaw) * 1.5, 3.3 + (branch % 3) * 0.48, Math.cos(yaw) * 1.5);
      stems.push(tintedStem(new THREE.Vector3(0, 2.1, 0), end, 0.12, 0x806950));
      for (let leaf = 0; leaf < 11; leaf++) {
        const a = yaw + leaf * 2.4;
        const p = end.clone().add(new THREE.Vector3(Math.sin(a) * 0.6, (leaf % 3) * 0.23, Math.cos(a) * 0.6));
        addLeaf(blade(1.15, 0.56, 0x417d59, 0x9ac88b,12,4), p, a, -0.18 + (leaf % 3) * 0.18);
      }
    }
  } else {
    const count = kind === "monstera" ? 7 : 8;
    for (let i = 0; i < count; i++) {
      const yaw = i * 2.4;
      const top = new THREE.Vector3(Math.sin(yaw) * 0.42, 0.65 + (i % 3) * 0.34, Math.cos(yaw) * 0.42);
      stems.push(tintedStem(origin, top, 0.043, 0x4b834c));
      addLeaf(kind === "monstera" ? monsteraLeaf() : blade(2.05, 0.46, 0x286956, 0x80b68c), top, yaw, kind === "monstera" ? -0.28 : -0.65, 0.72 + (i % 3) * 0.14);
    }
    if (kind === "birdofparadise") {
      for (let i = 0; i < 3; i++) {
        const top = new THREE.Vector3((i - 1) * 0.35, 1.85 + i * 0.28, 0);
        stems.push(tintedStem(origin, top, 0.028, 0x4b834c));
        for (let petal = 0; petal < 4; petal++) {
          const g = new THREE.ConeGeometry(0.085, 0.7, 5);
          g.rotateZ(-0.5 - petal * 0.19);
          g.translate(top.x + 0.15 + petal * 0.08, top.y + 0.15, top.z);
          const color = new THREE.Color(petal === 3 ? 0x617ada : 0xff9c4b);
          const c = new Float32Array(g.getAttribute("position").count * 3);
          for (let v = 0; v < c.length; v += 3) color.toArray(c, v);
          g.setAttribute("color", new THREE.BufferAttribute(c, 3));
          flowers.push(g);
        }
      }
    }
  }
  const parts: Part[] = [{geometry:merged(stems),flex:"trunk"},{geometry:merged(leaves),flex:"leaf"}];
  if (flowers.length) parts.push({geometry:merged(flowers),flex:"flower"});
  return parts;
}

/** Per-level ownership: vertex-colored models, one wind clock, matching shadows. */
export class TropicalPlantKit {
  readonly time = { value: 0 };
  private readonly keyDirection = { value:new THREE.Vector3(-0.36,0.8,0.47).normalize() };
  private readonly keyColor = { value:new THREE.Color(1,0.93,0.74) };
  private readonly lightStrength = { value:new THREE.Vector2(1,1) };
  private sun:THREE.DirectionalLight|null=null;
  private sky:THREE.HemisphereLight|null=null;
  private readonly lightTarget=new THREE.Vector3();
  private readonly models = new Map<TropicalPlantKind, Part[]>();
  private readonly objects = new Set<THREE.Object3D>();
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly materials = new Set<THREE.Material>();
  private readonly shades = new Map<number, THREE.MeshBasicMaterial>();
  private readonly depth: THREE.MeshDepthMaterial;
  private disposed = false;

  constructor(private readonly sceneRoot?:THREE.Object3D) {
    this.depth = new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,side:THREE.DoubleSide});
    this.depth.onBeforeCompile = (shader) => {
      shader.uniforms.uPlantTime = this.time;
      shader.vertexShader = WIND_HEADER + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${WIND_VERTEX}`);
    };
    this.depth.customProgramCacheKey = () => "tropical-plant-wind-depth-v1";
    this.materials.add(this.depth);
  }

  private shade(color = 0xffffff): THREE.MeshBasicMaterial {
    let material = this.shades.get(color);
    if (material) return material;
    material = new THREE.MeshBasicMaterial({color,vertexColors:true,side:THREE.DoubleSide});
    material.name = "Tropical plant Gouraud vertex shading";
    material.userData.gouraud = true;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uPlantTime = this.time;
      shader.uniforms.uPlantKeyDirection=this.keyDirection;
      shader.uniforms.uPlantKeyColor=this.keyColor;
      shader.uniforms.uPlantLightStrength=this.lightStrength;
      shader.vertexShader = WIND_HEADER + "\nvarying vec3 vPlantLight;\nuniform vec3 uPlantKeyDirection;\nuniform vec3 uPlantKeyColor;\nuniform vec2 uPlantLightStrength;\n" + shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>\n${WIND_VERTEX}\n${LIGHT_VERTEX}`);
      shader.fragmentShader = "varying vec3 vPlantLight;\n" + shader.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\ndiffuseColor.rgb *= vPlantLight;");
    };
    material.customProgramCacheKey = () => "tropical-plant-gouraud-wind-v1";
    this.shades.set(color, material);
    this.materials.add(material);
    return material;
  }

  decorate(mesh: THREE.Mesh, flex: Flex): void {
    const g = mesh.geometry;
    const p = g.getAttribute("position");
    g.computeBoundingBox();
    const bounds = g.boundingBox!;
    const existingFlex = g.getAttribute("aPlantFlex");
    if (!existingFlex || (flex !== "leaf" && !Array.from(existingFlex.array).some((value) => value !== 0))) {
      const data = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        const t = flex === "leaf" ? THREE.MathUtils.clamp(p.getZ(i) / Math.max(0.1,bounds.max.z),0,1)
          : THREE.MathUtils.clamp((p.getY(i)-bounds.min.y)/Math.max(0.1,bounds.max.y-bounds.min.y),0,1);
        data[i*2] = flex === "trunk" ? 0 : flex === "flower" ? t*t*0.7 : t*t;
      }
      g.setAttribute("aPlantFlex",new THREE.BufferAttribute(data,2));
    }
    if (!g.hasAttribute("color")) {
      const colors = new Float32Array(p.count*3);
      for(let i=0;i<p.count;i++) {
        const t=(p.getY(i)-bounds.min.y)/Math.max(0.1,bounds.max.y-bounds.min.y);
        mix(0x789167,0xf3f4bd,t).toArray(colors,i*3);
      }
      g.setAttribute("color",new THREE.BufferAttribute(colors,3));
    }
    const previous = mesh.material as THREE.MeshStandardMaterial;
    mesh.material = this.shade(previous.color?.getHex() ?? 0xffffff);
    if (!this.materials.has(previous)) previous.dispose();
    mesh.customDepthMaterial = this.depth;
    mesh.castShadow = true;
    mesh.receiveShadow = false;
    mesh.userData.plantLife = true;
    mesh.userData.gouraud = true;
    g.computeBoundingSphere();
    if(g.boundingSphere)g.boundingSphere.radius+=0.4;
    this.objects.add(mesh);
    this.geometries.add(g);
  }

  create(kind:TropicalPlantKind):THREE.Group {
    if(this.disposed)throw new Error("Cannot use a disposed tropical plant kit");
    let parts=this.models.get(kind);
    if(!parts){parts=plantGeometry(kind);this.models.set(kind,parts);}
    const root=new THREE.Group();
    root.name=`tropical ${kind}`;
    root.userData.plantKind=kind;
    for(const part of parts){
      const mesh=new THREE.Mesh(part.geometry,this.shade());
      this.decorate(mesh,part.flex);
      root.add(mesh);
    }
    this.objects.add(root);
    return root;
  }

  batch(kind:TropicalPlantKind, transforms:readonly THREE.Matrix4[]):THREE.Group {
    if(this.disposed)throw new Error("Cannot use a disposed tropical plant kit");
    let parts=this.models.get(kind);
    if(!parts){parts=plantGeometry(kind);this.models.set(kind,parts);}
    const root=new THREE.Group();
    root.name=`tropical ${kind} grove`;
    root.userData.plantKind=kind;
    for(const part of parts){
      const mesh=new THREE.InstancedMesh(part.geometry,this.shade(),transforms.length);
      transforms.forEach((transform,index)=>mesh.setMatrixAt(index,transform));
      this.decorate(mesh,part.flex);
      mesh.instanceMatrix.needsUpdate=true;
      mesh.computeBoundingSphere();
      root.add(mesh);
    }
    this.objects.add(root);
    return root;
  }

  update(dt:number):void {
    if(this.disposed||!Number.isFinite(dt)||dt<=0)return;
    this.time.value+=dt;
    if(this.sceneRoot&&!this.sun){
      let world=this.sceneRoot;
      while(world.parent)world=world.parent;
      world.traverse((object)=>{
        if((object as THREE.DirectionalLight).isDirectionalLight&&object.castShadow)this.sun=object as THREE.DirectionalLight;
        if((object as THREE.HemisphereLight).isHemisphereLight)this.sky=object as THREE.HemisphereLight;
      });
    }
    if(this.sun){
      this.sun.getWorldPosition(this.keyDirection.value);
      this.sun.target.getWorldPosition(this.lightTarget);
      this.keyDirection.value.sub(this.lightTarget).normalize();
      this.keyColor.value.copy(this.sun.color);
      this.lightStrength.value.y=this.sun.intensity/1.85;
    }
    if(this.sky)this.lightStrength.value.x=this.sky.intensity/1.8;
  }

  dispose():void {
    if(this.disposed)return;
    this.disposed=true;
    for(const object of this.objects)object.removeFromParent();
    for(const geometry of this.geometries)geometry.dispose();
    for(const material of this.materials)material.dispose();
    this.objects.clear();this.geometries.clear();this.materials.clear();this.models.clear();this.shades.clear();
  }
}
