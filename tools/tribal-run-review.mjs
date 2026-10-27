// Run this foreground batch under the shared host validation guard. Each
// child closes its own Chrome instance before the next case starts.
import {spawn} from 'node:child_process';
const art=process.argv.includes('--art'),staticOnly=process.argv.includes('--static');
let cases=[
 ['restart points and crossover camera','tribal-run-browser.mjs',['--full','--native'],{}],
 ['recovery and four optional grinds','tribal-run-journey-browser.mjs',['--native','--variants'],{}],
 ['upper woven route','tribal-run-journey-browser.mjs',['--native','--upper'],{TRIBAL_PHASE:'loom'}],
 ['continuous main route','tribal-run-journey-browser.mjs',['--native'],{}],
 ['linked bonus entry, all crates and return','tribal-run-journey-browser.mjs',['--native','--detour'],{}],
];
if(art)cases.splice(1,0,['bonus sanctuary visual review','tribal-run-browser.mjs',['--full','--native','--bonus'],{}]);
if(art)cases.push(['normal presentation','tribal-run-browser.mjs',['--full','--spawn-only'],{TRIBAL_OUTPUT:(process.env.TRIBAL_OUTPUT||'docs/tribal-run/art/evidence')+'/normal'}],
 ['actual campaign thumbnail and menu launch','tribal-run-preview.mjs',[],{}]);
if(staticOnly)cases=cases.filter(c=>c[1]==='tribal-run-browser.mjs');
if(process.argv.includes('--handoff'))cases=[
 ['campaign preview, runtime geometry and menu launch','tribal-run-preview.mjs',[],{}],
 ['focused checks and production build','tribal-run-validate.mjs',[],{}],
];
for(const [label,file,args,env]of cases){
 console.log(JSON.stringify({review:label,status:'starting'}));
 const child=spawn(process.execPath,['tools/'+file,...args],{stdio:'inherit',env:{...process.env,TRIBAL_PHASE:'all',...env}});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>signal?reject(Error(signal)):resolve(code));});
 if(code!==0)process.exit(code??1);
 console.log(JSON.stringify({review:label,status:'passed'}));
}
