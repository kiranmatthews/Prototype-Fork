import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The six former milk-drop slots now own actual sculpt and crown variations.
 * Dimensions are in the existing unit pickup envelope, before MILK_SIZE. */
export const FRUIT_VARIANTS = [
  { name: 'Classic', width: 1, height: 1, taper: .13, lean: .018, blush: 0, leaves: 3, crown: .1 },
  { name: 'Golden pear', width: .91, height: 1.04, taper: .22, lean: -.025, blush: .055, leaves: 2, crown: -.25 },
  { name: 'Ruby cheek', width: 1.04, height: .96, taper: .08, lean: .026, blush: -.045, leaves: 3, crown: .4 },
  { name: 'Round ripe', width: 1.10, height: .91, taper: .035, lean: -.012, blush: .015, leaves: 2, crown: .65 },
  { name: 'Long mango', width: .90, height: 1.07, taper: .15, lean: .045, blush: .025, leaves: 3, crown: -.5 },
  { name: 'Wild gold', width: .99, height: .98, taper: .18, lean: -.038, blush: -.015, leaves: 2, crown: -.8 },
] as const;

const green = new THREE.Color('#79ac28'), gold = new THREE.Color('#f5ce39');
const orange = new THREE.Color('#f69a20'), red = new THREE.Color('#d93820');
const leafDark = new THREE.Color('#28722b'), leafLight = new THREE.Color('#9dbb37');
const barkDark = new THREE.Color('#664023'), barkLight = new THREE.Color('#ad7d40');
const color = new THREE.Color();
const smooth = THREE.MathUtils.smoothstep;

/** Linear-light vertex colour; the broad gradient stays legible at game scale. */
export function fruitSkinColor(y: number, x = 0, z = 0, variant = 0, out = new THREE.Color()): THREE.Color {
  const spec = FRUIT_VARIANTS[variant];
  const h = y + spec.blush + .025 * Math.sin(x * 9 + z * 5 + variant);
  out.copy(green).lerp(gold, smooth(h, -.42, -.23));
  out.lerp(orange, smooth(h, -.16, .13));
  out.lerp(red, smooth(h, -.015, .25));
  // A warm sun-side cheek, never a hard painted stripe.
  const cheek = smooth(x * .7 + z * .5, -.18, .35) * smooth(h, -.05, .27);
  return out.lerp(red, cheek * .17);
}

function attributes(g: THREE.BufferGeometry, part: number, tint: (x:number,y:number,z:number,i:number)=>THREE.Color): void {
  const p = g.getAttribute('position'), rgb = [], parts = [];
  for (let i = 0; i < p.count; i++) {
    const c = tint(p.getX(i),p.getY(i),p.getZ(i),i);
    rgb.push(c.r,c.g,c.b);parts.push(part);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  g.setAttribute('fruitPart',new THREE.Float32BufferAttribute(parts,1));
  if (!g.hasAttribute('uv')) g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));
}

function body(variant: number): THREE.BufferGeometry {
  const spec = FRUIT_VARIANTS[variant];
  const sphere = new THREE.SphereGeometry(1,40,28);
  sphere.deleteAttribute('normal');sphere.deleteAttribute('uv');
  const g = mergeVertices(sphere);sphere.dispose();
  const p = g.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z);
    // Unequal cheeks, broad shoulders and a shallow stem socket. The lower
    // reservoir of the milk silhouette is retained without its pointed neck.
    const lobes=1+.025*Math.cos(3*a+variant*.7)*r*r+.018*Math.sin(a*2+.6)*r;
    const width=(.85-spec.taper*y)*lobes;
    const socket=y>0?.050*Math.exp(-r*r/ .035):-.014*Math.exp(-r*r/.045);
    p.setXYZ(i,x*.49*width*spec.width+spec.lean*y*r,
      -.045+y*.395*spec.height-socket,z*.46*width*(1+.025*Math.cos(variant)));
  }
  g.computeVertexNormals();
  attributes(g,0,(x,y,z)=>fruitSkinColor(y,x,z,variant,color));
  return g;
}

/** Closed, folded leaf volume. A raised midrib, rolled edges and a curved tip
 * read in silhouette; fine veins belong to the material, not floating tubes. */
