// Author the zero in flat Roo geometry before any material or lighting pass.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const source=JSON.parse(await fs.readFile(new URL('public/fonts/roo-bevel-source-v1.json',root),'utf8'));
const original=source.glyphs['0'],glyph=structuredClone(original);
const index=glyph.commands.findIndex(c=>c.type==='Q'&&c.x===.2261905&&c.y===.4818594);
assert.ok(index>0);
function split(start,command,t){
  const mix=(a,b)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
  const a=mix(start,{x:command.x1,y:command.y1}),b=mix({x:command.x1,y:command.y1},command),p=mix(a,b);
  return [{type:'Q',x1:a.x,y1:a.y,...p},{type:'Q',x1:b.x,y1:b.y,x:command.x,y:command.y}];
}
const lower=split(glyph.commands[index-1],glyph.commands[index],.5);
const upper=split(glyph.commands[index],glyph.commands[index+1],.4);
// Replace part of the counter boundary with one broad rising stroke. It is
// part of the hole contour, not an overlapping path or a later painted patch.
glyph.commands.splice(index,2,
  lower[0],
  {type:'C',x1:.274,y1:.452,x2:.352,y2:.530,x:.426,y:.605},
  {type:'C',x1:.360,y1:.630,x2:.278,y2:.602,x:upper[0].x,y:upper[0].y},
  upper[1],
);
const folder=new URL('art/roo-reference-match/zero-v5/',root);await fs.mkdir(folder,{recursive:true});
await fs.writeFile(new URL('zero-outline.json',folder),JSON.stringify(glyph,null,2)+'\n');
function path(commands){return commands.map(c=>c.type==='Z'?'Z':c.type==='Q'?`Q${c.x1} ${c.y1} ${c.x} ${c.y}`:c.type==='C'?`C${c.x1} ${c.y1} ${c.x2} ${c.y2} ${c.x} ${c.y}`:`${c.type}${c.x} ${c.y}`).join(' ');}
function svg(g){
  const b=g.bounds,scale=1024/(b[3]-b[1]),x=512-(b[0]+b[2])/2*scale,y=128+b[3]*scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" viewBox="0 0 1024 1280"><rect width="1024" height="1280" fill="white"/><path d="${path(g.commands)}" transform="translate(${x} ${y}) scale(${scale} ${-scale})" fill="black"/></svg>\n`;
}
await fs.writeFile(new URL('zero-flat.svg',folder),svg(glyph));
await fs.writeFile(new URL('zero-original.svg',folder),svg(original));
console.log(JSON.stringify({output:folder.pathname,root:[lower[0],upper[0]],tip:{x:.426,y:.605},metricsUnchanged:true}));
