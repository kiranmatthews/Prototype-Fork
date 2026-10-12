import type { CustomComponent, CustomGroup } from '../level';
import {routePoint,routeYaw} from './blockworks-geometry';

/** Art only: do not change component dimensions, collision or group wiring. */
type Scalar=number|((s:number)=>number);
type Road={a:number;b:number;top:Scalar;width:Scalar;offset:Scalar;grp:number;ice:boolean;visuals:CustomComponent[]};
const at=(value:Scalar,s:number)=>typeof value==='function'?value(s):value;
export function dressBlockworks(components:CustomComponent[],groups:CustomGroup[],roads:Road[]):void {
  const roofs=components.filter(c=>c.t==='platform'&&c.s&&!c.pts&&c.grp!==2&&c.solid!==false);
  const overlapsRoof=(s:number,y:number,u:number,clearance:number)=>{
    const p=routePoint(s,y,u);
    return roofs.some(c=>{
      const [w,h,d]=c.s!,top=c.p[1]+h/2;if(Math.abs(top-y)>1.5)return false;
      const a=(c.yaw??0)*Math.PI/180,dx=p[0]-c.p[0],dz=p[2]-c.p[2];
      return Math.abs(Math.cos(a)*dx-Math.sin(a)*dz)<w/2+clearance&&Math.abs(Math.sin(a)*dx+Math.cos(a)*dz)<d/2+clearance;
    });
  };
  for(const c of components){
    // The abyss reads as open air; its existing kill volumes remain intact.
    if(c.t==='pit')c.invisible=true;
    if(c.t==='platform'&&c.grp===2)c.artProxy=true;
    if(c.nm==='Jump-sized roof module'&&c.solid===false)c.invisible=true;
    if((c.t==='platform'&&!c.pts&&c.grp!==2&&!c.nm?.includes('footing'))||c.t==='mover'||(c.t==='mesh'&&(c.nm?.includes('skate')||c.nm?.includes('wedge')||c.nm?.includes('shelf')))){
      c.dkind=c.t==='mover'||c.outline?'bw-metal-deck':'bw-flagstone-deck-v3';
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
    components.push({t:'decor',dkind:road.ice?'bw-ice-deck':'bw-flagstone-deck-v3',p:anchor,pts,widths,s:[widths[0],.65,8],grp:202,nm:'Meshy deck along original route'});
  }
  const pipe=components.find(c=>c.t==='vertramp'&&c.nm==='Vert vault · clear wall-to-wall riding');
  if(pipe){pipe.artProxy=true;components.push({t:'decor',dkind:'bw-aqueduct-v3',p:[...pipe.p],pts:pipe.pts,s:[14.8,3.9,8],w:pipe.w,rise:pipe.rise,deck:pipe.deck,grp:202,nm:'Meshy aqueduct on original riding profile'});}
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
    // A lower wide foundation must not lend its width to the higher narrow
    // departure roof; that previously left coping floating beside the crown.
    const surface=spans.reduce((a,b)=>at(a.top,station)>=at(b.top,station)?a:b);
    return {a:surface.a,b:surface.b,top:at(surface.top,station),edge:Math.abs(at(surface.offset,station))+at(surface.width,station)/2};
  };
  const prop=(kind:NonNullable<CustomComponent['dkind']>,s:number,y:number,u:number,height:number,yaw=routeYaw(s))=>
    components.push({t:'decor',dkind:kind,p:routePoint(s,y,u),rise:height,yaw,grp:201,nm:'Meshy haunted island component'});
  const sized=(kind:NonNullable<CustomComponent['dkind']>,s:number,y:number,u:number,size:[number,number,number],yaw=routeYaw(s))=>
    components.push({t:'decor',dkind:kind,p:routePoint(s,y,u),s:size,yaw,grp:201,nm:'Meshy storyboard architecture'});
  // The generated coping sits just outside the native edge. Its inner face
  // leaves the existing grind line and every launch/landing width untouched.
  for(let s=2.75;s<=2140;s+=5.5){
    const road=roadAt(s);if(!road)continue;
    if(s>=770&&s<=920)continue; // the new aqueduct includes its own bronze coping
    const from=Math.max(road.a,s-2.75),to=Math.min(road.b,s+2.75),mid=(from+to)/2;
    const a=routePoint(from,0),b=routePoint(to,0),length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    for(const side of [-1,1]){
      if(overlapsRoof(mid,road.top,side*(road.edge+.54),.7))continue;
      sized('bw-parapet-v2',mid,road.top-.06,side*(road.edge+.54),[length+.05,.62,.88],routeYaw(mid)+(side<0?90:-90));
    }
  }
  // Open gothic arches replace repeated window panels beneath the causeways.
  for(let s=5.5;s<=2140;s+=11){
    const road=roadAt(s);if(!road||!roadAt(s-5)||!roadAt(s+5))continue;
    const a=routePoint(s-5.5,0),b=routePoint(s+5.5,0),length=Math.hypot(b[0]-a[0],b[2]-a[2]);
    for(const side of [-1,1])sized('bw-viaduct-v2',s,road.top-17,side*(road.edge-.85),[length+.35,16.5,2.2],routeYaw(s)+(side<0?90:-90));
  }
  const lamp=(s:number,side:number)=>{
    const road=roadAt(s);if(!road)return;
    const pipe=s>=770&&s<=920,lift=pipe?3.6:0,edge=pipe?7.4:road.edge;
    if(overlapsRoof(s,road.top+lift,side*(edge+.55),.8))return;
    prop('bw-lantern',s,road.top+lift-.3,side*(edge+.55),1.85,routeYaw(s)+(side<0?90:-90));
  };
  for(let s=12;s<=2140;s+=26){
    const side=Math.floor(s/26)%2?1:-1;
    lamp(s,side);lamp(s+8,-side);
  }
  for(let s=8;s<=2140;s+=23){
    const road=roadAt(s);if(!road)continue;
    for(const side of [-1,1]){
      const seed=Math.sin(s*7.13+side)*.5+.5,u=side*(road.edge+15+seed*4);
      prop('bw-cliff',s,-34,u,road.top+23,routeYaw(s)+seed*150);
      sized('bw-jungle-shelf-v2',s,road.top-19,u,[20,12,18],routeYaw(s)+side*27+seed*28);
      if(Math.floor(s/23)%2===0)prop('bw-palm',s-6,road.top-9.5,side*(road.edge+10+seed*2),9+seed*3,routeYaw(s)+side*45+seed*50);
      if(!overlapsRoof(s-4,road.top,side*(road.edge+.92),1.2))prop('bw-foliage',s-4,road.top-.3,side*(road.edge+.92),.95,routeYaw(s)+seed*360);
      if(!overlapsRoof(s+3,road.top,side*(road.edge+1.15),1.2))prop('bw-foliage',s+3,road.top-.6,side*(road.edge+1.15),1.25,routeYaw(s)+seed*180);
    }
  }
  for(let s=18;s<=2140;s+=47){
    const road=roadAt(s);if(!road)continue;
    const side=Math.floor(s/47)%2?-1:1;
    prop('bw-spire-v2',s,road.top-20,side*(road.edge+8.7),32,routeYaw(s)+(side<0?25:-25));
    prop('bw-buttress',s+15,road.top-16,-side*(road.edge+7),15,routeYaw(s));
    if(Math.floor(s/47)%3===0)prop('bw-turret',s+21,road.top-20,-side*(road.edge+23),24,routeYaw(s)+(side>0?90:-90));
  }
  for(const [s,side,height]of [[38,-1,40],[382,-1,38],[590,1,35],[842,1,38],[1170,-1,34],[1340,-1,40],[1510,1,38],[1920,-1,36],[2070,1,40]]){
    const road=roadAt(s);if(road)prop('bw-wheel',s,road.top-28,side*(road.edge+24),height,routeYaw(s)+(side<0?25:-25));
  }
  for(const [start,side]of [[12,-1],[280,1],[524,-1],[770,1],[1048,-1],[1308,-1],[1580,1],[1910,-1],[2050,1]]){
    for(let i=0;i<4;i++){
      const s=start+i*18,road=roadAt(s);if(!road)continue;
      sized('bw-coaster-v2',s,road.top-19,side*(road.edge+25),[21,14,3.6],routeYaw(s)+90);
    }
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
