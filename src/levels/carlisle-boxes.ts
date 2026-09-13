import type {CustomComponent,CustomGroup,CustomLevelData} from '../level';

type Kind=NonNullable<CustomComponent['kind']>;
export interface CarlisleBoxSection {name:string;mode:'skate'|'foot'|'mixed';group:number;count:number;}
export function buildCarlisleBoxes(original:CustomLevelData){
 const components:CustomComponent[]=[],groups:CustomGroup[]=[],sections:CarlisleBoxSection[]=[];
 let nextGroup=601,current:CarlisleBoxSection;
 const deckY=(index:number,z:number)=>{const c=original.components[index];return c.t==='ramp'?c.p[1]+c.rise!*((c.p[2]+c.len!/2-z)/c.len!):c.p[1]+c.s![1]/2;};
 function box(deck:number,x:number,z:number,kind:Kind='wood',tier=0,group=current.group,outline=false){
  current.count++;
  components.push({t:'crate',p:[x,deckY(deck,z)+tier*.96,z],kind,grp:group,nm:`${current.name}: ${kind} ${current.count}`,...(outline?{outline:true}:{})});
 }
 function section(name:string,mode:CarlisleBoxSection['mode'],build:()=>void){
  current={name,mode,group:nextGroup++,count:0};sections.push(current);groups.push({id:current.group,nm:name});build();
 }
 function stack(deck:number,x:number,z:number,kinds:Kind[]){kinds.forEach((kind,tier)=>box(deck,x,z,kind,tier));}
 function switchStair(deck:number,x:number,z:number){
  const group=nextGroup++;groups.push({id:group,nm:current.name+' switch steps'});
  box(deck,x,z+5,'bang',0,group);
  for(let step=0;step<3;step++)for(let tier=0;tier<=step;tier++)box(deck,x,z-step*1.15,'wood',tier,group,true);
  stack(deck,x,z-3.45,['metal','metal','metal','life']);
 }
 section('Depot departure','mixed',()=>{
  for(const [x,z] of [[-3,-10],[-3,-18],[0,-26],[3,-32]])box(0,x,z);
  stack(0,-6.2,-27,['wood','wood','mystery']);box(0,6,-24,'metal');box(0,6,-30,'bouncy');
 });
 // The nine ramps and every rail entry stay clear: boxes sit on supported
 // flats, with room to build speed, read a landing, or choose the foot route.
 section('Rope approach deliveries','mixed',()=>{
  for(const z of [-90,-98,-106])box(3,-2.8,z);
  stack(3,-3.6,-134,['wood','tnt']);box(3,-4.7,-134,'metal');box(3,-3.6,-140,'mask');
 });
 section('Original side stair rewards','foot',()=>{
  box(16,4,-192,'bouncy');box(17,4,-199);box(18,4,-206,'bouncy');
  box(19,3.3,-213,'life');box(19,4.6,-213,'multihit');
  for(const z of [-171,-178,-215,-220])box(4,-3,z);
 });
 section('Lower street slalom','skate',()=>{
  for(const [x,z] of [[-3,-302],[-3,-311],[0,-320],[3,-326]])box(6,x,z);
  stack(6,3.5,-309,['wood','mystery']);
 });
 section('Rail landing breath','mixed',()=>{
  box(7,3,-434);box(7,3,-453);stack(7,-3.5,-437,['metal','mask']);
 });
 section('Warehouse bounce detour','mixed',()=>{
  for(const z of [-507,-515,-523])box(9,-3,z);
  box(9,3.2,-511,'metalbounce');box(9,3.2,-519,'nitro');box(9,4.4,-519,'nitro');box(9,3.2,-528,'multihit');
 });
 section('Drainage channel line','skate',()=>{
  for(const z of [-681,-689,-697])box(10,0,z);
  for(const [x,z] of [[-1.2,-738],[1.2,-766],[-1.2,-794]])box(11,x,z);
  box(10,3.4,-687,'mask');
 });
 section('Three rail recovery','skate',()=>{
  box(13,-3,-928);box(13,3,-930,'mystery');
 });
 section('Deep street approach','skate',()=>{
  for(const [x,z] of [[-3,-1027],[-3,-1036],[0,-1045],[3,-1054]])box(15,x,z);
  stack(15,3.5,-1066,['wood','mystery']);
 });
 section('Market loading puzzle','mixed',()=>{
  for(const z of [-1089,-1101,-1113])box(31,0,z);
  switchStair(31,-5.2,-1096);
  box(31,5,-1092,'metalbounce');box(31,4.4,-1099,'nitro');box(31,5.6,-1099,'nitro');box(31,5,-1107,'multihit');
 });
 section('Spring delivery lane','mixed',()=>{
  for(const z of [-1134,-1142,-1161,-1169])box(32,-2.8,z);
  for(const z of [-1196,-1218,-1228])box(33,0,z);
  stack(33,3.5,-1206,['metalbounce','mystery']);
 });
 section('Hill climb left line','skate',()=>{
  for(const z of [-1279,-1285,-1303])box(35,-2.8,z);
  for(const z of [-1344,-1353])box(37,-2.8,z);
 });
 section('Upper street choices','mixed',()=>{
  for(const z of [-1414,-1422,-1430])box(39,-2.8,z);
  stack(39,2.7,-1416,['metal','mystery']);
  for(const z of [-1463,-1471,-1479])box(40,-3,z);
  box(40,-3,-1485,'mask');
 });
 section('Lift district cargo','mixed',()=>{
  box(41,-3,-1520);box(41,3,-1535,'mystery');
  box(43,0,-1587);box(43,0,-1594);box(43,2,-1614);
  box(44,5,-1622,'multihit');box(45,-6.2,-1631.5,'life');
 });
 section('Crystal plaza','mixed',()=>{
  box(46,0,-1657,'bouncy');box(46,-5,-1651);box(46,-5,-1676);box(46,5,-1678,'mystery');
  box(47,0,-1696);
 });
 section('Side scroll stepping streets','mixed',()=>{
  box(49,20,-1722.5);box(49,26,-1717.5);box(49,29,-1722.5,'bouncy');
  box(50,49,-1722.5,'mystery');box(51,66,-1722.6);
  stack(52,104,-1717.5,['wood','mask']);box(52,114,-1722.5,'metalbounce');
  box(53,125,-1720,'mystery');box(53,129,-1718,'multihit');
  stack(54,126,-1722.5,['wood','tnt']);box(54,129,-1717.5,'metal');
 });
 section('Crusher timing lane','skate',()=>{
  box(58,155,-1806);box(58,155,-1818);box(58,149,-1824);box(58,149,-1836,'mystery');box(58,148.5,-1839,'life');
 });
 section('Harbour loading puzzle','foot',()=>{
  box(61,152,-1991);box(61,152,-1996,'mask');
  switchStair(61,147.5,-2031);
  box(61,157,-2028,'metalbounce');stack(61,157,-2036,['metal','wood','mystery']);
 });
 section('Split dock decisions','foot',()=>{
  box(62,146.5,-2070);box(62,146.5,-2087,'metalbounce');
  box(63,146.5,-2118,'multihit');box(63,146.5,-2129);
  box(64,157.5,-2081,'tnt');box(64,157.5,-2094,'metalbounce');box(64,157.5,-2098,'nitro');box(64,157.5,-2116,'tnt');box(64,157.5,-2131,'mystery');
 });
 section('Finish runout','skate',()=>{
  box(65,152,-2155);box(66,152,-2173,'mystery');
  box(67,149.5,-2241);box(67,149.5,-2246);box(67,154.5,-2261);
  box(68,149,-2284,'mystery');box(68,155,-2285,'life');
  // Explicit and off the straight finish line: the systemic centre switch
  // must not become the last accidental roadblock.
  box(68,155.5,-2289,'nitrobang');
 });
 return {components,groups,sections};
}
