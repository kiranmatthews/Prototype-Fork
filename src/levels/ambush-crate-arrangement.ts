import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';
import type {CarlisleBoxSection} from './carlisle-boxes';

/** Run only after sculpting: the original cargo/patrol anchors also seed rock geometry. */
export function arrangeAmbushCrates(data:CustomLevelData,original:CustomLevelData){
 const components:CustomComponent[]=[],groups:CustomGroup[]=[],sections:CarlisleBoxSection[]=[];
 let current:CarlisleBoxSection,formation=0;
 const floor=(deck:number)=>{const c=original.components[deck];return c.p[1]+c.s![1]/2;};
 const box=(deck:number,x:number,z:number,kind:CustomComponent['kind'],tier=0,grp=current.group,outline=false,name=current.name)=>{
  components.push({t:'crate',p:[x,floor(deck)+tier*.96,z],kind,grp,outline,nm:name});current.count++;
 };
 const column=(deck:number,x:number,z:number,count:number,kind:CustomComponent['kind']='wood')=>{
  const name=`${current.name} / cargo ${++formation}`;
  for(let tier=0;tier<count;tier++)box(deck,x,z,tier?'mystery':kind,tier,current.group,false,tier?`${name} · upper ${tier}`:name);
 };
 const stagger=(deck:number,x:number,z:number)=>{
  const name=`${current.name} / cargo ${++formation}`;
  // A three-high contact and one low tail both clear at charged board speed.
  for(let tier=0;tier<3;tier++)box(deck,x,z+.48,tier?'mystery':'wood',tier,current.group,false,tier?`${name} · upper ${tier}`:name);
  box(deck,x,z-.48,'wood',0,current.group,false,`${name} · tail`);
 };
 const section=(name:string,mode:CarlisleBoxSection['mode'],build:()=>void)=>{
  current={name,mode,group:9000+sections.length,count:0};sections.push(current);groups.push({id:current.group,nm:name});build();
 };
 const reveal=(deck:number,x:number,z:number,group:number)=>{
  groups.push({id:group,nm:current.name+' / optional reveal'});
  box(deck,x,z+5,'bang',0,group,false,`${current.name} / reveal switch`);
  for(let step=0;step<3;step++)for(let tier=0;tier<=step;tier++)
   box(deck,x,z-step*1.15,'wood',tier,group,true,`${current.name} / revealed cargo ${step}-${tier}`);
 };
 section('01 Depot and rope stores','mixed',()=>{column(0,-3,-18,3);column(3,-2.8,-98,3);column(3,-3.6,-140,4,'mask');});
 section('02 Stair detour and lower street','mixed',()=>{column(19,3.3,-213,4,'life');column(4,-3,-215,3);column(6,-3,-302,3);});
 section('03 Warehouse deferred cargo','mixed',()=>{
  column(7,3,-434,3,'mask');column(9,-3,-515,4);
  box(9,3.2,-519,'nitro',0,current.group,false,'Warehouse deferred Nitro A');
  box(9,4.4,-519,'nitro',0,current.group,false,'Warehouse deferred Nitro B');
  box(9,3.2,-519,'mystery',1,current.group,false,'Warehouse deferred cap');
 });
 section('04 Channel harvests','skate',()=>{column(10,0,-681,3);column(11,-1.2,-738,3);stagger(11,1.2,-794);});
 section('05 Market optional count','mixed',()=>{
  column(13,-3,-928,3);column(15,-3,-1036,3);column(32,-2.8,-1161,4);
  reveal(31,-5.2,-1096,9200);column(31,-5.2,-1108,4);
 });
 section('06 Hill-climb rests','skate',()=>{column(35,-2.8,-1279,3);column(35,-2.8,-1303,3);column(37,-2.8,-1353,4);});
 section('07 Short crest connection','mixed',()=>{column(37,-2.8,-1373,3);column(39,-2.8,-1397,3);});
 section('08 Upper street choices','mixed',()=>{column(39,-2.8,-1414,3);column(40,-3,-1485,3,'mask');column(41,3,-1535,4);});
 section('09 Lift district ledge','mixed',()=>{column(43,0,-1587,3);column(43,2,-1614,3);column(44,5,-1622,4);});
 section('10 High lift and crystal plaza','mixed',()=>{column(45,-6.2,-1631.5,4,'life');column(46,-5,-1676,3);column(50,49,-1722.5,3);});
 section('11 Side-scroll upper choice','mixed',()=>{column(52,104,-1717.5,3,'mask');column(53,125,-1720,3);column(58,155,-1818,4);});
 section('12 Harbour shoulder count','mixed',()=>{column(60,156,-1963.5,3);column(60,146.5,-1960,3,'mask');column(60,156,-1972.5,4);});
 section('13 Harbour local reveal','foot',()=>{column(61,152,-1991,4);reveal(61,147.5,-2031,9201);});
 section('14 Both sides of the dock','foot',()=>{
  column(62,146.5,-2070,3);column(63,146.5,-2118,3);column(63,146.5,-2129,4);
  // Put the retained arrow at the lip: held bounce + double now spans the gap.
  box(62,146.5,-2092.2,'metalbounce',0,current.group,false,'Left dock / retained gap launcher');
  column(64,157.5,-2081,3);column(64,157.5,-2116,3);column(64,157.5,-2131,4);
 });
 section('15 Finish and remote credit','skate',()=>{
  column(66,152,-2173,3);column(67,149.5,-2246,3);column(68,149,-2284,4);
  box(68,155.5,-2289,'nitrobang',0,current.group,false,'Finish / warehouse Nitro credit');
 });
 const roster=new Map<number,NonNullable<CustomComponent['foe']>>([
  [374,'grunt'],[375,'spiker'],[377,'spiker'],[379,'grunt'],[380,'grunt'],[381,'spiker'],[384,'grunt'],
  [385,'spiker'],[387,'grunt'],[388,'grunt'],[389,'spiker'],[390,'grunt'],[391,'spiker'],
  [392,'grunt'],[393,'grunt'],[394,'spiker'],[398,'spiker'],[399,'grunt'],[400,'grunt'],[401,'spiker'],
 ]);
 data.components=data.components.filter(c=>c.t!=='crate'&&(c.t!=='enemy'||roster.has(Number(c.nm?.split(' ').pop()))));
 for(const c of data.components)if(c.t==='enemy'){
  const index=Number(c.nm?.split(' ').pop());c.foe=roster.get(index)!;
  c.speed=index===374?2:index===375?2.2:c.foe==='grunt'?3.2:3;
  c.range=Math.min(c.range??2.5,index===375?2.5:4);
  if(index===375)c.p[2]=-207; // First spiker has a readable approach after the checkpoint.
 }
 data.components.push(...components);data.groups=[...(data.groups??[]).filter(g=>g.id<601||g.id>622),...groups];
 data.crateLayoutRevision=1;
 return {components,sections};
}

/** Keep the sculpted shores and switch-owned native bridge unchanged. */
export function arrangeQuaysideCrates(data:CustomLevelData):void {
 const C=data.components;
 const column=(base:CustomComponent,count:number)=>{
  for(let i=1;i<count;i++)C.push({...base,p:[base.p[0],base.p[1]+i*.96,base.p[2]],kind:'mystery',nm:`${base.nm} · upper ${i}`});
 };
 for(const [name,count]of [['Room 1 fuse: refuge reward',3],['Room 2 bridge: receiver reward',3],['Room 2 bridge: receiver mystery',4]] as const)
  column(C.find(c=>c.nm===name)!,count);
 for(const [x,name,outline]of [[-3,'QUAYSIDE / TEACH / arrival cargo',false],[21,'QUAYSIDE / REST / fuse recovery',false],
  [43,'QUAYSIDE / TEST / bridge cargo',true],[65,'QUAYSIDE / COUNT / exit cargo',false]] as const){
  const base:CustomComponent={t:'crate',kind:'wood',p:[x,0,0],nm:name,grp:outline?21:2,outline};C.push(base);column(base,3);
 }
 data.crateLayoutRevision=1;
}
