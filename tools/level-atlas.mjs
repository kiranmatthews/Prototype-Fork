// Generate an annotation atlas from the SAME resolved registry and collision
// meshes as the game. This tool never edits the level registry on disk.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {fileURLToPath} from 'node:url';
import {createServer} from 'vite';
import * as THREE from 'three';
import Clipper from 'clipper-lib';

const ROOT = new URL('../', import.meta.url);
const OUT = new URL('../public/provenance/level-atlas/', import.meta.url);
const hash = value => createHash('sha256').update(typeof value === 'string' ? value : JSON.stringify(value)).digest('hex');
const round = n => Math.round(n * 1000) / 1000;
const serial = (prefix,index) => prefix+String(index+1).padStart(4,'0');
const SCALE=8, PAD=96, HEADER=228;
const xml = s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const vec = v=>v.toArray().map(round);
const pointsBox = points=>{
  const b=new THREE.Box3();for(const p of points)b.expandByPoint(new THREE.Vector3(...p));
  return {min:vec(b.min),max:vec(b.max)};
};
const boxPaths = b=>[[[b.min.x,b.min.z],[b.max.x,b.min.z],[b.max.x,b.max.z],[b.min.x,b.max.z]].map(([x,z])=>[round(x),round(z)])];
function union(paths) {
  const clip=new Clipper.Clipper();
  clip.AddPaths(paths.map(path=>path.map(([x,z])=>({X:Math.round(x*1000),Y:Math.round(z*1000)}))),Clipper.PolyType.ptSubject,true);
  const result=[];
  clip.Execute(Clipper.ClipType.ctUnion,result,Clipper.PolyFillType.pftNonZero,Clipper.PolyFillType.pftNonZero);
  return result.map(path=>path.map(p=>[p.X/1000,p.Y/1000]));
}
function projectMesh(mesh) {
  mesh.updateWorldMatrix(true,false);
  const attr=mesh.geometry.attributes.position, index=mesh.geometry.index;
  if(!attr)return null;
  const n=index?index.count:attr.count,paths=[],points=[],v=new THREE.Vector3();
  const matrices=[];
  if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){const m=new THREE.Matrix4();mesh.getMatrixAt(i,m);matrices.push(mesh.matrixWorld.clone().multiply(m));}}
  else matrices.push(mesh.matrixWorld);
  for(const matrix of matrices){
    const transformed=Array.from({length:attr.count},(_,i)=>vec(v.fromBufferAttribute(attr,i).applyMatrix4(matrix)));
    for(const p of transformed)points.push(p);
    for(let j=0;j<n;j+=3){
      const t=[0,1,2].map(k=>transformed[index?index.getX(j+k):j+k]);
      if(!t.every(p=>p?.every(Number.isFinite)))throw new Error(`Nonfinite mesh: ${mesh.name}`);
      const area=(t[1][0]-t[0][0])*(t[2][2]-t[0][2])-(t[1][2]-t[0][2])*(t[2][0]-t[0][0]);
      if(Math.abs(area)<.000001)continue;
      const path=t.map(p=>[p[0],p[2]]);if(area<0)path.reverse();paths.push(path);
    }
  }
  if(!paths.length)return null;
  return {paths:union(paths),bounds:pointsBox(points),triangles:n/3*matrices.length};
}
const KIND_COLORS={surface:'#c1d8ba',wall:'#ae663a',pit:'#db7273',rail:'#397baf',crate:'#9f7748',checkpoint:'#116f53',enemy:'#bc4649',crystal:'#7545af',bonus:'#986820',spawn:'#124d3d',finish:'#2047a0',motion:'#8554a8',camera:'#77868b',pickup:'#d2a324',water:'#95c9d9'};
function elevationColor(y) {
  if(y<0)return '#d8e4b3';if(y<5)return '#bfdbb5';if(y<15)return '#96c9b5';if(y<30)return '#90bdd0';if(y<60)return '#b5b1d6';return '#cbb0d1';
}
function extract(level,data,entry) {
  const objects=[],surfaces=new Map();
  const sourceFor=object=>{
    let n=object;while(n&&n.userData.editorIdx===undefined)n=n.parent;
    const i=n?.userData.editorIdx;
    return Number.isInteger(i)&&entry.data ? {componentIndex:i,componentId:serial('C',i),componentHash:hash(data.components[i]),component:data.components[i]} : {};
  };
  const addBox=(b,id,kind,name,source={})=>{
    if(b.isEmpty()||!Number.isFinite(b.min.x)||Math.abs(b.min.x)>1e7)return;
    objects.push({id,kind,name,...source,paths:boxPaths(b),bounds:{min:vec(b.min),max:vec(b.max)}});
  };
  const addPoint=(position,id,kind,name,source={})=>objects.push({id,kind,name,...source,point:vec(position),bounds:{min:vec(position),max:vec(position)}});
  const floors=[...new Set([...level.groundMeshes,...level.phasePads.map(p=>p.mesh),...level.outlinedSurfaces.map(s=>s.mesh)])];
  for(const [index,mesh] of floors.entries()){
    const projected=projectMesh(mesh);if(!projected)continue;
    const source=sourceFor(mesh),id=source.componentId??serial('G',index),c=source.component;
    const old=surfaces.get(id);
    if(old){old.paths.push(...projected.paths);old.bounds=pointsBox([old.bounds.min,old.bounds.max,projected.bounds.min,projected.bounds.max]);old.triangles+=projected.triangles;continue;}
    surfaces.set(id,{id,kind:'surface',name:c?.nm||mesh.name||c?.t||`Ground ${index+1}`,type:c?.t??mesh.userData.terrainComp?.t??mesh.geometry.type,
      ...source,...projected,conditional:!!(c?.outline||c?.t==='phasepad'||c?.t==='crumble'),invisible:!!c?.invisible,
      lethal:!!(c?.lethal||mesh.userData.lethal),slip:!!(c?.slip||mesh.userData.slippy),groundIndex:index,geometryHash:hash({paths:projected.paths,bounds:projected.bounds})});
  }
  for(const surface of surfaces.values()){surface.paths=union(surface.paths);objects.push(surface);}
  level.walls.forEach((b,i)=>addBox(b,serial('W',i),'wall','Runtime blocking volume'));
  level.containmentWalls.forEach((b,i)=>addBox(b,serial('CW',i),'wall','Containment collision'));
  level.pitBoxes.forEach((b,i)=>{addBox(b,serial('P',i),'pit','Death volume');const poly=level.pitPolyByBox.get(b);if(poly)objects[objects.length-1].paths=[poly.pts.map(([x,z])=>[round(x+poly.cx),round(z+poly.cz)])];});
  level.rails.forEach((rail,i)=>{
    if(rail===level.boss?.phaseGeometry.tongueRail)return;
    const points=rail.points.map(vec),source=sourceFor(rail.object);
    objects.push({id:serial('R',i),kind:'rail',name:source.component?.nm|| (rail.coping?'Surface edge rail':'Grind rail'),...source,points,bounds:pointsBox(points),coping:rail.coping,conditional:!rail.grindable});
  });
  level.crates.forEach((c,i)=>{
    const kind=c.nitro?'nitro':c.tnt?'tnt':c.bang?'switch':c.nitroBang?'nitro clear':c.metal?'metal':c.bouncy?'bounce':c.metalBounce?'metal bounce':c.mask?'mask':c.life?'life':c.multiHit?'multihit':c.mystery?'mystery':'wood';
    addBox(c.box,serial('K',i),'crate',`${kind} crate`,{...sourceFor(c.mesh),crateKind:kind,conditional:!!c.pending});
  });
  level.checkpoints.forEach((c,i)=>addPoint(c.spawnPos,serial('CP',i),'checkpoint',`Checkpoint ${i+1}`,sourceFor(c.mesh)));
  level.enemies.forEach((e,i)=>addPoint(e.group.getWorldPosition(new THREE.Vector3()),serial('E',i),'enemy',e.kind||'Enemy',sourceFor(e.group)));
  level.pickups.forEach((p,i)=>addPoint(p.mesh.getWorldPosition(new THREE.Vector3()),serial('F',i),'pickup','Fruit',sourceFor(p.mesh)));
  addPoint(level.spawnPos,'START','spawn','Spawn');
  if(level.gateSpec)addPoint(new THREE.Vector3(level.gateSpec.x,level.gateSpec.y,level.gateSpec.z),'FINISH','finish',level.boss?'Logical gate · boss victory rules':'Finish gate');
  if(level.crystalPickup)addPoint(level.crystalPickup.group.getWorldPosition(new THREE.Vector3()),'CRYSTAL','crystal','Crystal');
  if(level.clockPickup)addPoint(level.clockPickup.group.getWorldPosition(new THREE.Vector3()),'CLOCK','pickup','Time trial clock');
  if(level.bonusPlatform)addPoint(level.bonusPlatform.group.getWorldPosition(new THREE.Vector3()),'BONUS','bonus','Bonus entrance · separate stage omitted');
  if(level.lanePts.length>1){const points=level.lanePts.map(p=>[round(p.x),round(p.y),round(p.z)]);objects.push({id:'CAMERA',kind:'camera',name:'Camera lane · not a traversal route',points,bounds:pointsBox(points)});}
  // Motion drawings use the actual runtime endpoints, including default axes.
  const cycle=(m,id,name,source)=>{
    const a=m.base.clone().addScaledVector(m.axisV,-m.amp),b=m.base.clone().addScaledVector(m.axisV,m.amp),points=[vec(a),vec(b)];
    objects.push({id,kind:'motion',name,...source,points,bounds:pointsBox(points),motion:{base:vec(m.base),axis:vec(m.axisV),amplitude:m.amp,speed:m.speed,phase:m.phase}});
  };
  level.movers.forEach((m,i)=>cycle(m,serial('MV',i),'Platform centre travel ± amplitude',sourceFor(m.mesh)));
  // MovingRail.base is an offset origin (0,0,0), not a world position.
  // Anchor the diagram at a real rest-pose point on the rail instead.
  level.movingRails.forEach((m,i)=>cycle({...m,base:m.rail.pointAt(m.rail.totalLength/2)},serial('MR',i),'Rail centre travel',{
    ...sourceFor(m.object),railId:serial('R',level.rails.indexOf(m.rail)),translationBase:vec(m.base)}));
  level.ropeSwings.forEach((r,i)=>{
    const extent=Math.sin(r.amp)*r.len,axis=new THREE.Vector3(Math.cos(r.yaw),0,-Math.sin(r.yaw)),a=r.anchor.clone().addScaledVector(axis,-extent),b=r.anchor.clone().addScaledVector(axis,extent),points=[vec(a),vec(b)];
    objects.push({id:serial('RS',i),kind:'motion',name:'Swing rope reach in XZ',...sourceFor(r.pivot),points,bounds:pointsBox(points),motion:{anchor:vec(r.anchor),length:r.len,angle:r.amp,yaw:r.yaw}});
    if(r.travel)cycle(r.travel,serial('RF',i),'Travelling rope anchor',sourceFor(r.pivot));
  });
  level.crushers.forEach((c,i)=>addBox(c.box,serial('CR',i),'enemy','Crusher footprint',sourceFor(c.mesh)));
  level.stones.forEach((s,i)=>{addBox(s.box,serial('ST',i),'enemy','Rolling stone',sourceFor(s.mesh));const points=s.axis==='x'?[[s.x0,s.mesh.position.y,s.z],[s.x1,s.mesh.position.y,s.z]]:[[s.x,s.mesh.position.y,s.z0],[s.x,s.mesh.position.y,s.z1]];objects.push({id:serial('ST-TRAVEL',i),kind:'motion',name:'Rolling stone patrol centre',points,bounds:pointsBox(points)});});
  level.angryBalls.forEach((a,i)=>addBox(a.box,serial('AB',i),'enemy','Chasing ball',sourceFor(a.mesh)));
  level.grindosauri.forEach((a,i)=>addBox(a.body,serial('GD',i),'enemy','Grindosaurus body',sourceFor(a.group)));
  level.trickGates.forEach((g,i)=>addPoint(g.center,serial('TG',i),'special',`${g.trick} trick gate`,sourceFor(g.ring)));
  level.returnPortals.forEach((p,i)=>{addBox(p.box,serial('PORTAL',i),'special','Portal entrance',sourceFor(p.visual));const points=[vec(p.center),vec(p.destination)];objects.push({id:serial('TELEPORT',i),kind:'motion',name:'Portal destination (teleport, not walkable)',points,bounds:pointsBox(points)});});
  level.pendulums.forEach((p,i)=>{
    const centre=p.pivot.getWorldPosition(new THREE.Vector3()),axis=new THREE.Vector3(Math.cos(p.yaw),0,-Math.sin(p.yaw)),extent=Math.sin(p.amp)*p.len,points=[vec(centre.clone().addScaledVector(axis,-extent)),vec(centre.clone().addScaledVector(axis,extent))];
    objects.push({id:serial('PN',i),kind:'motion',name:'Pendulum swing reach',points,bounds:pointsBox(points)});
  });
  level.spinBridges.forEach((bridge,i)=>{
    const c=bridge.component,[span,,width]=c.s??[5,.36,1.2],m=new THREE.Matrix4().makeRotationY((c.yaw??0)*Math.PI/180),points=[[0,0,-width/2],[span,0,-width/2],[span,0,width/2],[0,0,width/2]].map(p=>vec(new THREE.Vector3(...p).applyMatrix4(m).add(new THREE.Vector3(...c.p))));
    objects.push({id:serial('SB',i),kind:'motion',name:'Spin bridge · deployed footprint',...sourceFor(bridge.mesh),paths:[points.map(p=>[p[0],p[2]])],bounds:pointsBox(points)});
  });
  if(level.boss){
    const geo=level.boss.phaseGeometry;
    geo.setRamp(1,0);const p=projectMesh(geo.sandRamp);if(p)objects.push({id:'BOSS-RAMP',kind:'motion',name:'Phase 3 · formed sand kicker',...p});
    geo.setTongue(level.boss.model.root.position.clone().add(new THREE.Vector3(0,6.4,1)),1,0);
    const points=geo.tongueRail.points.map(vec);objects.push({id:'BOSS-TONGUE',kind:'motion',name:'Phase 2 · extended tongue rail',points,bounds:pointsBox(points)});
  }
  // Keep the complete source components in the snapshot; compact metadata in
  // the manifest is enough to identify an object after source insertions.
  for(const o of objects){if(o.component){const c=o.component;o.authored={t:c.t,p:c.p,nm:c.nm,grp:c.grp,yaw:c.yaw,s:c.s};delete o.component;}}
  const finite=objects.every(o=>[...o.bounds.min,...o.bounds.max].every(Number.isFinite));
  if(!finite)throw new Error(`Nonfinite object in ${entry.id}`);
  return objects;
}

