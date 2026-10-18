import type * as THREE from 'three';
import type { JungleAssetKit } from './jungleAssets';

/** Install once for the renderer's lifetime. Resolve the current level on each
 * pass so a level switch cannot retain the departing kit or its GPU assets. */
export function installSceneryShadowPass(
  renderer:Pick<THREE.WebGLRenderer,'shadowMap'>,
  scope:()=>Pick<JungleAssetKit,'withLowDetailShadows'>|undefined,
):void {
  const shadows=renderer.shadowMap,render=shadows.render;
  shadows.render=function(...args){
    const kit=scope();
    if(!kit||!shadows.enabled||(!shadows.autoUpdate&&!shadows.needsUpdate)||!args[0].length){
      render.apply(this,args);return;
    }
    kit.withLowDetailShadows(()=>render.apply(this,args));
  };
}
