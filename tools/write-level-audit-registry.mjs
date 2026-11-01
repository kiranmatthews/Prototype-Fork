import {createServer} from 'vite';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';
const out=process.env.LEVEL_AUDIT_OUTPUT||'/private/tmp/level-preservation-audit';
await mkdir(out,{recursive:true});
const storage=new Map();
globalThis.window={location:{search:'?lite'},addEventListener(){}};
globalThis.localStorage={getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)};
const server=await createServer({configFile:false,appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false,watch:null}});
try{
 const api=await server.ssrLoadModule('/src/level.ts');
 const {edgeGrindingFingerprint:fp}=await server.ssrLoadModule('/src/edgeGrindingMigration.ts');
 const pack=JSON.parse(await readFile('public/levels.json','utf8'));
 if(!api.setUserLevels(pack.levels))throw Error('Invalid current published pack');
 const entries=api.levelList().map(e=>({id:e.id,name:e.name,source:e.data?fp(e.data):null,built:e.data?fp(api.migrateCustomLevel(structuredClone(e.data))):null,bonus:e.data?.hudMode==='bonus',components:e.data?.components.length??null}));
 await mkdir(resolve(out,'current-data'),{recursive:true});
 for(const e of api.levelList())if(e.data)await writeFile(resolve(out,'current-data',e.id+'.json.gz'),gzipSync(JSON.stringify({source:e.data,built:api.migrateCustomLevel(structuredClone(e.data))})));
 await writeFile(resolve(out,'current-registry.json'),JSON.stringify(entries,null,2)+'\n');
 console.log({entries:entries.length,bonuses:entries.filter(e=>e.bonus).length});
}finally{await server.close();}
