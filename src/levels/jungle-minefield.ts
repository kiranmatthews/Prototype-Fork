import type {CustomComponent,CustomLevelData} from '../level';
import type {MinefieldData} from '../minefields';

// Clue orientation: bottom = the approach; top = the far camp. Nothing painted
// on the pressure surface reveals these safe coordinates.
const C:CustomComponent[]=[];
const add=(c:CustomComponent)=>C.push(c);
export const GROVE_WIDTH=12;
export const GROVE_FIELDS:{id:number;start:number;end:number;kind:string;clue:string;data:MinefieldData}[]=[];
let next=74;
for(const [i,len]of [28,24,34,24,40,120,18,26,34,30].entries()){
  const start=next,end=start+len,id=i+1;
  GROVE_FIELDS.push({id,start,end,kind:['six rails','footsteps','curving rail','torn footsteps','cardboard grid','second column','speed jump','lost footsteps','lost grid','last grind'][i],clue:`groveclue${id}`,data:{id,p:[0,0,-(start+end)/2],s:[GROVE_WIDTH,len]}});
  next=end+18;
}
export const GROVE_EXIT_START=next;
export const MINEFIELD_END=GROVE_EXIT_START+58;
export const MINEFIELD_CHECKPOINTS=GROVE_FIELDS.filter(f=>[3,6,7,8,9].includes(f.id)).map(f=>f.end+8);
export const GROVE_GRID_SAFE=[[1],[1,2,3],[3],[2],[1],[0],[0],[0,1,2,3],[3],[3]];
export const GROVE_GRID9_SAFE=[[0],[0,1],[1],[1,2],[2],[2,3],[3],[2,3]];
const g=(id:number)=>GROVE_FIELDS[id-1];
const point=(s:number,y=0,x=0):[number,number,number]=>[x,y,-s];
const rnd=(n:number)=>{const v=Math.sin(n*91.73+18.4)*32159.87;return v-Math.floor(v);};
function spots(id:number,xs:number[],radius=1.65){
  const f=g(id),length=f.end-f.start;
  // Match the painted circle centres: 16/33/50/67/84% along the cloth.
  const margin=id===8?1:length*.16,step=(length-margin*2)/Math.max(1,xs.length-1);
  f.data.spots=xs.map((x,i)=>[x,-(f.start+margin+i*step),radius]);
}
spots(2,[-3,0,3,3,0]);
spots(4,[-3,0,3,3,3]);
spots(8,[3,0,-3,-3,0,3],1.55);
function grid(id:number,rows:number[][]){
  const f=g(id),depth=(f.end-f.start)/rows.length;
  f.data.rectangles=rows.flatMap((cols,row)=>cols.map(col=>[-4.5+col*3,-(f.start+(row+.5)*depth),3,depth] as [number,number,number,number]));
  for(let row=0;row<rows.length;row++)for(let col=0;col<4;col++){
    // Flush cardboard is a visual grid, never a raised bypass or grind edge.
    add({t:'mesh',p:point(f.start+(row+.5)*depth,.018,-4.5+col*3),vertices:[-1.48,0,-depth/2+.025,1.48,0,-depth/2+.025,1.48,0,depth/2-.025,-1.48,0,depth/2-.025],indices:[0,2,1,0,3,2],uvs:[0,0,1,0,1,1,0,1],solid:false,tex:'cardboard',color:(row+col)%3?'#92734b':'#866b49',grp:100+id,nm:'Blank cardboard grid cell'});
  }
}
grid(5,GROVE_GRID_SAFE);grid(9,GROVE_GRID9_SAFE);
g(6).data.rectangles=[[-1.5,-(g(6).start+g(6).end)/2,3,120]];
function rail(id:number,x:number,a:number,b:number,trapped=false,points?:[number,number,number,number][]){
  add({t:'rail',p:point(a,.55,x),pts:points??[[0,0,0,0],[0,-(b-a),0,0]],dkind:'bw-grind-rail',minefieldTrap:trapped?id:undefined,grp:100+id,nm:trapped?'Wired rail':'Old jungle rail'});
}
for(const [row,range]of [[g(1).start-3,g(1).start+12],[g(1).start+16,g(1).end+3]].entries())
  for(const [col,x]of [-3.6,0,3.6].entries())rail(1,x,range[0],range[1],col!==(row===0?0:1));
