import * as THREE from 'three';

/** Measure visible, actually drawn vertices in the source parent's frame.
 * Shared OpenGOAL buffers can contain unrelated vertices. Gallery placement,
 * comparison separation and display scaling must not contaminate the result. */
export function preciseBounds(root:THREE.Object3D):THREE.Box3 {
  root.updateWorldMatrix(true,true);
  const frame=root.parent?.matrixWorld.clone().invert()??new THREE.Matrix4();
  const box=new THREE.Box3(),point=new THREE.Vector3();
  root.traverseVisible(node=>{
    if(!(node instanceof THREE.Mesh))return;
    if(node instanceof THREE.SkinnedMesh)node.skeleton.update();
    const geometry=node.geometry,local=new THREE.Box3();
    const indices=geometry.index?new Set(Array.from(geometry.index.array as ArrayLike<number>)):
      Array.from({length:geometry.getAttribute('position').count},(_,i)=>i);
    for(const index of indices) {
      node.getVertexPosition(index,point);local.expandByPoint(point);
      point.applyMatrix4(node.matrixWorld).applyMatrix4(frame);
      if(point.toArray().every(Number.isFinite))box.expandByPoint(point);
    }
    // Transparent sorting also asks for a sphere; never include unrelated
    // skin vertices just because frustum culling is disabled.
    if(node instanceof THREE.SkinnedMesh) {
      node.boundingBox=local;node.boundingSphere=local.getBoundingSphere(new THREE.Sphere());
    }
    node.frustumCulled=false;
  });
  if(box.isEmpty())throw new Error('Export has no finite referenced geometry');
  return box;
}
