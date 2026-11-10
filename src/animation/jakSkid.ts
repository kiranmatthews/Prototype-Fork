import {CHARACTER_ELASTICITY_REVISION} from './elasticity';
import {bakeJakKeys,jakShape,JAK_STAND} from './jakSlide';
import type {JakKeys} from './jakSlide';
import type {Key} from './pancakeSlam';
import type {AnimationClip,RigDefinition} from './types';

/** D's skid to a halt out of a run, keyed one channel at a time like its
 * slide. A skater who has to stop on his feet, and is not sure he can.
 *
 * The left leg is thrown out in front, the right folds under him, and he sits
 * back between them, turned side-on to the way he is going. Both soles take
 * the floor flat and stay on it: from there to the stop they slide, braking,
 * and the ground they have left brings him up and over them, so that they are
 * under him where he will stand by the time he has stopped. Nothing is
 * stepped and nothing is nailed down; the player lays the dust.
 *
 * None of that is balanced, so the arms go out to find it, and stay out: the
 * left low ahead of him, the right out to his side and a little behind, each
 * riding the stop on its own beat. They are held, not thrown. Over the stop
 * he tips forward onto his toes and the arms swing back against it, the left
 * a moment before the right; he drops back onto his heels, knees giving, and
 * comes up to standing a little late.
 *
 * `0..hold` is the plant: down into the sit, then a wobble (`sway..hold`)
 * that loops for as long as the ground lasts. `rise..end` is the slide to a
 * stop and what follows it. It starts `catch` seconds before the feet stop
 * and keeps time with the speed he has left until they have; the runtime
 * times that, carries the pose across the cut, and on into whatever follows. */
const SWAY=.30,HOLD=.54,RISE=HOLD,CATCH=.27,END=RISE+CATCH+.78;
const s=(age:number)=>RISE+age,c=(age:number)=>RISE+CATCH+age;
export const JAK_SKID={sway:SWAY,hold:HOLD,rise:RISE,
  /** Seconds of the slide that keep time with the speed he has left. */
  catch:CATCH,
  /** Each sole takes the floor this many seconds into the skid (the front
   * one, the back one), once the legs have been thrown where they are going;
   * or sooner, when no more than `late` seconds are left before the feet
   * stop and there would be no ground left to slide on. Over `grip` seconds. */
  take:[.13,.09],late:[.22,.25],grip:.09,
  /** How a held sole gives up its lead as the ground runs out: the share of
   * it left is the share of the ground left, to this power. Above one, a foot
   * brakes hardest as it lands and slides on with him at the end. */
  slide:1.2,
  /** The most of his own speed a sole may be braked by where it lands. A sole
   * thrown further ahead than that allows lands short of where it was thrown.
   * And the most of it a trailing sole may be dragged in faster by. */
  most:.62,drag:1,
  /** Seconds after the feet stop: up on his toes, back on his heels, standing. */
  tiptoe:.11,heels:.31,stand:.53,end:END,
  /** Seconds after the feet stop over which the floor fit takes the pelvis back from the keys. */
  seat:[.44,.70],
  /** Seconds over which he comes down off whatever the floor fit was lifting him by when it stood aside,
   * and over which that fit comes up to its full rate at the start of the skid. */
  sink:.2,settleIn:.1,
  /** Seconds a leg takes to give up what its hold did to it, once something else has it. */
  free:.2,
  /** Dust: a sole sliding faster than this (m/s) lays it, and what is left of
   * a sole's lead once he has stopped is given back over this long. */
  dust:.7,settle:.25} as const;

/** The same value at both ends of the looping wobble, with what it does between. */
const sway=(value:number,...between:[number,number][]):Key[]=>[[SWAY,value],...between.map(([at,v])=>[SWAY+at,v] as Key),[HOLD,value]];

