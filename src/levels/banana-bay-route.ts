import type { CustomComponent } from '../level';
import { beachfrontPointAtDistance, beachfrontSandHeight } from '../beachfrontCourse';
import { bayBoardwalk, bayPalm, bayProp, type BayPoint as P } from './banana-bay-theme';

type Kind = NonNullable<CustomComponent['kind']>;
const r=(v:number)=>Math.round(v*1000)/1000;
export const bayCoastPoint=(d:number,lateral=0,y=beachfrontSandHeight(d,lateral)):P=>{
  const p=beachfrontPointAtDistance(d,lateral,y);return [-r(p[0]),r(p[1]),r(p[2])];
};
export const BAY_FINALE_END_Z=-1396;
export const BAY_COAST_BEATS = [
  {name:'Crab landing',a:60,b:105,lateral:0,width:6.8},
  {name:'Split cargo pier',a:146,b:195,lateral:-.8,width:6.4,gap:[170,173]},
  {name:'Fuse store',a:226,b:270,lateral:.2,width:7.4},
  {name:'Turtle terraces',a:291,b:330,lateral:-.6,width:6.2,gap:[310,313.2]},
  {name:'Twin tide gates',a:352,b:393,lateral:0,width:6.4,gap:[369,372.5]},
  {name:'Palm cargo balcony',a:431,b:477,lateral:-1,width:8},
  {name:'Broken jetty',a:507,b:551,lateral:0,width:5.8,gap:[528,532]},
  {name:'Loose board lesson',a:579,b:625,lateral:-.5,width:6.4,gap:[596,607]},
  {name:'Harbour departure',a:650,b:704,lateral:0,width:7},
] as const;

/** The sand is forgiving underneath the first act. All later gaps are over
 * real lagoon water. No invisible hazard is laid across apparently safe sand. */
