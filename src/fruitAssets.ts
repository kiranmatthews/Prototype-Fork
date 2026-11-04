import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** The six former milk-drop slots now own actual sculpt and crown variations.
 * Dimensions are in the existing unit pickup envelope, before MILK_SIZE. */
export const FRUIT_VARIANTS = [
  { name: 'Classic', width: 1, height: 1.02, taper: .075, lean: .033, blush: -.025, leaves: 3, crown: -.12 },
  { name: 'Golden pear', width: .91, height: 1.06, taper: -.045, lean: -.035, blush: .025, leaves: 3, crown: .26 },
  { name: 'Ruby cheek', width: 1.08, height: .96, taper: .13, lean: .025, blush: -.065, leaves: 3, crown: .48 },
  { name: 'Round ripe', width: 1.08, height: .91, taper: .065, lean: -.024, blush: -.015, leaves: 2, crown: .65 },
  { name: 'Long mango', width: .87, height: 1.07, taper: .025, lean: .055, blush: .005, leaves: 3, crown: -.5 },
  { name: 'Wild gold', width: .97, height: 1, taper: .11, lean: -.045, blush: -.035, leaves: 2, crown: -.8 },
] as const;

interface CrownLeaf {
  yaw:number; length:number; width:number; rise:number; droop:number;
  roll:number; twist:number; sway:number;
}
// Individually posed crowns; variants are more than differently sized bodies.
// Distances stay inside the established pickup envelope.
const CROWNS: readonly (readonly CrownLeaf[])[] = [
  [
    {yaw:-.18,length:.40,width:.137,rise:.105,droop:.17,roll:.48,twist:.74,sway:.025},
    {yaw:3.49,length:.42,width:.125,rise:.12,droop:.20,roll:-.65,twist:.46,sway:-.022},
    {yaw:1.62,length:.315,width:.105,rise:.08,droop:.21,roll:.15,twist:.45,sway:.018},
  ],
  [
    {yaw:-.40,length:.35,width:.133,rise:.15,droop:.13,roll:.78,twist:-.18,sway:.020},
    {yaw:3.22,length:.43,width:.116,rise:.11,droop:.23,roll:-.42,twist:-.25,sway:-.018},
    {yaw:1.43,length:.30,width:.095,rise:.075,droop:.20,roll:.2,twist:.60,sway:.026},
  ],
  [
    {yaw:-.24,length:.37,width:.147,rise:.10,droop:.17,roll:.44,twist:.73,sway:.032},
    {yaw:3.64,length:.39,width:.141,rise:.13,droop:.15,roll:-.70,twist:.28,sway:-.018},
    {yaw:1.90,length:.33,width:.113,rise:.08,droop:.22,roll:.35,twist:-.22,sway:.022},
  ],
  [
    {yaw:-.05,length:.42,width:.147,rise:.11,droop:.19,roll:.52,twist:.61,sway:.024},
    {yaw:3.31,length:.37,width:.135,rise:.10,droop:.16,roll:-.52,twist:-.35,sway:-.026},
  ],
  [
    {yaw:-.22,length:.41,width:.119,rise:.105,droop:.22,roll:.61,twist:.52,sway:.031},
    {yaw:3.35,length:.37,width:.132,rise:.14,droop:.15,roll:-.58,twist:.38,sway:-.025},
    {yaw:1.54,length:.32,width:.10,rise:.08,droop:.205,roll:.21,twist:.67,sway:.021},
  ],
  [
    {yaw:-.15,length:.39,width:.127,rise:.14,droop:.16,roll:.62,twist:.54,sway:.030},
    {yaw:3.42,length:.43,width:.129,rise:.085,droop:.23,roll:-.37,twist:-.34,sway:-.021},
  ],
];

