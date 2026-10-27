import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const bundle=await build({stdin:{contents:"export * from './src/levels/ancient-gates-route';export * from './src/levels/ancient-gates-bonus';",resolveDir:process.cwd()},bundle:true,format:'esm',write:false});
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const main=m.JUNGLE_GATE_RUN_LEVEL,bonus=m.ANCIENT_GATES_BONUS;
// Group IDs are gameplay data: they wire bang switches to restored surfaces.
const visualKeys=new Set(['color','tex','nm','emissive','opacity','fog','castShadow','flatShading']);
const geometry=data=>({spawn:data.spawn,killY:data.killY,ledgeAssist:data.ledgeAssist,
 components:data.components.filter(c=>c.t!=='torch'&&!(c.t==='mesh'&&c.solid===false)&&!(c.t==='decor'&&c.solid===false))
  .map(c=>({...Object.fromEntries(Object.entries(c).filter(([k])=>!visualKeys.has(k))),...(c.tex==='ice'?{icyTexture:true}:{})}))});
const digest=data=>createHash('sha256').update(JSON.stringify(geometry(data))).digest('hex');
const countBoxes=data=>data.components.filter(c=>c.t==='checkpoint'||c.t==='crate'&&!['metal','metalbounce','bang','nitrobang'].includes(c.kind)).length;
const gate=data=>{const gates=data.components.filter(c=>c.t==='gate');assert.equal(gates.length,1);return gates[0];};
const metrics={mainLength:gate(main).p[0]-main.spawn[0],originalLength:448,
 bonusLength:gate(bonus).p[0]-bonus.spawn[0],enemyTypes:[...new Set(main.components.filter(c=>c.t==='enemy').map(c=>c.foe))].sort(),
 enemies:main.components.filter(c=>c.t==='enemy').length,checkpoints:main.components.filter(c=>c.t==='checkpoint').length,
 mainBoxes:countBoxes(main),bonusBoxes:countBoxes(bonus),mainGeometrySha256:digest(main),bonusGeometrySha256:digest(bonus)};
assert.ok(metrics.mainLength>=448*3);assert.ok(metrics.enemyTypes.length>=8);assert.equal(metrics.bonusBoxes,28);
assert.ok(main.components.every(c=>c.edgeGrinding!==false),'Do not blanket-disable platform edges');
assert.ok(main.killY<Math.min(...m.ANCIENT_GATES_DECKS.map(d=>d.y))-10);
for(const cp of main.components.filter(c=>c.t==='checkpoint'))assert.ok(m.ANCIENT_GATES_DECKS.some(d=>cp.p[0]>d.a+1&&cp.p[0]<d.b-1&&Math.abs(cp.p[1]-d.y)<.01),`Checkpoint lacks stable receiver: ${cp.nm}`);
const pack=JSON.parse(await readFile('public/levels.json','utf8'));
for(const [id,data] of [['jungle-gate-run',main],['bonus-jungle-gate',bonus]])assert.deepEqual(pack.levels.find(e=>e.id===id)?.data,data,`${id} release snapshot differs from source`);
const baseline='docs/ancient-gates/evidence/greybox/layout.json';
if(process.argv.includes('--record')){await mkdir('docs/ancient-gates/evidence/greybox',{recursive:true});await writeFile(baseline,JSON.stringify(metrics,null,2)+'\n',{flag:'wx'});}
else{const before=JSON.parse(await readFile(baseline,'utf8'));assert.equal(metrics.mainGeometrySha256,before.mainGeometrySha256,'Art changed main gameplay geometry');assert.equal(metrics.bonusGeometrySha256,before.bonusGeometrySha256,'Art changed bonus gameplay geometry');}
console.log(JSON.stringify(metrics));
