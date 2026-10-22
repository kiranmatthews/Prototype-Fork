import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';

// Original 1999 Mall, reconstructed from the supplied VGCartography cutaway.
// Metres, Y up. The mall bends east through the atrium and north again at
// the lower escalator. All collision, coping and scenery remain editor data.
type P = [number, number, number];
type Knot = { s: number; x: number; z: number; y: number; width: number };
const C: CustomComponent[] = [];
const groups: CustomGroup[] = [
  'Entry descent', 'Fountain court', 'Upper gallery and Flying Leap',
  'Suspended atrium', 'Lower escalator', 'Crossrail arcade', 'Outdoor plaza',
  'Mezzanine and exit', 'Mall architecture', 'Storefront details', 'Ceiling and lights',
].map((nm, i) => ({ id: i + 1, nm, editorOnly: true }));
const stone = '#bcb6aa', trim = '#557c78', dark = '#333d42', brass = '#ae9570';
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (a:number,b:number,s:number) => {const t=clamp((s-a)/(b-a));return t*t*(3-2*t);};
const add = (c: CustomComponent) => { C.push(c); return c; };

// Plan landmarks are independent of elevation: the two descending connectors
// have tangent easements, so neither their top nor their toe trips the board.
export const MALL_KNOTS: Knot[] = [
  { s: 0, x: 0, z: 10, y: 18, width: 9 },
  { s: 12, x: 0, z: -2, y: 18, width: 9 },
  { s: 32, x: 0, z: -22, y: 12, width: 9 },
  { s: 42, x: 0, z: -32, y: 12, width: 25 },
  { s: 44, x: 0, z: -34, y: 12, width: 25 },
  { s: 100, x: 0, z: -90, y: 12, width: 28 },
  { s: 116, x: 0, z: -106, y: 8, width: 23 },
  { s: 130, x: 0, z: -120, y: 8, width: 30 },
  { s: 146, x: 5, z: -135, y: 8, width: 32 },
  { s: 162, x: 18, z: -144, y: 8, width: 30 },
  { s: 180, x: 36, z: -145, y: 8, width: 26 },
  { s: 196, x: 52, z: -145, y: 8, width: 26 },
  { s: 214, x: 70, z: -145, y: 3.5, width: 20 },
  { s: 230, x: 85, z: -141, y: 3.5, width: 23 },
  { s: 245, x: 99, z: -144, y: 3.5, width: 23 },
  { s: 260, x: 108, z: -156, y: 3.5, width: 18 },
  { s: 276, x: 108, z: -172, y: 0, width: 18 },
  { s: 306, x: 108, z: -202, y: 0, width: 18 },
  { s: 319, x: 108, z: -215, y: 0, width: 12 },
  { s: 330, x: 108, z: -226, y: 0, width: 26 },
  { s: 374, x: 108, z: -270, y: 0, width: 27 },
  { s: 388, x: 108, z: -284, y: -3, width: 11.4 },
  { s: 410, x: 108, z: -306, y: -3, width: 11.4 },
  { s: 414, x: 108, z: -310, y: -3, width: 7.8 },
  { s: 432, x: 108, z: -328, y: -10, width: 7.8 },
  { s: 438, x: 108, z: -334, y: -10, width: 7.8 },
  { s: 442, x: 108, z: -338, y: -10, width: 11.4 },
  { s: 466, x: 108, z: -362, y: -10, width: 11.4 },
];
export const MALL_LENGTH = 466;
export const MALL_EXIT = { approach:374, deckStart:377, deckEnd:408, deckY:2.8, corridorStart:388,
 stairStart:414, stairEnd:432, doors:438, finish:463 };
export const MALL_POOL = { start:347, end:354, halfWidth:5.2, depth:.8, bevel:1.2,
 launchStart:339, launchLip:345.2, landingEnd:363, rewardS:350.5, rewardY:5.2 };
const segment = (s: number) => Math.min(MALL_KNOTS.length - 2,
  Math.max(0, MALL_KNOTS.findIndex(k => k.s > s) - 1));
function plan(s: number): { x: number; z: number; dx: number; dz: number; width: number } {
  s = clamp(s, 0, MALL_LENGTH - .0001);
  const i = segment(s), a = MALL_KNOTS[i], b = MALL_KNOTS[i + 1];
  const t = clamp((s - a.s) / (b.s - a.s)), h = b.s - a.s;
  const tangent = (j: number, axis: 'x' | 'z') => {
    const before = MALL_KNOTS[Math.max(0, j - 1)], after = MALL_KNOTS[Math.min(MALL_KNOTS.length - 1, j + 1)];
    return (after[axis] - before[axis]) / (after.s - before.s);
  };
  const value = (axis: 'x' | 'z') => (2*t*t*t - 3*t*t + 1)*a[axis]
    + (t*t*t - 2*t*t + t)*h*tangent(i, axis)
    + (-2*t*t*t + 3*t*t)*b[axis] + (t*t*t - t*t)*h*tangent(i + 1, axis);
  const derivative = (axis: 'x' | 'z') => ((6*t*t - 6*t)*a[axis]
    + (3*t*t - 4*t + 1)*h*tangent(i, axis)
    + (-6*t*t + 6*t)*b[axis] + (3*t*t - 2*t)*h*tangent(i + 1, axis)) / h;
  return { x: value('x'), z: value('z'), dx: derivative('x'), dz: derivative('z'), width: mix(a.width, b.width, t) };
}
export function mallHeight(s: number): number {
  const i = segment(clamp(s, 0, MALL_LENGTH - .0001)), a = MALL_KNOTS[i], b = MALL_KNOTS[i + 1];
  let t = clamp((s - a.s) / (b.s - a.s));
  // Two-metre parabolic easements around a constant pitch, matching a real
  // escalator's flat landing. Shared endpoints have exactly the same Y.
  const e = Math.min(.14, 2 / (b.s - a.s));
  t = t < e ? t*t/(2*e*(1-e)) : t > 1-e ? 1-(1-t)*(1-t)/(2*e*(1-e)) : (t-e/2)/(1-e);
  return mix(a.y, b.y, t);
}
export function mallPoint(s: number, offset = 0, y = mallHeight(s)): P {
  const q = plan(s), n = Math.hypot(q.dx, q.dz);
  return [q.x - q.dz/n*offset, y, q.z + q.dx/n*offset];
}
export function mallYaw(s: number): number { const q = plan(s); return Math.atan2(-q.dx, -q.dz)*180/Math.PI; }
export function mallProject(x: number, z: number, hint = 0): number {
  let best = clamp(hint, 0, MALL_LENGTH), distance = Infinity;
  for (let s = Math.max(0, hint-24); s <= Math.min(MALL_LENGTH, hint+40); s += .25) {
    const q = plan(s), d = (q.x-x)**2 + (q.z-z)**2;
    if (d < distance) { distance = d; best = s; }
  }
  return best;
}

