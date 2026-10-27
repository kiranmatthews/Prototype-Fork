import type {CustomComponent, DecorKind} from '../level';
import {COASTAL_TOWN_ASSETS} from '../coastalTownAssets';
import {RALLY_SPONSORS} from '../rallySponsors';
import {MOTU_FLOODS} from '../motuLighting';

type P=[number,number,number];
export const MOTU_SUN:P=[.55,.74,-.39];
/** Local -Z faces the park; +Z climbs the same treads used by the crowd. */
export const MOTU_STANDS=[
  {p:[-86,7.3,-24] as P,yaw:-90,columns:30,rows:7},
  {p:[-86,7.3,-85] as P,yaw:-90,columns:30,rows:7},
  {p:[84,7.3,-118] as P,yaw:90,columns:26,rows:6},
  {p:[0,7.3,-182] as P,yaw:180,columns:36,rows:7},
  {p:[86,7.3,-33] as P,yaw:90,columns:28,rows:6},
  {p:[-36,7.3,66] as P,yaw:0,columns:30,rows:6},
  {p:[10,7.3,66] as P,yaw:0,columns:24,rows:6},
  {p:[-86,7.3,-145] as P,yaw:-90,columns:24,rows:5},
];
export function motuStandPoint(stand:typeof MOTU_STANDS[number],x:number,y:number,z:number):P {
  const a=stand.yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
  return [stand.p[0]+x*c+z*s,stand.p[1]+y,stand.p[2]-x*s+z*c];
}

const features:CustomComponent[]=[];
const bowl:NonNullable<CustomComponent['pts']>=[];
// A broad asymmetric pool, with 96 plan stations and 40 profile stations.
// The same uninterrupted surface owns the toe, coping, deck and outer bank.
for(let i=0;i<96;i++){
  const a=Math.PI*2*i/96,r=1+.16*Math.cos(a)+.09*Math.sin(2*a);
  bowl.push([Math.cos(a)*9*r,Math.sin(a)*14*r]);
}
features.push({t:'vertramp',nm:'Motu / lagoon kidney bowl',p:[-42,0,-134],pts:bowl,
  vkind:'quarter',closed:true,w:.35,rise:3.8,arc:82,arcSteps:40,deck:1.8,outerBank:5.5,
  color:'#9dc8c0',tex:'pavement'});
features.push({t:'mesh',nm:'Motu / lagoon ceramic floor',p:[-42,.012,-134],
  vertices:[0,0,0,...bowl.flatMap(p=>[p[0],0,p[1]])],
  indices:bowl.flatMap((_,i)=>[0,1+(i+1)%bowl.length,1+i]),
  solid:false,tex:'pavement',color:'#bce4df',castShadow:false});
features.push({t:'vertramp',nm:'Motu / competition halfpipe',p:[43,0,-125],len:42,
  vkind:'half',w:6.5,rise:4.4,arc:90,arcSteps:40,lipRise:.45,deck:2.2,outerBank:5,
  color:'#d2ad7f',tex:'plank'});
// A low street plaza and a genuinely rollable return bank, separate from the
// vert session. Clear flat lanes connect all three original street lines.
features.push({t:'platform',nm:'Motu / south street deck',p:[-22,.55,29],s:[28,1.1,12],tex:'pavement',color:'#d6c9ae'});
features.push({t:'ramp',nm:'Motu / south street roll-in',p:[-22,0,18],len:10,rise:1.1,w:28,yaw:180,tex:'pavement',color:'#d6c9ae'});
features.push({t:'ramp',nm:'Motu / street return bank',p:[-22,0,39.5],len:9,rise:1.1,w:28,tex:'pavement',color:'#d6c9ae'});
features.push({t:'rail',nm:'Motu / south terrace hubba',p:[-30,1.18,28],len:10,color:'#a8b3ad'});
features.push({t:'rail',nm:'Motu / long beach flat bar',p:[54,.68,-40],len:28,color:'#a8b3ad'});
// A smooth volcano from the reconstruction exercise's radial mesh vocabulary.
{
  const v:number[]=[],normals:number[]=[],ix:number[]=[],n=64,rings=24;
  for(let j=0;j<=rings;j++)for(let i=0;i<n;i++){
    const a=i/n*Math.PI*2,t=j/rings,r=2+6*t;
    v.push(Math.cos(a)*r,2.1*(1+Math.cos(t*Math.PI))/2,Math.sin(a)*r);
    const slope=2.1*Math.PI/12*Math.sin(t*Math.PI),length=Math.hypot(slope,1);
    normals.push(Math.cos(a)*slope/length,1/length,Math.sin(a)*slope/length);
  }
  v.push(0,2.1,0);normals.push(0,1,0);const center=v.length/3-1;
  for(let i=0;i<n;i++)ix.push(center,(i+1)%n,i);
  for(let j=0;j<rings;j++)for(let i=0;i<n;i++){const a=j*n+i,b=j*n+(i+1)%n,c=a+n,d=b+n;ix.push(a,b,d,a,d,c);}
  features.push({t:'mesh',nm:'Motu / coral volcano hip',p:[32,0,24],vertices:v,normals,indices:ix,
    smoothCollision:true,vert:false,tex:'pavement',color:'#cd977e'});
  features.push({t:'rail',nm:'Motu / volcano coping',p:[32,2.15,24],closed:true,coping:true,
    pts:Array.from({length:64},(_,i)=>[Math.cos(i*Math.PI/32)*2,Math.sin(i*Math.PI/32)*2] as [number,number]),color:'#a8b3ad'});
}
export const MOTU_SKATE_FEATURES=features;

