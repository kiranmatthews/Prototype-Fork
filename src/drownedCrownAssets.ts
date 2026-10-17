import * as THREE from 'three';
import type { CustomComponent } from './level';
import type { UnityOceanParams } from './unityOcean';
import { DROWNED_CROWN_MODELS } from './drownedCrownAssets.generated';
import { DROWNED_CROWN_SCULPTURES } from './drownedCrownSculpture';
import { DROWNED_CROWN_SHIP_ASSETS } from './drownedCrownShip.generated';
import { DROWNED_CROWN_EXCELLENCE_MODELS } from './drownedCrownExcellence.generated';
import { DROWNED_CROWN_BOARD_MODELS } from './drownedCrownBoards.generated';
import { DROWNED_CROWN_EXTERIOR_MODELS } from './drownedCrownExterior.generated';
import { DROWNED_CROWN_SECTION_MODELS } from './drownedCrownSections.generated';
import { DROWNED_CROWN_ARCH_MODELS } from './drownedCrownArch.generated';
import { DROWNED_CROWN_GALLERY_MODELS } from './drownedCrownGallery.generated';
import { DROWNED_CROWN_COASTAL_MODELS } from './drownedCrownCoastal.generated';

/** Source-owned local assets; imported editor data cannot introduce URLs. */
export const DROWNED_CROWN_ASSETS={
 ...DROWNED_CROWN_MODELS,
 ...DROWNED_CROWN_SCULPTURES,
 ...DROWNED_CROWN_SHIP_ASSETS,
 ...DROWNED_CROWN_EXCELLENCE_MODELS,
 ...DROWNED_CROWN_BOARD_MODELS,
 ...DROWNED_CROWN_SECTION_MODELS,
 ...DROWNED_CROWN_EXTERIOR_MODELS,
 ...DROWNED_CROWN_ARCH_MODELS,
 ...DROWNED_CROWN_GALLERY_MODELS,
 ...DROWNED_CROWN_COASTAL_MODELS,
 crownexitbay:{file:"",image:"drowned-crown/exit-bay.webp",label:"Drowned Crown · daylight bay beyond the vault",size:[42,23.625,.02],wind:false,matte:true,edgeFade:0,fog:false},
 crownharbourmatte:{file:'',image:'drowned-crown/harbour-matte.webp',label:'Drowned Crown · distant Port Royal',size:[200,66.67,.02],wind:false,matte:true,edgeFade:.025,fog:true},
 crowncavernmatte:{file:'',image:'drowned-crown/cavern-matte.webp',label:'Drowned Crown · moonpool cavern depth',size:[160,80,.02],wind:false,matte:true,edgeFade:.06,fog:true},
} as const;

