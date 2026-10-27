import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';

const appearance=new Set(['tex','color','colors','uvs','emissive','opacity','fog','castShadow','nm','lk','artProxy']);
const rows={};
for(const [file,key]of [['tribal-run','TRIBAL_RUN_LEVEL'],['tribal-run-bonus','TRIBAL_RUN_BONUS_LEVEL']]){
 const {outputFiles}=await build({entryPoints:[`src/levels/${file}.ts`],bundle:true,write:false,format:'esm',platform:'node'});
 const data=(await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64')))[key];
 const components=data.components.filter(c=>(c.grp??0)<100).map(c=>Object.fromEntries(Object.entries(c)
  .filter(([k])=>!appearance.has(k)&&!(c.t==='pit'&&k==='invisible')).sort(([a],[b])=>a.localeCompare(b))));
 const gameplay=Object.fromEntries(['spawn','killY','fallRecoveryDrop','startWarpPad','cameraAirLift','cameraLookAhead','hudMode','skatepark','chase','collapse','race','medalTimes'].map(k=>[k,data[k]]));
 rows[file]={sha256:createHash('sha256').update(JSON.stringify({...gameplay,components})).digest('hex'),components:components.length};
}
const path='docs/tribal-run/greybox/gameplay-fingerprint.json';
if(process.argv.includes('--record'))await writeFile(path,JSON.stringify(rows,null,2)+'\n');
else assert.deepEqual(rows,JSON.parse(await readFile(path,'utf8')),'The visual pass changed the authored gameplay contract');
console.log(JSON.stringify({pass:true,recorded:process.argv.includes('--record'),levels:rows}));
