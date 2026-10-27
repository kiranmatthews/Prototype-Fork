// A worktree-specific cache prevents other local/native Vite checks from
// invalidating this preview's optimized dependency URLs while it is open.
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';

const root=fileURLToPath(new URL('../',import.meta.url));
const key=createHash('sha256').update(root).digest('hex').slice(0,16);
const server=await createServer({root,cacheDir:join(tmpdir(),`motu-preview-${key}`),clearScreen:false,
  server:{host:'127.0.0.1',port:5518,strictPort:true}});
await server.listen();server.printUrls();
console.log('Motu review: http://127.0.0.1:5518/tools/motu-beach-review.html?playtest&level=jungle-cup');
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{await server.close();process.exit(0);});
