/** Shared authored course frame for the dirt, safety walls and instanced spectators. */
export type RallyPoint = [number,number,number];
export const CART_RALLY_ORIGINAL_LENGTH=2320;
export const CART_RALLY_LENGTH=CART_RALLY_ORIGINAL_LENGTH*2;
export const CART_RALLY_TUNNEL={descent:3180,entry:3240,exit:3400,depth:12} as const;
export const CART_RALLY_MEGA_JUMP={start:3472,end:3558,name:'Tunnel cannon',height:18,runUp:64,drop:20,landingHeight:7,landingLead:60,landingRise:28,landingPlateau:52,landingTail:72} as const;
export interface RallyJump {start:number;end:number;name:string;height?:number;runUp?:number;drop?:number;landingHeight?:number;landingLead?:number;landingRise?:number;landingPlateau?:number;landingTail?:number}
export const CART_RALLY_JUMPS:RallyJump[]=[...[150,310,470,690,850,1010,1230,1390,1550,1770,1930,2090,2420,2810,3760,4180,4380].map((s,i)=>({start:s,end:s+26+(i%3)*4,name:['Dirt double','Mud bowl','Coconut kicker'][i%3]})),CART_RALLY_MEGA_JUMP].sort((a,b)=>a.start-b.start);
export const CART_RALLY_PIPES=[[540,640],[1080,1180],[1620,1720],[2160,2260]] as const;
// Local additions only: keep every original takeoff/landing and the winding
// route outside these two connectors exactly where it was authored.
export const CART_RALLY_CORNER_PATCHES=[{start:510,end:690,radius:80,side:1},{start:1590,end:1770,radius:95,side:-1},
  {start:2500,end:2720,radius:78,side:-1},{start:2900,end:3120,radius:78,side:1},{start:3890,end:4110,radius:78,side:-1}] as const;
