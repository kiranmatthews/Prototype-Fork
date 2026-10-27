import type { CustomComponent, CustomLevelData } from '../level';
import { BAY_ATMOSPHERE, bayBoardwalk, bayPalm, bayProp } from './banana-bay-theme';

/** The proven Switchyard crate dependencies stay intact. Its old floating
 * cuboids become the parent's oak cargo wharves, surrounded by the same full
 * sandstone/palm/hibiscus assets. No art supplies unintended puzzle footing. */
export function dressBananaBayBonus(data:CustomLevelData):void {
  const art:CustomComponent[]=[];
  const gameplay=data.components.filter(c=>c.grp!==90);
  data.components=gameplay.map(c=>{
    if(c.t==='pit')return {...c,invisible:true};
    if(c.t!=='mesh'||!c.s||c.outline||c.solid===false)return c;
    const [w,h,depth]=c.s,top=c.p[1]+h/2,a=c.p[0]-w/2,b=c.p[0]+w/2;
    const walk=bayBoardwalk([[a,top,0],[b,top,0]],depth,c.nm??'Lifeguard cargo wharf',c.grp);
    walk.seed=87200+Math.round(a*7);walk.supportBaseY=-5.6;walk.supportDepth=top+5.6;
    if(h>2){
      // Rounded sandstone roots behind and below the wharf, never at foot height.
      for(let x=a+3;x<b-1;x+=7)art.push(bayProp('sunnycliff',[x,-5.8,-1.3],[9,Math.max(4,top+4.5),7.8],x*11,'Wharf sandstone footing',90));
    }
    return walk;
  });
  for(const c of data.components){
    if(c.t==='mesh'&&c.outline){c.tex='plank';c.color='#c89758';}
    if(c.t==='mover'||c.t==='crumble'||c.t==='spinbridge'){c.tex='plank';c.color='#c89758';}
    if(c.cameraView){
      c.cameraPosition=[2,8.2,22];c.cameraTarget=[2,5.6,0];
      c.cameraFollowDistance=26;c.cameraFollowTargetHeight=5.3;
      c.nm='Lifeguard wharf side view / high cargo and landing visible together';
    }
  }
  // Several depth layers keep the bay spatial: close piling roots, garden
  // shelves behind the action, then tall offshore islands with clear sky gaps.
  for(const [i,x]of [-9,16,40,68,98,132,163,190,221,246].entries()){
    const z=-12-(i%3)*2,y=-4.7;
    art.push(bayProp('sunnycliff',[x,y,z],[20,8+(i%3)*2,14],i*37,'Rear cove sandstone island',90));
    const terraceY=1.3+(i%3)*1.1;
    art.push(...bayPalm([x-3,terraceY,z],1.05+(i%3)*.15,40+i*41,90));
    art.push(bayProp('sunnyhibiscus',[x+3,terraceY-1,z+2.6],[4.8,3.2,4.1],i*29,'Lifeguard garden hibiscus',90));
    art.push(bayProp('jungleleaf',[x-1,terraceY-1.3,z+3.8],[4.2,2.5,3.8],i*47,'Lifeguard garden broadleaf',90));
    if(i%2===0)art.push(bayProp('bayvine',[x+4,terraceY+1,z+4],[3.1,4.4,1.6],0,'Hanging wharf garden vine',90));
  }
  for(const [i,x]of [-34,27,92,158,222,280].entries()){
    art.push(bayProp('sunnycliff',[x,-7,-48-(i%2)*13],[34,23+(i%3)*5,26],i*43,'Distant Banana Bay sandstone stack',90));
    art.push(...bayPalm([x+2,10+(i%3)*4,-47-(i%2)*13],1.7,i*61,90));
  }
  data.components.push(...art);
  data.groups??=[];data.groups.push({id:90,nm:'Banana Bay full-detail wharf scenery',editorOnly:true});
  data.sky='coast';data.jungleStyle='painterly';data.jungleDepthFade=false;data.keepPlayFog=true;
  data.atmosphere=structuredClone(BAY_ATMOSPHERE);
  data.shoreFoam=[-9,16,40,68,98,132,163,190,221,246].map((x,i)=>({
    center:[x,-4.8,-12-(i%3)*2],right:[1,0,0],forward:[0,0,-1],axes:[9,6.5],phase:i*1.73,
  }));
  // Shore coordinates are LOCAL to p/yaw. Put the landward boundary behind
  // all garden islands so water spans the entire side-view foreground.
  data.ocean={look:'sunny-beach',geometryVersion:2,p:[115,-4.8,-160],length:360,yaw:-90,seaward:1,width:300,overlap:9,
    longitudinalSegments:96,lateralSegments:96,sourceCoordinates:'three',shoreGeometry:'ground',
    shore:[[0,180,1,0],[0,120,1,0],[0,40,1,0],[0,-40,1,0],[0,-120,1,0],[0,-180,1,0]],extendTails:true};
}