const scenery:CustomComponent[]=[];
const add=(c:CustomComponent)=>scenery.push(c);
const asset=(dkind:DecorKind,p:P,s:P,yaw=0,nm=`Motu / ${dkind}`)=>add({t:'decor',dkind,p,s,yaw,nm,scenerySolid:false,solid:false});
function palm(p:P,k:number,yaw:number){
  asset('baytrunk',p,COASTAL_TOWN_ASSETS.baytrunk.size.map(v=>v*k) as P,yaw);
  const a=yaw*Math.PI/180;
  asset('baycrown',[p[0]+Math.cos(a)*.65*k,p[1]+7*k,p[2]-Math.sin(a)*.65*k],COASTAL_TOWN_ASSETS.baycrown.size.map(v=>v*k) as P,yaw);
}
// A sand shelf makes the complete concrete venue read as a built beach park.
{
  const vertices=[0,-3.2,-60],indices:number[]=[],uvs=[0,0],n=128;
  // Clockwise concentric rings, all below the apron. Rounded superellipse
  // shoulders bury cliff roots and descend continuously into the ocean.
  for(const [scale,y] of [[.76,-3.2],[1,-4.91],[1.18,-7]])for(let i=0;i<n;i++){
    const a=-i/n*Math.PI*2,c=Math.cos(a),s=Math.sin(a),r=1+.018*Math.sin(a*5)+.012*Math.cos(a*7);
    const x=Math.sign(c)*Math.pow(Math.abs(c),.55)*134*scale*r,z=Math.sign(s)*Math.pow(Math.abs(s),.55)*169*scale*r-60;
    vertices.push(x,y,z);uvs.push(x/9,z/9);
  }
  for(let i=0;i<n;i++){const next=(i+1)%n;indices.push(0,1+i,1+next);}
  for(let ring=0;ring<2;ring++)for(let i=0;i<n;i++){
    const a=1+ring*n+i,b=1+ring*n+(i+1)%n,c=a+n,d=b+n;indices.push(a,c,b,b,c,d);
  }
  add({t:'mesh',nm:'Motu / sand island shelf',p:[0,0,0],vertices,indices,uvs,tex:'sunny-sand',color:'#e5d0a3',beachSand:true});
}
// Tall layered Meshy headland at the back and west, with a low open east shore.
for(let i=0;i<18;i++){
  const k=1.7+(i%3)*.2;
  asset('sunnycliff',[-114-i%2*4,-5,52-i*14.8],[12*k,13.14197*k,5.63459*k],80+(i%3-1)*11);
  if(i%2===0){asset('bayrock',[-103-i%3*2,-4,48-i*14.8],[22,12.353,17.935],i*39);
    palm([-108,-2,48-i*14.8],1.4+(i%3)*.16,20+i*41);}
}
for(let i=0;i<12;i++){
  const k=1.7+(i%2)*.2;
  asset('sunnycliff',[-88+i*17,-5,-207-i%2*4],[12*k,13.14197*k,5.63459*k],(i%3-1)*8);
  if(i%2===0)palm([-73+i*16,5,-199-i%2*6],1.35+(i%3)*.18,38+i*47);
}
for(const [i,p] of ([[96,-3,40],[102,-3,3],[103,-3,-39],[99,-3,-77],[74,-3,66],[-65,-3,72],[-99,-3,57]] as P[]).entries()){
  palm(p,1.2+(i%3)*.16,i*53);
  asset('sunnyhibiscus',[p[0]-2,p[1],p[2]+3],[4.42,2.235,4.42],i*38);
  asset('bayrock',[p[0]+1,-5,p[2]+5],[10,5.615,8.152],i*29);
}

