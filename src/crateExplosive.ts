import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { CrateFragment } from './crateSculpt';

interface BundleTemplate { geometry: THREE.BufferGeometry; material: THREE.MeshStandardMaterial; fragments: CrateFragment[] }
export interface ExplosiveArt { material: THREE.MeshStandardMaterial; pulse: { value: number }; nitro: boolean }
let template: BundleTemplate | undefined;
let pending: Promise<BundleTemplate> | undefined;
let fallbackGeometry: THREE.BufferGeometry | undefined;
const shared = <T extends THREE.BufferGeometry | THREE.Material | THREE.Texture>(value: T): T => {
  value.userData.shared = true; value.userData.levelDepthFade = false; return value;
};
function surface(g: THREE.BufferGeometry, region: number, variation = 1): THREE.BufferGeometry {
  const data = new Float32Array(g.getAttribute('position').count * 2);
  for (let i = 0; i < data.length; i += 2) { data[i] = region; data[i + 1] = variation; }
  g.setAttribute('bundleSurface', new THREE.Float32BufferAttribute(data, 2)); return g;
}
function normalize(g: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const key of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(key)) g.deleteAttribute(key);
  const result = g.index ? g.toNonIndexed() : g; if (result !== g) g.dispose(); return result;
}
function fragment(exterior: THREE.BufferGeometry): CrateFragment {
  exterior.computeBoundingBox(); const box = exterior.boundingBox!;
  const interior = new THREE.BufferGeometry();
  interior.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
  interior.setAttribute('normal', new THREE.Float32BufferAttribute([], 3));
  interior.setAttribute('uv', new THREE.Float32BufferAttribute([], 2));
  interior.setAttribute('bundleSurface', new THREE.Float32BufferAttribute([], 2));
  return { exterior: shared(exterior), interior: shared(interior), center: box.getCenter(new THREE.Vector3()), halfSize: box.getSize(new THREE.Vector3()).multiplyScalar(.5) };
}

/** Split the authored paper sleeve itself, preserving its painted UVs. Closed
 * torn ends replace the implausible complete sticks previously thrown out. */
function splitStick(source: THREE.BufferGeometry, height: number, positive: boolean): THREE.BufferGeometry {
  const p = source.getAttribute('position'), n = source.getAttribute('normal'), uv = source.getAttribute('uv'), region = source.getAttribute('bundleSurface');
  type Vertex = number[];
  const output: Vertex[] = [], rim: Vertex[] = [];
  const vertex = (i: number): Vertex => [p.getX(i),p.getY(i),p.getZ(i),n.getX(i),n.getY(i),n.getZ(i),uv.getX(i),uv.getY(i),region.getX(i),region.getY(i)];
  const distance = (v: Vertex) => (v[1]-height+.12*v[0]-.08*v[2])*(positive?1:-1);
  for (let i=0;i<p.count;i+=3) {
    const input=[vertex(i),vertex(i+1),vertex(i+2)], clipped: Vertex[]=[];
    for(let edge=0;edge<3;edge++) {
      const a=input[edge],b=input[(edge+1)%3],da=distance(a),db=distance(b);
      if(da>=0)clipped.push(a);
      if((da>=0)!==(db>=0)) {
        const t=da/(da-db),v=a.map((value,j)=>value+(b[j]-value)*t); clipped.push(v);rim.push(v);
      }
    }
    for(let j=1;j<clipped.length-1;j++)output.push(clipped[0],clipped[j],clipped[j+1]);
  }
  const unique=[...new Map(rim.map(v=>[`${Math.round(v[0]*1e6)}:${Math.round(v[2]*1e6)}`,v])).values()];
  if(unique.length>=3) {
    const center=unique.reduce((sum,v)=>[sum[0]+v[0]/unique.length,sum[1]+v[1]/unique.length,sum[2]+v[2]/unique.length],[0,0,0]);
    unique.sort((a,b)=>Math.atan2(a[2]-center[2],a[0]-center[0])-Math.atan2(b[2]-center[2],b[0]-center[0]));
    const normal=new THREE.Vector3(.12,1,-.08).normalize().multiplyScalar(positive?-1:1);
    const cap=(v:number[]):Vertex=>[...v.slice(0,3),normal.x,normal.y,normal.z,v[0]*3,v[2]*3,3,1];
    for(let i=0;i<unique.length;i++) {
      const a=cap(unique[i]),b=cap(unique[(i+1)%unique.length]);
      output.push(cap(center),...(positive?[a,b]:[b,a]));
    }
  }
  const result=new THREE.BufferGeometry();
  for(const [name,start,width]of [['position',0,3],['normal',3,3],['uv',6,2],['bundleSurface',8,2]]as const)
    result.setAttribute(name,new THREE.Float32BufferAttribute(output.flatMap(v=>v.slice(start,start+width)),width));
  return result;
}

