import type {CustomComponent,CustomLevelData} from '../level';
import {EASY_BONUS_LEVEL} from './bonus-easy';
import {buildCreekBank,buildCreekCollision,type CreekBank} from './custard-terrain';

type P=[number,number,number];
const C:CustomComponent[]=[];
export const CUSTARD_BONUS_VIEWS=[
  ['01-arrival',-12],['02-towpath',-4],['03-first-hop',5.4],['04-raised-cache',12],
  ['05-second-hop',19],['06-reedbank',26.5],['07-mill-view',34.5],['08-rewards',42],['09-return',47],
] as const;
const sampler={point:(s:number,y=0,u=0):P=>[s,y,u],height:()=>0};
const prop=(dkind:CustomComponent['dkind'],p:P,s:P,yaw=0,nm='Custard bonus scenery',color='#ffffff')=>
  C.push({t:'decor',dkind,p,s,yaw,color,scenerySolid:false,solid:false,edgeGrinding:false,grp:91,nm});

// The established 18-box route, two 2m gaps and single-plane controls survive
// the art rebuild. The visible sculpted rock cap owns every ground contact.
for(const [a,b,y] of [[-16,2,0],[4,20,.35],[22,54,0]]){
  const anchors=EASY_BONUS_LEVEL.components.filter(c=>['crate','gate'].includes(c.t)&&c.p[0]>=a&&c.p[0]<=b)
    .map(c=>({s:c.p[0],u:0,y,radius:1.3,along:1.7}));
  anchors.push({s:a+2,u:0,y,radius:1.8,along:2},{s:b-1,u:0,y,radius:1.8,along:2});
  const bank:CreekBank={a,b,top:y,width:6.4,offset:0,minHalf:2.85,protected:anchors,
    name:'Custard bonus moss-capped sandstone shelf',group:1,spacing:1,bare:()=>.84};
  const rock=buildCreekBank(sampler,bank);
  for(const c of rock){c.tex='custard-sandstone';c.color='#fff6e5';
    // Keep the source-ledged profile, with warm untinted sandstone away from
    // the moss rim; source vertex colours describe material, not baked light.
    if(c.colors)for(let i=0;i<c.colors.length;i+=3){const g=c.colors[i+1]>c.colors[i]*1.12;
      c.colors.splice(i,3,...(g?[.60,.63,.29]:[1,.96,.87]));}
  }
  C.push(...rock,...buildCreekCollision(sampler,bank));
  for(let x=a+.8,i=0;x<b-.6;x+=1.15,i++)for(const z of [-2.75,2.75]){
    prop(i%3?'coastv2grass':'coastv2grassb',[x,y-.07,z],[1.3,.35,1.2],i*73,'Custard bonus fine grass fringe','#f2edcc');
    if(i%3===0)prop('coastfern',[x+.2,y-.11,z-.15],[1.25,.68,1.1],i*91,'Custard bonus fern fringe','#d7dd9c');
    if(i%4===1)prop('coastcarpet',[x,y-.2,z],[2.2,.45,1.3],i*41,'Custard bonus moss fringe','#e5e5b7');
  }
  for(let x=a+2,i=0;x<b-1;x+=4.1,i++)for(const z of [-3.4,3.4])
    prop('custardboulder',[x,y-4.4,z],[4.8,4.437,4.137],i*67,'Custard bonus eroded stone face','#fff9e6');
}
for(const c of EASY_BONUS_LEVEL.components)if(c.t!=='platform')C.push(JSON.parse(JSON.stringify(c)));
for(const c of C)if(c.t==='gate')c.nm='Custard bonus return above the millpond';

// Three real depth bands: generated distant valley, alpha woodland, then
// individually instanced meshy trees/rock/mill silhouettes and live water.
prop('custardvalley',[19,-27,-74],[258,86.9,.02],0,'Custard bonus distant sunset valley');
prop('custardforest',[17,-11.0,-39],[135,24,.02],0,'Custard bonus middle woodland');
for(const [x,z,,width,yaw] of [[-25,-23,10,13,18],[-3,-30,10,13,150],[23,-29,9,12,90],[47,-29,10,13,240],[67,-22,10,13,18]])
  prop('custardwillow',[x,-3,z],[width,width*.97936,width*.97309],yaw,'Custard bonus rooted riverside tree','#fffaea');
for(let x=-30,i=0;x<=75;x+=8.5,i++){
  const z=-14-3*Math.sin(i*1.7);
  prop('custardboulder',[x,-6.1,z],[6.8,6.286,5.86],i*37,'Custard bonus far-bank rock','#fff9e6');
  prop('coastfern',[x+3,-2.4,z+2],[3.6,1.9,3.1],i*59,'Custard bonus fern garden','#e1dc9d');
  prop('treehousesugarcane',[x-2,-3.3,z+3],[3,3.5,2.7],i*19,'Custard bonus reedbed','#c8c987');
}
prop('custardmill',[-20,-2.7,-21],[7,7.96,7.559],8,'Custard bonus riverside mill','#fff9e6');
prop('custardfallcliffs',[54,-7,-55],[64,21.3,.02],0,'Custard bonus distant waterfall');
prop('coastv2buttress',[-14,-8,-18],[14,8,10],24,'Custard bonus mill foundation','#f4d2a1');
// A continuous live millpond passes through the two gaps, never supporting
// the player. Water death presentation is shared with the parent creek.
C.push({t:'mesh',p:[19,-2.8,-25],vertices:[-110,0,-65,110,0,-65,110,0,43,-110,0,43],
  indices:[0,2,1,0,3,2],uvs:[0,0,32,0,32,20,0,20],solid:false,materialStyle:'jungle-stream',tex:'custard-water',color:'#69a28d',opacity:.88,
  nm:'Custard Creek water ribbon',grp:92,lethal:true,castShadow:false,edgeGrinding:false});
for(const [a,b] of [[2,4],[20,22]])C.push({t:'pit',p:[(a+b)/2,-3.1,0],s:[b-a,1,9],invisible:true,nm:'Custard bonus water contact',grp:92});

export const CUSTARD_BONUS_LEVEL:CustomLevelData={
  ...EASY_BONUS_LEVEL,name:'Bonus: Willowmill Cache',sky:'sunset',killY:-9,
  jungleAtmosphere:true,jungleStyle:'painterly',jungleDepthFade:false,keepPlayFog:true,
  atmosphere:{fogEnabled:true,fogNear:48,fogFar:180,fogColor:'#c8ab83',ambientSky:'#e4dac1',ambientGround:'#9a8860',
    ambientIntensity:1.65,sunColor:'#ffdab0',sunIntensity:2.0,fillColor:'#c4d8ce',fillIntensity:.58,shadowStrength:.72,
    sunDirection:[-.7,.65,.3],drawDistance:250,backdrop:'painted sky',fallbackTop:'#ddbcaf',fallbackBottom:'#ffda99',
    fallbackFog:'#c8ab83',fallbackSunColor:'#ffe3a4',fallbackSunU:.2,fallbackSunV:.4,fallbackStars:false,fallbackRidges:false},
  components:C,groups:[...EASY_BONUS_LEVEL.groups!,{id:91,nm:'Storyboard · layered willow millpond'},{id:92,nm:'Storyboard · live creek water'}],
};
