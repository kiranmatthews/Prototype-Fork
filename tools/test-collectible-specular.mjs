import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

const source = await readFile(new URL('../src/collectibleSpecular.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText.replace('from "three"', `from ${JSON.stringify(import.meta.resolve('three'))}`);
const { buildCollectibleGeometry, CollectibleSpecularMaterial, COLLECTIBLE_SPECULAR_VERTEX } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const key = p => p.map(v => v.toFixed(5)).join(',');
for (const [kind, triangles, minY, maxY] of [['crystal',30,-1.5,.72],['gem',64,-.8,.42]]) {
  const g = buildCollectibleGeometry(kind), p = g.getAttribute('position'), n = g.getAttribute('normal'), f = g.getAttribute('aFacetNormal');
  assert.equal(p.count / 3, triangles);
  for (const attribute of [p,n,f]) assert.equal(attribute.usage,THREE.StaticDrawUsage,'collectibles must not stream per-frame vertex buffers');
  assert.ok(Math.abs(g.boundingBox.min.y - minY) < 1e-6 && Math.abs(g.boundingBox.max.y - maxY) < 1e-6, 'authored silhouette height changed');
  const edges = new Map(); let gradients = 0;
  for (let i = 0; i < p.count; i++) {
    const normal = new THREE.Vector3().fromBufferAttribute(n, i), facet = new THREE.Vector3().fromBufferAttribute(f, i);
    assert.ok(Number.isFinite(normal.length()) && Math.abs(normal.length() - 1) < 1e-5);
    assert.ok(normal.dot(facet) > .7, 'optical edge roll erased the hard facet');
    if (normal.distanceTo(facet) > .01) gradients++;
  }
  assert.ok(gradients > p.count / 3, 'specular cannot vary within the facets');
  for (let i = 0; i < p.count; i += 3) {
    const v = [0,1,2].map(j => new THREE.Vector3().fromBufferAttribute(p, i+j));
    const cross = v[1].clone().sub(v[0]).cross(v[2].clone().sub(v[0]));
    const center = v[0].clone().add(v[1]).add(v[2]).multiplyScalar(1/3).sub(new THREE.Vector3(0,-.15,0));
    assert.ok(cross.dot(center) > 1e-8, 'degenerate or inward-facing triangle');
    for (let j = 0; j < 3; j++) {
      const a = key(v[j].toArray()), b = key(v[(j+1)%3].toArray()), id = [a,b].sort().join('|');
      const edge = edges.get(id) ?? { count:0, winding:0 }; edge.count++; edge.winding += a < b ? 1 : -1; edges.set(id, edge);
    }
  }
  assert.ok([...edges.values()].every(e => e.count === 2 && e.winding === 0), 'shell has a hole, duplicate cap or unpaired edge');
  const scaled = buildCollectibleGeometry(kind,2);
  assert.ok(Math.abs(scaled.boundingBox.max.y - maxY*2) < 1e-6);
  g.dispose(); scaled.dispose();
}
const material = new CollectibleSpecularMaterial(0x46e882), copy = material.clone();
assert.ok(copy instanceof CollectibleSpecularMaterial);
assert.equal(copy.color.getHex(),0x46e882);
assert.equal(copy.transparent,false); assert.equal(copy.depthWrite,true);
assert.equal(copy.map,null); assert.equal(copy.envMap,null);
copy.opacity=.25; assert.equal(material.opacity,1,'HUD fade mutated the world material');
assert.equal(copy.customProgramCacheKey(),material.customProgramCacheKey());
for (const m of [material,copy]) {
  const shader = { vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{} };
  m.onBeforeCompile(shader, null);
  assert.match(shader.vertexShader,/lightCollectible\(\);/);
  assert.match(shader.fragmentShader,/vec3 outgoingLight = vCollectibleLight;/);
  assert.doesNotMatch(shader.fragmentShader,/vec3 outgoingLight = reflectedLight.indirectDiffuse;/);
  m.dispose();
}
assert.doesNotMatch(COLLECTIBLE_SPECULAR_VERTEX,/texture2D|textureCube|pow\(|sin\(|cos\(/,'runtime specular must stay bounded multiply/dot work');
assert.match(COLLECTIBLE_SPECULAR_VERTEX,/vec3\(1.0, 0.97, 0.93\) \* power32\(key\)/,'colour must not tint the white specular');
const level = await readFile(new URL('../src/level.ts', import.meta.url),'utf8');
assert.doesNotMatch(level,/matcapTexture|matcapTex|MeshMatcapMaterial/);
assert.match(level,/createCollectibleShell\("crystal", scale\)/);
assert.match(level,/createCollectibleShell\("gem", scale, tint\)/);
console.log('Validated closed collectible shells, optical facet normals, vertex-only specular, colour/fade clones and texture-free materials.');
