import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const fixture=await readFile(new URL('./test-crouch-jump-slam.mjs',import.meta.url),'utf8');
const dom=fixture.slice(fixture.indexOf('function installHeadlessDom()'),fixture.indexOf('\nconst held'));new Function('noop',dom+'\ninstallHeadlessDom();')(()=>{});
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{
 const {JUNGLE_TERRACES_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-sequels.ts');
 const {BONUS_LEVEL_ENTRIES}=await server.ssrLoadModule('/src/levels/themed-bonuses.ts');
 const {normalizeCustomLevelData}=await server.ssrLoadModule('/src/level.ts');if(!normalizeCustomLevelData(data))throw Error('Invalid temple');
 const pack=JSON.parse(await readFile('public/levels.json','utf8'));
 pack.levels=pack.levels.filter(e=>!['jungle-skyline','bonus-jungle-skyline'].includes(e.id));
 for(const entry of [{id:'jungle-terraces',name:data.name,data},BONUS_LEVEL_ENTRIES.find(e=>e.id==='bonus-jungle-terraces')]){
  const i=pack.levels.findIndex(e=>e.id===entry.id);if(i<0)pack.levels.push(entry);else pack.levels[i]=entry;
 }
 await writeFile('public/levels.json',JSON.stringify(pack));console.log('Synced Temple of Embers and its single bonus',data.components.length);
}finally{await server.close();}