for(const id of [3,10]){
  const f=g(id),a=f.start-3,b=f.end+3,n=30;
  rail(id,0,a,b,false,Array.from({length:n+1},(_,i)=>{const t=i/n;return[-3*Math.sin(t*Math.PI*2),-(b-a)*t,0,0];}));
}
// Field 6's tempting cartons wander across live ground. Their colour and spacing
// are independent of the safe second column on the cloth.
for(let s=g(6).start+2,i=0;s<g(6).end;s+=3.7,i++){
  const x=3*Math.sin(i*.67)+1;
  add({t:'mesh',p:point(s,.025,x),vertices:[-1.1,0,-1.4,1.1,0,-1.4,1.1,0,1.4,-1.1,0,1.4],indices:[0,2,1,0,3,2],uvs:[0,0,1,0,1,1,0,1],solid:false,tex:'cardboard',color:'#9b8159',grp:106,nm:'Misleading flattened cardboard'});
}
// TNT on safe grid squares must be jumped over or avoided within that square.
for(const [row,col]of [[1,2],[4,1],[7,2]])add({t:'crate',kind:'tnt',p:point(g(5).start+(row+.5)*4,0,-4.5+col*3),grp:105,nm:'TNT on safe cardboard'});
add({t:'crate',kind:'nitro',p:point(g(9).start+19,0,4.5),grp:109,nm:'Nitro wired to the whole ninth field'});
add({t:'crate',kind:'tnt',p:point(g(10).start+16,0,-4.5),grp:110,nm:'Explosive jungle debris'});
add({t:'ramp',p:point(g(7).start-6),len:10,w:5,rise:3.2,tex:'treehouse-timber',color:'#766147',grp:107,nm:'Full-speed launch ramp'});
// The ramp's launch lip stops before live ground. Its real rise earns the air.
add({t:'speedpad',p:point(g(7).start-15,.04),s:[4,.08,3],speed:19,cycle:1.5,grp:107,nm:'Run-up board boost'});

