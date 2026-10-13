import type { CustomComponent, CustomGroup, CustomLevelData } from '../level';
import { PIRATE_PROPS } from './pirate-props.generated';
import { pirateMeshes, SEA, type P } from './pirate-meshes';
import { HARBOUR_ROUTE, HARBOUR_SPAWN, PIRATE_HARBOUR_COMPONENTS } from './pirate-harbour';
import { dressDrownedCrown } from './pirate-art';
import { cutPiratePassage } from './pirate-clearance';

const C:CustomComponent[]=[...PIRATE_HARBOUR_COMPONENTS],M=pirateMeshes(C);
const groups:CustomGroup[]=['Smugglers tunnels','Moonpool cavern','The Drowned Crown · hull','Broken upper decks','Flooded cargo hold','Captains quarterdeck','Treasure passage','Port Royal · customs quay','Port Royal · broken cargo jetty','Port Royal · fort sea gate'].map((nm,i)=>({id:i+1,nm,editorOnly:true}));
let grp=1;const section=(n:number)=>{grp=n;M.setGroup(n);};
const add=(c:CustomComponent)=>C.push({grp,...c});
function prop(kind:keyof typeof PIRATE_PROPS,p:P,size:number,yaw=0){
 for(const part of PIRATE_PROPS[kind])add({t:'mesh',p,s:[size,size,size],yaw,vertices:part.vertices,indices:part.indices,solid:false,doubleSided:true,color:part.color,tex:'solid',edgeGrinding:false,nm:`Meshy ${kind} · custom low-poly prop`});
}
function floor(name:string,a:P,b:P,width:number,color:string=SEA.stone,thickness=.75){
 const d=Math.hypot(b[0]-a[0],b[2]-a[2]),rx=-(b[2]-a[2])/d*width/2,rz=(b[0]-a[0])/d*width/2;
 const p=(q:P,side:number,y=0):P=>[q[0]+rx*side,q[1]+y,q[2]+rz*side];const v:number[]=[];
 M.quad(v,p(a,-1),p(a,1),p(b,1),p(b,-1));M.quad(v,p(a,-1,-thickness),p(b,-1,-thickness),p(b,1,-thickness),p(a,1,-thickness));
 for(const s of [-1,1])M.quad(v,p(a,s),p(a,s,-thickness),p(b,s,-thickness),p(b,s));
 M.quad(v,p(a,-1),p(a,-1,-thickness),p(a,1,-thickness),p(a,1));M.quad(v,p(b,-1),p(b,1),p(b,1,-thickness),p(b,-1,-thickness));
 M.mesh(name,v,color,true);
}
function planks(name:string,a:P,b:P,width:number,spacing=1.7){
 floor(name,a,b,width,SEA.timber,.65);
 const d=Math.hypot(b[0]-a[0],b[2]-a[2]),count=Math.max(1,Math.ceil(d/Math.max(.28,spacing*.32))),v:number[]=[];
 const rx=-(b[2]-a[2])/d*width/2,rz=(b[0]-a[0])/d*width/2;
 const pt=(t:number,side:number):P=>[a[0]+(b[0]-a[0])*t+rx*side,a[1]+(b[1]-a[1])*t+.018,a[2]+(b[2]-a[2])*t+rz*side];
 for(let i=0;i<count;i++){const t0=(i+.03)/count,t1=(i+.97)/count;M.quad(v,pt(t0,-1),pt(t0,1),pt(t1,1),pt(t1,-1));}
 M.mesh('Fitted weathered deck boards · '+name,v,SEA.honey,false,{scenerySolid:false});
}
function fruit(a:P,b:P,count=5){for(let i=0;i<count;i++){const t=i/(count-1);add({t:'wumpa',p:a.map((v,k)=>v+(b[k]-v)*t+(k===1?.9:0)) as P});}}
function checkpoint(p:P,nm:string){add({t:'checkpoint',p,nm});M.lantern([p[0]+3,p[1],p[2]]);}
function tunnel(a:P,b:P,width=13,height=13){
 const length=Math.hypot(b[0]-a[0],b[2]-a[2]),dx=(b[0]-a[0])/length,dz=(b[2]-a[2])/length,n=Math.ceil(length/4);
 for(let k=0;k<n;k++){
  const v:number[]=[];
  for(let j=0;j<7;j++){
   const pt=(s:number,i:number):P=>{const t=s/n,theta=i*Math.PI/7,flare=1+.075*Math.sin(s*2.3+i*1.7);return[a[0]+(b[0]-a[0])*t-dz*Math.cos(theta)*width*.5*flare,a[1]+(b[1]-a[1])*t+Math.sin(theta)*height*flare-.9,a[2]+(b[2]-a[2])*t+dx*Math.cos(theta)*width*.5*flare];};
   M.quad(v,pt(k,j),pt(k+1,j),pt(k+1,j+1),pt(k,j+1));
  }
  M.mesh('Faceted underground tunnel shell',v,k%3===0?'#536e72':SEA.stone);
  if(k%3===0){const t=(k+.5)/n,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,z=a[2]+(b[2]-a[2])*t;
   M.beam('Old mine brace',[x-dz*width*.45,y,z+dx*width*.45],[x-dz*width*.45,y+8,z+dx*width*.45],.25);
   M.beam('Old mine brace',[x+dz*width*.45,y,z-dx*width*.45],[x+dz*width*.45,y+8,z-dx*width*.45],.25);
   M.beam('Mine lintel',[x-dz*width*.45,y+8,z+dx*width*.45],[x+dz*width*.45,y+8,z-dx*width*.45],.27);
   M.lantern([x-dz*(width*.5-1),y+1,z+dx*(width*.5-1)]);
  }
 }
}
export const PIRATE_ROUTE:P[]=[[-48,0,48],[-48,0,20],[-34,-3,-8],[-36,-6,-38],[-20,-6,-58],[-20,-6,-75],[0,8,-106],[0,8,-124],[-8,8,-134],[-8,-4,-162],[-8,-4,-181],[0,-4,-192],[8,-4,-204],[8,8,-237],[0,8,-246],[30,10,-269],[32,10,-288],[32,10,-320]];
export const PIRATE_WRECK_ID='drowned-crown';
// Main route is fully grounded apart from two deliberately small charged hops.
// Optional rigging, side vaults and quarterdeck rewards broaden the exploration.
section(1);
for(let i=1;i<6;i++){const a=PIRATE_ROUTE[i-1],b=PIRATE_ROUTE[i];
 if(i===3){floor('Fissure near bank',a,[-34.8,-4.2,-20],12);floor('Fissure far bank',[-35.03,-4.55,-23.5],b,12);}
 else floor('Excavated smugglers trail',a,b,12);
 if(i<5)tunnel(a,b);fruit(a,b,4);}
