import { ShaderChunk, type Material } from 'three';

const shadowChunk=ShaderChunk.shadowmap_pars_fragment;
const softStart=shadowChunk.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )');
const softEnd=shadowChunk.indexOf('#elif defined( SHADOWMAP_TYPE_VSM )',softStart);
// A fixed rotation avoids temporal noise. Twelve disk samples replace the
// native soft branch's sixteen fetches; the shared sun controls world radius.
const disk=Array.from({length:12},(_,i)=>{
  const radius=Math.sqrt((i+.5)/12),angle=i*2.39996323+.67;
  return `texture2DCompare( shadowMap, shadowCoord.xy + treehouseShadowRadius * vec2(${(Math.cos(angle)*radius).toFixed(6)}, ${(Math.sin(angle)*radius).toFixed(6)}), shadowCoord.z )`;
});
export const TREEHOUSE_SOFT_SHADOW_CHUNK=softStart>=0&&softEnd>softStart
  ?shadowChunk.slice(0,softStart)+`#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
    vec2 treehouseShadowRadius = vec2(max(shadowRadius,1.0)) / shadowMapSize;
    shadow = (${disk.join(' +\n')}) * (1.0 / 12.0);
    `+shadowChunk.slice(softEnd):shadowChunk;

/** Painterly scenery uses its authored key light unchanged. Cool sky bounce
 * and packed self-occlusion apply only to the indirect illumination, so a
 * sunlit leaf or rock retains the original painted colour. No screen pass. */
export function addTreehouseTrialsMaterialLook(material:Material):void {
  if(material.userData.junglePainterly!==true||material.userData.treehouseMaterialLook)return;
  material.userData.treehouseMaterialLook=true;
  const previous=material.onBeforeCompile,previousKey=material.customProgramCacheKey.bind(material);
  const authoredAO=material.userData.jungleAO===true;
  material.onBeforeCompile=(shader,renderer)=>{
    previous.call(material,shader,renderer);
    shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',TREEHOUSE_SOFT_SHADOW_CHUNK);
    if(authoredAO){
      shader.vertexShader='attribute float aJungleAO;\nvarying float vTreehouseAO;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvTreehouseAO = aJungleAO;');
      shader.fragmentShader='varying float vTreehouseAO;\n'+shader.fragmentShader;
    }
    shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= vec3(0.86,0.96,1.08)'+
      (authoredAO?' * clamp(vTreehouseAO,0.2,1.0)':'')+';');
  };
  material.customProgramCacheKey=()=>previousKey()+`|treehouse-painterly-v2-${authoredAO}`;
}
