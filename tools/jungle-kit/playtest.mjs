import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInThisContext } from 'node:vm';
import { createServer } from 'vite';
import * as THREE from 'three';

const harness = await readFile(new URL('../test-chimeworks.mjs', import.meta.url), 'utf8');
runInThisContext('const noop = () => {};\n' + harness.slice(harness.indexOf('function installHeadlessDom()'), harness.indexOf('\n\nconst input =')) + '\ninstallHeadlessDom();');
const server = await createServer({logLevel:'silent',server:{middlewareMode:true},appType:'custom'});
const { Level } = await server.ssrLoadModule('/src/level.ts');
const { Player } = await server.ssrLoadModule('/src/player.ts');
const { TUNING, CONST } = await server.ssrLoadModule('/src/tuning.ts');
const scene = new THREE.Scene();
const level = new Level(scene, {id:'jungle',name:'Jungle Ruins'});
const player = new Player(scene);
const input = {moveX:0,moveY:1,consumeEdges(){for(const k of Object.keys(this))if(/Pressed|Released/.test(k))this[k]=false;}};
for(const k of ['jumpHeld','grindHeld','spinHeld','grabHeld','transferHeld','jumpPressed','jumpReleased','grindPressed','spinPressed','grabPressed','restartPressed','transferPressed']) input[k]=false;
player.rawInput=input;
player.lives=50;
function step(){level.update(CONST.fixedStep);player.step(CONST.fixedStep,input,level);input.consumeEdges();}
function ground(x,z){return new THREE.Raycaster(new THREE.Vector3(x,40,z),new THREE.Vector3(0,-1,0),0,70).intersectObjects(level.groundMeshes,false)[0]?.point.y;}
function lane(z){return level.lanePts.reduce((a,b)=>Math.abs(b.z-z)<Math.abs(a.z-z)?b:a);}
function place(x,y,z,speed=0,board=false){
  level.clearProjectiles();player.state='ride';player.pos.set(x,y,z);player.prevPos.copy(player.pos);
  player.vVel=0;player.speed=speed;player.walkVelocity.set(0,0,-speed);player.axisF.set(0,0,-1);player.axisL.set(1,0,0);
  player.freeSkate=board;player.skateOn=board;player.grounded=true;player.laneCursor.s=-1;
  player.bailTime=0;player.bailRecovery=0;
}
const results=[];
try {
  level.update(0);scene.updateMatrixWorld(true);
  for(const [near,far] of [[-34,-39.5],[-104,-110],[-486,-492.5],[-566,-572]]){
    const start=near+0.7,x=lane(start).x,y=ground(x,start);
    place(x,y+0.04,start,18,true);
    player.chargeTimer=TUNING.jumpChargeTime;player.charging=true;player.chargedJump(CONST.fixedStep);
    let landed=false;
    for(let i=0;i<150;i++){step();if(i>2&&player.grounded){landed=player.pos.z<far;break;}if(player.state==='dead'||player.isBailing)break;}
    results.push({jump:[near,far],landed,position:player.pos.toArray()});
    assert.ok(landed,JSON.stringify(results.at(-1)));
  }
  const rail=level.rails.find(r=>r.points.length===7&&Math.abs(r.points[0].z+172)<0.01);
  assert.ok(rail,'authored curved ravine rail');
  place(rail.points[0].x,rail.points[0].y-0.25,rail.points[0].z,18,true);
  input.grindHeld=true;player.lastVelX=0;player.lastVelZ=-18;
  player.railCand={rail,...rail.closest(player.pos)};
  assert.ok(player.tryGrind(true,level),'ravine rail acquisition');
  let traversed=false,maxT=0;
  for(let i=0;i<600;i++){
    input.moveX=Math.abs(player.balance)>0.03?-Math.sign(player.balance)*0.65:0;
    step();maxT=Math.max(maxT,player.grindT);
    if(maxT>rail.totalLength-0.5&&player.grounded){traversed=true;break;}
    if(player.isBailing||player.state==='dead')break;
  }
  assert.ok(traversed,JSON.stringify({rail:maxT,length:rail.totalLength,state:player.state,pos:player.pos.toArray()}));
  results.push({ravine:'complete',position:player.pos.toArray()});input.grindHeld=false;input.moveX=0;input.moveY=0;
  place(...level.spawnPos.toArray());
  assert.ok(player.warpCheckpoint(level,1));
  const checkpoint=level.currentSpawn.clone(), lives=player.lives;
  place(lane(-107).x,-8,-107);player.grounded=false;player.vVel=-5;
  for(let i=0;i<240&&player.lives===lives;i++)step();
  for(let i=0;i<180;i++)step();
  assert.equal(player.lives,lives-1,'pit consumes one life');
  assert.ok(player.pos.distanceTo(checkpoint)<1,'pit respawns at the activated checkpoint');
  results.push({pitRespawn:player.pos.toArray()});
  place(0,ground(0,-689)+0.04,-689,9,false);input.moveY=1;
  player.chargeTimer=TUNING.jumpChargeTime;player.charging=true;player.chargedJump(CONST.fixedStep);
  for(let i=0;i<150&&player.state!=='finished';i++)step();
  assert.equal(player.state,'finished',`finish gate remains reachable: ${player.pos.toArray()}`);
  results.push({finish:player.state});
  console.log(JSON.stringify(results,null,2));
} finally {level.dispose();await server.close();}