const SKID:JakKeys={
  // Down into the sit as the feet come down. From there the heights are his
  // own, over soles that are held: low while there is ground left, up as it
  // runs out, a little past standing as he tips, down onto his heels and up.
  pelvis:[[0,JAK_STAND-.006,'out'],[.08,.51],[.18,.44],...sway(.44,[.12,.431]),
    [s(0),.44],[s(.10),.448],[s(.20),.484],[c(0),.516],[c(.11),.566],[c(.31),.514],[c(.53),JAK_STAND+.006],[c(.72),JAK_STAND]],
  // He sits back behind his feet and stays there while they slide: they
  // come in under where he will stand, and he is not there yet. As they stop
  // he is still coming, over them and a little past onto his toes.
  back:[[0,0,'out'],[.08,-.03],[.18,-.07],...sway(-.12,[.12,-.105]),
    [s(0),-.07],[s(.08),-.115],[s(.17),-.125],[s(.23),-.1],[c(0),-.062],[c(.07),.015],[c(.13),.066],[c(.32),-.035],[c(.53),.012],[c(.74),0]],
  hips:[[0,6,'out'],[.08,2],[.18,-4],...sway(-8,[.12,-5]),
    [s(0),-4],[s(.08),-8],[s(.16),-4],[s(.23),0],[c(0),2],[c(.11),6],[c(.31),-4],[c(.53),1.5],[c(.72),0]],
  yaw:[[0,0,'out'],[.08,-15],[.18,-26],...sway(-26,[.12,-22]),
    [s(0),-26],[s(.08),-23],[s(.17),-14],[c(0),-6],[c(.12),2],[c(.32),-2],[c(.56),0]],
  roll:[[0,0],[.08,3],[.18,5],...sway(5,[.12,1]),
    [s(0),5],[s(.08),3],[s(.17),0],[c(0),-2],[c(.10),2],[c(.30),-2],[c(.54),0]],
  // The chest is still going forward as the feet come down, and is only
  // brought back over the hips once he is sliding: he is never further back
  // than a moment into the slide, and from there he is coming up. At the
  // stop it folds forward first, is thrown back against the tip, nods
  // forward again on his heels and comes up last.
  spine:[[0,4],[.07,8],[.18,4],...sway(1,[.11,-1]),
    [s(0),4],[s(.08),0],[s(.17),3],[c(.01),5],[c(.12),-2],[c(.32),5],[c(.54),-1.5],[c(.74),0]],
  twist:[[0,0],[.09,8],[.18,12],...sway(12,[.12,9]),
    [s(0),12],[s(.08),10],[s(.17),6],[c(.02),3],[c(.14),-3],[c(.34),1],[c(.58),0]],
  chest:[[0,3],[.08,10],[.18,6],...sway(1,[.12,-2]),
    [s(0),6],[s(.08),-1],[s(.17),4],[c(.02),7],[c(.13),-4],[c(.33),7],[c(.55),-2],[c(.76),0]],
  neck:[[0,0],[.08,-4],[.18,2],...sway(8,[.13,5]),
    [s(0),2],[s(.08),8],[s(.17),2],[c(.02),-4],[c(.12),-8],[c(.24),3],[c(.34),7],[c(.56),-2],[c(.76),0]],
  look:[[0,0],[.10,8],[.18,14],...sway(14,[.12,11]),[s(0),14],[s(.10),10],[c(.02),4],[c(.16),0]],
  torso:[[0,0],[.07,.3],[.17,-.4],...sway(.05,[.12,-.1]),
    [s(0),-.3],[s(.08),.1],[c(0),-.2],[c(.10),.35],[c(.30),-.25],[c(.52),.1],[c(.70),0]],
  toes:[[c(-.03),0],[c(.12),15],[c(.22),6],[c(.31),-3],[c(.50),0]],

  // Left leg: thrown out in front to land a short stride ahead, nearly
  // straight; it gives as his weight comes onto it. Once its sole is held
  // these only say which way the knee goes.
  reachL:[[0,-20,'out'],[.08,-27],[.13,-28],[.18,-42],...sway(-42,[.12,-38]),
    [s(0),-42],[s(.12),-34],[c(0),-14],[c(.10),4],[c(.30),-14],[c(.52),-6],[c(.70),-8]],
  splayL:[[0,4],[.08,14],[.18,18],...sway(18,[.12,16]),[s(0),18],[s(.12),14],[c(0),8],[c(.10),5],[c(.50),3]],
  kneeL:[[0,40,'out'],[.08,10],[.13,12],[.18,40],...sway(40,[.12,46]),
    [s(0),40],[s(.12),44],[c(0),26],[c(.10),6],[c(.30),28],[c(.52),12],[c(.70),16]],
  ankleL:[[0,0],[.08,-14],[.18,-5],...sway(-5),[s(0),-5],[s(.08),0]],
  plantL:[[0,0],[.08,.3],[.18,1],...sway(1),[s(0),1]],
  legsL:[[0,0],[.08,.4],[.16,-.3],[.24,0],[s(0),-.15],[s(.10),.2],[c(.02),0]],
  // Right leg: folded under him, flat on its sole.
  reachR:[[0,25,'out'],[.08,-6],[.18,-34],...sway(-34,[.12,-36]),
    [s(0),-34],[s(.12),-24],[c(0),-6],[c(.10),5],[c(.30),-11],[c(.52),-6],[c(.70),-8]],
  splayR:[[0,4],[.08,9],[.18,12],...sway(12,[.12,13]),[s(0),12],[s(.12),10],[c(0),7],[c(.10),5],[c(.50),3]],
  kneeR:[[0,50,'out'],[.08,62],[.18,78],...sway(78,[.12,84]),
    [s(0),78],[s(.12),66],[c(0),40],[c(.10),10],[c(.30),22],[c(.52),12],[c(.70),16]],
  ankleR:[[0,0],[.08,14],[.18,0],...sway(0),[s(0),0]],
  plantR:[[0,0],[.08,.5],[.18,1],...sway(1),[s(0),1]],
  legsR:[[0,0],[.09,-.3],[.18,.15],[.26,0],[s(0),.1],[c(0),.2],[c(.10),-.15],[c(.22),0]],

  // The arms are out for balance, and kept there: the left low ahead of him,
  // the right out to his side and a little behind, elbows loose. They ride
  // the sit and the slide a few degrees at a time. As he tips over his toes
  // both swing back against it, the left first, and come forward again as he
  // rocks onto his heels, and fall.
  armPitchR:[[0,20],[.10,26],[.18,22],...sway(22,[.12,17]),
    [s(0),22],[s(.12),17],[s(.22),9],[c(.02),6],[c(.13),26],[c(.33),-10],[c(.54),4],[c(.72),0]],
  armRollR:[[0,12],[.10,26],[.18,34],...sway(34,[.12,38]),
    [s(0),34],[s(.12),36],[c(.02),32],[c(.13),34],[c(.33),23],[c(.54),13],[c(.74),10]],
  elbowR:[[0,-60],[.10,-54],[.18,-46],...sway(-46,[.12,-40]),
    [s(0),-46],[s(.12),-42],[c(.02),-34],[c(.13),-26],[c(.33),-38],[c(.54),-16],[c(.74),-14]],
  armsR:[[0,0],[.09,.2],[.19,-.1],...sway(0),[s(0),0],[c(0),.12],[c(.11),.2],[c(.24),-.1],[c(.36),.08],[c(.52),0]],
  armPitchL:[[0,-30],[.09,-44],[.18,-36],...sway(-36,[.12,-42]),
    [s(0),-36],[s(.12),-32],[s(.22),-24],[c(0),-18],[c(.10),18],[c(.30),-20],[c(.50),4],[c(.68),0]],
  armRollL:[[0,12],[.09,26],[.18,24],...sway(24,[.12,28]),
    [s(0),24],[s(.12),28],[c(0),30],[c(.10),32],[c(.30),24],[c(.52),12],[c(.74),10]],
  elbowL:[[0,-70],[.09,-46],[.18,-36],...sway(-36,[.12,-30]),
    [s(0),-36],[s(.12),-38],[c(0),-36],[c(.10),-26],[c(.30),-40],[c(.52),-20],[c(.68),-14]],
  armsL:[[0,0],[.10,.2],[.20,-.1],...sway(0),[s(0),0],[c(0),.12],[c(.10),.2],[c(.22),-.1],[c(.34),.1],[c(.50),0]],
};

