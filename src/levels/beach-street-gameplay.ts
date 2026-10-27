import type { CustomComponent, CustomLevelData } from '../level';

type Enemy = NonNullable<CustomComponent['foe']>;
type Point = [number, number, number];
const TEAL = '#206474', CORAL = '#c55c39', GOLD = '#ffe095', DARK = '#243b50';
export const BEACH_STREET_ENCOUNTERS: readonly [string, number, number, Enemy, number, number][] = [
  // Name, station, lane, species, patrol half-width, speed. Patrols stay off
  // landing zones and checkpoints; pairs ask for different attack decisions.
  ['Market greeting', 92, 0, 'grunt', 3.6, 2.5],
  ['Market turtle', 164, -3.1, 'turtle', 1.7, 2.8],
  ['Market hop', 198, 2.5, 'hopper', 2.4, 3.1],
  ['Market crossfire', 252, 0, 'grunt', 4.4, 3.2],
  ['Market bristles', 278, -3.6, 'spiker', 1.1, 2.5],
  ['Harbour crab', 368, 3.4, 'grunt', 1.5, 3.2],
  ['Canal whirler', 474, -3.5, 'spinner', 0, 0],
  ['Canal turtle', 490, 2.7, 'turtle', 2.1, 2.7],
  ['Freight frog', 553, 3, 'hopper', 1.7, 3.6],
  ['Freight guard', 565, -3.7, 'sentry', 0, 0],
  ['Canal crossing', 636, 0, 'grunt', 4.4, 3.6],
  ['Raised plaza bristles', 704, 3.6, 'spiker', 1.2, 3],
  ['Raised plaza turtle', 778, 2.9, 'turtle', 1.8, 3.2],
  ['Works whirler', 846, 3.6, 'spinner', 0, 0],
  ['Cliff arrival', 936, -3.1, 'hopper', 1.8, 3.5],
  ['Cliff bull', 1027, 0, 'charger', 4, 2.7],
  ['Cliff sentry', 1174, 4.3, 'sentry', 0, 0],
  ['Cliff bristles', 1227, -3.7, 'spiker', 1.2, 3.1],
  ['Descent glider', 1306, 3.7, 'floater', 1.4, 2.6],
  ['Surf turtle', 1404, -3.6, 'turtle', 1.3, 3.1],
  ['Surf leap', 1454, 3.4, 'hopper', 1.6, 3.8],
  ['Arcade crab', 1523, 0, 'grunt', 4.1, 4],
  ['Arcade bristles', 1594, -3.6, 'spiker', 1.3, 3.4],
  ['Arcade whirler', 1634, 3.8, 'spinner', 0, 0],
  ['Low plaza frog', 1721, -3.5, 'hopper', 1.4, 4.1],
  ['Low plaza turtle', 1762, 3.5, 'turtle', 1.4, 3.5],
  ['Festival greeting', 1847, 3.6, 'grunt', 1.3, 4],
  ['Festival glider', 1918, -3.5, 'floater', 1.7, 3.1],
  ['Festival bull', 1976, 0, 'charger', 4.1, 3],
  ['Festival frog', 2078, 0, 'hopper', 2.8, 4.3],
  ['Festival whirler', 2159, 2.9, 'spinner', 0, 0],
  ['Festival guard', 2224, -3.8, 'sentry', 0, 0],
  ['Quay turtle', 2316, -3.7, 'turtle', 1.2, 3.7],
  ['Quay bristles', 2356, 3.5, 'spiker', 1.4, 3.6],
  ['Lighthouse bull', 2462, 0, 'charger', 4.2, 3.2],
  ['Lighthouse guard', 2564, 4, 'sentry', 0, 0],
  ['Lighthouse hop', 2628, -3.5, 'hopper', 1.5, 4.2],
  ['Final glider', 2736, -3.4, 'floater', 1.6, 3.1],
  ['Final crab', 2788, 0, 'grunt', 4.3, 4.3],
  ['Promenade turtle', 2906, 3.7, 'turtle', 1.2, 3.8],
  ['Promenade bristles', 2960, -3.5, 'spiker', 1.4, 3.6],
];