// Mesh scenery is collected by material in bounded batches. Collider meshes
// are authored separately, with no decorative edge rails or coplanar faces.
const batches = new Map<string, { vertices: number[]; indices: number[]; color: string; grp: number; emissive?: string }>();
function face(points: P[], color: string, grp = 9, emissive?: string) {
  const baseKey = `${grp}:${color}:${emissive??''}`;
  let key = baseKey, n = 0;
  while ((batches.get(key)?.vertices.length ?? 0) + points.length*3 > 12000) key = `${baseKey}:${++n}`;
  let b = batches.get(key);
  if (!b) { b = { vertices: [], indices: [], color, grp, emissive }; batches.set(key, b); }
  const at = b.vertices.length / 3; b.vertices.push(...points.flat());
  for (let j = 1; j < points.length-1; j++) b.indices.push(at, at+j, at+j+1);
}
function box(p: P, size: P, color: string, grp = 9, yaw = 0, solid = false, name = 'Mall detail') {
  if (solid) return add({ t: 'platform', p, s: size, yaw, color, tex: 'solid', edgeGrinding: false, grp, nm: name });
  const a = yaw*Math.PI/180, cs = Math.cos(a), sn = Math.sin(a);
  const v = (x: number,y: number,z: number): P => [p[0]+x*cs+z*sn,p[1]+y,p[2]-x*sn+z*cs];
  const [w,h,d] = size.map(v=>v/2);
  const q = [v(-w,-h,-d),v(w,-h,-d),v(w,h,-d),v(-w,h,-d),v(-w,-h,d),v(w,-h,d),v(w,h,d),v(-w,h,d)];
  for (const f of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]) face(f.map(i=>q[i]),color,grp);
}
function ribbon(name: string, a: number, b: number, left: number | ((s:number)=>number), right: number | ((s:number)=>number),
  y: (s:number)=>number, grp: number, color = stone, solid = true, tex = 'pavement', bottom?: (s:number)=>number, spacing=.7) {
  const n = Math.ceil((b-a)/spacing), vertices: number[] = [], indices: number[] = [], uvs: number[] = [];
  const rows:Array<{s:number;l:number;r:number;top:number;bottom:number}>=[];
  for (let i=0;i<=n;i++) {
    const s=mix(a,b,i/n), l=typeof left==='function'?left(s):left, r=typeof right==='function'?right(s):right;
    vertices.push(...mallPoint(s,l,y(s)),...mallPoint(s,r,y(s)));uvs.push(l/3,s/3,r/3,s/3);
    if(i<n){const j=i*2;indices.push(j,j+1,j+3,j,j+3,j+2);}
    if(bottom)rows.push({s,l,r,top:y(s),bottom:bottom(s)});
  }
  if(bottom){
    // Separate skirt vertices keep the top's normals flat. Closed bottoms
    // give the lower routes a real soffit without filling their underpasses.
    const quad=(q:P[])=>{const at=vertices.length/3;vertices.push(...q.flat());indices.push(at,at+1,at+2,at,at+2,at+3);uvs.push(0,0,1,0,1,1,0,1);};
    const p=(i:number,right=false,lower=false)=>{const q=rows[i];return mallPoint(q.s,right?q.r:q.l,lower?q.bottom:q.top);};
    for(let i=0;i<n;i++){
      quad([p(i),p(i+1),p(i+1,false,true),p(i,false,true)]);
      quad([p(i,true),p(i,true,true),p(i+1,true,true),p(i+1,true)]);
      quad([p(i,false,true),p(i+1,false,true),p(i+1,true,true),p(i,true,true)]);
    }
    quad([p(0),p(0,false,true),p(0,true,true),p(0,true)]);
    quad([p(n),p(n,true),p(n,true,true),p(n,false,true)]);
    if(solid){
      // Mesh tops support wheels; the existing wall primitive owns side
      // contact. Keep each core below the slope by the player's half-width
      // so the next slice cannot snag a board rolling uphill. A raised
      // slab starts at its underside, preserving the lower passage.
      for(let i=0;i<n;i++){
        let end=i+1;
        const same=(q:typeof rows[number])=>Math.abs(q.top-rows[i].top)<1e-6&&Math.abs(q.bottom-rows[i].bottom)<1e-6&&q.l===rows[i].l&&q.r===rows[i].r;
        if(same(rows[end]))while(end<n&&same(rows[end+1]))end++;
        const a=rows[i],b=rows[end],slope=Math.abs(b.top-a.top)/(b.s-a.s);
        const bottom=Math.max(a.bottom,b.bottom),top=Math.min(a.top,b.top)-.26-slope*.52;
        if(top-bottom>=.2){
          // A world AABB extends a broad curved slab ahead of its visible
          // slope and can snag an angled approach. Use the actual footprint;
          // skip cores thinner than the wall primitive's 0.2 m minimum.
          const q=[mallPoint(a.s,a.l+.06),mallPoint(a.s,a.r-.06),mallPoint(b.s,b.r-.06),mallPoint(b.s,b.l+.06)];
          add({t:'wall',p:[0,bottom,0],s:[1,top-bottom,1],pts:q.map(v=>[v[0],v[2]]),invisible:true,edgeGrinding:false,grp,nm:`${name} body`});
        }
        i=end-1;
      }
    }
  }
  return add({t:'mesh',p:[0,0,0],vertices,indices,uvs,tex,color,solid,doubleSided:!bottom,edgeGrinding:false,castShadow:solid,grp,nm:name});
}
function rail(name: string, points: P[], grp: number, posts = false, floor = (s:number)=>mallHeight(s), start = 0, end = 0) {
  const p = points[0];
  const component=add({t:'rail',p,pts:points.map(q=>[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]),color:'#b8c6c6',grp,nm:name});
  if(posts) for(let i=0;i<points.length;i+=4){const q=points[i],y=floor(mix(start,end,i/(points.length-1)));box([q[0],(y+q[1])/2,q[2]],[.09,q[1]-y,.09],dark,grp);}
  return component;
}
function railAlong(name: string, a: number,b: number,offset: number | ((s:number)=>number),y:(s:number)=>number,grp:number,posts=true){
  const n=Math.ceil((b-a)/1.2),points=Array.from({length:n+1},(_,i)=>{const s=mix(a,b,i/n);return mallPoint(s,typeof offset==='function'?offset(s):offset,y(s));});
  return rail(name,points,grp,posts,mallHeight,a,b);
}
function planter(s:number,offset:number,w:number,d:number,y=mallHeight(s),grp=9){
  const q=mallPoint(s,offset,y+.37),yaw=mallYaw(s);
  box(q,[w,.74,d],brass,grp,yaw,true,'Raised stone planter');
  box(mallPoint(s,offset,y+.76),[w-.3,.08,d-.3],'#333c30',grp,yaw);
  for(let i=0;i<Math.max(2,Math.floor(d/1.2));i++){
    const t=s-d/2+.65+i*1.15;
    const centre=mallPoint(t,offset,y+.83);
    for(let leaf=0;leaf<9;leaf++){
      const a=leaf*Math.PI*2/9+i*.7,dx=Math.cos(a),dz=Math.sin(a),len=w*.44;
      const tip:P=[centre[0]+dx*len,centre[1]+.28,centre[2]+dz*len];
      const peak:P=[centre[0]+dx*len*.55,centre[1]+.65,centre[2]+dz*len*.55];
      face([centre,[peak[0]-dz*.18,peak[1],peak[2]+dx*.18],tip,[peak[0]+dz*.18,peak[1],peak[2]-dx*.18]],leaf%2?'#567d4c':'#79965c',grp);
    }
  }
}
// Small physical signs use a single batch of letter faces, avoiding textures,
// canvas dependencies and network assets. Their text is world scenery only.
const FONT:Record<string,string>={
 A:'01110100011000111111100011000110001',B:'11110100011000111110100011000111110',C:'01111100001000010000100001000001111',D:'11110100011000110001100011000111110',E:'11111100001000011110100001000011111',F:'11111100001000011110100001000010000',G:'01111100001000010111100011000101111',H:'10001100011000111111100011000110001',I:'11111001000010000100001000010011111',J:'00111000100001000010100101001001100',K:'10001100101010011000101001001010001',L:'10000100001000010000100001000011111',M:'10001110111010110101100011000110001',N:'10001110011010110011100011000110001',O:'01110100011000110001100011000101110',P:'11110100011000111110100001000010000',Q:'01110100011000110001101011001001101',R:'11110100011000111110101001001010001',S:'01111100001000001110000010000111110',T:'11111001000010000100001000010000100',U:'10001100011000110001100011000101110',V:'10001100011000110001100010101000100',W:'10001100011000110101101011101110001',X:'10001100010101000100010101000110001',Y:'10001100010101000100001000010000100',Z:'11111000010001000100010001000011111',
};
function sign(text:string,s:number,u:number,y:number,width:number,yaw=mallYaw(s),color='#d8d4bc'){
 const q=mallPoint(s,u,y),a=yaw*Math.PI/180,unit=width/(text.length*6),v=(x:number,h:number,z=0):P=>[q[0]+x*Math.cos(a)+z*Math.sin(a),q[1]+h,q[2]-x*Math.sin(a)+z*Math.cos(a)];
 box(q,[width+.45,unit*9,.18],dark,10,yaw);
 for(let i=0;i<text.length;i++){const glyph=FONT[text[i]];if(!glyph)continue;for(let k=0;k<35;k++)if(glyph[k]==='1'){
  const x=(i*6+k%5)*unit-width/2,h=(3-Math.floor(k/5))*unit;
  face([v(x,h,.1),v(x+unit*.85,h,.1),v(x+unit*.85,h+unit*.85,.1),v(x,h+unit*.85,.1)],color,10,color);
 }}
}

