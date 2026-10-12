import type { CustomComponent, CustomGroup } from '../level';
import {routePoint,routeYaw} from './blockworks-geometry';

/** Art only: do not change component dimensions, collision or group wiring. */
type Scalar=number|((s:number)=>number);
type Road={a:number;b:number;top:Scalar;width:Scalar;offset:Scalar;grp:number;ice:boolean;visuals:CustomComponent[]};
const at=(value:Scalar,s:number)=>typeof value==='function'?value(s):value;
export function dressBlockworks(components:CustomComponent[],groups:CustomGroup[],roads:Road[]):void {
  for(const c of components){
    // The abyss reads as open air; its existing kill volumes remain intact.
    if(c.t==='pit')c.invisible=true;
    if(c.t==='platform'&&c.grp===2)c.artProxy=true;
    if(c.nm==='Jump-sized roof module'&&c.solid===false)c.invisible=true;
    if((c.t==='platform'&&!c.pts&&c.grp!==2&&!c.nm?.includes('footing'))||c.t==='mover'||(c.t==='mesh'&&(c.nm?.includes('skate')||c.nm?.includes('wedge')||c.nm?.includes('shelf')))){
      c.dkind=c.t==='mover'||c.outline?'bw-metal-deck':c.nm==='Solid modular building'?'bw-roof-deck':'bw-stone-deck';
      if(!c.outline)c.artProxy=true;
    }

  }
  groups.push({id:202,nm:'Haunted island · Meshy playable modules',editorOnly:true});
  for(const road of roads){
    for(const c of road.visuals)c.artProxy=true;
    if(road.a===770&&road.b===920)continue; // the halfpipe owns this floor
    const count=Math.ceil((road.b-road.a)/2),anchor=routePoint(road.a,at(road.top,road.a),at(road.offset,road.a));
    const widths:number[]=[],pts:NonNullable<CustomComponent['pts']>=[];
    for(let i=0;i<=count;i++){const s=road.a+(road.b-road.a)*i/count,p=routePoint(s,at(road.top,s),at(road.offset,s));pts.push([p[0]-anchor[0],p[2]-anchor[2],0,p[1]-anchor[1]]);widths.push(at(road.width,s));}
    const roof=road.visuals[0]?.nm==='High curved roof walk'||road.visuals[0]?.nm==='Crown departure'||road.grp>=16;
    components.push({t:'decor',dkind:road.ice?'bw-ice-deck':roof?'bw-roof-deck':'bw-stone-deck',p:anchor,pts,widths,s:[widths[0],1.2,6],grp:202,nm:'Meshy deck along original route'});
  }
  const pipe=components.find(c=>c.t==='vertramp'&&c.nm==='Vert vault · clear wall-to-wall riding');
  if(pipe){pipe.artProxy=true;components.push({t:'decor',dkind:'bw-aqueduct-module',p:[...pipe.p],pts:pipe.pts,s:[14.8,4.5,6],w:pipe.w,rise:pipe.rise,deck:pipe.deck,grp:202,nm:'Meshy aqueduct on original riding profile'});}
  groups.push({id:201,nm:'Haunted island · Meshy architecture and scenery',editorOnly:true});
  // Build the original solid building silhouettes from measured facade bays,
  // including their vertical mass below each rooftop landing.
  for(const c of [...components]){
    if(c.t!=='platform'||!c.artProxy||!c.s||c.pts||c.grp===2||c.s[1]<2)continue;
    const [w,h,d]=c.s,yaw=(c.yaw??0)*Math.PI/180,base=c.p[1]-h/2;
    const tiers=Math.ceil(h/6.5),tierH=h/tiers,panelDepth=Math.min(1.4,w,d);
    for(const [side,length,depth]of [[0,w,d],[1,d,w],[2,w,d],[3,d,w]]){
      // A narrow guide gets one inward-facing skin, not four overlapping bays.
      if(w<1&&side!==(c.p[0]<routePoint(20-c.p[2],0)[0]?1:3))continue;
      const bays=Math.ceil(length/6.8),bayW=length/bays;
      for(let row=0;row<tiers;row++)for(let col=0;col<bays;col++){
        const offset=(col+.5)*bayW-length/2;
        const x=side===0?offset:side===1?(depth-panelDepth)/2:side===2?-offset:-(depth-panelDepth)/2;
        const z=side===0?(depth-panelDepth)/2:side===1?-offset:side===2?-(depth-panelDepth)/2:offset;
        components.push({t:'decor',dkind:'bw-wall-bay',p:[c.p[0]+Math.cos(yaw)*x+Math.sin(yaw)*z,base+row*tierH,c.p[2]-Math.sin(yaw)*x+Math.cos(yaw)*z],
          s:[bayW,tierH,panelDepth],yaw:(c.yaw??0)+side*90,grp:201,nm:'Meshy castle building facade'});
      }
    }
  }

  const roadAt=(station:number)=>{
    const spans=roads.filter(r=>station>=r.a&&station<=r.b);
    if(!spans.length)return null;
    return {top:Math.max(...spans.map(r=>at(r.top,station))),edge:Math.max(...spans.map(r=>Math.abs(at(r.offset,station))+at(r.width,station)/2))};
  };
  const prop=(kind:NonNullable<CustomComponent['dkind']>,s:number,y:number,u:number,height:number,yaw=routeYaw(s))=>
    components.push({t:'decor',dkind:kind,p:routePoint(s,y,u),rise:height,yaw,grp:201,nm:'Meshy haunted island component'});
  for(let s=0;s<=2140;s+=7.5){
    const road=roadAt(s);if(!road)continue;
    for(const side of [-1,1]){
      prop('bw-wall-bay',s,road.top-7.8,side*(road.edge+.85),7.6,routeYaw(s)+(side<0?90:-90));
      prop('bw-rubble',s,road.top-.6,side*(road.edge+.1),.55,routeYaw(s)+90);
    }
  }
  for(let s=12;s<=2140;s+=26){
    const road=roadAt(s);if(!road)continue;
    const side=Math.floor(s/26)%2?1:-1;
    prop('bw-lantern',s,road.top-2.6,side*(road.edge+1.6),3.8,routeYaw(s)+(side<0?90:-90));
    prop('bw-lantern',s+8,road.top-2.6,-side*(road.edge+1.6),3.8,routeYaw(s)+(side>0?90:-90));
  }
  for(let s=8;s<=2140;s+=31){
    const road=roadAt(s);if(!road)continue;
    for(const side of [-1,1]){
      const seed=Math.sin(s*7.13+side)*.5+.5,u=side*(road.edge+12+seed*4);
      prop('bw-cliff',s,-21,u,road.top+22,routeYaw(s)+seed*150);
      prop('bw-palm',s,road.top-.6,u,8+seed*4,routeYaw(s)+side*45+seed*50);
      prop('bw-foliage',s-4,road.top-1.2,side*(road.edge+1.45),1.6,routeYaw(s)+seed*360);
      prop('bw-foliage',s+3,road.top-1.4,side*(road.edge+1.75),1.8,routeYaw(s)+seed*180);
    }
  }
  for(let s=34;s<=2140;s+=59){
    const road=roadAt(s);if(!road)continue;
    const side=Math.floor(s/59)%2?1:-1;
    prop('bw-turret',s,road.top-13,side*(road.edge+9),22,routeYaw(s)+(side<0?90:-90));
    prop('bw-buttress',s+15,road.top-14,-side*(road.edge+6.8),14,routeYaw(s));
  }
  for(const [s,side,height]of [[90,-1,38],[590,1,32],[1170,-1,34],[1510,1,38],[1920,-1,36]]){
    const road=roadAt(s);if(road)prop('bw-wheel',s,road.top-17,side*(road.edge+35),height,routeYaw(s)+(side<0?55:-55));
  }
  for(const [s,u]of [[1060,-16],[1122,18],[1289,-13],[1347,14],[1412,-14],[1520,14]]){
    const road=roadAt(s);if(road)prop('bw-winch',s,road.top-1.5,u,4.5,routeYaw(s));
  }
  groups.push({id:200,nm:'Haunted island · distant shared world',editorOnly:true});
  // All are fixed world placements, never billboarded or changed per camera.
  // Keep far islands beyond the surrounding 3D scenery belt.
  const placements:[number,number,number,number,NonNullable<CustomComponent['dkind']>][]=[
    [-70,-180,205,125,'bw-jungle-matte'],[110,-170,230,140,'bw-rides-matte'],
    [240,210,250,165,'bw-castle-matte'],[390,-200,260,155,'bw-jungle-matte'],
    [540,190,225,145,'bw-rides-matte'],[685,-205,270,180,'bw-castle-matte'],
    [790,200,255,170,'bw-jungle-matte'],[940,-220,240,150,'bw-rides-matte'],
    [1080,215,260,170,'bw-castle-matte'],[1220,-185,230,150,'bw-jungle-matte'],
    [1370,220,240,165,'bw-rides-matte'],[1530,-190,260,180,'bw-castle-matte'],
    [1660,210,250,170,'bw-jungle-matte'],[1800,-220,270,170,'bw-rides-matte'],
    [1940,210,260,180,'bw-castle-matte'],[2110,-205,245,160,'bw-jungle-matte'],
    [2300,30,250,210,'bw-castle-matte'],
  ];
  for(const [s,u,w,h,dkind]of placements){
    components.push({t:'decor',dkind,p:routePoint(s,-65,u),s:[w,h,1],
      yaw:routeYaw(s)+(u<0?90:-90),grp:200,nm:'Shared distant island'});
  }
}
