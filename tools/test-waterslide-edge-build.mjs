import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const baseline=JSON.parse(await readFile(new URL('./fixtures/slipstream-edge-build-baseline.json',import.meta.url),'utf8'));
const snapshot=l=>({
 authored:l.rails.map(r=>({points:r.points.map(p=>p.toArray()),length:r.totalLength,grindable:r.grindable,coping:r.coping})),
 surface:l.surfaceEdgeRails.map(r=>({points:r.points.map(p=>p.toArray()),length:r.totalLength,grindable:r.grindable,owner:l.surfaceEdgeOwners.get(r)?.userData.editorIdx??null,ownerName:l.surfaceEdgeOwners.get(r)?.name??''})),
 dynamic:l.dynamicSurfaceEdges.map(e=>({owner:e.mesh.userData.editorIdx??null,active:e.active(),paths:e.paths.map(p=>({index:l.surfaceEdgeRails.indexOf(p.rail),local:p.local.map(v=>v.toArray())}))})),
});
const hash=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
await withBlockworksRuntime(async r=>{
 const {Rail}=await r.server.ssrLoadModule('/src/rails.ts');
 const data=snapshot(r.l);
 assert.equal(hash(data),baseline.sha256,'Every authored/generated path, owner and moving-rim local coordinate must match the original Slipstream.');
 assert.equal(data.authored.length,baseline.authored);assert.equal(data.surface.length,baseline.surface);assert.equal(data.dynamic.length,baseline.dynamic);
 const check=r.l.systemicEdgeAlreadyAuthored,vector=p=>new THREE.Vector3(...p);
 const cases=[
  ['straight',[[0,0,0],[10,0,0]],[0,0,0],[10,0,0],true],
  ['reversed',[[10,0,0],[0,0,0]],[0,0,0],[10,0,0],true],
  ['inclusive distance',[[0,0,0],[10,0,0]],[0,.2,0],[10,.2,0],true],
  ['outside distance',[[0,0,0],[10,0,0]],[0,.200001,0],[10,.200001,0],false],
  ['uncovered end',[[0,0,0],[9.79,0,0]],[0,0,0],[10,0,0],false],
  ['crossing direction',[[0,0,-2],[0,0,2]],[-.1,0,0],[.1,0,0],false],
  ['interior gap',[[0,0,0],[2,0,0],[5,0,2],[8,0,0],[10,0,0]],[0,0,0],[10,0,0],false],
  ['covered curve',[[0,0,0],[3,0,.05],[7,0,.05],[10,0,0]],[0,0,0],[10,0,0],true],
  ['first tangent tie',[[0,0,0],[0,0,1],[0,0,0],[10,0,0]],[0,0,0],[10,0,0],false],
  ['aligned tangent tie',[[10,0,0],[0,0,0],[0,0,1],[0,0,0]],[0,0,0],[10,0,0],true],
  ['zero first segment',[[0,0,0],[0,0,0],[10,0,0]],[0,0,0],[10,0,0],false],
 ];
 for(const [name,points,start,end,expected] of cases){
  const rail=new Rail(points.map(vector),false);
  assert.equal(check.call(r.l,vector(start),vector(end),[rail]),expected,name);
  // Rigid translations preserve coverage, including negative coordinates.
  const shift=new THREE.Vector3(-300,0,125);
  for(const p of rail.points)p.add(shift);
  assert.equal(check.call(r.l,vector(start).add(shift),vector(end).add(shift),[rail]),expected,name+' translated');
 }
 console.log(`PASS ${cases.length*2} edge-coverage cases and exact Slipstream paths: ${data.surface.length} surface rails, ${baseline.points} points, ${data.dynamic.length} dynamic owners.`);
 // Optional diagnostic: use the actual pre-change predicate from a saved level.ts.
 // The ordinary regression does not use timing thresholds or invoke Git.
 if(process.argv[2]){
  const ts=(await import('typescript')).default,source=await readFile(process.argv[2],'utf8');
  const ast=ts.createSourceFile('baseline.ts',source,ts.ScriptTarget.Latest,true);
  const owner=ast.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='Level');
  const method=owner?.members.find(n=>n.name?.getText(ast)==='systemicEdgeAlreadyAuthored');
  assert.ok(method,'baseline must contain the original edge-coverage method');
  const code=`import * as THREE from '${import.meta.resolve('three')}';\n`+method.getText(ast).replace('private systemicEdgeAlreadyAuthored','export function systemicEdgeAlreadyAuthored');
  const js=ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
  const original=(await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`)).systemicEdgeAlreadyAuthored,rows=[];
  try{
   for(let round=0;round<4;round++)for(const variant of round%2?['after','before']:['before','after']){
    r.l.systemicEdgeAlreadyAuthored=variant==='before'?original:check;
    const start=performance.now();r.l.buildSystemicSurfaceEdgeRails();const ms=performance.now()-start;
    assert.deepEqual(snapshot(r.l),data,variant+': every generated rail and owner must remain identical');
    rows.push({round,variant,ms});
   }
  }finally{r.l.systemicEdgeAlreadyAuthored=check;}
  const median=variant=>{const v=rows.filter(r=>r.variant===variant).map(r=>r.ms).sort((a,b)=>a-b);return (v[1]+v[2])/2;};
  const report={baseline,rows,medianMs:{before:median('before'),after:median('after')},speedup:median('before')/median('after')};
  if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }
},{modulePath:'/src/levels/slipstream.ts',levelId:'slipstream-race',source:m=>m.SLIPSTREAM_LEVEL});
