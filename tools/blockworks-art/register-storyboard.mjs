import {readFile,writeFile,copyFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const [id,source]=process.argv.slice(2);
if(!/^\d{3}-d[1-8]-\d+$/.test(id||'')||!source)throw new Error('Usage: register-storyboard.mjs CAPTURE_ID GENERATED_IMAGE_PATH');
const root=fileURLToPath(new URL('../../',import.meta.url));
const prompts=JSON.parse(await readFile(`${root}/tools/blockworks-art/prompts.json`,'utf8'));
const spec=prompts.views.find(s=>s.id===id);if(!spec)throw new Error('Unrecognized capture ID');
let refinement;try{refinement=JSON.parse(await readFile(`${root}/tools/blockworks-art/refinements.json`,'utf8'))[id];}catch(error){if(error.code!=='ENOENT')throw error;}
const path=`${root}/tools/blockworks-art/storyboard-ledger.json`;
const ledger=JSON.parse(await readFile(path,'utf8'));
const target=`${root}/${spec.output}`;
if(source!==target)await copyFile(source,target);
const bytes=await readFile(target);
ledger.views[id]={output:spec.output,state:'generated',generatedAt:new Date().toISOString(),bytes:(await stat(target)).size,
 sha256:createHash('sha256').update(bytes).digest('hex'),promptSha256:createHash('sha256').update(refinement?.prompt||spec.prompt).digest('hex'),
 ...(refinement?{refinementRecord:`tools/blockworks-art/refinements.json#${id}`,inputReferences:refinement.references}:{}),
 capture:spec.capture,captureSha256:createHash('sha256').update(await readFile(`${root}/${spec.capture}`)).digest('hex'),styleReference:spec.styleReference,review:'pending'};
await writeFile(path,JSON.stringify(ledger,null,2)+'\n');
const jobPath=`${root}/tools/blockworks-art/job.json`,job=JSON.parse(await readFile(jobPath,'utf8'));
job.evidence.storyboardsGenerated=Object.keys(ledger.views).length;job.updatedAt=new Date().toISOString();
await writeFile(jobPath,JSON.stringify(job,null,2)+'\n');
console.log(JSON.stringify({id,total:Object.keys(ledger.views).length,output:spec.output}));
