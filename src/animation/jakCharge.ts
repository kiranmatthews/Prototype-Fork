import {CHARACTER_ELASTICITY_REVISION} from './elasticity';
import {bakeJakKeys,jakShape,JAK_STAND} from './jakSlide';
import type {JakKeys} from './jakSlide';
import type {Key} from './pancakeSlam';
import type {AnimationClip,RigDefinition} from './types';

/** D's standing jump charge, keyed one channel at a time like its slide and
 * its skid. He winds himself down like a spring, and holds it without ever
 * being quite still.
 *
 * Nothing is mirrored. His arms lift a little before they are swept back,
 * low, behind his hips: the right the straighter of the two, the left tucked
 * in a little closer, and they get there after his hips do. He folds forward
 * over knees that go different ways, his weight a little onto the right,
 * turned a little the other way at the shoulders, up on the balls of his feet
 * with his chin up to see where he is going. His soles stay where the idle
 * stood.
 *
 * `0..sink` follows the charge as it fills. At full charge the rest runs on
 * its own clock: he settles a little past the bottom (`..coil`), and then
 * rides it for as long as it is held (`coil..end`, looped): a slow give at
 * the knees, twice to a loop and not twice the same, his weight easing from
 * foot to foot. The arms ride that and do nothing of their own. */
const SINK=.50,COIL=SINK+.36,END=COIL+1.6;
const b=(age:number)=>SINK+age;
export const JAK_CHARGE={sink:SINK,coil:COIL,end:END} as const;

/** The same value at both ends of the looping give, with what it does between. */
const loop=(value:number,...between:[number,number][]):Key[]=>[[COIL,value],...between.map(([at,v])=>[COIL+at,v] as Key),[END,value]];

const CHARGE:JakKeys={
  // A breath up before he drops; a little past the bottom and back; then a
  // give of a centimetre at the knees, twice a loop, the second the deeper.
  pelvis:[[0,JAK_STAND],[.07,JAK_STAND+.005],[.30,.462],[SINK,.402],[b(.18),.391],...loop(.396,[.42,.390],[.84,.397],[1.24,.3885])],
  back:[[0,0],[.30,-.022],[SINK,-.034],[b(.18),-.038],...loop(-.036,[.42,-.038],[.84,-.0355],[1.24,-.0385])],
  hips:[[0,0],[.08,-3],[.30,18],[SINK,29],[b(.18),31.5],...loop(30.2,[.42,31.2],[.84,29.9],[1.24,31.4])],
  yaw:[[0,0],[.32,3],[b(.06),4],...loop(4,[.46,3.2],[.9,4.4],[1.3,3.4])],
  roll:[[0,0],[.30,2],[b(.04),2.5],...loop(2.5,[.44,1.3],[.86,2.7],[1.26,1.5])],
  spine:[[0,0],[.10,-2],[.34,4],[b(.06),7],[b(.22),8],...loop(7.2,[.46,8],[.88,6.9],[1.28,7.9])],
  twist:[[0,0],[.34,-4],[b(.07),-6],...loop(-6,[.48,-5.2],[.92,-6.4],[1.32,-5.4])],
  chest:[[0,0],[.11,-3],[.36,5],[b(.08),9],[b(.24),10],...loop(9.2,[.48,10],[.9,8.8],[1.3,9.9])],
  // His chin stays up through the fold, and gives a little after each dip.
  neck:[[0,0],[.12,3],[.36,-14],[b(.08),-24],[b(.26),-22],...loop(-22.8,[.5,-22],[.92,-23.4],[1.32,-22.2])],
  look:[[0,0],[.36,-2],[b(.08),-3],...loop(-3,[.5,-2.4],[.94,-3.4],[1.34,-2.6])],
  torso:[[0,0],[.08,.2],[.32,-.3],[SINK,-.5],[b(.18),-.58],...loop(-.5,[.42,-.56],[.84,-.48],[1.24,-.57])],
  toes:[[0,0],[.34,0],[SINK,6],[b(.18),8],...loop(7,[.42,7.8],[.84,6.6],[1.24,8])],

  // The soles are held where the idle stood, level but for the heel lift
  // above; these say which way each knee goes, the left one out.
  plantL:[[0,1]],plantR:[[0,1]],
  reachL:[[0,-8],[.30,-36],[SINK,-56],[b(.18),-59],...loop(-57.4,[.42,-58.6],[.84,-57],[1.24,-59])],
  splayL:[[0,3],[.30,7],[SINK,10],...loop(10,[.44,10.8],[.86,9.8],[1.26,10.8])],
  kneeL:[[0,16],[.07,13],[.30,56],[SINK,84],[b(.18),90],...loop(87,[.42,89.4],[.84,86.2],[1.24,90])],
  legsL:[[0,0],[.08,.15],[.32,-.2],[SINK,-.3],[b(.18),-.36],...loop(-.3,[.42,-.34],[.84,-.28],[1.24,-.35])],
  reachR:[[0,-8],[.30,-32],[SINK,-50],[b(.18),-52.5],...loop(-51.2,[.42,-52.2],[.84,-50.8],[1.24,-52.6])],
  splayR:[[0,3],[.30,4],[SINK,5],...loop(5,[.44,4.6],[.86,5.3],[1.26,4.6])],
  kneeR:[[0,16],[.07,13],[.30,52],[SINK,78],[b(.18),83],...loop(80.6,[.42,82.6],[.84,79.8],[1.24,83.2])],
  legsR:[[0,0],[.08,.15],[.32,-.2],[SINK,-.3],[b(.18),-.36],...loop(-.3,[.42,-.34],[.84,-.28],[1.24,-.35])],

  // Up a little first, then swept back and low, and not together. Neither
  // reaches behind him or above his hips, and neither pumps: they hang back
  // off his shoulders and ride what the rest of him does.
  armPitchR:[[0,0],[.12,-9],[.36,12],[b(.05),22],[b(.22),25],...loop(23.4,[.52,24.6],[.96,22.8],[1.36,24.4])],
  armRollR:[[0,10],[.12,12],[.36,15],[b(.06),17],...loop(17,[.5,16.2],[.94,17.4],[1.34,16.4])],
  elbowR:[[0,-14],[.12,-20],[.36,-26],[b(.06),-28],...loop(-28,[.54,-26.6],[.98,-28.8],[1.38,-26.8])],
  armsR:[[0,0],[.12,-.08],[.38,.15],[b(.08),.18],[b(.26),0],...loop(.03,[.52,.07],[.96,0],[1.36,.06])],
  armPitchL:[[0,0],[.14,-7],[.40,9],[b(.10),16],[b(.28),19],...loop(17.4,[.6,16.4],[1.04,18],[1.42,16.6])],
  armRollL:[[0,10],[.14,13],[.40,17],[b(.10),20],...loop(20,[.58,20.8],[1.02,19.6],[1.42,20.6])],
  elbowL:[[0,-14],[.14,-24],[.40,-34],[b(.10),-40],[b(.28),-43],...loop(-41.4,[.6,-40],[1.04,-42.2],[1.42,-40.2])],
  armsL:[[0,0],[.14,-.08],[.42,.12],[b(.10),.16],[b(.28),0],...loop(.03,[.6,0],[1.04,.07],[1.42,.01])],
};

