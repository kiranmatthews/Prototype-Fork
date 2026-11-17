import {runRollingBonesBonus} from './rolling-bones-bonus-pilot.mjs';
import {ROLLING_BONES_BONUS_LEVEL} from '../src/levels/rolling-bones-bonus';

/** Inject device samples into real fixed steps; restore normal input on exit. */
export function installMoonbonePilot(){
 const g=window.__game,p=g.player,l=g.getLevel(),source=ROLLING_BONES_BONUS_LEVEL;
 const report=window.moonbonePilotReport={done:false,failure:null,frame:0,stage:'start',actions:[],evidence:[],maskHits:0,
  sourceMatches:JSON.stringify(g.getCurrentLevel().data)===JSON.stringify(source)};
 const r={p,l,source,report,TUNING:g.TUNING,get frame(){return report.frame;}};
 const pilot=runRollingBonesBonus(r);
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
