import {readFile,writeFile} from 'node:fs/promises';
import ts from 'typescript';
const root=new URL('../../',import.meta.url);
const transpile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const asURL=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const modules=asURL(transpile(await readFile(new URL('src/cityModules.ts',root),'utf8')));
const source=transpile(await readFile(new URL('src/levels/carlisle-coast.ts',root),'utf8')).replace("'../cityModules'",JSON.stringify(modules));
export const {CARLISLE_COAST_LEVEL,CARLISLE_EXCAVATIONS,CARLISLE_BLOCKS}=await import(asURL(source));
if(process.argv.includes('--write')){
 const file=new URL('public/levels.json',root),pack=JSON.parse(await readFile(file,'utf8'));
 const row=pack.levels.find(l=>l.id==='test');if(!row)throw new Error('Missing test level');
 row.name=CARLISLE_COAST_LEVEL.name;row.data=CARLISLE_COAST_LEVEL;
 await writeFile(file,JSON.stringify(pack)+'\n');
 console.log(`Synced Carlisle Coast: ${row.data.components.length} components, ${CARLISLE_EXCAVATIONS.length} excavations, ${CARLISLE_BLOCKS.length} street-front buildings.`);
}
