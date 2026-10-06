import * as THREE from 'three';
import type {CustomComponent} from '../level';
import {TREEHOUSE_CONTACT_SURFACES} from './treehouse-contact-surfaces';

/** Match the accepted visible surface, with a 2cm clearance for the soles.
 * Scale and orientation are baked into metres before the collision normal is
 * computed, so non-uniform decorative scaling cannot change slope handling. */
export function exactTreehouseSupport(visual:CustomComponent,name:string):CustomComponent {
  const source=TREEHOUSE_CONTACT_SURFACES[visual.dkind as keyof typeof TREEHOUSE_CONTACT_SURFACES];
  if(!source)throw new Error(`No measured contact mesh for ${visual.dkind}`);
  const transform=new THREE.Matrix4().compose(new THREE.Vector3(),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0,THREE.MathUtils.degToRad(visual.yaw??0),THREE.MathUtils.degToRad(visual.amp??0),'YXZ')),
    new THREE.Vector3(...(visual.s??[1,1,1])).multiplyScalar(visual.w??1));
  const p=new THREE.Vector3(),vertices:number[]=[];
  for(let i=0;i<source.vertices.length;i+=3){
    p.fromArray(source.vertices,i).applyMatrix4(transform);p.y+=.02;
    vertices.push(...p.toArray().map(n=>+n.toFixed(6)));
  }
  return {t:'mesh',p:[...visual.p],vertices,indices:[...source.indices],invisible:true,solid:true,
    tex:'solid',vert:false,edgeGrinding:false,nm:name,grp:visual.grp};
}
