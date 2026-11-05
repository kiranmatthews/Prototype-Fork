import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

const empty={v:1,name:'Scrape isolation',spawn:[0,.1,0],killY:-10,
  components:[{t:'platform',p:[0,-.5,0],s:[20,1,40]},{t:'gate',p:[0,0,-18]}]};
const report={};
await withSkateRuntime(async({server,THREE,Level,Player,level:ordinary,player:ordinaryPlayer})=>{
  const {COASTAL_STREET_RUN_LEVEL:source}=await server.ssrLoadModule('/src/levels/coastal-street-run.ts');
  const data={...source,ocean:undefined,unitySand:undefined,components:source.components.filter(c=>
    c.t!=='decor'&&c.solid!==false&&c.p[2]>=-120&&c.p[2]<=35)};
  const scene=new THREE.Scene(),l=new Level(scene,{id:'beach-scrape',name:source.name,data}),p=new Player(scene);
  p.rawInput=makeInput();scene.updateMatrixWorld(true);
  const tick=(moveX,dt=1/60)=>{const input=makeInput({moveX});l.update(dt);p.step(dt,input,l);};
  const place=(x,z=2)=>{
    p.respawn(l,true,false,{position:new THREE.Vector3(x,12.04,-z),heading:new THREE.Vector3(0,0,-1)});
    p.lives=10;p.kiteMotion.reset(17);p.kiteMotion.started=true;p.kiteMotion.speed=17;
  };
  try{
    const x=7.2-.425-p.hitboxHalf.x+.01;
    // Includes the first projecting pier: it belongs to the same side scrape.
    place(x);let frames=0;
    while(p.state!=='dead'&&frames<90){tick(1);frames++;}
    assert.equal(frames,30,'continuous seawall scraping is fatal only after .5 seconds');
    assert.equal(p.lives,9);assert.equal(p.kiteScraping,false,'death silences scrape audio');
    report.continuous={frames,seconds:frames/60,p:p.pos.toArray()};

    place(x);for(let i=0;i<24;i++)tick(1);
    assert.ok(p.kiteScraping);assert.ok(p.kiteDiagnostics.scrapeSeconds>=.39);
    for(let i=0;i<35;i++)tick(-1);
    assert.notEqual(p.state,'dead','steering clear saves the player');
    assert.equal(p.kiteScraping,false);assert.equal(p.kiteDiagnostics.scrapeSeconds,0);
    assert.ok(p.pos.x<x-.5&&p.pos.z<-10,'correction retains forward travel');
    report.corrected={p:p.pos.toArray(),lives:p.lives};

    // Both sides use the same correction window; split dt cannot shorten it.
    const left=-7.2+.4+p.hitboxHalf.x-.01;
    place(left,24);let elapsed=0;
    while(p.state!=='dead'&&elapsed<1){tick(-1,1/120);elapsed+=1/120;}
    assert.ok(Math.abs(elapsed-.5)<1e-6,'left side also receives .5 real simulation seconds');
    report.left={seconds:elapsed};
    place(0,65);for(let i=0;i<60&&p.state!=='dead';i++)tick(0);
    assert.equal(p.state,'dead','head-on planter still kills');
    assert.equal(p.kiteDiagnostics.scrapeSeconds,0,'front collision never starts grace');
    report.front=true;

    place(x,31);for(let i=0;i<8;i++)tick(1);
    assert.ok(p.kiteScraping);p.respawn(l,false);
    assert.equal(p.kiteScraping,false);assert.equal(p.kiteDiagnostics.scrapeSeconds,0,'checkpoint reset clears contact');
    p.respawn(ordinary,true);assert.equal(p.kiteScraping,false,'level change clears audio owner');
    for(let i=0;i<30;i++)ordinaryPlayer.step(1/60,makeInput(),ordinary);
    assert.equal(ordinaryPlayer.kiteScraping,false);assert.ok(Math.abs(ordinaryPlayer.pos.z)<.01,'ordinary movement remains unchanged');

    const shoulders=source.components.filter(c=>c.grp===1&&c.nm?.startsWith('water shoulder '));
    assert.equal(shoulders.length,23);assert.ok(shoulders.every(c=>c.edgeGrinding===false));
    assert.ok(source.components.filter(c=>c.grp===1&&c.nm?.startsWith('town shoulder ')).every(c=>c.edgeGrinding!==false),
      'town-side shoulders retain the default policy');
    const retained=source.components.filter(c=>c.nm?.startsWith('Bahia retained road edges: '));
    assert.equal(retained.length,23,'retain the other three edges of every road slab');
    const roads=source.components.filter(c=>c.grp===1&&c.p[0]===0);
    const {Rail}=await server.ssrLoadModule('/src/rails.ts');
    for(const c of roads){
      const r=retained.find(r=>r.nm.endsWith(': '+c.nm));assert.ok(r);
      const y=c.t==='platform'?c.p[1]+c.s[1]/2:c.p[1]+c.rise/2;
      const middle=new THREE.Vector3(-6,y+.05,c.p[2]);
      const rail=new Rail(r.pts.map(n=>new THREE.Vector3(r.p[0]+n[0],r.p[1]+n[3],r.p[2]+n[1])),false);
      assert.ok(rail.closestDistance(middle)<1e-5,'retained left edge follows the original slope');
      rail.object.traverse(o=>o.geometry?.dispose());
    }
    for(const z of [2,15,30,43,65,83]){
      const low=new THREE.Vector3(7.2,12.05,-z);
      for(const x of [6,7.2]){
        low.x=x;
        assert.ok(l.grindRails.every(r=>r.closestDistance(low)>.2),'no ground-level grind under or alongside the seawall');
      }
    }
    place(x,31);
    const groundCatch=makeInput({grindPressed:true,grindHeld:true});
    p.rawInput=groundCatch;l.update(1/60);p.step(1/60,groundCatch,l);
    assert.equal(p.state,'grind');
    assert.ok(p.grindRail.object.userData.sourceName?.startsWith('Bahia wall cap grind '),
      'E beside the wall selects its top, never the hidden road/shoulder seam');
    for(let i=0;i<20;i++){
      const input=makeInput({grindHeld:true,moveX:-p.balance*2});
      p.rawInput=input;l.update(1/60);p.step(1/60,input,l);
      assert.equal(p.state,'grind','the normal catch interpolation reaches the wall top');
    }
    assert.ok(p.pos.y>13.2,'the assisted catch is visibly on top of the masonry');
    report.lowerEdgeCatch=false;report.assistedWallTop=p.pos.toArray();
    const cap=l.rails.find(r=>r.object.userData.sourceName?.startsWith('Bahia wall cap grind '));
    assert.ok(cap?.coping);
    const q=cap.pointAt(33);
    p.respawn(l,true,false,{position:q.clone().add(new THREE.Vector3(-.2,.14,0)),heading:new THREE.Vector3(0,0,-1)});
    p.grounded=false;p.state='air';p.vVel=-.5;p.kiteMotion.reset(17);p.kiteMotion.started=true;p.kiteMotion.speed=17;
    const catchInput=makeInput({grindPressed:true,grindHeld:true});l.update(1/60);p.step(1/60,catchInput,l);
    assert.equal(p.state,'grind');assert.equal(p.grindRail,cap);
    for(let i=0;i<90;i++){
      l.update(1/60);p.step(1/60,makeInput({grindHeld:true,moveX:-p.balance*2}),l);
      assert.equal(p.state,'grind','top coping stays rideable across raised piers');
      assert.equal(p.kiteScraping,false,'top grind is not a side scrape');
    }
    report.wallTop={frames:91,p:p.pos.toArray()};
  }finally{l.dispose();}
},{levelEntry:{id:'empty',name:empty.name,data:empty}});
console.log('PASS Beach side scrape, correction, timing, lifecycle and wall grind policy.',JSON.stringify(report));