// The continuous lower route is split only at semantic landmarks. The floor
// remains watertight across every section and follows the same sampled plan.
for (let i=0;i<MALL_KNOTS.length-1;i++) {
 const a=MALL_KNOTS[i].s,b=MALL_KNOTS[i+1].s;
 if(a<=MALL_POOL.start&&b>=MALL_POOL.end){
  // The blue courtyard feature is a recessed pool. Keep a real opening in
  // the surrounding floor so the basin can support the board below Y=0.
  ribbon('Continuous mall floor',a,MALL_POOL.start,s=>-plan(s).width/2,s=>plan(s).width/2,mallHeight,1,stone);
  ribbon('Courtyard pool left aisle',MALL_POOL.start,MALL_POOL.end,s=>-plan(s).width/2,-MALL_POOL.halfWidth,mallHeight,7,stone);
  ribbon('Courtyard pool right aisle',MALL_POOL.start,MALL_POOL.end,MALL_POOL.halfWidth,s=>plan(s).width/2,mallHeight,7,stone);
  ribbon('Continuous mall floor',MALL_POOL.end,b,s=>-plan(s).width/2,s=>plan(s).width/2,mallHeight,1,stone);
 }else ribbon('Continuous mall floor',a,b,s=>-plan(s).width/2,s=>plan(s).width/2,mallHeight,1,stone);
}
// Containment follows the visible wall; the wall itself has thickness and no
// auto-grind edges. Low retail windows allow the chase camera to see turns.
const boundary=(side:number,s:number)=>side*plan(s).width/2-(side<0?
 Math.max(0,13-plan(s).width/2)*ease(92,100,s)*(1-ease(123,130,s))
 +9*ease(124,133,s)*(1-ease(153,163,s)):0);
const roofHeight=(s:number)=>mix(28.2,mallHeight(s)+10.2,ease(188,218,s))+15.8*(1-ease(32,42,s));
for(const side of [-1,1]){
 for(const [a,b,rise]of [[0,319,16.8],[319,374,5.8],[374,410,9],[410,438,11],[438,MALL_LENGTH,4.8]]){
  const n=Math.ceil((b-a)/2),points:Array<[number,number,number,number]>=[];
  for(let i=0;i<=n;i++){const q=mallPoint(mix(a,b,i/n),boundary(side,mix(a,b,i/n))+side*.25);points.push([q[0],q[2],0,q[1]]);}
  add({t:'wallpath',p:[0,0,0],pts:points,w:.55,rise,color:'#696b69',tex:'metal',edgeGrinding:false,grp:9,nm:a===319?'Courtyard low facade':'Continuous mall perimeter'});
 }
 // The atrium floor drops below the gallery. Close the strip between its
 // wall top and the shared roof rather than leaving daylight at that join.
 const vertices:number[]=[],indices:number[]=[];
 for(let s=0;s<318;s+=1){
  const top0=roofHeight(s)+.15,top1=roofHeight(s+1)+.15;
  const low0=Math.min(top0,mallHeight(s)+16.75),low1=Math.min(top1,mallHeight(s+1)+16.75);
  if(top0-low0<.001&&top1-low1<.001)continue;
  const at=vertices.length/3;
  vertices.push(...mallPoint(s,boundary(side,s)+side*.25,low0),...mallPoint(s+1,boundary(side,s+1)+side*.25,low1),
   ...mallPoint(s+1,boundary(side,s+1)+side*.25,top1),...mallPoint(s,boundary(side,s)+side*.25,top0));
  indices.push(at,at+1,at+2,at,at+2,at+3);
 }
 add({t:'mesh',p:[0,0,0],vertices,indices,color:'#696b69',tex:'solid',solid:true,doubleSided:true,edgeGrinding:false,grp:9,nm:'Atrium wall to ceiling closure'});
 // Cornice and black kickboards form unbroken outlines through both bends.
 for(const [h,w,color]of [[.16,.12,dark],[4.8,.18,trim],[8.5,.2,dark]] as [number,number,string][])
  for(const [a,b]of h>5?[[0,319],[374,438]]:[[0,438]])
   ribbon('Perimeter trim',a,b,s=>boundary(side,s)-w,s=>boundary(side,s)+w,s=>mallHeight(s)+h,9,color,false,'solid');
 // The open court has a low window band and a continuous concrete cornice.
 ribbon('Courtyard cornice',319,374,s=>boundary(side,s)-.28,s=>boundary(side,s)+.45,()=>5.8,9,stone,false,'solid');
 for(let s=330;s<374;s+=4){
  const u=boundary(side,s)-side*.08;
  box(mallPoint(s,u,4.45),[3.7,1.5,.08],'#758e91',10,90);
  box(mallPoint(s,u,4.45),[.09,1.55,.12],dark,10,90);
 }
}
// Enclosure and transom lights. The plaza (319..374) is open to the sky.
for(const [a,b]of [[0,106],[106,212],[212,318]])ribbon('Continuous mall ceiling',a,b,
 s=>boundary(-1,s)-.55,s=>boundary(1,s)+.55,s=>roofHeight(s)+.15,11,'#343e42',false,'solid',s=>roofHeight(s)-.15);
for(let s=5;s<318;s+=8){
 // The entry, raised fountain gallery and light well share a high ceiling.
 // Following each lower floor here clips the chase camera above the gallery.
 const q=plan(s),yaw=mallYaw(s),h=roofHeight(s);
 const extra=-boundary(-1,s)-q.width/2;
 box(mallPoint(s,-extra/2,h-.24),[q.width+extra,.28,.22],'#9a9b8e',11,yaw);
 for(const u of [-q.width*.29,q.width*.29])box(mallPoint(s,u,h-.3),[1.1,.08,3.5],'#e2e3cb',11,yaw);
}
box([0,44,11.8],[9.6,.3,6],'#343e42',11);
box([0,31,14.5],[9,26,.5],dark,9,0,true,'Entry back wall');
box([0,17.75,12.1],[9,.5,4.2],stone,1,0,true,'Entry quarter pipe apron');
for(const x of [-4.5,4.5])box([x,31,12.2],[.5,26,4.6],dark,9,0,true,'Entry quarter pipe side wall');
box(mallPoint(MALL_LENGTH,0,-7.6),[11.4,4.8,.5],dark,9,0,true,'Parking back wall');
for(let s=46;s<309;s+=11){
 if(s>99&&s<119||s>195&&s<219||s>258&&s<277)continue;
 for(const side of [-1,1]){
  const u=boundary(side,s)-side*.05,y=mallHeight(s),yaw=mallYaw(s)+90;
  if(side<0&&s>122&&s<166)continue;
  box(mallPoint(s,u,y+2.5),[9,4.8,.12],s%3?'#465c61':'#3c444c',10,yaw);
  for(const d of [-4.5,0,4.5])box(mallPoint(s+d,u,y+2.5),[.14,5,.2],brass,10,yaw);
  sign(['RECORDS','SPORTS','BOUTIQUE','CAFE','ARCADE'][Math.floor(s/11)%5],s,u,y+5.65,7,yaw);
 }
}
sign('NEW YORK MALL',33,0,17.7,8);sign('PARKING',MALL_EXIT.doors,0,-5.9,4.8);

