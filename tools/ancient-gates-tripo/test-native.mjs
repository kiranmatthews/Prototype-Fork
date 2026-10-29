import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {measureGlb} from './ancient-native-measure.mjs';
const compiled=await build({entryPoints:['src/ancientGatesAssetBounds.ts'],bundle:true,format:'esm',write:false});
const {ANCIENT_NATIVE_SIZE}=await import('data:text/javascript;base64,'+Buffer.from(compiled.outputFiles[0].text).toString('base64'));
const pack=JSON.parse(await readFile('public/levels.json','utf8'));
const levels=Array.isArray(pack)?pack:pack.levels;
const report=[];
for(const id of ['jungle-gate-run','bonus-jungle-gate']){
 const entry=levels.find(l=>l.id===id),data=entry.data??entry,props=data.components.filter(c=>c.grp===90&&c.t==='decor');
 for(const c of props){
  assert.ok(ANCIENT_NATIVE_SIZE[c.dkind],`${c.nm}: unmeasured native model`);
  const scale=c.s.map((s,i)=>s/ANCIENT_NATIVE_SIZE[c.dkind][i]);
  assert.ok(Math.max(...scale)/Math.min(...scale)<1.00001,`${c.nm}: stretched native axes`);
  assert.equal(c.scenerySolid,false);assert.equal(c.solid,false);
  assert.ok(!/matte|ancientgatevalley|ancientgatehoard/.test(c.dkind),'Scenic painting remains');
 }
 const stacks=new Map();
 for(const c of props.filter(c=>c.dkind==='ancienttikipier')){
  const key=c.p[0]+','+c.p[2]+','+c.nm.replace(/ · tier \d+$/,'');
  if(!stacks.has(key))stacks.set(key,[]);stacks.get(key).push(c);
 }
 for(const [name,stack] of stacks){stack.sort((a,b)=>a.p[1]-b.p[1]);assert.ok(stack[0].p[1]<=-32,`${name}: floating foundation`);for(let i=1;i<stack.length;i++)assert.ok(stack[i].p[1]<=stack[i-1].p[1]+stack[i-1].s[1]+.0001,`${name}: open pier joint`);}
 const gameplay=data.components.filter(c=>c.grp!==90).map(({tex,color,...c})=>{if(['trialsv2plank','stonepaver','ancientcanyonrock'].includes(c.dkind)&&['spinbridge','mover','crumble','phasepad','ramp','mesh','crusher'].includes(c.t))delete c.dkind;return c;}),hash=createHash('sha256').update(JSON.stringify(gameplay)).digest('hex');
 const base=process.argv[2];if(base){const oldPack=JSON.parse(execFileSync('git',['show',`${base}:public/levels.json`],{maxBuffer:64*1024*1024})),oldLevels=Array.isArray(oldPack)?oldPack:oldPack.levels,old=oldLevels.find(l=>l.id===id);assert.deepEqual(gameplay,(old.data??old).components.filter(c=>c.grp!==90).map(({tex,color,...c})=>{if(['trialsv2plank','stonepaver','ancientcanyonrock'].includes(c.dkind)&&['spinbridge','mover','crumble','phasepad','ramp','mesh','crusher'].includes(c.t))delete c.dkind;return c;}),'Gameplay geometry or rules changed');}
 report.push({id,nativeProportionProps:props.length,connectedPierStacks:stacks.size,gameplaySha256:hash});
}
const assets=JSON.parse(await readFile('docs/ancient-gates/tripo/native-assets.json','utf8'));
for(const a of assets.assets.filter(a=>a.kind.startsWith('ancient'))){const actual=await measureGlb(a.file);assert.ok(actual.triangles<=10000,`${a.kind}: game triangle budget exceeded`);assert.equal(actual.materials,1);assert.deepEqual(actual.size,a.size);}
await writeFile('docs/ancient-gates/tripo/native-validation.json',JSON.stringify({levels:report,triangleCeiling:10000,allChecksPassed:true},null,2)+'\n');
console.log(JSON.stringify(report));
