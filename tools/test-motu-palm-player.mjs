import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({THREE,server,level:l,player:p,step,CONST,TUNING})=>{
  const {JUNGLE_CUP_LEVEL:data}=await server.ssrLoadModule('/src/levels/jungle-cup.ts');
  const {parseCustomLevelJson}=await server.ssrLoadModule('/src/level.ts');
  const tuning=JSON.stringify(TUNING),captured=parseCustomLevelJson(JSON.stringify(l.captureData()));
  assert.ok(captured);assert.equal(captured.components.filter(c=>c.dkind==='baytrunk'&&c.solid&&c.scenerySolid).length,13);
  const trunks=l.carlisleScenery.meshes.filter(m=>m.name.includes('baytrunk'));
  assert.equal(trunks.length,13,'all selected trunks have synchronous Player contact before art loads');
  assert.ok(trunks.every(m=>m.geometry.index.count/3===1952));
  const gardens=data.components.filter(c=>c.nm==='Motu / planted circular skate ledge');
  const contacts=[],escapes=[],routes=[];let activeBox=null,hitCount=0,impactSpeed=0;
  const resolve=l.carlisleScenery.resolve.bind(l.carlisleScenery);
  l.carlisleScenery.resolve=(...args)=>{
    const hit=resolve(...args);
    if(hit&&activeBox&&hit.box.min.distanceTo(activeBox.min)<1e-4&&hit.box.max.distanceTo(activeBox.max)<1e-4){hitCount++;impactSpeed=p.speed;}
    return hit;
  };
  const place=(from,heading,speed)=>{
    p.respawn(l,true,true,{position:from,heading});p.freeSkate=true;p.speed=speed;
    p.axisF.copy(heading);p.axisL.set(heading.z,0,-heading.x);hitCount=0;impactSpeed=0;
  };
  const safe=name=>{assert.ok(p.pos.toArray().every(Number.isFinite),name);assert.ok(p.pos.y>=-.08,name);assert.equal(p.totalDeaths,0,name);};
  try{
    for(const garden of gardens){
      const [x,y,z]=garden.vertices,r=Math.hypot(garden.vertices[3]-x,garden.vertices[5]-z);
      const trunk=trunks.find(m=>Math.hypot(m.position.x-x,m.position.z-z)<.01);assert.ok(trunk);
      activeBox=trunk.geometry.boundingBox.clone().applyMatrix4(trunk.matrixWorld);
      // The base/core is offset from the model's pivot. Use the actual low
      // wood vertices, not the full crown-height bounds, to aim each approach.
      const positions=trunk.geometry.attributes.position,wood=[];
      for(let i=0;i<positions.count;i++)if(positions.getY(i)>.1&&positions.getY(i)<.2)wood.push(new THREE.Vector3().fromBufferAttribute(positions,i));
      const target=new THREE.Box3().setFromPoints(wood).getCenter(new THREE.Vector3()).applyMatrix4(trunk.matrixWorld);target.y=y+.08;
      for(const speed of [6,18])for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1]]){
        const from=new THREE.Vector3(x+dx*(r-.65),y+.08,z+dz*(r-.65)),heading=target.clone().sub(from).setY(0).normalize();
        place(from,heading,speed);let frames=0;
        for(;frames<100&&!hitCount;frames++){step(makeInput({moveY:1,jumpHeld:true,jumpPressed:frames===0}));safe('palm approach');}
        const row={palm:[x,y,z],from:from.toArray(),speed,frames,hits:hitCount,impactSpeed,afterSpeed:p.speed,bail:p.isBailing,position:p.pos.toArray()};
        contacts.push(row);assert.ok(hitCount,`real Player reaches visible wood: ${JSON.stringify(row)}`);
        assert.ok(p.isBailing||Math.abs(p.speed)<Math.abs(impactSpeed)+.01,'native impact stops or rebounds the rider');
        if(speed===18&&dz===1){
          const away=from.clone().addScaledVector(heading,-2);let recovered=false,maxDistance=0;
          for(let f=0;f<420;f++){
            const angle=Math.atan2(away.x-p.pos.x,away.z-p.pos.z)-Math.atan2(p.axisF.x,p.axisF.z),delta=Math.atan2(Math.sin(angle),Math.cos(angle));
            step(makeInput({moveY:1,moveX:Math.max(-1,Math.min(1,-delta*2)),jumpHeld:!p.isBailing}));safe('palm recovery');
            maxDistance=Math.max(maxDistance,Math.hypot(p.pos.x-target.x,p.pos.z-target.z));
            if(!p.isBailing&&Math.hypot(p.pos.x-away.x,p.pos.z-away.z)<1.5){recovered=true;break;}
          }
          escapes.push({palm:[x,y,z],recovered,maxDistance,position:p.pos.toArray()});assert.ok(recovered,'ordinary steering leaves the tree after impact');
        }
      }
      // A supported straight line just beyond the planted ledge remains open.
      activeBox=null;const start=new THREE.Vector3(x+r+.9,.1,z-4),end=z+4;
      place(start,new THREE.Vector3(0,0,1),6);let frames=0;
      for(;frames<180&&p.pos.z<end;frames++){step(makeInput({moveY:1,jumpHeld:true,jumpPressed:frames===0}));safe('garden outside line');assert.equal(p.isBailing,false);}
      assert.ok(p.pos.z>=end);routes.push({palm:[x,y,z],frames,position:p.pos.toArray()});
    }
    assert.equal(JSON.stringify(TUNING),tuning);assert.equal(contacts.length,40);assert.equal(escapes.length,5);assert.equal(routes.length,5);
    const report={passed:true,playerTrunks:trunks.length,fullTrianglesPerTrunk:1952,contacts,escapes,routes,editorPreserved:true,movementChanged:false};
    await writeFile(process.env.MOTU_PALM_PLAYER_REPORT??'/private/tmp/motu-palm-player.json',JSON.stringify(report,null,2));
    console.log(JSON.stringify({passed:true,playerTrunks:13,contacts:contacts.length,escapes:escapes.length,routes:routes.length}));
  }finally{l.carlisleScenery.resolve=resolve;}
});
