import type { CustomComponent, CustomLevelData } from '../level';
import type { BonusCourse } from './bonus-course-kit';
import { calderaHorizon, calderaBasin, calderaNearScenery, basaltFormation } from './nightworks-caldera-environment';

export const CALDERA_BONUS_LANDINGS = [[-6,0,0],[9,2,0],[20,4,0],[32,6,0],[59,6,0],[83,6,0]] as const;

/** A bespoke climb/ferry/phase sequence, with no shared bonus-room recipes.
 * All rewards sit on permanent rock; the two moving contacts carry the rider. */
export function createCalderaBonus(): BonusCourse {
  const components: CustomComponent[] = [];
  const add=(c:CustomComponent):void=>{components.push(c);};
  const island=(a:number,b:number,y:number,nm:string):void=>{
    add({t:'platform',nm,dkind:'nightlongisland',p:[(a+b)/2,y-3,0],s:[b-a,6,7],grp:1});
    for(const x of [a+1.2,b-1.2])add({t:'torch',nm:'Caldera watch brazier',p:[x,y,-2.3],rise:2.2,w:.78,grp:90});
  };
  const crate=(nm:string,x:number,y:number,kind:NonNullable<CustomComponent['kind']>='wood'):void=>
    add({t:'crate',nm,p:[x,y,0],kind,grp:2});
  island(-12,4,0,'Caldera arrival shelf');
  island(6,14,2,'First lifted basalt shelf');
  island(16,25,4,'Second lifted basalt shelf');
  island(27,39,6,'Upper crucible loading ledge');
  island(54,65,6,'Counterweight receiving ledge');
  island(77,94,6,'Last ember vault and return');
  crate('Arrival ore crate',-2,0);crate('Arrival mystery',1,0,'mystery');
  crate('Low shelf ore',9,2);crate('Low shelf cap',9,2.96);
  crate('Middle shelf striped ore',20,4,'multihit');crate('Middle shelf mystery',23,4,'mystery');
  crate('Crucible arrow',32,6,'bouncy');crate('Crucible high life',32,13.2,'life');
  crate('Crucible dispatch crate',36,6);
  crate('Receiver ore',57,6);crate('Receiver ore cap',57,6.96);crate('Receiver mystery',62,6,'mystery');
  crate('Vault ore',80,6);crate('Vault ore cap',80,6.96);crate('Vault life',85,6,'life');crate('Last dispatch',88,6);
  add({t:'mover',nm:'Caldera counterweight ferry',dkind:'nightsteppingrock',p:[46.5,6,0],s:[7.6,6,6.6],
    axis:'x',amp:4.2,speed:.55,phase:-Math.PI/2,lit:true,grp:1});
  add({t:'phasepad',nm:'Last ember breathing rock',dkind:'nightphaserock',p:[71,6,0],s:[7,5.8,7],cycle:5.6,phase:.12,amp:.76,grp:1});
  for(const [a,b,y]of [[3,7,1],[13,17,3],[24,28,5],[38,43,7],[51,55,7],[64,68,7],[74,78,7]])
    for(let i=0;i<3;i++)add({t:'wumpa',p:[a+(b-a)*i/2,y+1+Math.sin(i/2*Math.PI)*1.2,0],grp:2});
  add({t:'gate',nm:'Caldera bonus return',p:[91,6,0],yaw:90,grp:1});
  for(const z of [-.83,.83])add({t:'wall',nm:'Bonus depth boundary',p:[42,-20,z],s:[125,55,.6],invisible:true,grp:3});
  add({t:'camnode',p:[-15,0,0],radius:0,grp:3});add({t:'camnode',p:[100,6,0],radius:0,grp:3});
  add({t:'camnode',nm:'Caldera side view',p:[42,8,0],s:[125,56,18],cameraView:true,radius:1,
    cameraPosition:[2,8.2,22],cameraTarget:[2,5.6,0],cameraFollowDistance:13.4,cameraFollowTargetHeight:2.7,
    cameraFov:46,cameraAspect:1.3,grp:3});

  const raw:CustomLevelData={v:1,name:'Bonus: Caldera Counterweights',spawn:[-6,.12,0],killY:-18,
    hudMode:'bonus',sky:'night',keepPlayFog:true,cameraAirLift:.85,components,
    groups:[{id:1,nm:'Hand-authored caldera crossing',editorOnly:true},{id:2,nm:'Crucible rewards',editorOnly:true},{id:3,nm:'Side-view framing',editorOnly:true}]};
  for(const c of components){
    if(c.dkind?.startsWith('night')){c.tex='nightworks-basalt';c.color='#d2d4db';if(c.t==='platform')c.emissive='#070b14';}
    if(c.t==='platform'&&c.s){
      add(basaltFormation([c.p[0],-26,c.p[2]],c.s[0]*.76,c.p[1]-3+26,c.s[2]*.82,c.p[0]+91));
    }
  }
  components.push(calderaHorizon(true),...calderaBasin(true),...calderaNearScenery(true));
  for(const c of components)if(c.grp===90&&(c.t==='mesh'||c.t==='decor'))c.scenerySolid=false;
  raw.groups!.push({id:90,nm:'Living volcano and quarry scenery',editorOnly:true});
  raw.atmosphere={backdrop:'fog',fogNear:38,fogFar:190,fogColor:'#242536',drawDistance:1100,
    ambientSky:'#a7b7d8',ambientGround:'#66372d',ambientIntensity:1.35,
    sunColor:'#bfd2f3',sunIntensity:1.7,sunDirection:[.55,.75,.35],fillColor:'#eeb080',fillIntensity:.52,shadowStrength:.72};
  return {data:raw,rooms:[],actions:[]};
}

export const CALDERA_BONUS_LEVEL=createCalderaBonus().data;
