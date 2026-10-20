import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';import{tmpdir}from'node:os';
import {withBlockworksRuntime} from './blockworks-runner.mjs';
const reports=[];
for(const hold of [4.5,.01,0])await withBlockworksRuntime(r=>{
 const {p}=r,before=JSON.stringify(r.TUNING);let peak=0;
 r.until(()=>p.pos.z<-54,()=>{peak=Math.max(peak,p.speed);return{moveY:1,jumpHeld:true};},{maxFrames:500,label:'approach boost and jump lip'});
 const takeoff=p.speed;r.releaseJump({moveY:1});const firstAir=p.speed;let airFrames=0,minAir=Infinity,maxAir=0;
 r.until(()=>p.grounded&&p.pos.z<-62,()=>{if(!p.grounded){airFrames++;minAir=Math.min(minAir,p.speed);maxAir=Math.max(maxAir,p.speed);}return{moveX:.12,moveY:1};},{maxFrames:300,label:'land on receiving deck'});
 assert.ok(airFrames>15);assert.equal(p.totalDeaths,0);assert.equal(p.isBailing,false);assert.equal(JSON.stringify(r.TUNING),before);
 if(hold===4.5){assert.ok(takeoff>45&&firstAir>45&&minAir>40&&p.speed>40,'active boost was cut during the jump');assert.ok(maxAir<=60.01);}
 else assert.ok(firstAir<=r.TUNING.downhillMax+.01&&p.speed<=r.TUNING.downhillMax+.01,'ordinary/expired air gained an overspeed exemption');
 if(hold)assert.ok(peak>55);
 reports.push({hold,peak,takeoff,firstAir,minAir,maxAir,landingSpeed:p.speed,airFrames,position:p.pos.toArray()});console.log(JSON.stringify(reports.at(-1)));
},{modulePath:'/src/levels/country-club.ts',levelId:'speed-pad-air-carry',source:()=>({v:1,name:'Boost carry fixture',spawn:[0,1.1,6],killY:-20,startWarpPad:false,components:[{t:'platform',p:[0,0,-25],s:[18,2,70]},{t:'ramp',p:[0,-1,-92],len:56,w:18,rise:2,yaw:180,vert:false},{t:'platform',p:[0,-2,-150],s:[18,2,60]},{t:'gate',p:[0,-1,-170]},{t:'camnode',p:[0,1,6],radius:0},{t:'camnode',p:[0,1,-60],radius:0},{t:'camnode',p:[0,-1,-120],radius:0},...(hold?[{t:'speedpad',p:[0,1.03,-25],s:[12,.2,8],speed:60,cycle:hold}]:[])]}),controlFrame:r=>r.p.courseInputDirection(r.l)??r.p.camDir});
await writeFile(`${tmpdir()}/country-club-boost-carry.json`,JSON.stringify(reports,null,2));console.log(JSON.stringify(reports,null,2));
