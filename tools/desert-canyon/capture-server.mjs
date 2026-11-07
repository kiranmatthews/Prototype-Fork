// Optional local review sink. One PNG, one fixed task-owned destination,
// loopback only; no URLs, filenames or filesystem paths accepted from clients.
import http from 'node:http';
import {mkdir,writeFile} from 'node:fs/promises';
const names={dustyGem:'dusty-road/yellow-gem.png',dustyBonus:'dusty-road/cactus-cache.png',dustyEntrance:'dusty-road/bonus-entrance.png',cartoon:'cartoon/final-descent.png',cartoonStart:'cartoon/boardwalk.png',cartoonUpper:'cartoon/hoodoo-garden.png',cartoonGem:'cartoon/yellow-gem.png',tripo:'tripo-cactus-overlook.png',tripoStart:'tripo-cactus-opening.png',tripoFinish:'tripo-cactus-finish.png',cactus:'cactus-overlook.png',cactusStart:'cactus-opening.png',cactusFinish:'cactus-finish.png',pass1:'transformation-gameplay-v1.png',pass2:'transformation-gameplay-v2.png',pass3:'transformation-gameplay-v3.png',valley2:'transformation-valley.png',shoulder:'traversable-shoulder.png',vista:'vista-native-gameplay.png',basin:'vista-basin.png',finish:'vista-finish.png',overview:'native-overview.png',start:'boardwalk-start.png',valley:'valley-extension.png',chute:'revised-rock-chute.png',creek:'revised-creek.png',opening:'revised-boardwalk.png'};
names.yellowCrystal='dusty-road/yellow-crystal-material.png';
names.gemMenus='dusty-road/coloured-gem-menus.png';
names.gemStats='dusty-road/coloured-gem-stats.png';
names.gemBoard='dusty-road/coloured-gem-board.png';
names.heat='dusty-road/heat-mirage.png';
names.heatBonus='dusty-road/heat-mirage-bonus.png';
names.geometryNarrows='geometry/sunlit-narrows.png';
names.geometryApproach='geometry/valley-approach.png';
names.geometryVista='geometry/native-vista.png';
names.geometrySun='geometry/aligned-sun.png';
const name=names[process.argv[2]??'overview'];
if(!name)throw new Error('Choose overview, start, valley, chute, creek or opening');
const target=new URL('../../docs/desert-canyon/'+name,import.meta.url);
const server=http.createServer(async(req,res)=>{
  if(!['http://127.0.0.1:5188','http://127.0.0.1:5190','http://localhost:5190'].includes(req.headers.origin)||req.url!=='/frame'){res.writeHead(403).end();return;}
  res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
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