// Assemble the grandstand in one source-owned mesh per section. Seat roots use
// the same row dimensions: 1.3 m treads, .78 m rise, 1.15 m seat spacing.
function box(v:number[],ix:number[],p:P,s:P,stand:typeof MOTU_STANDS[number]){
  const base=v.length/3;
  for(const y of [-1,1])for(const [x,z] of [[-1,-1],[1,-1],[1,1],[-1,1]])v.push(...motuStandPoint(stand,p[0]+x*s[0]/2,p[1]+y*s[1]/2,p[2]+z*s[2]/2));
  for(const q of [[4,7,6,5],[0,1,2,3],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]])ix.push(base+q[0],base+q[1],base+q[2],base+q[0],base+q[2],base+q[3]);
}
for(const [index,stand] of MOTU_STANDS.entries()){
  const vertices:number[]=[],indices:number[]=[],width=stand.columns*1.15+2;
  for(let row=0;row<stand.rows;row++)box(vertices,indices,[0,row*.78-.22,row*1.3+.65],[width,.44,1.3],stand);
  for(const x of [-width/2+1,0,width/2-1])for(const row of [0,3,stand.rows-1]){
    const top=stand.p[1]+row*.78-.22,base=-3.5;
    box(vertices,indices,[x,(top+base)/2-stand.p[1],row*1.3+.65],[.4,top-base,.4],stand);
  }
  add({t:'mesh',nm:`Motu / grandstand ${index+1}`,p:[0,0,0],vertices,indices,solid:false,tex:'pavement',color:'#d8cab0',castShadow:true});
  // Back fascia and front sponsor barrier remain entirely outside the coping.
  const fascia=motuStandPoint(stand,0,stand.rows*.78+.1,stand.rows*1.3);
  add({t:'platform',nm:'Motu / grandstand back fascia',p:fascia,s:[width,1,.25],yaw:stand.yaw,tex:'solid',color:'#167b83'});
  if(index!==2){
    const v:number[]=[],ix:number[]=[],uvs:number[]=[],colors:number[]=[],palette=[[.87,.4,.25],[.13,.52,.55],[.92,.81,.53]];
    for(let sail=0;sail<3;sail++){
      const n=v.length/3;
      for(let j=0;j<=4;j++)for(let k=0;k<=12;k++){
        const u=k/12,w=j/4,x=-width/2+(sail+u)*width/3,z=1.7+w*stand.rows*1.3;
        v.push(...motuStandPoint(stand,x,8.2-.5*Math.sin(Math.PI*u)*Math.sin(Math.PI*w)-w*.7,z));
        uvs.push(u,w);colors.push(...palette[sail]);
      }
      for(let j=0;j<4;j++)for(let k=0;k<12;k++){const a=n+j*13+k,b=a+13;ix.push(a,b,a+1,a+1,b,b+1);}
    }
    add({t:'mesh',nm:`Motu / shade sails ${index+1}`,p:[0,0,0],vertices:v,indices:ix,uvs,colors,solid:false,doubleSided:true,tex:'rally-cloth',castShadow:true});
    const poles:number[]=[],poleIndices:number[]=[];
    for(const x of [-width/2,width/2])for(const z of [1.7,1.7+stand.rows*1.3])
      box(poles,poleIndices,[x,-1.3,z],[.24,19,.24],stand);
    add({t:'mesh',nm:'Motu / canopy steel columns',p:[0,0,0],vertices:poles,indices:poleIndices,solid:false,tex:'solid',color:'#728c87'});
  }
}

// Four complete floodlight towers match the fixed warm lighting sources.
for(const [i,flood] of MOTU_FLOODS.entries()){
  const vertices:number[]=[],indices:number[]=[],frame={p:[0,0,0] as P,yaw:0,columns:0,rows:0};
  box(vertices,indices,[flood.p[0],(flood.p[1]-3.2)/2,flood.p[2]],[.32,flood.p[1]+3.2,.32],frame);
  box(vertices,indices,[flood.p[0],flood.p[1]-.3,flood.p[2]],[4.8,.25,.3],frame);
  add({t:'mesh',nm:`Motu / floodlight tower ${i}`,p:[0,0,0],vertices,indices,solid:false,tex:'solid',color:'#284e59'});
  const glass:number[]=[],glassIx:number[]=[];
  for(const x of [-1.65,-.55,.55,1.65])box(glass,glassIx,[flood.p[0]+x,flood.p[1],flood.p[2]],[.82,.55,.44],frame);
  add({t:'mesh',nm:'Motu / warm floodlight glass',p:[0,0,0],vertices:glass,indices:glassIx,solid:false,tex:'solid',color:'#fff0cb',castShadow:false});
}

