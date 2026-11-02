import {spaghettiWorld,type P} from './spaghetti-infinite-course';

export const LANTERN_CHAPTERS=['Lantern Steps','The Broken Loom','Counterweights','Spine Stair','The Box Garden','Hanging Lanterns','Spring Vault','The Bellows','Needle Windows','The Last Stitch'];
// Keep jump courts between the six recovery strata, with head clearance.
const chapterHeights=[112,96,60,48,12,0,-36,-48,-84,-96];
const chapterSteps=[
 {x:[-18,-9,2,-6,7,18],y:[0,-2,-4,-2,-5,-8]},
 {x:[18,12,4,-4,-12,-18],y:[0,-1,-3,-5,-6,-8]},
 {x:[-18,-8,0,8,18,24],y:[0,-3,-1,-3,-5,-8]},
 {x:[18,8,-2,-12,-4,6],y:[0,-3,-6,-4,-6,-8]},
 {x:[-18,-10,2,12,2,-10],y:[0,-2,-4,-6,-4,-8]},
 {x:[18,8,0,-8,-18,-24],y:[0,-1,-3,-5,-7,-8]},
 {x:[-18,-6,6,18,10,0],y:[0,-2,-4,-6,-4,-8]},
 {x:[18,10,-2,-12,-4,8],y:[0,-2,-4,-2,-5,-8]},
 {x:[-18,-8,4,-4,8,20],y:[0,-3,-1,-3,-5,-8]},
 {x:[18,10,0,-10,0,12],y:[0,-2,-4,-6,-4,-8]},
];
export interface LanternJump {from:P;to:P;name:string;}

/** A foot-and-board adventure with small jump courts, timing challenges and
 * reward detours. Rails connect the courts without replacing their centres. */
