import {runSkystreamBonus} from './skystream-bonus-pilot.mjs';
import {SKYSTREAM_BONUS_LEVEL,SKYSTREAM_BONUS_ISLANDS} from '../src/levels/skystream-bonus';

/** Inject device samples into real fixed steps; restore normal input on exit. */
export function installCumulusPilot(){
 const g=window.__game,p=g.player,l=g.getLevel(),source=SKYSTREAM_BONUS_LEVEL;
 const report=window.cumulusPilotReport={done:false,failure:null,frame:0,stage:'start',actions:[],evidence:[],maskHits:0,
  sourceMatches:JSON.stringify(g.getCurrentLevel().data)===JSON.stringify(source)};
 const r={p,l,source,islands:SKYSTREAM_BONUS_ISLANDS,report,TUNING:g.TUNING,get frame(){return report.frame;}};
 const pilot=runSkystreamBonus(r);
 let next=pilot.next(),last={},advanced=false;
 const original={step:p.step,commit:p.commitRenderStep,spend:p.spendMask};
 const restore=()=>{p.step=original.step;p.commitRenderStep=original.commit;p.spendMask=original.spend;};
 p.spendMask=function(...args){const spent=original.spend.apply(this,args);if(spent)report.maskHits++;return spent;};
 p.step=function(dt,input,level){
  if(report.done)return original.step.call(this,dt,input,level);
  const s=next.value??{};input.moveX=s.moveX??0;input.moveY=s.moveY??0;
  const n=Math.hypot(input.moveX,input.moveY);if(n>1){input.moveX/=n;input.moveY/=n;}
  input.moveX=Math.round(input.moveX*100)/100;input.moveY=Math.round(input.moveY*100)/100;
  for(const h of ['jumpHeld','spinHeld','grabHeld','grindHeld','transferHeld']){
   input[h]=s[h]??false;const e=h.replace('Held','Pressed');input[e]=s[e]??(input[h]&&!last[h]);
  }
  input.jumpReleased=s.jumpReleased??(!input.jumpHeld&&!!last.jumpHeld);input.restartPressed=false;
  last={...s};original.step.call(this,dt,input,level);advanced=true;
 };
 p.commitRenderStep=function(...args){
  original.commit.apply(this,args);if(!advanced||report.done)return;advanced=false;report.frame++;
  try{next=pilot.next();if(next.done){report.result=next.value;report.done=true;}}
  catch(e){report.failure=String(e);report.done=true;}
  report.position=p.pos.toArray();report.state=p.state;report.deaths=p.totalDeaths;
  if(report.done)restore();
 };
 return report;
}

/** Ordinary jump samples from a supported approach; the game owns entry. */
export function installSkystreamEntrance(){
 const g=window.__game,p=g.player,l=g.getLevel(),q=l.bonusPlatformDiagnostics,original=p.step;
 const report=window.cumulusEntrance={frames:0,done:false,failure:null,target:q};
 let doubled=false,doubleRelease=false;
 p.step=function(dt,input,level){
  if(level!==l){p.step=original;report.done=true;return original.call(this,dt,input,level);}
  const f=p.courseInputDirection(l)??p.camDir,dx=q.x-p.pos.x,dz=q.z-p.pos.z,d=Math.hypot(dx,dz)||1,n=Math.hypot(f.x,f.z)||1;
  const charging=report.frames<26,pace=charging?0:Math.min(1,d/1.2);
  input.moveX=(dx*-f.z+dz*f.x)/d/n*pace;input.moveY=(dx*f.x+dz*f.z)/d/n*pace;
  input.jumpHeld=charging;input.jumpPressed=report.frames===0;input.jumpReleased=report.frames===26;
  if(!charging&&!doubled&&!p.grounded&&p.vVel<.65){doubled=true;doubleRelease=true;input.jumpHeld=input.jumpPressed=true;}
  else if(doubleRelease){input.jumpReleased=true;doubleRelease=false;}
  input.spinHeld=input.spinPressed=input.grindHeld=input.grindPressed=input.grabHeld=input.grabPressed=input.transferHeld=input.transferPressed=false;
  original.call(this,dt,input,level);report.frames++;report.position=p.pos.toArray();report.state=p.state;
  if(p.state==='dead'||report.frames>480){report.failure='Entrance input failed';report.done=true;p.step=original;}
 };
 return report;
}
