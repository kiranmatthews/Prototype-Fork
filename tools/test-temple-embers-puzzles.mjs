import {writeFile} from 'node:fs/promises';
import {withTempleRuntime} from './temple-test-runtime.mjs';
import {puzzleControls} from './puzzle-controls.mjs';
import {runLanternStair} from './temple-embers-pilot.mjs';

await withTempleRuntime(async r=>{
 r.report={stage:'stair approach',actions:[],evidence:[]};
 const c=puzzleControls(r);
 const gen=runLanternStair(r,c);let next=gen.next();
 try{while(!next.done){r.tick(next.value);next=gen.next();}console.log(JSON.stringify(next.value));}
 catch(error){r.report.error=String(error);throw error;}
 finally{await writeFile('/private/tmp/temple-embers-stair.json',JSON.stringify({result:next.value,report:r.report,trace:r.trace},null,2));}
},{modulePath:'/src/levels/jungle-sequels.ts',levelId:'jungle-terraces',start:[506,34.62,8],maxFrames:9000});
