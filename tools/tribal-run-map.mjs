import {build} from 'esbuild';
import {writeFile,mkdir} from 'node:fs/promises';
const out=process.env.TRIBAL_OUTPUT||'docs/tribal-run/greybox/evidence';await mkdir(out,{recursive:true});
const {outputFiles}=await build({entryPoints:['src/levels/tribal-run.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const m=await import('data:text/javascript;base64,'+Buffer.from(outputFiles[0].text).toString('base64'));
const points=Array.from({length:1161},(_,i)=>m.tribalPoint(i*2));
const xs=points.map(p=>p[0]),zs=points.map(p=>p[2]),minX=Math.min(...xs)-60,maxX=Math.max(...xs)+60,minZ=Math.min(...zs)-60,maxZ=Math.max(...zs)+60;
const view=[minX,minZ,maxX-minX,maxZ-minZ];
const palette=['#7a858d','#607987','#8c8a78','#8b777f','#6e8581','#a18f78','#8d889f','#9b7770'];
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const path=(a,b,u=0)=>{const n=Math.ceil((b-a)/2);return Array.from({length:n+1},(_,i)=>m.tribalPoint(a+(b-a)*i/n,0,typeof u==='function'?u(a+(b-a)*i/n):u)).map(p=>p[0]+','+p[2]).join(' ');};
let body=`<rect x="${view[0]}" y="${view[1]}" width="${view[2]}" height="${view[3]}" fill="#edf1f2"/>`;
for(const r of m.TRIBAL_RUN_ROADS){const s=m.TRIBAL_RUN_SECTIONS.findIndex(q=>r.a>=q.a&&r.a<q.b);body+=`<polyline points="${path(r.a,r.b,r.offset)}" fill="none" stroke="${palette[Math.max(0,s)]}" stroke-width="${typeof r.width==='number'?r.width:12}"><title>${esc(r.name)}</title></polyline>`;}
for(const s of m.TRIBAL_RUN_SECTIONS){const p=m.tribalPoint(s.a);body+=`<circle cx="${p[0]}" cy="${p[2]}" r="6" fill="#fff" stroke="#273b49" stroke-width="2"/><text x="${p[0]+12}" y="${p[2]+4}" fill="#273b49" font-size="11" font-family="sans-serif">${esc(s.name)}</text>`;}
for(const cp of m.TRIBAL_RUN_CHECKPOINTS){const p=m.tribalPoint(cp.s,0,cp.u);body+=`<circle cx="${p[0]}" cy="${p[2]}" r="4" fill="#f3d36b" stroke="#6c5e33"/>`;}
for(const s of m.TRIBAL_RUN_GAPS){const p=m.tribalPoint((s.a+s.b)/2,0,s.u);body+=`<circle cx="${p[0]}" cy="${p[2]}" r="6" fill="none" stroke="#c44e51" stroke-width="2"/>`;}
await writeFile(`${out}/route-plan.svg`,`<svg xmlns="http://www.w3.org/2000/svg" width="760" height="1500" viewBox="${view.join(' ')}">${body}</svg>`);
const metrics={length:m.TRIBAL_RUN_LENGTH,footprint:[maxX-minX-120,maxZ-minZ-120],sections:m.TRIBAL_RUN_SECTIONS,checkpoints:m.TRIBAL_RUN_CHECKPOINTS,gaps:m.TRIBAL_RUN_GAPS,components:m.TRIBAL_RUN_LEVEL.components.length,
 geometryVertices:m.TRIBAL_RUN_LEVEL.components.reduce((n,c)=>n+(c.vertices?.length??0)/3,0),countedCrates:m.TRIBAL_RUN_LEVEL.components.filter(c=>c.t==='crate'&&!['metal','metalbounce','bang','nitrobang'].includes(c.kind)).length};
await writeFile(`${out}/route-metrics.json`,JSON.stringify(metrics,null,2));console.log(JSON.stringify(metrics));
