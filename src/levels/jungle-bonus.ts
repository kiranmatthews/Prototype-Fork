import type { CustomComponent, CustomLevelData, DecorKind } from '../level';
import { jungleAssemblyComponents } from '../jungleAssemblies';

type Point=[number,number,number];

/** Fern Reliquary keeps its authored two-room puzzle. All new scenery has an
 * explicit non-solid policy, including hard-looking rocks and masonry. */
export function dressJungleBonus(data:CustomLevelData):void {
  data.components=data.components.filter(c=>c.grp!==90);
  const native=[...data.components],art:CustomComponent[]=[];
  const prop=(dkind:DecorKind,p:Point,s:Point,nm:string,yaw=0,color='#ffffff')=>
    art.push({t:'decor',dkind,p,s,yaw,color,nm:`Fern Reliquary · ${nm}`,grp:90,
      solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false});
  const assembly=(dkind:'roofedtemple'|'hangingarch',p:Point,s:Point,nm:string,seed:number,vr=0)=>{
    art.push(...jungleAssemblyComponents({dkind,p,s,seed,vr},`Fern Reliquary · ${nm}`,90)
      .map(c=>({...c,solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false})));
  };
  const block=(p:Point,s:Point,nm:string,color:string,tex='treehouse-stone')=>
    art.push({t:'decor',dkind:'block',p,s,color,tex,nm:`Fern Reliquary · ${nm}`,grp:90,
      solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false});

  // Dress the native platform fascia only: stone tops remain below the exact
  // collision plane, with no added ledges across the switch-created gap.
  for(const c of native){
    if(c.t!=='mesh'||!c.s||c.vertices?.length!==24)continue;
    c.tex='treehouse-stone';c.color='#d2ceaa';
    if(c.outline)continue;
    const a=c.p[0]-c.s[0]/2,b=c.p[0]+c.s[0]/2,top=c.p[1]+c.s[1]/2;
    const n=Math.ceil((b-a)/3.2),w=(b-a)/n;
    for(let i=0;i<n;i++){
      const x=a+(i+.5)*w;
      for(const [row,z]of [-2.12,0,2.12].entries())
        prop('stonepaver',[x,top-.2,z],[w-.035,.23,2.08],
          'weathered paving with narrow recessed joints',0,(i+row)%3?'#c3c6a5':'#d5d3b5');
      prop(i%4===1?'fracturedstoneblock':'wornstoneblock',[x,top-.93,2.97],
        [w-.025,.82,.4],'individually worn outer course',0,i%2?'#bfbd9e':'#cecaac');
      prop('stonecornice',[x,top-.25,2.95],[w,.22,.5],'carved lip below the walking surface',0,'#d1d2b2');
      prop('wornstoneblock',[x,top-.87,-3.04],[w-.03,.78,.38],'rear platform stone course');
      if(i%2===0){
        prop('junglevine',[x+.2,top-2.05,3.03],[2.4,1.6,.32],'ivy trailing below the front ledge',i*13,'#adc58c');
        prop(i%4?'trialsv2groundcovera':'trialsv2groundcoverb',[x,top-.18,-2.86],
          [2.65,.65,1.25],'low moss on the rear ledge',i*71);
      }
    }
    // Rooted buttresses beneath permanent courts; the upper reward gallery
    // has an honest masonry support at its rear, outside the movement plane.
    if(top<1){
      const count=Math.ceil((b-a)/8),width=(b-a)/count;
      for(let i=0;i<count;i++)prop('treehousemossrock',[a+(i+.5)*width,-7.8,-.25],
        [width+.1,6.85,6.1],'rock foundation below the permanent court',i*31);
    }else{
      for(const x of [a+1,b-1]){
        prop('stonebase',[x,-.2,-3.8],[2.2,.8,2.1],'gallery pier footing');
        for(let y=.6;y<top-.9;y+=1.5)prop('stoneshaft',[x,y,-3.8],[1.45,1.5,1.45],'stacked gallery pier');
        prop('stonecapital',[x,top-.95,-3.8],[2.2,.9,2.2],'gallery pier capital');
      }
    }
  }

  // Three distinct masonry landmarks: a broken arrival shrine, the tall
  // reliquary behind the high reward, then the return sanctuary beyond water.
  assembly('roofedtemple',[-5,-2.2,-18],[16,13,11],'broken arrival shrine',19,1);
  assembly('hangingarch',[20,-1.5,-20],[22,23,3.2],'great reliquary arch',52);
  assembly('roofedtemple',[70,-2.1,-19],[21,17,13],'return sanctuary',93);
  for(const [x,z,h]of [[8,-12,5.4],[30,-14,7.5],[54,-12,5.9],[84,-18,9.2]]){
    prop('stonebase',[x,-2,z],[3.2,.8,3],'ruined side pier base');
    for(let y=-1.2;y<h;y+=1.7)prop('stoneshaft',[x,y,z],[1.8,Math.min(1.7,h-y),1.8],'broken stacked column');
    prop('fracturedstoneblock',[x+.2,h,z],[2.3,.65,2.2],'fractured pier crown',x*3);
    prop('trialsv2ferna',[x-.3,h+.1,z],[3.5,1.9,3.1],'fern growing out of broken stone',x*11);
  }

  // Connected bank behind the play plane, textured like Treehouse's earth.
  // The foreground crossing stays a visible chasm with its original pit.
  block([6.75,-5.8,-32],[58.5,7.1,54],'earth beneath the arrival forest','#526847','treehouse-loam');
  block([74.25,-5.8,-32],[40.5,7.1,54],'earth beneath the return forest','#526847','treehouse-loam');
  block([45,-5.8,-37.75],[18,7.1,42.5],'rooted forest behind the sunken basin','#526847','treehouse-loam');
  block([45,-8.3,-10],[18,4,13],'visible stone bed beneath the basin','#798872');
  for(let x=-18,i=0;x<96;x+=6.4,i++){
    const z=-8.4-(i%3)*1.6;
    if(x>35&&x<55)continue; // Keep the reflecting pool open between its banks.
    prop(i%2?'trialsv2earthbanka':'trialsv2earthbankb',[x,-3.0,z-2.5],
      [8.5,2.1,4.4],'rooted undulating sanctuary bank',i*19);
    prop(i%2?'trialsv2groundcovera':'trialsv2groundcoverb',[x,-1.35,z],
      [6.4,1.2,3.7],'continuous soft forest carpet',i*71);
    if(i%2===0)prop(i%4?'trialsv2ferna':'trialsv2fernb',[x+.5,-1.2,z-1.6],
      [4.1,2.6,3.8],'broad ferns and copper accents',i*43);
    if(i%3===1)prop('treehousemossrock',[x,-2.5,z+.4],
      [5.1,2.9,3.8],'mossy stone in the layered fern bank',i*37);
    if(i%2===1)prop('trialsv3thicket',[x,-2.2,-30],
      [10,5.9,6.5],'dense understory behind the monuments',i*47);
  }
  for(const [i,x]of [-19,3,27,49,76,97].entries()){
    const w=29+(i%2)*4;
    prop(i%2?'trialsv2treea':'trialsv2treeb',[x,-2.4,-36-(i%2)*5],
      [w,w*(i%2?.6833:.6439),w*(i%2?.9966:.6811)],'rooted ancient canopy behind the ruins',i*71);
    prop('trialsv3bough',[x,16.4+(i%2)*3,-23],
      [20,7.7,9.3],'high overhanging jungle bough',i*17);
  }
  for(const [x,z]of [[-8,-64],[43,-73],[92,-64]])
    prop('treehouserepairgrove',[x,-6,z],[76,31.75,.02],'painted grove beyond the actual trees',0,'#aec6b5');
  prop('treehouserepairridge',[38,-18,-112],[220,91.9,.02],'distant misty forest ridge',0,'#c5d7c8');

  // A sunken reflecting basin belongs behind the switch gap. Its low water
  // level leaves a dark readable drop under the playable crossing.
  art.push({t:'mesh',p:[45,-5.4,-10],vertices:[-9,0,-6.5,9,0,-6.5,-9,0,6.5,9,0,6.5],indices:[0,2,1,1,2,3],
    materialStyle:'jungle-stream',tex:'solid',color:'#659f8a',opacity:.72,emissive:'#082520',
    solid:false,scenerySolid:false,edgeGrinding:false,castShadow:false,grp:90,nm:'Fern Reliquary · sunken reflecting basin'});
  for(const [i,x]of [36.5,53.5].entries()){
    prop('treehousemossrock',[x,-6.2,-12],[4.5,3.8,5.4],'sunken basin mossy bank',i*39);
    prop('trialsv2ferna',[x,-2.7,-12.7],[4,2.5,3.5],'ferns overhanging the reflecting basin',i*93);
    prop('stonelintel',[x,-2.4,-8.9],[4,1.3,1.8],'fallen carved basin lintel',i?24:-18);
  }
  for(const [i,x]of [38,43,48,52].entries()){
    prop('treehousemossrock',[x,-3.1,-18.9],[5.6,2.1,5.4],'irregular mossy rear basin rim',i*53);
    prop('trialsv2groundcoverb',[x,-1.55,-18.4],[4.6,.85,3.4],'carpet growing over the basin rim',i*71);
    prop(i%2?'trialsv2ferna':'trialsv2fernb',[x,-1.3,-21],[3.6,2.1,3.3],'fern garden behind the water',i*93);
  }
  for(let x=-16,i=0;x<94;x+=12.8,i++)
    prop('trialsv3thicket',[x,-2.35,-26-(i%2)*4],[8.2,4.8,5.3],'rooted forest floor between temple silhouettes',i*137.5);
  data.components.push(...art);
  (data.groups??=[]).push({id:90,nm:'Fern Reliquary · overgrown sanctuary scenery',editorOnly:true});
  data.jungleDepthFade=false;data.jungleStyle='painterly';data.keepPlayFog=true;
  data.atmosphere={backdrop:'fog',fogEnabled:true,fogColor:'#b6c9b7',fogNear:48,fogFar:165,drawDistance:190,
    ambientSky:'#e8efdd',ambientGround:'#8b9c78',ambientIntensity:1.25,
    sunColor:'#ffe9bb',sunIntensity:1.7,fillColor:'#b4d9ce',fillIntensity:.44,shadowStrength:.55};
}
