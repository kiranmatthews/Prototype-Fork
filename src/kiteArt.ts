import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

// Measurements from the exported Smart Mesh models. Keep their complete mesh
// and texture at every distance; only the placement and uniform size change.
export const KITE_CANOPY_SCALE = 9.4 / .9995118379592896;
export const KITE_CANOPY_OFFSET = new THREE.Vector3(0, 2.25 - .51025390625 * KITE_CANOPY_SCALE, 1.2);
export const KITE_BAR_SCALE = 1.3 / .9995118379592896;
export const KITE_BAR_OFFSET = new THREE.Vector3(0, -.071533203125 * KITE_BAR_SCALE, 0);

export const KITE_ATTACHMENT_SITES = [
  {name: 'left steering', point: [-.462413151,.048905513,.145904013], normal: [.422002058,-.276484107,.863406510]},
  {name: 'left outer bridle', point: [-.292592002,.381191000,.153417005], normal: [-.360763980,.035700602,.931973614]},
  {name: 'left inner bridle', point: [-.119626017,.443768891,.182390245], normal: [-.063575925,-.405872456,.911715773]},
  {name: 'right inner bridle', point: [.119661013,.443822929,.181824153], normal: [.078562910,-.421382933,.903473460]},
  {name: 'right outer bridle', point: [.273683018,.381082992,.155107072], normal: [.237250078,-.107278552,.965506972]},
  {name: 'right steering', point: [.462420036,.048913023,.145891929], normal: [-.431804242,-.278400103,.857926849]},
] as const;

export function kiteCanopyPoint(point: readonly number[]): THREE.Vector3 {
  return new THREE.Vector3(point[0], point[1], point[2]).multiplyScalar(KITE_CANOPY_SCALE).add(KITE_CANOPY_OFFSET);
}

let sourceLoading: Promise<{canopy: THREE.Group; bar: THREE.Group}> | undefined;
export async function loadKiteArt(): Promise<{canopy: THREE.Group; bar: THREE.Group}> {
  sourceLoading ??= (async () => {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const [canopy, bar] = await Promise.all([
      loader.loadAsync(import.meta.env.BASE_URL + 'beach-kite/canopy.glb'),
      loader.loadAsync(import.meta.env.BASE_URL + 'beach-kite/control-bar.glb'),
    ]);
    canopy.scene.name = 'weathered hot-rod flame canopy · Tripo Smart Mesh';
    canopy.scene.scale.setScalar(KITE_CANOPY_SCALE);
    canopy.scene.position.copy(KITE_CANOPY_OFFSET);
    bar.scene.name = 'carved wooden control bar · Tripo Smart Mesh';
    bar.scene.scale.setScalar(KITE_BAR_SCALE);
    bar.scene.position.copy(KITE_BAR_OFFSET);
    return {canopy: canopy.scene, bar: bar.scene};
  })().catch(error => {sourceLoading = undefined; throw error;});
  const source = await sourceLoading;
  return {canopy: source.canopy.clone(true), bar: source.bar.clone(true)};
}
