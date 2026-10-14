import * as THREE from "three";
import { BOARDWALK_MESH_DATA } from "./boardwalkMeshes.generated";
import { DROWNED_PLANK_DATA } from "./drownedPlank.generated";
import {
  unityStructureSignedNoise,
  type WoodPathLayout,
  type WoodPathPlankPiece,
  type WoodPathPolePiece,
} from "./woodPathKit";

export const RUSTIC_PLANK_PALETTE = "rustic-planks";
export const RUSTIC_POLE_PALETTE = "rustic-timber-rope";
export const WOOD_PATH_PLANK_WEIGHTS = [3, 4, 2] as const;
export const WOOD_PATH_POLE_WEIGHTS = [4, 3, 2] as const;
export const WOOD_PATH_MESH_CHUNK_METRES = 24;

export const WOOD_PATH_MODELS = {
  plank: ["plank-split", "plank-worn", "plank-chipped"],
  timber: ["beam-hewn", "beam-driftwood", "beam-split"],
  rope: ["rope-twist", "rope-weathered", "rope-braid"],
} as const;
type Family = keyof typeof WOOD_PATH_MODELS;
type ModelName = keyof typeof BOARDWALK_MESH_DATA;
type Member = WoodPathPlankPiece | WoodPathPolePiece;

// These nine small templates and one atlas are shared, bounded process assets.
// A level owns only instance buffers; its disposal never invalidates peers.
const templates = new Map<ModelName, THREE.BufferGeometry>();
let material: THREE.MeshLambertMaterial | null = null;
let crownMaterial: THREE.MeshStandardMaterial | null = null;
let quayMaterial: THREE.MeshStandardMaterial | null = null;
const quayTemplates = new Map<ModelName, THREE.BufferGeometry>();
export const BRIDGE_AGED_PALETTE = 'bridge-aged-planks';
export const BRIDGE_FROZEN_PALETTE = 'bridge-frozen-planks';
const paintedMaterials = new Set<THREE.MeshLambertMaterial>();
const treatments = new Map<string, THREE.MeshLambertMaterial>();
export const woodPathMeshPaint = { status: "idle" as "idle" | "loading" | "ready" | "fallback" };

function meshMaterial(): THREE.MeshLambertMaterial {
  if (material) return material;
  const owned = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, flatShading: true });
  owned.name = "Rustic Meshy boardwalk · clay paint";
  owned.userData.shared = true;
  material = owned;
  paintedMaterials.add(owned);
  // Native geometry and sampled paint are available synchronously, including
  // headless/editor use. A single local image adds the finer grain in-browser.
  if (typeof document !== "undefined" && !import.meta.env.SSR) {
    woodPathMeshPaint.status = "loading";
    const texture = new THREE.TextureLoader().load(
      import.meta.env.BASE_URL + "boardwalk/rustic-atlas.webp",
      (paint) => {
        paint.flipY = false;
        paint.colorSpace = THREE.SRGBColorSpace;
        paint.anisotropy = 4;
        paint.needsUpdate = true;
        for (const surface of paintedMaterials) {
          surface.map = paint; surface.vertexColors = false; surface.needsUpdate = true;
        }
        woodPathMeshPaint.status = "ready";
      },
      undefined,
      () => { texture.dispose(); woodPathMeshPaint.status = "fallback"; },
    );
    texture.userData.shared = true;
  }
  return owned;
}

/** Three borrowed atlas materials, not one texture upload per board. Age is
 * applied to the actual split/chipped model palette, preserving its grain. */
