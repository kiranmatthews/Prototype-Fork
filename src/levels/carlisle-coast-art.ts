import type { CustomComponent, CustomGroup } from '../level';
import { CARLISLE_ASSETS } from '../carlisleAssets';

type P=[number,number,number];
type Kind=keyof typeof CARLISLE_ASSETS;
const G={stone:90,garden:91,ruins:92,surface:93};
const round=(v:number)=>Math.round(v*10000)/10000;
const wave=(v:number)=>Math.sin(v*1.731)*.5+Math.sin(v*.613+2.1)*.5;
export const CARLISLE_ART_GROUPS:CustomGroup[]=[
 {id:G.stone,nm:'Ravine · sandstone and coastal rock'},
 {id:G.garden,nm:'Gardens · moss ferns and canopy'},
 {id:G.ruins,nm:'Temple · carved thresholds'},
 {id:G.surface,nm:'Surfaces · exact supported moss'},
];

/** Visuals follow the existing platforms, never infer or create support.
 * Every gap retains its complete footprint. All dressing is non-solid. */
export function buildCarlisleArt(course:readonly CustomComponent[]):CustomComponent[]{
 const out:CustomComponent[]=[];
 function prop(kind:Kind,p:P,width:number,name:string,yaw=0,group=G.stone,cutaway=false,tint='#ffffff'){
  const size=CARLISLE_ASSETS[kind].size,k=width/size[0];
  out.push({t:'decor',dkind:kind,p:p.map(round) as P,s:size.map(v=>round(v*k)) as P,
   yaw:round(yaw),color:tint,solid:false,cameraCutaway:cutaway||undefined,nm:name,grp:group});
 }
 function mesh(p:P,v:number[],ix:number[],uv:number[],name:string,tex:string,color:string,cutaway=false,group=G.surface){
  out.push({t:'mesh',p,vertices:v.map(round),indices:ix,uvs:uv.map(round),solid:false,
   edgeGrinding:false,castShadow:false,tex,color,nm:name,grp:group,cameraCutaway:cutaway||undefined,
   depthBias:tex==='coast-moss'?-1:undefined});
 }
 // Top overlays sit 3mm above actual support, wholly inside its footprint.
 // Long sides become broken deep stone pedestals rather than thin floating boxes.
 for(const c of course){
  if(c.t!=='platform'||!c.s||c.invisible)continue;
  const [width,height,length]=c.s,[x,y,z]=c.p,top=y+height/2;
  if(width<5||length<8||c.tex==='wood')continue;
  const rows=Math.max(2,Math.ceil(length/5)),v:number[]=[],uv:number[]=[],ix:number[]=[];
  for(let row=0;row<=rows;row++){
   const t=row/rows,dz=(t-.5)*length;
   const fringe=.05+.11*(.5+.5*wave(z+row));
   for(const side of [-1,1]){v.push(side*(width/2-fringe),0,dz);uv.push((x+side*width/2)/7,(z+dz)/7);}
  }
  for(let row=0;row<rows;row++){const a=row*2;ix.push(a,a+2,a+1,a+1,a+2,a+3);}
  mesh([x,round(top+.003),z],v,ix,uv,`Carlisle supported moss · ${c.nm}`,'coast-moss','#c0c7a0');
  for(const side of [-1,1]){
   const sv:number[]=[],su:number[]=[],si:number[]=[];
   for(let row=0;row<=rows;row++){
    const dz=(row/rows-.5)*length,notch=.14+.2*(.5+.5*wave(z+row*2));
    for(const band of [0,1,2]){
     const yy=band===0?top-.07:band===1?top-2.5:Math.max(-44,top-8-wave(z+row)*1.7);
     const xx=side*(width/2+(band===0?.018:band===1?notch:.4+notch));
     sv.push(xx,yy-top,dz);su.push((z+dz)/6,yy/6);
    }
   }
   for(let row=0;row<rows;row++)for(let band=0;band<2;band++){
    const a=row*3+band,b=a+1,d=a+3,e=d+1;
    if(side>0)si.push(a,d,b,b,d,e);else si.push(a,b,d,b,e,d);
   }
   mesh([x,round(top),z],sv,si,su,`Carlisle fractured shelf side · ${c.nm} · ${side}`,'coast-stone','#b6b19a');
  }
  // One fern rhythm per ledge; all roots remain outside the support rectangle.
  const crossLane=z<-1700&&z>-1740;
  for(let j=0;!crossLane&&j<Math.ceil(length/11);j++)for(const side of [-1,1]){
   const dz=-length/2+3+j*11;if(dz>length/2-2)continue;
   const at=z+dz,scale=2.4+.55*wave(at*2+side);
   prop(j%3===0?'coastfoliage':'coastcarpet',[x+side*(width/2+.5),top-.05,at],scale,
    `Carlisle ledge garden · ${c.nm} · ${j} · ${side}`,wave(at)*35,G.garden,false,side<0?'#b9d0aa':'#ced4ae');
  }
 }
 const profile:P[]=[[0,0,15],[0,0,-40],[0,-5,-80],[0,-5.5,-235],[0,-13,-275],
  [0,-13,-655],[0,-13.5,-945],[0,-22,-1013],[0,-22,-1245],
  [0,-13,-1395],[0,-13,-1555],[0,-19,-1565],[0,-19,-1690],
  [152,-16,-1730],[152,-26,-1800],[152,-26,-2320]];
 function floor(z:number){
  // The E crossing is dressed separately; the adjoining N legs keep their heights.
  for(let i=1;i<profile.length;i++)if(z<=profile[i-1][2]&&z>=profile[i][2]){
   const a=profile[i-1],b=profile[i],t=(z-a[2])/(b[2]-a[2]);return a[1]+(b[1]-a[1])*t;
  }return z>15?0:-26;
 }
 // Canyon bays alternate broad walls, natural Beachside formations and spires.
 // The entire row sits outside the widest 22m playable landings.
 function corridor(x:number,near:number,far:number){
  for(let z=near,i=0;z>=far;z-=13.2,i++)for(const side of [-1,1]){
   const f=floor(z),wide=z>-45||z<-1635&&z>-1700?18:13.5;
   const inset=wide+2.3*wave(z*.4+side),width=13.8+1.8*wave(z+side),height=23+3*wave(z*.5);
   const kind:Kind=i%7===4?'coastspire':'coastcliff';
   const spec=CARLISLE_ASSETS[kind].size;
   out.push({t:'decor',dkind:kind,p:[round(x+side*inset),round(f-6),round(z)],
    s:[round(width),round(kind==='coastcliff'?spec[1]*width/spec[0]:height),round(spec[2]*width/spec[0])],yaw:side<0?90:-90,
    color:i%3===0?'#d0c9b2':'#e5d8bc',solid:false,nm:`Carlisle canyon bay ${x} ${i} ${side}`,grp:G.stone});
   if(kind==='coastcliff')prop('coastcliff',[x+side*(inset+1.8),f+3.2,z+.8],width*1.12,
    `Carlisle upper canyon crown ${x} ${i} ${side}`,side<0?94:-86,G.stone,false,'#d8d1b7');
   if(i%3===0)prop('coastbeachrock',[x+side*(wide+.2),f-4.7,z+2],10+2*wave(z),
    `Carlisle Beachside rock ${x} ${i} ${side}`,side<0?84:-83,G.stone,false,'#bdbd9b');
   if(i%2===0){
    prop('coastfern',[x+side*(wide-3),f-.65,z+3],3.6+.6*wave(z),`Carlisle fern bank ${x} ${i} ${side}`,side*40,G.garden,false,'#a8c19a');
    prop('coastfoliage',[x+side*(wide-1),f+1,z-3],3.3,`Carlisle coral accent ${x} ${i} ${side}`,side*80,G.garden);
   }
   if(i%7===0){
    prop('coasttree',[x+side*(wide+12),f+8,z-4],25,`Carlisle outer canopy tree ${x} ${i} ${side}`,i*23,G.garden,false,'#b3c4a2');
    prop('coastcrown',[x+side*(wide+2),f+15,z+3],18,`Carlisle hanging crown ${x} ${i} ${side}`,i*31,G.garden,false,'#c2c8a2');
   }
   if(i%6===2)prop('coastpillar',[x+side*(wide-2.5),f-.8,z],3.6,
    `Carlisle eroded shrine ${x} ${i} ${side}`,side<0?70:-70,G.ruins);
  }
 }
 corridor(0,22,-1680);corridor(152,-1748,-2330);
 // Composed thresholds mark the authored changes in rhythm, without adding
 // travel zones or blocking the camera's line through the gateway.
 for(const [x,z,y] of [[0,-24,0],[0,-178,-5.5],[0,-410,-13],[0,-690,-13.5],
  [0,-924,-13.5],[0,-1132,-22],[0,-1398,-13],[0,-1648,-19],
  [152,-1847,-26],[152,-1990,-26],[152,-2188,-26],[152,-2308,-26]] as P[]){
  const supportWidth=Math.max(12,...course.filter(c=>c.t==='platform'&&c.s&&c.p[0]===x&&Math.abs(c.p[2]-z)<=c.s[2]/2).map(c=>c.s![0]));
  // The measured aperture is 11.588m at18m mesh width. Columns must
  // stay beyond the complete playable pad, including its outer skating line.
  const archWidth=Math.max(22,(supportWidth+1)*18/11.588);
  prop('coastarch',[x,y-1,z],archWidth,`Carlisle temple threshold ${z}`,0,G.ruins);
  for(const side of [-1,1]){
   prop('coastpillar',[x+side*(supportWidth/2+2.5),y-.8,z+6],3,`Carlisle threshold guardian ${z} ${side}`,side*9,G.ruins);
   prop('coastshelf',[x+side*(supportWidth/2+4),y-4,z+2],7,`Carlisle moss ruin base ${z} ${side}`,side*30,G.stone);
  }
 }
 // E/W camera: rear wall is permanent, nearest row cuts away per batch.
 // Pillars deliberately leave the original lift and moving crossing clear.
 for(let x=7,i=0;x<157;x+=13.2,i++)for(const side of [-1,1]){
  const y=x<40?-19:x<120?-16:-16;
  const cutaway=side>0;
  prop('coastcliff',[x,y-7,-1720+side*17],14.8,`Carlisle E ravine bay ${i} ${side}`,side>0?180:0,G.stone,cutaway,'#d8d0b3');
  prop('coastcliff',[x,y+3,-1720+side*18],16.2,`Carlisle E upper canyon ${i} ${side}`,side>0?180:0,G.stone,cutaway,'#dad3b8');
  prop('coastbeachrock',[x+2,y-6,-1720+side*11],8.2,`Carlisle E coastal buttress ${i} ${side}`,i*13,G.stone,cutaway,'#c2c1a3');
  prop('coastfoliage',[x,y-.5,-1720+side*7.5],3.4,`Carlisle E lip garden ${i} ${side}`,i*23,G.garden,cutaway);
  if(i%3===0)prop('coastpillar',[x,y-1,-1732],3.5,`Carlisle E shrine relief ${i}`,0,G.ruins);
 }
 // Finish sanctuary has a readable framed gate and a closed scenic horizon.
 for(const side of [-1,1]){
  prop('coastspire',[152+side*22,-33,-2314],10,`Carlisle sanctuary pinnacle ${side}`,side*17,G.ruins);
  prop('coasttree',[152+side*30,-21,-2290],32,`Carlisle sanctuary canopy ${side}`,side*35,G.garden);
 }
 prop('coastcliff',[152,-32,-2343],28,'Carlisle sanctuary rear canyon',0,G.stone);
 return out;
}