function renderMap(meta,objects) {
  const playable=objects.filter(o=>!['wall','camera','pit','pickup'].includes(o.kind));
  const bounds=pointsBox(playable.flatMap(o=>[o.bounds.min,o.bounds.max]));
  let minX=Math.floor((bounds.min[0]-8)/10)*10,maxX=Math.ceil((bounds.max[0]+8)/10)*10;
  const minZ=Math.floor((bounds.min[2]-8)/10)*10,maxZ=Math.ceil((bounds.max[2]+8)/10)*10;
  // A minimum plotting width gives narrow corridor maps a readable legend.
  if(maxX-minX<120){const mid=(maxX+minX)/2;minX=Math.floor((mid-60)/10)*10;maxX=minX+120;}
  const plotW=(maxX-minX)*SCALE,plotH=(maxZ-minZ)*SCALE,width=plotW+PAD*2,height=plotH+HEADER+100;
  const X=x=>round(PAD+(x-minX)*SCALE),Z=z=>round(HEADER+(z-minZ)*SCALE);
  const pathD=paths=>paths.map(p=>'M'+p.map(([x,z])=>`${X(x)},${Z(z)}`).join('L')+'Z').join('');
  const text=(x,y,value,size=12,color='#293e3f',extra='')=>`<text x="${x}" y="${y}" font-family="Inter,Arial,sans-serif" font-size="${size}" fill="${color}" ${extra}>${xml(value)}</text>`;
  const line=(x1,y1,x2,y2,stroke='#d4ddd8',extra='')=>`<path d="M${x1},${y1}L${x2},${y2}" fill="none" stroke="${stroke}" ${extra}/>`;
  const title=o=>`${o.id} | ${o.name} | Y ${o.bounds.min[1]}…${o.bounds.max[1]}m${o.componentId?' | '+o.componentId:''}`;
  const shape=(o,style)=>`<g id="${xml(title(o))}"><title>${xml(title(o))}</title><path d="${pathD(o.paths)}" fill-rule="nonzero" ${style}/></g>`;
  const inPlot=o=>o.bounds.max[0]>=minX&&o.bounds.min[0]<=maxX&&o.bounds.max[2]>=minZ&&o.bounds.min[2]<=maxZ;
  const drawing=objects.filter(inPlot);
  const parts=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<title>${xml(meta.name)} · bird's-eye level plan</title>`,
    `<desc>${xml(JSON.stringify({level:meta.levelId,snapshot:meta.snapshotId,scale:SCALE,origin:[PAD,HEADER],worldOrigin:[minX,minZ],axes:'X right; -Z up; Y is elevation'}))}</desc>`,
    `<rect id="Paper" width="${width}" height="${height}" fill="#f6f8f3"/>`,
    `<g id="00 Reference · keep with map">`,text(PAD,40,`CODEX / SOL    •    CAMPAIGN ATLAS    /    ${String(meta.order).padStart(2,'0')}`,13,'#54706c','letter-spacing="1.8"'),
    text(PAD,82,meta.name,32,'#163f36','font-weight="700"'),
    text(PAD,109,`${meta.progressKey}  /  level ${meta.levelId}  /  snapshot ${meta.snapshotId}  /  10 October 2026`,12),
    text(PAD,131,`1 m = ${SCALE} px  •  X →   −Z ↑  •  ${meta.source} geometry  •  Y = world height (metres)  •  killY ${meta.killY} m`,12),
    text(PAD,154,'Green → blue → violet = higher surfaces; labels show max Y. Dashed purple = motion. Camera line is not a walking route.',12),
    text(PAD,177,'CP checkpoint    ◆ crystal    ○ bonus entrance    ■ crates    × enemy    Blue = rails    Rust = blocking bounds',12),
    text(PAD,199,meta.competition?'COMPLETION: scored cup runs. Start and course geometry shown.':meta.boss?'COMPLETION: authored encounter rules. Logical gate retained where present.':'Draw above the map. Keep its title and A–D reference crosses for precise annotation return.',12,'#56645e'),`</g>`];
  parts.push('<g id="01 Coordinate grid · 10 metres">');
  const gridStep=10;
  for(let x=minX;x<=maxX;x+=gridStep){const major=x%50===0;parts.push(line(X(x),HEADER,X(x),HEADER+plotH,major?'#ccd6cc':'#e2e8df',`stroke-width="${major?1.2:.65}"`),text(X(x)+3,HEADER-12,`${x}`,10,'#667a6c'));}
  for(let z=minZ;z<=maxZ;z+=gridStep){const major=z%50===0;parts.push(line(PAD,Z(z),PAD+plotW,Z(z),major?'#ccd6cc':'#e2e8df',`stroke-width="${major?1.2:.65}"`),text(16,Z(z)+4,`${z}`,10,'#667a6c'));}
  parts.push('</g>');
  // Clip actual collision geometry to the drawing frame without changing the
  // coordinates or the full extents recorded in the manifest.
  parts.push(`<defs><clipPath id="MapExtent"><rect x="${PAD}" y="${HEADER}" width="${plotW}" height="${plotH}"/></clipPath></defs><g id="Map geometry" clip-path="url(#MapExtent)">`);
  parts.push('<g id="02 Death volumes · below surfaces">');
  for(const o of drawing.filter(o=>o.kind==='pit'))parts.push(shape(o,'fill="#f2c2bb" fill-opacity=".45" stroke="#c47971" stroke-width="1" stroke-dasharray="6 4"'));
  parts.push('</g>');
  const floors=drawing.filter(o=>o.kind==='surface').sort((a,b)=>a.bounds.max[1]-b.bounds.max[1]);
  const heightLayers=new Map();
  for(const o of floors){const band=Math.floor(o.bounds.max[1]/5)*5;if(!heightLayers.has(band))heightLayers.set(band,[]);heightLayers.get(band).push(o);}
  for(const [band,items]of heightLayers){parts.push(`<g id="03 Surfaces · upper Y ${band} to ${band+5} m">`);
    for(const o of items)parts.push(shape(o,`fill="${o.lethal?'#e89894':o.slip?'#a4d9ef':elevationColor(o.bounds.max[1])}" fill-opacity=".89" stroke="${o.conditional?'#8554a8':o.invisible?'#6f8990':'#50776c'}" stroke-width="1.05" ${o.conditional||o.invisible?'stroke-dasharray="4 3"':''}`));
    parts.push('</g>');}
  // Thousands of generated wall segments are one editable compound vector;
  // every individual runtime volume remains available in the manifest.
  const walls=drawing.filter(o=>o.kind==='wall');
  parts.push(`<g id="04 Blocking volumes · ${walls.length} runtime boxes"><path d="${pathD(union(walls.flatMap(o=>o.paths)))}" fill="#ba7139" fill-opacity=".09" stroke="#ad7048" stroke-opacity=".65" stroke-width=".9"/></g>`);
  for(const kind of ['camera','rail','motion']){
    parts.push(`<g id="${kind==='camera'?'05 Camera guide':kind==='rail'?'06 Grind rails':'07 Moving and conditional geometry'}">`);
    for(const o of drawing.filter(o=>o.kind===kind)){
      if(o.paths)parts.push(shape(o,'fill="#b48dce" fill-opacity=".16" stroke="#805399" stroke-width="2" stroke-dasharray="6 4"'));
      if(o.points){const d='M'+o.points.map(p=>`${X(p[0])},${Z(p[2])}`).join('L');parts.push(`<g id="${xml(title(o))}"><title>${xml(title(o))}</title><path d="${d}" fill="none" stroke="${KIND_COLORS[kind]}" stroke-width="${kind==='rail'?(o.coping?1.2:2.3):1.6}" ${kind!=='rail'?'stroke-dasharray="7 5"':''} stroke-opacity="${kind==='camera'?.55:1}"/></g>`);}
    }parts.push('</g>');
  }
  parts.push('<g id="08 Objects and collectibles">');
  for(const o of drawing.filter(o=>['crate','enemy','pickup','special'].includes(o.kind))){
    const color=o.kind==='crate'&&['nitro','tnt'].includes(o.crateKind)?'#cf5050':KIND_COLORS[o.kind]??'#8751ad';
    if(o.paths)parts.push(shape(o,`fill="${color}" fill-opacity=".82" stroke="#fbfaf4" stroke-width=".7" ${o.conditional?'stroke-dasharray="2 2"':''}`));
    else {const [x,,z]=o.point;parts.push(`<g id="${xml(title(o))}"><title>${xml(title(o))}</title>${o.kind==='enemy'?line(X(x)-4,Z(z)-4,X(x)+4,Z(z)+4,color,'stroke-width="2"')+line(X(x)-4,Z(z)+4,X(x)+4,Z(z)-4,color,'stroke-width="2"'):`<circle cx="${X(x)}" cy="${Z(z)}" r="${o.id==='CLOCK'?4.5:1.8}" fill="${color}"/>`}</g>`);}
  }parts.push('</g>');
  // Label only substantial surfaces at their exact centres. The complete ID
  // and Y interval is always in the editable vector's layer name and manifest.
  parts.push('<g id="09 Surface labels · hide to declutter">');const used=[];
  for(const o of floors){const w=o.bounds.max[0]-o.bounds.min[0],d=o.bounds.max[2]-o.bounds.min[2];if(w*d<20||w<2.5||d<2.5)continue;
    const x=X((o.bounds.min[0]+o.bounds.max[0])/2),z=Z((o.bounds.min[2]+o.bounds.max[2])/2);if(used.some(p=>Math.abs(p[0]-x)<70&&Math.abs(p[1]-z)<17))continue;used.push([x,z]);
    parts.push(text(x,z,`${o.id} · maxY ${round(o.bounds.max[1])}`,9,'#263e3a','text-anchor="middle" paint-order="stroke" stroke="#f6f8f3" stroke-width="2.5" stroke-linejoin="round"'));
  }parts.push('</g>');
  parts.push('<g id="10 Start checkpoints finish and crystal">');
  const markerLabels=[];
  for(const o of drawing.filter(o=>['spawn','checkpoint','finish','crystal','bonus'].includes(o.kind))){const [x,y,z]=o.point,px=X(x),py=Z(z),color=KIND_COLORS[o.kind],left=px>PAD+plotW*.8,lx=px+(left?-12:12);let ly=py-9;
    while(markerLabels.some(p=>Math.abs(p[0]-lx)<130&&Math.abs(p[1]-ly)<16))ly+=17;markerLabels.push([lx,ly]);
    const marker=o.kind==='crystal'?`<path d="M${px},${py-9}l7,9 -7,9 -7,-9Z" fill="${color}" stroke="#fffdf5" stroke-width="2"/>`:`<circle cx="${px}" cy="${py}" r="7" fill="${o.kind==='bonus'?'#fffdf5':color}" stroke="${o.kind==='bonus'?color:'#fffdf5'}" stroke-width="2"/>`;
    parts.push(`<g id="${xml(title(o))}"><title>${xml(title(o))}</title>${marker}`,ly!==py-9?line(px,py,lx,ly,color,'stroke-width=".8"'):'',text(lx,ly,`${o.id} · Y ${y}`,12,color,`text-anchor="${left?'end':'start'}" font-weight="700" paint-order="stroke" stroke="#f6f8f3" stroke-width="4" stroke-linejoin="round"`),`</g>`);
  }parts.push('</g></g>');
  const anchors=[['A',minX,minZ],['B',maxX,minZ],['C',minX,maxZ],['D',maxX,maxZ]].map(([id,x,z])=>({id,world:[x,z],svg:[X(x),Z(z)]}));
  parts.push('<g id="11 Registration anchors · do not detach">');
  for(const a of anchors){const [x,y]=a.svg;parts.push(`<g id="REF-${a.id} | X ${a.world[0]} Z ${a.world[1]}">`,line(x-8,y,x+8,y,'#163f36','stroke-width="2"'),line(x,y-8,x,y+8,'#163f36','stroke-width="2"'),text(x+(a.id==='B'||a.id==='D'?-4:4),y+(a.id==='A'||a.id==='B'?18:-12),`${a.id} (${a.world.join(', ')})`,11,'#163f36',`text-anchor="${a.id==='B'||a.id==='D'?'end':'start'}" font-weight="700"`),'</g>');}
  parts.push('</g>',line(PAD,height-46,PAD+80,height-46,'#193d36','stroke-width="3"'),text(PAD,height-57,'10 m',11),text(PAD+115,height-40,'Codex/sol fork · full object IDs, heights and source references in the companion manifest',12),'</svg>');
  return {svg:parts.join('\n'),width,height,projection:{units:'metres',pixelsPerMetre:SCALE,minX,maxX,minZ,maxZ,offsetX:PAD,offsetY:HEADER,formula:'svgX = offsetX + (worldX - minX) * pixelsPerMetre; svgY = offsetY + (worldZ - minZ) * pixelsPerMetre',anchors},clippedObjects:objects.filter(o=>!inPlot(o)).map(o=>o.id)};
}
const fixture = await readFile(new URL('./validate-editor-roundtrip.mjs', import.meta.url), 'utf8');
// Reuse the established runtime test shim, without executing its test suite.
new Function(fixture.slice(fixture.indexOf('function installHeadlessDom()'), fixture.indexOf('\nfunction round(')) + '\ninstallHeadlessDom();')();
window.location.search = '';
const server = await createServer({root:fileURLToPath(ROOT), configFile:false, appType:'custom', logLevel:'error', optimizeDeps:{noDiscovery:true,include:[]}, server:{middlewareMode:true,hmr:false,watch:null}});

