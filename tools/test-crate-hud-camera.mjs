import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
import * as THREE from 'three';

const require = createRequire(import.meta.url);
const source = await readFile(new URL('../src/crateHudCamera.ts',import.meta.url),'utf8');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText
  .replace(/from ['"]three['"]/,`from '${pathToFileURL(require.resolve('three')).href}'`);
const {createCrateHudCamera,crateHudScale,CRATE_HUD_VIEW} = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

// Project actual points through Three's matrices, independently of the envelope
// calculation. Cover every angle, narrow receipt slots and alternative lenses.
let projections=0;
for(const aspect of [.45,.7,1,1.5,2])for(const lens of [50,100,180])for(const degrees of [5,17,35]){
  const camera=createCrateHudCamera(lens);camera.aspect=aspect;camera.updateProjectionMatrix();
  const tilt=THREE.MathUtils.degToRad(degrees), half=.515, radius=Math.SQRT2*half;
  const scale=crateHudScale(aspect,half,radius,camera.position.z,tilt);
  const transform=new THREE.Matrix4().makeRotationX(tilt).scale(new THREE.Vector3(scale,scale,scale));
  let max=0;
  for(let angle=0;angle<Math.PI*2;angle+=Math.PI/720)for(const y of [-half,0,half]){
    const point=new THREE.Vector3(Math.sin(angle)*radius,y,Math.cos(angle)*radius).applyMatrix4(transform).project(camera);
    max=Math.max(max,Math.abs(point.x),Math.abs(point.y));
    assert.ok(Math.abs(point.x)<=CRATE_HUD_VIEW.fill+1e-6&&Math.abs(point.y)<=CRATE_HUD_VIEW.fill+1e-6,`clipped at aspect=${aspect}, lens=${lens}, tilt=${degrees}`);
    assert.ok(point.z>-1&&point.z<1,'near/far plane clipping');
    projections++;
  }
  assert.ok(max>CRATE_HUD_VIEW.fill-.002,'excess empty framing');
}
assert.equal(crateHudScale(0,.5,.7,3),0);
console.log(`PASS crate camera: ${projections} projected points, complete turns, portrait/Bonus aspects, 50–180 mm lenses, 5–35° tilt, no clipping or wasted framing`);
