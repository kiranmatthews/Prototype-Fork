// Optional local review sink. One PNG, one fixed task-owned destination,
// loopback only; no URLs, filenames or filesystem paths accepted from clients.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const names={overview:'native-overview.png',start:'boardwalk-start.png',valley:'valley-extension.png',chute:'revised-rock-chute.png',creek:'revised-creek.png',opening:'revised-boardwalk.png'};
const name=names[process.argv[2]??'overview'];
if(!name)throw new Error('Choose overview, start, valley, chute, creek or opening');
const target=new URL('../../docs/desert-canyon/'+name,import.meta.url);
const server=http.createServer(async(req,res)=>{
  if(req.headers.origin!=='http://127.0.0.1:5188'||req.url!=='/frame'){res.writeHead(403).end();return;}
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:5188');
  if(req.method==='OPTIONS'){res.setHeader('Access-Control-Allow-Methods','POST');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.writeHead(204).end();return;}
  if(req.method!=='POST'||req.headers['content-type']!=='image/png'){res.writeHead(415).end();return;}
  let size=0;const chunks=[];
  for await(const chunk of req){size+=chunk.length;if(size>12*1024*1024){res.writeHead(413).end();return;}chunks.push(chunk);}
  const bytes=Buffer.concat(chunks);
  if(!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))){res.writeHead(415).end();return;}
  await mkdir(new URL('.',target),{recursive:true});await writeFile(target,bytes);
  res.writeHead(200,{'Content-Type':'text/plain'}).end('Saved '+name);
  console.log(target.pathname);server.close();
});
server.listen(51988,'127.0.0.1',()=>console.log('One-frame review sink listening on 127.0.0.1:51988'));
