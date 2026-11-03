import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withBlockworksRuntime} from './blockworks-runner.mjs';

const report={river:[],pipe:[],runway:{},rope:{}};
await withBlockworksRuntime(async r=>{
  const {p,l,source,THREE}=r;
  const {treehouseTrialPoint:point}=await r.server.ssrLoadModule('/src/levels/treehouse-trials-continuity.ts');
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0);
  const ground=(x,z,y=20)=>{ray.set(new THREE.Vector3(x,y,z),down);ray.far=60;return l.raycastGround(ray)[0];};
  const place=(q,heading=[0,0,-1])=>{p.respawn(l,true,false,{position:new THREE.Vector3(...q),heading:new THREE.Vector3(...heading)});r.stepFor(3);};
  const stones=source.components.filter(c=>c.nm==='Hero flat naturally rounded river stone fitted to its native support');
  const water=source.components.find(c=>c.nm==='Treehouse Trials shallow river');
  assert.equal(stones.length,6);
  const waterZ=water.vertices.filter((_,i)=>i%3===2);
  assert.equal(Math.max(...waterZ)-Math.min(...waterZ),24);
  assert.equal(source.components.filter(c=>c.nm?.startsWith('Exact visible river stone support ')).length,6);
  for(const stone of stones){
    const hit=ground(stone.p[0],stone.p[2]);
    assert.ok(hit&&hit.point.y>-14.05,'each visible stone has its measured top contact');
    place([stone.p[0],hit.point.y+.08,stone.p[2]]);r.stepFor(30);
    assert.ok(p.grounded&&Math.abs(p.pos.y-hit.point.y)<.06,'settle on the real stone top');
    report.river.push({position:p.pos.toArray(),ground:p.groundHit?.name});
  }
  for(const board of [false,true]){
    place(point([35,-13.9,-226]));
    const target=point([35,-14,-242]);
    r.until(()=>p.pos.z<target[2],()=>({...r.worldDirectionInput([0,0,-1],board?1:.7),jumpHeld:board}),{maxFrames:900,label:'six-stone river crossing'});
    assert.equal(p.totalDeaths,0);assert.ok(p.pos.y>-14.2);
  }
  const half=source.components.find(c=>c.nm==='Long sunlit cavern timber halfpipe');
  const caps=source.components.filter(c=>c.nm?.startsWith('Halfpipe closed timber end'));
  assert.equal(caps.length,6);
  for(const end of [-1,1])for(const side of [-1,1]){
    const c=caps.find(c=>c.nm===`Halfpipe closed timber end cheek ${end}/${side}`);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(c.vertices,3));
    if(c.indices)geo.setIndex(c.indices);
    const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial());mesh.position.set(...c.p);mesh.updateMatrixWorld(true);
    for(const [x,y]of [[2,.02],[3,.2],[4,.7],[5,1.5],[5.8,3.8]]){
      ray.set(new THREE.Vector3(half.p[0]+side*x,half.p[1]+y,half.p[2]+end*(half.len/2+1)),new THREE.Vector3(0,0,-end));ray.far=2;
      assert.ok(ray.intersectObject(mesh).length,'closed outward-facing timber end');
    }
    geo.dispose();mesh.material.dispose();
  }
  for(const direction of [-1,1]){
    const start=[half.p[0],half.p[1]+.05,half.p[2]-direction*(half.len/2+1)];
    place(start,[0,0,direction]);
    r.until(()=>direction*(p.pos.z-half.p[2])>half.len/2+.5,()=>r.worldDirectionInput([0,0,direction],.7),{maxFrames:1000,label:'open halfpipe entrance'});
    assert.ok(p.pos.y>half.p[1]-.1);assert.equal(p.totalDeaths,0);report.pipe.push(r.snapshot());
  }
  const rope=source.components.find(c=>c.t==='rope'),near=rope.p[2]+rope.len/2,far=rope.p[2]-rope.len/2;
  const start=point([36.35,-7.2,-378]);
  assert.ok(start[2]-near>=37,'at least thirty extra straight metres before takeoff');
  for(let z=near+1;z<near+31;z+=.5){
    assert.ok(Math.abs(ground(36.35,z).point.y+7.2)<.04,'runway has continuous level support');
    const d=l.laneDirAt(36.35,-7.2,z);assert.ok(d&&Math.abs(d.x)<1e-5&&d.z<-.999,'straight input/camera lane');
  }
  place([36.35,-7.15,start[2]+.2]);
  let grindFrames=0,minY=Infinity;
  r.until(()=>p.pos.z<far-3,()=>{
    minY=Math.min(minY,p.pos.y);
    if(p.state==='grind'){
      assert.equal(p.grindRail,l.ropes[0].rail,'the actual rope carries the crossing');
      grindFrames++;
    }
    return {...r.worldDirectionInput([0,0,-1]),jumpHeld:p.pos.z>near+1.1&&p.pos.z<near+5,
      grindHeld:p.state==='air'||p.state==='grind',grindPressed:p.state==='air',
      ...(p.state==='grind'?{moveX:THREE.MathUtils.clamp(-p.balance*3-p.balanceVel*.55,-1,1)}:{})};
  },{maxFrames:1500,label:'straight approach and final rope grind'});
  assert.ok(grindFrames>60);assert.equal(p.totalDeaths,0);assert.ok(p.pos.y>-8);
  report.runway={straightMetres:start[2]-near,ropeLength:rope.len};report.rope={grindFrames,minY,landing:p.pos.toArray()};
  assert.equal(source.components.filter(c=>c.nm?.startsWith('Exit matte ·')).length,8);
},{modulePath:'/src/levels/treehouse-trail.ts',levelId:'treehouse-trail',source:m=>m.TREEHOUSE_TRAIL_LEVEL,
  controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile('/private/tmp/treehouse-flow-runtime.json',JSON.stringify(report,null,2));
console.log('PASS Treehouse flow',JSON.stringify(report));
