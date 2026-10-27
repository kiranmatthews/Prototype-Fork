import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
import {createHash} from 'node:crypto';

const output=process.env.SPAGHETTI_OUTPUT??'docs/spaghetti-rails/evidence/survey';
await mkdir(output,{recursive:true});
const built=await build({entryPoints:['src/levels/spaghetti-rails.ts'],bundle:true,write:false,format:'esm',platform:'node'});
const source=await import(`data:text/javascript;base64,${Buffer.from(built.outputFiles[0].text).toString('base64')}`);
const {SPAGHETTI_RAILS_LEVEL:level,SPAGHETTI_RUNS:runs,SPAGHETTI_DOCKS:docks,spaghettiRail,spaghettiSamples}=source;
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const rails=runs.flatMap((run,runIndex)=>run.lanes.map(offset=>{
 const component=spaghettiRail(run,offset),points=spaghettiSamples(component),arc=[0];
 for(let i=1;i<points.length;i++)arc.push(arc[i-1]+distance(points[i],points[i-1]));
 let maxTurn=0;
 for(let i=1;i<points.length-1;i++){
  const a=points[i].map((v,k)=>v-points[i-1][k]),b=points[i+1].map((v,k)=>v-points[i][k]);
  const dot=a.reduce((sum,v,k)=>sum+v*b[k],0)/(Math.hypot(...a)*Math.hypot(...b));
  maxTurn=Math.max(maxTurn,Math.acos(Math.max(-1,Math.min(1,dot)))*180/Math.PI);
 }
 return {name:component.nm,run:runIndex,stage:run.stage,offset,component,points,arc,
  length:arc.at(-1),maxTurn,climb:Math.max(...points.map(p=>p[1]))-points[0][1]};
}));
const cross=(a,b,c,d)=>{
 const x=b[0]-a[0],z=b[2]-a[2],u=d[0]-c[0],v=d[2]-c[2],den=x*v-z*u;
 if(Math.abs(den)<1e-8)return null;
 const dx=c[0]-a[0],dz=c[2]-a[2],t=(dx*v-dz*u)/den,s=(dx*z-dz*x)/den;
 if(t<0||t>1||s<0||s>1)return null;
 return {p:[a[0]+t*x,a[2]+t*z],clearance:Math.abs(a[1]+t*(b[1]-a[1])-c[1]-s*(d[1]-c[1]))};
};
const crossings=[];
for(let i=0;i<rails.length;i++)for(let j=i;j<rails.length;j++){
 const a=rails[i],b=rails[j];
 for(let m=1;m<a.points.length;m++)for(let n=j===i?m+2:1;n<b.points.length;n++){
  if(i===j&&b.arc[n]-a.arc[m]<20)continue;
  const hit=cross(a.points[m-1],a.points[m],b.points[n-1],b.points[n]);
  if(hit)crossings.push({rails:[i,j],names:[a.name,b.name],...hit});
 }
}
crossings.sort((a,b)=>a.clearance-b.clearance);
const transfers=[];
for(let i=1;i<runs.length;i++)if(runs[i].jumpEntry){
 const before=rails.find(r=>r.run===i-1&&r.offset===0),after=rails.find(r=>r.run===i&&r.offset===0);
 const end=before.points.at(-1),start=after.points[0],out=before.points.at(-2),forward=end.map((v,k)=>v-out[k]);
 const h=Math.hypot(forward[0],forward[2]);forward[0]/=h;forward[2]/=h;
 transfers.push({from:before.name,to:after.name,gap:distance(end,start),height:start[1]-end[1],
  lateral:Math.abs((start[0]-end[0])*-forward[2]+(start[2]-end[2])*forward[0])});
}
// Visual dressing must not silently move the race that was playtested.
const visualKeys=new Set(['color','emissive','tex','nm','grp','artProxy']);
const gameplay={spawn:level.spawn,killY:level.killY,fallRecoveryDrop:level.fallRecoveryDrop,perfectGrindBoost:level.perfectGrindBoost,
 cameraAirLift:level.cameraAirLift,cameraLookAhead:level.cameraLookAhead,cameraRig:level.cameraRig,skateRace:level.skateRace,
 components:level.components.filter(c=>c.solid!==false&&c.scenerySolid!==false&&c.t!=='torch')
  .map(c=>Object.fromEntries(Object.entries(c).filter(([key])=>!visualKeys.has(key))))};
