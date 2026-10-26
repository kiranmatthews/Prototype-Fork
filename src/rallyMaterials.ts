import * as THREE from 'three';

// Shared procedural detail: no additional texture fetches, reflection cameras,
// time-driven noise, or distance-dependent geometry. UVs are course metres / 5.
export const RALLY_SUN=[-.18,.16,-.97] as const;
export const RALLY_NOISE=/* glsl */`
 float rallyHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float rallyNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(rallyHash(i),rallyHash(i+vec2(1,0)),f.x),mix(rallyHash(i+vec2(0,1)),rallyHash(i+1.0),f.x),f.y);}
`;
export function createRallyDirt(map:THREE.Texture,color:string,vertexColors:boolean){
 const m=new THREE.MeshStandardMaterial({map,color,vertexColors,roughness:.86,metalness:0});
 m.name='Rally wet loam, ruts and grit';
 m.onBeforeCompile=s=>{
  s.vertexShader='varying vec2 vRallyUv;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvRallyUv=uv*5.0;');
  s.fragmentShader='varying vec2 vRallyUv;\n'+RALLY_NOISE+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',/* glsl */`
   #include <color_fragment>
   vec2 soil=vRallyUv;
   float broad=rallyNoise(soil*vec2(.23,.12));
   float footprint=max(length(dFdx(soil)),length(dFdy(soil)));
   float gravel=mix(rallyNoise(soil*6.0),.5,smoothstep(.05,.22,footprint));
   float grit=mix(rallyNoise(soil*22.0),.5,smoothstep(.012,.06,footprint));
   float lane=soil.x+.6*sin(soil.y*.043+soil.x*.09)+.18*sin(soil.y*.12+soil.x*.4);
   float traffic=smoothstep(.24,.67,rallyNoise(soil*vec2(.28,.065)));
   float track=pow(.5+.5*cos(lane*3.1),14.0)*traffic;
   float trackWide=pow(.5+.5*cos(lane*3.1),4.0);
   float wetPatch=smoothstep(.48,.76,broad+.17*sin(soil.y*.051+soil.x*.13));
   float puddle=wetPatch*mix(.72,1.0,smoothstep(.19,.64,trackWide+.2*gravel));
   float shoulder=smoothstep(14.0,21.0,abs(soil.x));
   puddle*=1.0-shoulder;
   float grain=(gravel-.5)*.09+(grit-.5)*.018;
   diffuseColor.rgb*=mix(.92,1.28,broad)*(1.0+grain)*(1.0-track*.22);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.53,.49,.43),puddle*.72);
   float soilHeight=(grain*.10-track*.035)*(1.0-puddle*.92);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <roughnessmap_fragment>',/* glsl */`
   #include <roughnessmap_fragment>
   roughnessFactor=mix(.94,.24,puddle);
  `);
  s.fragmentShader=s.fragmentShader.replace('#include <normal_fragment_maps>',/* glsl */`
   #include <normal_fragment_maps>
   // Derivative normal detail fades naturally under minification. The actual
   // tyre contact remains the authored microterrain, not this fine shading.
   vec3 q0=dFdx(-vViewPosition),q1=dFdy(-vViewPosition);
   vec3 r1=cross(q1,normal),r2=cross(normal,q0);
   float determinant=dot(q0,r1);
   vec3 gradient=sign(determinant)*(dFdx(soilHeight)*r1+dFdy(soilHeight)*r2);
   normal=normalize(abs(determinant)*normal-gradient);
  `);
 };
 m.customProgramCacheKey=()=> 'rally-wet-loam-v2';return m;
}


/** Hanging canvas shares the level clock. No CPU cloth simulation, extra draw
 * passes or textures. The upper seam and rope never leave their authored anchors. */
export function createRallyCloth(clock:{value:number}){
 const m=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.94,side:THREE.DoubleSide,flatShading:true});
 m.name='Festival canvas · pinned seams and wind';
 m.onBeforeCompile=s=>{
  s.uniforms.uRallyClothTime=clock;
  s.vertexShader='uniform float uRallyClothTime;varying vec2 vRallyClothUv;\n'+s.vertexShader;
  s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',/* glsl */`
   #include <begin_vertex>
   vRallyClothUv=uv;
   float freeLength=max(uv.y,0.0),flex=freeLength*freeLength;
   float gust=sin(uRallyClothTime*1.7+position.x*.15-position.z*.06);
   float ripple=sin(uRallyClothTime*4.6+uv.y*7.0+position.x*1.3);
   transformed.z+=flex*(.22+.32*gust+.13*ripple);
   transformed.y+=flex*.08*(1.0+gust);
  `);
  s.fragmentShader='varying vec2 vRallyClothUv;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',/* glsl */`
   #include <color_fragment>
   if(vRallyClothUv.y>=0.0){
    vec2 cloth=vRallyClothUv;
    float footprint=max(fwidth(cloth.x),fwidth(cloth.y));
    float edge=min(min(cloth.x,1.0-cloth.x)*(1.0-cloth.y),cloth.y);
    float hem=1.0-smoothstep(.012,.027+footprint,edge);
    float band=smoothstep(.12,.12+footprint,cloth.y)*(1.0-smoothstep(.27,.27+footprint,cloth.y));
    float checks=mod(floor(cloth.x*6.0)+floor((cloth.y-.12)*13.333),2.0);
    checks=mix(checks,.5,smoothstep(.04,.14,footprint));
    diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*.55,band*(1.0-checks));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.92,.79,.51),max(hem*.82,band*checks*.85));
    diffuseColor.rgb*=.91+.09*sin(cloth.y*3.141593);
   }
  `);
 };
 m.customProgramCacheKey=()=> 'rally-pinned-canvas-v1';return m;
}


export function createRallyLamp(glow=false){
 const m=new THREE.MeshBasicMaterial({color:'#edf6ff',toneMapped:false,side:THREE.DoubleSide,
  ...(glow?{transparent:true,opacity:.82,depthWrite:false,blending:THREE.AdditiveBlending}:{})});
 m.name=glow?'Floodlight optical halo':'Floodlight luminous optic';
 // HDR white cores feed bloom where enabled. The local feathered glow keeps
 // the lamp visibly luminous even with the optional post stack turned off.
 m.color.multiplyScalar(glow?3.4:6);
 if(glow){
  // Each halo is a single plane: drawing its back and front separately adds
  // a redundant pass. DoubleSide still keeps both viewing directions visible.
  m.forceSinglePass=true;
  m.onBeforeCompile=s=>{
   s.vertexShader='varying vec2 vLampUv;\n'+s.vertexShader;
   s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nvLampUv=uv;');
   s.fragmentShader='varying vec2 vLampUv;\n'+s.fragmentShader;
   s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
    vec2 p=vLampUv*2.0-1.0;float r2=dot(p,p);
    float core=exp(-r2*8.0),bloom=exp(-r2*2.1)-exp(-2.1);
    diffuseColor.a*=max(0.0,core*.5+bloom*.35);
    if(diffuseColor.a<.004)discard;
   `);
  };
  m.customProgramCacheKey=()=> 'stadium-lamp-halo-v2';
 }
 return m;
}