function leaf(variant: number, index: number): THREE.BufferGeometry {
  const spec=FRUIT_VARIANTS[variant], p:number[]=[],uv:number[]=[],tri:number[]=[];
  const rows=18,sides=12,length=(index===2?.29:.43)*(1+.06*Math.sin(variant+index));
  const width=index===2?.092:.132;
  const yaw=spec.crown + (index===0?-.12:index===1?Math.PI+.43:1.85);
  const cy=Math.cos(yaw),sy=Math.sin(yaw),socket=.305+.395*(spec.height-1);
  const add=(t:number,angle:number)=>{
    const s=Math.sin(Math.PI*t),w=width*Math.pow(s,.82)*(.65+.55*t);
    const across=Math.sin(angle),thickness=.009*s*Math.cos(angle);
    const along=.025+length*t,roll=(index===0?.85:index===1?-.8:.25)+.3*t,side=w*across*Math.cos(roll);
    const y=socket+.025+.13*Math.sin(Math.PI*t)-.19*t*t-.035*Math.abs(across)*s+thickness+w*across*Math.sin(roll);
    p.push(cy*along-sy*side,y,sy*along+cy*side);uv.push(t,.5+across*.5);
  };
  add(0,0);
  for(let row=1;row<rows;row++)for(let side=0;side<sides;side++)add(row/rows,side/sides*Math.PI*2);
  const end=p.length/3;add(1,0);
  for(let j=0;j<sides;j++)tri.push(0,1+j,1+(j+1)%sides);
  for(let r=0;r<rows-2;r++)for(let j=0;j<sides;j++){
    const a=1+r*sides+j,b=1+r*sides+(j+1)%sides,c=a+sides,d=b+sides;
    tri.push(a,c,b,b,c,d);
  }
  for(let j=0;j<sides;j++)tri.push(end,1+(rows-2)*sides+(j+1)%sides,1+(rows-2)*sides+j);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));
  for(let i=0;i<tri.length;i+=3)[tri[i+1],tri[i+2]]=[tri[i+2],tri[i+1]];
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(tri);g.computeVertexNormals();
  attributes(g,1,(_x,_y,_z,i)=>{
    const t=uv[i*2],v=uv[i*2+1];
    return color.copy(leafDark).lerp(leafLight,.28+.43*Math.sin(t*Math.PI)+.15*(1-Math.abs(v-.5)*2));
  });
  return g;
}

function stalk(variant:number): THREE.BufferGeometry {
  const spec=FRUIT_VARIANTS[variant], y=.305+.395*(spec.height-1);
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,y-.015,0),new THREE.Vector3(.014,y+.07,-.008),
    new THREE.Vector3(.055,y+.14,-.015),new THREE.Vector3(.084,y+.175,-.009),
  ]);
  const tube=new THREE.TubeGeometry(curve,10,.021,8,false);
  // End caps are included in the same surface, with a warm cut end.
  const cap=new THREE.SphereGeometry(.021,8,6);cap.translate(.084,y+.175,-.009);
  const base=new THREE.SphereGeometry(.023,8,6);base.translate(0,y-.015,0);
  const g=mergeGeometries([tube,cap,base])!;tube.dispose();cap.dispose();base.dispose();
  attributes(g,2,(x,py,z)=>color.copy(barkDark).lerp(barkLight,.35+.22*Math.sin(x*75+z*42)+.2*smooth(py,y+.13,y+.18)));
  return g;
}

export function buildFruitGeometry(variant=0): THREE.BufferGeometry {
  const id=((Math.trunc(variant)%FRUIT_VARIANTS.length)+FRUIT_VARIANTS.length)%FRUIT_VARIANTS.length;
  const parts=[body(id),...Array.from({length:FRUIT_VARIANTS[id].leaves},(_,i)=>leaf(id,i)),stalk(id)];
  const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
  g.computeBoundingBox();g.computeBoundingSphere();
  g.name=`Wumpa / ${FRUIT_VARIANTS[id].name} / complete fruit`;
  g.userData.shared=true;g.userData.fruitVariant=id;
  return g;
}

