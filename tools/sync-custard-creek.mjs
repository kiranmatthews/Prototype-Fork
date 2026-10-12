import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
let data,bonus;
try{data=(await server.ssrLoadModule('/src/levels/custard-creek.ts')).CUSTARD_CREEK_LEVEL;
 bonus=(await server.ssrLoadModule('/src/levels/custard-bonus.ts')).CUSTARD_BONUS_LEVEL;}
finally{await server.close();}
const file=new URL('../public/levels.json',import.meta.url),pack=JSON.parse(await readFile(file,'utf8'));
const entry={id:'custard-creek',name:data.name,data};
const index=pack.levels.findIndex(l=>l.id===entry.id);
const bonusEntry={id:'bonus-custard-creek',name:bonus.name,data:bonus};
const bonusIndex=pack.levels.findIndex(l=>l.id===bonusEntry.id);
if(process.argv.includes('--write')){
  if(index<0)pack.levels.push(entry);else pack.levels[index]=entry;
  if(bonusIndex<0)pack.levels.push(bonusEntry);else pack.levels[bonusIndex]=bonusEntry;
  await writeFile(file,JSON.stringify(pack)+'\n');
  console.log(`Synced Custard Creek: ${data.components.length} components.`);
}else{
  if(index<0||JSON.stringify(pack.levels[index])!==JSON.stringify(entry))throw new Error('Custard Creek snapshot differs; run with --write');
  if(bonusIndex<0||JSON.stringify(pack.levels[bonusIndex])!==JSON.stringify(bonusEntry))throw new Error('Custard bonus snapshot differs; run with --write');
  console.log('Custard Creek source and published snapshot agree.');
}
