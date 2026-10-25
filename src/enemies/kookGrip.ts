import * as THREE from 'three';

/** Supplemental grip joints for the Meshy wet-weather gunner. The generated
 * surface, triangles, UVs and materials are unchanged. Coordinates below are
 * measured in this asset's centimetre-scale hand bind frames, not world space. */
export function rigKookGrip(root:THREE.Object3D):void {
 root.updateMatrixWorld(true);
 root.traverse(object=>{
  const mesh=object as THREE.SkinnedMesh;if(!mesh.isSkinnedMesh)return;
  const original=mesh.skeleton,bones=[...original.bones],inverses=original.boneInverses.map(m=>m.clone());
  const sourceGeometry=mesh.geometry,geometry=sourceGeometry.clone(),positions=geometry.getAttribute('position');
  const indices=geometry.getAttribute('skinIndex'),weights=geometry.getAttribute('skinWeight');
  const point=new THREE.Vector3(),bind=new THREE.Vector3();
  const sides=['Left','Right'].map(side=>{
   const handIndex=bones.findIndex(b=>b.name===side+'Hand'),hand=bones[handIndex];
   if(!hand)throw Error('Wet-weather Kook has no '+side+'Hand joint');
   const make=(name:string,parent:THREE.Bone,p:THREE.Vector3)=>{
    const bone=new THREE.Bone();bone.name=side+name;bone.position.copy(p);parent.add(bone);bone.updateWorldMatrix(true,false);
    const index=bones.length;bones.push(bone);inverses.push(bone.matrixWorld.clone().invert());return {bone,index};
   };
   const knuckle=make('Grip',hand,new THREE.Vector3(0,20,-2));
   const tip=make('GripTip',knuckle.bone,new THREE.Vector3(0,9,-1));
   return {handIndex,knuckle:knuckle.index,tip:tip.index,side};
  });
  let changed=0;
  for(let vertex=0;vertex<positions.count;vertex++){
   let touched=false;
   const entries=[0,1,2,3].map(k=>({joint:indices.getComponent(vertex,k),weight:weights.getComponent(vertex,k)}));
   for(const hand of sides){
    const influence=entries.find(e=>e.joint===hand.handIndex&&e.weight>0);if(!influence)continue;
    point.fromBufferAttribute(positions,vertex);bind.copy(point).applyMatrix4(mesh.bindMatrix).applyMatrix4(inverses[hand.handIndex]);
    // The thumb sits beyond this diagonal edge of the palm. Keep its original
    // skin and the wrist/cuff untouched; only the four distal fingers curl.
    const across=hand.side==='Left'?bind.x:-bind.x;
    const thumb=THREE.MathUtils.smoothstep(across,5,10)*(1-THREE.MathUtils.smoothstep(bind.y,27,32));
    const bend=THREE.MathUtils.smoothstep(bind.y,18,24)*(1-thumb);
    if(bend<.00001)continue;
    const transferred=influence.weight*bend,tip=THREE.MathUtils.smoothstep(bind.y,28,33);
    influence.weight-=transferred;entries.push({joint:hand.knuckle,weight:transferred*(1-tip)},{joint:hand.tip,weight:transferred*tip});changed++;touched=true;
   }
   if(!touched)continue;
   entries.sort((a,b)=>b.weight-a.weight);const kept=entries.slice(0,4),total=kept.reduce((sum,e)=>sum+e.weight,0);
   for(let k=0;k<4;k++){indices.setComponent(vertex,k,kept[k].joint);weights.setComponent(vertex,k,kept[k].weight/total);}
  }
  mesh.geometry=geometry;mesh.skeleton=new THREE.Skeleton(bones,inverses);original.dispose();sourceGeometry.dispose();
  mesh.userData.gripRig={source:'Meshy kook-rain',supplementalJoints:4,weightedVertices:changed,surfaceUnchanged:true};
 });
}

const GRIP_AXIS=new THREE.Vector3(1,0,0);
export function poseKookGrip(bones:Map<string,THREE.Object3D>,amount:number):void {
 for(const side of ['Left','Right']){
  bones.get(side+'Grip')?.quaternion.setFromAxisAngle(GRIP_AXIS,-1.05*amount);
  bones.get(side+'GripTip')?.quaternion.setFromAxisAngle(GRIP_AXIS,-1.2*amount);
 }
}