const green = new THREE.Color('#79d62a'), gold = new THREE.Color('#ffd32c');
const orange = new THREE.Color('#ff8616'), red = new THREE.Color('#ed3220');
const leafDark = new THREE.Color('#237522'), leafLight = new THREE.Color('#a5cf39');
const barkDark = new THREE.Color('#5c3020'), barkLight = new THREE.Color('#bb8847');
const color = new THREE.Color();
const smooth = THREE.MathUtils.smoothstep;

/** Linear-light vertex colour; the broad gradient stays legible at game scale. */
export function fruitSkinColor(y: number, x = 0, z = 0, variant = 0, out = new THREE.Color()): THREE.Color {
  const spec = FRUIT_VARIANTS[variant];
  const a = Math.atan2(z,x);
  // Ripeness follows the unequal cheeks, with green fingers climbing from
  // the base. Avoid three horizontal stripes across an otherwise plain oval.
  const h = y-spec.blush+.047*Math.sin(a+variant*.7)+.017*Math.sin(a*3+variant*.8)
    + .033*Math.sin(a*5+.6)*smooth(y,-.43,-.28)*(1-smooth(y,-.13,.05))
    - .060*smooth(Math.abs(x),.10,.33)*(1-smooth(y,-.13,.035));
  out.copy(green).lerp(gold, smooth(h, -.43, -.16));
  out.lerp(orange, smooth(h, -.21, .13));
  out.lerp(red, smooth(h, -.015, .29));
  const cheek = smooth(x*.7+z*.5,-.18,.35)*smooth(h,-.10,.24);
  out.lerp(red,cheek*.20);
  // Tiny stem recess occlusion, not a painted directional highlight.
  return out.multiplyScalar(1-.22*Math.exp(-(x*x+z*z)/.007)*smooth(y,.23,.32));
}

function attributes(g: THREE.BufferGeometry, part: number, tint: (x:number,y:number,z:number,i:number)=>THREE.Color): void {
  const p = g.getAttribute('position'), rgb = [], parts = [];
  for (let i = 0; i < p.count; i++) {
    const c = tint(p.getX(i),p.getY(i),p.getZ(i),i);
    rgb.push(c.r,c.g,c.b);parts.push(part);
  }
  g.setAttribute('color',new THREE.Float32BufferAttribute(rgb,3));
  g.setAttribute('fruitPart',new THREE.Float32BufferAttribute(parts,1));
  if (!g.hasAttribute('fruitFlex')) g.setAttribute('fruitFlex',new THREE.Float32BufferAttribute(new Float32Array(p.count),1));
  if (!g.hasAttribute('uv')) g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(p.count*2),2));
}

function body(variant: number): THREE.BufferGeometry {
  const spec = FRUIT_VARIANTS[variant];
  const sphere = new THREE.SphereGeometry(1,48,32);
  sphere.deleteAttribute('normal');sphere.deleteAttribute('uv');
  const g = mergeVertices(sphere);sphere.dispose();
  const p = g.getAttribute('position'),uv:number[]=[];
  for (let i = 0; i < p.count; i++) {
    const x=p.getX(i),y=p.getY(i),z=p.getZ(i),a=Math.atan2(z,x),r=Math.hypot(x,z);
    uv.push(a/(Math.PI*2)+.5,(y+1)*.5);
    // A mango's fuller shoulders, narrowing base and unequal fleshy cheeks.
    // The shallow suture and five-lobed socket change the normals and outline.
    const seamAngle=Math.atan2(Math.sin(a-1.18-spec.crown),Math.cos(a-1.18-spec.crown));
    const seam=.026*Math.exp(-seamAngle*seamAngle/.022)*r;
    const lobes=1+.040*Math.cos(2*a+variant*.6)*r+.017*Math.sin(3*a+.5)*r*r-seam;
    const width=(1+spec.taper*y-.045*y*y)*lobes;
    const socket=y>0?.072*Math.exp(-r*r/.065)*(1+.15*Math.cos(a*5)):-.018*Math.exp(-r*r/.05);
    p.setXYZ(i,x*.355*width*spec.width+spec.lean*r*(y+.35),
      -.055+y*.410*spec.height-socket,z*.335*width*(1+.035*Math.cos(variant))+.012*r*Math.sin(y*3+a));
  }
  g.computeVertexNormals();
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
  attributes(g,0,(x,y,z)=>fruitSkinColor(y,x,z,variant,color));
  return g;
}

