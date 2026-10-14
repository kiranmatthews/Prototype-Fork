// Local-only artifact receiver for browser-native PNGs; no browser control.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const directory='/private/tmp/boulder-camera-review/browser';await mkdir(directory,{recursive:true});
const allowed=new Set(['approach-0','approach-1','approach-2','impact-0','impact-1','impact-2','report']);
const saved=new Set();
const server=http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin!=='http://127.0.0.1:5198'){res.writeHead(403).end();return;}
 res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type');
 if(req.method==='OPTIONS'){res.writeHead(204).end();return;}
 if(req.method!=='POST'||req.url!=='/capture'){res.writeHead(404).end();return;}
 try{
  let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>16*1024*1024)throw Error('Capture too large');chunks.push(chunk);}
  const {name,png,report}=JSON.parse(Buffer.concat(chunks).toString());if(!allowed.has(name))throw Error('Unexpected capture');
  const path=directory+'/'+name+(name==='report'?'.json':'.png');
  if(name==='report')await writeFile(path,JSON.stringify(report,null,2)+'\n');
  else{if(typeof png!=='string'||!png.startsWith('data:image/png;base64,'))throw Error('Expected PNG');await writeFile(path,Buffer.from(png.slice(22),'base64'));}
  saved.add(name);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({path}));
  if(saved.size===allowed.size)server.close();
 }catch(error){res.writeHead(400).end(String(error.message));}
});
server.listen(5199,'127.0.0.1',()=>console.log('Review artifact receiver: http://127.0.0.1:5199/capture → '+directory));
