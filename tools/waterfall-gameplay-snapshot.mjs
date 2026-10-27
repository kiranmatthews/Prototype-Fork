import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export {WATERFALL_CLIMB_LEVEL as main,WATERFALL_ACTIONS as route} from './src/levels/waterfall-climb';export {WATERFALL_CLIMB_BONUS as bonus} from './src/levels/waterfall-climb-bonus';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const data=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
// Appearance may change after the greybox lock; movement, collision, rewards,
// timers, controls and the authored camera remain the tested course.
const appearance=new Set(['color','tex','emissive','image','imageUrl','imageRepeat','imageOffset','uvScale','uvOffset','uvRotation','uvs','colors']);
const visual=c=>c.t==='decor'||c.t==='mesh'&&c.solid===false||c.t==='wallpath'&&c.solid===false;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])):v;
const snapshot={};
for(const key of ['main','bonus']){
 const d=data[key],components=d.components.filter(c=>!visual(c)).map(c=>Object.fromEntries(Object.entries(c).filter(([k])=>!appearance.has(k))));
 const rules=Object.fromEntries(['spawn','killY','fallRecoveryDrop','hugeDropBail','cameraAirLift','startWarpPad','hudMode','medalTimes'].filter(k=>d[k]!==undefined).map(k=>[k,d[k]]));
 const payload=canonical({rules,components,...key==='main'?{route:data.route}:{}});
 snapshot[key]={components:components.length,sha256:createHash('sha256').update(JSON.stringify(payload)).digest('hex')};
 // Ordinary authored platforms and temporary leaves keep their grindable rims.
 assert.ok(d.components.filter(c=>['platform','spinbridge','crumble'].includes(c.t)).every(c=>c.edgeGrinding!==false));
 for(const c of d.components.filter(c=>c.t==='decor'))assert.equal(c.scenerySolid,false,`${c.nm??c.dkind} must remain outside gameplay collision`);
}
const path='docs/waterfall-climb/redesign-gameplay-baseline.json';
if(process.argv.includes('--write'))await writeFile(path,JSON.stringify(snapshot,null,2)+'\n');
else assert.deepEqual(snapshot,JSON.parse(await readFile(path,'utf8')),'Decoration altered the validated greybox course');
console.log(process.argv.includes('--write')?'RECORDED greybox gameplay lock':'PASS unchanged waterfall gameplay geometry, timing, camera, rewards and edge policy',JSON.stringify(snapshot));
