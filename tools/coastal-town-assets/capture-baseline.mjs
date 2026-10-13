import {createServer} from 'vite';
import {writeFile,unlink} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const ref=process.argv[2];
if(!ref)throw new Error('Pass the pre-art source commit explicitly. Never baseline the decorated level.');
const commit=execFileSync('git',['rev-parse',ref],{encoding:'utf8'}).trim();
const fixture='src/levels/coastal-gameplay-baseline.tmp.ts';
await writeFile(fixture,execFileSync('git',['show',commit+':src/levels/coastal-street-run.ts']));
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
const gameplay=data=>({spawn:data.spawn,killY:data.killY,components:data.components.filter(c=>c.t!=='decor'&&c.solid!==false).map(c=>{
 const {color,tex,emissive,nm,grp,...physical}=c;return physical;
})});
try{
 const {COASTAL_STREET_RUN_LEVEL}=await server.ssrLoadModule('/'+fixture);
 const {makeBonusCourse}=await server.ssrLoadModule('/src/levels/bonus-course-kit.ts');
 // Original Coastal recipe on this source revision; no decorated resolver.
 const bonus=makeBonusCourse({name:'Bonus: Rooftop Deliveries',patterns:['finite','fuse'],
   style:{color:'#d2a286',accent:'#6dabb3',tex:'pavement',sky:'coast'}}).data;
 await writeFile('tools/coastal-town-assets/gameplay-baseline.json',JSON.stringify({sourceCommit:commit,main:gameplay(COASTAL_STREET_RUN_LEVEL),bonus:gameplay(bonus)})+'\n');
 console.log('Saved pre-art gameplay from',commit);
}finally{await server.close();await unlink(fixture);}