floor('Open moonpool lookout ledge',[-24,-6,-55],[-24,-6,-77],22);
// Tidal fissure is a real missing floor: both banks meet the existing trail.
// Side passage offers a raised crystal grotto and rejoins before the ship.
export const PIRATE_GROTTO_ROUTE:P[]=[[-35,-5,-31],[-58,-4,-40]];
floor('Grotto branch',PIRATE_GROTTO_ROUTE[0],PIRATE_GROTTO_ROUTE[1],7);tunnel(PIRATE_GROTTO_ROUTE[0],PIRATE_GROTTO_ROUTE[1],9,12);
floor('Hidden crystal alcove',[-58,-4,-40],[-58,-4,-54],13);tunnel([-58,-4,-40],[-58,-4,-54],16,15);
add({t:'wall',p:[-58,-4,-54.5],s:[16,14,1],color:SEA.stone,tex:'stone',nm:'Crystal grotto · closed limestone back wall'});
add({t:'crate',p:[-58,-4,-50],kind:'life',nm:'Lost expedition cache'});
for(let i=0;i<10;i++)M.rock('Turquoise crystal cluster',[-58+(i%2?5:-5),-2.7,-43-Math.floor(i/2)*2],[.6,1.4+i%3*.3,.7],i*.1,'#60aaa3');
for(let i=0;i<22;i++){const z=42-i*3.9,t=Math.min(1,(48-z)/56),x=-48+14*t;M.rock('Tunnel edge rubble',[x+(i%2?5.5:-5.5),-t*3-.1,z],[.5+i%3*.2,.45,.7],i,SEA.pale);}
checkpoint([-20,-6,-68],'01 · Moonpool lookout');
M.barrel([-24,-6,-69]);M.barrel([-25,-6,-67],.8);
section(2);
// A continuous enclosing skin prevents sky leaking between the dressed rock
// masses. Portals are deliberately cut out at the waterfront and vault exit.
const shell:number[]=[];
for(let z=48;z>-352;z-=20)for(let j=0;j<14;j++){
 const pt=(depth:number,k:number):P=>{const a=k*Math.PI/14,h=53+Math.min(1,(48-depth)/90)*30,right=45+63*Math.min(1,(48-depth)/125);return[Math.cos(a)*(Math.cos(a)>0?right:108),-11+Math.sin(a)*h,depth];};
 M.quad(shell,pt(z,j),pt(z-20,j),pt(z-20,j+1),pt(z,j+1));
}
M.mesh('Continuous limestone cavern enclosure',shell,'#354f58');
for(const [z,doorX,doorBottom,doorTop] of [[48,-48,-1,12],[-352,32,10,30]]){
 const face:number[]=[];
 const end=z===48?45:108;
 const xs=[...new Set([-108,-90,-72,-54,-36,-18,0,18,36,54,72,90,end,doorX-8,doorX+8].filter(x=>x<=end))].sort((a,b)=>a-b);
 const top=(x:number)=>-11+Math.sqrt(Math.max(0,1-(x/(x>0?end:108))**2))*(z===48?53:83);
 for(let i=1;i<xs.length;i++){
  const a=xs[i-1],b=xs[i],door=a>=doorX-8&&b<=doorX+8,base=door?doorTop:-11;
  M.quad(face,[a,base,z],[b,base,z],[b,Math.max(base,top(b)),z],[a,Math.max(base,top(a)),z]);
  if(door)M.quad(face,[a,-11,z],[b,-11,z],[b,doorBottom,z],[a,doorBottom,z]);
 }
 M.mesh('Limestone headland with open portal',face,'#405a61');
}
// A 240 m chamber surrounds the 156 m wreck; all rocks are bespoke faceted meshes.
const water:number[]=[];M.quad(water,[-100,-10,80],[100,-10,80],[100,-10,-345],[-100,-10,-345]);M.mesh('Still luminous underground sea',water,'#246d78',false,{emissive:'#082e37',materialStyle:'water'});
add({t:'pit',p:[0,-10.2,-132],s:[205,1,440],invisible:true,nm:'Cold bottomless moonpool'});
for(let side=-1;side<=1;side+=2)for(let i=0;i<22;i++){
 const z=50-i*19,x=side*(72+Math.sin(i*1.31)*10)+(side<0&&z>-85?-30:0),y=-9;
 if(side>0&&z>-80)continue;
 M.rock('Massive cavern cliff',[x,y+20,z],[18,33+8*Math.sin(i),17],i+side*2,i%3===0?'#52666b':'#344e59');
 M.rock('Cavern hanging stalactite',[x*.72,41,z],[4,13+i%5,5],i+3,SEA.stone);
}
for(let i=0;i<18;i++)M.rock('Moonpool stepping rubble',[-31+Math.sin(i*2)*9,-9,-82-i*8],[4,2.5,5],i,SEA.pale);
for(let i=0;i<14;i++)M.rock('Vaulted cavern ceiling',[Math.sin(i)*25,53,-75-i*17],[45,12,25],i,'#263c48');
// Slender shafts are pale low-poly translucent sheets; no expensive point lights.
for(const [x,z] of [[-18,-120],[30,-196],[-30,-260]]){
 const v:number[]=[];M.quad(v,[x-2,48,z],[x+2,48,z],[x+12,-9,z+4],[x-7,-9,z+4]);M.mesh('Moonlight through cave fissure',v,'#97d8d6',false,{opacity:.08,fog:false});
}
planks('Salvaged boarding gangway',PIRATE_ROUTE[5],PIRATE_ROUTE[6],7,1.6);
for(const side of [-1,1])M.rope('Gangway hand rope',[-20+side*3.5,-4.9,-75],[side*3.5,9.1,-106],.5,.09);
section(3);
const rings=[[-92,7],[-103,15],[-120,19],[-142,20],[-155,19],[-176,18],[-197,17],[-222,13],[-244,5],[-252,0]];
for(let k=1;k<rings.length;k++){
 if(k===5)continue;
 const [za,wa]=rings[k-1],[zb,wb]=rings[k];
 for(const side of [-1,1])for(let band=0;band<6;band++){
  if(side===-1&&(k===6||k===7)&&(band===1||band===2))continue; // shattered port hull opens into the hidden powder room
  const v:number[]=[],y0=-9+band*3.4,y1=y0+3.3,f=(y:number)=>.28+.72*Math.pow((y+9)/20.4,.6);
  const p=(z:number,w:number,y:number):P=>[side*w*f(y),y,z];M.quad(v,p(za,wa,y0),p(zb,wb,y0),p(zb,wb,y1),p(za,wa,y1));
  M.mesh('Hand-shaped broken galleon hull planking',v,band%2?'#69422f':'#805238');
 }
}
// Splintered ribs expose the cross section at the catastrophic midship break.
for(const z of [-154,-177])for(let i=0;i<11;i++){
 const theta=i*Math.PI/10;M.beam('Exposed ship rib',[Math.cos(theta)*5,-9,z],[Math.cos(theta)*19,11-Math.sin(theta)*15,z+(i%2?2:-2)],.46,SEA.honey);
}
for(let z=-105;z>-243;z-=9)for(const side of [-1,1]){
 const w=z>-155?18:z>-219?16:10;
 M.beam('Hull oak frame',[side*w*.48,-8,z],[side*w,10.8,z],.32,SEA.dark);
}
// Bowsprit and gilded prow: strong silhouette across the moonlit water.
M.beam('Long broken bowsprit',[0,10,-239],[0,17,-277],.8,SEA.timber,8);
M.rope('Bowsprit stay',[-9,10,-220],[0,17,-274],3,.12);M.rope('Bowsprit stay',[9,10,-220],[0,17,-274],3,.12);
M.rock('Carved golden sea serpent figurehead',[0,11,-253],[2,3,4],4,SEA.brass);
section(4);
// Deck pieces leave true open hatches over the descent and ascent ramps.
// The boarding ramp reaches the deck at -106. Keep the shattered stern open
// before that seam so the approach never passes through an overhead floor.
planks('Afterdeck',[0,8,-106],[0,8,-132],29);
planks('Shattered stern port margin',[-13,8,-95],[-13,8,-106],3);
planks('Shattered stern starboard margin',[9,8,-95],[9,8,-106],11);
planks('Port hatch coaming',[-16,8,-132],[-16,8,-155],5);
planks('Starboard main deck',[6,8,-132],[6,8,-154],24);
planks('Forward main deck',[0,8,-177],[0,8,-204],31);
planks('Forecastle port deck',[-7,8,-204],[-7,8,-237],17);
planks('Forecastle starboard lip',[14,8,-204],[14,8,-227],3);
planks('Bow hatch receiving deck',[4,8,-237],[4,8,-241],18);
planks('Narrow bow deck',[0,8,-241],[0,8,-248],10);
// A daring high shortcut uses a narrow fallen mast over the shattered hull.
planks('Fallen mast balance crossing',[5,8,-153],[5,8,-179],2.4,.85);
M.beam('Fallen mast splinter', [4,8,-157],[12,10,-169],.45,SEA.honey);
add({t:'rail',p:[5,8.35,-166],len:29,yaw:0,nm:'Fallen mast grind shortcut'});
for(const z of [-114,-194,-230]){
 const h=z===-194?51:z===-114?42:34;
 M.beam('Towering galleon mast',[0,8,z],[z===-194?-4:1,h,z-3],.78,SEA.timber,8);
 M.beam('Massive horizontal yard',[-17,h-8,z-2],[17,h-8,z-2],.42,SEA.honey);
 for(const side of [-1,1]){M.rope('Standing rigging',[side*14,9,z+9],[0,h-2,z-2],.65,.09);
  M.rope('Lower shroud',[side*14,9,z-8],[0,h-10,z-2],.4,.085);}
 // Ragged multi-panel sail with physically missing lower triangles.
 const v:number[]=[];
 for(let col=0;col<8;col++)for(let row=0;row<4;row++){
  if(row===3&&(col===0||col===3||col===6))continue;
  const pt=(x:number,y:number):P=>[-15+x*3.75,h-8-y*3.8+(y===4?(x%3)*1.1:0),z-2+Math.sin(x*Math.PI/8)*2.8+Math.sin(y*.8)];
  M.quad(v,pt(col,row),pt(col+1,row),pt(col+1,row+1),pt(col,row+1));
 }
 M.mesh('Torn ivory sail · missing cloth panels',v,SEA.sail);
 M.box('Crows nest basket',[0,h-13,z-1],[4.4,1.1,4.4],SEA.dark);
 for(const side of [-1,1])M.beam('Nest railing',[side*2,h-12,z-3],[side*2,h-12,z+1],.13,SEA.honey);
 add({t:'wall',p:[0,8,z],s:[1.4,h-8,1.4],invisible:true,nm:'Solid mast core'});
}
// Rail posts, gunports, coils and abandoned cargo make the deck read at human scale.
for(let z=-101;z>-238;z-=6){
 if(z<-152&&z>-179)continue;
 const w=z>-151?14.7:z>-214?15.5:11;
 for(const side of [-1,1]){
  M.beam('Broken bulwark post',[side*w,8,z],[side*w,10.3+(z%3)*.2,z],.19,SEA.honey);
  if(z%4)M.beam('Bulwark rail',[side*w,10.1,z],[side*w,10.1,z-4.8],.14,SEA.honey);
  M.box('Black square gunport',[side*(w+1.3),3.5,z],[.13,1.7,2.3],SEA.dark);
 }
}
for(const p of [[-10,8,-120],[10,8,-124],[12,8,-187],[-11,8,-204],[-9,8,-220]] as P[]){M.barrel(p);M.barrel([p[0]+1.8,p[1],p[2]-1.3],.82);}
for(const p of [[11,8,-116],[-11,8,-127],[-10,8,-190],[11,8,-199]] as P[]){
 prop('cannon',p,3.4,p[0]>0?-90:90);
 add({t:'wall',p,s:[2.8,1.8,2.8],invisible:true,nm:'Solid cannon carriage'});
}
for(const p of [[4,8,-120],[-4,8,-144],[10,8,-189],[-6,8,-211]] as P[])M.lantern(p);
fruit([4,8,-109],[4,8,-127],6);
// Broad afterdeck footing gives the optional ledger room a deliberate jump
// entrance without placing its stone beneath the sloping hatch's overhang.
add({t:'bonusplatform',p:[-6,8,-121],to:[-3.5,8.1,-124],nm:'Afterdeck ledger bonus'});
checkpoint([-6,8,-129],'02 · The broken galleon');
// Suspended rope swing and grindable port rope reward leaving the central trail.
add({t:'rope',p:[-12,13,-165],len:31,yaw:0,amp:2,nm:'Port rigging treasure shortcut'});
add({t:'pendulum',p:[5,25,-167],len:16,amp:.62,speed:1.15,nm:'Swinging anchor over the high shortcut'});
add({t:'ropeswing',p:[-4,32,-163],len:17,amp:.35,speed:0,yaw:0,nm:'Loose mainmast halyard'});
section(5);
planks('Splintered hatch descent',[-8,8,-132],[-8,-4,-162],7,1.5);
planks('Keel bridge through wreck',[-8,-4,-162],[-8,-4,-181],6,1.2);
planks('Flooded lower cargo hold',[0,-4,-177],[0,-4,-209],28);
planks('Rising escape through bow hatch',[8,-4,-204],[8,8,-237],7,1.5);
// High deck is the ceiling; rib vaults are open and tall enough for the camera.
for(let z=-182;z>-208;z-=6){
 M.beam('Cargo hold deck beam',[-15,7,z],[15,7,z],.45,SEA.dark);
 for(const x of [-13,13]){M.beam('Cargo hold rib',[x,-4,z],[x,7,z],.34,SEA.timber);M.lantern([x,-2,z]);}
}
for(const p of [[-12,-4,-180],[-10,-4,-202],[12,-4,-187],[11,-4,-201]] as P[]){
 M.barrel(p,1.2);M.barrel([p[0]+1.4,p[1],p[2]+1.6]);
 M.box('Cargo chest',[p[0],p[1]+.75,p[2]-2],[2.2,1.5,1.5],SEA.timber);
}
add({t:'crate',p:[-4,-4,-185],kind:'wood',nm:'Salvage cargo'});
add({t:'crate',p:[3,-4,-195],kind:'mystery',nm:'Old smugglers provisions'});
add({t:'crate',p:[-11,-4,-195],kind:'mask',nm:'Hold guardian cache'});
add({t:'enemy',p:[-4,-4,-199],foe:'grunt',range:3,speed:.9,nm:'Hold scavenger'});
checkpoint([3,-4,-201],'03 · Below the waterline');
fruit([-8,-4,-165],[-8,-4,-180],4);fruit([1,-4,-184],[1,-4,-198],5);
// A side alcove holds the optional route crystal behind small stepping lids.
planks('Secret powder room landing',[-22,-4,-190],[-22,-4,-206],8);
planks('Powder room crosswalk',[-13,-4,-198],[-24,-4,-198],3);
add({t:'crystal',p:[-23,-3,-202],nm:'The Drowned Crown jewel'});
for(let i=0;i<4;i++)M.barrel([-24+i*1.7,-4,-205]);
M.lantern([-25,-3,-193]);
section(6);
planks('Quarterdeck stair ramp',[10,8,-126],[10,14,-104],6);
planks('Captains raised quarterdeck',[-3,14,-95],[-3,14,-108],16);
planks('Quarterdeck ramp receiving deck',[7,14,-95],[7,14,-104],10);
for(const x of [-9,9])M.box('Captains cabin side',[x,19,-99],[.6,10,8],SEA.timber);
M.box('Captains cabin stern',[0,19,-93],[18,10,.6],SEA.timber);
for(const x of [-9,9])M.beam('Quarterdeck bearing strut',[x,8,-105],[x,14,-98],.45,SEA.dark);
M.box('Weathered cabin roof',[0,24.7,-99],[21,.7,15],SEA.dark);
for(const x of [-6,-3,0,3,6]){
 M.box('Golden stern window',[x,17.5,-92.6],[1.8,2.7,.12],SEA.brass);
 M.box('Stern window mullion',[x,17.5,-92.5],[.12,2.7,.14],SEA.dark);
}
M.box('Captains chart table',[0,15,-99],[5,.3,2.8],SEA.honey);
M.box('Unrolled parchment',[0,15.2,-99],[3.8,.04,2.1],SEA.sail);
M.beam('Ships wheel pedestal',[-4,14,-107],[-4,16,-107],.2,SEA.dark);
for(let i=0;i<8;i++){const a=i*Math.PI/4;M.beam('Helm wheel spoke',[-4,16.5,-107],[-4+Math.cos(a)*1.4,16.5+Math.sin(a)*1.4,-107],.1,SEA.brass);}
add({t:'crate',p:[5,14,-98],kind:'life',nm:'Captains private stash'});
M.lantern([-7,15,-96]);M.lantern([7,15,-96]);
section(7);
planks('Bow escape landing',[0,8,-241],[6,8.4,-252],10);
planks('Rope bridge near bank',[6,8.4,-252],[16,9.05,-260],5.2,.9);
planks('Rope bridge far bank',[18.7,9.3,-262.2],[30,10,-271],5.2,.9);
for(const side of [-1,1]){
 M.rope('Long escape bridge cable',[6+side*2,10,-252],[30+side*2,11.5,-271],1.4,.1);
 M.beam('Bridge anchoring post',[30+side*3,10,-271],[30+side*3,13,-271],.25);
}
floor('Treasure grotto path',[30,10,-269],[32,10,-288],13);tunnel([30,10,-269],[32,10,-288],15,15);
floor('Royal treasure chamber',[32,10,-286],[32,10,-326],24,SEA.pale,1.6);tunnel([32,10,-286],[32,10,-326],27,20);
checkpoint([32,10,-279],'04 · The kings ransom');
prop('skull-gate',[32,20,-288],17);
for(const x of [23,41]){M.rock('Skull portal stone pillar',[x,14,-288],[3,7,3],x,SEA.pale);add({t:'wall',p:[x,10,-288],s:[4,9,4],invisible:true,nm:'Skull arch pillar'});}
// Treasure dais is reachable by a broad shallow ramp and framed by gilded relics.
floor('Treasure dais ramp',[32,10,-295],[32,12,-306],12,SEA.honey);
floor('Treasure dais',[32,12,-306],[32,12,-326],16,SEA.honey);
for(const side of [-1,1])for(let i=0;i<8;i++){
 const p:P=[32+side*(8+i%2*1.8),10.4,-290-i*4];M.rock('Piles of ancient gold',p,[2.6,.7,2.1],i,SEA.gold);
 for(let j=0;j<4;j++)M.rock('Loose treasure gemstones',[p[0]+Math.sin(j)*1.5,11.1,p[2]+Math.cos(j)*1.2],[.32,.4,.3],i+j,j%2?'#39aaa1':'#b14f55');
}
prop('treasure',[26.5,12,-311],3.8,25);
prop('treasure',[39,10,-294],3,200);
prop('treasure',[-22,-4,-204],2.6,-25);
prop('treasure',[4,14,-101],2.4,20);

