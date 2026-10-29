import {spawn} from 'node:child_process';
import {readFile,writeFile,mkdir,access} from 'node:fs/promises';
import {resolve} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const manifest=JSON.parse(await readFile(resolve(root,'docs/carlisle-relay/shipyard-polish/props.json'),'utf8'));
const base=resolve(root,'art/carlisle-shipyard');
const cli='/Users/kiki/.local/bin/tripo';
const env={...process.env,PATH:'/Users/kiki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:/Users/kiki/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin',TRIPO_CLIENT_APP:'codex',TRIPO_DISTRIBUTION_CHANNEL:'codex_plugin'};
const dry=process.argv.includes('--dry-run');
const selected=process.argv.find(a=>a.startsWith('--asset='))?.split('=')[1];
if(!dry&&!process.argv.includes('--generate'))throw new Error('Choose --dry-run or --generate --asset=<id>. Paid generation requires the approved batch plan.');
if(!dry&&!selected)throw new Error('Generate one asset at a time so each preview can be reviewed.');
const assets=manifest.assets.filter(p=>!selected||p.id===selected);
if(!assets.length)throw new Error('Unknown asset '+selected);
await mkdir(base,{recursive:true});
const plans=[];
for(const prop of assets){
 const dest=resolve(base,'models',prop.id),record=resolve(dest,'result.json');
 if(!dry){try{await access(record);throw new Error('Result exists; inspect it before any paid retry: '+record);}catch(e){if(e.code!=='ENOENT')throw e;}}
 const args=['make',prop.reference,'--for','toy','--model','tripo-p1','-p',`face_limit=${prop.faceBudget}`,'-p','texture=true','-p','pbr=true','-p','auto_size=true','--name','carlisle-'+prop.id.slice(3),'-o','art/carlisle-shipyard','--json',dry?'--dry-run':'--yes'];
 if(!dry)await mkdir(dest,{recursive:true});
 const stdout=[],stderr=[];
 const code=await new Promise((done,reject)=>{const child=spawn(cli,args,{cwd:root,env,stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>stdout.push(b));child.stderr.on('data',b=>{stderr.push(b);if(!dry)process.stderr.write(b);});child.on('error',reject);child.on('close',done);});
 const output=Buffer.concat(stdout).toString(),log=Buffer.concat(stderr).toString();
 if(!dry){await writeFile(resolve(dest,'stdout.log'),output);await writeFile(resolve(dest,'progress.log'),log);}
 if(code!==0){if(!dry)await writeFile(resolve(dest,'failure.json'),JSON.stringify({exitCode:code,command:args},null,2)+'\n');console.error(prop.id+' CLI exit '+code);process.exit(code||1);}
 const result=JSON.parse(output.trim().split('\n').at(-1));
 if(dry){if(!result.valid)throw new Error('Invalid plan '+prop.id);plans.push({id:prop.id,name:prop.name,faceBudget:prop.faceBudget,estimatedCredits:50,args:args.filter(a=>a!=='--dry-run').concat('--yes'),plan:result});}
 else{await writeFile(record,JSON.stringify({id:prop.id,args,result},null,2)+'\n');console.log(JSON.stringify({id:prop.id,result}));}
}
if(dry){const record={model:'tripo-p1',wireModel:'P1-20260311',estimatedTotal:plans.reduce((s,p)=>s+p.estimatedCredits,0),assets:plans};await writeFile(resolve(base,'tripo-plan.json'),JSON.stringify(record,null,2)+'\n');console.log(JSON.stringify({valid:true,assets:plans.length,estimatedTotal:record.estimatedTotal,steps:plans.map(p=>({id:p.id,faceBudget:p.faceBudget,steps:p.plan.steps.length,warnings:p.plan.warnings}))}));}