// Shared cutout atlas: preserve every brand's aspect. One mesh holds panels
// and tilted stickers; negative U invokes the existing weathered metal shader.
const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
function sign(p:P,width:number,height:number,yaw:number,brand:number,tilt=0){
  const n=vertices.length/3,a=yaw*Math.PI/180,c=Math.cos(a),s=Math.sin(a),ct=Math.cos(tilt),st=Math.sin(tilt),art=brand<0?null:RALLY_SPONSORS[brand];
  for(const [u,v] of [[0,0],[1,0],[0,1],[1,1]]){
    const x=(u-.5)*width,y=(v-.5)*height,rx=x*ct-y*st,ry=x*st+y*ct;
    vertices.push(p[0]+rx*c,p[1]+ry,p[2]-rx*s);
    uvs.push(...(art?[art.uv[0]+u*(art.uv[2]-art.uv[0]),art.uv[1]+v*(art.uv[3]-art.uv[1])]:[-1-u,v]));
  }
  indices.push(n,n+1,n+2,n+1,n+3,n+2);
}
for(const [i,stand] of MOTU_STANDS.entries())for(let j=0;j<4;j++){
  const width=stand.columns*1.15/4-.3,brand=[0,6,1,4][(i+j)%4],p=motuStandPoint(stand,(j-1.5)*(width+.3),-.35,-.58);
  sign(p,width,2.6,stand.yaw+180,-1);
  const h=Math.min(2.3,(width-.4)/RALLY_SPONSORS[brand].aspect),front=motuStandPoint(stand,(j-1.5)*(width+.3),-.35,-.62);
  sign(front,h*RALLY_SPONSORS[brand].aspect,h,stand.yaw+180,brand);
  if(j%2===0){const b=[2,3,5][(j+i)%3],q=motuStandPoint(stand,(j-1.5)*(width+.3)+width*.31,.05,-.68);sign(q,1.05*RALLY_SPONSORS[b].aspect,1.05,stand.yaw+180,b,(i%2?1:-1)*.16);}
}
// Low stickers on street deck fascia and halfpipe decks are readable up close.
for(const [i,p] of ([[53.3,1.3,-103.97],[32.7,1.3,-103.97],[-18,.58,35.03],[-27,.6,35.03]] as P[]).entries()){
  const brand=[2,5,4,3][i],h=.85;sign(p,h*RALLY_SPONSORS[brand].aspect,h,0,brand,(i%2?1:-1)*.09);
}
// Tall billboards sit beyond the spectator bays, readable across the park.
for(const [i,p,yaw,brand] of [[0,[-101,12,-54],90,0],[1,[-101,12,-121],90,6],[2,[46,12,-187],0,1],[3,[-46,12,-187],0,4]] as [number,P,number,number][]){
  const width=14,height=4.5,a=yaw*Math.PI/180;
  sign(p,width,height,yaw,-1);const h=Math.min(height-.3,(width-.4)/RALLY_SPONSORS[brand].aspect);
  sign([p[0]+Math.sin(a)*.035,p[1],p[2]+Math.cos(a)*.035],h*RALLY_SPONSORS[brand].aspect,h,yaw,brand);
  for(const side of [-1,1])add({t:'platform',nm:'Motu / billboard support',p:[p[0]+Math.cos(a)*side*5,3.8,p[2]-Math.sin(a)*side*5],s:[.35,16.4,.35],tex:'solid',color:'#596d70'});
  const sticker=2+i%3,q:P=[p[0]+Math.cos(a)*4.7+Math.sin(a)*.07,p[1]-1,p[2]-Math.sin(a)*4.7+Math.cos(a)*.07];
  sign(q,1.35*RALLY_SPONSORS[sticker].aspect,1.35,yaw,sticker,.16);
}
add({t:'mesh',nm:'Motu / sponsor boards and pasted stickers',p:[0,0,0],vertices,indices,uvs,solid:false,doubleSided:true,tex:'rally-sponsors',color:'#ffffff',castShadow:false});
add({t:'mesh',nm:'Motu / invitational marquee',p:[0,18.8,-195],vertices:[-18,-2.8,0,18,-2.8,0,-18,2.8,0,18,2.8,0],indices:[0,1,2,1,3,2],
  uvs:[0,0,1,0,0,1,1,1],solid:false,doubleSided:true,tex:'solid',color:'#f3e0b0',castShadow:false});
for(const x of [-14,14])add({t:'platform',nm:'Motu / marquee mast',p:[x,8.4,-195.2],s:[.45,24,.45],tex:'solid',color:'#547d7c'});
export const MOTU_BEACH_SCENERY=scenery;
