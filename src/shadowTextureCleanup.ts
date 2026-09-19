import type * as THREE from 'three';

/** Three r166 reuses its default shadow material across objects. Its common
 * uniform refresh assigns present maps but never clears absent ones. A stale
 * sampler can therefore re-upload an already disposed level texture while
 * drawing an untextured character. Clear only slots the shadow material no
 * longer uses; preserve cutout/displacement maps and all custom shaders. */
export function installShadowTextureCleanup(renderer:THREE.WebGLRenderer):void {
  const render=renderer.renderBufferDirect.bind(renderer);
  renderer.renderBufferDirect=(camera,scene,geometry,material,object,group)=>{
    const shadow=material as THREE.MeshDepthMaterial & THREE.MeshDistanceMaterial;
    if(shadow.isMeshDepthMaterial||shadow.isMeshDistanceMaterial){
      const uniforms=renderer.properties.get(material).uniforms;
      if(uniforms)for(const key of ['map','alphaMap','displacementMap'] as const){
        if(shadow[key]===null&&uniforms[key])uniforms[key].value=null;
      }
    }
    render(camera,scene,geometry,material,object,group);
  };
}
