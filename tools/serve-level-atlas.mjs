// Local-only capture receiver; no write endpoint is included in the build.
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const output=new URL('../public/provenance/level-atlas/art/',import.meta.url);
await mkdir(output,{recursive:true});
const server=await createServer({root:fileURLToPath(new URL('../',import.meta.url)),configFile:false,appType:'mpa',optimizeDeps:{noDiscovery:true,include:[]},server:{host:'127.0.0.1',port:5341,strictPort:true,hmr:false},plugins:[{
 name:'atlas-local-capture',configureServer(server){server.middlewares.use('/__atlas/save',async(req,res)=>{
  if(req.method!=='POST'){res.statusCode=405;res.end();return;}
  try{const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>32e6)throw new Error('Capture too large');chunks.push(chunk);}
   const {name,data}=JSON.parse(Buffer.concat(chunks));if(!/^[a-z0-9-]+\.(webp|json)$/.test(name))throw new Error('Invalid artifact name');
   await writeFile(new URL(name,output),name.endsWith('.webp')?Buffer.from(data.split(',')[1],'base64'):JSON.stringify(data,null,2));
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify({saved:name}));
  }catch(error){res.statusCode=400;res.end(String(error));}
 });}
}]});
await server.listen();console.log('Atlas renderer: http://127.0.0.1:5341/tools/level-atlas-render.html');
