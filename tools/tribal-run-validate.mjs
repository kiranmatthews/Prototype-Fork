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
// On hosts without npm, run the exact repository script bodies against the
// already-installed dependencies. This never installs or approves build hooks.
const localScripts=process.argv.includes('--local-scripts');
const {scripts}=JSON.parse(await readFile('package.json','utf8'));
const scriptCommand=name=>localScripts?['/bin/sh',['-c',scripts[name]]]:[packageManager,['run',name]];
const checks=[
 ['gameplay-preservation',process.execPath,['tools/tribal-run-gameplay-fingerprint.mjs']],
 ['campaign',process.execPath,['tools/test-six-island-campaign.mjs']],
 ['level-select',process.execPath,['tools/test-level-select.mjs']],
 ['save-previews',process.execPath,['tools/test-save-slot-previews.mjs']],
 ['tribal-map-route',process.execPath,['tools/tribal-run-campaign.mjs']],
 ['levels',...scriptCommand('check:levels')],
 ['build',...scriptCommand('build')],
 ['release-size',...scriptCommand('check:release')],
];
const report={startedAt:new Date().toISOString(),localScripts,checks:[],sourceSha256:{}};
for(const file of ['src/level.ts','src/campaign.ts','src/levels/codex-lab.ts','src/levels/themed-bonuses.ts',
 'src/levels/tribal-run.ts','src/levels/tribal-run-route.ts','src/levels/tribal-run-bonus.ts','src/levels/tribal-run-art.ts','src/levels/tribal-run-textures.ts',
 'public/level-previews/tribal-run.jpg'])report.sourceSha256[file]=createHash('sha256').update(await readFile(file)).digest('hex');
let first=0;
const resume=process.argv.find(a=>a.startsWith('--from='))?.slice(7);
if(resume){
 first=checks.findIndex(c=>c[0]===resume);if(first<0)throw Error('Unknown resume check: '+resume);
 const previous=JSON.parse(await readFile(`${out}/checks.json`,'utf8'));
 if(JSON.stringify(previous.sourceSha256)!==JSON.stringify(report.sourceSha256))throw Error('Cannot reuse checks after source changes');
 const passed=previous.checks.slice(0,first);
 if(passed.length!==first||passed.some((c,i)=>c.name!==checks[i][0]||c.exitCode!==0))throw Error('Missing successful prefix for resume');
 report.checks=passed;report.reusedPrefixFrom=previous.startedAt;
}
for(const [name,command,args]of checks.slice(first)){
 const start=Date.now(),logPath=`${out}/${name}.txt`,log=createWriteStream(logPath);
 console.log(JSON.stringify({check:name,status:'starting'}));
 const env={...process.env,PATH:[path.dirname(process.execPath),path.resolve('node_modules/.bin'),process.env.PATH].join(path.delimiter)};
 // The full-project TypeScript compiler needs more heap than the small native
 // fixtures. Keep the larger budget local to this guarded build subprocess.
 if(name==='build')env.NODE_OPTIONS=[(env.NODE_OPTIONS||'').replace(/(?:^|\s)--max-old-space-size(?:=|\s+)\d+/g,'').trim(),'--max-old-space-size=2048'].filter(Boolean).join(' ');
 const child=spawn(command,args,{env,stdio:['ignore','pipe','pipe']});
 child.stdout.pipe(log,{end:false});child.stderr.pipe(log,{end:false});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',(code,signal)=>resolve(signal?128:code));});
 await new Promise(resolve=>log.end(resolve));
 const result={name,command:path.basename(command),args,nodeOptions:env.NODE_OPTIONS,exitCode:code,seconds:(Date.now()-start)/1000,log:logPath};
 report.checks.push(result);await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(result));
 if(code!==0){console.error((await readFile(logPath,'utf8')).slice(-5000));break;}
}
report.completedAt=new Date().toISOString();report.pass=report.checks.length===checks.length&&report.checks.every(c=>c.exitCode===0);
await writeFile(`${out}/checks.json`,JSON.stringify(report,null,2)+'\n');
if(!report.pass)process.exitCode=1;
