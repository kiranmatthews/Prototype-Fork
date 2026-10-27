// Run sequentially inside the release coordinator's shared heavy-job guard.
import {spawnSync} from 'node:child_process';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const out=resolve('docs/beach-street/kite');mkdirSync(out,{recursive:true});
const pkg=JSON.parse(readFileSync('package.json','utf8'));
const env={...process.env,PATH:`${dirname(process.execPath)}:${resolve('node_modules/.bin')}:${process.env.PATH??''}`};
const buildOnly=process.argv.includes('--build-only');
const steps=[['motion','node tools/test-kite-motion.mjs',30000],['native','node tools/test-beach-kite.mjs',180000],
 ['coastal-art','node tools/test-coastal-town.mjs --main',120000],['check-levels',pkg.scripts['check:levels'],300000],['build',pkg.scripts.build,300000]];
const reportPath=`${out}/${buildOnly?'build-final':'checks'}.json`;
const report={started:new Date().toISOString(),steps:[]};
for(const [name,command,timeout]of steps.filter(([name])=>!buildOnly||name==='build')){
 console.log('START',name);const start=Date.now();const result=spawnSync(command,{shell:true,env,encoding:'utf8',timeout,maxBuffer:32*1024*1024});
 writeFileSync(`${out}/${name}.log`,(result.stdout??'')+(result.stderr??''));
 report.steps.push({name,command,exit:result.status,seconds:(Date.now()-start)/1000,error:result.error?.message});
 writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
 console.log('DONE',name,result.status,report.steps.at(-1).seconds);
 if(result.status!==0){console.log((result.stdout??'').slice(-4000),(result.stderr??'').slice(-3000));process.exit(1);}
}
report.finished=new Date().toISOString();report.pass=true;writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');
