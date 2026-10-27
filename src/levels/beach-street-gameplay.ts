import type { CustomComponent, CustomLevelData } from '../level';

type Point = [number, number, number];
type Beat = {name:string; z:number; lane:number; kind:'weave'|'hop'|'freight'|'patrol'|'gap'|'checkpoint'|'rest'; side?:number};
const TEAL='#206474', CORAL='#c55c39', GOLD='#ffe095';

/** Authored phrases. Every exit is free until the next approach; no random
 * spawns, simultaneous combat/jump demands or phase-dependent mandatory lane. */
export const BEACH_KITE_BEATS: readonly Beat[] = [
  {name:'Find the wind',z:20,lane:0,kind:'rest'},
  {name:'Steer right',z:72,lane:3.8,kind:'weave',side:-1},
  {name:'Return left',z:127,lane:-3.8,kind:'weave',side:1},
  {name:'First hop',z:190,lane:0,kind:'hop'},
  {name:'Left then right',z:250,lane:-3.8,kind:'weave',side:1},
  {name:'Complete the S',z:300,lane:3.8,kind:'weave',side:-1},
  {name:'Stair overlook',z:340,lane:0,kind:'rest'},
  {name:'Canal approach',z:370,lane:0,kind:'checkpoint'},
  {name:'First canal',z:430,lane:-3.15,kind:'gap'},
  {name:'Harbour landing',z:500,lane:0,kind:'checkpoint'},
  {name:'Freight right',z:548,lane:3.8,kind:'freight',side:-1},
  {name:'Freight left',z:596,lane:-3.8,kind:'freight',side:1},
  {name:'Hop after the weave',z:650,lane:0,kind:'hop'},
  {name:'Crab crossing',z:730,lane:3.8,kind:'patrol',side:-1},
  {name:'Set up the canal',z:790,lane:-3.8,kind:'weave',side:1},
  {name:'Cliff approach',z:850,lane:0,kind:'checkpoint'},
  {name:'Second canal',z:900,lane:3.15,kind:'gap'},
  {name:'Cliff landing',z:980,lane:0,kind:'checkpoint'},
  {name:'Cliff right',z:1030,lane:3.8,kind:'weave',side:-1},
  {name:'Rising hop',z:1092,lane:3.8,kind:'hop'},
  {name:'Balcony breath',z:1190,lane:3.8,kind:'rest'},
  {name:'Cliff cutback',z:1240,lane:-3.8,kind:'weave',side:1},
  {name:'Turtle crossing',z:1295,lane:-3.8,kind:'patrol',side:1},
  {name:'Surf approach',z:1360,lane:0,kind:'checkpoint'},
  {name:'Surf hop',z:1445,lane:0,kind:'hop'},
  {name:'Surf right',z:1510,lane:3.8,kind:'weave',side:-1},
  {name:'Surf left',z:1560,lane:-3.8,kind:'weave',side:1},
  {name:'Hop out of the S',z:1620,lane:0,kind:'hop'},
  {name:'Spiny crossing',z:1695,lane:3.8,kind:'patrol',side:-1},
  {name:'Festival approach',z:1760,lane:0,kind:'checkpoint'},
  {name:'Third canal',z:1810,lane:-3.15,kind:'gap'},
  {name:'Festival landing',z:1864,lane:0,kind:'checkpoint'},
  {name:'Festival freight right',z:1920,lane:3.8,kind:'freight',side:-1},
  {name:'Festival freight left',z:1970,lane:-3.8,kind:'freight',side:1},
  {name:'Uphill hop',z:2030,lane:0,kind:'hop'},
  {name:'Festival cutback',z:2090,lane:3.8,kind:'weave',side:-1},
  {name:'Terrace breath',z:2150,lane:3.8,kind:'rest'},
  {name:'Festival crossing',z:2200,lane:-3.8,kind:'patrol',side:1},
  {name:'Lighthouse approach',z:2250,lane:0,kind:'checkpoint'},
  {name:'Quay hop',z:2330,lane:0,kind:'hop'},
  {name:'Lighthouse right',z:2400,lane:3.8,kind:'weave',side:-1},
  {name:'Lighthouse left',z:2450,lane:-3.8,kind:'weave',side:1},
  {name:'Low quay hop',z:2510,lane:0,kind:'hop'},
  {name:'Last crossing',z:2570,lane:-3.8,kind:'patrol',side:1},
  {name:'Final canal approach',z:2630,lane:0,kind:'checkpoint'},
  {name:'Last canal',z:2680,lane:3.15,kind:'gap'},
  {name:'Home stretch',z:2740,lane:0,kind:'checkpoint'},
  {name:'Final left',z:2795,lane:-3.8,kind:'weave',side:1},
  {name:'Last stair overlook',z:2840,lane:-3.8,kind:'rest'},
  {name:'Final right',z:2890,lane:3.8,kind:'weave',side:-1},
  {name:'Final hop',z:2950,lane:0,kind:'hop'},
  {name:'Finish runway',z:3005,lane:0,kind:'rest'},
];

