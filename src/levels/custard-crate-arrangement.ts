import type {CustomComponent} from '../level';
type P=[number,number,number];
type Course={point:(s:number,y?:number,u?:number)=>P;progress:(p:P)=>number;tangent:(s:number)=>P};

/** Run after bank sculpting: keep every existing protected footing and all
 * collision/art geometry, then regroup rewards at their established anchors. */
export function arrangeSunsetSafariCrates(C:CustomComponent[],course:Course):void {
 const old=C.filter(c=>c.t==='crate'),cargo:CustomComponent[]=[];
 const anchor=(s:number,kind?:CustomComponent['kind'])=>{
  const candidates=old.filter(c=>(kind?c.kind===kind:c.kind==='wood'||c.kind==='mystery')&&c.p[1]>-30);
  return candidates.reduce((a,b)=>Math.abs(course.progress(a.p)-s)<Math.abs(course.progress(b.p)-s)?a:b);
 };
 const cluster=(base:CustomComponent,count:number,job:string)=>{
  const axis=Math.abs(course.tangent(Math.min(2430,course.progress(base.p)))[0])>.707?0:2;
  for(let i=0;i<count;i++){
   const p=[...base.p] as P;p[1]+=(count===4?Math.floor(i/2):i)*.96;
   if(count===4)p[axis]+=(i%2-.5)*.96;
   cargo.push({...base,p,kind:i===0&&base.kind==='mask'?'mask':i>=(count===4?2:1)?'mystery':'wood',nm:`SUNSET / ${job}`});
  }
 };
 // Ten on each branch of the split millrace; ten in every other checkpoint
 // section. All-box play visits both banks; the clear route chooses either.
 const groups:readonly (readonly [number,number,string])[]=[
  [24,3,'TEACH / opening harvest'],[185,4,'REST / lockyard exit'],
  [280,3,'TEST / inner bank entry'],[310,3,'PREPARE / inner jump court'],[374,4,'REWARD / inner receiver'],
  [285,3,'TEST / outer bank entry'],[333,3,'PREPARE / timber approach'],[450,4,'REWARD / outer receiver'],
  [575,3,'COUNT / mill crown entry'],[595,3,'PREPARE / crown shoulder'],[625,4,'TEST / crown rail approach'],
  [755,3,'COUNT / upper terrace'],[815,4,'REST / upper terrace exit'],
  [890,3,'TEACH / spillway smash choice'],[960,2,'TEST / spillway carve'],[1044,2,'TEST / return carve'],[1128,3,'REST / spillway exit'],
  [1270,3,'REWARD / first sluice receiver'],[1290,4,'TEST / sluice shoulder'],[1310,3,'COUNT / sluice checkpoint approach'],
  [1368,3,'REWARD / second sluice receiver'],[1388,4,'TEST / returning island'],[1418,3,'PREPARE / crumble court'],
  [1535,3,'COUNT / ferry approach'],[1565,3,'REST / ferry waiting bank'],[1595,4,'PREPARE / ferry departure'],
  [1690,3,'REWARD / ferry receiver'],[1720,3,'PREPARE / reedbank split'],
  [1840,3,'TEACH / quarry harvest'],[1900,3,'REWARD / first boulder exit'],[2008,4,'TEST / outside quarry harvest'],
  [2120,3,'COUNT / crown approach'],[2150,4,'PREPARE / pendulum shoulder'],
  [2394,3,'REWARD / crown rail receiver'],[2400,4,'REST / waterfall brink'],
  [2406,4,'COUNT / spring chapter entry'],[2418,3,'PREPARE / first spring'],
 ];
 for(const [s,count,job]of groups)cluster(anchor(s),count,job);
 cluster(anchor(74,'mask'),3,'PREPARE / protection before stamping locks');
 cluster(anchor(1792,'mask'),4,'PREPARE / protection before quarry');
 // The arrow has its visible cap; the only main life remains on the optional
 // high mill roof. Neither tool is needed for the clear route.
 for(const c of old)if(c.kind==='bouncy'||(c.kind==='mystery'&&Math.abs(course.progress(c.p)-786)<.7)||
   (c.kind==='life'&&Math.abs(course.progress(c.p)-791)<.7))cargo.push({...c,p:[...c.p],nm:`SUNSET / TOOL / ${c.kind==='life'?'optional mill roof life':'arrow and upper reward'}`});
 const nitro=anchor(2265,'nitro');
 for(let i=0;i<3;i++)cargo.push({...nitro,p:[nitro.p[0],nitro.p[1]+i*.96,nitro.p[2]],kind:i<2?'nitro':'mystery',nm:'SUNSET / FRAME / deferred crown-side cargo'});
 cluster(anchor(2278,'nitro'),3,'COUNT / checkpoint shoulder before crown rail');
 cluster(anchor(2408,'nitrobang'),3,'PREPARE / sheltered spring supplies');
 // Sheltered rest ledges own all cargo in the spring finale. Springs, their
 // receivers and the five-flight sequences themselves remain crate-free.
 for(const [s,y,grp]of [[2620,-52,96],[2810,-122,97],[3000,-190,98]]){
  for(const [ds,u,count]of [[6,-7,4],[6,7,3],[3,0,3]])
   cluster({t:'crate',kind:'wood',p:course.point(s+ds,y,u),grp},count,'REST / waterfall terrace harvest');
 }
 cargo.push({t:'crate',kind:'nitrobang',p:course.point(3206,-264,-6),grp:98,nm:'SUNSET / COUNT / final remote Nitro credit'});
 for(let i=C.length-1;i>=0;i--)if(C[i].t==='crate')C.splice(i,1);
 C.push(...cargo);
 let crabSeen=false,turtleSeen=false;
 for(const c of C)if(c.t==='enemy'){
  const s=course.progress(c.p),turtle=s>550&&![1298,1988].some(n=>Math.abs(n-s)<1);
  c.foe=turtle?'turtle':'grunt';
  const first=turtle?!turtleSeen:!crabSeen;turtleSeen||=turtle;crabSeen||=!turtle;
  c.nm=`SUNSET / ${first?'TEACH':'TEST'} / ${turtle?'turtle':'crab'} guarded shoulder`;
 }
}

export function arrangeWillowmillCrates(C:CustomComponent[]):void {
 for(let i=C.length-1;i>=0;i--)if(C[i].t==='crate')C.splice(i,1);
 for(const [x,y,count]of [[-9,0,4],[-3,0,3],[7,.35,4],[14,.35,4],[26,0,4],[35,0,4],[45,0,3]])
  for(let i=0;i<count;i++)C.push({t:'crate',p:[x+(count===4?(i%2)*.96:0),y+(count===4?Math.floor(i/2):i)*.96,0],kind:i>=(count===4?2:1)?'mystery':'wood',grp:2,nm:`WILLOWMILL / ${x<0?'TEACH':x<20?'TEST':'REWARD'} / terrace harvest`});
 C.push({t:'crate',kind:'life',p:[21,4.3,0],grp:2,nm:'WILLOWMILL / RISK / high reward over the second water gap'});
}
