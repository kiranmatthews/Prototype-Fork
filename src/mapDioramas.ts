import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CAMPAIGN_ISLANDS, type CampaignLevelDefinition } from './campaign';

/** Map-scale landmarks, deliberately exaggerated silhouettes rather than level replicas. */
export const MAP_BEACON_THEMES: Record<string, string> = {
  'treehouse-trail':'Treehouse and rope bridge', 'beachside-run':'Banana grove and surf shack',
  jungle:'Mossy temple gateway', 'rumblewater-run':'River rapids and timber bridge',
  coastal:'Pastel beachfront street', 'jungle-cup':'Beach bowl and contest flags',
  'custard-creek':'Acacia safari camp', 'tribal-run':'Carved masks and thatched village',
  'waterfall-climb':'Twin falls and climbing ledges', 'test-course':'Tribal barricade ambush',
  'drowned-crown':'Broken merchant ship', 'crab-chief':'Chief throne and giant crab claws',
  waterpark:'Abandoned waterslides', 'codex-switchback':'Crooked haunted house',
  'ghost-train':'Ghost locomotive and railway', 'hollowwake-descent':'Mine tunnel and carts',
  slipstream:'Ghost race circuit', 'waterpark-cup':'Haunted skate bowl',
  'carlisle-coast':'Lighthouse and beach huts', 'country-club':'Golf green and clubhouse',
  'rooftop-relay':'Harbour rooftops and crane', 'maynard-course-4':'Reserved quay construction',
  'maynard-course-5':'Reserved marina construction', 'maynard-boss':'Harbour fort arena',
  warehouse:'Factory sheds and chimneys', 'jungle-minefield':'Twisted grove and warning mines',
  'nightworks-after-hours':'Volcanic foundry', nightworks:'Torchlit cavern entrance',
  'quagmire-race':'Lava race circuit', 'quagmire-boss':'Monster skull and lava lair',
  'secret-1':'Bronze sundial sanctuary', 'secret-2':'Crystal grotto',
  'secret-3':'Silver clockwork ruins', 'secret-4':'Prismatic crystal garden',
  'secret-5':'Golden sun temple', 'secret-6':'Celestial observatory',
  'secret-7':'Crystal waterfall sanctuary', 'secret-8':'Rainbow crown citadel',
};

export function beaconDioramaPosition(level: CampaignLevelDefinition): THREE.Vector3 {
  const centre=CAMPAIGN_ISLANDS.find(island=>island.id===level.islandId)!.centre;
  const inward=new THREE.Vector3(centre[0]-level.mapPosition[0],0,centre[2]-level.mapPosition[2]).normalize();
  // Leave both the marker and the curved coastal trail unobstructed.
  return new THREE.Vector3(...level.mapPosition).addScaledVector(inward,14);
}