// The original entrance folds back twice inside one narrow enclosure. Its
// raised starting lane descends to the gold quarter, the left return lane
// drops to the blue quarter, and the final lane passes beneath the start.
// Keep these storeys separate: a single downhill ramp skips both turns.
export const MALL_ENTRY = { startS:5, startU:2.2, upperToeS:28, lowerToeS:1 };
const entryGrade=(s:number,a:number,b:number)=>{
 const t=clamp((s-a)/(b-a)),e=.09;
 return t<e?t*t/(2*e*(1-e)):t>1-e?1-(1-t)*(1-t)/(2*e*(1-e)):(t-e/2)/(1-e);
};
export const mallEntryUpperHeight=(s:number)=>30-6*entryGrade(s,6,25);
export const mallEntryReturnHeight=(s:number)=>18+6*entryGrade(s,3,25);
ribbon('Entry upper starting ramp',2,28,0,4.22,mallEntryUpperHeight,1,'#8c9b9b',true,'pavement',s=>mallEntryUpperHeight(s)-.5,.35);
ribbon('Entry middle return ramp',1,28,-4.22,0,mallEntryReturnHeight,1,'#b9a976',true,'pavement',s=>mallEntryReturnHeight(s)-.5,.35);
// The wedge between lanes is solid; its exposed side cannot be crossed
// from below. Its two tops and the final floor remain independent surfaces.
for(let s=2;s<26;s+=.5){
 const top=Math.min(mallEntryUpperHeight(s),mallEntryUpperHeight(s+.5))-.3;
 const base=Math.max(mallEntryReturnHeight(s),mallEntryReturnHeight(s+.5))-.45;
 if(top>base)box(mallPoint(s+.25,.05,(base+top)/2),[.1,top-base,.51],dark,1,0,true,'Entry separating wedge');
}
add({t:'vertramp',p:mallPoint(28,0,24),vkind:'quarter',yaw:90,len:8.44,w:0,rise:3.2,arc:85,arcSteps:24,deck:.65,tex:'pavement',color:'#b9a976',rails:true,grp:1,nm:'Entry gold quarter pipe'});
box(mallPoint(32.2,0,34),[9,20,.5],dark,9,0,true,'Entry gold quarter back wall');
// The visible ceiling-closure meshes do not provide horizontal wall contact.
// Native solid walls must also contain the taller charged quarter-pipe airs.
for(const x of [-4.75,4.75])add({t:'wall',p:[x,12,-6],s:[.55,32,33],invisible:true,
 edgeGrinding:false,grp:1,nm:'Entry tall side wall core'});
// The glass marks the doorway at the bottom of the third lane. Decorative
// panes preserve the source's break-through route without adding a new system.
const entryDoors=[mallPoint(31.7,-4.3,12),mallPoint(31.7,4.3,12),mallPoint(31.7,4.3,17),mallPoint(31.7,-4.3,17)];
add({t:'mesh',p:[0,0,0],vertices:entryDoors.flat(),indices:[0,1,2,0,2,3],tex:'solid',color:'#91a8a3',opacity:.16,solid:false,doubleSided:true,edgeGrinding:false,castShadow:false,grp:1,nm:'Entry glass doors'});
for(const u of [-4.3,-1.43,1.43,4.3])box(mallPoint(31.7,u,14.5),[.12,5,.12],dark,1);
for(const u of [-2.85,0,2.85])sign('CLOSED',31.65,u,14.8,1.8);

// Final descent: a recessed ramp and two staircase shoulders.
function treads(a:number,b:number,left:number,right:number,count:number,grp:number){
 for(let i=0;i<count;i++){
  const s=mix(a,b,(i+.5)/count),q=mallPoint(s,(left+right)/2,mallHeight(s)-.06);
  // Visual nosings sit just below the smooth skate collision envelope.
  box(q,[right-left,.12,(b-a)/count*.45],'#777d79',grp,mallYaw(s));
 }
}
treads(14,30,-4.5,-2.1,16,1);treads(14,30,2.1,4.5,16,1);
for(const u of [-2.1,2.1])railAlong('Entry descending handrail',12,33,u,s=>mallHeight(s)+.85,1);

// Paired escalators climb to the fountain's upper concourse; the floor at
// either side remains a broad bypass, as in the source.
const upperY=(s:number)=>12+5*clamp((s-38)/12);
ribbon('Up escalator',38,50,-3.4,.6,upperY,2,'#7d8c8d',true,'pavement',s=>mallHeight(s)-.12);
for(const u of [-3.45,.65])railAlong('Upper escalator handrail',38,50,u,s=>upperY(s)+.85,2);
for(let s=39;s<50;s+=.65)box(mallPoint(s,-1.4,upperY(s)-.04),[4,.08,.18],'#3e5356',2,mallYaw(s));
// Original entry footage shows a shallow, chamfered water trough against
// the right-hand masonry of the first escalator, below the concourse.
{
 const outline:Array<[number,number]>=[[38,.65],[38,2.6],[39.2,3.55],[48.8,3.55],[50,.65]];
 const centre=mallPoint(44,2.1,12.3),points=outline.map(([s,u])=>mallPoint(s,u,12.6));
 const polygon=points.map(q=>[q[0]-centre[0],q[2]-centre[2]] as [number,number]);
 add({t:'platform',p:centre,s:[3,.6,12],pts:polygon,tex:'stone',color:'#917d67',edgeGrinding:false,grp:2,nm:'Entrance water trough'});
 const water:Array<[number,number]>=[[38.23,.88],[38.23,2.5],[39.3,3.3],[48.65,3.3],[49.64,.88]];
 face(water.map(([s,u])=>mallPoint(s,u,12.615)),'#426d71',2);
 add({t:'wallpath',p:[centre[0],12,centre[2]],pts:polygon,w:.25,rise:.34,
  invisible:true,edgeGrinding:false,grp:2,nm:'Entrance trough masonry'});
 const rim=mallPoint(38,.65,12.65);
 add({t:'rail',p:rim,pts:points.map((q,i)=>[q[0]-rim[0],q[2]-rim[2],i>0&&i<points.length-1?.4:0,0]),
  invisible:true,grp:2,nm:'Entrance water trough rim'});
}
ribbon('Upper fountain concourse',50,64,-6.5,6.5,()=>17,2,'#c6c1b0',true,'pavement',()=>16.35);
for(const [left,right]of [[-6.5,-3.8],[2.7,6.5]])
 ribbon('Concourse side deck',64,69,left,right,()=>17,2,'#c6c1b0',true,'pavement',()=>16.35);
for(const u of [-6.35,6.35])box(mallPoint(50.7,u,14.175),[.3,4.35,.55],dark,2,0,true,'First concourse support');
// The source island has a long, low bench with straight sides and rounded
// ends, behind the directory. Its closed rim is a grindable stone edge.
export const MALL_BENCH={s:61.5,u:0,halfStraight:2,radius:1.2,height:.5};
const bench=mallPoint(MALL_BENCH.s,MALL_BENCH.u,17);
const benchRing=(radius:number):Array<[number,number]>=>{
 const points:Array<[number,number]>=[];
 for(const side of [1,-1])for(let i=0;i<=32;i++){
  const a=-Math.PI/2+i*Math.PI/32+(side<0?Math.PI:0);
  points.push([side*MALL_BENCH.halfStraight+Math.cos(a)*radius,Math.sin(a)*radius]);
 }
 return points;
};
const benchOuter=benchRing(MALL_BENCH.radius),benchInner=benchRing(MALL_BENCH.radius-.16);
add({t:'platform',p:[bench[0],17.25,bench[2]],s:[6.4,.5,2.4],pts:benchOuter,
 color:'#65574d',tex:'stone',edgeGrinding:false,grp:2,nm:'Oval concourse bench'});
add({t:'rail',p:[bench[0],17.52,bench[2]],pts:benchOuter,closed:true,invisible:true,
 grp:2,nm:'Oval bench rim'});
for(let i=0;i<benchOuter.length;i++){
 const j=(i+1)%benchOuter.length,a=benchOuter[i],b=benchOuter[j],c=benchInner[i],d=benchInner[j],q=bench;
 face([[q[0]+a[0],17.515,q[2]+a[1]],[q[0]+b[0],17.515,q[2]+b[1]],
  [q[0]+d[0],17.515,q[2]+d[1]],[q[0]+c[0],17.515,q[2]+c[1]]],'#b8b9b0',2);
 face([[q[0],17.505,q[2]],[q[0]+c[0],17.505,q[2]+c[1]],
  [q[0]+d[0],17.505,q[2]+d[1]]],'#606573',2);
}
// The two short outward-facing poles link the high island to the Coffee
// Grind on the left and the row of three planter rims on the right.
for(const side of [-1,1])rail(side<0?'Rail Combo to Coffee':'Rail Combo to Planters',
 [mallPoint(63,side*5.65,17.85),mallPoint(69,side*7,17.85)],2);
