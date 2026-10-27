import type {CustomComponent,CustomLevelData} from '../level';
import type {JungleAssetKind} from '../jungleAssets';

type P=[number,number,number];
type Deck={a:number;b:number;y:number;name:string};
const round=(v:number)=>Math.round(v*1000)/1000;
const random=(n:number)=>{const v=Math.sin(n*12.9898+7.13)*43758.5453;return v-Math.floor(v);};
const STONE=['#f1d4a1','#ddc18f','#e6d9b4','#c8caa1'];
const JADE=['#a9cfaf','#c9d4ab','#8cbea7'];

export const ANCIENT_GATES_ATMOSPHERE:CustomLevelData['atmosphere']={
 backdrop:'fog',fogEnabled:true,fogNear:38,fogFar:155,fogColor:'#325d59',
 ambientSky:'#b5dfd3',ambientGround:'#846342',ambientIntensity:1.18,
 sunColor:'#ffdb9b',sunIntensity:2.05,sunDirection:[-.48,.8,.35],
 fillColor:'#9ac9dc',fillIntensity:.7,shadowStrength:.78,drawDistance:205,
};
export const ANCIENT_HOARD_ATMOSPHERE:CustomLevelData['atmosphere']={
 backdrop:'fog',fogEnabled:true,fogNear:30,fogFar:100,fogColor:'#173c3f',
 ambientSky:'#99cfc8',ambientGround:'#82613b',ambientIntensity:1.1,
 sunColor:'#ffd394',sunIntensity:1.6,sunDirection:[-.35,.8,.48],
 fillColor:'#70bec0',fillIntensity:.65,shadowStrength:.7,drawDistance:140,
};

function workshop(){
 const out:CustomComponent[]=[];
 const prop=(dkind:JungleAssetKind,p:P,s:P,nm:string,color='#ffffff',yaw=0,amp=0)=>{
  out.push({t:'decor',dkind,p:p.map(round) as P,s:s.map(round) as P,color,yaw,amp,
   solid:false,scenerySolid:false,grp:90,nm});
 };
 const torch=(x:number,y:number,z:number,scale=1)=>out.push({t:'torch',p:[x,y,z],rise:2.3,w:scale,grp:90,nm:'Gatekeeper amber brazier'});
 const column=(x:number,y:number,z:number,h:number,color=STONE[0],wide=2.2)=>{
  prop('stonebase',[x,y,z],[wide*1.5,.8,wide*1.5],'Broad gate pier foot',color);
  for(let a=.8,i=0;a<h-1;a+=2,i++)prop('stoneshaft',[x,y+a,z],[wide,Math.min(2,h-1-a),wide],
   'Bonded carved pier shaft',i%3===1?STONE[2]:color);
  prop('stonecapital',[x,y+h-1,z],[wide*1.65,1.05,wide*1.65],'Overhanging gate pier capital',color);
 };
 const arch=(x:number,y:number,z:number,w:number,h:number,nm:string,color=STONE[0])=>{
  prop('hangingarch',[x,y,z],[w,h,3],nm,color);
  prop('junglevine',[x-w*.32,y+h*.62,z+1.7],[w*.38,h*.29,.65],`${nm} hanging vines`,'#b8cb79');
  for(const side of [-1,1]){
   prop('stonefrieze',[x+side*(w*.5-1.6),y+h*.35,z+1.56],[2.6,2.3,.32],`${nm} spiral relief`,JADE[0]);
   prop('junglefern',[x+side*w*.44,y-.1,z+1.5],[5,2.3,4],`${nm} rooted fern`,'#d3dd99',side*33);
  }
 };
 return {out,prop,torch,column,arch};
}

