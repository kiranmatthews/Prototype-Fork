import * as THREE from 'three';
import type { CustomComponent } from './level';

export const NIGHTWORKS_VOLCANO_TEXTURES = ['nightworks-quarry', 'nightworks-magma', 'nightworks-heat', 'nightworks-ash'] as const;
const PULSE = 'float pulse=0.78+0.17*sin(uMagmaTime*1.35)+0.05*sin(uMagmaTime*3.7);';

/** One painted atlas and a few ALU operations; lava emission stays separate
 * from the basalt. There are no per-frame allocations or extra light passes. */
export function createNightworksVolcanoMaterial(map: THREE.Texture | null, clock: { value: number }): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({map,fog:false,toneMapped:false});
  material.name='After Hours living volcano';
  material.userData.nightworksMagma=true;material.userData.magmaClock=clock;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uMagmaTime=clock;
    shader.vertexShader='varying vec3 vVolcanoPosition;\nvarying float vVolcanoShade;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vVolcanoPosition=position;
      vVolcanoShade=.52+.65*max(0.0,dot(normalize(normal),normalize(vec3(-.3,.8,.4))));
    `);
    shader.fragmentShader=`
      uniform float uMagmaTime;
      varying vec3 vVolcanoPosition;
      varying float vVolcanoShade;
      float volcanoRiver(float angle,float height,float centre,float width,float phase){
        float winding=centre+.13*sin(height*7.5+phase)+.035*sin(height*19.0+phase);
        float distanceToRiver=abs(atan(sin(angle-winding),cos(angle-winding)));
        float banks=width*(1.0+.13*sin(height*31.0+phase));
        return 1.0-smoothstep(banks*.68,banks,distanceToRiver);
      }
    `+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      ${PULSE}
      float height=vVolcanoPosition.y;
      float angle=atan(vVolcanoPosition.z,vVolcanoPosition.x);
      float central=volcanoRiver(angle,height,1.57,.105,0.0);
      float left=volcanoRiver(angle,height,2.64,.075,1.7);
      float right=volcanoRiver(angle,height,.40,.072,3.4);
      float rivers=max(central,max(left,right))*smoothstep(.015,.06,height)*(1.0-smoothstep(.87,.98,height));
      float pool=(1.0-smoothstep(.10,.14,length(vVolcanoPosition.xz)))*smoothstep(.69,.77,height)*(1.0-smoothstep(.81,.86,height));
      float painted=smoothstep(.03,.20,diffuseColor.r-max(diffuseColor.g,diffuseColor.b)*1.08);
      float molten=max(painted,max(rivers,pool));
      float current=.5+.5*sin(angle*90.0+height*9.0+sin(height*23.0-uMagmaTime*.8));
      float crustDetail=clamp(dot(diffuseColor.rgb,vec3(.33))*7.0,.0,1.0);
      vec3 flowingRed=mix(vec3(.92,.007,.001),vec3(1.1,.055,.004),pow(current,6.0));
      flowingRed*=.84+.16*crustDetail+.08*sin(height*60.0-uMagmaTime*1.2);
      vec3 stone=diffuseColor.rgb*vec3(1.2,1.3,1.48)*vVolcanoShade;
      diffuseColor.rgb=mix(stone,flowingRed*(.76+pulse*.45),molten);
    `);
  };
  material.customProgramCacheKey=()=> 'nightworks-volcano-three-rivers-v2';
  return material;
}

/** Level-owned fixed clock also keeps editor rebuilds and bonus returns local. */
export function createNightworksMagma(clock: { value: number }, c: CustomComponent, map: THREE.Texture | null): THREE.MeshBasicMaterial {
  const heat=c.tex==='nightworks-heat',ash=c.tex==='nightworks-ash',veil=heat||ash;
  const material=new THREE.MeshBasicMaterial({
    map:veil?null:map,color:0xffffff,side:THREE.DoubleSide,fog:c.fog!==false,
    transparent:veil,depthWrite:!veil,toneMapped:false,forceSinglePass:true,
    blending:heat?THREE.AdditiveBlending:THREE.NormalBlending,opacity:c.opacity??1,
  });
  material.name=heat?'Volcanic radiant haze':ash?'Caldera ash plume':'Living red magma';
  material.userData.nightworksMagma=true;material.userData.magmaClock=clock;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uMagmaTime=clock;
    shader.vertexShader='varying vec2 vMagmaUv;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvMagmaUv=uv;');
    shader.fragmentShader='varying vec2 vMagmaUv;\nuniform float uMagmaTime;\n'+shader.fragmentShader;
    if(!veil)shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      #ifdef USE_MAP
        vec2 flow=vMapUv+vec2(uMagmaTime*.003,-uMagmaTime*.004);
        flow+=vec2(sin(flow.y*4.0+uMagmaTime*.21),cos(flow.x*3.0-uMagmaTime*.17))*.008;
        diffuseColor*=texture2D(map,flow);
      #endif
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',`#include <alphatest_fragment>
      ${PULSE}
      ${heat?`
        float halo=pow(max(0.0,1.0-length((vMagmaUv-.5)*2.0)),2.4);
        diffuseColor.rgb=vec3(1.0,.025,.003)*pulse;
        diffuseColor.a*=halo*(.66+.16*sin(uMagmaTime*1.35));
      `:ash?`
        vec2 cloud=(vMagmaUv-.5)*2.0;
        cloud.x+=sin(cloud.y*4.0-uMagmaTime*.19)*.15;
        float edge=pow(max(0.0,1.0-length(cloud)),1.6);
        float billow=.7+.16*sin(cloud.x*13.0+cloud.y*8.0-uMagmaTime*.22)+.12*cos(cloud.y*19.0-uMagmaTime*.36);
        diffuseColor.rgb=mix(vec3(.10,.026,.028),vec3(.027,.032,.046),vMagmaUv.y);
        diffuseColor.a*=edge*billow;
      `:`
        float molten=smoothstep(.06,.25,diffuseColor.r-max(diffuseColor.g,diffuseColor.b)*1.4);
        diffuseColor.rgb*=mix(.5,.65+pulse*.6,molten);
        diffuseColor.rgb+=vec3(.16,.002,.0005)*molten*pulse;
      `}
    `);
  };
  material.customProgramCacheKey=()=>`nightworks-magma-v2:${heat?'heat':ash?'ash':'lava'}`;
  return material;
}
