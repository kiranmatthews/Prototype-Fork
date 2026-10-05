import * as THREE from 'three';
import { TessellateModifier } from 'three/examples/jsm/modifiers/TessellateModifier.js';
import { SURF_GLSL, SWELL_GLSL } from './coastalSurf';

/** Old published editor snapshots carry these names rather than a material
 * tag. Recognize registered old water surfaces, never arbitrary blue geometry. */
export function isStandingWater(c: { t: string; solid?: boolean; materialStyle?: string; nm?: string; tex?: string }): boolean {
  return c.t === 'mesh' && c.solid === false && (c.materialStyle === 'water' ||
    (c.materialStyle===undefined && (c.tex??'solid')==='solid' &&
      ['Still luminous underground sea','Standing service-well water','Standing water in closed service well','Custard Creek water ribbon'].includes(c.nm ?? '')));
}

/** Rectangular, horizontal authored water gets enough vertices to show the
 * same wave stack. Other shapes retain their exact authoring geometry. */
export function refineStandingWater(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  geometry.computeBoundingBox();
  const b=geometry.boundingBox!,size=b.getSize(new THREE.Vector3());
  const refineTriangles=()=>{const refined=new TessellateModifier(2,4).modify(geometry);geometry.dispose();return refined;};
  if(size.x<0.01 || size.z<0.01)return geometry;
  if(geometry.hasAttribute('color'))return refineTriangles();
  if(size.y>0.001)return refineTriangles();
  const positions=geometry.getAttribute('position');
  const corners=new Set<string>();
  // Restrict replacement to rectangles: arbitrary custom water outlines must
  // never become their bounding rectangle or grow across a playable floor.
  for(let i=0;i<positions.count;i++) {
    const x=positions.getX(i),z=positions.getZ(i);
    if(Math.min(Math.abs(x-b.min.x),Math.abs(x-b.max.x))>0.001 ||
      Math.min(Math.abs(z-b.min.z),Math.abs(z-b.max.z))>0.001)return refineTriangles();
    corners.add(`${x.toFixed(3)},${z.toFixed(3)}`);
  }
  if(corners.size!==4)return refineTriangles();
  const indices=geometry.getIndex();let area=0;
  for(let i=0,n=indices?.count??positions.count;i<n;i+=3){
    const a=indices?indices.getX(i):i,c=indices?indices.getX(i+1):i+1,d=indices?indices.getX(i+2):i+2;
    area+=Math.abs((positions.getX(c)-positions.getX(a))*(positions.getZ(d)-positions.getZ(a))-
      (positions.getZ(c)-positions.getZ(a))*(positions.getX(d)-positions.getX(a)))*.5;
  }
  if(Math.abs(area-size.x*size.z)>0.001)return refineTriangles();
  const grid=new THREE.PlaneGeometry(size.x,size.z,Math.min(128,Math.ceil(size.x/2)),Math.min(256,Math.ceil(size.z/2)));
  grid.rotateX(-Math.PI/2);grid.translate((b.min.x+b.max.x)/2,b.min.y,(b.min.z+b.max.z)/2);
  geometry.dispose();return grid;
}

/** Pools stay flat and quiet. Only a flowing surface opts into wave shaders. */
export function createStandingWaterMaterial(clock: {value:number}, color: string, emissive: string | undefined,
  geometry: THREE.BufferGeometry, flowing = false): THREE.MeshStandardMaterial {
  geometry.computeBoundingBox();const b=geometry.boundingBox!;
  const material=new THREE.MeshStandardMaterial({color,emissive:emissive??'#000000',roughness:0.38,
    metalness:0.04,side:THREE.DoubleSide});
  material.userData.waterSurface=true;material.userData.noWaterShore=true;
  if(!flowing)return material;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uStillTime=clock;
    shader.uniforms.uStillBounds={value:new THREE.Vector4(b.min.x,b.min.z,b.max.x,b.max.z)};
    shader.uniforms.uSurf={value:new THREE.Vector4(0.06,7.2,3.0,0.32)};
    const shared=`uniform float uStillTime; uniform vec4 uStillBounds;
      varying vec2 vStillXZ; varying float vStillShore;
      ${SURF_GLSL}\n${SWELL_GLSL}\n
      float stillShore(vec2 xz) {return min(min(xz.x-uStillBounds.x,uStillBounds.z-xz.x),
        min(xz.y-uStillBounds.y,uStillBounds.w-xz.y));}
      void stillWave(vec2 xz, float shore, out vec3 disp, out vec2 slope) {
        disp=vec3(0.0);slope=vec2(0.0);
        coastSwells(xz,shore*4.0,uStillTime,vec4(18.0,0.075,0.45,0.5),vec2(0.85,0.53),
          vec4(8.0,0.035,0.5,0.4),vec2(-0.3,0.954),disp,slope);
      }\n`;
    shader.vertexShader=shared+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      vStillXZ=(modelMatrix*vec4(position,1.0)).xz;vStillShore=stillShore(position.xz);
      vec3 waterDisp;vec2 waterSlope;stillWave(vStillXZ,vStillShore,waterDisp,waterSlope);
      transformed.y+=waterDisp.y;`);
    shader.fragmentShader=shared+shader.fragmentShader
      .replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 waterDisp;vec2 waterSlope;stillWave(vStillXZ,vStillShore,waterDisp,waterSlope);
        normal=normalize(mat3(viewMatrix)*vec3(waterSlope.x,1.0,waterSlope.y));`)
      .replace('#include <color_fragment>',`#include <color_fragment>
        float noise=0.5+0.24*sin(vStillXZ.x*2.4+uStillTime*0.4)*sin(vStillXZ.y*3.1-uStillTime*0.3);
        float foam=surfFoam(vStillShore,vStillXZ,uStillTime,noise);
        diffuseColor.rgb=mix(diffuseColor.rgb*mix(0.78,1.08,smoothstep(0.0,2.5,vStillShore)),
          vec3(0.83,0.94,0.94),foam);`);
  };
  material.customProgramCacheKey=()=> 'sheltered-coastal-water-v1';
  return material;
}
