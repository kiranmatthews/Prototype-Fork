// Publish only these source-owned entries; preserve every unrelated pack entry.
import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const {PUZZLE_LEVELS}=await server.ssrLoadModule('/src/levels/puzzle-trilogy.ts');
await server.close();
const file=new URL('../public/levels.json',import.meta.url),pack=JSON.parse(await readFile(file,'utf8'));
const ids=new Set(PUZZLE_LEVELS.map(e=>e.id));
pack.levels=[...pack.levels.filter(e=>!ids.has(e.id)),...PUZZLE_LEVELS];
await writeFile(file,JSON.stringify(pack)+'\n');
console.log(JSON.stringify(PUZZLE_LEVELS.map(({id,data})=>({id,components:data.components.length,
  breakableCrates:data.components.filter(c=>c.t==='crate'&&!['metal','metalbounce','bang','nitrobang'].includes(c.kind)).length,
  checkpoints:data.components.filter(c=>c.t==='checkpoint').length,
  enemies:data.components.filter(c=>c.t==='enemy').length}))));