/** Suggested fruit line; the player retains continuous, unrestricted steering. */
export function beachKiteLine(z:number):number {
  let previous:Beat={name:'start',z:-15,lane:0,kind:'rest'};
  for(const beat of BEACH_KITE_BEATS){
    const leave=previous.z+(previous.kind==='gap'?25:7);
    const arrive=beat.z-(beat.kind==='gap'?25:17);
    if(z<beat.z+(beat.kind==='gap'?25:7)){
      const t=Math.max(0,Math.min(1,(z-leave)/Math.max(1,arrive-leave)));
      return previous.lane+(beat.lane-previous.lane)*t*t*(3-2*t);
    }
    previous=beat;
  }
  return 0;
}
export const BEACH_KITE_JUMPS=BEACH_KITE_BEATS.filter(b=>b.kind==='hop'||b.kind==='gap')
  .map(b=>({name:b.name,at:b.z-(b.kind==='gap'?4:10),landing:b.z+(b.kind==='gap'?24:19),kind:b.kind}));

export function enhanceBeachStreet(data:CustomLevelData,heightAt:(z:number)=>number){
  // Keep roads, four canals and coloured stair terraces. Retire the old
  // regular crate/enemy scatter and interior rails before composing the run.
  data.components=data.components.filter(c=>{
    if(['enemy','crate','wumpa','checkpoint','speedpad'].includes(c.t))return false;
    if(c.grp===4)return false;
    if(c.t==='rail')return !!c.nm?.includes('boundary');
    if(c.grp===3)return /(?:approach|terrace|step) (2|5|9|10)(?:\.|$)/.test(c.nm??'');
    return true;
  });
  data.kiteTow=true;data.startWarpPad=false;
  data.cameraRig={camDist:12,camHeight:5.4,camPitch:14,camFov:68};
  data.cameraLookAhead=12;data.cameraAirLift=.35;
  const out=data.components;
  const at=(x:number,z:number,y=0):Point=>[x,heightAt(z)+y,-z];
  const put=(c:CustomComponent)=>out.push({...c,grp:11});
  const trim=(name:string,p:Point,s:Point,color=GOLD)=>put({t:'decor',dkind:'block',p,s,color,tex:'solid',solid:false,nm:name});
  for(const beat of BEACH_KITE_BEATS){
    const {name,z,side=1}=beat;
    if(beat.kind==='weave'){
      const x=side*2.7,w=8.2,h=3.1;
      put({t:'wall',p:at(x,z),s:[w,h,2.2],color:TEAL,tex:'bay-paving',nm:`Kite ${name} planter`});
      trim(`${name} cream cap`,at(x,z,h),[w+.08,.12,2.3]);
      for(const dx of [-2.4,0,2.4])put({t:'decor',dkind:'baypot',p:at(x+dx,z,h+.06),s:[.8,.8,.8],solid:false,nm:`${name} flowers`});
    }else if(beat.kind==='hop'){
      put({t:'wall',p:at(0,z),s:[13.5,.85,1.6],color:TEAL,tex:'bay-paving',nm:`Kite ${name} hurdle`});
      trim(`${name} cream lip`,at(0,z,.87),[13.5,.08,1.65]);
      for(const offset of [-11,-8])trim(`${name} jump stripe`,at(0,z+offset,.035),[12,.055,.35],CORAL);
    }else if(beat.kind==='freight'){
      put({t:'crusher',p:at(side*3.55,z),s:[4.7,2.4,3.6],dkind:'baybody',color:'#526779',supports:true,cycle:3.8,phase:side>0?1.9:0,nm:`Kite ${name} load`});
      trim(`${name} warning`,at(side*3.55,z,.04),[5,.08,5],CORAL);
    }else if(beat.kind==='patrol'){
      const foe=z<1000?'grunt':z<1600?'turtle':z<2000?'spiker':'spinner';
      put({t:'enemy',p:at(side*3.8,z),foe,range:foe==='spinner'?0:.65,speed:2.4,nm:`Kite ${name} outer`});
      put({t:'enemy',p:at(side*.5,z+2),foe:foe==='spinner'?'grunt':foe,range:.55,speed:2.1,nm:`Kite ${name} inner`});
    }else if(beat.kind==='checkpoint')put({t:'checkpoint',p:at(0,z),nm:`Kite ${name} checkpoint`});
  }
  // Fruit leads decisions instead of wandering through hazards. Canals retain
  // the existing coral launches; their collectible arcs clear the ramp plane.
  const ramps=out.filter(c=>c.t==='ramp'&&c.grp===2);
  for(let z=12;z<3000;z+=8){
    const x=beachKiteLine(z);let lift=.95;
    const jump=BEACH_KITE_JUMPS.find(j=>z>=j.at&&z<j.landing);
    if(jump)lift+=Math.sin(Math.PI*(z-jump.at)/(jump.landing-jump.at))*2.7;
    for(const ramp of ramps)if(Math.abs(x-ramp.p[0])<ramp.w!/2&&Math.abs(-z-ramp.p[2])<ramp.len!/2)
      lift=Math.max(lift,ramp.p[1]+ramp.rise!*(.5-(-z-ramp.p[2])/ramp.len!)-heightAt(z)+.9);
    put({t:'wumpa',p:at(x,z,lift),nm:`Kite guide ${z}`});
  }
  // Exit rewards are beyond the landing, where a player can settle their line.
  for(const z of [220,680,1120,1475,2060,2360,2978])for(const dz of [0,4])
    put({t:'crate',p:at(beachKiteLine(z+dz),z+dz),kind:'wood',nm:`Kite exit reward ${z+dz}`});
  data.groups=[...(data.groups??[]),{id:11,nm:'Kite run · steer, hop, combine'}];
}
