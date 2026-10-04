import type {CustomComponent} from '../level';
type P=[number,number,number];
interface ShowContext {
  point:(s:number,y?:number,u?:number)=>P;
  height:(s:number)=>number;
  yaw:(s:number)=>number;
  rooms:{a:number;b:number;width:number;ceiling:number;id:number}[];
}

/** Hand-composed show beats following the three ImageGen chamber mockups.
 * Render silhouettes are actual Meshy assets; invisible simple masses retain
 * the established collision toolkit underneath them. */
export function addGhostTrainShowScenes(C:CustomComponent[],q:ShowContext):void {
  const {point,height,yaw}=q;
  const add=(c:CustomComponent)=>C.push(c);
  const prop=(kind:NonNullable<CustomComponent['dkind']>,s:number,u:number,base:number,scale:number,angle=yaw(s),name='Meshy castle show sculpture',grp=10)=>
    add({t:'decor',dkind:kind,p:point(s,base,u),w:scale,
      ...(kind==='ghostcart'?{s:[scale*.511794,scale*.500941,scale] as P}:{}),
      yaw:angle,solid:false,grp,nm:name});
  const light=(s:number,u:number,above:number,target:P,color:string,power:number,family=0,grp=10)=>
    add({t:'decor',dkind:'ghostshowlight',p:point(s,height(s)+above,u),to:target,color,amp:power,w:.66,rise:30,vr:family,n:1,grp,nm:'Authored hero sculpture light'});
  const floorTile=(s:number,u:number,top:number,scale=2,grp=10)=>
    prop('ghostflagstone',s,u,top-.040052*scale,scale,yaw(s),'Meshy flagstone show platform',grp);
  const table=(s:number,u:number,top:number,grp:number,angle=yaw(s))=>{
    const scale=1.30/.382,base=top-.382*scale,width=.489342*scale,depth=scale;
    add({t:'platform',p:point(s,(base+top)/2,u),s:[width,top-base,depth],yaw:angle,invisible:true,
      edgeGrinding:false,tex:'castle-timber',color:'#ffffff',grp,nm:'Supported real banquet table footprint'});
    prop('ghostbanquettable',s,u,base,scale,angle,'Meshy claw-foot feast table',grp);
  };
  const display=(kind:'ghostfood'|'ghostcake'|'ghostknight',s:number,u:number,feet:number,h:number,angle:number,grp:number,variant=0)=>
    add({t:'decor',dkind:kind,p:point(s,feet,u),s:[h*.66,h,h*.65],yaw:angle,vr:variant,grp,nm:'Staged mechanical castle performer'});
  const wall=(s:number,u:number,base:number,angle:number,grp:number,h=5.4)=>
    prop('ghostwallbay',s,u,base,h,angle,'Meshy inset leadlight and carved window bay',grp);
  const chandelier=(s:number,anchor:number,width:number,grp:number)=>
    prop('ghostchandelier',s,0,anchor-.98655*width,width,yaw(s),'Meshy bronze candle chandelier',grp);
  const dais=(s:number,u:number,top:number,width:number,depth:number,grp:number)=>{
    const base=height(s);
    add({t:'platform',p:point(s,(base+top)/2,u),s:[width,top-base,depth],yaw:yaw(s),invisible:true,
      edgeGrinding:false,tex:'castle-stone',color:'#ffffff',grp,nm:'Supported raised feast dais'});
    for(let dz=-depth/2+.9;dz<depth/2;dz+=1.8)for(let dx=-width/2+.95;dx<width/2;dx+=1.9)floorTile(s+dz,u+dx,top,2,grp);
  };

  // Boarding/axe reveal: the face and blade are directly beyond the coupled
  // cars, framed by close leadlight bays and genuine armour sculptures.
  const boarding=10,doorS=125,doorY=height(doorS);
  prop('ghostmonsterportal',doorS,0,doorY,8.2,yaw(doorS),'Monstrous boarding mouth and axe reveal',boarding);
  for(const side of [-1,1]) {
    for(const s of [108,119,139])wall(s,side*5.7,height(s)+.08,yaw(s)+(side<0?90:-90),boarding);
    display('ghostknight',120,side*3.35,height(120)+.1,2.7,yaw(120)+(side<0?-28:28),boarding);
    for(const s of [109,115,132,140])light(s,side*4.35,3.6,point(s+5,height(s+5)+2,side*2.9),side<0?'#40d889':'#ac43cb',90,side<0?1:2,boarding);
  }
  chandelier(116,height(116)+8.3,3.4,boarding);
  light(118,-3.5,5.4,point(125,doorY+4.8),'#83ff46',140,0,boarding);
  light(128,3.5,5.0,point(125,doorY+4.8),'#35c78f',95,1,boarding);

  // One banquet theatre instead of a row of identical dining rooms. The
  // center line remains open; a low U-shaped feast dais forms its backdrop.
  const feast=12;
  for(const side of [-1,1]) {
    for(const s of [590,601,614])wall(s,side*9.6,height(s)+.12,yaw(s)+(side<0?90:-90),feast,6.5);
    for(const s of [589,592.4,595.8])table(s,side*5.1,height(s)+1.30,feast);
    const top=height(614)+.55;
    dais(614,side*5.3,top,3.5,8.4,feast);
    for(const s of [611.7,615.1])table(s,side*5.3,top+1.30,feast);
    display('ghostknight',603,side*7.5,height(603)+.4,3.0,yaw(603)+(side<0?-65:65),feast);
    light(600,side*7.8,5.2,point(604,height(604)+3,side*5.2),side<0?'#76f64f':'#b65abe',130,side<0?1:2,feast);
  }
  display('ghostcake',590,-5.1,height(590)+1.33,2.2,yaw(590)+28,feast,1);
  display('ghostfood',614,-5.3,height(614)+1.89,2.05,yaw(614)+25,feast,0);
  display('ghostcake',614,5.3,height(614)+1.89,1.6,yaw(614)-25,feast,2);
  chandelier(603,height(603)+8.2,4.1,feast);
  prop('ghostmonsterportal',625,0,height(625),8.0,yaw(625),'Feast theatre monstrous fireplace passage',feast);
  light(593,-7,4.4,point(590,height(590)+2.6,-5.1),'#b5ff6a',140,0,feast);
  light(616,-7.5,5.5,point(614,height(614)+2.9,-5.3),'#74ff9b',140,0,feast);
  light(621,4.6,6.5,point(625,height(625)+4.5),'#b77aff',110,2,feast);

  // Layered crypt silhouettes: near props establish scale, low ruined bays
  // create abyss depth, and the monster mouth frames the first receiving line.
  const crypt=15,portalS=1505,railY=height(portalS)+.48;
  prop('ghostmonsterportal',portalS,0,railY,8.2,yaw(portalS),'Hanging railway monster-mouth passage',crypt);
  for(const side of [-1,1]) {
    for(const s of [1457,1474,1493]) {
      wall(s,side*10.8,height(s)+1.4,yaw(s)+(side<0?90:-90),crypt,6.4);
      wall(s+5,side*8.8,height(s)-7.8,yaw(s)+(side<0?90:-90),crypt,5.4);
    }
    display('ghostknight',1454,side*4.5,height(1454)+.1,3.1,yaw(1454)+(side<0?-55:55),crypt);
    light(1475,side*7.5,4.8,point(1480,height(1480)+1.4),side<0?'#5af3a0':'#cf58e8',140,side<0?1:2,crypt);
  }
  prop('ghostclockwork',1487,6.9,height(1487)-.45,5.0,yaw(1487)-35,'Meshy clockwork side-track drive',crypt);
  prop('ghostcart',1492,6.9,height(1492)-1.36,6.2,yaw(1492),'Retired Meshy side-track carriage',crypt);
  chandelier(1484,height(1484)+9.0,3.7,crypt);
  light(1487,9.5,4.9,point(1487,height(1487)+2.2,6.9),'#94e871',150,0,crypt);
  light(1498,-4.4,6.0,point(1505,railY+4.5),'#87ff42',140,1,crypt);
  light(1511,4.0,5.5,point(1505,railY+4.0),'#bc78ff',120,2,crypt);
}
