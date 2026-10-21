import * as THREE from 'three';

const surfaceTextures=new WeakMap<THREE.Group,THREE.Texture[]>();
export function takeMapSurfaceTextures(root:THREE.Group):THREE.Texture[]{
  const maps=surfaceTextures.get(root)??[];surfaceTextures.delete(root);return maps;
}

/** Map-only surface detail. Original Meshy meshes, UV atlases and normals remain intact. */
const ROCK_LOOKS:Record<string,{gain:[number,number,number];moss:number;detail:number}>={
  'motu-ridge':{gain:[1.55,1.85,1.28],moss:.78,detail:.9},
  'uga-karst':{gain:[1.12,1.08,.9],moss:.55,detail:.8},
  'spooky-escarpment':{gain:[.8,.91,1.04],moss:.24,detail:.85},
  'quay-headland':{gain:[1.04,1.06,.92],moss:.7,detail:.6},
  'quagmire-caldera':{gain:[.84,.9,1.04],moss:0,detail:.9},
  'volcano':{gain:[1.45,1.5,1.6],moss:0,detail:.7},
  'eroded-cliff':{gain:[.94,.96,.82],moss:.65,detail:.65},
  'sanctuary-mesa':{gain:[.98,.95,1.02],moss:.32,detail:.65},
};
export async function prepareMapRockMaterials(root:THREE.Group,asset:string):Promise<void>{
  if(['treehost','treecrown','ancienttree','canopy','leaf','fern','hibiscus'].includes(asset)){
    root.traverse(object=>{
      const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
      for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
        material.onBeforeCompile=shader=>{
          shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
            float foliageMask=smoothstep(1.12,1.55,diffuseColor.g/max(.02,diffuseColor.r))*smoothstep(1.3,2.2,diffuseColor.g/max(.02,diffuseColor.b));
            diffuseColor.rgb*=mix(vec3(1.0),vec3(.38,.50,.36),foliageMask);
          `);
        };
        material.customProgramCacheKey=()=> 'map-foliage-colour-v2';
      }
    });
  }
  const look=ROCK_LOOKS[asset];if(!look)return;
  const loader=new THREE.TextureLoader();
  const results=await Promise.allSettled(['custard-creek/sandstone-albedo.webp','carlisle-coast/moss-albedo.webp'].map(name=>
    loader.loadAsync(import.meta.env.BASE_URL+name)));
  const maps=results.flatMap(result=>result.status==='fulfilled'?[result.value]:[]);
  if(results.some(result=>result.status==='rejected')){
    maps.forEach(texture=>texture.dispose());
    throw (results.find(result=>result.status==='rejected') as PromiseRejectedResult).reason;
  }
  const [stone,moss]=maps;
  for(const texture of maps){texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=8;texture.userData.shared=true;}
  surfaceTextures.set(root,maps);
  root.traverse(object=>{
    const mesh=object as THREE.Mesh;if(!mesh.isMesh)return;
    for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material]){
      if(!(material instanceof THREE.MeshStandardMaterial))continue;
      // Enables Three's derivative bump helper. The original UV normal map,
      // when present, still runs before the metre-scaled surface detail.
      material.bumpMap=stone;material.bumpScale=0;material.roughness=.94;
      material.onBeforeCompile=shader=>{
        shader.uniforms.uMapStone={value:stone};shader.uniforms.uMapMoss={value:moss};
        shader.uniforms.uMapRockGain={value:new THREE.Vector3(...look.gain)};
        shader.uniforms.uMapMossAmount={value:look.moss};shader.uniforms.uMapDetailAmount={value:look.detail};
        shader.vertexShader='varying vec3 vMapRockPoint; varying vec3 vMapRockNormal;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader
          .replace('#include <defaultnormal_vertex>','#include <defaultnormal_vertex>\nvMapRockNormal=inverseTransformDirection(transformedNormal,viewMatrix);')
          .replace('#include <begin_vertex>','#include <begin_vertex>\nvMapRockPoint=(modelMatrix*vec4(transformed,1.0)).xyz;');
        shader.fragmentShader=`varying vec3 vMapRockPoint; varying vec3 vMapRockNormal;
          uniform sampler2D uMapStone; uniform sampler2D uMapMoss;
          uniform vec3 uMapRockGain; uniform float uMapMossAmount; uniform float uMapDetailAmount;
          vec3 mapTriplanar(sampler2D image,vec3 p,vec3 weights){
            return texture2D(image,p.zy).rgb*weights.x+texture2D(image,p.xz).rgb*weights.y+texture2D(image,p.xy).rgb*weights.z;
          }\n`+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
          vec3 rockNormal=normalize(vMapRockNormal);
          vec3 rockWeights=pow(abs(rockNormal),vec3(4.0));rockWeights/=dot(rockWeights,vec3(1.0));
          vec3 stoneDetail=mapTriplanar(uMapStone,vMapRockPoint*.125,rockWeights);
          float stoneValue=dot(stoneDetail,vec3(.2126,.7152,.0722));
          float mapRockHeight=stoneValue*uMapDetailAmount;
          diffuseColor.rgb*=uMapRockGain*mix(1.0,clamp(stoneValue*3.3,.5,1.45),uMapDetailAmount*.78);
          vec3 mossDetail=mapTriplanar(uMapMoss,vMapRockPoint*.1,rockWeights);
          float mossPatch=dot(mapTriplanar(uMapMoss,vMapRockPoint*.025,rockWeights),vec3(.33));
          float mossMask=clamp(smoothstep(.12,.76,rockNormal.y)*.82+smoothstep(.13,.29,mossPatch)*.32,0.0,1.0)*uMapMossAmount;
          diffuseColor.rgb=mix(diffuseColor.rgb,mossDetail*vec3(.72,.88,.52),mossMask);
        `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
          normal=perturbNormalArb(-vViewPosition,normal,vec2(dFdx(mapRockHeight),dFdy(mapRockHeight))*.21,faceDirection);
        `);
      };
      material.customProgramCacheKey=()=>`map-weathered-rock-v1-${asset}`;
    }
  });
}
