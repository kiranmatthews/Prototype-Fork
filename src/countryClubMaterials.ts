import * as THREE from 'three';
import type {CustomComponent} from './level';

export const COUNTRY_CLUB_TEXTURES=['country-turf','country-gravel','country-sand'] as const;
export function isCountryClubTexture(kind:string|undefined):boolean {
  return COUNTRY_CLUB_TEXTURES.includes(kind as typeof COUNTRY_CLUB_TEXTURES[number]);
}
export function countryClubTextureFile(kind:string):string {
  return `country-club-art/${kind.slice('country-'.length)}.webp`;
}
/** Local material family. Collision and movement remain the authored meshes. */
export function createCountryClubSurface(c:CustomComponent,map:THREE.Texture,sand:THREE.Texture) {
  const turf=c.tex==='country-turf';
  const material=new THREE.MeshStandardMaterial({color:c.color??'#ffffff',vertexColors:!!c.colors,
    map,roughness:.94,metalness:0,bumpMap:turf?null:map,bumpScale:c.tex==='country-gravel'?.045:.018,
    side:c.doubleSided?THREE.DoubleSide:THREE.FrontSide,fog:c.fog!==false});
  if(turf){
    material.onBeforeCompile=shader=>{
      shader.uniforms.uCountrySand={value:sand};
      shader.fragmentShader='uniform sampler2D uCountrySand;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        #ifdef USE_MAP
          vec3 turfSample=texture2D(map,vMapUv).rgb;
          float bladeValue=dot(turfSample,vec3(.24,.62,.14));
          vec3 detail=vec3(.69+bladeValue*.62);
          #ifdef USE_COLOR
            float sandWeight=smoothstep(.99,1.08,vColor.r/max(vColor.g,.001));
            vec3 sandSample=texture2D(uCountrySand,vMapUv*.7).rgb;
            detail=mix(detail,vec3(.72+dot(sandSample,vec3(.3,.6,.1))*.35),sandWeight);
          #endif
          diffuseColor.rgb*=detail;
        #endif
      `);
    };
    material.customProgramCacheKey=()=> 'country-club-turf-sand-v1';
  }
  return material;
}