M.lantern([23,11,-302]);M.lantern([41,11,-302]);
fruit([32,10,-287],[32,12,-308],8);
add({t:'crate',p:[36,12,-310],kind:'multihit',nm:'The last hoard'});
add({t:'gate',p:[32,12,-319],yaw:0,w:12,nm:'Daylight through the treasure vault'});
// Explicit ordered nodes preserve control direction through the winding caves.
for(const p of [...HARBOUR_ROUTE,...PIRATE_ROUTE.slice(1)])add({t:'camnode',p,radius:5,grp:1,nm:'Authored treasure trail camera'});
add({t:'camnode',p:[0,18,-100],s:[20,16,19],cameraView:true,cameraPosition:[3,18,-114],cameraTarget:[0,15.5,-97],cameraFov:62,radius:2,nm:'Captain cabin · look into the chart room'});
add({t:'camnode',p:[-58,-3,-46],s:[17,13,23],cameraView:true,cameraPosition:[-58,0,-35],cameraTarget:[-58,-2,-47],cameraFollowDistance:5.8,cameraFollowTargetHeight:1.5,cameraFov:67,radius:2,nm:'Crystal grotto · close interior framing'});
add({t:'camnode',p:[-20,-6,-67],s:[22,12,25],cameraView:true,cameraPosition:[-39,7,-46],cameraTarget:[-20,10,-76],cameraFollowDistance:17,cameraFollowTargetHeight:7,cameraFov:68,radius:5,nm:'Moonpool · look up to the galleon'});
add({t:'camnode',p:[32,14,-307],s:[26,14,49],cameraView:true,cameraPosition:[32,16,-270],cameraTarget:[32,17,-295],cameraFollowDistance:10,cameraFollowTargetHeight:3.5,cameraFov:66,radius:5,nm:'Royal vault · crowned arch framing'});
// Broken structures now have visible load paths into stone, hull ribs or piles.
for(const side of [-1,1]){
 for(const t of [.15,.48,.8]){
  const x=-20+20*t+side*3.2,z=-75-31*t,y=-6+14*t;
  M.beam('Gangway support trestle',[x,-10,z],[x,y-.5,z],.32);
 }
 M.rock('Escape bridge anchored limestone',[30+side*6,6,-272],[6,5,7],side,SEA.stone);
 M.beam('Keel crossing bearing timber',[-8+side*2.7,-8,-164],[-8+side*2.7,-4.6,-176],.32);
}
// The hidden powder cache is a real cave opening beyond the shattered hull.
tunnel([-25,-4,-188],[-25,-4,-208],13,13);
export const PIRATE_HATCH_PASSAGES=[
 {a:PIRATE_ROUTE[5],b:PIRATE_ROUTE[6],width:7,height:3.4},
 {a:PIRATE_ROUTE[12],b:PIRATE_ROUTE[13],width:7,height:3.4},
 {a:PIRATE_ROUTE[13],b:PIRATE_ROUTE[14],width:7,height:3.4},
];
export const PIRATE_GROTTO_PASSAGE={a:PIRATE_GROTTO_ROUTE[0],b:PIRATE_GROTTO_ROUTE[1],width:7,height:3.4};
const passageObstacles=new Set(['Hand-shaped broken galleon hull planking','Hull oak frame','Afterdeck',
 'Forecastle port deck','Forecastle starboard lip','Bow hatch receiving deck']);