/** One coloured mesh per landmark: no textures, downloads, lights or gameplay colliders. */
export function createBeaconDiorama(level: CampaignLevelDefinition, groundY: number): THREE.Group {
  const group=new THREE.Group(), parts:THREE.BufferGeometry[]=[];
  group.name=`world map diorama ${level.progressKey}`;
  group.userData.theme=MAP_BEACON_THEMES[level.progressKey];
  group.userData.visualOnly=true;
  group.position.copy(beaconDioramaPosition(level)); group.position.y=groundY;
  const C={wood:0x8f5735,trim:0xf6d59a,leaf:0x528953,dark:0x273b42,stone:0x8e9e96,roof:0xb35d45,
    water:0x43b7cc,foam:0xc9f6eb,metal:0x617e85,gold:0xf4b84e,purple:0x716487,fire:0xff9c37};
  const add=(g:THREE.BufferGeometry,p:number[],s:number[],color:number,rotation=[0,0,0])=>{
    const geometry=g.index?g.toNonIndexed():g; if(geometry!==g)g.dispose();
    geometry.deleteAttribute('uv');
    geometry.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p),new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),new THREE.Vector3(...s)));
    const face=new THREE.Color(color),colors=new Float32Array(geometry.attributes.position.count*3);
    for(let i=0;i<colors.length;i+=3){colors[i]=face.r;colors[i+1]=face.g;colors[i+2]=face.b;}
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));parts.push(geometry);
  };
  const box=(x:number,y:number,z:number,w:number,h:number,d:number,c:number,rz=0,ry=0)=>add(new THREE.BoxGeometry(1,1,1),[x,y,z],[w,h,d],c,[0,ry,rz]);
  const ball=(x:number,y:number,z:number,w:number,h:number,d:number,c:number)=>add(new THREE.IcosahedronGeometry(1,1),[x,y,z],[w,h,d],c);
  const cone=(x:number,y:number,z:number,r:number,h:number,c:number,top=0,sides=8)=>add(new THREE.CylinderGeometry(top,r,h,sides),[x,y,z],[1,1,1],c);
  const post=(x:number,z:number,h:number,c=C.wood,r=.18)=>cone(x,h/2,z,r,h,c,r);
  const beam=(a:number[],b:number[],r:number,c:number)=>{
    const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),delta=to.clone().sub(from);
    const g=new THREE.CylinderGeometry(r,r,delta.length(),7);g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize()));
    add(g,from.lerp(to,.5).toArray(),[1,1,1],c);
  };
  const tube=(pts:number[][],r:number,c:number)=>add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p=>new THREE.Vector3(...p))),36,r,7,false),[0,0,0],[1,1,1],c);
  const arch=(x:number,z:number,w:number,h:number,c:number)=>{
    box(x-w/2,h*.35,z,.8,h*.7,1.2,c);box(x+w/2,h*.35,z,.8,h*.7,1.2,c);
    add(new THREE.TorusGeometry(w/2,.44,6,14,Math.PI),[x,h*.7,z],[1,1,1],c);
  };
  const flag=(x:number,z:number,c:number,h=4)=>{post(x,z,h,C.trim,.1);box(x+.6,h-.5,z,1.2,.75,.08,c);};
  const tree=(x:number,z:number,h=5,c=C.leaf,flat=false)=>{
    post(x,z,h*.72,C.wood,.26);beam([x,h*.45,z],[x-1.1,h*.8,z],.15,C.wood);
    ball(x-.5,h*.83,z,flat?2.8:1.7,flat?.65:1.5,1.65,c);ball(x+1.1,h*.77,z+.3,1.7,flat?.5:1.2,1.35,c);
  };
  const palm=(x:number,z:number,h=5)=>{
    beam([x,0,z],[x+.6,h,z],.2,C.wood);
    for(let i=0;i<6;i++){const a=i*Math.PI/3;beam([x+.6,h,z],[x+.6+Math.cos(a)*2.3,h-.65,z+Math.sin(a)*2.3],.26,C.leaf);}
  };
  const hut=(x:number,z:number,c=C.roof,y=0,w=3.2)=>{
    box(x,y+1.25,z,w,2.5,2.7,C.trim);cone(x,y+3.05,z,w*.8,1.6,c,0,4);
    box(x,y+1,z+1.37,.75,1.8,.08,C.dark);box(x+.95,y+1.65,z+1.39,.6,.65,.1,C.water);
  };
  const water=(x=0,z=0,w=6,d=4)=>ball(x,.12,z,w,.18,d,C.water);
  const rocks=(x:number,z:number,n=4,c=C.stone)=>{for(let i=0;i<n;i++)ball(x+Math.cos(i*2.4)*1.5,.8+(i%2)*.3,z+Math.sin(i*2.4)*1.2,1.3,1.2,1.1,c);};
  const bridge=(x=0,z=0)=>{
    for(let i=0;i<9;i++)box(x-3.2+i*.8,.7+Math.sin(i/8*Math.PI)*.6,z,.68,.22,2.3,C.wood);
    for(const side of [-1,1]){for(const dx of [-3.3,3.3])post(x+dx,z+side*1.15,2,C.wood,.12);
      tube([[-3.3+x,2,z+side*1.15],[x,1.6,z+side*1.15],[x+3.3,2,z+side*1.15]],.08,C.trim);}
  };
  const mask=(x:number,z:number,h=3.8)=>{
    cone(x,h*.5,z,.7,h,C.wood,.9,6);box(x,h*.7,z+.8,1.2,.45,.14,C.trim);
    for(const side of [-1,1])box(x+side*.32,h*.7,z+.89,.2,.21,.08,C.dark);
    box(x,h*.37,z+.86,.8,.5,.16,C.roof);cone(x,h+.2,z,1.25,.8,C.leaf,0,5);
  };
  const rail=(z:number)=>{
    for(let i=0;i<13;i++)box(-5.5+i*.9,.15,z, .35,.2,2.4,C.wood);
    for(const side of [-1,1])box(0,.32,z+side*.7,12,.15,.12,C.metal);
  };
  const cart=(x:number,z:number,c=C.roof)=>{
    box(x,1.1,z,2.4,1.2,1.7,c);box(x,1.77,z,2,.05,1.4,C.dark);
    for(const a of [-.75,.75])for(const b of [-.9,.9])ball(x+a,.5,z+b,.35,.35,.15,C.dark);
  };
  const factory=(x=0,z=0,c=C.roof)=>{
    box(x,1.6,z,6,3.2,3.2,c);for(let i=0;i<3;i++){box(x-2+i*2,3.5,z,2.3,.3,3.7,C.metal,.2);box(x-2+i*2,2,z+1.62,1.1,.65,.08,C.gold);}
    for(let i=0;i<2;i++){cone(x+1+i*1.5,3,z-1,.45,6+i,C.roof,.35);cone(x+1+i*1.5,6+i,z-1,.6,.35,C.trim,.6);}
  };
  const circuit=(c:number)=>{
    add(new THREE.TorusGeometry(3.4,.63,7,40),[0,.25,0],[1.4,1,.83],C.dark,[Math.PI/2,0,0]);
    for(let i=0;i<10;i++){const a=i*Math.PI*2/10;box(Math.cos(a)*4.7,.9,Math.sin(a)*2.85,.6,1,.55,c);}
    arch(0,2.9,3,3.5,C.trim);for(let i=0;i<6;i++)box(-1.5+i*.6,3.5,3, .6,.5,.1,i%2?C.dark:C.trim);flag(-5,0,c);
  };
  const bowl=(c:number)=>{
    add(new THREE.LatheGeometry([[0,0],[2.5,0],[3.7,2.6],[3.4,2.6],[2,.4],[0,.4]].map(p=>new THREE.Vector2(...p)),28),[0,0,0],[1.45,1,1],c);
    add(new THREE.TorusGeometry(3.5,.17,7,28),[0,2.6,0],[1.45,1,1],C.trim,[Math.PI/2,0,0]);
    box(0,.15,0,10,.3,7,C.stone);for(const x of [-5,5])flag(x,-1,c,5);
  };
  const crystal=(x:number,z:number,h:number,c:number)=>{cone(x,h*.35,z,.65,h*.7,c,.55,5);cone(x,h*.85,z,.55,h*.3,c,0,5);};
  const cave=(c=C.purple)=>{rocks(-3,-1,4,c);rocks(3,-1,4,c);arch(0,-.4,4.2,4.5,c);box(0,1.8,-1.1,3.6,3.6,.2,C.dark);};
  const flame=(x:number,z:number)=>{post(x,z,2,C.dark,.13);ball(x,2.3,z,.55,.85,.55,C.fire);cone(x,3,z,.4,.9,0xffd77b);};
  const key=level.progressKey;
  // Low irregular ground patches tie each model into the sculpted island.
  const floor=level.islandId==='island-3'?0x787286:level.islandId==='island-5'?0x685a5e:level.islandId==='hidden-shores'?0x81b5b2:0xb5bc83;
  ball(0,-.16,0,6.6,.3,5.2,floor);
  switch(key){
    case 'treehouse-trail':
      tree(-1,-1,8);cone(-1,2,-1,.6,4,C.wood,.5);box(-1,3.7,0,5,.4,4,C.wood);hut(-1,0,0x8fa95c,3.8,3.2);
      for(let i=0;i<8;i++)box(2.1,.4+i*.45,1.5,.9,.18,.45,C.trim);bridge(-.2,3.3);break;
    case 'beachside-run':
      water(1,2,5,2);hut(-1,-1,0xe3b951);palm(-4,-1,5.2);palm(3,-2,4.5);
      for(let i=0;i<3;i++){ball(3+i*.65,.75,1, .3,1.2,.14,[0xf7cc58,0xe98060,0x8be2d9][i]);ball(-3+i*.4,1.5,0,.16,.5,.18,C.gold);}break;
    case 'jungle':
      for(let i=0;i<3;i++)box(0,.3+i*.4,-1,7-i, .5,4-i*.6,C.stone);
      arch(0,-.6,4,4.8,C.stone);mask(-3,1,2.5);tree(4,-2,5);ball(-2,4.5,-.4,1,.25,.7,C.leaf);break;
    case 'rumblewater-run':
      water(0,0,2.7,5);bridge();rocks(-3,-3);rocks(3,3);for(let i=0;i<5;i++)box((i%2)*.8-.4,.36,-4+i*2,1.5,.12,.2,C.foam);break;
    case 'coastal':
      box(0,.12,2,12,.2,2.8,C.dark);for(let i=0;i<3;i++){hut(-3.7+i*3.6,-1,[0x8ad2cf,0xebc073,0xe99191][i],0,2.6);box(-4+i*4,.26,2,1.5,.07,.13,C.trim);}palm(5,-2,5);break;
    case 'jungle-cup':bowl(0x5ba4ae);palm(-5,-3,6);break;
    case 'custard-creek':tree(-3,-1,5,0x86a968,true);tree(3,-2,5.8,0xa5b765,true);hut(0,1,0xd7ad65,0,2.5);water(3,3,2,1.2);break;
    case 'tribal-run':hut(-3,-1,0xa89b51,0,2.5);hut(2,-2,0xc2ad63,0,2.8);mask(0,2);mask(4,1,2.7);break;
    case 'waterfall-climb':
      for(let i=0;i<3;i++)box(-1+i*1.7,2.5+i*.8,-1,2.7,5+i*1.6,2.8,C.stone);
      water(0,2,4,2);for(const x of [-1.5,1.6]){box(x,3.5,.5,.9,6,.28,C.water);box(x+.18,3.6,.7,.14,5.8,.06,C.foam);}for(let i=0;i<4;i++)box(3.2,.5+i*1.3,2-i*.7,1.4,.45,1.1,C.wood);break;
    case 'test-course':
      for(let i=0;i<8;i++)cone(-4+i*1.1,1.2,-1,.3,2.4,C.wood,.05);mask(-3,1,4.7);mask(3,1,4);hut(0,-3,0x98734a);break;
    case 'drowned-crown':
      water(0,0,6,4);ball(0,1,0,4.5,1.25,1.7,C.wood);box(0,1.8,0,7,.25,2.5,C.trim);box(.5,2,0,1.1,.4,2.8,C.dark,.25);
      beam([-1,1.7,0],[-.3,7,0],.16,C.wood);box(-.4,4.8,0,3.2,2.6,.12,C.trim,.12);beam([-2,6.4,0],[2,5.9,0],.12,C.wood);rocks(4,1);break;
    case 'crab-chief':
      box(0,.5,-1,5,1,4,C.stone);box(0,2,-1.5,2.8,3,1,C.gold);mask(0,-1.4,5.5);
      for(const x of [-3.5,3.5]){beam([x,0,1],[x,2,0],.55,C.roof);ball(x,2.8,0,1.15,1.3,.65,0xc85f46);cone(x-.5,4,0,.4,1.6,C.roof);cone(x+.5,3.8,0,.35,1.3,C.roof);}break;
    case 'waterpark':
      water(0,2,5,3);for(const x of [-3,3]){for(const z of [-2,0])post(x,z,5,C.metal,.14);box(x,5,-1,2.4,.2,2.5,C.purple);}
      tube([[-3,5,-1],[-2,4,1],[0,3,-1],[2,2,1],[3,.5,3]],.6,0x9e83bc);tube([[3,5,-1],[1,4,-3],[-2,2,-1],[-3,.5,3]],.55,0x709a96);break;
    case 'codex-switchback':
      hut(0,0,0x51476d,0,5);box(-2,3.4,-1,1.6,6.8,1.8,C.purple,.1);cone(-2.3,7.3,-1,1.5,2,0x394558,0,4);
      for(const x of [-1,1])box(x,2,1.4,.55,.9,.15,0xe4ba7b);tree(4,-2,5,0x756480);rocks(-4,2,2);break;
    case 'ghost-train':
      rail(1);cart(-3,1,0x655b86);box(.8,1.6,1,3.7,1.7,2,C.dark);cone(2,2.8,1,.45,1.8,C.metal,.6);
      box(-.8,2.8,1,1.3,2,2,C.purple);box(-.8,4,1,1.9,.3,2.6,C.metal);ball(2,4.6,1,.8,.65,.7,0xa8c6be);ball(1.3,5.6,1,1,.6,.8,0xd2dad1);break;
    case 'hollowwake-descent':cave();rail(2);cart(-2,2,C.wood);for(const x of [-2.7,2.7])post(x,-.1,4.5,C.wood,.25);box(0,4.5,-.1,6,.5,.6,C.wood);crystal(4,-1,3,0xa6c6df);break;
    case 'slipstream':circuit(0x8fd7c7);tree(-4,-3,4,0x695779);break;
    case 'waterpark-cup':bowl(0x77739b);mask(-5,-3,3.5);mask(5,-3,3.5);break;
    case 'carlisle-coast':
      cone(-1,3,-1,1.4,6,C.trim,1);cone(-1,3.8,-1,1.18,1.2,C.roof,1.1);cone(-1,6.5,-1,1.5,1,C.water,1.5);cone(-1,7.4,-1,1.9,.8,C.roof);
      hut(3,1,0x7cafb6,0,2.4);rocks(-3,2);break;
    case 'country-club':
      ball(-1,.15,1,4.8,.2,3,0x72b560);ball(3,.23,2,1.7,.06,1,0xe6d29b);flag(-1,1,0xe86e58,3.5);hut(1,-2,0xbf7356,0,3.2);box(-1,.37,1,.45,.06,.45,C.dark);tree(-4,-2,4);break;
    case 'rooftop-relay':
      for(let i=0;i<3;i++){box(-3.5+i*3,1.5+i*.5,0,2.5,3+i,3,[0xa1b7c0,0xbf9276,0xa5a49b][i]);box(-3.5+i*3,3+i,0,2.8,.3,3.3,C.roof);box(-3.5+i*3,2,1.55,.7,1,.1,C.water);}
      beam([4,0,-2],[4,7,-2],.25,C.gold);beam([1,7,-2],[5.5,7,-2],.2,C.gold);beam([1,7,-2],[1,4,-2],.06,C.dark);break;
    case 'maynard-course-4':case 'maynard-course-5':
      box(0,.55,0,8,.4,4,C.wood);for(const x of [-3,0,3])for(const z of [-1.5,1.5])post(x,z,2,C.wood,.22);
      if(key==='maynard-course-4'){beam([-3,4,-1],[3,4,-1],.18,C.metal);post(-3,-1,4,C.metal);box(1,1.2,0,2,1,2,C.trim);}
      else{water(0,2,5,2);ball(1,.8,2,2,.6,.8,C.trim);beam([1,1,2],[1,4,2],.1,C.wood);box(1.6,3,2,1.2,1.4,.08,C.water);}
      for(const x of [-3,3]){box(x,1,2.2,1.4,.8,.2,C.gold);box(x,1,2.33,.2,.8,.04,C.dark,.5);}break;
    case 'maynard-boss':
      arch(0,0,3.8,4,C.stone);for(const x of [-3,3]){cone(x,2,-1,1.3,4,C.stone,1.3);for(let i=0;i<4;i++)box(x+Math.cos(i*Math.PI/2),4.3,-1+Math.sin(i*Math.PI/2),.6,.8,.6,C.trim);flag(x,-1,C.roof,6);}break;
    case 'warehouse':factory();cart(-4,2,C.gold);box(4,1.2,1,2,2.4,2,C.wood);break;
    case 'jungle-minefield':
      for(const x of [-4,0,4]){beam([x,0,-1],[x-.7,3.2,-1],.4,C.wood);beam([x-.7,3,-1],[x+1,5,-1],.23,C.wood);beam([x-.6,2.7,-1],[x-2,4.1,-.5],.18,C.wood);ball(x,4.8,-1,1.9,1,1.6,0x675b7b);}
      for(let i=0;i<4;i++){ball(-3+i*2,.35,2,.6,.35,.6,C.dark);cone(-3+i*2,.7,2,.15,.3,C.fire);}break;
    case 'nightworks-after-hours':
      cone(-1,3,-1,4.4,6,0x5c4d59,1.3,9);cone(-1,6.1,-1,1.2,.2,C.fire,1.2,12);
      tube([[-1,6,-.2],[.4,4,1],[0,2,2],[2,.3,3]],.45,C.fire);factory(3,-1,0x84675c);break;
    case 'nightworks':cave(0x5f596e);for(const x of [-3,3])flame(x,1);for(let i=0;i<4;i++)cone(-2+i*1.3,4,-.2,.3,1.5,C.stone,.05);break;
    case 'quagmire-race':ball(0,.12,0,6,.18,4,C.fire);circuit(C.fire);break;
    case 'quagmire-boss':
      cave(0x594757);ball(0,4,-1,3,2.5,1.4,0xc5bd9e);for(const x of [-1.2,1.2]){ball(x,4.5,.15,.65,.75,.2,C.dark);beam([x*1.8,5,-1],[x*2.5,7.2,-1],.4,C.trim);}
      for(let i=0;i<5;i++)cone(-1.5+i*.75,2.5,.3,.22,1.2,C.trim,.02);for(const x of [-4,4])flame(x,1.5);break;
    default: {
      const n=Number(key.split('-')[1]);
      const colors=[0xc99460,0x88dfe6,0xb9cedb,0xc8a3e7,0xf5c96f,0x91addc,0xabe2df,0xe7c3d8];
      const color=colors[n-1];
      if(n===2||n===4||n===7){water(0,1,4,2.5);for(let i=0;i<5;i++)crystal(-4+i*2,-1.5+Math.sin(i*2),2.5+(i%3),n===4?colors[(i+2)%8]:color);if(n===7){arch(0,-2,4,5,C.stone);box(0,3,-2,1.3,5,.2,C.water);}}
      else if(n===8){for(let i=0;i<5;i++){const x=-4+i*2;cone(x,1.8,-1, .8,3.6,colors[i+1],.8);cone(x,4.4,-1,1.2,1.7,C.gold);}arch(0,1,3.5,4,C.trim);}
      else {for(let i=0;i<3;i++)box(0,.3+i*.4,0,6-i*1.1,.5,5-i*.8,C.stone);arch(0,-1,3.4,4,color);
        add(new THREE.TorusGeometry(1.8,.25,8,24),[0,4.8,-1],[1,1,1],color,[0,n===6?.6:0,n===3?.4:0]);
        beam([-1.2,4.8,-1],[1.2,4.8,-1],.13,C.trim);beam([0,3.6,-1],[0,6,-1],.13,C.trim);if(n===6)ball(0,4.8,-1,.8,.8,.8,0x7fbac7);}
      break;
    }
  }
  const geometry=mergeGeometries(parts,false)!;parts.forEach(part=>part.dispose());
  geometry.computeBoundingSphere();
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82}));
  mesh.name=`miniature ${group.userData.theme}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.visualOnly=true;
  group.add(mesh);return group;
}
