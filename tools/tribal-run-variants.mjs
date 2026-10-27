import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
import {auditTribalGeometry} from './tribal-run-geometry-audit.mjs';
import {runTribalVariants} from './tribal-run-variants-pilot.mjs';
const out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/greybox/evidence',selected=process.env.TRIBAL_CASE;
await mkdir(out,{recursive:true});
await withBlockworksRuntime(async r=>{
 r.report={stage:'spawn',actions:[],evidence:[],sourceSha256:createHash('sha256').update(JSON.stringify(r.source)).digest('hex'),geometry:auditTribalGeometry(r)};
 const file=`${out}/variants${selected?'-'+selected:''}-native.json`;
 const pilot=runTribalVariants(r,{selected});let next,saved=0;
 const save=()=>writeFile(file,JSON.stringify({report:r.report,trace:r.trace}));
 try{
  while(!(next=pilot.next()).done){
   r.tick(next.value);
   if((r.report.scenarios?.length??0)>saved){saved=r.report.scenarios.length;await save();console.log(JSON.stringify(r.report.scenarios.at(-1)));}
  }
  r.report.result=next.value;console.log(JSON.stringify({pass:true,result:next.value}));
 }catch(error){r.report.error=error.message;throw error;}finally{await save();}
},{modulePath:'/src/levels/tribal-run.ts',source:m=>m.TRIBAL_RUN_LEVEL,levelId:'tribal-run',maxFrames:35000,optimizeDeps:{noDiscovery:true,include:[]}});