const surface = /* glsl */ `
varying vec3 vFruitPosition;
varying vec2 vFruitUV;
varying float vFruitPart;
float fruitHash(vec3 p) {
 p=fract(p*0.3183099+vec3(.1,.2,.3));p*=17.0;
 return fract(p.x*p.y*p.z*(p.x+p.y+p.z));
}
float fruitNoise(vec3 p) {
 vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(mix(fruitHash(i),fruitHash(i+vec3(1,0,0)),f.x),
 mix(fruitHash(i+vec3(0,1,0)),fruitHash(i+vec3(1,1,0)),f.x),f.y),
 mix(mix(fruitHash(i+vec3(0,0,1)),fruitHash(i+vec3(1,0,1)),f.x),
 mix(fruitHash(i+vec3(0,1,1)),fruitHash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
`;

/** Real scene lighting, dielectric response and soft velvet sheen. No wet
 * clearcoat, painted highlight or camera-fixed key. Texture coordinates stay
 * on the undeformed skin, including the instanced morph path and reflections. */
export class FruitMaterial extends THREE.MeshPhysicalMaterial {
  constructor() {
    super({color:0xffffff,vertexColors:true,roughness:.86,metalness:0,
      sheen:.32,sheenColor:0xffc887,sheenRoughness:.95,specularIntensity:.18,
      clearcoat:0,emissive:0xffffff,emissiveIntensity:.025});
    this.name='Wumpa / peach skin, leaf and stalk';
    this.userData.levelDepthFade=false;
    this.onBeforeCompile=shader=>{
      shader.vertexShader='attribute float fruitPart;\nvarying float vFruitPart;\nvarying vec3 vFruitPosition;\nvarying vec2 vFruitUV;\n'+shader.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\nvFruitPosition=position;vFruitUV=uv;vFruitPart=fruitPart;');
      shader.fragmentShader=surface+shader.fragmentShader
        .replace('#include <color_fragment>',`#include <color_fragment>
 float fruitSkin=1.0-step(.5,vFruitPart);
 float fruitLeaf=step(.5,vFruitPart)*(1.0-step(1.5,vFruitPart));
 float grainFade=1.0-smoothstep(.002,.018,length(fwidth(vFruitPosition)));
 float grain=fruitNoise(vFruitPosition*210.0);
 float mottle=fruitNoise(vFruitPosition*24.0)*.6+fruitNoise(vFruitPosition*53.0)*.4;
 float midrib=exp(-pow((vFruitUV.y-.5)*55.0,2.0));
 float veinPhase=vFruitUV.x*9.0-abs(vFruitUV.y-.5)*2.6;
 float veinDistance=abs(fract(veinPhase+.5)-.5);
 float veins=(1.0-smoothstep(.025,.07+fwidth(veinPhase),veinDistance))*(1.0-smoothstep(.32,.48,abs(vFruitUV.y-.5)));
 diffuseColor.rgb*=1.0+fruitSkin*((mottle-.5)*.13+(grain-.5)*.055*grainFade);
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.25,1.14,.77),fruitLeaf*clamp(midrib*.54+veins*.24,0.0,.65));`)
        .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(.63,.87+(grain-.5)*.055*grainFade,fruitSkin);
 roughnessFactor=mix(roughnessFactor,.9,step(1.5,vFruitPart));`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 // Filtered sub-pixel pores: subtle at native resolution, quiet at distance.
 vec3 fruitQx=dFdx(vViewPosition),fruitQy=dFdy(vViewPosition);
 vec3 fruitRx=cross(fruitQy,normal),fruitRy=cross(normal,fruitQx);
 float fruitDet=dot(fruitQx,fruitRx);
 float relief=(grain-.5)*.000055*grainFade*fruitSkin;
 vec3 fruitGradient=sign(fruitDet)*(dFdx(relief)*fruitRx+dFdy(relief)*fruitRy);
 normal=normalize(abs(fruitDet)*normal-fruitGradient+normal*1e-10);`)
        .replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance*=diffuseColor.rgb;')
        .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor*=fruitSkin;\n#endif');
    };
  }
  customProgramCacheKey():string{return 'wumpa-peach-skin-v1';}
}