/** Closed, folded leaf volume. A raised midrib, rolled edges and a curved tip
 * read in silhouette; fine veins belong to the material, not floating tubes. */
function leaf(variant: number, index: number): THREE.BufferGeometry {
  const spec=FRUIT_VARIANTS[variant], p:number[]=[],uv:number[]=[],tri:number[]=[];
  const pose=CROWNS[variant][index];
  const rows=24,sides=12,{length,width}=pose;
  const yaw=spec.crown+pose.yaw;
  const cy=Math.cos(yaw),sy=Math.sin(yaw),socket=.283+.410*(spec.height-1);
  const add=(t:number,angle:number)=>{
    const s=Math.sin(Math.PI*t),across=Math.sin(angle),edge=Math.abs(across);
    const w=width*Math.pow(s,.83)*(.72+.5*t)*(1+.012*Math.sin(t*18+index));
    const thickness=.0025*s*Math.cos(angle);
    const along=.012+length*t;
    const roll=pose.roll+pose.twist*Math.sin(t*2.5)*t;
    const fold=.025*s*(1-Math.pow(edge,1.3))-.009*s*edge*edge;
    const centre=socket+.020+pose.rise*Math.sin(Math.PI*t)-pose.droop*t*t;
    const crossY=fold+thickness+.008*Math.sin(t*19+index)*edge*edge*s;
    const side=w*across*Math.cos(roll)-crossY*Math.sin(roll)+pose.sway*s*Math.sin(t*3+index);
    const y=centre+crossY*Math.cos(roll)+w*across*Math.sin(roll);
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
    const edge=Math.abs(v-.5)*2;
    return color.copy(leafDark).lerp(leafLight,.25+.43*Math.sin(t*Math.PI)+.24*(1-edge));
  });
  g.setAttribute('fruitFlex',new THREE.Float32BufferAttribute(uv.filter((_,i)=>i%2===0).map(t=>t*t),1));
  return g;
}

