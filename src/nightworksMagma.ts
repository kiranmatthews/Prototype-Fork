import * as THREE from 'three';
import type { CustomComponent } from './level';

export const NIGHTWORKS_VOLCANO_TEXTURES = ['nightworks-quarry','nightworks-basalt','nightworks-caldera','nightworks-magma','nightworks-heat','nightworks-ash'] as const;

/** Metre-scale triplanar slate follows both the original kit's caps and its
 * irregular sides. The collider and shared source GLB remain untouched. */
export function addNightworksStoneLook(material:THREE.MeshLambertMaterial|THREE.MeshStandardMaterial):void {
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vNightStonePosition;\nvarying vec3 vNightStoneNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
      vNightStonePosition=(modelMatrix*vec4(transformed,1.0)).xyz;
      mat3 stoneBasis=mat3(modelMatrix);
      vec3 stoneScale=vec3(dot(stoneBasis[0],stoneBasis[0]),dot(stoneBasis[1],stoneBasis[1]),dot(stoneBasis[2],stoneBasis[2]));
      vNightStoneNormal=normalize(stoneBasis*(normal/max(stoneScale,vec3(.0001))));
    `);
    shader.fragmentShader='varying vec3 vNightStonePosition;\nvarying vec3 vNightStoneNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec3 weights=pow(abs(normalize(vNightStoneNormal)),vec3(5.0));
        weights/=max(.001,weights.x+weights.y+weights.z);
        vec3 q=vNightStonePosition/8.5;
        vec4 stone=texture2D(map,q.yz)*weights.x+texture2D(map,q.xz)*weights.y+texture2D(map,q.xy)*weights.z;
        diffuseColor*=stone;
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>
      float lowBounce=1.0-smoothstep(-35.0,5.0,vNightStonePosition.y);
      totalEmissiveRadiance+=vec3(.014,.003,.002)*lowBounce;
    `);
  };
  material.customProgramCacheKey=()=> 'nightworks-world-slate-v1';
}

/** Kept for imported/editor instances of the earlier model. No synthetic
 * stripes: an asset's authored molten channels own its emission mask. */
export function createNightworksVolcanoMaterial(map:THREE.Texture|null,clock:{value:number}):THREE.MeshBasicMaterial {
  return createNightworksMagma(clock,{t:'mesh',p:[0,0,0],tex:'nightworks-caldera',fog:false},map);
}

/** The distant painting and the actual basin share a level-owned clock.
 * Only molten pixels breathe; cool stone and sky retain a steady exposure. */
export function createNightworksMagma(clock:{value:number},c:CustomComponent,map:THREE.Texture|null):THREE.MeshBasicMaterial {
  const heat=c.tex==='nightworks-heat',ash=c.tex==='nightworks-ash',sky=c.tex==='nightworks-caldera',veil=heat||ash;
  const material=new THREE.MeshBasicMaterial({map:veil?null:map,color:0xffffff,side:THREE.DoubleSide,
    fog:veil&&c.fog!==false,transparent:!sky,depthWrite:sky,toneMapped:false,forceSinglePass:true,
    blending:heat?THREE.AdditiveBlending:THREE.NormalBlending,opacity:c.opacity??1});
  material.name=sky?'Living caldera panorama':heat?'Volcanic radiant haze':ash?'Caldera ash plume':'Slow molten currents';
  material.userData.nightworksMagma=true;material.userData.magmaClock=clock;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uMagmaTime=clock;
    shader.vertexShader='varying vec2 vMagmaUv;\nvarying float vMagmaDepth;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvMagmaDepth=-mvPosition.z;');
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMagmaUv=uv;');
    shader.fragmentShader='varying vec2 vMagmaUv;\nvarying float vMagmaDepth;\nuniform float uMagmaTime;\n'+shader.fragmentShader;
    if(!veil&&!sky)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec2 flow=vMapUv+vec2(uMagmaTime*.00055,-uMagmaTime*.0007);
        flow+=vec2(sin(flow.y*9.0+uMagmaTime*.16),cos(flow.x*7.0-uMagmaTime*.13))*.002;
        diffuseColor*=texture2D(map,flow);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      float pulse=.94+.07*sin(uMagmaTime*.8+vMagmaUv.y*9.0)+.035*sin(uMagmaTime*1.7-vMagmaUv.x*23.0);
      ${heat?`
        float halo=pow(max(0.0,1.0-length((vMagmaUv-.5)*2.0)),2.4);
        diffuseColor.rgb=vec3(.8,.055,.008)*pulse;diffuseColor.a*=halo*.6;
      `:ash?`
        vec2 cloud=(vMagmaUv-.5)*2.0;cloud.x+=sin(cloud.y*4.0-uMagmaTime*.13)*.15;
        diffuseColor.rgb=vec3(.07,.065,.09);diffuseColor.a*=pow(max(0.0,1.0-length(cloud)),1.6)*.7;
      `:`
        float molten=smoothstep(.028,.22,diffuseColor.r-max(diffuseColor.g*1.65,diffuseColor.b*1.8));
        diffuseColor.rgb*=mix(${sky?'1.0':'.65'},pulse,molten);
        ${sky?'':'diffuseColor.rgb+=vec3(.028,.002,0.0)*molten*pulse;diffuseColor.a*=1.0-smoothstep(75.0,235.0,vMagmaDepth);'}
      `}
    `);
  };
  material.customProgramCacheKey=()=>`nightworks-magma-v3:${sky?'sky':heat?'heat':ash?'ash':'lake'}`;
  return material;
}
