import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const data=JSON.parse(await readFile(new URL('./fixtures/jungle-gate-run-board-exit.json',import.meta.url),'utf8'));
await withSkateRuntime(async({server,player:p,THREE})=>{
  const {Level,findLevel,setUserLevels}=await server.ssrLoadModule('/src/level.ts');
  const pack=JSON.parse(await readFile('public/levels.json','utf8'));setUserLevels(pack.levels??pack);
  const level=new Level(new THREE.Scene(),findLevel(data.level));
  const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
  p.competitionMode=false;p.endlessDeaths=data.endlessDeaths;p.enterLevel(data.level);p.respawn(level,true);
  const replay=new Replayer();replay.begin(data);const input=makeInput(),rows=[],events=[];
  for(let frame=0;frame<data.frames;frame++){
    replay.feed(input,p.camDir);const before={bail:p.isBailing,board:p.airFromSkate};
    p.step(1/60,input,level);level.update(1/60);input.consumeEdges();
    const row={frame,input:[input.moveX,input.moveY],pos:p.pos.toArray(),axis:p.axisF.toArray(),speed:p.speed,vy:p.vVel,state:p.state,bail:p.isBailing,eject:p.emergencyEjectLandingPending,board:p.airFromSkate,free:p.freeSkate,jump:p.lastJumpType,cam:p.camDir.toArray()};
    if(before.bail!==p.isBailing||before.board!==p.airFromSkate)events.push(row);
    rows.push(row);
  }
  replay.end();level.dispose();
  if(process.env.RESCUE_REPORT)await writeFile(process.env.RESCUE_REPORT,JSON.stringify({events,rows},null,2));
  const start=rows.find(r=>r.bail),end=rows[238];
  assert.equal(start?.frame,218,'recording must reproduce the supplied board crash');
  assert.deepEqual(start.input,[1,0]);assert.equal(start.state,'air');
  for(let f=219;f<=238;f++){
    assert.ok(rows[f].pos[0]>rows[f-1].pos[0],'held right must keep moving screen right');
    assert.ok(Math.abs(rows[f].pos[2]-start.pos[2])<.001,'side-scroll right drifted into screen depth');
    assert.ok(rows[f].axis[0]>.99,'bail turned away from the side-scroll input');
  }
  assert.ok(end.pos[0]-start.pos[0]>2.8);assert.equal(rows.at(-1).bail,false);
  console.log({crashFrame:start.frame,rightTravel:end.pos[0]-start.pos[0],depthDrift:end.pos[2]-start.pos[2]});
  console.log('PASS supplied Jungle Gate Run replay: rightward bail carry, no depth diversion, normal recovery.');
});