function stalk(variant:number): THREE.BufferGeometry {
  const spec=FRUIT_VARIANTS[variant], y=.283+.410*(spec.height-1);
  const curve=new THREE.CatmullRomCurve3([
    new THREE.Vector3(0,y-.020,0),new THREE.Vector3(.008,y+.065,-.008),
    new THREE.Vector3(.053,y+.155,-.025),new THREE.Vector3(.095,y+.205,-.020),
  ]);
  const tube=new THREE.TubeGeometry(curve,16,.021,8,false),tp=tube.getAttribute('position');
  for(let i=0;i<tp.count;i++){
    const t=Math.floor(i/9)/16,c=curve.getPointAt(t),v=new THREE.Vector3().fromBufferAttribute(tp,i);
    const angle=((i%9)%8)*Math.PI/4;
    v.sub(c).multiplyScalar((1.12-.36*t)*(1+.045*Math.sin(angle*3+t*15))).add(c);tp.setXYZ(i,v.x,v.y,v.z);
  }
  tube.computeVertexNormals();
  const tn=tube.getAttribute('normal'),average=new THREE.Vector3();
  for(let row=0;row<=16;row++){
    const a=row*9,b=a+8;
    average.fromBufferAttribute(tn,a).add(new THREE.Vector3().fromBufferAttribute(tn,b)).normalize();
    tn.setXYZ(a,average.x,average.y,average.z);tn.setXYZ(b,average.x,average.y,average.z);
  }
  // Reuse the actual irregular end ring: a circular cap would leave tiny
  // cracks around the taper. Separate vertices retain the flat cut normal.
  const endCap=(row:number)=>{
    const t=row/16,c=curve.getPointAt(t),normal=curve.getTangentAt(t).multiplyScalar(row===0?-1:1);
    const p=c.toArray(),uv=[row===0?.5:2.5,.5],normals=normal.toArray(),tri:number[]=[];
    for(let i=0;i<8;i++){
      p.push(tp.getX(row*9+i),tp.getY(row*9+i),tp.getZ(row*9+i));
      uv.push((row===0?0:2)+.5+.5*Math.cos(i*Math.PI/4),.5+.5*Math.sin(i*Math.PI/4));normals.push(...normal.toArray());
    }
    const a=new THREE.Vector3().fromArray(p,3).sub(c),b=new THREE.Vector3().fromArray(p,6).sub(c);
    const forward=a.cross(b).dot(normal)>0;
    for(let i=0;i<8;i++)tri.push(0,forward?1+i:1+(i+1)%8,forward?1+(i+1)%8:1+i);
    const cap=new THREE.BufferGeometry();cap.setIndex(tri);
    cap.setAttribute('position',new THREE.Float32BufferAttribute(p,3));cap.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
    cap.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return cap;
  };
  const cap=endCap(16),base=endCap(0);
  const g=mergeGeometries([tube,cap,base])!;tube.dispose();cap.dispose();base.dispose();
  attributes(g,2,(x,py,z)=>color.copy(barkDark).lerp(barkLight,.28+.16*Math.sin(x*95+z*64)+.38*smooth(py,y+.190,y+.205)));
  const gp=g.getAttribute('position');
  g.setAttribute('fruitFlex',new THREE.Float32BufferAttribute(Array.from({length:gp.count},(_,i)=>.12*Math.pow(smooth(gp.getY(i),y,y+.205),2)),1));
  return g;
}