function partMaterial(palette: string): THREE.MeshLambertMaterial|THREE.MeshStandardMaterial {
  if(palette==='crown-quay'){
    if(quayMaterial)return quayMaterial;
    const owned=new THREE.MeshStandardMaterial({color:'#f5ead6',roughness:.82,bumpScale:.009});
    owned.name='Drowned Crown · salt-worn quay oak';owned.userData.shared=true;quayMaterial=owned;
    owned.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        float grainLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(grainLuma),.38)*1.65;
      `);
    };
    owned.customProgramCacheKey=()=> 'crown-quay-salt-oak-v1';
    if(typeof document!=='undefined'&&!import.meta.env.SSR){
      const texture=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'drowned-crown/timber.webp',paint=>{
        paint.flipY=false;paint.wrapS=paint.wrapT=THREE.RepeatWrapping;
        paint.colorSpace=THREE.SRGBColorSpace;paint.anisotropy=8;
        owned.map=paint;owned.bumpMap=paint;owned.needsUpdate=true;
      });texture.userData.shared=true;
    }
    return owned;
  }
  if(palette==='crown-timber'){
    if(crownMaterial)return crownMaterial;
    const owned=new THREE.MeshStandardMaterial({color:'#d9bda0',roughness:.76,bumpScale:.025});
    owned.name='Drowned Crown · painted oak boardwalk';owned.userData.shared=true;crownMaterial=owned;
    if(typeof document!=='undefined'&&!import.meta.env.SSR){
      const texture=new THREE.TextureLoader().load(import.meta.env.BASE_URL+'drowned-crown/timber.webp',paint=>{
        paint.flipY=false;paint.colorSpace=THREE.SRGBColorSpace;paint.anisotropy=8;
        owned.map=paint;owned.bumpMap=paint;owned.needsUpdate=true;
      });texture.userData.shared=true;
    }
    return owned;
  }
  const base = meshMaterial();
  if(palette==='sunny-oak'){
    const existing=treatments.get(palette);if(existing)return existing;
    const sunny=base.clone();sunny.userData.shared=true;sunny.name='Sunny beach · honey oak';
    sunny.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float oakValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      diffuseColor.rgb=mix(vec3(.21,.09,.028),vec3(.62,.36,.14),smoothstep(.03,.83,oakValue));
    `);};
    sunny.customProgramCacheKey=()=> 'sunny-oak-v1';treatments.set(palette,sunny);paintedMaterials.add(sunny);return sunny;
  }
  if (palette !== BRIDGE_AGED_PALETTE && palette !== BRIDGE_FROZEN_PALETTE) return base;
  const existing = treatments.get(palette); if (existing) return existing;
  const aged = palette === BRIDGE_AGED_PALETTE;
  const result = base.clone(); result.userData.shared = true;
  result.name = aged ? 'Rotten bridge boards · silver grain and damp ends' : 'Timber beneath frozen glaze';
  result.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float timberGrey = dot(diffuseColor.rgb,vec3(.299,.587,.114));
      diffuseColor.rgb = mix(diffuseColor.rgb,vec3(timberGrey),${aged ? '.82' : '.6'});
      diffuseColor.rgb *= ${aged ? 'vec3(.51,.54,.45)' : 'vec3(.65,.8,.87)'};
    `);
  };
  result.customProgramCacheKey = () => palette + '-v1';
  treatments.set(palette,result); paintedMaterials.add(result);
  return result;
}

export const DROWNED_PLANK_PALETTE='drowned-original-planks';
let drownedPlankGeometry:THREE.BufferGeometry|null=null;
let drownedPlankMaterial:THREE.MeshStandardMaterial|null=null;
function originalDrownedPlank():THREE.BufferGeometry {
 if(drownedPlankGeometry)return drownedPlankGeometry;
 const d=DROWNED_PLANK_DATA,g=new THREE.BufferGeometry();
 g.setAttribute('position',new THREE.Float32BufferAttribute(d.positions,3));
 g.setAttribute('normal',new THREE.Float32BufferAttribute(d.normals,3));
 g.setAttribute('uv',new THREE.Float32BufferAttribute(d.uvs,2));g.setIndex([...d.indices]);
 g.computeBoundingBox();g.computeBoundingSphere();g.userData.shared=true;g.name='Original-UV painted pirate plank';
 drownedPlankGeometry=g;return g;
}
function originalDrownedWood():THREE.MeshStandardMaterial {
 if(drownedPlankMaterial)return drownedPlankMaterial;
 const material=new THREE.MeshStandardMaterial({color:'#ead2aa',roughness:.88,metalness:0,normalScale:new THREE.Vector2(.09,.09)});
 material.name='Drowned Crown · original painted plank atlas';material.userData.shared=true;drownedPlankMaterial=material;
 if(typeof document!=='undefined'&&!import.meta.env.SSR){
  const loader=new THREE.TextureLoader();
  for(const [key,file] of [['map','color'],['normalMap','normal']] as const){
   const texture=loader.load(import.meta.env.BASE_URL+'boardwalk/drowned-plank-'+file+'.jpg',paint=>{
    paint.flipY=false;paint.anisotropy=8;if(key==='map')paint.colorSpace=THREE.SRGBColorSpace;
    material[key]=paint;material.needsUpdate=true;
   });texture.userData.shared=true;
  }
 }
 return material;
}

function meshGeometry(name: ModelName): THREE.BufferGeometry {
  const cached = templates.get(name);
  if (cached) return cached;
  const data = BOARDWALK_MESH_DATA[name];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(data.colors, 3));
  geometry.setIndex(data.indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  geometry.name = `Meshy boardwalk · ${name}`;
  geometry.userData.shared = true;
  templates.set(name, geometry);
  return geometry;
}

/** The old Meshy UVs address a packed atlas. The quay's separate oak image
 * needs longitudinal grain with one strip per physical board, not seven
 * miniature boards wrapped over each split. Original geometry is retained. */
function quayGeometry(name:ModelName):THREE.BufferGeometry {
  const cached=quayTemplates.get(name);if(cached)return cached;
  const source=meshGeometry(name),g=source.clone(),p=g.getAttribute('position'),n=g.getAttribute('normal'),uv=[];
  const strip=name==='plank-split'?.018:name==='plank-worn'?.302:.592;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
    uv.push((x+.5)*1.45,strip+(Math.abs(n.getY(i))>.5?z+.5:y+.5)*.112);
  }
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  g.name='Quay oak · '+name;g.userData.shared=true;quayTemplates.set(name,g);return g;
}

/** Old source/editor palette IDs upgrade to the same reusable rustic mesh kit. */
export function woodPathMeshPaletteId(kind: "plank" | "pole", requested?: string): string {
  const legacy = kind === "plank" ? "placeholder-board" : "placeholder-pole";
  return !requested || requested === legacy
    ? kind === "plank" ? RUSTIC_PLANK_PALETTE : RUSTIC_POLE_PALETTE
    : requested;
}

function memberFamily(member: Member): Family {
  return member.kind === "plank" ? "plank" : member.role === "top-rail" ? "rope" : "timber";
}

/** Fit the provider's normalized local envelope to the existing semantic part. */
export function woodPathMemberMatrix(member: Member, seed: number): THREE.Matrix4 {
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  if (member.kind === "plank") {
    const basis = new THREE.Matrix4().makeBasis(
      new THREE.Vector3().fromArray(member.basis.right),
      new THREE.Vector3().fromArray(member.basis.up),
      new THREE.Vector3().fromArray(member.basis.forward),
    );
    quaternion.setFromRotationMatrix(basis);
    // Reversing selected boards reveals different chips without moving their
    // top or changing the authored jitter, bank, width and seam spacing.
    if (unityStructureSignedNoise(member.index, seed, 109) > 0)
      quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    scale.fromArray(member.size);
  } else {
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().fromArray(member.direction));
    quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      unityStructureSignedNoise(member.index, seed, 127) * Math.PI,
    ));
    scale.set(member.radius, member.length, member.radius);
  }
  return new THREE.Matrix4().compose(new THREE.Vector3().fromArray(member.center), quaternion, scale);
}

function memberDistance(member: Member, layout: WoodPathLayout): number {
  if (member.kind === "plank") return member.distance;
  if (member.bentIndex !== undefined) return layout.bents[member.bentIndex].distance;
  if (member.role === "top-rail") {
    const intervals = Math.max(1, Math.ceil(layout.length / layout.profile.balustradeVisualSpacing));
    return ((member.bayIndex ?? 1) - .5) * layout.length / intervals;
  }
  return ((member.bayIndex ?? 1) - .5) * layout.bentSpacing;
}

function partGroup(layout: WoodPathLayout, members: Member[], kind: "plank" | "pole", palette: string, seed: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `woodpath parts · ${kind === "plank" ? "planks" : "poles"}`;
  group.userData.woodPathPartRole = kind;
  group.userData.woodPathPalette = palette;
  group.userData.woodPathVariants = members.map(member => member.variantIndex);
  group.userData.woodPathRoles = members.map(member => member.kind === "plank" ? "plank" : member.role);
  const buckets = new Map<string, { family: Family; name: ModelName; members: Member[] }>();
  const rendered:Member[]=palette===DROWNED_PLANK_PALETTE&&kind==='plank'?members.flatMap(member=>{
    if(member.kind!=='plank'||member.size[0]<=7.4)return [member];
    const split=.46+.08*unityStructureSignedNoise(member.index,seed,157),seam=.035,width=member.size[0];
    return [[-width/2,-width/2+width*split-seam/2],[-width/2+width*split+seam/2,width/2]].map(([lo,hi],piece)=>{
      const offset=(lo+hi)/2;
      return {...member,center:member.center.map((v,i)=>v+member.basis.right[i]*offset) as [number,number,number],
        size:[hi-lo,member.size[1],member.size[2]] as [number,number,number],tonalBucket:(member.tonalBucket+piece)%4};
    });
  }):members;
  for (const member of rendered) {
    const family = memberFamily(member);
    const names = WOOD_PATH_MODELS[family];
    const variant = ((member.variantIndex % names.length) + names.length) % names.length;
    const name = names[variant];
    const chunk = Math.floor(memberDistance(member, layout) / WOOD_PATH_MESH_CHUNK_METRES);
    const key = `${name}:${chunk}`;
    if (!buckets.has(key)) buckets.set(key, { family, name, members: [] });
    buckets.get(key)!.members.push(member);
  }
  for (const [key, bucket] of buckets) {
    const mesh = new THREE.InstancedMesh(palette===DROWNED_PLANK_PALETTE?originalDrownedPlank():palette==='crown-quay'?quayGeometry(bucket.name):meshGeometry(bucket.name), palette===DROWNED_PLANK_PALETTE?originalDrownedWood():partMaterial(palette), bucket.members.length);
    mesh.name = `woodpath mesh · ${key}`;
    mesh.userData.woodPathMeshFamily = bucket.family;
    // The continuous deck owns plank seams; posts and rails use their actual geometry.
    mesh.userData.solidSurface=kind==='plank'?'none':'mesh';
    mesh.userData.woodPathModel = bucket.name;
    mesh.userData.woodPathMemberIndices = bucket.members.map(member => member.index);
    mesh.userData.woodPathRoles = bucket.members.map(member => member.kind === "plank" ? "plank" : member.role);
    bucket.members.forEach((member, index) => {
      mesh.setMatrixAt(index, woodPathMemberMatrix(member, seed));
      const tint = .88 + member.tonalBucket * .035;
      mesh.setColorAt(index, new THREE.Color(tint, tint, tint));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingBox();
    mesh.computeBoundingSphere();
    group.add(mesh);
  }
  return group;
}

export function buildWoodPathMeshes(layout: WoodPathLayout, seed: number, plankPalette?: string, polePalette?: string): [THREE.Group, THREE.Group] {
  return [
    partGroup(layout, layout.planks, "plank", woodPathMeshPaletteId("plank", plankPalette), seed),
    partGroup(layout, layout.poles, "pole", woodPathMeshPaletteId("pole", polePalette), seed ^ 0x6f2b),
  ];
}
