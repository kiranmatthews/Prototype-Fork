// Combine true orthographic game art with the registered editable map. Keep
// the engineering SVG beside it so either representation can be annotated.
import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const out=new URL('../public/provenance/level-atlas/',import.meta.url);
const inventory=JSON.parse(await readFile(new URL('inventory.json',out),'utf8'));
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const r=n=>Math.round(n*1000)/1000;
const cache=new Map();
async function uri(file){if(!cache.has(file))cache.set(file,'data:image/webp;base64,'+(await readFile(new URL(file,out))).toString('base64'));return cache.get(file);}
const text=(x,y,t,size=12,extra='')=>`<text x="${r(x)}" y="${r(y)}" font-family="Inter,Arial,sans-serif" font-size="${size}" fill="#173c33" ${extra}>${esc(t)}</text>`;
const labelStyle='paint-order="stroke" stroke="#fffdf5" stroke-width="3" stroke-linejoin="round"';
for(const row of inventory.levels){
 const stem=row.file.replace(/\.svg$/,''),manifest=JSON.parse(await readFile(new URL(row.manifest,out),'utf8'));
 const report=JSON.parse(await readFile(new URL(`art/${stem}.json`,out),'utf8'));
 if(report.snapshotId!==row.snapshotId)throw new Error(`Scenery is stale for ${row.name}`);
 if(report.assets.failed.length)throw new Error(`Art asset failed for ${row.name}: ${report.assets.failed.join(', ')}`);
 if(!report.icons)throw new Error(`Portrait capture missing for ${row.name}`);
 let base;
 try{base=await readFile(new URL(`${stem}.plan.svg`,out),'utf8');}catch{base=await readFile(new URL(row.file,out),'utf8');await writeFile(new URL(`${stem}.plan.svg`,out),base);}
 if(!base.includes(row.snapshotId))throw new Error(`Vector baseline is stale for ${row.name}; regenerate the clean plan before composing art.`);
 const p=row.projection,X=x=>r(p.offsetX+(x-p.minX)*8),Z=z=>r(p.offsetY+(z-p.minZ)*8);
 const baseWidth=(p.maxX-p.minX)*8+192,baseHeight=(p.maxZ-p.minZ)*8+328;
 const unique=[...new Map(report.icons.map(i=>[i.kind+':'+i.key,i])).values()];
 const height=Math.max(baseHeight,500+unique.length*70),width=baseWidth+320;
 let svg=base.replace(/width="[\d.]+" height="[\d.]+" viewBox="[^"]+"/,`width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`)
  .replace(/(<rect id="Paper" width=")[\d.]+(" height=")[\d.]+/,`$1${width}$2${height}`)
  .replace('CAMPAIGN ATLAS','VISUAL LEVEL ATLAS')
  .replace('Green → blue → violet = higher surfaces; labels show max Y. Dashed purple = motion. Camera line is not a walking route.','Actual game scenery + editable outlines. Portrait pins show enemies and crates; their dots mark exact positions.')
  .replace('CP checkpoint    ◆ crystal    ○ bonus entrance    ■ crates    × enemy    Blue = rails    Rust = blocking bounds','CP checkpoint    ◆ crystal    ○ bonus entrance    Blue = rails    Purple = motion    Surface labels = maximum Y')
  .replaceAll('fill-opacity=".89"','fill-opacity=".12"')
  .replace('<g id="09 Surface labels · hide to declutter">','<g id="09 Surface labels · hide to declutter" opacity=".65">')
  .replace('stroke-opacity=".65"','stroke-opacity=".3"');
 const art=['<g id="00a Actual game scenery · raster underlay · hide for geometry">'];
 for(const t of report.tiles)art.push(`<image id="${esc('Scenery · '+row.name+' · '+t.file)}" x="${t.x}" y="${t.y}" width="${t.width}" height="${t.height}" href="${await uri(t.file)}"/>`);
 art.push('</g>');svg=svg.replace('<g id="01 Coordinate grid',art.join('\n')+'\n<g id="01 Coordinate grid');
 // Raster art carries the recognizable scenery; unobtrusive vector rings
 // remain available for pointing at named scenery in the baseline snapshot.
 const snapshot=JSON.parse(gunzipSync(await readFile(new URL(row.snapshot,out))));
 const scenery=snapshot.components.flatMap((c,i)=>{
  if(c.t!=='decor'&&!(c.t==='mesh'&&c.solid===false))return [];
  return [{id:'D'+String(i+1).padStart(4,'0'),kind:'scenery',name:c.nm||c.dkind||'Scenery mesh',decorKind:c.dkind,point:c.p,bounds:{min:c.p,max:c.p},componentIndex:i,componentHash:createHash('sha256').update(JSON.stringify(c)).digest('hex'),authored:{t:c.t,p:c.p,nm:c.nm,grp:c.grp,yaw:c.yaw,s:c.s},referenceOnly:true}];
 });
 manifest.objects=manifest.objects.filter(o=>o.kind!=='scenery');manifest.objects.push(...scenery);manifest.sceneryPointCount=scenery.length;
 const objects=new Map(manifest.objects.map(o=>[o.id,o]));
 const iconById=new Map(report.icons.map(i=>[i.id,i]));
 const pins=['<g id="12 Recognizable enemy and crate pins · exaggerated icons, exact dots">'];
 for(const icon of report.icons.filter(i=>i.kind==='enemy')){
  const o=objects.get(icon.id),point=o?.point??icon.point;if(!point)continue;
  const px=X(point[0]),py=Z(point[2]),ix=px+16,iy=py-48;
  pins.push(`<g id="${esc(`${icon.id} | ${icon.name} | exact X ${point[0]} Z ${point[2]}`)}"><path d="M${px},${py}L${ix+18},${iy+18}" stroke="#bd3c39" stroke-width="1.5"/><circle cx="${px}" cy="${py}" r="3.2" fill="#bd3c39" stroke="#fff" stroke-width="1"/><circle cx="${ix+18}" cy="${iy+18}" r="20" fill="#fffdf5" stroke="#c1574b" stroke-width="1.3"/><image x="${ix}" y="${iy}" width="36" height="36" href="${await uri(icon.file)}"/>${text(ix+40,iy+12,icon.name,10,`font-weight="700" ${labelStyle}`)}${text(ix+40,iy+25,icon.id,9,labelStyle)}</g>`);
 }
 const clusters=[];
 for(const o of manifest.objects.filter(o=>o.kind==='crate')){
  const center=[(o.bounds.min[0]+o.bounds.max[0])/2,(o.bounds.min[2]+o.bounds.max[2])/2];
  const cluster=clusters.find(c=>Math.hypot(c.center[0]-center[0],c.center[1]-center[1])<2.4);
  if(cluster)cluster.items.push(o);else clusters.push({center,items:[o]});
 }
 for(const cluster of clusters){
  const types=[...new Set(cluster.items.map(o=>o.crateKind))];const chosen=cluster.items.find(o=>['nitro','tnt'].includes(o.crateKind))??cluster.items[0],icon=iconById.get(chosen.id);if(!icon)continue;
  const px=X(cluster.center[0]),py=Z(cluster.center[1]),ix=px+9,iy=py-24,ids=cluster.items.map(o=>o.id);
  pins.push(`<g id="${esc('Crate cluster | '+ids.join(', ')+' | '+types.join(', '))}"><path d="M${px},${py}L${ix+11},${iy+11}" stroke="#825c31" stroke-width=".9"/><circle cx="${px}" cy="${py}" r="2.2" fill="#805b2c" stroke="#fff" stroke-width=".7"/><rect x="${ix-1}" y="${iy-1}" width="24" height="24" rx="4" fill="#fffdf5" stroke="#997446" stroke-width=".8"/><image x="${ix}" y="${iy}" width="22" height="22" href="${await uri(icon.file)}"/>${text(ix+25,iy+10,cluster.items.length>1?'×'+cluster.items.length:chosen.id,8,`font-weight="700" ${labelStyle}`)}${types.length>1?text(ix+25,iy+20,'mixed',8,labelStyle):''}</g>`);
 }
 pins.push('</g>');
 // A level-specific visual key uses the same actual assets as the map.
 const lx=baseWidth+16,legend=[`<g id="13 Visual key · actual game asset portraits"><rect x="${baseWidth}" y="20" width="300" height="${height-40}" rx="12" fill="#e8eee1"/>`,text(lx+12,57,'WHAT’S HERE',19,'font-weight="700"'),text(lx+12,81,'Actual in-game models',12),text(lx+12,105,'Portraits enlarged for recognition.',11),text(lx+12,124,'Leader dots keep exact X / Z.',11),text(lx+12,157,'SCENERY',12,'font-weight="700"'),text(lx+12,177,'Trees, buildings, rocks and props',11),text(lx+12,194,'appear in the top-down game art.',11),text(lx+12,211,'Hide the art layer to see lower floors.',11)];
 let y=250;
 for(const icon of unique){const count=report.icons.filter(i=>i.kind===icon.kind&&i.key===icon.key).length;legend.push(`<rect x="${lx+8}" y="${y-6}" width="58" height="58" rx="8" fill="#f9fbf3"/><image x="${lx+9}" y="${y-5}" width="56" height="56" href="${await uri(icon.file)}"/>`,text(lx+78,y+14,icon.name.length>25?icon.name.slice(0,23)+'…':icon.name,12,'font-weight="650"'),text(lx+78,y+34,`${icon.kind==='enemy'?'Enemy':'Crate'} · ${count} placed`,11));y+=70;}
 legend.push(text(lx+12,y+28,'EDITING',12,'font-weight="700"'),text(lx+12,y+49,'Draw arrows and numbered notes.',11),text(lx+12,y+68,'Keep the A–D crosses attached.',11),text(lx+12,y+87,'Send the frame link or SVG back.',11),text(lx+12,y+114,'Textures are a raster reference.',11),text(lx+12,y+133,'Geometry and labels stay editable.',11),'</g>');
 svg=svg.replace('</svg>',pins.join('\n')+'\n'+legend.join('\n')+'\n</svg>')
  .replace('<svg xmlns=','<svg xmlns:xlink="http://www.w3.org/1999/xlink" xmlns=')
  .replaceAll(' href="data:image/',' xlink:href="data:image/');
 if(Buffer.byteLength(svg)>10*1024*1024)throw new Error(`SVG exceeds Figma upload limit: ${row.name}`);
 Object.assign(manifest,{art:report,width,height,objectsCount:manifest.objects.length});
 Object.assign(row,{width,height,objects:manifest.objects.length,planFile:`${stem}.plan.svg`,scenery:scenery.length});
 await writeFile(new URL(row.file,out),svg);await writeFile(new URL(row.manifest,out),JSON.stringify(manifest));
 console.log(`${row.name}: ${report.tiles.length} scenery tiles, ${report.icons.length} portraits, ${scenery.length} scenery references; ${(Buffer.byteLength(svg)/1048576).toFixed(2)} MiB`);
}
inventory.visualArt=true;
await writeFile(new URL('inventory.json',out),JSON.stringify(inventory,null,2));
await writeFile(new URL('index.html',out),(await readFile(new URL('./level-atlas-viewer.html',import.meta.url),'utf8')).replace('/* INVENTORY */',JSON.stringify(inventory)));
