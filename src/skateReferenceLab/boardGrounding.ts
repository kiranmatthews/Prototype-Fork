import * as THREE from 'three';

/** Signed distance of the authored deck/wheels/trucks from a world support
 * plane. Use the real vertices: an axis-aligned box floats a tilted deck. */
export function boardGroundClearance(board: THREE.Object3D, support: THREE.Plane): number {
  board.updateWorldMatrix(true,true);
  let minimum=Infinity;
  board.traverse(node=>{
    if (!(node instanceof THREE.Mesh)) return;
    for(let parent: THREE.Object3D|null=node;parent&&parent!==board;parent=parent.parent)
      if(!parent.visible)return;
    const positions=node.geometry.getAttribute('position');
    if(!positions)return;
    const m=node.matrixWorld.elements,n=support.normal;
    // Plane in mesh coordinates, retaining world-metre distances under the
    // rider's nonuniform scale. No per-vertex matrix/vector allocations.
    const x=n.x*m[0]+n.y*m[1]+n.z*m[2],y=n.x*m[4]+n.y*m[5]+n.z*m[6];
    const z=n.x*m[8]+n.y*m[9]+n.z*m[10],w=n.x*m[12]+n.y*m[13]+n.z*m[14]+support.constant;
    for(let i=0;i<positions.count;i++)minimum=Math.min(minimum,
      x*positions.getX(i)+y*positions.getY(i)+z*positions.getZ(i)+w);
  });
  return minimum;
}

/** Correct presentation only. A small smooth knee avoids a hard contact snap;
 * the result always clears the ground and never changes scale or rotation. */
export function groundBoard(board: THREE.Object3D, support: THREE.Plane, shift: THREE.Vector3): number {
  const clearance=boardGroundClearance(board,support),needed=.002-clearance,knee=.012;
  const lift=needed>=knee?needed:needed<=-knee?0:(needed+knee)**2/(4*knee);
  shift.copy(support.normal).multiplyScalar(lift);
  if(lift>0&&board.parent){
    const world=board.getWorldPosition(new THREE.Vector3()).add(shift);
    board.position.copy(board.parent.worldToLocal(world));board.updateWorldMatrix(false,true);
  }
  return lift;
}