// Continuous unmarked soil, with no root stripe, dots, pickups or mine meshes.
add({t:'platform',p:point((58+GROVE_EXIT_START)/2,-.6),s:[12,1.2,GROVE_EXIT_START-58],tex:'dirt',color:'#514735',edgeGrinding:false,grp:1,nm:'Continuous buried jungle soil'});
for(const side of [-1,1]){
  add({t:'wallpath',p:[side*7.8,-1.5,0],pts:[[0,-55],[0,-GROVE_EXIT_START-4]],w:3.6,rise:3.5,collisionHeight:12,containment:true,edgeGrinding:false,tex:'dirt',color:'#323326',grp:2,nm:'Impenetrable jungle earth bank'});
  for(let s=58,i=0;s<GROVE_EXIT_START+8;s+=6.2,i++){
    add({t:'decor',dkind:'trialsv3thicket',p:point(s,.15,side*7.2),s:[5,4.5+rnd(i),6.8],yaw:side*90+i*13,scenerySolid:false,grp:2,nm:'Dense night jungle undergrowth'});
    if(i%2===0)add({t:'decor',dkind:'treehousesugarcane',p:point(s+1,.7,side*8.2),s:[4,9,4],yaw:i*37,scenerySolid:false,grp:2,nm:'Closed bamboo wall'});
    if(i%3===0)add({t:'decor',dkind:'treehousetree',p:point(s,.1,side*11.5),s:[17,22,18],yaw:i*83,scenerySolid:false,grp:2,nm:'Deep canopy trunks'});
    add({t:'decor',dkind:'junglefern',p:point(s-1,.1,side*6.7),s:[2.6,2.2,3.3],yaw:i*51,scenerySolid:false,grp:2,nm:'Fern fringe'});
  }
}
for(let s=56,i=0;s<GROVE_EXIT_START+12;s+=10,i++){
  add({t:'decor',dkind:'trialsv3bough',p:point(s,8.7),s:[20,6,13],yaw:i%2?180:0,scenerySolid:false,grp:3,nm:'Interlocking black jungle canopy'});
  for(const side of [-1,1])add({t:'decor',dkind:'vines',p:point(s+2,8.4,side*5.6),rise:3.5,n:3,grp:3,nm:'Hanging lianas'});
}
function camp(s:number,id:number,checkpoint:boolean){
  const group=100+id;
  add({t:'decor',dkind:'grovecamp',p:point(s+1,0,3.3),s:[4.8,3.5,4.2],yaw:-12,scenerySolid:false,grp:group,nm:'Meshy expedition checkpoint shelter'});
  for(const side of [-1,1])add({t:'torch',p:point(s-2,0,side*5.4),rise:1.8,w:.85,grp:group,nm:'Safe camp fire'});
  add({t:'crate',kind:'wood',p:point(s-1,0,3.9),grp:group,nm:'Camp supplies'});
  add({t:'crate',kind:id%2===0?'life':'mystery',p:point(s+2,0,4.2),grp:group,nm:'Refuge provisions'});
  if(checkpoint)add({t:'checkpoint',p:point(s,0,0),grp:group,nm:'No-Man’s Grove checkpoint'});
}
camp(65,0,false);
for(const f of GROVE_FIELDS){
  camp(f.end+8,f.id,[3,6,7,8,9].includes(f.id));
  add({t:'decor',dkind:f.clue as 'groveclue1',p:point(f.start-5,.55,-4.7),s:[2.6,3.9,.02],scenerySolid:false,grp:100+f.id,nm:`Field ${f.id} · canvas clue`});
  for(const x of [-6,-3.4])add({t:'decor',dkind:'block',scenerySolid:false,p:point(f.start-5.1,0,x),s:[.13,4.6,.13],tex:'wood',color:'#554332',grp:100+f.id,nm:'Clue rag stake'});
  add({t:'decor',dkind:'block',scenerySolid:false,p:point(f.start-5.1,4.35,-4.7),s:[2.9,.12,.12],tex:'wood',color:'#554332',grp:100+f.id,nm:'Clue rag crossbar'});
  for(const at of [f.start-.4,f.end+.4])add({t:'mesh',p:point(at,.025),vertices:[-6,0,-.15,6,0,-.15,6,0,.15,-6,0,.15],indices:[0,2,1,0,3,2],tex:'treehouse-timber',color:'#827152',solid:false,grp:100+f.id,nm:'Minefield boundary timber'});
  for(let s=f.start+10;s<f.end;s+=18)for(const side of [-1,1])add({t:'torch',p:point(s,1,side*6.2),rise:1.3,w:.6,grp:100+f.id,nm:'Bank fire basket'});
}