export function createSpaghettiPlatformer(){
 const w=spaghettiWorld(true,-2080),jumps:LanternJump[]=[],chapters:{name:string;entry:P;landings:P[]}[]=[];
 const entry:P=[-18,112,18];
 w.slab('Lanternworks arrival',[-18,112,16],38,44,'#d9c59b');
 for(let chapter=0;chapter<10;chapter++){
  const z=-chapter*200,y=chapterHeights[chapter],side=chapter%2?-1:1,landings:P[]=[];
  const name=LANTERN_CHAPTERS[chapter];
  for(let j=0;j<6;j++){
   const p:P=[chapterSteps[chapter].x[j],y+chapterSteps[chapter].y[j],z-j*18];landings.push(p);
   const slab=w.slab(`${name} / step ${j+1}`,p,j===0?18:12,j===0?20:14,j%2?'#bda881':'#dbcaab',10+chapter);
   if(j>0&&j<5)slab.pts=[[-6,-5,1],[-4,-7,1],[4,-7,1],[6,-5,1],[6,5,1],[4,7,1],[-4,7,1],[-6,5,1]];
   if(j>0){
    const a=landings[j-1];jumps.push({from:a,to:p,name:`${name} / jump ${j}`});
    w.rail(`${name} / edge stitch ${j}`,[[a[0]+4,a[1]+1,a[2]-2],[a[0]+4,a[1]+1,a[2]-7],[p[0]+4,p[1]+1,p[2]+7],[p[0]+4,p[1]+1,p[2]+2]],2,10+chapter);
   }
   if(j===0&&chapter>0)w.add({t:'checkpoint',p:[p[0]-3,p[1],p[2]+3],nm:name+' checkpoint',grp:3});
   if(j===1||j===4)w.box([p[0]-2,p[1],p[2]],j===4&&chapter%3===1?'multihit':'wood',name+' cargo');
   if(j>0)w.fruit([p[0],p[1]+1.6,p[2]+1],name+' jump trail');
  }
  chapters.push({name,entry:landings[0],landings});
  const end=landings[5],reward:P=[-26*side,y-14,z-144];
  w.slab(name+' / reward balcony',reward,16,20,'#c5a871',10+chapter);
  w.box([reward[0]-3,reward[1],reward[2]],chapter===8?'life':'wood',name+' balcony reward');
  w.box([reward[0]+1,reward[1],reward[2]],'wood',name+' balcony stack');
  const middle:P=[(end[0]+reward[0])/2,y-11,z-117];
  if(chapter===1||chapter===4||chapter===9)w.add({t:'crumble',p:[middle[0],middle[1]-.6,middle[2]],s:[10,1.2,12],shake:1.15,tex:'spaghetti-basalt',color:'#b79770',nm:name+' / crumbling ledge',grp:10+chapter});
  else if(chapter===2||chapter===5||chapter===8)w.add({t:'mover',p:[middle[0],middle[1]-.6,middle[2]],s:[12,1.2,12],axis:'x',amp:5,speed:.45,phase:chapter*.7,tex:'spaghetti-basalt',color:'#b7c7b8',nm:name+' / crossing ferry',grp:10+chapter});
  else w.slab(name+' / transfer stone',middle,10,12,'#c8b99a',10+chapter);
  w.rail(name+' / balcony bridge',[[end[0]+4,end[1]+1,end[2]-2],[middle[0]+3,middle[1]+1,middle[2]],[reward[0]+4,reward[1]+1,reward[2]+4]],5,10+chapter);
  if(chapter<9){
   const next:P=[chapterSteps[chapter+1].x[0],chapterHeights[chapter+1],z-200];
   w.rail(name+' / forward exit',[[reward[0]+4,reward[1]+1,reward[2]-2],[reward[0]+4,reward[1]+1,reward[2]-12],[next[0]+4,next[1]+1,next[2]+4]],7,10+chapter);
  }else w.rail('Last Stitch / final descent',[[reward[0]+4,reward[1]+1,reward[2]-3],[0,y-20,z-176],[4,w.finishY+.9,w.finishZ+22],[4,w.finishY+.9,w.finishZ+8]],9,19);
  if(chapter===2||chapter===6){
   const p:P=[30,y-18,z-100],q:P=[30,y+4,z-130];
   w.slab(name+' / spring well',p,12,14,'#968d84',10+chapter);
   w.add({t:'trampoline',p:[p[0],p[1]+.03,p[2]],s:[9,.6,8],speed:32,amp:1.25,tex:'solid',color:'#d2ac67',nm:name+' / Carlisle spring',grp:10+chapter});
   w.slab(name+' / high vault',q,12,18,'#e3c88c',10+chapter);w.box([q[0]-3.5,q[1],q[2]],'life',name+' high reward');
   w.rail(name+' / spring approach',[[end[0],end[1]+1,end[2]+3],[p[0],p[1]+1,p[2]+3]],3,10+chapter);
   w.rail(name+' / vault return',[[q[0],q[1]+1,q[2]-3],[q[0],q[1]+1,q[2]-11],w.recoveryBelow(q,80)],5,10+chapter);
  }
  if(chapter===3||chapter===7){
   for(let k=0;k<3;k++)w.add({t:'vertramp',p:[k===1?5:k===2?-4:0,y-24-k*7,z-106-k*18],len:32,w:4,rise:5,arc:90,deck:0,yaw:90,vkind:'half',tex:'spaghetti-basalt',color:['#b7c5b0','#c8aa83','#acb6bb'][k],nm:`Lantern spine ${chapter}.${k}`,grp:10+chapter});
   w.rail(name+' / spine return',[[0,y-32,z-145],[0,y-32,z-155],w.recoveryBelow([0,y-32,z-155],35)],3,10+chapter);
  }
  if(chapter===0||chapter===4||chapter===8){
   const p:P=[38,y-12,z-46];w.slab(name+' / kicker approach',[38,y-12,z-31],12,14,'#c6a56e',10+chapter);
   w.rail(name+' / kicker entry',[[landings[1][0]+4,landings[1][1]+1,landings[1][2]],[38,y-11,z-27],[38,y-11,z-36]],4,10+chapter);
   w.add({t:'ramp',p,w:12,len:16,rise:4,tex:'spaghetti-basalt',color:'#c9a86e',nm:name+' / kicker',grp:10+chapter});
   const q:P=[38,y-21,z-78];w.slab(name+' / kicker receiver',q,14,18,'#cbb68c',10+chapter);w.box(q,'wood',name+' air cargo');
   w.rail(name+' / kicker return',[[38,y-20,z-84],w.recoveryBelow(q,74)],5,10+chapter);
  }
  if(chapter%2===1){const p=landings[3];w.add({t:'enemy',foe:chapter%4===1?'hopper':'turtle',p:[p[0]-2,p[1],p[2]],range:1.8,speed:1.1,nm:name+' / landing guardian',grp:3});}
 }
 w.finish();w.connectRecovery([entry,...[1,3,5,7,9].map(i=>chapters[i].entry)]);
 const data=w.data(entry);data.alwaysSkate=false;
 data.groups!.push(...LANTERN_CHAPTERS.map((nm,i)=>({id:10+i,nm,editorOnly:true})));
 return {data,islands:w.islands,recovery:w.recovery,chapters,jumps,far:w.far,finishZ:w.finishZ};
}