/** Closed canvas cross section swept around the nine sticks. Four authored
 * quarters per wrap also become the actual thrown strap pieces. */
function wrap(y: number, quarter: number, phase: number): THREE.BufferGeometry {
  const positions: number[] = [], uv: number[] = [], indices: number[] = [];
  const profile = [[-.088, -.012], [-.094, .002], [-.079, .014], [-.061, .008],
    [.061, .008], [.079, .014], [.094, .002], [.088, -.012]];
  const path = new THREE.Shape();
  const edge = .497, corner = .345;
  path.moveTo(edge, -corner); path.lineTo(edge, corner); path.quadraticCurveTo(edge, edge, corner, edge);
  path.lineTo(-corner, edge); path.quadraticCurveTo(-edge, edge, -edge, corner);
  path.lineTo(-edge, -corner); path.quadraticCurveTo(-edge, -edge, -corner, -edge);
  path.lineTo(corner, -edge); path.quadraticCurveTo(edge, -edge, edge, -corner);
  const outline = path.getSpacedPoints(96), segments = 96;
  for (let i = 0; i <= segments; i++) {
    const u = i / segments, angle = u * Math.PI * 2, p = outline[i];
    const before = outline[(i + segments - 1) % segments], after = outline[(i + 1) % segments];
    const outward = new THREE.Vector2(after.y - before.y, before.x - after.x).normalize();
    for (let j = 0; j < profile.length; j++) {
      const [height, offset] = profile[j];
      const crease = Math.sin(angle * 11 + phase + height * 18) * .0025 + Math.sin(angle * 5 + phase) * .003;
      positions.push(p.x + outward.x * (offset + crease), y + height + Math.sin(angle * 3 + phase) * .006, p.y + outward.y * (offset + crease));
      uv.push(u, (height + .094) / .188);
    }
  }
  const rings = profile.length;
  for (let i = 0; i < segments; i++) for (let j = 0; j < rings; j++) {
    const a = i * rings + j, b = i * rings + (j + 1) % rings, c = a + rings, d = b + rings;
    indices.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(indices); g.computeVertexNormals();
  const n = g.getAttribute('normal'), normal = new THREE.Vector3();
  for (let j = 0; j < rings; j++) {
    normal.set(n.getX(j)+n.getX(segments*rings+j),n.getY(j)+n.getY(segments*rings+j),n.getZ(j)+n.getZ(segments*rings+j)).normalize();
    n.setXYZ(j,normal.x,normal.y,normal.z); n.setXYZ(segments*rings+j,normal.x,normal.y,normal.z);
  }
  const flat = g.toNonIndexed(); g.dispose();
  const part = new THREE.BufferGeometry(), start = quarter * 24 * rings * 6, end = start + 24 * rings * 6;
  for (const name of ['position','normal','uv']) {
    const attribute=flat.getAttribute(name);
    part.setAttribute(name,new THREE.Float32BufferAttribute(attribute.array.slice(start*attribute.itemSize,end*attribute.itemSize),attribute.itemSize));
  }
  flat.dispose();
  const capPositions = Array.from(part.getAttribute('position').array), capNormals = Array.from(part.getAttribute('normal').array), capUvs = Array.from(part.getAttribute('uv').array);
  const baseCount = capPositions.length / 3;
  for (const end of [0, 1]) {
    const ring = (quarter + end) * 24, u = ring / segments;
    const before = outline[(ring + segments - 1) % segments], after = outline[(ring + 1) % segments];
    const normal = new THREE.Vector3(after.x - before.x, 0, after.y - before.y).normalize().multiplyScalar(end ? 1 : -1);
    const points = profile.map((_, j) => new THREE.Vector3().fromArray(positions, (ring * rings + j) * 3));
    const center = points.reduce((v, p) => v.addScaledVector(p, 1 / rings), new THREE.Vector3());
    for (let j = 0; j < rings; j++) {
      let a = points[j], b = points[(j + 1) % rings];
      if (a.clone().sub(center).cross(b.clone().sub(center)).dot(normal) < 0) [a, b] = [b, a];
      for (const p of [center, a, b]) { capPositions.push(p.x,p.y,p.z); capNormals.push(normal.x,normal.y,normal.z); capUvs.push(u,(p.y-y+.094)/.188); }
    }
  }
  part.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3)); part.setAttribute('normal',new THREE.Float32BufferAttribute(capNormals,3)); part.setAttribute('uv',new THREE.Float32BufferAttribute(capUvs,2));
  surface(part,1); const regions=part.getAttribute('bundleSurface');
  for(let i=baseCount;i<regions.count;i++)regions.setY(i,.65);
  return part;
}
function stitches(y: number): THREE.BufferGeometry {
  const pieces: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 5; i++) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(.453, y - .067 + i * .033, -.25),
      new THREE.Vector3(.499, y - .067 + i * .033, -.24),
      new THREE.Vector3(.503, y - .065 + i * .033, -.205),
      new THREE.Vector3(.469, y - .061 + i * .033, -.195),
    ]);
    pieces.push(normalize(new THREE.TubeGeometry(curve, 7, .006, 4, false)));
  }
  const g = mergeGeometries(pieces)!; pieces.forEach(p => p.dispose()); return surface(g, 2);
}
export function currentExplosiveTemplate(): BundleTemplate | undefined { return template; }
export function explosiveFragments(): CrateFragment[] | undefined { return template?.fragments; }
export function explosiveFallbackGeometry(): THREE.BufferGeometry {
  if (fallbackGeometry) return fallbackGeometry;
  const parts: THREE.BufferGeometry[] = [];
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++)
    parts.push(normalize(new THREE.CylinderGeometry(.154, .16, .96, 12, 1).translate(x * .311, -.02, z * .311)));
  fallbackGeometry = shared(mergeGeometries(parts)!); parts.forEach(g => g.dispose()); return fallbackGeometry;
}
export function prepareCrateExplosives(): Promise<BundleTemplate> {
  if (pending) return pending;
  pending = new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/crate-family/explosive-stick.glb`).then(gltf => {
    const sourceParts: THREE.BufferGeometry[] = []; let material: THREE.MeshStandardMaterial | undefined;
    gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      sourceParts.push(normalize(obj.geometry.clone().applyMatrix4(obj.matrixWorld)));
      material ??= (Array.isArray(obj.material) ? obj.material[0] : obj.material).clone();
    });
    if (!material || !sourceParts.length) throw new Error('Explosive stick has no surface');
    const source = mergeGeometries(sourceParts)!; sourceParts.forEach(g => g.dispose()); source.computeBoundingBox();
    const size = source.boundingBox!.getSize(new THREE.Vector3()), center = source.boundingBox!.getCenter(new THREE.Vector3());
    source.translate(-center.x, -center.y, -center.z); source.scale(.326 / size.x, .97 / size.y, .326 / size.z);
    const fragments: CrateFragment[] = [];
    for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) {
      const index = (z + 1) * 3 + x + 1, g = source.clone();
      const height = .96 + ((index * 7) % 5) * .011;
      g.scale(1 + Math.sin(index * 7) * .018, height, 1 + Math.cos(index * 3) * .018);
      g.rotateY(index * 2.39996); g.translate(x * .311, -.5 + .485 * height, z * .311);
      surface(g, 0, .96 + (index % 4) * .025);
      for(const positive of [false,true])fragments.push(fragment(splitStick(g,-.04+Math.sin(index*5)*.035,positive)));
      g.dispose();
    }
    source.dispose();
    for (const [index, y] of [-.255, .185].entries()) {
      for (let quarter = 0; quarter < 4; quarter++) fragments.push(fragment(wrap(y, quarter, index * 2.1)));
      fragments.push(fragment(stitches(y)));
    }
    const geometry = shared(mergeGeometries(fragments.map(f => f.exterior))!);
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    material.roughness = .84; material.metalness = 0; material.side = THREE.FrontSide;
    material.normalScale.setScalar(.45); shared(material);
    if (material.map) { material.map.anisotropy = 8; shared(material.map); }
    template = { geometry, material, fragments }; return template;
  });
  return pending;
}
export function createExplosiveMaterial(nitro: boolean): ExplosiveArt | undefined {
  if (!template) return undefined;
  const material = template.material.clone(), pulse = { value: nitro ? .7 : 0 };
  material.userData.shared = false; material.userData.levelDepthFade = false;
  material.name = nitro ? 'Glowing green paper and matte hazard canvas' : 'Vermilion paper and plain khaki canvas';
  material.onBeforeCompile = shader => {
    shader.uniforms.bundlePulse = pulse;
    shader.vertexShader = `attribute vec2 bundleSurface; varying vec2 vBundleSurface; varying vec2 vBundleUv;\n${shader.vertexShader}`
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBundleSurface=bundleSurface; vBundleUv=uv;');
    shader.fragmentShader = `uniform float bundlePulse; varying vec2 vBundleSurface; varying vec2 vBundleUv;\n${shader.fragmentShader}`
      .replace('#include <map_fragment>', `#include <map_fragment>
        float paper = 1.0-step(.5, vBundleSurface.x);
        float red = smoothstep(1.6, 2.8, diffuseColor.r / max(.015,diffuseColor.g));
        ${nitro ? `vec3 green = vec3(diffuseColor.g * .10 + diffuseColor.r * .08, diffuseColor.r * .78, diffuseColor.b * .06 + .002);
        diffuseColor.rgb = mix(diffuseColor.rgb, green, red * paper);` : ''}
        if(vBundleSurface.x>.5) {
          float hem = 1.0-smoothstep(.01,.10,vBundleUv.y)+smoothstep(.90,.99,vBundleUv.y);
          float weave = .95+.025*sin(vBundleUv.x*1900.0)*sin(vBundleUv.y*140.0)+.035*sin(vBundleUv.x*47.0+sin(vBundleUv.y*5.0));
          vec3 canvas = vec3(.48,.29,.115)*(1.0+hem*.22);
          ${nitro ? `float stripe = sin((vBundleUv.x*17.0-vBundleUv.y*.42)*6.2831853);
          float edge = max(fwidth(stripe),.01);
          canvas = mix(vec3(.023,.031,.029),vec3(.91,.54,.018),smoothstep(-edge,edge,stripe))*(1.0+hem*.17);` : ''}
          if(vBundleSurface.x>1.5)canvas=vec3(.67,.42,.16);
          if(vBundleSurface.x>2.5) {
            canvas=${nitro?'vec3(.025,.12,.003)':'vec3(.055,.022,.008)'};
            weave=1.0;
          }
          diffuseColor.rgb=canvas*weave;
        }
        diffuseColor.rgb*=vBundleSurface.y;
        float glowMask = paper*red*max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
      `).replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += glowMask*bundlePulse*${nitro ? 'vec3(.035,.24,.002)' : 'vec3(.35,.018,.002)'};
      `);
  };
  material.customProgramCacheKey = () => `sculpted-explosive-bundle-v1:${nitro}`;
  return { material, pulse, nitro };
}
export function updateExplosiveArt(art: ExplosiveArt, remaining: number | undefined, time: number): void {
  art.pulse.value = art.nitro ? .64 + .22 * Math.pow(.5 + .5 * Math.sin(time * 3.8), 2)
    : remaining === undefined ? 0 : .45 * Math.pow(.5 + .5 * Math.sin(time * (7 + (3 - remaining) * 3)), 6);
}
