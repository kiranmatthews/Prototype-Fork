import * as THREE from 'three';
import {mergeVertices} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const seeds=Array.from({length:27},(_,i)=>{
  const y=1-2*(i+.5)/27,a=i*2.399963229728653,r=Math.sqrt(1-y*y);
  return new THREE.Vector3(r*Math.cos(a),y,r*Math.sin(a));
});
const smooth=(a:number,b:number,x:number)=>THREE.MathUtils.smoothstep(x,a,b);
const weather=(p:THREE.Vector3)=>.45*Math.sin(p.x*7.3+p.y*3.4)*Math.cos(p.z*5.8-p.y*2.3)
  +.35*Math.sin(p.z*11.1-p.x*4.6)*Math.cos(p.y*8.2+p.x*1.8)
  +.2*Math.sin(p.x*19.2+p.z*16.7)*Math.sin(p.y*17.3-p.z*7.1);

/** One continuous spherical shell. Relief is bounded to 1.8% of the radius;
 * weathering and hairline joints can never turn it back into a pile of slabs. */
export function roundBoulderSurface(direction:THREE.Vector3):{radius:number;crack:number;moss:number} {
  let first=-Infinity,second=-Infinity,a=seeds[0],b=seeds[1];
  for(const seed of seeds){
    const d=direction.dot(seed);
    if(d>first){second=first;b=a;first=d;a=seed;}else if(d>second){second=d;b=seed;}
  }
  const margin=(first-second)/a.distanceTo(b);
  const crack=1-smooth(.002,.016,margin);
  const patch=.5*Math.sin(direction.x*4.7+direction.z*2.6)*Math.cos(direction.y*5.1-1.4)
    +.3*Math.sin(direction.y*7.8+direction.x*2.1)*Math.cos(direction.z*6.5+.8)+weather(direction)*.2;
  return {radius:.998+weather(direction)*.002-.014*crack,crack,moss:smooth(.08,.31,patch)};
}

export function createRoundBoulderGeometry(detail:number):THREE.BufferGeometry {
  const source=new THREE.IcosahedronGeometry(1,detail);
  // Triplanar stone has no UV seam; welding also keeps its lighting smooth
  // across every former icosahedron/texture boundary.
  source.deleteAttribute('uv');source.deleteAttribute('normal');
  const geometry=mergeVertices(source,1e-6);source.dispose();
  const position=geometry.getAttribute('position'),colors=new Float32Array(position.count*3),p=new THREE.Vector3();
  const stone=new THREE.Color('#ddd5bb'),moss=new THREE.Color('#66884b'),color=new THREE.Color();
  for(let i=0;i<position.count;i++){
    p.fromBufferAttribute(position,i).normalize();const surface=roundBoulderSurface(p);
    position.setXYZ(i,p.x*surface.radius,p.y*surface.radius,p.z*surface.radius);
    color.copy(stone).lerp(moss,surface.moss*.9).multiplyScalar(1-surface.crack*.37);
    color.toArray(colors,i*3);
  }
  geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}

/** Reuse Custard's detailed sandstone image in object space, so cracks and
 * moss rotate with the rock with no stretched atlas patches or polar seam. */
export function createRoundBoulderMaterial(texture:THREE.Texture):THREE.MeshStandardMaterial {
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;
  const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:.32,roughness:.94,metalness:0,vertexColors:true});
  material.name='Round weathered Custard sandstone';
  material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 vBoulderStone;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBoulderStone=position;');
    shader.fragmentShader='varying vec3 vBoulderStone;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
      vec3 boulderWeights=pow(abs(normalize(vBoulderStone)),vec3(5.0));
      boulderWeights/=boulderWeights.x+boulderWeights.y+boulderWeights.z;
      vec3 stoneAt=vBoulderStone*1.25;
      vec4 boulderTex=texture2D(map,stoneAt.zy)*boulderWeights.x
        +texture2D(map,stoneAt.xz)*boulderWeights.y+texture2D(map,stoneAt.xy)*boulderWeights.z;
      float boulderHeight=dot(boulderTex.rgb,vec3(.299,.587,.114));
      diffuseColor*=boulderTex;
    `);
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(boulderHeight),dFdy(boulderHeight))*bumpScale,faceDirection);
    `);
  };
  material.customProgramCacheKey=()=> 'round-boulder-stone-v1';
  return material;
}
