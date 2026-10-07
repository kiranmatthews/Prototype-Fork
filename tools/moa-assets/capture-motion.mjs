// Capture the original control rig before replacing only its visible surfaces.
import {readFile,writeFile} from 'node:fs/promises';
import {runInThisContext} from 'node:vm';
import {createServer} from 'vite';
import {createHash} from 'node:crypto';
const harness=await readFile(new URL('../validate-editor-roundtrip.mjs',import.meta.url),'utf8');
runInThisContext(harness.slice(harness.indexOf('function installHeadlessDom()'),harness.indexOf('\nfunction round('))+'\ninstallHeadlessDom();');
const server=await createServer({logLevel:'silent',appType:'custom',server:{middlewareMode:true}});
try{
 const {createMoaVisual}=await server.ssrLoadModule('/src/enemies/moa.ts'),v=createMoaVisual();
 const {moaPoseBindings}=await server.ssrLoadModule('/src/enemies/moaPoseBindings.ts');
 const bindings=Object.fromEntries(Object.entries(moaPoseBindings(v.body)()).map(([key,m])=>[key,m.toArray()]));
 await writeFile(new URL('./bind-frames.json',import.meta.url),JSON.stringify(bindings,null,2)+'\n');
 const names=['Moa_Torso','Moa_TorsoSurface','Moa_Rump','Moa_Head','Moa_Jaw','Moa_FootLeft','Moa_FootRight'];
 const nodes=names.map(name=>v.group.getObjectByName(name));
 const rest=nodes.map(n=>({name:n.name,matrix:n.matrixWorld.toArray()}));
 const cycles=[['patrol',180,1.45],['idle',36,0],['squawk',99,0],['windup',38,0],['peck',22,0],['recover',54,0]];
 const rows=[];let time=0;
 for(const [state,frames,speed]of cycles)for(let i=0;i<frames;i++){
  const frame={state,stateTime:i/60,time,speed,verticalVelocity:0,grounded:true,alive:true,flung:false};v.update(1/60,frame);time+=1/60;
  rows.push(nodes.map(n=>n.matrixWorld.toArray().map(x=>+x.toFixed(7))));
 }
 const result={source:'Original moa animation from commit 8b166cb',names,cycles,frames:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex'),rest};
 await writeFile(new URL('./original-motion.json',import.meta.url),JSON.stringify(result,null,2)+'\n');v.dispose();console.log(result.sha256,result.frames);
}finally{await server.close();}