// Main fountain: the original monument has a hexagonal water passage
// through its centre, aligned with the two raised fountain jumps. The
// aperture is a rideable intermediate landing, not a decorative solid pole.
const fountain=mallPoint(76,0,12);
add({t:'platform',p:[fountain[0],12.22,fountain[2]],s:[9,.44,13],pts:[[-4,-5],[-2,-6.5],[2,-6.5],[4,-5],[4,5],[2,6.5],[-2,6.5],[-4,5]],color:trim,tex:'solid',edgeGrinding:false,grp:2,nm:'Fountain octagonal basin'});
box(mallPoint(76,0,12.47),[6.9,.05,10.5],'#428e99',2);
{
 const a=73.2,b=78.8,base=12.45,deck=15.2,capBottom=20.3,bevelY=19.5,stoneColor='#89937d';
 ribbon('Fountain passage floor',a,b,-1.2,1.2,()=>deck,2,'#6b9ca0',true,'solid',()=>base);
 // Solid uprights surround an open central channel. Their sloping inner
 // skirts widen the middle of the aperture while retaining its flat bed.
 for(const side of [-1,1]){
  box(mallPoint(76,side*2.05,(base+capBottom+.1)/2),[.8,capBottom+.1-base,b-a],stoneColor,2,0,true,'Fountain monument upright');
  const profile=[[1.2,base],[1.2,deck],[1.65,16.1],[1.65,bevelY],[.95,capBottom]];
  for(const s of [a,b])for(let i=1;i<profile.length;i++){
   const [u0,y0]=profile[i-1],[u1,y1]=profile[i];
   face([mallPoint(s,side*u0,y0),mallPoint(s,side*u1,y1),
    mallPoint(s,side*2.45,y1),mallPoint(s,side*2.45,y0)],stoneColor,2);
  }
  const vertices=[mallPoint(a,side*1.2,deck),mallPoint(b,side*1.2,deck),
   mallPoint(b,side*1.65,16.1),mallPoint(a,side*1.65,16.1)];
  add({t:'mesh',p:[0,0,0],vertices:vertices.flat(),indices:[0,1,2,0,2,3],
   color:'#7b9b92',tex:'solid',solid:true,doubleSided:true,edgeGrinding:false,grp:2,nm:'Fountain passage bevel'});
  face([mallPoint(a,side*1.65,bevelY),mallPoint(b,side*1.65,bevelY),
   mallPoint(b,side*.95,capBottom),mallPoint(a,side*.95,capBottom)],'#69765e',2);
 }
 // The fast airborne pose is taller than the grounded/crouched pose.
 box(mallPoint(76,0,capBottom+.9),[5.8,1.8,b-a+.3],'#918060',2,0,true,'Fountain monument cap');
 // Falling sheets on the outer sides remain scenery; the water-coloured
 // passage itself uses ordinary dry support so traversal keeps its momentum.
 for(const side of [-1,1])face([mallPoint(a+.65,side*2.46,bevelY),mallPoint(b-.65,side*2.46,bevelY),
  mallPoint(b-.4,side*2.46,12.5),mallPoint(a+.4,side*2.46,12.5)],'#6da4b3',2);
}
for(const u of [-4.8,4.8])sign('SALE',76,u,15.0,2.8);
// Fountain-gap launch and the car-display bank on the opposite side.
const fountainLaunchY=(s:number)=>{
 if(s>=66.5)return 15.4-.2*(s-66.5);
 const t=clamp((s-64)/2.5);
 return mix(17,15.4,t*t*(3-2*t))+.5*t*t*(1-t);
};
ribbon('Fountain upper launch',64,69,-3.8,2.7,fountainLaunchY,3,trim,true,'pavement',()=>11.88,.15);
// The opposite island receives the fountain jump on its sloping face;
// the directory sits on the flat upper deck behind that bank.
const fountainLandingY=(s:number)=>mix(15.15,17,ease(86.5,93,s));
ribbon('Fountain landing bank',83,93,-4.5,3.5,fountainLandingY,3,trim,true,'pavement',()=>11.88,.2);
ribbon('Fountain upper landing',93,100,-4.5,3.5,()=>17,3,'#c2baa4',true,'pavement',()=>16.35);
ribbon('Upper landing gallery',100,123,-8.8,s=>s<112?3.5:mix(3.5,5,clamp((s-112)/5)),()=>17,3,'#c2baa4',true,'pavement',()=>16.35);
// Masonry abutments leave the 16-stair aisle open beneath the upper gallery.
for(const u of [-8.2,3.0]){
 const base=mallHeight(101)-.1;
 box(mallPoint(101,u,(base+16.35)/2),[1,16.35-base,1.2],'#8b7768',3,0,true,'Gallery masonry support');
}
// The second escalator is a separate left approach. It climbs beside the
// second fountain island and joins the Flying Leap deck above the 16 stairs.
const secondEscY=(s:number)=>mix(12,17,ease(94,117,s));
ribbon('Second up escalator',94,117,-12.4,-8.4,secondEscY,3,'#7d8c8d',true,'pavement',s=>mallHeight(s)-.12);
ribbon('Second escalator landing',117,123,-12.4,-8.4,()=>17,3,'#c2baa4',true,'pavement',()=>16.35);
for(const u of [-12.45,-8.35])railAlong('Second escalator handrail',94,118,u,s=>secondEscY(s)+.85,3);
for(let s=95;s<117;s+=.65)box(mallPoint(s,-10.4,secondEscY(s)-.04),[4,.08,.18],'#3e5356',3,mallYaw(s));
ribbon('Car route upper access bank',96,123,5.3,10.1,s=>mix(12,17,ease(96,119,s)),3,trim,true,'pavement',s=>Math.max(mallHeight(s)-.12,mix(12,17,ease(96,119,s))-.65));
ribbon('Car display kicker',81,88,6,10,s=>12+1.8*clamp((s-81)/7),2,trim,true,'pavement',()=>11.88);
box(mallPoint(91,8,13.0),[3.4,1.5,6.4],'#b9c1ba',2,0,true,'Car display');
box(mallPoint(91,8,14.05),[2.5,.65,3.2],'#52737b',2);
// Long kinked coffee grind occupies the left-hand lower aisle.
railAlong('Coffee Grind',56,103,s=>s<68?-11.4: s<83?mix(-11.4,-9.8,(s-68)/15):mix(-9.8,-6.2,(s-83)/20),s=>mallHeight(s)+.85,2);
for(const s of [65,78,91]){
 planter(s,11.3,1.6,9,12,2);
 railAlong('Planter Gap rim',s-4.5,s+4.5,10.55,()=>12.82,2,false);
}
sign('COFFEE',69,-12.6,16.1,6,90);
treads(101,115,-7,7,16,3);
railAlong('Sixteen stair centre rail',100,117,0,s=>mallHeight(s)+.82,3);
// Flying Leap departure and stacked, suspended rails. Their long lower
// line is catchable from the stairs, while the upper line needs the gallery.
ribbon('Flying Leap launch',123,130,-12.4,10.1,s=>17+1.1*clamp((s-123)/7),3,trim,true,'pavement',s=>16.35+1.1*clamp((s-123)/7));
railAlong('Flying Leap departure ledge',101,129,-7.8,s=>s<123?17.82:17.82+1.1*(s-123)/7,3,false);
// Original PS1 footage shows straight light beams. Keep them in a world
// frame rather than bending each beam around the corridor's walking route.
export function mallBeamPoint(t:number,offset=0,y=mix(16.6,13.1,t)):P {
 const a=mallPoint(139,-4.6),b=mallPoint(185,0),dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz);
 return [mix(a[0],b[0],t)-dz/n*offset,y,mix(a[2],b[2],t)+dx/n*offset];
}
function lightHousing(a:P,b:P) {
 const dx=b[0]-a[0],dz=b[2]-a[2],n=Math.hypot(dx,dz),nx=-dz/n*.28,nz=dx/n*.28;
 const p=(q:P,side:number,drop=0):P=>[q[0]+nx*side,q[1]-drop,q[2]+nz*side];
 face([p(a,-1),p(b,-1),p(b,1),p(a,1)],'#d5d6c2',4);
 for(const side of [-1,1])face([p(a,side),p(b,side),p(b,side,.28),p(a,side,.28)],'#aeb8ae',4);
 face([p(a,-1,.28),p(b,-1,.28),p(b,1,.28),p(a,1,.28)],'#e3ead7',4,'#a2b0a2');
}
for(const u of [-1.3,1.3])rail('Suspended upper light rail',[mallBeamPoint(0,u),mallBeamPoint(1,u)],4);
for(const u of [-1.3,1.3])rail('Suspended lower light rail',[mallBeamPoint(-.08,u,9.25),mallBeamPoint(.94,u,9.25)],4);
for(const u of [-1.3,1.3]){
 lightHousing(mallBeamPoint(0,u),mallBeamPoint(1,u));
 lightHousing(mallBeamPoint(-.08,u,9.25),mallBeamPoint(.94,u,9.25));
}
for(const t of [.08,.42,.77])for(const u of [-1.3,1.3]){
 const q=mallBeamPoint(t,u),top=28.05;box([q[0],(q[1]+top)/2,q[2]],[.07,top-q[1],.07],dark,4);
}
// The water channel and its low grinding rims share the beams' straight axis.
const channel=[mallBeamPoint(-.08,-3.1,8.035),mallBeamPoint(.94,-3.1,8.035),mallBeamPoint(.94,3.1,8.035),mallBeamPoint(-.08,3.1,8.035)];
add({t:'mesh',p:[0,0,0],vertices:channel.flat(),indices:[0,1,2,0,2,3],color:'#43888c',tex:'solid',solid:false,doubleSided:true,edgeGrinding:false,grp:4,nm:'Atrium blue fountain'});
for(const u of [-3.45,3.45])rail('Atrium fountain ledge',[mallBeamPoint(-.08,u,8.45),mallBeamPoint(.94,u,8.45)],4);
planter(164,6.4,2.6,5,8,4);planter(177,3.5,2.6,5,8,4);
// Elevator recess is the only deep side bay, with a genuine quarter pipe
// at each end and a clear flat route between the two.
ribbon('Elevator side bay',124,163,s=>boundary(-1,s),s=>-plan(s).width/2+.03,()=>8,4,'#9c9989');
for(const [s,yaw]of [[132,-90],[151,90]] as [number,number][]){
 add({t:'vertramp',p:mallPoint(s,-16,8),vkind:'quarter',yaw:mallYaw(s)+yaw,len:7,w:0,rise:3.0,arc:90,arcSteps:24,deck:1.2,rails:true,tex:'pavement',color:trim,grp:4,nm:'Elevator quarter pipe'});
}
// Lower escalator is broad, with two black moving-belt lines and a centre
// stair lane. The visible treads never become wheel-sized collision bumps.
treads(198,212,-8,8,18,5);
for(const u of [-8.2,-3,3,8.2])railAlong('Lower escalator handrail',195,216,u,s=>mallHeight(s)+.85,5);
planter(229,7.7,2.8,9,3.5,5);
// The reference's two diagonal rails are straight in world space. Their
// separated crossing heights keep each intended grind line unambiguous.
for(const [side,h,name]of [[-1,1.02,'Crossrail left to right'],[1,.72,'Crossrail right to left']] as [number,number,string][]){
 const a=mallPoint(268,side*6.5,mallHeight(268)+h),b=mallPoint(299,-side*6.5,h);
 const points=Array.from({length:17},(_,i)=>a.map((v,k)=>mix(v,b[k],i/16)) as P);
 rail(name,points,6,true,mallHeight,268,299);
}
for(const u of [-7.5,7.5])railAlong('Arcade side ledge',263,297,u,s=>mallHeight(s)+.48,6,false);
sign('GARDEN COURT',316,0,5.8,9);