/** A stop out of a jog asks much less of him than one out of a flat run. So
 * the skid is baked at a few sizes, and the runtime picks one by the pace he
 * let go at. A smaller skid is the same skid with every part doing a share of
 * it about where it stands at rest: a shallower sit, less of a turn, less of
 * a tip, and arms that barely leave his sides. */
const SIZES=[0,.25,.5,.75,1] as const;
const REST:Partial<Record<keyof JakKeys,number>>={pelvis:JAK_STAND,reachL:-8,reachR:-8,kneeL:16,kneeR:16,splayL:3,splayR:3,
  armRollL:10,armRollR:10,elbowL:-14,elbowR:-14};
/** The share of the full skid each part does at the smallest size. */
const SMALLEST:Partial<Record<keyof JakKeys,number>>={pelvis:.45,back:.5,hips:.5,yaw:.55,roll:.5,spine:.55,twist:.5,chest:.55,neck:.5,look:.5,
  torso:.5,toes:.45,reachL:.55,reachR:.55,splayL:.6,splayR:.6,kneeL:.55,kneeR:.55,ankleL:.6,ankleR:.6,plantL:1,plantR:1,legsL:.5,legsR:.5,
  armPitchL:.55,armRollL:.6,elbowL:.7,armsL:.5,armPitchR:.55,armRollR:.6,elbowR:.7,armsR:.5};