/** Art is deliberately soft: the native level remains the sole gameplay owner. */
export function dressAncientGates(source:CustomComponent[],decks:readonly Deck[]):CustomComponent[]{
 const {out,prop,torch,column,arch}=workshop();
 const woodGroups=new Set([1,4,7,9]);
 for(const c of source){
  if(['platform','ramp','mesh'].includes(c.t)){
   c.tex=woodGroups.has(c.grp??0)?'treehouse-timber':'crown-limestone';
   c.color=c.grp===8||c.grp===10?'#a8c2a0':woodGroups.has(c.grp??0)?'#e6bf86':'#e5c797';
  }else if(c.t==='mover'||c.t==='spinbridge'||c.t==='crumble'){
   c.tex='bridge-timber';c.color=c.t==='crumble'?'#e8b16a':'#d7ac71';
  }else if(c.t==='crusher'){c.tex='crown-limestone';c.color='#c0ac88';}
 }
 const heightAt=(x:number)=>decks.reduce((a,b)=>Math.abs((a.a+a.b)/2-x)<Math.abs((b.a+b.b)/2-x)?a:b).y;

 // Meshy fascia and bonded support stop at each exact authored gap. A narrow
 // inlaid lane and low coping explain the existing 2.5D depth boundaries.
 for(const [i,d] of decks.entries()){
  const span=d.b-d.a,wood=woodGroups.has(source.find(c=>c.t==='platform'&&c.nm===d.name)?.grp??0);
  const n=Math.ceil(span/4.2),step=span/n;
  for(let k=0;k<n;k++){
   const x=d.a+(k+.5)*step;
   prop(wood?'trialsv2beam':'stonecornice',[x,d.y-.82,3.03],[step-.035,.65,.72],
    `${d.name} fitted outer fascia`,wood?'#e7b779':STONE[(i+k)%4]);
   for(const side of [-1,1]){
    if(d.a===-24&&x<-10||side===-1&&x>1119&&x<1137)continue;
    prop(wood?'trialsv2beam':'stonecornice',[x,d.y-.12,side*1.12],
     [step-.045,.27,.26],`${d.name} low lane coping`,wood?'#e3b478':'#f0dba9');
   }
   if(k%2===0){
    for(let row=0;row<2;row++)prop('wornstoneblock',[x,d.y-5.2+row*2,1.8],
     [step-.08,2,2.6],`${d.name} bonded masonry course`,STONE[(i+k+row+1)%4]);
    prop('stonefrieze',[x,d.y-2.05,3.25],[Math.min(step-.3,2.8),1.15,.35],`${d.name} carved face`,i%3===1?JADE[0]:STONE[0]);
   }
   if(k%3===1)prop('junglevine',[x,d.y-4.5,3.5],[3.5,3.5,.55],`${d.name} trailing vines`,'#bdd380');
  }
  // Larger stones are kept on the non-playable shoulders, never over the lip.
  for(let x=d.a+1.7;x<d.b-1.3;x+=3.5)for(const z of [-2.25,2.25])
   prop('stonepaver',[x,d.y-.14,z],[Math.min(3.25,span-1),.19,1.6],`${d.name} shoulder paving`,STONE[(i+Math.floor(x))&3],(i%2)*180);
  for(let x=d.a+2.5,j=0;x<d.b-1.5;x+=8.7,j++){
   prop((i+j)%3?'junglefern':'jungleleaf',[x,d.y-.35,-3.45],[4.7,1.7,3.3],`${d.name} back-edge planting`,(i+j)%2?'#cfdd99':'#b1d4a4',random(x)*360);
   if((i+j)%3===0&&x>d.a+3.6&&x<d.b-3.6)prop('treehousemossrock',[x,d.y-5.6,3.6],[5.4,3.1,4.5],`${d.name} lower moss shelf`,'#bcc49a',random(x+4)*360);
  }
 }

 // Paintings sit behind real architecture and complete the ravine at depth.
 for(let x=-70,i=0;x<1510;x+=164,i++)prop('ancientgatevalley',[x,heightAt(x)-91,-76-i%2*.2],
  [216,144,.02],'Painted far gate valley','#d9e7dc');
 for(let x=-28,i=0;x<1425;x+=24,i++){
  const y=heightAt(x),r=random(i*17);
  prop(i%3===0?'trialsv2treea':i%3===1?'trialsv2treeb':'junglecanopy',[x,y-7,-18-r*7],
   [23+r*7,25+r*9,19+r*5],'Layered ancient jungle canopy',i%3?'#c7dda8':'#b8d3bb',r*360);
  if(i%2===0)prop('trialsv3thicket',[x+7,y-5,-10.5],[12,7,7],'Deep ravine understory','#8fbc9c',r*180);
  if(i%4===1)prop('trialsv3bough',[x,y+14,-9.2],[20,6.5,9],'Overhead leafy silhouette','#cfdd9f',r*40-20);
 }

 // Twelve compositions correspond to different gameplay spaces. Gate walls
 // and crowns always sit behind the player and never camouflage a receiver.
 arch(-17,-2,-8.5,21,24,'Root gatehouse',STONE[1]);
 for(const x of [0,45,78])prop('trialsv2treea',[x,-7,-11.2],[13,18,11],'Root Steps buttress tree','#d3d8a3',x*3);
 arch(153,-1,-10,27,29,'Split timber gate',STONE[0]);
 for(const x of [141,165])prop('trialsv2beam',[x,12,-7.6],[16,1.1,1.2],'Tall split-gate timber leaf','#dfa36a',0,x===141?83:97);
 prop('trialsv2beam',[153,23,-8],[26,1.6,1.6],'Split gate crown beam','#edba72');
 arch(285,1,-10,19,22,'Mossback spiral portal',JADE[1]);
 for(const x of [245,266,306,337])prop('treehousemossrock',[x,-1,-10],[12,8,8],'Mossback overgrown stone bank','#a8c7a3',x);

 for(const x of [378,403,425,446])column(x,-2,-8.8,x<420?21:27,STONE[1],2.4);
 for(const [x,w,y] of [[390,28,20],[435,28,27]]){
  prop('trialsv2beam',[x,y,-8.8],[w,1.5,2.1],'Counterweight overhead timber gantry','#e2b177');
  prop('stonefrieze',[x,y-2.5,-7.65],[5,2.5,.35],'Counterweight sun seal',JADE[0]);
 }
 for(const [x,y] of [[477,14],[507,14],[531,12.5],[557,10]]){
  column(x-5.2,y-3,-7.2,16,STONE[1],2);
  column(x+5.2,y-3,-7.2,16,STONE[2],2);
  prop('stonelintel',[x,y+11.7,-7.2],[13,1.3,2.4],'Hammer gallery load-bearing lintel',STONE[0]);
  prop('stonefrieze',[x,y+8,-6.1],[4,2.6,.4],'Hammer gallery warning relief',JADE[2]);
  torch(x-4.7,y+1,-4.4,.9);
 }
 arch(626,-8,-9,28,26,'Broken aqueduct near arch',STONE[2]);
 arch(679,-11,-10,34,27,'Broken aqueduct far arch',STONE[1]);
 prop('stonecornice',[643,14,-7.8],[8,1.2,2],'Broken aqueduct hanging cornice',STONE[0],0,-12);

 for(const x of [718,745,777,812,838]){
  prop('trialsv2treeb',[x,heightAt(x)-7,-14],[17,24,13],'Bristle Orchard ancient fruit tree','#d8e2a0',random(x)*360);
  prop('trialsv3bough',[x+5,heightAt(x)+12,-7],[18,5,8],'Orchard low canopy','#dee7a6',random(x)*70-35);
 }
 arch(862,-1,-10,24,25,'Lantern fire-mouth portal',JADE[0]);
 for(const x of [885,907,930]){
  column(x,-4,-9.4,24,JADE[1],2.1);torch(x,13,-6.9,1.2);
  prop('treehousetrialssunshaft',[x+1,0,-5.5],[2.6,25,.02],'Lantern chamber drifting light','#e4ce7b',0,-12);
 }
 for(const [x,y] of [[963,10],[995,12],[1022,14]]){
  column(x,y-4,-7.7,13,STONE[2],2);
  prop('trialsv2beam',[x,y+7.4,-3.9],[1,1,9],'Wind bell timber cantilever','#dbad79');
  prop('junglevine',[x+3,y+5,-6.8],[4,5,1],'Wind bell hanging root','#bad391');
 }
 arch(1083,-6,-10,23,26,'Sunken broken gateway',JADE[2]);
 arch(1128,3,-10,20,23,'Gatekeeper reliquary entrance',STONE[0]);
 for(const x of [1120,1136]){torch(x,8,-4.8,1.15);prop('stonefrieze',[x,11,-5.9],[2.7,3.2,.5],'Reliquary jade offering seal',JADE[0]);}
 arch(1160,-7,-11,24,25,'Sunken ferry watergate',JADE[1]);
 for(const [x,y,h] of [[1207,-3,29],[1232,-1,37],[1266,4,34]]){
  column(x,y,-9,h,STONE[0],3.2);
  prop('stonefrieze',[x,y+h-6,-7.3],[4.5,3.8,.5],'Crown ascent sun relief',JADE[1]);
 }
 prop('stonelintel',[1235,34,-10],[43,2,3.2],'Crown summit suspended lintel',STONE[0]);
 arch(1376,8,-10,30,33,'The final Ancient Gate',STONE[0]);
 for(const x of [1363,1389])torch(x,18,-6.3,1.5);
 prop('roofedtemple',[1400,12,-21],[26,25,20],'Sanctuary beyond the final gate',STONE[2]);
 return out;
}