// Original PS1 footage at 6:15–6:17 shows continuous curved wall bases
// behind the four planter areas. Their copings follow the widening court;
// the ledges leave a clear strip at the toe instead of covering the curve.
const outdoorLedgeHeight=(s:number)=>.3*ease(328,331,s)*(1-ease(370,373,s));
export const MALL_COURTYARD = { start:330, end:374, ledgeU:5.65, radius:2.6, arc:85, deck:.9,
 toe:(s:number)=>plan(s).width/2-3.65 };
for(const side of [-1,1]){
 const stations=Array.from({length:45},(_,i)=>330+i);
 if(side>0)stations.reverse();
 const p=mallPoint(stations[0],side*MALL_COURTYARD.toe(stations[0]),outdoorLedgeHeight(stations[0]));
 const pts=stations.map(s=>{const q=mallPoint(s,side*MALL_COURTYARD.toe(s),outdoorLedgeHeight(s));return[q[0]-p[0],q[2]-p[2],0,q[1]-p[1]] as [number,number,number,number];});
 add({t:'vertramp',p,pts,vkind:'quarter',w:0,rise:MALL_COURTYARD.radius,arc:MALL_COURTYARD.arc,
  arcSteps:24,deck:MALL_COURTYARD.deck,rails:true,tex:'pavement',color:'#b6ada1',grp:7,nm:`Courtyard ${side<0?'left':'right'} wall transition`});
}
// Grind the inside edge of each ledge, alongside the planters. Both ends
// taper to the floor, and the collision body closes the raised slab.
for(const side of [-1,1]){
 ribbon('Outdoor raised ledge',328,373,side<0?s=>-MALL_COURTYARD.toe(Math.max(330,s)):5.6,
  side<0?-5.6:s=>MALL_COURTYARD.toe(Math.max(330,s)),outdoorLedgeHeight,7,'#aaa58f',true,'pavement',()=>-.08);
 railAlong('Whole Atrium grind',328,373,side*MALL_COURTYARD.ledgeU,s=>outdoorLedgeHeight(s)+.08,7,false).coping=true;
 // Four broad, battered tree planters, as opposed to narrow hedge boxes.
 for(const s of [336,365]){
  const u=side*7.5,base=.3,top=1.35;
  const ring=(w:number,d:number,y:number):P[]=>[mallPoint(s-d/2,u-w/2,y),mallPoint(s-d/2,u+w/2,y),mallPoint(s+d/2,u+w/2,y),mallPoint(s+d/2,u-w/2,y)];
  const lower=ring(3.5,5.8,base),upper=ring(2.15,3.6,top),vertices:number[]=[],indices:number[]=[];
  const quad=(q:P[])=>{const k=vertices.length/3;vertices.push(...q.flat());indices.push(k,k+1,k+2,k,k+2,k+3);};
  quad(upper);
  for(let i=0;i<4;i++){const j=(i+1)%4;quad([lower[i],lower[j],upper[j],upper[i]]);}
  add({t:'mesh',p:[0,0,0],vertices,indices,color:'#b2a280',tex:'pavement',solid:true,vert:true,doubleSided:true,edgeGrinding:false,grp:7,nm:'Courtyard battered tree planter'});
  box(mallPoint(s,u,top+.01),[1.8,.035,3.25],'#454a32',7);
  box(mallPoint(s,u,top+1.45),[.22,2.9,.24],'#6d6550',7,0,true,'Courtyard tree trunk');
  // Sparse polygon leaves preserve the original billboard-tree silhouette.
  for(let i=0;i<42;i++){
   const a=i*2.399963,rad=.55+1.1*((i*13%29)/29),h=top+2.7+.9*Math.sin(i*1.7);
   const q=mallPoint(s+Math.sin(a)*rad,u+Math.cos(a)*rad,h),w=.35+.28*(i%3),v=.36;
   const dx=Math.cos(a)*w,dz=Math.sin(a)*w;
   face([[q[0]-dx,q[1]-v,q[2]-dz],[q[0]+dx,q[1]-.1,q[2]+dz],[q[0]+dx*.45,q[1]+v,q[2]+dz*.45],[q[0]-dx*.65,q[1]+v*.7,q[2]-dz*.65]],['#6d8050','#83935c','#536940'][i%3],7);
  }
 }
 const innerVertices:number[]=[],innerIndices:number[]=[];
 for(let i=0;i<=45;i++){
  const s=328+i;
  innerVertices.push(...mallPoint(s,side*(4.4+.8*ease(345,347,s)*(1-ease(354,356,s))),.3*ease(347,348.2,s)*(1-ease(352.8,354,s))),...mallPoint(s,side*5.6,outdoorLedgeHeight(s)));
  if(i<45){const j=i*2;innerIndices.push(...(side>0?[j,j+1,j+3,j,j+3,j+2]:[j,j+3,j+1,j,j+2,j+3]));}
 }
 add({t:'mesh',p:[0,0,0],vertices:innerVertices,indices:innerIndices,color:'#aaa58f',tex:'pavement',vert:true,solid:true,doubleSided:true,edgeGrinding:false,grp:7,nm:'Courtyard ledge inner bank'});
}
for(const s of [331,370])for(const side of [-1,1])rail('Atrium end return',[mallPoint(s,side*MALL_COURTYARD.ledgeU,.38),mallPoint(s,side*9.45,.38)],7).coping=true;
// Original footage at 6:12–6:13 resolves the blue centre as a pool between
// two elevated canopy roofs, with a tan launch wedge before it. It is not a
// raised blue halfpipe. The basin's shallow banks join the surrounding floor.
{
 const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 const ns=28,nu=42;
 for(let i=0;i<=ns;i++)for(let j=0;j<=nu;j++){
  const s=mix(MALL_POOL.start,MALL_POOL.end,i/ns),u=mix(-MALL_POOL.halfWidth,MALL_POOL.halfWidth,j/nu);
  const ends=ease(0,MALL_POOL.bevel,Math.min(s-MALL_POOL.start,MALL_POOL.end-s));
  const side=ease(0,1.4,MALL_POOL.halfWidth-Math.abs(u));
  vertices.push(...mallPoint(s,u,ends*(.3*(1-side)-MALL_POOL.depth*side)));uvs.push(u/2,s/2);
  if(i<ns&&j<nu){
   const a=i*(nu+1)+j,b=a+nu+1;indices.push(a,a+1,b+1,a,b+1,b);
  }
 }
 add({t:'mesh',p:[0,0,0],vertices,indices,uvs,color:'#4c9bb2',tex:'pavement',solid:true,edgeGrinding:false,grp:7,nm:'Courtyard blue pool'});
}
for(const [a,lip,b,name] of [[339,345.2,346.4,'Courtyard pool launch wedge'],[356,361.8,363,'Courtyard rear wedge']] as [number,number,number,string][]){
 const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 const ns=Math.ceil((b-a)/.2),nu=24;
 for(let i=0;i<=ns;i++)for(let j=0;j<=nu;j++){
  const s=mix(a,b,i/ns),u=mix(-4.2,4.2,j/nu);
  const longitudinal=s<=lip?1.15*clamp((s-a)/(lip-a)):1.15*(1-ease(lip,b,s));
  const y=longitudinal*(1-ease(3.1,4.2,Math.abs(u)));
  vertices.push(...mallPoint(s,u,y));uvs.push(u/3,s/3);
  if(i<ns&&j<nu){const k=i*(nu+1)+j,l=k+nu+1;indices.push(k,k+1,l+1,k,l+1,l);}
 }
 add({t:'mesh',p:[0,0,0],vertices,indices,uvs,color:'#b6a778',tex:'pavement',solid:true,edgeGrinding:false,grp:7,nm:name});
}
// One curved blue canopy on each side of the pool. The top, underside and
// thin perimeter are one closed mesh; four posts leave the central jump open.
for(const side of [-1,1]){
 const a=342,b=358,ns=32,nu=16,vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
 const point=(s:number,t:number,under=false):P=>{
  const end=Math.abs((s-350)/8),inner=4.9+.45*end*end,u=mix(inner,10.2,t);
  return mallPoint(s,side*u,3.55+1.2*t*t+.18*end*end-(under?.16:0));
 };
 const quad=(q:P[])=>{const k=vertices.length/3;vertices.push(...q.flat());uvs.push(0,0,1,0,1,1,0,1);indices.push(k,k+1,k+2,k,k+2,k+3);};
 for(const under of [false,true]){
  const base=vertices.length/3;
  for(let i=0;i<=ns;i++)for(let j=0;j<=nu;j++){
   const s=mix(a,b,i/ns),t=j/nu;vertices.push(...point(s,t,under));uvs.push(t*2,s/4);
   if(i<ns&&j<nu){const k=base+i*(nu+1)+j,l=k+nu+1;indices.push(...((side>0)!==under?[k,k+1,l+1,k,l+1,l]:[k,l+1,k+1,k,l,l+1]));}
  }
 }
 for(let i=0;i<ns;i++)for(const t of [0,1]){
  const s0=mix(a,b,i/ns),s1=mix(a,b,(i+1)/ns),q=[point(s0,t),point(s1,t),point(s1,t,true),point(s0,t,true)];
  quad((side>0)===(t===0)?q:q.reverse());
 }
 for(let j=0;j<nu;j++)for(const s of [a,b]){
  const t0=j/nu,t1=(j+1)/nu,q=[point(s,t0),point(s,t1),point(s,t1,true),point(s,t0,true)];
  quad((side>0)===(s===b)?q:q.reverse());
 }
 add({t:'mesh',p:[0,0,0],vertices,indices,uvs,color:'#5b97a5',tex:'pavement',solid:true,edgeGrinding:false,grp:7,nm:`Courtyard ${side<0?'left':'right'} blue canopy`});
 for(const t of [0,1])rail('Courtyard canopy edge',Array.from({length:33},(_,i)=>{const q=point(mix(a,b,i/32),t);q[1]+=.035;return q;}),7).coping=true;
 for(const s of [343,357]){
  const q=point(s,0),h=q[1]-.16;box([q[0],h/2,q[2]],[.18,h,.18],dark,7,0,true,'Courtyard canopy column');
 }
}
// The exit stairs descend through a banked throat under the raised passage.
// Both banks share the stair floor's sampled height, without a toe seam.
// The courtyard opens into a descending lower passage beneath a flat
// mezzanine. Its low side ledges precede the separate final stair chamber.
ribbon('Raised exit passage',MALL_EXIT.deckStart,MALL_EXIT.deckEnd,s=>-plan(s).width/2,s=>plan(s).width/2,
 ()=>MALL_EXIT.deckY,8,stone,true,'pavement',()=>MALL_EXIT.deckY-.2);
