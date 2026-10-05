import type {CustomComponent, CustomGroup, CustomLevelData} from '../level';

type Point = [number, number, number];
const C:CustomComponent[]=[];
const groups:CustomGroup[]=[{id:1,nm:'Temple switchback ascent',editorOnly:true},{id:2,nm:'Ordered course cameras',editorOnly:true}];
const add=(c:CustomComponent)=>C.push(c);
const stone='#bcad85',moss='#779a72',gold='#efb74d',turquoise='#43bdc5';
const base=150,stepRise=1.8;
export const SLIPSTREAM_2_TEMPLE: {p:Point; moving:boolean; row:number}[]=[];
function pad(p:Point,w:number,d:number,name:string,color=stone) {
  add({t:'platform',p:[p[0],p[1]-.65,p[2]],s:[w,1.3,d],tex:'stone',color,edgeGrinding:false,grp:1,nm:name});
}
// Original temple architecture: three rising passes across one facade, with
// deliberate refuges between moving ledges. Nothing in this ascent needs a board.
const templePath:Point[]=[[16,base,0]];
pad(templePath[0],7,6,'Temple entry court');
add({t:'clock',p:[18,base,1],grp:1});
for(let row=0;row<3;row++) {
  const sign=row===1?1:-1,z=-row*9,startX=-sign*16,top=base+row*12.6;
  for(let i=0;i<6;i++) {
    const moving=i===1||i===4;
    const p:Point=[startX+sign*(4+i*4.8),top+(i+1)*stepRise,z-(moving?2:0)];
    if(moving)add({t:'mover',p,s:[3.2,.7,3.8],axis:'z',amp:3,speed:.85+row*.08,phase:i===1?0:Math.PI,tex:'stone',color:moss,edgeGrinding:false,grp:1,nm:`Tier ${row+1} · retracting stone ${i===1?1:2}`});
    else pad(p,i===2?4:3.2,3.8,`Tier ${row+1} · resting ledge ${i+1}`);
    SLIPSTREAM_2_TEMPLE.push({p,moving,row});templePath.push(p);
    if(moving) {
      add({t:'decor',dkind:'block',p:[p[0],p[1]-.15,z-2.92],s:[3.8,2.2,.1],tex:'solid',color:'#383e36',grp:1,nm:'Timed ledge wall recess'});
      for(let k=0;k<3;k++)add({t:'decor',dkind:'block',p:[p[0],p[1]-1.2-k*.3,z-2.7-k*.15],s:[3.8-k*.7,.3,1.1-k*.25],tex:'stone',color:stone,grp:1,nm:'Carved ledge corbel'});
    }
    add({t:'wumpa',p:[p[0],p[1]+1.1,p[2]],grp:1});
    if(!moving&&i===2)add({t:'crate',p:[p[0],p[1],p[2]-.9],kind:'wood',grp:1});
  }
  const end:Point=[sign*16,top+12.6,z];pad(end,7,6,`Tier ${row+1} · refuge`);templePath.push(end);
  add({t:'checkpoint',p:[end[0],end[1],end[2]+.8],grp:1,nm:`Temple terrace ${row+1}`});
  // A thin facade boundary pushes a rider off a fully retracting ledge. The
  // masonry behind it remains scenery; the shelves own their own support.
  add({t:'decor',dkind:'block',p:[0,top+2.6,z-5],s:[42,20,4],tex:'stone',color:row%2? '#a69472':'#c2af84',grp:1,nm:'Temple facade masonry'});
  add({t:'wall',p:[0,top-7.4,z-3.15],s:[42,20,.3],collisionHeight:19.8,invisible:true,tex:'stone',color:row%2?'#a69472':'#c2af84',edgeGrinding:false,grp:1,nm:'Temple facade · solid retracting-ledge boundary'});
  for(const dy of [-4,12])add({t:'decor',dkind:'block',p:[0,top+dy,z-4.5],s:[44,.6,5],tex:'stone',color:stone,grp:1,nm:'Projecting temple cornice'});
  for(let x=-18;x<=18;x+=6) {
    add({t:'decor',dkind:'block',p:[x,top+4,z-2.95],s:[.45,15,.5],tex:'stone',color:'#8d8669',grp:1,nm:'Facade carved pilaster'});
  }
  for(const x of [-21,21])add({t:'decor',dkind:'ruinblock',p:[x,top-4,z-3.5],s:[3,14,4],grp:1,nm:'Carved temple buttress'});
  for(const x of [-10,0,10])add({t:'decor',dkind:'vines',p:[x,top+13,z-3.2],w:2,rise:8,n:4,grp:1});
  if(row<2) {
    pad([end[0],end[1],z-4.5],7,12,'Temple corner balcony',moss);
    templePath.push([end[0],end[1],z-9]);
  }
}
const summit:Point=[-16,base+37.8,-29];
pad([-16,summit[1],-23],7,12,'Temple summit approach balcony',moss);
pad([-16,summit[1],-31],12,12,'Temple summit · mount the board',moss);templePath.push(summit);
add({t:'camnode',p:[0,base+18,-9],s:[52,65,35],cameraView:true,radius:2,
  cameraPosition:[0,base+20,32],cameraTarget:[0,base+18,-7],cameraFollowDistance:20,cameraFollowTargetHeight:2.2,cameraFov:58,cameraAspect:16/9,grp:2,nm:'Temple facade · side-on climbing view'});

