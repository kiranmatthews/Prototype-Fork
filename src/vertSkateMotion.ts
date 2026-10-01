import * as THREE from 'three';

const clamp = (v:number) => Math.max(0,Math.min(1,v));
const smooth = (v:number) => {const t=clamp(v);return t*t*(3-2*t);};
export interface SpineTransferMotion {
  progress:number;
  tuck:number;
  reach:number;
  rebound:number;
}

/** One finite gather, rollover and extension into the receiving transition. */
export function sampleSpineTransfer(elapsed:number,duration:number):SpineTransferMotion {
  const p=clamp(elapsed/Math.max(.001,duration));
  return {progress:p,
    tuck:smooth(p/.18)*(1-smooth((p-.44)/.42)),
    reach:smooth(p/.30)*(1-smooth((p-.72)/.28)),
    rebound:Math.sin(Math.PI*clamp((p-.72)/.28))*(1-smooth((p-.86)/.14)),
  };
}

/** Interpolate rotations through wheels-down, never normalize a lerp between
 * opposite normals (which stalls on one wall, then snaps to the other). */
export function spineTransferNormal(from:THREE.Vector3,to:THREE.Vector3,progress:number,out:THREE.Vector3):THREE.Vector3 {
  const up=new THREE.Vector3(0,1,0);
  const a=new THREE.Quaternion().setFromUnitVectors(up,from);
  const b=new THREE.Quaternion().setFromUnitVectors(up,to);
  return out.copy(up).applyQuaternion(a.slerp(b,smooth(progress))).normalize();
}