export function dressAncientHoard(source:CustomComponent[]):CustomComponent[]{
 const {out,prop,torch,column,arch}=workshop();
 for(const c of source)if(c.t==='mesh'){
  c.tex='crown-limestone';c.color=c.outline?'#b6d8b2':'#d6c592';
 }
 for(let x=-35;x<300;x+=92)prop('ancientgatehoard',[x,-61,-37],[120,80,.02],
  'Painted Gatekeeper reliquary depth','#e5e4cc');
 for(const c of source.filter(c=>c.t==='mesh'&&!c.outline&&c.s)){
  const [w,h]=c.s!,a=c.p[0]-w/2,b=c.p[0]+w/2,y=c.p[1]+h/2;
  for(let x=a+1.7;x<b-1;x+=3.4){
   const width=Math.min(3.35,b-x+.95);
   prop('stonecornice',[x,y-.8,3.05],[width,.65,.85],'Hoard fitted golden cornice',STONE[0]);
   for(const side of [-1,1])prop('stonecornice',[x,y-.14,side*1.12],[width,.28,.27],
    'Hoard low jade lane coping',JADE[0]);
   prop('stonefrieze',[x,y-2.1,3.25],[width-.2,1.3,.42],'Hoard carved jade frieze',JADE[1]);
   if(Math.floor(x)%3===0)prop('junglevine',[x,y-4.1,3.5],[3,2.9,.45],'Hoard trailing roots','#b1bd75');
  }
  for(let x=a+3;x<b-2.6;x+=7.5){
   // The upper offering shelf has a real return passage beneath it.
   // Keep its scenery supports behind that passage, out of the body silhouette.
   for(let row=0;row<3;row++)prop('wornstoneblock',[x,y-6.5+row*1.8,y>2?-5.2:1.7],
    [5,1.8,3.2],'Hoard bonded buttress course',STONE[row]);
   prop('junglefern',[x,y-.25,-3.45],[3.8,1.5,3],'Hoard rooted fern','#c0d591',x*13);
  }
 }
 for(const [i,x] of [-17,22,50,82,102,132,172,198].entries()){
  column(x,-5,-8,22,i%2?STONE[1]:JADE[1],2.5);
  prop('stonefrieze',[x,10,-6.65],[3.3,3.5,.45],'Gatekeeper copper sun relief',STONE[0]);
  prop('junglevine',[x+3,10,-8.1],[7,7,1],'Reliquary hanging root curtain','#b8c784');
  torch(x,2.8,-4.9,1.1);
 }
 for(const [x,y,w] of [[6,13,29],[67,15,32],[115,14,34],[157,15,32],[190,14,29]]){
  prop('stonelintel',[x,y,-8.4],[w,1.4,3],'Hoard high carved lintel',STONE[0]);
  prop('trialsv2beam',[x,y+1.6,-7.8],[w+2,1.2,2.6],'Hoard dark timber ceiling brace','#c99c65');
  prop('treehousetrialssunshaft',[x,2,-5.4],[2.4,18,.02],'Hoard emerald skylight','#9ad7aa',0,13);
 }
 arch(197,-2,-10,23,24,'Gatekeeper departure portal',STONE[0]);
 return out;
}