export function groveTunnelFloor(s:number):number{return s<58?-5+5*Math.max(0,s+12)/70:s>GROVE_EXIT_START?-14*(s-GROVE_EXIT_START)/58:0;}
// Reuse Hollowwake's generated round rock bore with a matching interior collision
// skin. Forward camera nodes, no chase data, stone, reverse camera or sky holes.
function tunnel(a:number,b:number){
  const radius=7.2,angles=32,rows=Math.ceil((b-a)/3),vertices:number[]=[],normals:number[]=[],indices:number[]=[];
  for(let j=0;j<=rows;j++){
    const s=a+(b-a)*j/rows,y=groveTunnelFloor(s);
    for(let i=0;i<angles;i++){const t=i*Math.PI*2/angles;vertices.push(radius*Math.sin(t),y+radius*(1-Math.cos(t)),-s);normals.push(-Math.sin(t),Math.cos(t),0);}
  }
  for(let j=0;j<rows;j++)for(let i=0;i<angles;i++){const k=j*angles+i,n=j*angles+(i+1)%angles;indices.push(k,n,k+angles,n,n+angles,k+angles);}
  add({t:'mesh',p:[0,0,0],vertices,normals,indices,solid:true,solidSides:true,doubleSided:true,invisible:true,edgeGrinding:false,grp:4,nm:'Continuous enclosed tunnel collision'});
  for(let s=a;s<b;s+=18){
    const end=Math.min(b,s+18),p=point(s,groveTunnelFloor(s));
    add({t:'decor',dkind:'hollowcavebore',p,pts:Array.from({length:7},(_,i)=>{const q=s+(end-s)*i/6;return[0,-(q-s),0,groveTunnelFloor(q)-p[1],0];}),widths:Array(7).fill(radius),len:end-s,scenerySolid:false,grp:4,nm:'Reused Hollowwake rock tunnel'});
    for(const side of [-1,1])add({t:'torch',p:point(s+5,groveTunnelFloor(s+5)+1,side*3.9),rise:1.7,w:1,grp:4,nm:'Fire-lit tunnel bracket'});
  }
}
tunnel(-12,58);tunnel(GROVE_EXIT_START,MINEFIELD_END+12);
add({t:'clock',p:point(8,groveTunnelFloor(8)+1.75,4.7),grp:4,nm:'Optional tunnel time trial'});
add({t:'crate',kind:'wood',p:point(21,groveTunnelFloor(21),2),grp:4,nm:'Abandoned tunnel crate'});
add({t:'crate',kind:'life',p:point(GROVE_EXIT_START+20,groveTunnelFloor(GROVE_EXIT_START+20),2),grp:4,nm:'Final tunnel supplies'});
add({t:'crystal',p:point(MINEFIELD_END-12,groveTunnelFloor(MINEFIELD_END-12)+1),grp:4,nm:'No-Man’s Grove crystal'});
add({t:'gate',p:point(MINEFIELD_END,groveTunnelFloor(MINEFIELD_END)),grp:4,nm:'Underground extraction'});
for(let s=-12;s<=MINEFIELD_END+16;s+=6)add({t:'camnode',p:point(s,groveTunnelFloor(s)),radius:14,grp:5,nm:'Forward route away from camera'});
export const JUNGLE_MINEFIELD_LEVEL:CustomLevelData={v:1,name:'No-Man’s Grove',spawn:point(0,groveTunnelFloor(0)+.15),killY:-40,startWarpPad:false,sky:'night',jungleAtmosphere:true,jungleDepthFade:false,keepPlayFog:true,
  minefields:GROVE_FIELDS.map(f=>f.data),cameraRig:{camDist:7.8,camHeight:3.6,camPitch:15,camFov:61},cameraLookAhead:4,cameraAirLift:.45,
  atmosphere:{backdrop:'fog',fogEnabled:true,fogNear:12,fogFar:58,fogColor:'#0b1514',ambientSky:'#869c96',ambientGround:'#40392e',ambientIntensity:.58,sunColor:'#71958e',sunIntensity:.12,fillColor:'#718a8a',fillIntensity:.14,drawDistance:95,shadowStrength:.9,fallbackStars:false,fallbackRidges:false,fallbackSunColor:null},
  components:C,groups:[{id:1,nm:'Unmarked earth',editorOnly:true},{id:2,nm:'Enclosed jungle banks',editorOnly:true},{id:3,nm:'Night canopy',editorOnly:true},{id:4,nm:'Entrance and exit tunnels',editorOnly:true},{id:5,nm:'Forward camera',editorOnly:true},{id:100,nm:'Arrival camp',editorOnly:true},...GROVE_FIELDS.map(f=>({id:100+f.id,nm:`${f.id}. ${f.kind}`,editorOnly:true}))]};