const gameplayFingerprint=createHash('sha256').update(JSON.stringify(gameplay)).digest('hex');
const guide=level.skateRace.line,guideArc=[0];
for(let i=1;i<guide.length;i++)guideArc.push(guideArc[i-1]+distance(guide[i].slice(0,3),guide[i-1].slice(0,3)));
const project=point=>{
 let best={distance:Infinity,s:0};
 for(let i=1;i<guide.length;i++){
  const a=guide[i-1],b=guide[i],delta=b.slice(0,3).map((v,k)=>v-a[k]),length=Math.hypot(...delta);
  const t=Math.max(0,Math.min(1,delta.reduce((n,v,k)=>n+v*(point[k]-a[k]),0)/(length*length)));
  const d=distance(point,a.slice(0,3).map((v,k)=>v+delta[k]*t));
  if(d<best.distance)best={distance:d,s:guideArc[i-1]+length*t};
 }
 return best.s;
};
const retries=[{name:'Starting grid',s:0},...level.components.filter(c=>c.t==='checkpoint').map(c=>({name:c.nm,s:project(c.p)})),{name:'Finish',s:guideArc.at(-1)}].sort((a,b)=>a.s-b.s);
const retryLegs=retries.slice(1).map((retry,i)=>({from:retries[i].name,to:retry.name,metres:retry.s-retries[i].s}));
const report={at:new Date().toISOString(),gameplayFingerprint,length:level.skateRace.originalLength,rails:rails.length,maxTurn:Math.max(...rails.map(r=>r.maxTurn)),
 retryLegs,maxRetryLeg:Math.max(...retryLegs.map(leg=>leg.metres)),medalTimes:level.medalTimes,
 transfers,lowest:Math.min(...rails.flatMap(r=>r.points.map(p=>p[1]))),highest:Math.max(...rails.flatMap(r=>r.points.map(p=>p[1]))),
 crossings,sections:rails.filter(r=>r.offset===0).map(({name,length,climb})=>({name,length,climb}))};
await writeFile(output+'/geometry.json',JSON.stringify(report,null,2));
await writeFile(output+'/source.json',JSON.stringify({level,rails,docks}));

// A measurement drawing, kept separate from the game's final artwork.
const palette=['#67717c','#8e7693','#7479a0','#997b70','#668e96','#7c9068'];
const map=(p)=>[360+p[0]*1.6,90-p[2]*1.05];
const path=points=>points.map((p,i)=>`${i?'L':'M'}${map(p).map(n=>n.toFixed(2)).join(',')}`).join(' ');
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1580" viewBox="-180 0 960 1580">
<rect x="-180" width="960" height="1580" fill="#f3f4f6"/>
<g font-family="Arial,sans-serif" fill="#262c35"><text x="-130" y="37" font-size="26">SPAGHETTI RAILS · GREYBOX SURVEY</text>
<text x="-130" y="61" font-size="14">${rails.length} native node rails · ${transfers.length} air transfers · ${(report.length/1000).toFixed(2)} km</text></g>
${docks.map(d=>{const [x,y]=map(d.p);return `<rect x="${x-d.width*.8}" y="${y-d.depth*.525}" width="${d.width*1.6}" height="${d.depth*1.05}" fill="#c6cbd0" stroke="#7f8994"/>`;}).join('')}
${rails.map(r=>`<path d="${path(r.points)}" fill="none" stroke="${palette[r.stage]}" stroke-width="${r.offset===0?2:1}"/>`).join('')}
${runs.map((run,i)=>{const p=rails.find(r=>r.run===i&&r.offset===0).points[0],[x,y]=map(p);return `<circle cx="${x}" cy="${y}" r="3" fill="#222b38"/><text x="${x+5}" y="${y-5}" font-family="Arial,sans-serif" font-size="11" fill="#222b38">${i+1}</text>`;}).join('')}
<g font-family="Arial,sans-serif" font-size="13" fill="#333c48">${report.sections.map((r,i)=>`<text x="430" y="${115+i*37}">${i+1}. ${escape(r.name.replace(/^\d+ \/ /,''))}</text><text x="447" y="${131+i*37}" font-size="11">${r.length.toFixed(0)} m · climb ${r.climb.toFixed(1)} m</text>`).join('')}</g>
<text x="430" y="${150+report.sections.length*37}" font-family="Arial,sans-serif" font-size="12">Height range ${report.lowest.toFixed(1)}–${report.highest.toFixed(1)} m</text>
</svg>`;
await writeFile(output+'/plan.svg',svg);
assert.equal(transfers.length,level.skateRace.jumps.length);
assert.ok(rails.every(r=>r.component.pts.every(p=>p.length===4)),'All paths retain editable radius and height nodes');
assert.ok(report.lowest>level.killY);
assert.ok(report.maxTurn<45,'Every strand stays below the native 50-degree sharp-corner exit, with margin');
assert.ok(crossings.every(c=>c.clearance>=6),'Stacked rail crossings preserve at least six metres of clearance');
assert.ok(report.maxRetryLeg<600,'No retry loses more than a six-hundred-metre section');
console.log(JSON.stringify({gameplayFingerprint,length:report.length,rails:rails.length,transfers:transfers.length,maxTurn:report.maxTurn,height:[report.lowest,report.highest],crossings:crossings.length,minClearance:crossings[0]?.clearance,maxRetryLeg:report.maxRetryLeg}));