// Down into it the pelvis leads and everything above follows a little late
// and settles once. Out of it into the jump he is gone at once: the legs are
// the jump's own on the first frame, the arms thrown up after them.
const DOWN=jakShape([24,30,19,16,14],[0,0,0],[.75,1,.65,.6,.6]);
const LEAVE={
  'player.jump':jakShape([46,54,38,32,26],[0,.4,.4],[1,1,.9,.8,.7]),
  'player.idle':jakShape([20,24,16,14,12],[0,0,0],[.7,1,.6,.6,.6]),
  default:jakShape([36,42,30,27,24]),
};

export function createJakChargeClip(original:AnimationClip,rig:RigDefinition):AnimationClip {
  const id=original.id;
  return {...original,name:'D · Jump charge · wound down like a spring, and riding it',duration:END,range:{start:0,end:END},
    playbackSpeed:1,loop:{...original.loop,mode:'once',seamless:false},
    tracks:bakeJakKeys(original,rig,'charge',CHARGE,END,'jak-charge'),proceduralDrivers:[],contacts:[],events:[],
    markers:[{id:`${id}:full`,time:SINK,name:'Full charge'},{id:`${id}:coil`,time:COIL,name:'Riding it'}],
    tags:['player','jump','charge','keyed'],
    metadata:{jakCharge:true,jakDirect:true,jakSoleHold:true,
      jakInertia:{segments:[DOWN],out:LEAVE},
      jakChargeSink:SINK,jakChargeCoil:COIL,
      elasticityProfile:'jak-charge',elasticityRevision:CHARACTER_ELASTICITY_REVISION,
      elasticityPrinciple:'independent, unmirrored limbs on single eased arcs with overlap and one settle'},
  };
}
