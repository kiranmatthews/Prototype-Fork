import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { createServer } from 'vite';

const outFlag = process.argv.indexOf('--out');
const output = resolve(process.cwd(), outFlag >= 0 ? process.argv[outFlag + 1] : '.img2threejs/stretch-bone/meshes.json');
const server = await createServer({ appType: 'custom', logLevel: 'silent', server: { middlewareMode: true } });

try {
  const { createStretchableBone } = await server.ssrLoadModule('/src/character/stretchableBone.ts');
  const component = createStretchableBone({
    id: 'geometry-gate',
    length: 1,
    shaftRadius: 0.12,
    knobRadius: 0.15,
  });
  component.root.updateMatrixWorld(true);
  const meshes = [];
  component.root.traverse((object) => {
    if (!object.isMesh) return;
    const position = object.geometry.attributes.position;
    const normal = object.geometry.attributes.normal;
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(object.matrixWorld);
    const point = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const vertices = [];
    const normals = [];
    for (let index = 0; index < position.count; index++) {
      point.fromBufferAttribute(position, index).applyMatrix4(object.matrixWorld);
      vertices.push(point.toArray());
      direction.fromBufferAttribute(normal, index).applyMatrix3(normalMatrix).normalize();
      normals.push(direction.toArray());
    }
    const indices = object.geometry.index
      ? Array.from(object.geometry.index.array, Number)
      : Array.from({ length: position.count }, (_unused, index) => index);
    meshes.push({ name: object.name, vertices, indices, normals });
  });
  await writeFile(output, `${JSON.stringify({ meshes }, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${meshes.length} stretchable-bone meshes to ${output}`);
} finally {
  await server.close();
}