export const CROWN_TEXTURE_KINDS=['crown-timber','crown-limestone','crown-canvas','crown-coins','crown-bilge-paint'] as const;
export type CrownTexture=typeof CROWN_TEXTURE_KINDS[number];
export function isCrownTexture(kind:string|undefined):kind is CrownTexture {
 return !!kind&&(CROWN_TEXTURE_KINDS as readonly string[]).includes(kind);
}
export function crownTextureFile(kind:CrownTexture):string{return kind==='crown-bilge-paint'?'waterslide/fiberglass.webp':`drowned-crown/${kind.slice(6)}.webp`;}
export function createCrownSurface(c:CustomComponent,map:THREE.Texture):THREE.MeshStandardMaterial|THREE.MeshPhongMaterial {
 // Reuse the existing painted-surface atlas at metre scale. Matching the
 // native ramp's Phong response keeps the bowl floor and transition seamless.
 if(c.tex==='crown-bilge-paint')return new THREE.MeshPhongMaterial({map,
  color:c.color??'#ffffff',vertexColors:!!c.colors,specular:0x1a1c20,shininess:12,
  side:c.doubleSided?THREE.DoubleSide:THREE.FrontSide,fog:c.fog!==false});
 const stone=c.tex==='crown-limestone',gold=c.tex==='crown-coins',cloth=c.tex==='crown-canvas';
 const material=new THREE.MeshStandardMaterial({map,bumpMap:map,bumpScale:stone?.085:cloth?.012:.035,
  roughness:stone?.9:gold?.56:cloth?.96:.73,metalness:gold?.42:0,
  color:c.color??'#ffffff',vertexColors:!!c.colors,emissive:c.emissive??'#000000',
  opacity:c.opacity??1,transparent:(c.opacity??1)<1,fog:c.fog!==false,
  side:c.doubleSided?THREE.DoubleSide:THREE.FrontSide});
 if(stone&&c.nm?.startsWith('Harbour')){
  material.onBeforeCompile=shader=>{
   shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
    float limestoneValue=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
    diffuseColor.rgb=mix(diffuseColor.rgb,limestoneValue*vec3(1.08,1.055,.96),.45)*3.25;
   `);
  };material.customProgramCacheKey=()=> 'crown-exterior-limestone-v1';
 }
 return material;
}

export function isCrownWater(c:CustomComponent):boolean {
 return c.nm==='Still luminous underground sea'||c.nm==='Harbour · open Caribbean water';
}
export function crownWaterReflectionFile(c:CustomComponent):string {
 return c.nm?.startsWith('Harbour')?'drowned-crown/sky.webp':'drowned-crown/cavern-matte.webp';
}
/** Sheltered water borrows the authored scenery paintings for a small, local
 * reflection. All motion is shading; collision and the waterline stay fixed. */
export function createCrownWater(clock:{value:number},c:CustomComponent,reflection:THREE.Texture):THREE.MeshStandardMaterial {
 reflection.colorSpace=THREE.SRGBColorSpace;reflection.wrapS=THREE.RepeatWrapping;reflection.anisotropy=4;
 const harbour=c.nm?.startsWith('Harbour')===true;
 const material=new THREE.MeshStandardMaterial({color:harbour?'#174b56':c.color??'#246e7a',map:reflection,roughness:harbour?.34:.32,metalness:harbour?.02:.08,
  emissive:c.emissive??'#05282c',side:THREE.DoubleSide});
 material.userData.waterSurface=true;material.userData.noWaterShore=true;
 material.onBeforeCompile=shader=>{
  shader.uniforms.uCrownTime=clock;
  const shared='uniform float uCrownTime; varying vec3 vCrownWaterWorld;\n';
  shader.vertexShader=shared+shader.vertexShader.replace('#include <begin_vertex>',
   '#include <begin_vertex>\nvCrownWaterWorld=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader=shared+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','');
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   vec2 crownXZ=vCrownWaterWorld.xz;
   float crownRipples=sin(crownXZ.x*1.8+crownXZ.y*.9+uCrownTime*.65)*sin(crownXZ.y*2.6-crownXZ.x*.4-uCrownTime*.45);
   float crownGlints=pow(max(0.0,crownRipples),9.0);
   diffuseColor.rgb*=${harbour?'.82+.035*crownRipples':'.83+.14*crownRipples'};
   diffuseColor.rgb+=vec3(.035,.14,.14)*crownGlints*${harbour?'0.0':'1.0'};`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec3 crownN=normalize(vec3(.065*cos(crownXZ.x*.65+crownXZ.y*.25+uCrownTime*.6)+.025*cos(crownXZ.x*3.1-uCrownTime),1.0,
    .055*sin(crownXZ.y*.82-crownXZ.x*.22-uCrownTime*.45)+.02*sin(crownXZ.y*3.7+uCrownTime*.8)));
   normal=normalize(mat3(viewMatrix)*crownN);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',`#include <lights_fragment_end>
   vec3 crownEye=normalize(cameraPosition-vCrownWaterWorld);
   vec3 crownR=reflect(-crownEye,crownN);
   float crownF=pow(1.0-max(0.0,dot(crownEye,crownN)),3.0);
   vec2 crownUV=${harbour?'vec2(atan(crownR.z,-crownR.x)*.15915494+.17,clamp(.333+asin(clamp(crownR.y,-1.0,1.0))*.31831,.02,.98))':'vec2(atan(crownR.x,crownR.z)*.15915494+.5,clamp(.33+crownR.y*.55,.12,.88))'};
   vec3 crownReflection=texture2D(map,crownUV+crownN.xz*.13).rgb;
   totalEmissiveRadiance+=crownReflection*${harbour?'(.06+.3*crownF)':'(.08+.2*crownF)'}+vec3(.025,.08,.08)*crownGlints*${harbour?'0.0':'1.0'};`);
 };
 material.customProgramCacheKey=()=> 'drowned-crown-sheltered-water-v2-'+harbour;
 material.name=c.nm??'Drowned Crown water';return material;
}

/** Restrained sheltered-bay look for the shared reflected ocean renderer. */
export function createDrownedHarbourOceanLook():Partial<UnityOceanParams>{
 return {
  shallow:{r:.035,g:.34,b:.37,a:.94},deep:{r:.012,g:.13,b:.19,a:1},
  peak:{r:.30,g:.62,b:.62,a:.12},shadow:{r:.025,g:.045,b:.055,a:.5},
  specular:{r:2.7,g:2.25,b:1.55,a:.6},intersection:{r:.68,g:.79,b:.72,a:.27},
  wave1Length:22,wave1Height:.07,wave1Speed:.3,wave1Sharpness:.65,
  wave2Length:13,wave2Height:.045,wave2Speed:.38,wave2Sharpness:.7,
  normalStrength:.78,normalScale:4.2,normalDistanceStrength:.65,normalPan:.18,
  reflectionStrength:.50,reflectionFresnel:4.3,reflectionDistortion:.26,
  refractionStrength:.025,refractionDistance:.035,refractionFade:1,depthDistance:2.8,
  specularSpread:.28,specularHardness:.68,specularSize:.085,
  causticsStrength:.28,causticsScale:.7,causticsPan:.21,
  intersectionWidth:.22,intersectionDissolve:.8,intersectionEdgeFade:.85,
  shorelineEnabled:0,shorelineAlpha:0,
 };
}
