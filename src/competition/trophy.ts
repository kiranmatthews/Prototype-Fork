import * as THREE from 'three';
/** Small original cup prop for the ceremony dais; the saved award is unique. */
export function createJungleCupTrophy(): THREE.Group {
  const root = new THREE.Group(); root.name = 'Jungle Cup ceremony trophy';
  const gold = new THREE.MeshStandardMaterial({color:0xf0bd54,roughness:.35,metalness:.65});
  const stone = new THREE.MeshStandardMaterial({color:0x335a4a,roughness:.8});
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, x=0,y=0,z=0) => {
    const mesh = new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);
    mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
  };
  add(new THREE.BoxGeometry(.9,.18,.7),stone,0,.09);
  add(new THREE.CylinderGeometry(.3,.4,.12,16),gold,0,.24);
  add(new THREE.CylinderGeometry(.11,.17,.5,12),gold,0,.52);
  add(new THREE.LatheGeometry([[.16,.74],[.3,.78],[.45,.97],[.55,1.4],[.54,1.48],[.47,1.48],[.45,1.32],[.34,1.02],[.18,.86]].map(([x,y])=>new THREE.Vector2(x,y)),24),gold);
  for(const side of [-1,1]) add(new THREE.TorusGeometry(.3,.065,8,18),gold,side*.5,1.13);
  return root;
}