export function createBananaBayCoast():CustomComponent[] {
  const c:CustomComponent[]=[];
  const surfaces:{a:number;b:number;l:number;w:number;y:number}[]=[];
  for(const [index,beat] of BAY_COAST_BEATS.entries()){
    let y=-Infinity;
    for(let d=beat.a;d<=beat.b;d+=2)for(const l of [beat.lateral-beat.width/2,beat.lateral,beat.lateral+beat.width/2])
      y=Math.max(y,beachfrontSandHeight(d,l));
    y=r(y+1.65);
    const gap='gap' in beat?beat.gap:undefined;
    const spans=gap?[[beat.a,gap[0]],[gap[1],beat.b]]:[[beat.a,beat.b]];
    for(const [part,[a,b]] of spans.entries()){
      const points:P[]=[];
      if(part===0)points.push(bayCoastPoint(a-9,beat.lateral,beachfrontSandHeight(a-9,beat.lateral)+.15));
      for(let d=a;d<b;d+=4)points.push(bayCoastPoint(d,beat.lateral,y));
      points.push(bayCoastPoint(b,beat.lateral,y));
      if(part===spans.length-1)points.push(bayCoastPoint(b+9,beat.lateral,beachfrontSandHeight(b+9,beat.lateral)+.15));
      c.push({...bayBoardwalk(points,beat.width,`${beat.name} / ${part+1}`,71),seed:85200+index*7+part});
      surfaces.push({a,b,l:beat.lateral,w:beat.width,y});
    }
    if(beat.name==='Loose board lesson'){
      const p=bayCoastPoint(601.5,beat.lateral,y);
      c.push({t:'crumble',p,s:[6.4,.45,7],shake:2.2,tex:'plank',color:'#c89758',nm:'Loose boards / learn the warning above safe sand',grp:71});
      surfaces.push({a:598,b:605,l:beat.lateral,w:6.4,y});
    }
    if(gap)for(let j=0;j<5;j++){
      const d=gap[0]-1+(gap[1]-gap[0]+2)*j/4;
      c.push({t:'wumpa',p:bayCoastPoint(d,beat.lateral,y+1+Math.sin(j/4*Math.PI)*1.4),nm:`${beat.name} / jump arc`,grp:72});
    }
  }
  const floor=(d:number,l=0)=>surfaces.find(s=>d>=s.a&&d<=s.b&&Math.abs(l-s.l)<s.w/2)?.y??beachfrontSandHeight(d,l);
  const point=(d:number,l=0,lift=0)=>bayCoastPoint(d,l,r(floor(d,l)+lift));
  const crate=(d:number,l:number,kind:Kind,nm:string,lift=0)=>c.push({t:'crate',p:point(d,l,lift),kind,nm,grp:72});
  const stack=(d:number,l:number,kinds:Kind[],nm:string)=>kinds.forEach((k,i)=>crate(d,l,k,`${nm} / tier ${i+1}`,i*.96));
  const enemy=(d:number,foe:NonNullable<CustomComponent['foe']>,range:number,speed:number,nm:string)=>
    c.push({t:'enemy',p:point(d),foe,range,speed,terrainSupports:true,nm,grp:73});
  const cargo=(d:number,nm:string)=>{
    stack(d,-1.65,['wood','mystery'],`${nm} / seaward consignment`);
    stack(d+2,1.65,['wood','wood'],`${nm} / landward consignment`);
  };
  // A readable first encounter: mask, solitary crab, then a modest cargo stack.
  stack(30,0,['wood','wood'],'Arrival cargo');crate(40,0,'mask','Protection before the first patrol');
  enemy(49,'grunt',2.1,1.3,'First crab / open sand with room to jump or spin');
  cargo(75,'Crab landing cargo');crate(97,0,'mystery','Clear pier reward');
  stack(121,-1.4,['wood','mystery'],'Low sand delivery');crate(125,1.4,'wood','Outside lane delivery');
  enemy(133,'turtle',1.9,1.25,'Turtle introduction / visible open-sand patrol');
  cargo(155,'Split pier takeoff cargo');crate(183,0,'mystery','Split pier landing reward');
  // The launch tool must be kept until the conspicuous overhead parcel is won.
  crate(188,-.8,'bouncy','Split pier / preserve the arrow for the high parcel');
  crate(188,-.8,'life','Split pier / high parcel before the arrow',7.2);
  c.push({t:'wumpa',p:point(188,-.8,4.2),nm:'Vertical fruit clue to the high parcel',grp:72});
  stack(214,1.6,['wood','wood'],'Post-checkpoint picnic');
  // TNT is in a side pocket: there is a visible clear refuge across the deck.
  stack(242,-2,['tnt','wood'],'Fuse store / stomp cargo then retreat to the clear lane');
  crate(251,2,'mystery','Fuse store / safe refuge reward');enemy(261,'grunt',2,1.6,'Fuse store exit crab');
  cargo(298,'Turtle terrace stock');enemy(322,'turtle',1.7,1.45,'Turtle beyond the landing / eight metres of warning');
  stack(342,1.3,['wood','mystery'],'Terrace bank cargo');
  enemy(360,'grunt',1.8,1.7,'Tide gate crab / decide before the gap');
  crate(383,-1.4,'mystery','Tide gate clear landing reward');
  c.push({t:'bonusplatform',p:point(411,-1.5),to:point(416,1),nm:'Lifeguard Lockup / sheltered bonus stop',grp:72});
  crate(406,2.4,'mask','Protection beside the bonus cove');
  cargo(440,'Palm balcony manifests');
  crate(458,-2.3,'nitro','Palm balcony / marked hazardous seaward cargo');
  crate(459.2,-2.3,'nitro','Palm balcony / hazardous cargo pair');
  stack(461,1.5,['wood','mystery'],'Palm balcony / safe landward cargo lane');
  stack(490,-1.2,['wood','wood'],'Headland landing stock');
  cargo(516,'Broken jetty cargo');enemy(541,'grunt',1.5,1.9,'Broken jetty receiver crab / clear landing first');
  crate(564,0,'mask','Protection before the loose board lesson');
  stack(586,-1.3,['wood','mystery'],'Loose board approach cargo');
  crate(617,0,'mystery','Loose board receiver / collect after crossing');
  cargo(662,'Harbour loading stock');enemy(681,'turtle',2,1.5,'Harbour turtle');
  enemy(694,'grunt',2,1.8,'Harbour crab / separated rhythm');crate(701,1.5,'life','Harbour clear reward');
  // Checkpoint boxes stand beyond the sloped deck exits, on level sand.
  for(const [d,nm]of [[119,'First pier cleared'],[205,'Split pier bank'],[282,'Fuse store bank'],[404,'Bonus cove bank'],[489,'Palm balcony bank'],[568,'Broken jetty bank'],[636,'Loose board bank']] as const)
    c.push({t:'checkpoint',p:point(d),nm,grp:72});
  // Inter-encounter crumbs stay near the chosen lane; no arbitrary serpentine
  // fruit line asks players to scrape the cliff or abandon the visible route.
  for(let d=34;d<712;d+=7){
    if(BAY_COAST_BEATS.some(b=>('gap'in b)&&d>b.gap[0]-3&&d<b.gap[1]+3))continue;
    c.push({t:'wumpa',p:point(d,0,.95),nm:'Coastal route breadcrumb',grp:72});
  }
  for(let d=0;d<=715;d+=22)c.push({t:'camnode',p:point(d,0,2),radius:12,nm:`Bay coastal camera ${d}`,grp:5});
  return c;
}