/** Course-only composition. Uses the ordinary editor/runtime primitives. */
export function enhanceBeachStreet(data: CustomLevelData, heightAt: (z:number)=>number) {
  data.components = data.components.filter(c=>c.t!=='enemy');
  const out = data.components;
  const put = (c:CustomComponent) => out.push({...c,grp:11});
  const at = (x:number,z:number,y=0):Point => [x,heightAt(z)+y,-z];
  const trim = (name:string,p:Point,s:Point,color=GOLD) => put({t:'decor',dkind:'block',p,s,color,tex:'solid',solid:false,nm:name});
  const crate = (x:number,z:number,kind:CustomComponent['kind']='wood',y=0) => put({t:'crate',p:at(x,z,y),kind,nm:`Beach Street ${kind} reward ${z}`});
  const fruit = (x:number,z:number,y=0) => put({t:'wumpa',p:at(x,z,y+.85),nm:`Beach Street route fruit ${z}`});
  const bank = (name:string,x:number,z:number,length=8,rise=1.2,width=3.4) => {
    const base=heightAt(z);
    put({t:'ramp',p:at(x,z),len:length,rise,w:width,color:CORAL,tex:'bay-terracotta',nm:name});
    // The lip and rails are above the actual sloping deck, never another floor.
    trim(`${name} lip`,[x,base+rise+.025,-(z+length/2)],[width,.045,.22]);
    for(const side of [-1,1])put({t:'rail',p:[x+side*(width/2-.1),base+.07,-(z-length/2)],
      pts:[[0,0,0,0],[0,-length,0,rise]],nm:`${name} coping`});
    put({t:'wumpa',p:[x,base+rise+.85,-(z+length/2)],nm:`${name} lip reward`});
  };
  const planter = (name:string,x:number,z:number,width=5.6) => {
    const y=heightAt(z);
    put({t:'wall',p:[x,y,-z],s:[width,.95,1.7],tex:'bay-paving',color:TEAL,nm:name});
    trim(`${name} cream coping`,[x,y+.96,-z],[width+.12,.12,1.82]);
    for(const dx of [-width*.32,width*.32])put({t:'decor',dkind:'baypot',p:[x+dx,y+1.03,-z],s:[.95,.88,.86],solid:false,nm:`${name} flowers`});
  };
  const cargo = (name:string,x:number,z:number,width=2.1,height=1.65) => {
    put({t:'platform',p:at(x,z,height/2),s:[width,height,2.3],tex:'wood',color:DARK,nm:name});
    trim(`${name} cap`,at(x,z,height+.03),[width,.08,2.3]);
    for(const dx of [-width*.35,width*.35])trim(`${name} brass binding`,at(x+dx,z,height/2),[.12,height+.1,2.38]);
  };
  const chicane = (name:string,z:number,side=1) => {
    planter(`${name} first`,side*3.5,z,7.2);
    planter(`${name} return`,-side*3.5,z+16,7.2);
    fruit(-side*3.6,z);fruit(side*3.6,z+16);crate(side*3.4,z+25);
  };
  const freight = (name:string,z:number,side:number) => {
    // Alternating drops leave a complete opposite lane open. A raised cargo
    // route earns fruit above the pressure lane; no hidden full-width trap.
    for(let i=0;i<2;i++) {
      const x=(i? -side:side)*3.5, station=z+i*15;
      put({t:'crusher',p:at(x,station),s:[3.7,2.4,3.4],dkind:'baybody',color:'#526779',supports:true,cycle:3.4,phase:i*1.7,nm:`${name} cargo drop ${i+1}`});
      for(const dz of [-2,2])trim(`${name} warning threshold`,at(x,station+dz,.035),[3.9,.06,.45],CORAL);
    }
  };
  const transfer = (name:string,z:number,x:number) => {
    bank(`${name} launch`,x,z,8,1.5,3.3);
    put({t:'platform',p:at(x,z+7,1.15),s:[3.3,.7,6],color:TEAL,tex:'bay-paving',nm:`${name} landing`});
    trim(`${name} landing edge`,[x,heightAt(z+7)+1.53,-(z+9.8)],[3.3,.055,.25]);
    put({t:'crumble',p:at(x,z+14,1.5),s:[3.2,.55,4.5],shake:.85,color:CORAL,tex:'wood',nm:`${name} loose boardwalk`});
    put({t:'platform',p:at(x,z+21,1.15),s:[3.3,.7,6],color:TEAL,tex:'bay-paving',nm:`${name} reward deck`});
    crate(x,z+20,'mystery',1.5);fruit(x,z+14,1.5);
  };

  chicane('Market flower weave',126,1);
  bank('Market loading bank',-3.5,221,9,1.35);
  cargo('Market delivery stack',-3.5,230,3.3,1.35);
  crate(-3.5,230,'mystery',1.35);
  chicane('Harbour courtyard weave',306,-1);
  freight('Canal freight',531,-1);
  cargo('Freight sentry cover',-3.5,555,2.8,1.8);
  chicane('Canal terrace weave',663,1);
  transfer('Canal boardwalk transfer',804,3.5);
  freight('Cliff crane',951,-1);
  cargo('Clifftop sentry cover',3.7,1162,2.9,1.8);
  transfer('Clifftop balcony transfer',1260,-3.5);
  chicane('Surf promenade weave',1382,1);
  bank('Surf bank left',-3.6,1548,10,1.6);
  bank('Surf bank right',3.6,1572,10,1.6);
  cargo('Surf ramp landing',3.6,1581,3.4,1.6);
  crate(3.6,1581,'mystery',1.6);
  freight('Arcade delivery',1668,-1);
  chicane('Festival flower weave',1929,1);
  for(const [z,x,phase] of [[2009,3.4,0],[2090,-3.5,1.3],[2329,3.5,.7]] as const) {
    put({t:'pendulum',p:at(x,z,5.4),len:4.5,amp:.62,speed:1.6,phase,nm:`Festival swinging cargo ${z}`});
    trim(`Swing clearance ${z}`,at(x,z,.035),[4.4,.06,2.8],CORAL);
  }
  cargo('Festival sentry cover',-3.7,2211,2.9,1.8);
  chicane('Lighthouse switchback',2374,-1);
  freight('Lighthouse cargo',2492,1);
  cargo('Lighthouse sentry cover',3.8,2551,2.9,1.8);
  transfer('Lighthouse boardwalk transfer',2582,3.5);
  chicane('Final promenade weave',2750,1);
  bank('Final reward bank',-3.6,2925,10,1.65);
  cargo('Final reward landing',-3.6,2934,3.4,1.65);
  crate(-3.6,2934,'life',1.65);

  // Optional explosive lanes are readable, spaced from landing/checkpoint
  // footprints, and offer a parallel safe lane. Never random nitro placement.
  for(const [x,z] of [[-3.5,604],[3.7,1338],[-3.6,1749],[3.6,2260],[-3.7,2642]] as const) {
    crate(x,z,'tnt');crate(x,z+3.6,'wood');fruit(-Math.sign(x)*3.5,z+2);
  }
  for(const [name,z,x,foe,range,speed] of BEACH_STREET_ENCOUNTERS)
    put({t:'enemy',p:at(x,z),foe,range,speed,nm:name});
  // Masks give two recovery opportunities before the denser second half.
  crate(3.6,587,'mask');crate(-3.6,1836,'mask');
  // Route fruit keeps its original station/lane, but clears the real surface.
  // The imported gap approach fruit used road height inside the launch ramp;
  // a few stair/climb pickups had the same problem.
  const surfaces=out.filter(c=>c.solid!==false&&(c.t==='platform'||c.t==='ramp'));
  for(const [i,c] of out.entries())if(c.t==='wumpa'){
    let top=-Infinity;
    for(const s of surfaces){
      const a=(s.yaw??0)*Math.PI/180,dx=c.p[0]-s.p[0],dz=c.p[2]-s.p[2];
      const x=dx*Math.cos(a)-dz*Math.sin(a),z=dx*Math.sin(a)+dz*Math.cos(a);
      const w=s.s?.[0]??s.w??0,d=s.s?.[2]??s.len??0;
      if(Math.abs(x)>w/2||Math.abs(z)>d/2)continue;
      top=Math.max(top,s.t==='platform'?s.p[1]+s.s![1]/2:s.p[1]+s.rise!*(.5-z/d));
    }
    if(c.p[1]<top+.6)out[i]={...c,p:[c.p[0],top+.85,c.p[2]]};
  }
  // A new planter or bank must not swallow an old grind line. Cut only the
  // affected freestanding spans: the visible rail ends advertise an ollie
  // transfer, while boundary rails, gap bridges and stair handrails stay exact.
  const obstacles=out.filter(c=>c.grp===11&&['platform','wall','ramp'].includes(c.t));
  data.components=out.flatMap(c=>{
    if(c.t!=='rail'||!/^street rail \d+$/.test(c.nm??'')||!c.pts)return [c];
    const points=c.pts.map(p=>({z:-(c.p[2]+p[1]),y:c.p[1]+(p[3]??0)}));
    const start=points[0].z,end=points[points.length-1].z;
    const cuts=obstacles.filter(o=>Math.abs(o.p[0]-c.p[0])<(o.s?.[0]??o.w??0)/2+.2)
      .map(o=>({a:-o.p[2]-(o.s?.[2]??o.len??0)/2-1.1,b:-o.p[2]+(o.s?.[2]??o.len??0)/2+1.1}))
      .filter(o=>o.b>start&&o.a<end).sort((a,b)=>a.a-b.a);
    if(!cuts.length)return [c];
    const spans:[number,number][]=[];let cursor=start;
    for(const cut of cuts){if(cut.a>cursor+2)spans.push([cursor,Math.min(cut.a,end)]);cursor=Math.max(cursor,cut.b);}
    if(end>cursor+2)spans.push([cursor,end]);
    const yAt=(z:number)=>{
      const i=Math.max(0,points.findIndex(p=>p.z>=z)-1),a=points[i],b=points[Math.min(i+1,points.length-1)];
      return a.y+(b.y-a.y)*(z-a.z)/Math.max(.001,b.z-a.z);
    };
    return spans.map(([a,b],i)=>{
      const y=yAt(a),stations=[a,...points.map(p=>p.z).filter(z=>z>a&&z<b),b];
      return {...c,p:[c.p[0],y,-a] as Point,pts:stations.map(z=>[0,-(z-a),0,yAt(z)-y] as [number,number,number,number]),nm:`${c.nm} / clear span ${i+1}`};
    });
  });
  data.groups = [...(data.groups??[]),{id:11,nm:'Beach Street district challenges'}];
}