try {
  const mod = await server.ssrLoadModule('/src/level.ts');
  const {CAMPAIGN_LEVELS, CAMPAIGN_ISLANDS} = await server.ssrLoadModule('/src/campaign.ts');
  const packText = await readFile(new URL('../public/levels.json',import.meta.url),'utf8');
  const pack = JSON.parse(packText);
  if (!mod.setUserLevels(pack.levels)) throw new Error('Published level pack failed runtime validation');
  mod.setEditorBuild(true);
  const defs = CAMPAIGN_ISLANDS.flatMap(island=>island.levelKeys.map(key=>CAMPAIGN_LEVELS.find(d=>d.progressKey===key)).filter(Boolean));
  if(defs.length!==CAMPAIGN_LEVELS.length)throw new Error('Campaign atlas coverage mismatch');
  await mkdir(OUT,{recursive:true});
  const provenance = {schema:1, generatedAt:new Date().toISOString(), gitHead:execFileSync('git',['rev-parse','HEAD'],{cwd:ROOT}).toString().trim(),
    workingTree:true, registry:'public/levels.json + source built-ins, resolved by levelList()',
    sourceHashes:Object.fromEntries(await Promise.all(['src/level.ts','src/campaign.ts','public/levels.json'].map(async p=>[p,hash(await readFile(new URL(p,ROOT),'utf8'))])))};
  const summaries=[];
  for(const [order,def] of defs.entries()) {
    const entry=mod.findLevel(def.levelId);
    if(!entry)throw new Error(`Missing ${def.levelId}`);
    const level=new mod.Level(new THREE.Scene(),entry);
    const data=level.captureData();
    const info={order:order+1, ...def, source:entry.data?(pack.levels.some(e=>e.id===entry.id && hash(e.data)===hash(entry.data))?'published':'source'):'native',
      components:data.components.length, ground:level.groundMeshes.length, rails:level.rails.length, walls:level.walls.length, pits:level.pitBoxes.length,
      spawn:level.spawnPos.toArray(),killY:level.killY,snapshotId:hash(data).slice(0,12)};
    const objects=extract(level,data,entry);
    const drawing=renderMap(info,objects),stem=`${String(order+1).padStart(2,'0')}-${def.progressKey}`;
    info.file=`${stem}.svg`;info.manifest=`${stem}.json`;info.snapshot=`${stem}.source.json.gz`;
    Object.assign(info,{width:drawing.width,height:drawing.height,objects:objects.length,projection:drawing.projection});
    const manifest={...provenance,...info,sourceDataHash:hash(data),clippedObjects:drawing.clippedObjects,objects};
    await writeFile(new URL(info.file,OUT),drawing.svg);
    await writeFile(new URL(`${stem}.plan.svg`,OUT),drawing.svg);
    await writeFile(new URL(info.manifest,OUT),JSON.stringify(manifest));
    await writeFile(new URL(info.snapshot,OUT),gzipSync(JSON.stringify(data)));
    console.log(`${info.order}/26 ${info.name}: ${objects.length} objects, ${Math.round(drawing.svg.length/1024)} KiB, ${drawing.width} × ${drawing.height}`);
    summaries.push(info);
    level.dispose();
  }
  await writeFile(new URL('inventory.json',OUT),JSON.stringify({provenance,levels:summaries},null,2));
  await writeFile(new URL('index.html',OUT),(await readFile(new URL('./level-atlas-viewer.html',import.meta.url),'utf8')).replace('/* INVENTORY */',JSON.stringify({provenance,levels:summaries})));
  await writeFile(new URL('README.txt',OUT),await readFile(new URL('./level-atlas-readme.txt',import.meta.url)));
} finally {await server.close();}
