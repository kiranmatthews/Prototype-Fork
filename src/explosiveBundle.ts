import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CONST } from './tuning';

export interface ExplosiveBundle {
  body: THREE.Mesh<THREE.BoxGeometry, THREE.MeshLambertMaterial>;
  visual: THREE.Group;
  nitro: boolean;
  ready: Promise<void>;
  loaded: boolean;
  disposed: boolean;
  pending: boolean;
  remaining: number | undefined;
  clock: number;
  pulse: {value:number};
  fuseFraction: {value:number};
  fuseLit: {value:number};
  ember?: THREE.Group;
  sparks?: THREE.LineSegments;
}
interface Template {geometry:THREE.BufferGeometry;material:THREE.MeshStandardMaterial}
const templates=new Map<boolean,Promise<Template>>();
const shared=<T extends THREE.BufferGeometry|THREE.Material|THREE.Texture>(value:T):T=>{value.userData.shared=true;value.userData.levelDepthFade=false;return value;};

/** Flat triangle ownership follows the actual strap geometry, not its damaged paint. */
function prepareGeometry(source:THREE.BufferGeometry):THREE.BufferGeometry {
  source.computeBoundingBox();const size=source.boundingBox!.getSize(new THREE.Vector3());source.center();source.scale(1/size.x,1/size.y,1/size.z);
  const geometry=source.index?source.toNonIndexed():source;
  if(geometry!==source)source.dispose();
  const p=geometry.attributes.position,band=new Float32Array(p.count);
  for(let i=0;i<p.count;i+=3){
    const low=Math.min(p.getY(i),p.getY(i+1),p.getY(i+2)),high=Math.max(p.getY(i),p.getY(i+1),p.getY(i+2));
    const strap=(low>=-.283&&high<=-.069)||(low>=.09&&high<=.295);
    if(strap)band.fill(1,i,i+3);
  }
  geometry.setAttribute('aBundleBand',new THREE.BufferAttribute(band,1));geometry.computeBoundingBox();geometry.computeBoundingSphere();return shared(geometry);
}
function template(nitro:boolean):Promise<Template>{
  let pending=templates.get(nitro);
  if(!pending){pending=new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}props/explosives/${nitro?'nitro':'tnt'}-bundle.glb`).then(gltf=>{
    let mesh:THREE.Mesh|undefined;gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if((o as THREE.Mesh).isMesh)mesh=o as THREE.Mesh;});
    if(!mesh)throw new Error('Bundle GLB has no mesh');
    const geometry=prepareGeometry(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));mesh.geometry.dispose();
    const material=mesh.material as THREE.MeshStandardMaterial;material.metalness=0;material.roughness=.8;material.normalScale.setScalar(.35);shared(material);
    for(const map of [material.map,material.normalMap,material.roughnessMap,material.metalnessMap])if(map){shared(map);map.anisotropy=4;}
    return {geometry,material};
  });templates.set(nitro,pending);}return pending;
}
function bundleMaterial(base:THREE.MeshStandardMaterial,pulse:{value:number},nitro:boolean):THREE.MeshStandardMaterial{
  const material=base.clone();material.userData.shared=false;material.userData.levelDepthFade=false;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uBundlePulse=pulse;
    shader.vertexShader='attribute float aBundleBand; varying float vBundleBand; varying vec3 vBundlePosition;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBundleBand=aBundleBand;vBundlePosition=position;');
    shader.fragmentShader='uniform float uBundlePulse; varying float vBundleBand; varying vec3 vBundlePosition;\n'+shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec3 paint=diffuseColor.rgb;
      float bodyMask=smoothstep(0.035,0.19,${nitro?'paint.g-max(paint.r,paint.b)':'paint.r-max(paint.g,paint.b)'})*(1.0-vBundleBand)${nitro?'':'*smoothstep(2.5,4.5,paint.r/max(0.01,max(paint.g,paint.b)))'};
      ${nitro?`vec2 q=vBundlePosition.xz/max(0.0001,2.0*max(abs(vBundlePosition.x),abs(vBundlePosition.z)));
      float perimeter=abs(q.x)>abs(q.y)?(q.x>0.0?1.5-q.y:3.5+q.y):(q.y>0.0?q.x+0.5:2.5-q.x);
      float stripe=sin(6.2831853*4.0*(perimeter-vBundlePosition.y));
      float edge=max(fwidth(stripe),0.005);
      vec3 warning=mix(vec3(0.008,0.012,0.015),vec3(1.0,0.66,0.008),smoothstep(-edge,edge,stripe));
      diffuseColor.rgb=mix(diffuseColor.rgb,warning,vBundleBand);`:''}
      diffuseColor.rgb*=1.0+bodyMask*uBundlePulse*0.75;
    `).replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      totalEmissiveRadiance+=bodyMask*uBundlePulse*${nitro?'vec3(0.10,0.42,0.004)':'vec3(0.48,0.018,0.003)'};
    `);
    if(nitro)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\nnormal=mix(normal,nonPerturbedNormal,vBundleBand);').replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=mix(roughnessFactor,0.72,vBundleBand);');
  };
  material.customProgramCacheKey=()=>`explosive-bundle-paint-v1:${nitro}`;
  return material;
}

/** The free end moves down this curve; rope below the burn front stays still. */
export function fusePoint(fraction:number,target=new THREE.Vector3()):THREE.Vector3{
  const t=THREE.MathUtils.clamp(fraction,0,1);
  return target.set(.06*Math.sin(t*1.7)*t,.502+.31*t,.02*Math.sin(t*2.1)*t);
}
export function explosivePulse(nitro:boolean,remaining:number|undefined,clock:number):number{
  if(nitro)return .12+.64*Math.pow(.5+.5*Math.sin(clock*Math.PI*2/1.1),2);
  if(remaining===undefined)return 0;
  const elapsed=CONST.tntFuse-THREE.MathUtils.clamp(remaining,0,CONST.tntFuse);
  return Math.pow(.5+.5*Math.cos(elapsed*Math.PI*2),6);
}
let ropeGeometry:THREE.BufferGeometry|undefined;
function braid():THREE.BufferGeometry{
  if(ropeGeometry)return ropeGeometry;
  const parts:THREE.BufferGeometry[]=[];
  for(let strand=0;strand<3;strand++){
    class Strand extends THREE.Curve<THREE.Vector3>{constructor(){super();}getPoint(t:number,target=new THREE.Vector3()):THREE.Vector3{
      fusePoint(t,target);const angle=t*Math.PI*8+strand*Math.PI*2/3;target.x+=Math.cos(angle)*.012;target.z+=Math.sin(angle)*.012;return target;
    }}
    const geometry=new THREE.TubeGeometry(new Strand(),48,.011,5,false),along=new Float32Array(geometry.attributes.position.count);
    for(let i=0;i<along.length;i++)along[i]=geometry.attributes.uv.getX(i);
    geometry.setAttribute('aFuseAlong',new THREE.BufferAttribute(along,1));parts.push(geometry);
  }
  ropeGeometry=shared(mergeGeometries(parts)!);parts.forEach(p=>p.dispose());return ropeGeometry;
}
let glowTexture:THREE.CanvasTexture|undefined;
function glowMap():THREE.CanvasTexture{
  if(glowTexture)return glowTexture;
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!;
  const gradient=ctx.createRadialGradient(32,32,0,32,32,32);gradient.addColorStop(0,'#ffffff');gradient.addColorStop(.15,'#ffffd7');gradient.addColorStop(.4,'#ffab2877');gradient.addColorStop(1,'#ff6a0000');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
  glowTexture=shared(new THREE.CanvasTexture(canvas));return glowTexture;
}
function addFuse(bundle:ExplosiveBundle):void{
  const rope=new THREE.MeshStandardMaterial({color:0x9b713d,roughness:.95});rope.userData.levelDepthFade=false;
  rope.onBeforeCompile=shader=>{
    shader.uniforms.uFuseFraction=bundle.fuseFraction;shader.uniforms.uFuseLit=bundle.fuseLit;
    shader.vertexShader='attribute float aFuseAlong;varying float vFuseAlong;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFuseAlong=aFuseAlong;');
    shader.fragmentShader='uniform float uFuseFraction;uniform float uFuseLit;varying float vFuseAlong;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      if(vFuseAlong>uFuseFraction)discard;
      float charred=(1.0-smoothstep(0.0,0.065,uFuseFraction-vFuseAlong))*uFuseLit;
      diffuseColor.rgb*=0.85+0.15*sin(vFuseAlong*430.0);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.018,0.009,0.003),charred);
    `);
  };
  rope.customProgramCacheKey=()=> 'tnt-burning-braid-v1';
  // Clipped rope does not cast a misleading full-length shadow after burning.
  const mesh=new THREE.Mesh(braid(),rope);mesh.name='Braided rope fuse';bundle.visual.add(mesh);
  const ember=bundle.ember=new THREE.Group();ember.name='Burning fuse tip';
  const core=new THREE.Mesh(new THREE.SphereGeometry(.028,8,6),new THREE.MeshBasicMaterial({color:new THREE.Color(3,2,.5),toneMapped:false}));
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:glowMap(),color:0xffc04a,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));glow.scale.setScalar(.18);ember.add(core,glow);bundle.visual.add(ember);
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(12*6),3).setUsage(THREE.DynamicDrawUsage));
  const sparks=bundle.sparks=new THREE.LineSegments(geometry,new THREE.LineBasicMaterial({color:new THREE.Color(2.8,.85,.03),transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}));sparks.frustumCulled=false;sparks.name='Fuse sparks';bundle.visual.add(sparks);
}
export function updateExplosiveBundle(bundle:ExplosiveBundle,remaining:number|undefined,clock:number,pending=false):void{
  bundle.remaining=remaining;bundle.clock=clock;bundle.pending=pending;
  bundle.body.material.visible=pending;bundle.visual.visible=!pending;
  bundle.pulse.value=explosivePulse(bundle.nitro,remaining,clock);
  bundle.fuseFraction.value=remaining===undefined?1:THREE.MathUtils.clamp(remaining/CONST.tntFuse,0,1);
  const lit=!bundle.nitro&&remaining!==undefined&&remaining>0&&!pending;bundle.fuseLit.value=lit?1:0;
  if(bundle.ember){bundle.ember.visible=lit;fusePoint(bundle.fuseFraction.value,bundle.ember.position);}
  if(bundle.sparks){
    bundle.sparks.visible=lit;
    if(lit){const positions=bundle.sparks.geometry.attributes.position,tip=bundle.ember!.position;
      for(let i=0;i<12;i++){const age=(clock*3.7+i*.083333)%1,angle=i*2.39996,dx=Math.cos(angle)*.16,dz=Math.sin(angle)*.16,dy=.12+(i%3)*.05;
        const x=tip.x+dx*age,y=tip.y+dy*age-.17*age*age,z=tip.z+dz*age,tail=.2*(1-age);
        positions.setXYZ(i*2,x,y,z);positions.setXYZ(i*2+1,x-dx*tail,y-(dy-.34*age)*tail,z-dz*tail);
      }positions.needsUpdate=true;
    }
  }
}
export function createExplosiveBundle(nitro:boolean,size=.96):ExplosiveBundle{
  const body=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),new THREE.MeshLambertMaterial({color:0xffffff,visible:false}));
  body.name=nitro?'Nitro dynamite bundle':'TNT dynamite bundle';const visual=new THREE.Group();visual.scale.setScalar(size);body.add(visual);
  const pulse={value:0};const fallbackGeometry=prepareGeometry(new THREE.BoxGeometry(1,1,1));fallbackGeometry.userData.shared=false;
  const base=new THREE.MeshStandardMaterial({color:nitro?0x67ed0a:0xc91812,roughness:.8});
  const model=new THREE.Mesh(fallbackGeometry,bundleMaterial(base,pulse,nitro));base.dispose();model.castShadow=model.receiveShadow=true;visual.add(model);
  const bundle:ExplosiveBundle={body,visual,nitro,pulse,ready:Promise.resolve(),loaded:false,disposed:false,pending:false,remaining:undefined,clock:0,fuseFraction:{value:1},fuseLit:{value:0}};
  if(!nitro)addFuse(bundle);updateExplosiveBundle(bundle,undefined,0);
  bundle.ready=template(nitro).then(asset=>{
    if(bundle.disposed)return;model.geometry.dispose();model.material.dispose();model.geometry=asset.geometry;model.material=bundleMaterial(asset.material,pulse,nitro);bundle.loaded=true;
    updateExplosiveBundle(bundle,bundle.remaining,bundle.clock,bundle.pending);
  }).catch(error=>{if(!bundle.disposed)console.warn('Explosive bundle GLB load failed; retaining playable fallback',error);});
  return bundle;
}
export function disposeExplosiveBundle(bundle:ExplosiveBundle):void{bundle.disposed=true;}
