import {readFile,writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const root=new URL('../../',import.meta.url);
const server=await createServer({root:root.pathname,logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
let data;
try{data=await server.ssrLoadModule('/src/levels/carlisle-coast.ts');}finally{await server.close();}
export const {CARLISLE_COAST_LEVEL,CARLISLE_EXCAVATIONS,CARLISLE_BLOCKS}=data;
if(process.argv.includes('--write')){
 const file=new URL('public/levels.json',root),pack=JSON.parse(await readFile(file,'utf8'));
 const row=pack.levels.find(l=>l.id==='test');if(!row)throw new Error('Missing test level');
 row.name=CARLISLE_COAST_LEVEL.name;row.data=CARLISLE_COAST_LEVEL;
 await writeFile(file,JSON.stringify(pack)+'\n');
 console.log(`Synced Carlisle Coast: ${row.data.components.length} components, ${CARLISLE_EXCAVATIONS.length} excavations, ${CARLISLE_BLOCKS.length} street-front buildings.`);
}
