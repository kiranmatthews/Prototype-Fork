import {readFile,writeFile} from 'node:fs/promises';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';
const path=process.argv[2],out=process.argv[3]??'/private/tmp/balance-replay-audit.json';
if(!path)throw new Error('Pass a replay JSON path and optional report path.');
const data=JSON.parse(await readFile(path,'utf8'));
await withSkateRuntime(async ({server,player:p,level,step,TUNING})=>{
  const {Replayer}=await server.ssrLoadModule('/src/replay.ts');
  const replay=new Replayer();replay.begin(data);p.endlessDeaths=data.endlessDeaths===true;p.respawn(level,true);
  const rows=[];let frame=0,active=null,exiting='',lastCore=null;
  const snapshot=()=>({frame,seconds:frame/60,balance:p.balance,velocity:p.balanceVel,age:p.balanceAge,entryAge:p.grindTime,
    input:[p.rawInput.moveX,p.rawInput.moveY],combo:p.comboMult,grindStyle:p.grindStyle,rail:level.grindRails.indexOf(p.grindRail),speed:p.speed,
    carry:p.comboBalance?{...p.comboBalance}:null,calm:TUNING.grindCalm,catchAge:p.balanceEntryAge,noisePhase:p.noisePhase,position:p.pos.toArray(),
    tuning:Object.fromEntries(Object.entries(TUNING).filter(([key])=>/^(balance|grindCalm|manual|bailGrace)/.test(key)))});
  for(const name of ['bailFromRail','snapBoardFall','exitGrind','tryGrindDropIn'])if(typeof p[name]==='function'){
    const native=p[name].bind(p);p[name]=(...args)=>{exiting=name;return native(...args);};
  }
  const enter=p.enterGrind.bind(p);p.enterGrind=(...args)=>{enter(...args);lastCore=null;active={entry:snapshot(),samples:[],exit:null};rows.push(active);};
  const core=p.stepBalanceCore.bind(p);p.stepBalanceCore=(...args)=>{core(...args);if(p.state==='grind')lastCore={...snapshot(),forces:{drift:args[2],control:args[3],ramp:args[4]}};};
  const left=p.railLeft.bind(p);p.railLeft=(...args)=>{if(active){active.exit={...snapshot(),reason:exiting,lastCore,duration:(frame-active.entry.frame)/60};active=null;}return left(...args);};
  const input=makeInput();
  for(;frame<data.frames;frame++){
    replay.feed(input,p.camDir);exiting='';
    if(input.restartPressed){p.respawn(level,true,true);input.consumeEdges();continue;}
    step(input);
    if(active && active.samples.length<20)active.samples.push(snapshot());
  }
  replay.end();
  const report={source:path,note:'Replay v2 does not record menu-triggered heat resets; multi-heat continuation is not a guaranteed path reproduction. Use first-heat windows or isolated catch inputs for before/after comparisons.',frames:data.frames,tuningChanges:data.tuningChanges,rows};
  await writeFile(out,JSON.stringify(report,null,2));
  console.log(JSON.stringify({grinds:rows.length,exits:rows.filter(r=>r.exit).length,quick:rows.filter(r=>r.exit?.duration<.5).map(r=>({frame:r.entry.frame,duration:r.exit.duration,entry:r.entry.balance,velocity:r.entry.velocity,age:r.entry.age,input:r.entry.input,carry:!!r.entry.carry,reason:r.exit.reason,end:r.exit.lastCore?.balance,control:r.exit.lastCore?.forces.control,drift:r.exit.lastCore?.forces.drift})),report:out},null,2));
});