for(const side of [-1,1]){
 const ledgeY=(s:number)=>-3+.35*ease(388,390,s)*(1-ease(407,410,s));
 ribbon('Exit corridor side ledge',388,410,side<0?-5.7:4.35,side<0?-4.35:5.7,ledgeY,8,'#9b927e',true,'pavement',()=>-3.1);
 railAlong('Exit corridor ledge rim',388,410,side*4.4,s=>ledgeY(s)+.06,8,false).coping=true;
 for(let s=390;s<409;s+=6){
  box(mallPoint(s,side*5.65,-.7),[4,3.4,.1],'#465c61',10,90);
  for(let d=-1.8;d<2;d+=.45)box(mallPoint(s+d,side*5.6,-.7),[.07,3.5,.12],dark,10,90);
 }
 // The mezzanine is reached by an angled wall air from the courtyard.
 // There is no added approach ramp beneath its front edge in the source.
 railAlong('Step Off a Mezzanine lip',MALL_EXIT.deckStart,MALL_EXIT.deckEnd,side*5.4,()=>MALL_EXIT.deckY+.06,8,false).coping=true;
}
for(const [s,u]of [[393,-3.7],[400,3.5]])box(mallPoint(s,u,3.25),[1.4,.9,1.5],'#8f8164',8,0,true,'Mezzanine box');
treads(MALL_EXIT.stairStart,MALL_EXIT.stairEnd,-1.6,1.6,32,8);
for(const u of [-1.75,1.75])railAlong('Thirty-two stair handrail',412,434,u,s=>mallHeight(s)+.86,8).color='#45494a';
{
 const p=mallPoint(414),pts=Array.from({length:37},(_,i)=>{
  const q=mallPoint(414+i*.5);return [q[0]-p[0],q[2]-p[2],0,q[1]-p[1]] as [number,number,number,number];
 });
 add({t:'vertramp',p,pts,vkind:'half',w:3,rise:.65,arc:80,arcSteps:24,deck:.1,vert:false,tex:'pavement',color:'#8b9693',rails:false,grp:8,nm:'Exit stair wall fillets'});
}
// High ceiling over the mezzanine and stair flight, then a low parking room.
ribbon('Exit corridor ceiling',377,414,s=>-plan(s).width/2-.4,s=>plan(s).width/2+.4,()=>8,11,'#343e42',false,'solid',()=>7.7);
ribbon('Exit stair ceiling',414,438,-4.25,4.25,s=>mix(8,-5.2,ease(422,438,s)),11,'#343e42',false,'solid',s=>mix(8,-5.2,ease(422,438,s))-.3);
ribbon('Parking ceiling',438,MALL_LENGTH,-6,6,()=>-5.2,11,'#343e42',false,'solid',()=>-5.5);
for(let s=381;s<438;s+=7){const y=s<414?7.65:mix(8,-5.2,ease(422,438,s))-.35;box(mallPoint(s,0,y),[1.2,.08,2.8],'#e2e3cb',11);}
for(let s=444;s<464;s+=5.8)for(const side of [-1,1]){
 box(mallPoint(s,side*3.4,-7.75),[.26,4.5,.3],'#586467',8,0,true,'Parking support column');
 box(mallPoint(s,side*1.6,-5.56),[.65,.08,2.5],'#b6c3bd',11);
}
for(const side of [-1,1])box(mallPoint(MALL_EXIT.doors,side*3.5,-7.6),[.8,4.8,.5],'#727d7e',8,0,true,'Parking doorway jamb');
sign('EXIT',412,0,2.4,3.8);
add({t:'vertramp',p:[0,18,9],vkind:'quarter',yaw:-90,len:8,w:0,rise:3.2,arc:85,arcSteps:24,deck:.65,tex:'pavement',color:trim,rails:true,grp:1,nm:'Entry blue quarter pipe'});
for(const u of [-3.1,-1.03,1.03,3.1])box(mallPoint(MALL_EXIT.doors,u,-8.05),[.1,3.9,.18],'#8bacae',8);
box(mallPoint(MALL_EXIT.doors,0,-6.05),[6.3,.16,.2],'#8bacae',8);
const doors=[mallPoint(MALL_EXIT.doors,-3.1,-10),mallPoint(MALL_EXIT.doors,3.1,-10),mallPoint(MALL_EXIT.doors,3.1,-6.1),mallPoint(MALL_EXIT.doors,-3.1,-6.1)];
add({t:'mesh',p:[0,0,0],vertices:doors.flat(),indices:[0,1,2,0,2,3],tex:'solid',color:'#9fc2c4',opacity:.2,solid:false,doubleSided:true,edgeGrinding:false,castShadow:false,grp:8,nm:'Exit glass doors'});
add({t:'gate',p:mallPoint(MALL_EXIT.finish),yaw:0,w:5.8,invisible:true,grp:8,nm:'Mall parking exit'});
for(const side of [-1,1])box(mallPoint(MALL_EXIT.finish,side*3.05,-7.7),[.18,4.6,.22],'#8bacae',8);
box(mallPoint(MALL_EXIT.finish,0,-5.5),[6.3,.18,.22],'#8bacae',8);

