import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'vite';
import * as THREE from 'three';
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true,hmr:false,ws:false}});
try{
 const {PIRATE_WRECK_LEVEL:data}=await server.ssrLoadModule('/src/levels/pirate-wreck.ts');
 const {DrownedCrownLighting}=await server.ssrLoadModule('/src/drownedCrownLighting.ts');
 const {resolveDataAtmosphere}=await server.ssrLoadModule('/src/levelAtmosphere.ts');
 const base=resolveDataAtmosphere(data,'drowned-crown');
 const rig={hemi:new THREE.HemisphereLight(),sun:new THREE.DirectionalLight(),fill:new THREE.DirectionalLight(),fog:new THREE.Fog(0,1,100)};
 const lighting=new DrownedCrownLighting(rig,base);
 const sample=(x,y,z)=>{lighting.update(x,y,z);return{sun:rig.sun.color.toArray(),fill:rig.fill.color.toArray(),ambient:rig.hemi.intensity,key:rig.sun.intensity,bounce:rig.fill.intensity,fog:rig.fog.color.toArray()};};
 const exterior=sample(-72,-5,205),treasury=sample(1032,20,-425);
 assert.ok(treasury.sun[0]>treasury.sun[2],'The treasury key should keep the gold warm');
 assert.ok(treasury.fill[2]>treasury.fill[0],'The stone should retain its cool fill');
 assert.deepEqual(sample(1032,27,-425),treasury,'Jumping must not flash the room lighting');
 assert.notDeepEqual(sample(1000,16,-230),treasury,'The treasury look must stay out of the skate hold');
 assert.deepEqual(sample(-72,-5,205),exterior,'Returning outside restores the authored harbour look');
 const lanterns=data.components.filter(c=>c.t==='torch'&&['Treasury hoard lantern','Royal portal lantern'].includes(c.nm));
 assert.equal(lanterns.length,6);
 const posts=data.components.filter(c=>c.t==='decor'&&c.dkind==='crownmeshybeamhewn'&&c.grp===7&&!c.amp&&(c.yaw??0)%180===0);
 for(const lamp of lanterns){
  const [x,y,z]=lamp.p,h=lamp.rise??2.2,w=lamp.w??1;
  const flame=new THREE.Box3(new THREE.Vector3(x-.3*w,y+h,z-.3*w),new THREE.Vector3(x+.3*w,y+h+1.5*w,z+.3*w));
  for(const post of posts){
   const [px,py,pz]=post.p,[sx,sy,sz]=post.s;
   const timber=new THREE.Box3(new THREE.Vector3(px-sx/2,py,pz-sz/2),new THREE.Vector3(px+sx/2,py+sy,pz+sz/2));
   assert.equal(flame.intersectsBox(timber),false,`${lamp.nm} is buried in a timber post`);
  }
 }
 const pack=JSON.parse(await readFile('public/levels.json','utf8'));
 assert.deepEqual(pack.levels.find(l=>l.id==='drowned-crown').data,JSON.parse(JSON.stringify(data)),'The local release snapshot must match the source');
 console.log(JSON.stringify({pass:true,lanterns:lanterns.length,clearFlames:true,lightingRestores:true,coinClusters:data.components.filter(c=>c.dkind==='crowncoinspill').length,components:data.components.length}));
}finally{await server.close();}
