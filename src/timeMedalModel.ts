import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TimeMedal } from './campaign';

export const TIME_MEDAL_COLORS: Record<TimeMedal, number> = { gold: 0xf8c64e, silver: 0xc6d5e2, bronze: 0xc98246 };
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flat = parts.map(part => part.index ? part.toNonIndexed() : part);
  const geometry = mergeGeometries(flat)!;
  for (const part of new Set([...parts, ...flat])) part.dispose();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
export function timeMedalGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [new THREE.CylinderGeometry(.32, .32, .10, 32).rotateX(Math.PI / 2).translate(0, -.12, 0)];
  for (const z of [-.055, .055]) parts.push(new THREE.TorusGeometry(.293, .023, 4, 32).translate(0, -.12, z));
  parts.push(new THREE.TorusGeometry(.06, .018, 5, 16).translate(0, .24, 0));
  const star = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5, radius = i % 2 ? .066 : .16;
    if (!i) star.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else star.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  star.closePath();
  const stamp = new THREE.ExtrudeGeometry(star, { depth: .012, bevelEnabled: true, bevelSize: .004, bevelThickness: .004, bevelSegments: 1, steps: 1 });
  parts.push(stamp.clone().translate(0, -.12, .057), stamp.rotateY(Math.PI).translate(0, -.12, -.057));
  const geometry = merge(parts); geometry.name = 'time medal embossed metal'; return geometry;
}
export function setTimeMedalTier(root: THREE.Object3D, tier: TimeMedal): void {
  root.userData.timeMedal = tier;
  root.traverse(object => {
    if (object.userData.timeMedal !== undefined) object.userData.timeMedal = tier;
    if (!(object instanceof THREE.Mesh) || !object.userData.medalMetal) return;
    const material = object.material as THREE.MeshPhongMaterial;
    material.color.setHex(TIME_MEDAL_COLORS[tier]);
    material.emissive.setHex(TIME_MEDAL_COLORS[tier]).multiplyScalar(.06);
  });
}
export function createTimeMedal(tier: TimeMedal = 'gold'): THREE.Group {
  const group = new THREE.Group(); group.name = 'time-trial medal';
  const metal = new THREE.Mesh(timeMedalGeometry(), new THREE.MeshPhongMaterial({ shininess: 85, specular: 0xffffff }));
  metal.name = 'medal metal'; metal.userData.medalMetal = true;
  const ribbons: THREE.BufferGeometry[] = [];
  for (const sign of [-1, 1]) {
    const shape = new THREE.Shape();
    [[-.27,.68],[-.065,.68],[.09,.24],[-.08,.15]].forEach(([x,y],i) => i ? shape.lineTo(x*sign,y) : shape.moveTo(x*sign,y));
    shape.closePath();
    ribbons.push(new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false, steps: 1 }).translate(0, 0, -.035));
  }
  const ribbon = new THREE.Mesh(merge(ribbons), new THREE.MeshPhongMaterial({ color: 0x244a92, shininess: 18, side: THREE.DoubleSide }));
  ribbon.name = 'medal ribbon'; group.add(ribbon, metal); setTimeMedalTier(group, tier); return group;
}