export function buildFruitGeometry(variant=0): THREE.BufferGeometry {
  const id=((Math.trunc(variant)%FRUIT_VARIANTS.length)+FRUIT_VARIANTS.length)%FRUIT_VARIANTS.length;
  const parts=[body(id),...Array.from({length:FRUIT_VARIANTS[id].leaves},(_,i)=>leaf(id,i)),stalk(id)];
  const stalkOffset=parts.slice(0,-1).reduce((sum,part)=>sum+part.getAttribute('position').count,0);
  const g=mergeGeometries(parts)!;parts.forEach(p=>p.dispose());
  g.computeBoundingBox();g.computeBoundingSphere();
  g.name=`Wumpa / ${FRUIT_VARIANTS[id].name} / complete fruit`;
  g.userData.shared=true;g.userData.fruitVariant=id;
  g.userData.fruitNormalSeams=Array.from({length:17},(_,row)=>[stalkOffset+row*9,stalkOffset+row*9+8]);
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
    super({color:0xffffff,vertexColors:true,roughness:.49,metalness:0,
      sheen:.5,sheenColor:0xffdfae,sheenRoughness:.8,specularIntensity:1,
      clearcoat:0});
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
 float grain=fruitNoise(vFruitPosition*350.0);
 float mottle=fruitNoise(vFruitPosition*19.0)*.65+fruitNoise(vFruitPosition*47.0)*.35;
 float midrib=exp(-pow((vFruitUV.y-.5)*65.0,2.0));
 float veinPhase=(vFruitUV.x-pow(abs(vFruitUV.y-.5)*2.0,.72)*(.12+.13*vFruitUV.x))*8.2;
 veinPhase+=.035*sin(vFruitUV.x*35.0+vFruitUV.y*11.0);
 float veinDistance=abs(fract(veinPhase+.5)-.5);
 float veins=(1.0-smoothstep(.018,.05+fwidth(veinPhase),veinDistance))*(1.0-smoothstep(.34,.49,abs(vFruitUV.y-.5)));
 float flecks=smoothstep(.70,.82,grain)*grainFade;
 diffuseColor.rgb*=1.0+fruitSkin*((mottle-.5)*.16+(grain-.5)*.045*grainFade-flecks*.045);
 float fineVeinPhase=veinPhase*4.0+vFruitUV.y*2.0;
 float fineVeins=(1.0-smoothstep(.02,.08+fwidth(fineVeinPhase),abs(fract(fineVeinPhase+.5)-.5)))*.12;
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.34,1.18,.78),fruitLeaf*clamp(midrib*.58+veins*.27+fineVeins,0.0,.8));
 float scar=fruitSkin*(1.0-smoothstep(.00015,.0009+.0002*sin(vFruitUV.x*31.4159),vFruitUV.y));
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.16,.065,.018),scar*.85);
 float wood=step(1.5,vFruitPart),cut=step(1.5,vFruitUV.x)*wood;
 float bark=sin(vFruitUV.y*50.2655+sin(vFruitUV.x*8.0)*.65)*.5+.5;
 float rings=sin(length(vec2(vFruitUV.x-2.5,vFruitUV.y-.5))*74.0)*.5+.5;
 diffuseColor.rgb*=1.0+wood*(1.0-cut)*(bark-.5)*.22;
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.235,.09)*(1.0+(rings-.5)*.18),cut);`)
        .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
 roughnessFactor=mix(.44,.49+(mottle-.5)*.12+(grain-.5)*.06*grainFade,fruitSkin);
 roughnessFactor=mix(roughnessFactor,.83,step(1.5,vFruitPart));`)
        .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 // Filtered sub-pixel pores: subtle at native resolution, quiet at distance.
 vec3 fruitQx=dFdx(vViewPosition),fruitQy=dFdy(vViewPosition);
 vec3 fruitRx=cross(fruitQy,normal),fruitRy=cross(normal,fruitQx);
 float fruitDet=dot(fruitQx,fruitRx);
 float relief=((grain-.5)*.00009*grainFade+(mottle-.5)*.00035)*fruitSkin
   +(midrib*.0014+veins*.00035+fineVeins*.0002)*fruitLeaf
   +wood*mix(bark*.0003,rings*.00009,cut);
 vec3 fruitGradient=sign(fruitDet)*(dFdx(relief)*fruitRx+dFdy(relief)*fruitRy);
 normal=normalize(abs(fruitDet)*normal-fruitGradient+normal*1e-10);`)
        .replace('#include <lights_physical_pars_fragment>',`#include <lights_physical_pars_fragment>
// Shallow flesh/leaf scattering follows actual scene lights and their shadows.
// It softens the terminator without turning the asset into an unlit billboard.
void RE_Direct_Fruit(const in IncidentLight light,const in vec3 gp,const in vec3 gn,
 const in vec3 gv,const in vec3 gc,const in PhysicalMaterial mat,inout ReflectedLight reflected) {
 RE_Direct_Physical(light,gp,gn,gv,gc,mat,reflected);
 float skin=1.0-step(.5,vFruitPart),leaf=step(.5,vFruitPart)*(1.0-step(1.5,vFruitPart));
 float nl=dot(gn,light.direction);
 float wrap=max((nl+.32)/1.32,0.0)-max(nl,0.0);
 float through=pow(max(-nl,0.0),2.0)*leaf*.28;
 reflected.directDiffuse+=(max(wrap,0.0)*(skin*.22+leaf*.16)+through)
   *light.color*BRDF_Lambert(mat.diffuseColor)*mix(vec3(.90,1.0,.48),vec3(1.0,.73,.38),skin);
}
#undef RE_Direct
#define RE_Direct RE_Direct_Fruit`)
        .replace('#include <lights_physical_fragment>','#include <lights_physical_fragment>\n#ifdef USE_SHEEN\nmaterial.sheenColor*=fruitSkin;\n#endif');
    };
  }
  customProgramCacheKey():string{return 'wumpa-sculpted-peach-v2';}
}
