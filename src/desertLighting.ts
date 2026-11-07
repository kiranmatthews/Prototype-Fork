import * as THREE from 'three';

// Measured white-disc centroid in the unchanged 1774 x 887 sky painting.
export const DESERT_PAINTED_SUN_UV=[1181.625/1774,1-419.3942307692308/887] as const;
const azimuth=DESERT_PAINTED_SUN_UV[0]*Math.PI*2;
const elevation=Math.atan(.8/Math.hypot(.5,.862));
export const DESERT_SUN_DIRECTION:[number,number,number]=[
  -Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation),
];
export const DESERT_SHADOW_HALF=512;
export const isDesertCanyonLevel=(id:string)=>id==='bryce-canyon'||id==='bonus:bryce-canyon'||id==='bonus-bryce-canyon';

const right=new THREE.Vector3(),up=new THREE.Vector3(),direction=new THREE.Vector3();
/** Fix the shadow texel lattice in world space, including while descending. */
export function snapDesertShadowFocus(focus:THREE.Vector3,lightDirection:THREE.Vector3,mapSize:number):void {
  direction.copy(lightDirection).normalize();
  right.crossVectors(THREE.Object3D.DEFAULT_UP,direction).normalize();
  up.crossVectors(direction,right).normalize();
  const texel=DESERT_SHADOW_HALF*2/mapSize;
  const x=focus.dot(right),y=focus.dot(up);
  focus.addScaledVector(right,Math.round(x/texel)*texel-x);
  focus.addScaledVector(up,Math.round(y/texel)*texel-y);
}
