import * as THREE from 'three';
import type {CustomComponent} from '../level';
import {CUSTARD_LEDGE_CONTACT} from './custard-ledge-contact';

/** Exact raised contact skin for the reused ledge model, including its uneven
 * perimeter. Only visible cap triangles are supplied; the open gap stays open. */
export function measuredCreekLedge(visual:CustomComponent):CustomComponent{
 const transform=new THREE.Matrix4().compose(new THREE.Vector3(),
  new THREE.Quaternion().setFromAxisAngle(THREE.Object3D.DEFAULT_UP,THREE.MathUtils.degToRad(visual.yaw??0)),
  new THREE.Vector3(...visual.s!));
 const vertices:number[]=[],p=new THREE.Vector3();
 for(let i=0;i<CUSTARD_LEDGE_CONTACT.vertices.length;i+=3){
  p.fromArray(CUSTARD_LEDGE_CONTACT.vertices,i).applyMatrix4(transform);p.y+=.02;
  vertices.push(...p.toArray().map(v=>Math.round(v*100000)/100000));
 }
 return{t:'mesh',p:[...visual.p],vertices,indices:[...CUSTARD_LEDGE_CONTACT.indices],tex:'solid',
  invisible:true,solid:true,edgeGrinding:false,nm:`Measured ${visual.nm}`,grp:visual.grp};
}