for(let i=C.length-1;i>=0;i--){
 const c=C[i];
 const passages=c.nm==='Faceted underground tunnel shell'?[PIRATE_GROTTO_PASSAGE]:
  (passageObstacles.has(c.nm??'')||c.nm?.startsWith('Fitted weathered deck boards'))?PIRATE_HATCH_PASSAGES:null;
 if(!passages)continue;
 let cut=c;for(const passage of passages)cut=cutPiratePassage(cut,passage.a,passage.b,passage.width,passage.height);
 if(cut.indices?.length===0)C.splice(i,1);else C[i]=cut;
}
export const PIRATE_WRECK_LEVEL:CustomLevelData={
 v:1,name:'The Drowned Crown',spawn:HARBOUR_SPAWN,killY:-18,sky:'pirate',keepPlayFog:true,cameraAirLift:.35,
 jungleDepthFade:false,jungleStyle:'painterly',
 cameraRig:{camDist:9.4,camHeight:4.8,camPitch:18,camFov:59},cameraLookAhead:5,
 medalTimes:{gold:210,silver:285,bronze:390},
 atmosphere:{fogEnabled:true,fogNear:85,fogFar:400,fogColor:'#657d83',ambientSky:'#cedbed',ambientGround:'#8d8373',ambientIntensity:.8,sunColor:'#ffdfac',sunIntensity:2.9,sunDirection:[.56,.54,-.63],fillColor:'#b4d8e6',fillIntensity:.4,shadowStrength:.8,drawDistance:600,backdrop:'painted sky',fallbackTop:'#36546d',fallbackBottom:'#d5ac88',fallbackFog:'#657d83',fallbackStars:false,fallbackRidges:false},
 groups,components:dressDrownedCrown(C),
};