export const CART_RALLY_CORNERS=CART_RALLY_CORNER_PATCHES.map(p=>(p.start+p.end)/2);
export const CART_RALLY_SUPPLY_ROWS=[80,410,790,1190,1710,2030,2350,2740,3140,3670,4120,4310];
export const STADIUM={bankStart:17,bankRadius:10,wallOffset:27.4,wallTop:15,standStart:30,rows:9,rowDepth:1.25,rowRise:.85,sectionLength:48,standSegmentLength:8,seatSpacing:1.15} as const;
const smooth=(x:number)=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
const round=(x:number)=>Math.round(x*1e5)/1e5;
function centreX(s:number){return 60*Math.sin(s/240)+24*Math.sin(s/110);}
function authoredRouteX(s:number){
  const jump=CART_RALLY_JUMPS.find(j=>s>j.start-55&&s<j.start+115);
  if(!jump)return centreX(s);
  const at=jump.start,dx=(centreX(at+.1)-centreX(at-.1))/.2;
  const blend=smooth((s-at+55)/20)*smooth((at+115-s)/30);
  return centreX(s)*(1-blend)+(centreX(at)+dx*(s-at))*blend;
}
const cornerShapes=CART_RALLY_CORNER_PATCHES.map(p=>({...p,
  x0:authoredRouteX(p.start),x1:authoredRouteX(p.end),
  m0:(authoredRouteX(p.start+.1)-authoredRouteX(p.start-.1))/.2,
  m1:(authoredRouteX(p.end+.1)-authoredRouteX(p.end-.1))/.2,
}));
function routeX(s:number){
  const p=cornerShapes.find(p=>s>p.start&&s<p.end);if(!p)return authoredRouteX(s);
  const length=p.end-p.start,t=(s-p.start)/length,t2=t*t,t3=t2*t,t4=t3*t,t5=t4*t;
  // Match both original positions and headings; the original jump lanes join
  // without a kink. Four circular arcs add a compact, tighter bend between them.
  const blend=10*t3-15*t4+6*t5;
  const baseline=p.x0*(1-blend)+p.x1*blend+p.m0*length*(t-6*t3+8*t4-3*t5)+p.m1*length*(-4*t3+7*t4-3*t5);
  const quarter=length/4,u=Math.min(s-p.start,p.end-s),r=p.radius;
  const rise=r-Math.sqrt(r*r-quarter*quarter);
  const bend=u<quarter?r-Math.sqrt(r*r-u*u):2*rise-r+Math.sqrt(r*r-(2*quarter-u)**2);
  return baseline+p.side*bend;
}
/** The same broad wet patches tint the dirt and drive wheel/lens spray. */
export function rallyMudWetness(s:number,u:number){return smooth((Math.sin(s*.051+u*.13)+.35)/1.1)*(.65+.35*Math.sin(u*.57+s*.018)**2);}
export function cartRallyFrame(s:number){const dx=(routeX(s+.05)-routeX(s-.05))/.1,n=Math.hypot(1,dx);return {x:routeX(s),dx,n,nx:1/n,nz:dx/n};}
export function stadiumBase(s:number){return 25+1.5*Math.sin(s/210)+.8*Math.sin(s/73);}
export function rallyTunnelDepth(s:number){const t=CART_RALLY_TUNNEL;return t.depth*smooth((s-t.descent)/(t.entry-t.descent))*(1-smooth((s-(t.exit-50))/50));}
export function dirtHeight(s:number){
  let y=stadiumBase(s)-rallyTunnelDepth(s);
  for(const j of CART_RALLY_JUMPS){
    // Two earth mounds, joined by a supported soft-dirt trough. A slow kart can
    // drive the entire section; enough speed carries it over the boggy floor.
    const run=j.runUp??32,height=j.height??6,drop=j.drop??12,rise=j.landingRise??20,tail=j.landingTail??32,landing=j.landingHeight??3.5;
    if(s>=j.start-run&&s<=j.start)y+=height*((s-j.start+run)/run)**2;
    else if(s>j.start&&s<j.start+drop)y+=height*(1-smooth((s-j.start)/drop));
    const approach=j.end-(j.landingLead??8),crest=approach+rise,flatEnd=crest+(j.landingPlateau??0);
    if(s>=approach&&s<crest)y+=landing*smooth((s-approach)/rise);
    else if(s>=crest&&s<flatEnd)y+=landing;
    else if(s>=flatEnd&&s<flatEnd+tail)y+=landing*(1-smooth((s-flatEnd)/tail));
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
/** The exact four corners used by each rendered grandstand tread. */
export function stadiumStandQuad(start:number,end:number,side:number,row:number):[RallyPoint,RallyPoint,RallyPoint,RallyPoint] {
  const lo=side*(STADIUM.standStart+row*STADIUM.rowDepth),hi=side*(STADIUM.standStart+(row+1)*STADIUM.rowDepth),y=15.5+row*STADIUM.rowRise;
  return [stadiumPoint(start,lo,y),stadiumPoint(start,hi,y),stadiumPoint(end,lo,y),stadiumPoint(end,hi,y)];
}
/** Seat roots follow the rendered triangles, not a separately sampled curve.
 * At abrupt changes of heading the latter can put an entire column in mid-air. */
export function stadiumSeatPose(section:{start:number;end:number;side:number},s:number,row:number) {
  const start=section.start+Math.floor((s-section.start)/STADIUM.standSegmentLength)*STADIUM.standSegmentLength;
  const end=Math.min(section.end,start+STADIUM.standSegmentLength),t=(s-start)/(end-start);
  const [a,b,d,e]=stadiumStandQuad(start,end,section.side,row);
  // Across the middle of a row, with the same b--d diagonal as the mesh.
  const points=t<=.5?[a,b,d]:[b,e,d],weights=t<=.5?[.5-t,.5,t]:[1-t,t-.5,.5];
  const position=([0,1,2] as const).map(i=>points.reduce((sum,p,j)=>sum+p[i]*weights[j],0)) as RallyPoint;
  const outwardX=(b[0]-a[0])*(1-t)+(e[0]-d[0])*t,outwardZ=(b[2]-a[2])*(1-t)+(e[2]-d[2])*t;
  return {position,yaw:Math.atan2(outwardX,outwardZ)};
}
export function stadiumSections(){const result:{start:number;end:number;side:number}[]=[];for(let s=-8;s<CART_RALLY_LENGTH+48;s+=STADIUM.sectionLength)for(const side of [-1,1])result.push({start:s,end:Math.min(s+STADIUM.sectionLength,CART_RALLY_LENGTH+48),side});return result;}
/** Segment endpoints are also used verbatim by the editor-native coastwall. */
export function stadiumBoundaryPaths():RallyPoint[][] {
  const paths:RallyPoint[][]=[];
  for(const side of [-1,1]){const p:RallyPoint[]=[];for(let s=-8;s<=CART_RALLY_LENGTH+48;s+=4)p.push(stadiumPoint(s,side*STADIUM.wallOffset,0));paths.push(p);}
  for(const s of [-8,CART_RALLY_LENGTH+48])paths.push([stadiumPoint(s,-STADIUM.wallOffset,0),stadiumPoint(s,STADIUM.wallOffset,0)]);
  return paths;
}

/** Sub-metre corrugations and changing crossfall, independent of the original
 * route/mound envelope. Lips, landing crests, start grid and containment join
 * at their exact authored heights; this never lowers a jump. */
export function rallyMicroHeight(s:number,u:number){
  let envelope=smooth((s-35)/25)*(1-smooth((s-(CART_RALLY_LENGTH-45))/25));
  // The old finish straight joins the extension without rewriting its surface.
  if(s<=CART_RALLY_ORIGINAL_LENGTH)envelope*=1-smooth((s-(CART_RALLY_ORIGINAL_LENGTH-45))/25);
  else envelope*=smooth((s-CART_RALLY_ORIGINAL_LENGTH)/25);
  envelope*=1-smooth((Math.abs(u)-14)/11);
  for(const j of CART_RALLY_JUMPS){
    envelope*=smooth((Math.abs(s-j.start)-12)/14);
    envelope*=smooth((Math.abs(s-j.end)-6)/12);
    envelope*=smooth((Math.abs(s-(j.end-(j.landingLead??8)+(j.landingRise??20)))-6)/12);
    if(j.landingPlateau){const a=j.end-(j.landingLead??8),b=a+(j.landingRise??20)+j.landingPlateau;envelope*=s<a?smooth((a-s)/14):s>b?smooth((s-b)/14):0;}
  }
  const lean=.22*Math.sin(s*.037)*u/14;
  const rolling=.14*Math.sin(s*.21+u*.23)+.075*Math.sin(s*.47-u*.51);
  const rut=-.09*Math.pow(.5+.5*Math.cos(u*2.1+Math.sin(s*.033)),6);
  return envelope*(lean+rolling+rut);
}
export function rallySurfacePoint(s:number,u=0,up=0):RallyPoint {
  const p=cartRallyPoint(s,u,up);p[1]=round(p[1]+rallyMicroHeight(s,u));return p;
}
