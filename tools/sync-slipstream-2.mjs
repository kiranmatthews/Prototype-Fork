import {createServer} from 'vite';
import {readFile,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {SLIPSTREAM_2_LEVEL:data}=await server.ssrLoadModule('/src/levels/slipstream-2.ts');
  const {CAMPAIGN_LEVELS}=await server.ssrLoadModule('/src/campaign.ts');
  const path=new URL('../public/levels.json',import.meta.url),pack=JSON.parse(await readFile(path,'utf8'));
  pack.levels=[...pack.levels.filter(l=>l.id!=='slipstream-2'),{id:'slipstream-2',name:data.name,data}];
  // Published map gets the appended hub, preserving all existing coordinates.
  const defaults=CAMPAIGN_LEVELS.map(({mapPosition:[x,y,z]})=>[x,z,0,y]);
  for(const level of pack.levels)for(const c of level.data.components)if(c.t==='worldmap'&&c.pts&&c.pts.length<defaults.length)
    c.pts.push(...defaults.slice(c.pts.length));
  await writeFile(path,JSON.stringify(pack)+'\n');
  console.log(`Synced Slipstream 2: ${data.components.length} components`);
}finally{await server.close();}
