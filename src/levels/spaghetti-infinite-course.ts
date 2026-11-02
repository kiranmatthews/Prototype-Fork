import type {CustomComponent,CustomLevelData} from '../level';
import type {RaceKnot,RacePoint,SkateRaceData} from '../race/types';
import {roundCorners} from '../pathNodes';

export type SpaghettiPoint=RacePoint;
type P=RacePoint;
export interface SpaghettiRun {name:string;stage:number;choice:number;nodes:P[];radius:number;lanes:number[];gap?:number;dock?:number;jumpEntry?:boolean;}
export interface SpaghettiDock {name:string;p:P;width:number;depth:number;yaw:number;}
export const SPAGHETTI_STAGES=['Three Threads','The Loom','Spine Cascade','Spring Gallery','Cross Stitch','The Unravelling'];
export const SPAGHETTI_LOOP={minY:-144,height:288};
export const SPAGHETTI_CORRIDOR={halfWidth:48,near:40};
const r=(n:number)=>Math.round(n*1000)/1000;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;

export function spaghettiRail(run:SpaghettiRun,offset=0):CustomComponent {
  const p=run.nodes[0];
  return {t:'rail',p:[p[0]+offset,p[1],p[2]],pts:run.nodes.map(q=>[r(q[0]-p[0]),r(q[2]-p[2]),run.radius,r(q[1]-p[1])]),
    curve:'corner',dkind:'citydeck',grp:10+run.stage,nm:run.name};
}
export function spaghettiSamples(c:CustomComponent):P[]{return roundCorners(c.pts!,false).map(q=>[r(c.p[0]+q.x),r(c.p[1]+q.y),r(c.p[2]+q.z)]);}

/** Every rectangular column of the corridor owns a permanent catch terrace.
 * Their union is the whole XZ domain, with overlap at tile edges. Successive
 * terraces descend; none is a dead-end that needs a respawn to leave. */