function sized(size:number):JakKeys {
  if(size>=1)return SKID;
  return Object.fromEntries((Object.entries(SKID) as [keyof JakKeys,readonly Key[]][]).map(([channel,list])=>{
    const rest=REST[channel]??0,share=1+((SMALLEST[channel]??.5)-1)*(1-size);
    return [channel,list.map(([time,value,mode])=>[time,rest+(value-rest)*share,mode] as unknown as Key)];
  })) as JakKeys;
}
/** The paces (shares of a full run) the smallest and the full skid are for,
 * and which baked size a pace gets. */
export const JAK_SKID_PACES=[.45,.9] as const;
export const jakSkidSize=(pace:number):number=>Math.round(Math.min(1,Math.max(0,(pace-JAK_SKID_PACES[0])/(JAK_SKID_PACES[1]-JAK_SKID_PACES[0])))*(SIZES.length-1));
export const JAK_SKID_SIZES=SIZES.length;

// Into the skid the legs go first and the arms follow, without a throw of
// their own. Into the slide proper the legs are where the keys say at once,
// and everything above the pelvis follows a little later and settles once.
const ENTER=jakShape([26,28,22,18,16],[0,0,.6],[.8,1,.7,.7,.95]);
const SLIDE=jakShape([28,40,21,18,16],[0,.2,.4],[.7,1,.62,.58,.9]);
const LEAVE={
  'player.run':jakShape([34,44,28,24,19],[0,0,0],[1,1,1,.9,.7]),
  'player.walk':jakShape([34,44,28,24,19],[0,0,0],[1,1,1,.9,.7]),
  'player.idle':jakShape([20,24,16,14,12],[0,0,0],[.7,1,.6,.6,.6]),
  default:jakShape([36,42,30,27,24]),
};

/** The skid at one of its sizes. The largest is the suite's run stop; the
 * others stand beside it under `<id>-<size>` and are only ever sampled in
 * its place, on its clock. */
export function createJakSkidClip(original:AnimationClip,rig:RigDefinition,size=SIZES.length-1):AnimationClip {
  const id=original.id,whole=size>=SIZES.length-1;
  return {...original,...(whole?{}:{id:`${id}-${size}`}),
    name:whole?'D · Run stop · a skater stopping on his feet':`D · Run stop · the same at ${Math.round(SIZES[size]*100)}%, out of a slower run`,
    duration:END,range:{start:0,end:END},
    playbackSpeed:1,loop:{...original.loop,mode:'once',seamless:false},
    tracks:bakeJakKeys(original,rig,`skid-${size}`,sized(SIZES[size]),END,'jak-skid'),proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:plant`,time:.14,name:'Feet down'},{id:`${id}:sway`,time:SWAY,name:'Riding it'},
      {id:`${id}:slide`,time:RISE,name:'Sliding to a stop'},{id:`${id}:stop`,time:c(0),name:'Feet stop'},
      {id:`${id}:tiptoe`,time:c(JAK_SKID.tiptoe),name:'Over his toes'},{id:`${id}:heels`,time:c(JAK_SKID.heels),name:'Back on his heels'},
      {id:`${id}:stand`,time:c(JAK_SKID.stand),name:'Standing'}],
    tags:['player','locomotion','stop','skid','keyed'],
    metadata:{jakSkid:true,jakDirect:true,jakSoleFit:true,
      jakInertia:{segments:[ENTER,SLIDE],out:LEAVE},
      jakSkidSway:SWAY,jakSkidHold:HOLD,jakSkidRise:RISE,jakSkidCatch:CATCH,
      ...(whole?{jakSkidSizes:SIZES.length}:{jakSkidSizeOf:id}),
      // The idle returns under the settle: legs first, the body after.
      recoveryStart:c(0),recoveryLegsBlend:[c(.44),c(.66)],recoveryBodyBlend:[c(.50),END],
      recoveryMovingLegsBlend:[c(.02),c(.20)],
      elasticityProfile:'jak-skid',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      elasticityPrinciple:'independent, unmirrored limbs on single eased arcs with overlap and one settle'},
  };
}
