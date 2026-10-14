import {createServer} from 'vite';import {writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try{const m=await server.ssrLoadModule('/src/levels/pirate-wreck.ts');const main=[[-48,-3,74],...m.PIRATE_ROUTE.slice(0,5)];const paths=[];
for(let i=1;i<main.length;i++)paths.push({a:main[i-1],b:main[i],width:13,height:13});
for(let i=1;i<m.PIRATE_GROTTO_ROUTE.length;i++)paths.push({a:m.PIRATE_GROTTO_ROUTE[i-1],b:m.PIRATE_GROTTO_ROUTE[i],width:9,height:12});
paths.push({a:[-58,-4,-40],b:[-58,-4,-54],width:16,height:15});
await writeFile(new URL('./mine-source.json',import.meta.url),JSON.stringify({source:'src/levels/pirate-wreck.ts',paths,cameraPocket:{position:[-60,-1,-61],radius:6},bounds:{nearZ:77,farZ:-63}},null,2)+'\n');console.log(JSON.stringify({mineSegments:paths.length}));}finally{await server.close();}