export const bayFinalePoint=(d:number,lateral=0,y=1.05):P=>[r(12*Math.sin(Math.PI*Math.max(0,Math.min(240,d))/240)**2+lateral),y,r(-1138-d)];
export const BAY_FINALE_CROSSINGS=[
  {name:'Salvage steps',a:54,b:91,kind:'steps'},
  {name:'Tidal ferry',a:120,b:138,kind:'ferry'},
  {name:'Breakwater sprint',a:167,b:206,kind:'crumble'},
] as const;

export function createBananaBayFinale():CustomComponent[] {
  const c:CustomComponent[]=[];
  const pier=(a:number,b:number,width=7,y=1.05,nm='Salvage pier')=>{
    const pts:P[]=[];for(let d=a;d<b;d+=4)pts.push(bayFinalePoint(d,0,y));pts.push(bayFinalePoint(b,0,y));
    c.push({...bayBoardwalk(pts,width,nm,74),seed:86100+a});
  };
  const crate=(d:number,l:number,kind:Kind,nm:string,y=1.05)=>c.push({t:'crate',p:bayFinalePoint(d,l,y),kind,nm,grp:75});
  const shelf=(d:number,w:number,len:number,nm:string)=>{
    const p=bayFinalePoint(d,0,.85),pts:[number,number][]=[];
    // The radial shore builder needs a clockwise X/Z outline for upward faces.
    for(let i=0;i<48;i++){const a=i/48*Math.PI*2;pts.push([Math.cos(a)*w/2,-Math.sin(a)*len/2]);}
    c.push({t:'platform',p,s:[w,.64,len],pts,shoreProfile:true,shoreSeaLevel:-.36,shorePhase:d*.13,
      edgeGrinding:false,tex:'sunny-sand',color:'#cbbd9e',nm,grp:74});
    for(const side of [-1,1]){
      const q=bayFinalePoint(d,side*(w/2-2.2),.5);
      c.push(...bayPalm(q,1.0,side*32+d,80));
      c.push(bayProp('sunnyhibiscus',[q[0]+side*.6,.5,q[2]-3],[3.4,2.3,2.9],d,'Salvage garden hibiscus'));
      c.push(bayProp('sunnycliff',[q[0]+side*3,-.8,q[2]+4],[5.6,4,4.8],d,'Salvage island sandstone'));
    }
  };
  // The previous finish island now opens onto a new, coherent third act.
  pier(-8,54,7,1.05,'Salvage departure pier');shelf(30,22,34,'Salvage checkpoint island');
  c.push({t:'checkpoint',p:bayFinalePoint(34),nm:'Salvage steps checkpoint',grp:75});
  crate(15,-1.7,'wood','Departure cargo');crate(15,-1.7,'mystery','Departure cargo cap',2.01);
  c.push({t:'enemy',p:bayFinalePoint(23),foe:'grunt',range:2.2,speed:1.6,nm:'Salvage island crab',grp:76});
  crate(42,1.8,'mask','Protection before the exposed crossings');
  for(const [i,[a,b,y]] of [[57,65,1.65],[68,76,2.25],[79,87,1.65]].entries()){
    pier(a,b,6.4,y,`Salvage stepping pier ${i+1}`);crate((a+b)/2,0,i===1?'mystery':'wood',`Stepping pier ${i+1} cargo`,y);
  }
  pier(90,120,7.5,1.05,'Tidal ferry waiting quay');
  c.push({t:'checkpoint',p:bayFinalePoint(108),nm:'Tidal ferry checkpoint',grp:75});
  crate(99,-1.8,'wood','Ferry waiting cargo');crate(99,1.8,'mystery','Ferry waiting manifest');
  const ferry=bayFinalePoint(129);
  c.push({t:'mover',p:ferry,s:[7,.5,13],axis:'x',amp:4.2,speed:.65,phase:0,tex:'creek-raft',color:'#c89758',nm:'Tidal ferry / wait for the deck to align',grp:74});
  pier(138,167,7.5,1.05,'Breakwater approach');
  c.push({t:'enemy',p:bayFinalePoint(149),foe:'turtle',range:2.3,speed:1.6,nm:'Breakwater turtle / receiver has eleven clear metres',grp:76});
  crate(156,-1.6,'wood','Breakwater salvage');crate(156,-1.6,'mystery','Breakwater salvage cap',2.01);
  c.push({t:'checkpoint',p:bayFinalePoint(162),nm:'Breakwater sprint checkpoint',grp:75});
  for(const [i,d]of [174,185,196].entries())c.push({t:'crumble',p:bayFinalePoint(d,0,1.05),s:[7,.5,8],shake:1.9-i*.1,tex:'plank',color:'#c89758',nm:`Breakwater loose deck ${i+1}`,grp:74});
  pier(204,250,8,1.05,'Lifeguard finish quay');shelf(230,28,54,'Lifeguard finish island');
  crate(212,0,'nitrobang','Lifeguard green switch / clear all marked hazardous cargo');
  for(const [i,l]of [-1.8,0,1.8].entries()){
    crate(221,l,'wood',`Final cargo ${i+1}`);crate(221,l,i===1?'life':'mystery',`Final cargo ${i+1} cap`,2.01);
  }
  c.push({t:'crystal',p:bayFinalePoint(234,0,1.8),nm:'Lifeguard cargo crystal',grp:75},
    {t:'gate',p:bayFinalePoint(243),yaw:0,nm:'Banana Bay finish / all three acts',grp:75},
    {t:'pit',p:[0,-2.9,-1270],s:[220,1,300],invisible:true,nm:'Exposed lagoon recovery below the water',grp:74});
  for(let d=12;d<=252;d+=12)c.push({t:'camnode',p:bayFinalePoint(d,0,2.05),radius:9,nm:`Salvage camera ${d}`,grp:77});
  for(let d=4;d<=238;d+=6){
    if((d>53&&d<91)||(d>119&&d<139)||(d>166&&d<205))continue;
    c.push({t:'wumpa',p:bayFinalePoint(d,0,2),nm:'Salvage route breadcrumb',grp:75});
  }
  for(const [a,b]of [[53,58],[65,69],[76,80],[87,91],[119,125],[133,139],[166,171],[178,182],[189,193],[200,205]])
    for(let i=0;i<3;i++)c.push({t:'wumpa',p:bayFinalePoint(a+(b-a)*i/2,0,2.4+Math.sin(i/2*Math.PI)*1.2),nm:'Salvage jump arc',grp:75});
  for(const [i,d]of [56,114,172,224].entries()){
    const p=bayFinalePoint(d,38+(i%2)*8,-2.2);
    c.push(bayProp('sunnycliff',p,[22,18,17],i*67,'Outer lagoon sandstone stack'));
    c.push(...bayPalm([p[0]-1,9,p[2]],1.4,i*53));
    c.push(bayProp('sunnyhibiscus',[p[0]+2,8,p[2]+2],[5,3.4,4.2],i*29,'Outer lagoon flowering ledge'));
  }
  return c;
}
