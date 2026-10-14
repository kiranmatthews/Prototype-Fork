import assert from 'node:assert/strict';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const data={v:1,name:'Overtaken chase fixture',spawn:[40,.12,0],killY:-30,startWarpPad:false,
 components:[{t:'platform',p:[0,-.5,-200],s:[140,1,500]},{t:'checkpoint',p:[0,0,-150]},{t:'gate',p:[0,0,-380]}],
 boulderChase:{path:[[0,0,20],[0,0,-400]],radius:3,speed:20,headStart:20,shelters:[{entry:[0,0,-140],exit:[0,0,-164]}]}};
await withBlockworksRuntime(async r=>{
 const p=r.p,c=r.l.boulder.course;let cause;const die=p.die;p.die=function(why,...args){cause=why;return die.call(this,why,...args);};
 r.stepFor(20);p.masks=3;p.uberTimer=p.invulnTimer=60;
 r.until(()=>p.pos.z<-12,{moveY:1},{maxFrames:300,label:'run beyond the release trigger'});
 r.until(()=>p.state==='dead',{}, {maxFrames:1000,allowDeath:true,label:'hiding off the chase line receives lightning'});
 assert.equal(cause,'lightning');assert.ok(c.overtakenSeconds>=3&&c.overtakenSeconds<3.04);
 assert.equal(c.sectionDeaths[0],1);assert.equal(p.masks,3,'lightning bypasses mask spending');
 assert.equal(r.l.root.getObjectByName('Boulder overtaking lightning').visible,true);
 p.die('contact');assert.equal(c.sectionDeaths[0],1,'one death cannot charge assistance twice');
 for(let count=2;count<=3;count++){p.respawn(r.l);r.tick();p.die('contact');assert.equal(c.sectionDeaths[0],count);}
 p.respawn(r.l);assert.equal(c.actors[0].pace,19.2);
 assert.ok(p.warpCheckpoint(r.l,1));assert.equal(c.stage,1);assert.equal(c.actors[1].pace,20);
 r.stepFor(300);assert.equal(c.overtakenSeconds,0,'a checkpoint shelter never accumulates a strike');
 p.respawn(r.l,true);assert.deepEqual(c.sectionDeaths,[0,0]);
 console.log(JSON.stringify({pass:true,cause:'lightning',graceSeconds:3,maskBypass:true,oneDeathOneCount:true,thirdDeathPace:19.2,newCheckpointPace:20,hardReset:true}));
},{modulePath:'/src/levels/rumblewater-run.ts',levelId:'rumblewater-lightning',source:()=>data,maxFrames:3000,endlessDeaths:true});
