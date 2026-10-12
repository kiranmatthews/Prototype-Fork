import type { CustomComponent, CustomLevelData } from '../level';
import type { BonusCourse } from './bonus-course-kit';
import { createNightworksVolcanoScenery } from './nightworks-after-hours-art';

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
  components.push(...createNightworksVolcanoScenery([43,-180,-460],[560,280,480]));
  // Crescent lagoon under the course, lit red all the way to the return dock.
  const vertices:number[]=[],indices:number[]=[],uvs:number[]=[];
  for(let i=0;i<=32;i++){
    const x=-30+i*4.6,near=10+Math.sin(i*.4)*4,far=-73+Math.sin(i*.3)*9;
    for(const z of [near,far]){vertices.push(x,-22,z);uvs.push(x/15,z/15);}
    if(i<32){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  add({t:'mesh',nm:'The caldera magma lagoon',p:[0,0,0],vertices,indices,uvs,tex:'nightworks-magma',fog:false,
    solid:false,edgeGrinding:false,castShadow:false,doubleSided:true,grp:90});
  for(const [i,x]of [-14,10,72,100].entries()){
    add({t:'decor',nm:'Volcanic quarry arch',dkind:'nightdistantarch',p:[x,-20,-33-i%2*9],s:[17,22+i%3*3,9],yaw:i*17-22,color:'#a8a8ba',solid:false,grp:90});
    add({t:'decor',nm:'Caldera hanging basalt',dkind:'nightlongisland',p:[x+3,-10,-11],s:[17,8,10],yaw:i*23,solid:false,grp:90});
    add({t:'decor',nm:'Near caldera rim fragment',dkind:'nightsteppingrock',p:[x-5,-11,8],s:[10,7,5],yaw:i*37,color:'#646079',solid:false,grp:90});
  }
  raw.groups!.push({id:90,nm:'Living volcano and quarry scenery',editorOnly:true});
  raw.atmosphere={backdrop:'fog',fogNear:28,fogFar:170,fogColor:'#14182a',drawDistance:1100,
    ambientSky:'#8192c2',ambientGround:'#482231',ambientIntensity:.95,
    sunColor:'#aebde5',sunIntensity:.50,fillColor:'#99819c',fillIntensity:.28};
  return {data:raw,rooms:[],actions:[]};
}

export const CALDERA_BONUS_LEVEL=createCalderaBonus().data;
