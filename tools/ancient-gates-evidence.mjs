import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const phase=process.argv[2]??'greybox';if(!/^[a-z-]+$/.test(phase))throw Error('Use a simple evidence phase name');
const output=`docs/ancient-gates/evidence/${phase}`;await mkdir(output,{recursive:true});
const files={
 'main-native':'/private/tmp/ancient-gates-native/journey--1-11.json',
 'bonus-native':'/private/tmp/ancient-gates-native/bonus.json',
 'main-browser-lite':'/private/tmp/ancient-gates-browser/lite--1-11.json',
 'bonus-session-lite':'/private/tmp/ancient-gates-bonus-browser/lite-session.json',
 'recovery':'/private/tmp/ancient-gates-native/recovery.json',
};
const manifest={phase,capturedAt:new Date().toISOString(),sources:{},reports:{}};
for(const path of ['src/levels/ancient-gates-route.ts','src/levels/ancient-gates-bonus.ts','src/tuning.ts'])
 manifest.sources[path]=createHash('sha256').update(await readFile(path)).digest('hex');
const certificates=JSON.parse(await readFile('tools/fixtures/stock-level-snapshots.json','utf8'));
manifest.snapshotCertificates=Object.fromEntries(['jungle-gate-run','bonus-jungle-gate'].map(id=>[id,certificates.levels[id]]));
for(const [name,path] of Object.entries(files)){
 const raw=await readFile(path,'utf8'),trace=raw.indexOf('"trace":');
 const data=JSON.parse(trace<0?raw:raw.slice(0,trace).replace(/,\s*$/,'')+'}');
 if(data.report?.failure||data.failure||data.errors?.length)throw Error(`Cannot archive failed evidence: ${name}`);
 await writeFile(`${output}/${name}.json`,JSON.stringify(data,null,2)+'\n');
 manifest.reports[name]={path:`${name}.json`,source:path,traceRetainedLocally:trace>=0};
}
await writeFile(`${output}/manifest.json`,JSON.stringify(manifest,null,2)+'\n');console.log(`Saved compact ${phase} evidence in ${output}`);
