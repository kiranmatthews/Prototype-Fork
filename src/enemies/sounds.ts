import {sfx} from '../audio';
import {ENEMY_LEGS,type EnemyKind,type EnemyVisual} from './types';

type Point={x:number;y:number;z:number};
type Cue='step'|'idle'|'windup'|'attack'|'recover'|'land'|'defeat';
type Sound={name:string;volume:number;rate?:number};
const sound=(name:string,volume:number,rate=1):Sound=>({name,volume,rate});
const BANK:Record<Exclude<EnemyKind,'moa'>,Partial<Record<Cue,Sound>>>={
  grunt:{step:sound('enemyCrabStep',.22),idle:sound('enemyCrabClack',.30),defeat:sound('enemyOrganicDown',.55)},
  spiker:{step:sound('enemySpikerStep',.20),idle:sound('enemySpikerSnuffle',.28),defeat:sound('enemyOrganicDown',.55,.85)},
  turtle:{step:sound('enemyTurtleStep',.27),idle:sound('enemyTurtleGrumble',.30),defeat:sound('enemyOrganicDown',.55,.72)},
  charger:{step:sound('enemyBullStep',.32),idle:sound('enemyBullSnort',.30),windup:sound('enemyBullSnort',.56),
    attack:sound('enemyBullCharge',.56),recover:sound('enemyBullBrake',.48),defeat:sound('enemyOrganicDown',.60,.8)},
  hopper:{idle:sound('enemyFrogCroak',.26),attack:sound('enemyFrogHop',.42),land:sound('enemyFrogLand',.42),defeat:sound('enemyOrganicDown',.50,1.2)},
  floater:{idle:sound('enemyDroneHover',.19),attack:sound('enemyDroneSwoop',.40),defeat:sound('enemyMachineDown',.48,1.2)},
  sentry:{windup:sound('enemySentryCharge',.34),attack:sound('enemySentryFire',.55),recover:sound('enemySentryCool',.26),defeat:sound('enemyMachineDown',.55)},
  spinner:{attack:sound('enemySpinnerOpen',.40),recover:sound('enemySpinnerClose',.34),defeat:sound('enemyMachineDown',.55,.8)},
};

export function enemySoundGain(distance:number,range=28):number {
  if(!Number.isFinite(distance)||distance>=range)return 0;
  return (1-Math.max(0,distance)/range)**2;
}

interface SoundActor {
  kind:EnemyKind;state:string;stateT:number;alive:boolean;
  group:{position:Point;visible:boolean;userData:Record<string,any>};
  visual:EnemyVisual;
}
interface Memory {state:string;phase:number;feet:number;footWait:number;voiceWait:number;}
const memories=new WeakMap<SoundActor,Memory>();
export function resetEnemySounds(actor:SoundActor):void {memories.delete(actor);}

export function playEnemySound(actor:SoundActor,cue:Cue,listener:Point):void {
  if(actor.kind==='moa')return;
  let clip=BANK[actor.kind][cue];
  const ghost=actor.group.userData.ghostSkin;
  const goblin=actor.visual.diagnostics.appearance==='nightworks';
  if(cue==='step'&&ghost)clip=sound('enemyMetalStep',.24,ghost==='ghostknight'?.85:1.3);
  if(cue==='idle'&&goblin)clip=sound('enemyGoblinMutter',.28);
  if(cue==='step'&&goblin)clip=sound('enemyTurtleStep',.23,1.15);
  if(cue==='defeat'&&ghost)clip=sound('enemyMachineDown',.5);
  if(!clip)return;
  const p=actor.group.position,d=Math.hypot(p.x-listener.x,p.y-listener.y,p.z-listener.z);
  const gain=enemySoundGain(d,cue==='step'?13:cue==='idle'?17:28);
  if(gain>.006)sfx.play(clip.name,clip.volume*gain,clip.rate,.035);
}

/** One-shots are keyed to actual FSM transitions and source foot contacts.
 * No managed loop can survive a death, checkpoint, menu or unloaded level. */
export function updateEnemySounds(actor:SoundActor,dt:number,speed:number,listener:Point):void {
  if(actor.kind==='moa'||dt<=0)return;
  const diag=actor.visual.diagnostics,phase=diag.gaitPhase;
  const feet=ENEMY_LEGS.reduce((mask,leg,i)=>mask|(diag.plantedFeet?.[leg]?1<<i:0),0);
  let memory=memories.get(actor);
  if(!memory){
    const p=actor.group.position;
    memory={state:actor.state,phase,feet,footWait:0,voiceWait:2.5+Math.abs(Math.sin(p.x*1.7+p.z*.63))*4};
    memories.set(actor,memory);
  }
  memory.footWait=Math.max(0,memory.footWait-dt);memory.voiceWait-=dt;
  if(actor.alive&&actor.group.visible){
    if(actor.state!==memory.state){
      const cue:Cue|undefined=actor.state==='telegraph'||actor.state==='charge'?'windup'
        :actor.state==='dash'||actor.state==='leap'||actor.state==='swoop'||actor.state==='fire'||actor.state==='out'?'attack'
        :actor.state==='recover'||actor.state==='cooldown'||actor.state==='in'?'recover'
        :actor.state==='crouch'&&memory.state==='leap'?'land':undefined;
      if(cue){playEnemySound(actor,cue,listener);memory.voiceWait=Math.max(memory.voiceWait,3);}
    }
    const contact=diag.plantedFeet?Boolean(feet&~memory.feet):Math.floor(phase*2)!==Math.floor(memory.phase*2);
    if(speed>.15&&contact&&memory.footWait===0){playEnemySound(actor,'step',listener);memory.footWait=.12;}
    if(memory.voiceWait<=0){
      if(['patrol','idle','crouch','hover','display'].includes(actor.state))playEnemySound(actor,'idle',listener);
      memory.voiceWait=5.5+Math.abs(Math.sin(actor.group.position.z*.7+phase*5))*3;
    }
  }
  memory.state=actor.state;memory.phase=phase;memory.feet=feet;
}
