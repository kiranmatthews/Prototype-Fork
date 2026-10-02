// Exact source-coordinate side elevations; regenerate after changing a room.
import {createServer} from 'vite';
import {mkdir,writeFile} from 'node:fs/promises';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
const {PUZZLE_LEVELS}=await server.ssrLoadModule('/src/levels/puzzle-trilogy.ts');
await server.close();
const out=new URL('../docs/puzzle-maps/',import.meta.url);await mkdir(out,{recursive:true});
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const colors={wood:'#ce9a5d',bouncy:'#eeae54',metalbounce:'#bdcbd5',metal:'#8a9bab',multihit:'#81bbe1',
  life:'#dd93bc',mask:'#9ecc91',mystery:'#d9b286',tnt:'#e76855',nitro:'#99d24e',bang:'#e5c56d',nitrobang:'#99d24e'};
const labels={wood:'W',bouncy:'↑',metalbounce:'↑M',metal:'M',multihit:'5',life:'L',mask:'A',mystery:'?',tnt:'T',nitro:'N',bang:'!',nitrobang:'!N'};
for(const entry of PUZZLE_LEVELS){
 const data=entry.data;
 const views=[['overview',-8,data.components.find(c=>c.t==='gate').p[0]+5],
  ...(entry.id==='crate-primer'?[['key-room',55,102]]:entry.id==='switchyard'?[['upper-first',-1,11],['return-room',130,171]]:[['fuse-room',39,60],['double-return',191,234]])];
 for(const [name,min,max] of views){
  const k=name==='overview'?13:Math.min(65,1100/(max-min)),w=Math.max(480,(max-min)*k+90),h=500;
  const x=v=>50+(v-min)*k,y=v=>h-80-v*25;
  const rect=(cx,cy,sx,sy,fill,extra='')=>`<rect x="${x(cx-sx/2)}" y="${y(cy+sy/2)}" width="${sx*k}" height="${sy*25}" fill="${fill}" ${extra}/>`;
  const text=(cx,cy,t,extra='')=>`<text x="${x(cx)}" y="${y(cy)}" ${extra}>${esc(t)}</text>`;
  let body=`<rect width="100%" height="100%" fill="#172332"/><text x="24" y="30" font-size="20" fill="#fff">${esc(entry.name)} · ${esc(name)} · exact source side elevation</text>`;
  for(let v=0;v<=12;v+=2)body+=`<path d="M40 ${y(v)}H${w-20}" stroke="#324354"/>`+text(min-.5,v,`${v}m`,'fill="#a2b4c6" font-size="10" text-anchor="end"');
  for(let v=Math.ceil(min/5)*5;v<=max;v+=5)body+=`<path d="M${x(v)} 56V${h-64}" stroke="#293849"/>`+text(v,-1,`${v}`,'fill="#a2b4c6" font-size="10" text-anchor="middle"');
  for(const c of data.components){
   if(c.grp===5||c.p[0]<min-15||c.p[0]>max+15)continue;
   const [cx,cy]=c.p;
   if(c.t==='platform')body+=rect(cx,cy,c.s[0],c.s[1],'#54717c','stroke="#8aabb4"');
   if(c.t==='mesh'&&c.outline)body+=rect(cx,cy,c.s[0],c.s[1],'none','stroke="#e8c66f" stroke-width="2" stroke-dasharray="5 4"');
   if(['mover','crumble','phasepad'].includes(c.t)){
    body+=rect(cx,cy-.3,c.s[0],.6,c.t==='mover'?'#997858':'#8e729b','stroke="#dcbf8e"');
    body+=text(cx,cy-.9,c.t,'font-size="10" fill="#e5d6b6" text-anchor="middle"');
   }
   if(cx<min||cx>max)continue;
   if(c.t==='crate'){
    const outline=[10,11,12].includes(c.grp)&&!['bang','nitrobang'].includes(c.kind);
    body+=rect(cx,cy+.48,.96,.96,outline?'none':colors[c.kind],`stroke="${outline?'#e8c66f':'#172332'}" ${outline?'stroke-dasharray="3 2"':''}`);
    body+=text(cx,cy+.26,labels[c.kind],`font-size="${name==='overview'?9:12}" font-weight="700" fill="${outline?'#e8c66f':'#172332'}" text-anchor="middle"`);
    body+=`<title>${esc(`${c.kind} x=${cx}, bottomY=${cy}: ${c.nm}`)}</title>`;
   }
   if(c.t==='enemy')body+=`<circle cx="${x(cx)}" cy="${y(cy+.6)}" r="7" fill="#dd8b91"/>`+text(cx,cy+1.3,c.foe,'font-size="10" fill="#efb9bd" text-anchor="middle"');
   if(c.t==='checkpoint')body+=text(cx,cy+1.7,'CP','font-size="13" font-weight="700" fill="#9cd5ed" text-anchor="middle"');
   if(c.t==='gate')body+=text(cx,cy+2,'EXIT','font-size="15" font-weight="700" fill="#b19bf2" text-anchor="middle"');
  }
  body+=`<text x="24" y="${h-18}" fill="#d6dee6" font-size="12">W wood · 5 multi-hit · ↑ wooden arrow · M metal · T TNT · N Nitro · ! local outline circuit · !N global Nitro clear · dashed = starts absent</text>`;
  await writeFile(new URL(`${entry.id}-${name}.svg`,out),`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><g font-family="Arial,sans-serif">${body}</g></svg>\n`);
 }
}
console.log('Rendered exact source overview and dependency-room maps for all three levels.');