export const MALL_CHECKPOINTS = [48,135,260,321,412].map((s,i)=>({s,p:mallPoint(s,[7.2,3.8,0,0,3][i])}));
for(const [i,c]of MALL_CHECKPOINTS.entries())add({t:'checkpoint',p:c.p,grp:Math.min(8,i*2+1),nm:`Mall checkpoint ${i+1}`});
// Ordered nodes keep checkpoints and route inspection in the same frame;
// native skatepark mode supplies rider-relative controls and its chase rig.
for(const p of [mallPoint(2,2.2,30),mallPoint(25,2.2,24),mallPoint(28,-2.2,24),mallPoint(3,-2.2,18)])add({t:'camnode',p,radius:3,grp:1,nm:'Folded entry route camera'});
for(const k of MALL_KNOTS)add({t:'camnode',p:mallPoint(k.s),radius:8,grp:9,nm:'Mall route camera'});
// A low, feathered follow shot looks through the aperture. The tall default
// park shot otherwise strikes its cap and collapses into the skater's head.
// The lower aisle is outside this volume; movement and vert tuning are intact.
add({t:'camnode',p:mallPoint(83.75,0,17.5),s:[8,9,28.5],yaw:0,radius:2,cameraView:true,
 cameraPosition:[0,.3,7],cameraTarget:[0,0,0],cameraFollowDistance:7,
 cameraFollowTargetHeight:1.25,cameraFov:49,grp:9,nm:'Fountain passage camera'});
// At the low part of a wall return, the default transverse camera arm runs
// into the canopy. Look along each side aisle until the rider clears it;
// the feather restores the usual vert view above the roofs and in mid-court.
for(const side of [-1,1])add({t:'camnode',p:mallPoint(350,side*10,2),s:[8,10,32],yaw:0,radius:2,cameraView:true,
 cameraPosition:[0,.4,7],cameraTarget:[0,0,0],cameraFollowDistance:7.5,
 cameraFollowTargetHeight:1.25,cameraFov:49,grp:9,nm:'Courtyard canopy return camera'});
// The low passage and parking roof need a low chase arm. This follows the
// player through both mezzanine routes without changing movement or camera tuning.
for(const [s,len]of [[393,44],[453,34]])add({t:'camnode',p:mallPoint(s,0,-2),s:[27,30,len],yaw:0,radius:2,cameraView:true,
 cameraPosition:[0,.5,7],cameraTarget:[0,0,0],cameraFollowDistance:7,
 cameraFollowTargetHeight:1.5,cameraFov:49,grp:9,nm:'Exit passage camera'});
// A shorter arm clears the rising stair floor without entering its ceiling.
add({t:'camnode',p:mallPoint(425,0,-2),s:[14,30,26],yaw:0,radius:2,cameraView:true,
 cameraPosition:[0,1.2,4.8],cameraTarget:[0,0,0],cameraFollowDistance:5,
 cameraFollowTargetHeight:1.5,cameraFov:49,grp:9,nm:'Exit stair camera'});
for(const [i,s]of [56,105,188,263,370].entries()){
 const u=i===4?0:i===1?-6.7:i===0?-1.4:5.8,y=i<=1?17:mallHeight(s);
 if(i===4){
  sign('DIRECTORY',s,u,y+2.25,4.5);
  box(mallPoint(s,0,y+1.65),[4.5,1.45,.15],'#496c6d',10);
  for(const x of [-2.1,2.1])box(mallPoint(s,x,y+1.15),[.18,2.3,.18],trim,10);
 }else{sign('DIRECTORY',s,u,y+1.9,1.9);box(mallPoint(s,u,y+.65),[.25,1.3,.25],dark,10);}
}
// Native collectibles mark the five letter locations and the hidden rail
// reward without adding a second scoring or input system.
for(const [s,u,y]of [[20,-2.1,mallHeight(20)+1.8],[78,9.3,13.4],[285,0,2.3],[MALL_POOL.rewardS,0,MALL_POOL.rewardY]])
 add({t:'wumpa',p:mallPoint(s,u,y),grp:10,nm:'Reference letter location'});
add({t:'wumpa',p:mallBeamPoint(.55,-1.3,10.5),grp:4,nm:'Lower beam letter location'});
add({t:'crystal',p:mallBeamPoint(.76,0,17.19),grp:4,nm:'Hidden tape line reward'});
add({t:'pit',p:[55,-14,-165],s:[200,1,440],invisible:true,grp:9,nm:'Below-mall recovery volume'});
for(const b of batches.values())add({t:'mesh',p:[0,0,0],vertices:b.vertices,indices:b.indices,color:b.color,emissive:b.emissive,tex:'solid',solid:false,doubleSided:true,edgeGrinding:false,castShadow:false,grp:b.grp,nm:'Batched mall architecture'});

export const MALL_LEVEL:CustomLevelData = {
 v:1,name:'Mall · New York',spawn:mallPoint(MALL_ENTRY.startS,MALL_ENTRY.startU,mallEntryUpperHeight(MALL_ENTRY.startS)+.12),killY:-16,startWarpPad:false,
 skatepark:true,sky:'day',keepPlayFog:true,jungleDepthFade:false,
 atmosphere:{fogEnabled:true,fogNear:50,fogFar:175,fogColor:'#b8c6ca',ambientSky:'#c8d4d0',ambientGround:'#858378',ambientIntensity:1.45,sunColor:'#f4ebcf',sunIntensity:1.1,fillColor:'#a9c5cd',fillIntensity:.55,shadowStrength:.25,backdrop:'fog',drawDistance:240},
 components:C,groups,
};