export const SLIPSTREAM_2_END=2330;
export const SLIPSTREAM_2_GAP_SCALE=.9;
export const SLIPSTREAM_2_GAPS=[
  {a:150,b:172,name:'Sun Gate',width:22}, {a:337,b:363,name:'Cloud Split',width:26},
  {a:527,b:551,name:'Broken Aqueduct',width:24}, {a:717,b:747,name:'Sky Channel',width:30},
  {a:909,b:935,name:'Twin Spires I',width:26}, {a:1047,b:1071,name:'Twin Spires II',width:24},
  {a:1240,b:1270,name:'Monsoon Rift',width:30}, {a:1432,b:1460,name:'Turquoise Leap',width:28},
  {a:1622,b:1654,name:'Highwater',width:32}, {a:1814,b:1840,name:'Fallen Crown',width:26},
  {a:2004,b:2034,name:'Last Flight I',width:30}, {a:2158,b:2190,name:'Last Flight II',width:32},
];
// Horizontal arc length is the authoring coordinate. Near each leap the
// spine becomes a straight chord, keeping the whole airborne line readable.
const rawX=(s:number)=>-16+54*Math.sin(s*2*Math.PI/620)+16*Math.sin(s*2*Math.PI/1250);
const rawD=(s:number)=>54*2*Math.PI/620*Math.cos(s*2*Math.PI/620)+16*2*Math.PI/1250*Math.cos(s*2*Math.PI/1250);
const smooth=(t:number)=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const straightWindows=SLIPSTREAM_2_GAPS.map(g=>({a:g.a,b:g.b}));
function xAt(q:number) {
  let x=rawX(q);
  for(const g of straightWindows) {
    const m=(g.a+g.b)/2,dist=Math.abs(q-m),weight=1-smooth((dist-38)/28);
    x=x*(1-weight)+(rawX(m)+rawD(m)*(q-m))*weight;
  }
  return x;
}
const arc:{s:number;q:number}[]=[{s:0,q:0}];let accumulated=0;
for(let q=1;q<=SLIPSTREAM_2_END;q++) {accumulated+=Math.hypot(xAt(q)-xAt(q-1),1);arc.push({s:accumulated,q});}
const routeScale=SLIPSTREAM_2_END/accumulated;
// Re-map raw geometry to exactly the desired horizontal course length.
function qAt(s:number) {
  const target=Math.max(0,Math.min(SLIPSTREAM_2_END,s))*accumulated/SLIPSTREAM_2_END;
  let lo=0,hi=arc.length-1;while(hi-lo>1){const mid=(lo+hi)>>1;if(arc[mid].s<target)lo=mid;else hi=mid;}
  return arc[lo].q+(arc[hi].q-arc[lo].q)*(target-arc[lo].s)/(arc[hi].s-arc[lo].s||1);
}
// The bend map uses raw q, so the same gap stations must use raw q too.
for(const g of SLIPSTREAM_2_GAPS) {
  const a=arc[Math.round(g.a)].s*SLIPSTREAM_2_END/accumulated,b=arc[Math.round(g.b)].s*SLIPSTREAM_2_END/accumulated;
  g.a=a;g.width=Math.max(28,b-a)*SLIPSTREAM_2_GAP_SCALE;g.b=a+g.width;
}
// Larger flights receive a lower catch. The height budget belongs to the
// course: these discrete drops replace part of the gradual descent, keeping
// the sea-level finish while requiring a charged, moving board at every lip.
const approachDrop=14;
// Move the receiving decks closer while retaining their authored drop heights.
const flightDrop=(g:{width:number})=>Math.max(0,.15*(g.width/SLIPSTREAM_2_GAP_SCALE)-3);
const gradualDescent=(summit[1]-SLIPSTREAM_2_GAPS.reduce((sum,g)=>sum+approachDrop+flightDrop(g),0))/SLIPSTREAM_2_END;
export function slipstream2Height(s:number) {
  let y=summit[1]-gradualDescent*s;
  for(const g of SLIPSTREAM_2_GAPS) {
    // A permanent forty-metre descent earns the speed immediately before
    // the kicker. It never gives that height back in an uphill approach.
    if(s>=g.a-15)y-=approachDrop;
    else if(s>g.a-55)y-=approachDrop*(s-(g.a-55))/40;
    if(s>=g.b)y-=flightDrop(g);
    else if(s>g.a)y-=flightDrop(g)*(s-g.a)/(g.b-g.a);
    // Pop from the rising face before the gold-marked flat launch shelf.
    // Rolling to the shelf edge without releasing X removes the climb lift.
    if(s>g.a-15&&s<=g.a) {
      const t=Math.min(1,(s-(g.a-15))/9);
      y+=2.5*(t<.2?t*t/.36:(t-.1)/.9);
    }
    if(s>g.a&&s<g.b)y+=2.5*(1-(s-g.a)/(g.b-g.a));
  }
  return y;
}
export function slipstream2Point(s:number,u=0,lift=0):Point {
  s=Math.max(0,Math.min(SLIPSTREAM_2_END,s));const q=qAt(s),a=qAt(Math.max(0,s-.2)),b=qAt(Math.min(SLIPSTREAM_2_END,s+.2));
  const dx=xAt(b)-xAt(a),dz=-(b-a),n=Math.hypot(dx,dz)||1;
  return [-16+(xAt(q)+16)*routeScale-dz/n*u,slipstream2Height(s)+Math.sin(q*2*Math.PI/620)*.055*u+lift,-34-q*routeScale+dx/n*u];
}
export function slipstream2Progress(p:Point|{x:number;z:number}) {
  const z=Array.isArray(p)?p[2]:p.z,q=Math.max(0,Math.min(SLIPSTREAM_2_END,(-z-34)/routeScale)),i=Math.floor(q);
  return (arc[i].s+(arc[Math.min(i+1,arc.length-1)].s-arc[i].s)*(q-i))*SLIPSTREAM_2_END/accumulated;
}
export const SLIPSTREAM_2_CHECKPOINTS:{s:number;p:Point}[]=[];
const us=[-10,-9,-8,-7,-6,0,6,7,8,9,10],hs=[3.2,1.8,.8,.25,0,0,0,.25,.8,1.8,3.2];
function ribbon(a:number,b:number,grp:number) {
  const p=slipstream2Point(a),vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  const rows=Math.ceil((b-a)/2);
  for(let i=0;i<=rows;i++) {
    const s=a+(b-a)*i/rows;
    for(let j=0;j<us.length;j++) {const q=slipstream2Point(s,us[j],hs[j]);vertices.push(q[0]-p[0],q[1]-p[1],q[2]-p[2]);uvs.push(us[j]/4,s/4);}
    if(i)for(let j=0;j<us.length-1;j++){const q=(i-1)*us.length+j,n=q+us.length;indices.push(q,q+1,n,n,q+1,n+1);}
  }
  add({t:'mesh',p,vertices,indices,uvs,tex:'stone',color:turquoise,solid:true,vert:false,gravityTrack:true,edgeGrinding:false,grp,nm:'Banked sky aqueduct'});
  // Separate ornamental arches stop below the road: no collision under gaps.
  for(let s=a+32;s<b-12;s+=55) {
    const q=slipstream2Point(s);for(const side of [-1,1]) {
      const foot=slipstream2Point(s,side*9,-24);
      add({t:'decor',dkind:'ruinblock',p:foot,s:[2.8,24,2.8],grp,nm:'Aqueduct temple pier'});
    }
    add({t:'decor',dkind:'block',p:[q[0],q[1]-7,q[2]],s:[21,2,3],color:stone,grp,nm:'Aqueduct crossbeam'});
  }
}
let start=0;
for(let i=0;i<=SLIPSTREAM_2_GAPS.length;i++) {
  const gap=SLIPSTREAM_2_GAPS[i],end=gap?.a??SLIPSTREAM_2_END,grp=10+i;
  groups.push({id:grp,nm:gap?`${i+1} · ${gap.name} approach`:'13 · Ocean finish',editorOnly:true});ribbon(start,end,grp);
  const cpS=i===0?28:start+18,cpP=slipstream2Point(cpS);
  add({t:'checkpoint',p:cpP,grp,nm:gap?`Run-up to ${gap.name}`:'Final flight banked'});SLIPSTREAM_2_CHECKPOINTS.push({s:cpS,p:cpP});
  for(let s=start+32;s<end-28;s+=14)add({t:'wumpa',p:slipstream2Point(s,0,1),grp});
  for(let s=start+45;s<end-40;s+=42)for(const u of [-3.5,3.5])add({t:'crate',p:slipstream2Point(s,u),kind:'wood',grp});
  if(end-start>110)for(const side of [-1,1]) {
    const a=start+35,b=end-40,p=slipstream2Point(a,side*6.5,.65),pts:NonNullable<CustomComponent['pts']>=[];
    for(let s=a;s<=b;s+=5) {const q=slipstream2Point(s,side*6.5,.65);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);}
    const q=slipstream2Point(b,side*6.5,.65);pts.push([q[0]-p[0],q[2]-p[2],0,q[1]-p[1]]);
    add({t:'rail',p,pts,grp,nm:'Optional aqueduct coping grind'});
  }
  if(gap) {
    const p=slipstream2Point((gap.a+gap.b)/2,0,-17);
    add({t:'pit',p,s:[70,1,(gap.b-gap.a)+12],tex:'solid',color:'#167c91',grp,nm:`${gap.name} · lethal open water`});
    for(let s=gap.a-12;s<=gap.b+6;s+=4) {
      const t=Math.max(0,Math.min(1,(s-gap.a)/(gap.b-gap.a)));
      add({t:'wumpa',p:slipstream2Point(s,0,1+7*Math.sin(t*Math.PI)),grp,nm:'Flight guide'});
    }
    for(const u of [-5,5])add({t:'decor',dkind:'ruinblock',p:slipstream2Point(gap.a-8,u),s:[1.2,3.5,1.2],grp,nm:'Launch marker'});
    const stripe=slipstream2Point(gap.a-9,0,.035),stripeVertices:number[]=[];
    for(const [s,u] of [[gap.a-9,-5],[gap.a-9,5],[gap.a-7,-5],[gap.a-7,5]]) {
      const q=slipstream2Point(s,u,.035);stripeVertices.push(q[0]-stripe[0],q[1]-stripe[1],q[2]-stripe[2]);
    }
    add({t:'mesh',p:stripe,vertices:stripeVertices,indices:[0,1,2,2,1,3],tex:'solid',color:gold,solid:false,edgeGrinding:false,doubleSided:true,grp,nm:'Amber release stripe · let go of X here'});
    start=gap.b;
  }
}
// Keep ordinary route nodes separate from camera-view volumes and ordered.
for(const p of templePath)add({t:'camnode',p,grp:2});
for(let s=0;s<=SLIPSTREAM_2_END;s+=5)add({t:'camnode',p:slipstream2Point(s),grp:2});
add({t:'camnode',p:slipstream2Point(SLIPSTREAM_2_END),grp:2});
const finish=slipstream2Point(SLIPSTREAM_2_END-10),before=slipstream2Point(SLIPSTREAM_2_END-11);
add({t:'gate',p:finish,yaw:-Math.atan2(finish[0]-before[0],-(finish[2]-before[2]))*180/Math.PI,grp:22});
add({t:'crystal',p:slipstream2Point(1390,0,1.6),grp:17});

export const SLIPSTREAM_2_LEVEL:CustomLevelData={v:1,name:'Slipstream 2',spawn:[16,base+.08,0],killY:-45,
  sky:'day',cameraLookAhead:15,cameraAirLift:.25,allBalanceCrates:true,perfectGrindBoost:true,
  medalTimes:{gold:155,silver:200,bronze:270},
  atmosphere:{fogEnabled:true,fogNear:90,fogFar:330,fogColor:'#a8dfeb',ambientSky:'#bfe8f2',ambientGround:'#466f78',ambientIntensity:1.05,sunColor:'#fff2c8',sunIntensity:1.2,fillColor:'#dcefff',fillIntensity:.3,shadowStrength:.7,drawDistance:480,backdrop:'sky'},
  components:C,groups};
