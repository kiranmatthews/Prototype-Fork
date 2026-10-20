import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import ts from 'typescript';
import {withBlockworksRuntime} from '../blockworks-runner.mjs';

// Supply a saved pre-change coastalSurf.ts; never writes to game source or assets.
const baselinePath=process.argv[2];
if(!baselinePath)throw Error('Usage: node tools/waterslide-island/benchmark-shore.mjs /path/to/baseline-coastalSurf.ts [report.json]');
const baseline=JSON.parse(await readFile(new URL('../fixtures/shore-field-baseline.json',import.meta.url),'utf8')).slipstream;
const source=await readFile(baselinePath,'utf8');
const executable=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText.replace(/from ['"]three['"]/g,`from '${import.meta.resolve('three')}'`);
const before=await import(`data:text/javascript;base64,${Buffer.from(executable).toString('base64')}`),rows=[];
await withBlockworksRuntime(async r=>{
 const after=await r.server.ssrLoadModule('/src/coastalSurf.ts'),water=r.l.water,ground=r.l.groundMeshes.filter(m=>!m.userData.noWaterShore);
 water.ribbon.geometry.computeBoundingBox();
 const bounds=water.ribbon.geometry.boundingBox.clone().applyMatrix4(water.ribbon.matrixWorld);
 for(let round=0;round<4;round++)for(const variant of round%2?['after','before']:['before','after']){
  const start=performance.now(),field=(variant==='before'?before:after).createShoreField(ground,water.seaLevel,bounds),ms=performance.now()-start;
  try{
   const data=field.texture.image.data;
   const actual={size:[field.texture.image.width,field.texture.image.height],bounds:field.bounds.toArray(),segments:field.segments,hasBed:field.hasBed,sha256:createHash('sha256').update(Buffer.from(data.buffer,data.byteOffset,data.byteLength)).digest('hex')};
   assert.deepEqual(actual,baseline,variant+': complete coast data must match the approved reference');
   rows.push({variant,round,ms,sha256:actual.sha256});
  }finally{field.texture.dispose();}
 }
 const median=values=>{const sorted=values.toSorted((a,b)=>a-b);return (sorted[1]+sorted[2])/2;};
 const beforeMs=median(rows.filter(r=>r.variant==='before').map(r=>r.ms)),afterMs=median(rows.filter(r=>r.variant==='after').map(r=>r.ms));
 const result={baseline,rows,medianMs:{before:beforeMs,after:afterMs},speedup:beforeMs/afterMs};
 if(process.argv[3])await writeFile(process.argv[3],JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
},{modulePath:'/src/levels/slipstream.ts',levelId:'slipstream-race',source:m=>m.SLIPSTREAM_LEVEL});
