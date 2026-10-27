// Serial local handoff checks. Launch this foreground command through the
// shared run_heavy.py guard; it owns no browser or publishing credentials.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
const out=process.env.TRIBAL_VALIDATION_OUTPUT||'docs/tribal-run/validation';
await mkdir(out,{recursive:true});
const packageManager=process.env.TRIBAL_PACKAGE_MANAGER||'npm';
const checks=[
 ['gameplay-preservation',process.execPath,['tools/tribal-run-gameplay-fingerprint.mjs']],
 ['campaign',process.execPath,['tools/test-six-island-campaign.mjs']],
 ['level-select',process.execPath,['tools/test-level-select.mjs']],
 ['save-previews',process.execPath,['tools/test-save-slot-previews.mjs']],
 ['warp-return',process.execPath,['tools/test-warp-room-return.mjs']],
 ['levels',packageManager,['run','check:levels']],
 ['build',packageManager,['run','build']],
 ['release-size',packageManager,['run','check:release']],
];
const report={startedAt:new Date().toISOString(),checks:[],sourceSha256:{}};
for(const file of ['src/level.ts','src/campaign.ts','src/levels/codex-lab.ts','src/levels/themed-bonuses.ts',
 'src/levels/tribal-run.ts','src/levels/tribal-run-route.ts','src/levels/tribal-run-bonus.ts','src/levels/tribal-run-art.ts','src/levels/tribal-run-textures.ts',
 'public/level-previews/tribal-run.jpg'])report.sourceSha256[file]=createHash('sha256').update(await readFile(file)).digest('hex');
for(const [name,command,args]of checks){
 const start=Date.now(),logPath=`${out}/${name}.txt`,log=createWriteStream(logPath);
 console.log(JSON.stringify({check:name,status:'starting'}));
 const child=spawn(command,args,{env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH},stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve(signal?128:code));});
 await new Promise(resolve=>log.end(resolve));
 const result={name,command:path.basename(command),args,exitCode:code,seconds:(Date.now()-start)/1000,log:logPath};
 report.checks.push(result);await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(result));
 if(code!==0){console.error((await readFile(logPath,'utf8')).slice(-5000));break;}
}
report.completedAt=new Date().toISOString();report.pass=report.checks.length===checks.length&&report.checks.every(c=>c.exitCode===0);
await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2)+'\n');
if(!report.pass)process.exitCode=1;
