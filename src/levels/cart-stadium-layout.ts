/** Shared authored course frame for the dirt, safety walls and instanced spectators. */
export type RallyPoint = [number,number,number];
export const CART_RALLY_LENGTH=2320;
export const CART_RALLY_JUMPS=[150,280,410,710,840,970,1270,1400,1530,1830,1970,2110].map((s,i)=>({start:s,end:s+26+(i%3)*4,name:['Dirt double','Mud bowl','Coconut kicker'][i%3]}));
export const CART_RALLY_CORNERS=[570,1130,1690] as const;
export const CART_RALLY_PIPES=CART_RALLY_CORNERS.map(s=>[s-88,s+88] as const);
export const CART_RALLY_SUPPLY_ROWS=[80,410,790,1190,1710,2030];
export const STADIUM={bankStart:17,bankRadius:10,wallOffset:27.4,wallTop:15,standStart:30,rows:9,rowDepth:1.25,rowRise:.85,sectionLength:48,seatSpacing:1.15} as const;
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const round=(x:number)=>Math.round(x*1e5)/1e5;
// Three 90-degree elbows, with straight takeoff/landing lanes between them.
// Integrating a smooth heading change keeps the inside banks/stands from folding:
// minimum centre radius is 58.7m, beyond the outermost 42m grandstand edge.
function routeX(s:number){
  let x=s;
  for(const [i,centre]of CART_RALLY_CORNERS.entries()){
    const start=centre-88,t=Math.max(0,Math.min(1,(s-start)/176));
    const integral=176*(t*t*t-.5*t*t*t*t)+Math.max(0,s-start-176);
    x+=(i%2?2:-2)*integral;
  }
  return x;
}
export function cartRallyFrame(s:number){const dx=(routeX(s+.05)-routeX(s-.05))/.1,n=Math.hypot(1,dx);return {x:routeX(s),dx,n,nx:1/n,nz:dx/n};}
export function stadiumBase(s:number){return 25+1.5*Math.sin(s/210)+.8*Math.sin(s/73);}
export function dirtHeight(s:number){
  let y=stadiumBase(s);
  for(const j of CART_RALLY_JUMPS){
    // Two earth mounds, joined by a supported soft-dirt trough. A slow kart can
    // drive the entire section; enough speed carries it over the boggy floor.
    if(s>=j.start-32&&s<=j.start)y+=6*((s-j.start+32)/32)**2;
    else if(s>j.start&&s<j.start+12)y+=6*(1-smooth((s-j.start)/12));
    if(s>=j.end-8&&s<j.end+12)y+=3.5*smooth((s-j.end+8)/20);
    else if(s>=j.end+12&&s<j.end+44)y+=3.5*(1-smooth((s-j.end-12)/32));
  }
  return y;
}
export function cartRallyPoint(s:number,u=0,up=0):RallyPoint {
  const f=cartRallyFrame(s),t=Math.min(1,Math.max(0,Math.abs(u)-STADIUM.bankStart)/STADIUM.bankRadius);
  const bank=STADIUM.bankRadius*(1-Math.sqrt(Math.max(0,1-t*t)));
  // Mounds fade into the banks, so the outer rim and grandstands stay continuous.
  const mound=(dirtHeight(s)-stadiumBase(s))*(1-smooth((Math.abs(u)-13)/14));
  return [round(f.x+u*f.nx),round(stadiumBase(s)+mound+bank+up),round(-s+u*f.nz)];
}
export function stadiumPoint(s:number,u:number,height:number):RallyPoint {const f=cartRallyFrame(s);return [round(f.x+u*f.nx),round(stadiumBase(s)+height),round(-s+u*f.nz)];}
export function stadiumSections(){const result:{start:number;end:number;side:number}[]=[];for(let s=-8;s<CART_RALLY_LENGTH+48;s+=STADIUM.sectionLength)for(const side of [-1,1])result.push({start:s,end:Math.min(s+STADIUM.sectionLength,CART_RALLY_LENGTH+48),side});return result;}
/** Segment endpoints are also used verbatim by the editor-native coastwall. */
export function stadiumBoundaryPaths():RallyPoint[][] {
  const paths:RallyPoint[][]=[];
  for(const side of [-1,1]){const p:RallyPoint[]=[];for(let s=-8;s<=CART_RALLY_LENGTH+48;s+=4)p.push(stadiumPoint(s,side*STADIUM.wallOffset,0));paths.push(p);}
  for(const s of [-8,CART_RALLY_LENGTH+48])paths.push([stadiumPoint(s,-STADIUM.wallOffset,0),stadiumPoint(s,STADIUM.wallOffset,0)]);
  return paths;
}
