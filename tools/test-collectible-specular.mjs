import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';

const source = await readFile(new URL('../src/collectibleSpecular.ts', import.meta.url), 'utf8');
const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2020 } }).outputText.replace('from "three"', `from ${JSON.stringify(import.meta.resolve('three'))}`);
const { buildCollectibleGeometry, collectiblePolygons, CollectibleSpecularMaterial, COLLECTIBLE_SPECULAR_VERTEX, COLLECTIBLE_SPECULAR_FRAGMENT } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const key = p => p.map(v => v.toFixed(5)).join(',');
for (const [kind, triangles, minY, maxY] of [['crystal',22,-1.5,.72],['gem',78,-.45,.28]]) {
  const g = buildCollectibleGeometry(kind), p = g.getAttribute('position'), n = g.getAttribute('normal'), f = g.getAttribute('aFacetNormal');
  assert.equal(p.count / 3, triangles);
  for (const attribute of Object.values(g.attributes)) assert.equal(attribute.usage,THREE.StaticDrawUsage,'collectibles must not stream per-frame vertex buffers');
  assert.ok(Math.abs(g.boundingBox.min.y - minY) < 1e-6 && Math.abs(g.boundingBox.max.y - maxY) < 1e-6, 'authored silhouette height changed');
  const polygons = collectiblePolygons(kind), corners = new Set(polygons.flat().map(p=>key(p.toArray())));
  const counts = polygons.reduce((hist,face)=>(hist[face.length]=(hist[face.length]??0)+1,hist),{});
  assert.deepEqual(counts,kind==='crystal'?{4:5,5:4}:{3:40,4:16,8:1},'physical facet topology changed');
  assert.deepEqual(g.userData.faceVertexCounts,polygons.map(face=>face.length));
  for(const face of polygons) {
    const normal=face[1].clone().sub(face[0]).cross(face[2].clone().sub(face[0])).normalize();
    for(const corner of face)assert.ok(Math.abs(corner.clone().sub(face[0]).dot(normal))<1e-6,'a nominal cut is not planar');
  }
  const edges = new Map();
  for (let i = 0; i < p.count; i++) {
    const normal = new THREE.Vector3().fromBufferAttribute(n, i), facet = new THREE.Vector3().fromBufferAttribute(f, i);
    assert.ok(Number.isFinite(normal.length()) && Math.abs(normal.length() - 1) < 1e-5);
    assert.ok(normal.distanceTo(facet)<1e-7,'optical normals must not create face-centre hotspots');
    assert.ok(corners.has(key(new THREE.Vector3().fromBufferAttribute(p,i).toArray())),'synthetic interior/face-centre vertex reintroduced');
  }
  let offset=0;
  for(const face of polygons) {
    const length=(face.length-2)*3, tangent=new THREE.Vector3().fromBufferAttribute(g.getAttribute('aFaceTangent'),offset);
    const normal=new THREE.Vector3().fromBufferAttribute(n,offset), bitangent=normal.clone().cross(tangent);
    const planePoint=new THREE.Vector3().fromBufferAttribute(p,offset);
    for(const corner of polygons.flat())assert.ok(corner.clone().sub(planePoint).dot(normal)<1e-6,'cut planes fold inward or intersect the shell');
    const u=face.map(p=>p.dot(tangent)),v=face.map(p=>p.dot(bitangent));
    const minU=Math.min(...u),spanU=Math.max(...u)-minU,minV=Math.min(...v),spanV=Math.max(...v)-minV;
    for(let i=offset;i<offset+length;i++) {
      const point=new THREE.Vector3().fromBufferAttribute(p,i),uv=g.getAttribute('aFaceUv');
      assert.ok(normal.distanceTo(new THREE.Vector3().fromBufferAttribute(n,i))<1e-7,'diagonal became a cut');
      assert.ok(Math.abs(uv.getX(i)-(point.dot(tangent)-minU)/spanU)<1e-5,'face U is not affine across triangles');
      assert.ok(Math.abs(uv.getY(i)-(point.dot(bitangent)-minV)/spanV)<1e-5,'face V is not affine across triangles');
    }
    offset+=length;
  }
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
assert.equal(copy.transparent,true); assert.equal(copy.depthWrite,true);
assert.equal(copy.side,THREE.FrontSide,'subtle body transmission must not add a rear-shell pass');
assert.equal(copy.map,null); assert.equal(copy.envMap,null);
copy.opacity=.25; assert.equal(material.opacity,1,'HUD fade mutated the world material');
assert.equal(copy.customProgramCacheKey(),material.customProgramCacheKey());
const crystalMaterial = new CollectibleSpecularMaterial(0xc83afa, 'crystal');
const crystalCopy = crystalMaterial.clone();
assert.equal(crystalCopy.userData.collectibleProfile,'crystal','HUD clone lost its crystal optics');
assert.equal(crystalCopy.customProgramCacheKey(),crystalMaterial.customProgramCacheKey());
assert.notEqual(crystalCopy.customProgramCacheKey(),material.customProgramCacheKey(),'gem and crystal shaders shared the wrong cached profile');
for (const m of [crystalMaterial,crystalCopy]) {
  const shader = { vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{} };
  m.onBeforeCompile(shader,null);
  assert.match(shader.vertexShader,/#define COLLECTIBLE_CRYSTAL 1/);
  m.dispose();
}
for (const m of [material,copy]) {
  const shader = { vertexShader:THREE.ShaderLib.basic.vertexShader,fragmentShader:THREE.ShaderLib.basic.fragmentShader,uniforms:{} };
  m.onBeforeCompile(shader, null);
  assert.match(shader.vertexShader,/#define COLLECTIBLE_CRYSTAL 0/);
  assert.match(shader.vertexShader,/lightCollectible\(\);/);
  assert.match(shader.fragmentShader,/vec3 outgoingLight = vCollectibleLight \+/);
  assert.match(shader.fragmentShader,/float highlightCoverage = max\(flash \+ edgeFlash, min\(min\(outgoingLight.r, outgoingLight.g\), outgoingLight.b\)\)/,'clipped white faces must be opaque too');
  assert.match(shader.fragmentShader,/diffuseColor.a = opacity \* mix\(0.86, 1.0, clamp\(highlightCoverage, 0.0, 1.0\)\)/,'white glints must reach opaque independently of the body');
  assert.doesNotMatch(shader.fragmentShader,/vec3 outgoingLight = reflectedLight.indirectDiffuse;/);
  m.dispose();
}
assert.doesNotMatch(COLLECTIBLE_SPECULAR_VERTEX,/texture2D|textureCube|pow\(|sin\(|cos\(/,'runtime specular must stay bounded multiply/dot work');
assert.match(COLLECTIBLE_SPECULAR_FRAGMENT,/vec3\(1.0, 0.98, 0.97\) \* flash/,'colour must not tint the white specular');
assert.match(COLLECTIBLE_SPECULAR_FRAGMENT,/abs\(vCollectibleUv.x - vCollectibleSweep.x\)/,'highlight must sweep across a face, not converge radially');
assert.doesNotMatch(COLLECTIBLE_SPECULAR_FRAGMENT,/texture|normalMatrix|normalize\(|dot\(|pow\(/,'fragment envelope must not add per-pixel lighting or texture passes');
const level = await readFile(new URL('../src/level.ts', import.meta.url),'utf8');
assert.doesNotMatch(level,/matcapTexture|matcapTex|MeshMatcapMaterial/);
assert.match(level,/createCollectibleShell\("crystal", scale\)/);
assert.match(level,/createCollectibleShell\("gem", scale, tint\)/);
console.log('Validated physical polygon cuts, planar corner-only topology, affine highlight coordinates, colour/fade clones and texture-free facet lighting.');