export function createSpaghettiCourse(platforming=false){
  const span=platforming?96:140,finishZ=-6*span-84,far=finishZ-24;
  const components:CustomComponent[]=[],runs:SpaghettiRun[]=[],line:RaceKnot[]=[];
  const docks:SpaghettiDock[]=Array.from({length:7},(_,i)=>({name:`${i+1} / ${SPAGHETTI_STAGES[i]??'Final descent'}`,
    p:[0,64-i*16,-i*span],width:96,depth:i===0?68:24,yaw:0}));
  const add=(c:CustomComponent)=>components.push(c);
  const slab=(nm:string,p:P,s:P,grp=2,color='#b5c4c5')=>add({t:'platform',nm,p,s,grp,tex:'spaghetti-basalt',color,emissive:'#26333c'});
  const catchEnd=finishZ+18,rows=Math.ceil((40-catchEnd)/24),depth=(40-catchEnd)/rows;
  const shelfTop=(z:number,col:number)=>{
    const row=Math.max(0,Math.min(rows-1,Math.floor((40-z)/depth)));
    if(row>=rows-4)return -90-(row-(rows-4))*2;
    const stage=Math.max(0,Math.min(5,Math.floor((40-(row+.5)*depth)/-span)));
    return 38-stage*16-((Math.floor(row/2)+col)%3)*22;
  };
  for(let row=0;row<rows;row++)for(let col=0;col<3;col++){
    const z=40-(row+.5)*depth,top=shelfTop(z,col);
    slab(`Catch terrace ${row}.${col}`,[(col-1)*32,top-.8,z],[32.08,1.6,depth+.08],5,['#687e89','#738b8b','#899483'][col]);
  }
  for(const [i,d]of docks.entries()){
    slab(`Decision landing / ${d.name}`,[0,d.p[1]-1.2,d.p[2]],[96,2.4,d.depth]);
    add({t:'zone',p:[...d.p],s:[96,1,d.depth],dir:'S',grp:1,nm:`Forward view / ${d.name}`});
    if(platforming&&i>0&&i<6)add({t:'checkpoint',p:[6,d.p[1],d.p[2]+4],grp:3,nm:`Thread ${i+1} checkpoint`});
    if(i<6){
      for(const x of [-26,0,26])add({t:'speedpad',p:[x,d.p[1]+.025,d.p[2]-4],s:[7,.1,4],speed:32,cycle:.65,grp:2,nm:'Thread launch'});
      for(const x of [-12,12])add({t:'crate',kind:platforming?'wood':'mystery',p:[x,d.p[1],d.p[2]+4],grp:3,nm:'Decision landing cargo'});
    }
  }
  line.push([0,64,18,90]);
  const railChoices:NonNullable<SkateRaceData['railChoices']>=[],grinds:NonNullable<SkateRaceData['grinds']>=[];
  for(let stage=0;stage<6;stage++){
    const a=docks[stage].p,b=docks[stage+1].p,names:string[][]=[];
    line.push([...a,90]);
    for(let choice=0;choice<3;choice++){
      const sign=stage%2?-1:1;
      // Strictly increasing forward parameters; rounded corners retain it.
      const braided=stage===2||stage===4;
      const shapes=braided?[[-26,-26,14,30,-12,26,26],[0,0,-7,7,-4,0,0],[26,26,-10,-30,12,-26,-26]]:
        stage===1||stage===5?[[-26,-26,-38,-8,-32,-26,-26],[0,0,-9,0,9,0,0],[26,26,18,38,10,26,26]]:
        [[-26,-26,-35,-20,-7,-26,-26],[0,0,7,-7,4,0,0],[26,26,38,12,34,26,26]];
      const ts=[0,0,.25,.5,.75,1,1],lane=[-26,0,26][choice];
      const tier=braided?6:3;
      const mouth=a[2]-docks[stage].depth/2,receiver=b[2]+docks[stage+1].depth/2;
      const nodes:P[]=ts.map((t,i)=>[
        i<2||i>4?lane:Math.max(-39,Math.min(39,braided?shapes[choice][i]*sign:lane+(shapes[choice][i]-lane)*sign)),
        r(mix(a[1],b[1],t)+.9+(choice===0?-tier:choice===2?tier:0)*Math.sin(Math.PI*t)),
        r(i===0?mouth+10:i===6?receiver-8:mix(mouth-8,receiver+8,t))]);
      const run:SpaghettiRun={name:`${stage+1}.${choice+1} / ${['Low ribbon','Needle line','High weave'][choice]} / thread 1`,stage,choice,nodes,radius:8,lanes:[0]};
      runs.push(run);const rail=spaghettiRail(run),samples=spaghettiSamples(rail);add(rail);names.push([run.name]);
      grinds.push({start:samples[0],end:samples[samples.length-1],lanes:[0]});
    }
    railChoices.push({from:[...a],to:[...b],paths:names});
    // Optional kicker/receiver beside the uninterrupted rails.
    if(stage===0||stage===3||stage===5){
      const x=(stage%2?-1:1)*39,z=a[2]-docks[stage].depth/2-8,y=a[1];
      add({t:'ramp',p:[x,y,z],w:12,len:16,rise:4,yaw:0,tex:'spaghetti-basalt',color:'#cfad78',grp:10+stage,nm:'Forward kicker / amber lip'});
      slab('Kicker receiver / cargo route',[x,y-9.8,z-32],[14,1.6,18],10+stage,'#b9c4bb');
      for(const dx of [-2,0,2])add({t:'crate',kind:platforming?'wood':'mystery',p:[x+dx,y-9,z-32],grp:3,nm:'Kicker reward'});
      add({t:'rail',p:[x,y-8.1,z-38],pts:[[0,0,0,0],[-x*.4,b[2]+7-(z-38),0,b[1]+.9-(y-8.1)]],curve:'corner',dkind:'citydeck',grp:10+stage,nm:'Kicker exit / forward return'});
    }
    if(stage===1||stage===3)add({t:'vertramp',p:[0,a[1]-22,a[2]-span*.51],len:span*.55,w:7,rise:5,arc:84,deck:2,vkind:'half',tex:'spaghetti-basalt',color:'#a0b9b4',grp:10+stage,nm:'Longitudinal halfpipe / lower thread'});
    if(stage===2||stage===4){
      // Rotate the halfpipes across the corridor. Adjacent mouths share an
      // XZ lip, while each receiver sits seven metres lower. Full 90° walls
      // retain the native pump / second-Jump-release spine-transfer move.
      for(let k=0;k<3;k++)add({t:'vertramp',p:[k===1?5:k===2?-4:0,a[1]-12-k*7,a[2]-24-k*18],
        len:48,w:4,rise:5,arc:90,deck:0,yaw:90,vkind:'half',tex:'spaghetti-basalt',color:['#a8c6bb','#cab88b','#93afbe'][k],grp:10+stage,nm:`Spine cascade ${stage}.${k} / forward transfer`});
    }
    if(stage===1||stage===4){
      const z=a[2]-span*.76,x=32,y=shelfTop(z,2);
      add({t:'trampoline',p:[x,y+.03,z],s:[10,.6,9],speed:32,amp:1.25,tex:'solid',color:'#cbaa72',grp:10+stage,nm:'Carlisle spring / return to the weave'});
      slab('Spring receiver',[27,y+21.2,z-30],[16,1.6,20],10+stage,'#c9b894');
      add({t:'crate',kind:platforming?'life':'mystery',p:[27,y+22,z-30],grp:3,nm:'Spring reward'});
    }
    if(platforming){
      const z=a[2]-span*.64,x=stage%2?-32:32,col=x<0?0:2;
      add({t:'enemy',foe:stage%2?'turtle':'hopper',p:[x,shelfTop(z,col),z],range:6,speed:1.3,grp:3,nm:'Lower terrace patrol / jump above'});
      for(let j=0;j<4;j++)add({t:'wumpa',p:[(stage%2?-1:1)*26,a[1]-4-j*.8,a[2]-24-j*5],grp:3,nm:'Weave fruit'});
    }
  }
  const last=docks[6].p;
  line.push([...last,90],[0,-104,finishZ,90]);
  // Upper and recovery routes converge on a single supported finish.
  add({t:'vertramp',p:[0,last[1],last[2]-8],pts:[[0,0,0,0],[0,-22,8,-15],[0,-48,8,-45],[0,finishZ+16-(last[2]-8),0,-72]],
    w:13,rise:3,arc:60,deck:1,vkind:'half',vert:false,tex:'spaghetti-basalt',color:'#a9bfc1',grp:2,nm:'Final gravity ribbon'});
  slab('Finish collector / every route arrives',[0,-105.2,finishZ-3],[96,2.4,44]);
  add({t:'gate',p:[0,-104,finishZ],grp:2,nm:'Spaghetti / shared finish'});
  if(platforming)add({t:'crystal',p:[0,-104,finishZ+8],grp:3,nm:'Spaghetti crystal'});
  line.forEach(p=>add({t:'camnode',p:p.slice(0,3) as P,grp:1}));
  add({t:'camnode',p:[0,-104,finishZ-26],grp:1});
  // Side/end walls bound the guaranteed landing domain, with no floor/ceiling.
  for(const side of [-1,1])add({t:'coastwall',p:[side*49,-144,42],pts:[[0,0],[0,far-44]],w:2,rise:288,grp:90,nm:'Periodic corridor side'});
  for(const z of [41,far-1])add({t:'coastwall',p:[-50,-144,z],pts:[[0,0],[100,0]],w:2,rise:288,grp:90,nm:'Periodic corridor end'});
  const length=line.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-line[i][0],p[1]-line[i][1],p[2]-line[i][2]),0);
  const data:CustomLevelData={v:1,name:platforming?'Spaghetti Rails — Platforming':'Spaghetti Rails',spawn:[0,64.08,18],startWarpPad:false,
    killY:-500,verticalLoop:{...SPAGHETTI_LOOP},sky:'day',keepPlayFog:true,cameraAirLift:1,cameraLookAhead:7,
    cameraRig:{camDist:12,camHeight:8,camPitch:18,camFov:68},alwaysSkate:platforming,hugeDropBail:false,perfectGrindBoost:true,
    allBalanceCrates:false,medalTimes:{gold:platforming?65:55,silver:platforming?90:75,bronze:platforming?120:100},components,
    groups:[{id:1,nm:'Forward camera',editorOnly:true},{id:2,nm:'Decision landings and finish',editorOnly:true},{id:3,nm:'Rewards and lower-route patrols',editorOnly:true},
      {id:5,nm:'Complete XZ catch terraces',editorOnly:true},...SPAGHETTI_STAGES.map((nm,i)=>({id:10+i,nm,editorOnly:true})),{id:90,nm:'Periodic cavern',editorOnly:true}]};
  if(platforming)data.railNavigation={line,railChoices};
  else data.skateRace={v:1,racers:8,seed:270327,gemReward:'win',stages:SPAGHETTI_STAGES,line,jumps:[],grinds,railChoices,finishWidth:90,originalLength:length};
  return {data,docks,runs,far,finishZ,shelfTop};
}
