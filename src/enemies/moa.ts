import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enemyElasticPulse, sampleEnemyElasticity } from './elasticity';
import type { EnemyAnimationFrame, EnemyVisual, EnemyVisualDiagnostics } from './types';

/** Original, code-authored wingless moa. All dimensions are metres; +Z is forward.
 * Only individual surfaces deform: the actor, foot anchors and skeleton never scale. */
export const MOA = { height: 4.25, stride: 1.8, stance: .62, windup: .62, peck: .36, recover: .9, squawk: 1.65 } as const;
const TAU = Math.PI * 2;
const smooth = (n:number) => { const t=THREE.MathUtils.clamp(n,0,1); return t*t*(3-2*t); };
const hump = (t:number,a:number,b:number) => t<=a||t>=b?0:Math.sin(Math.PI*(t-a)/(b-a));
const v = (x:number,y:number,z:number) => new THREE.Vector3(x,y,z);
const UP = v(0,1,0);

export function createMoaVisual():EnemyVisual {
  const group=new THREE.Group();group.name='Enemy_moa';
  const body=new THREE.Group();body.name='Moa_Pose';group.add(body);
  const materials:THREE.Material[]=[],geometries:THREE.BufferGeometry[]=[];
  const mat=(color:number,roughness=.9)=>{const m=new THREE.MeshStandardMaterial({color,roughness,fog:false});materials.push(m);return m;};
  const umber=mat(0x65412b),rust=mat(0x986b40),gold=mat(0xc5985a),dark=mat(0x352921);
  for(const m of [umber,rust,gold])m.side=THREE.DoubleSide;
  const skin=mat(0x917751),horn=mat(0xc0a077),black=mat(0x171716,.48),eyeWhite=mat(0xffdc8a,.42);
  const sphere=new THREE.SphereGeometry(1,16,12),tube=new THREE.CylinderGeometry(1,1,1,10,1);
  geometries.push(sphere,tube);
  function mesh(name:string,parent:THREE.Object3D,material:THREE.Material,position:THREE.Vector3,scale:THREE.Vector3,geometry:THREE.BufferGeometry=sphere){
    const m=new THREE.Mesh(geometry,material);m.name=name;m.position.copy(position);m.scale.copy(scale);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
  }
  function pivot(name:string,parent:THREE.Object3D){const g=new THREE.Group();g.name=name;parent.add(g);return g;}
  // Cambered, tapered feather surfaces, merged per colour at each articulated part.
  function featherTufts(parent:THREE.Object3D,centre:THREE.Vector3,radii:THREE.Vector3,count:number,length:number){
    const batches:THREE.BufferGeometry[][]=[[],[],[]];
    for(let i=0;i<count;i++){
      const y=1-2*(i+.5)/count,a=i*2.39996323,r=Math.sqrt(1-y*y),normal=v(Math.cos(a)*r,y,Math.sin(a)*r);
      const start=normal.clone().multiply(radii).add(centre);
      const dir=v(normal.x*.25,-.55+normal.y*.3,normal.z*.35-.28).normalize();
      const side=new THREE.Vector3().crossVectors(dir,normal).normalize();if(side.lengthSq()<.1)side.set(1,0,0);
      const len=length*(.75+.25*Math.sin(i*7.3)),width=len*.24;
      const tip=start.clone().addScaledVector(dir,len).addScaledVector(normal,.08);
      const mid=start.clone().lerp(tip,.48).addScaledVector(normal,.055);
      const pts=[start,mid.clone().addScaledVector(side,width),mid.clone().addScaledVector(normal,.035),mid.clone().addScaledVector(side,-width),tip];
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts.flatMap(p=>p.toArray()),3));
      g.setIndex([0,1,2,0,2,3,1,4,2,2,4,3]);g.computeVertexNormals();batches[i%3].push(g);
    }
    batches.forEach((batch,i)=>{const g=mergeGeometries(batch);batch.forEach(g=>g.dispose());geometries.push(g);mesh('Layered shag feathers',parent,[umber,rust,gold][i],v(0,0,0),v(1,1,1),g);});
  }
  const torso=pivot('Moa_Torso',body),torsoSurface=pivot('Moa_TorsoSurface',torso);
  mesh('Pear shaped body',torsoSurface,umber,v(0,0,-.1),v(.87,.94,1.1));
  mesh('Buff breast',torsoSurface,rust,v(0,.03,.49),v(.7,.81,.66));
  featherTufts(torsoSurface,v(0,0,-.1),v(.86,.89,1.04),220,.38);
  featherTufts(torsoSurface,v(0,.03,.49),v(.7,.81,.66),100,.22);
  const rump=pivot('Moa_Rump',torso);rump.position.set(0,.13,-.95);
  mesh('Rounded rump',rump,umber,v(0,0,0),v(.57,.5,.5));featherTufts(rump,v(0,0,0),v(.54,.46,.46),50,.42);
  // One continuous swept surface through independently moving neck stations.
  const rings=28,sides=12,neckGeometry=new THREE.BufferGeometry();
  const neckPositions=new Float32Array((rings+1)*(sides+1)*3),neckIndices:number[]=[];
  for(let j=0;j<rings;j++)for(let k=0;k<sides;k++){
    const a=j*(sides+1)+k,b=a+sides+1;neckIndices.push(a,a+1,b,b,a+1,b+1);
  }
  neckGeometry.setAttribute('position',new THREE.BufferAttribute(neckPositions,3));neckGeometry.setIndex(neckIndices);geometries.push(neckGeometry);
  const neck=mesh('Moa_FlexibleNeck',body,skin,v(0,0,0),v(1,1,1),neckGeometry);neck.frustumCulled=false;
  const collar=pivot('Moa_Collar',body);featherTufts(collar,v(0,0,0),v(.34,.25,.34),40,.28);
  const head=pivot('Moa_Head',body);
  mesh('Small bird skull',head,skin,v(0,0,0),v(.33,.32,.44));
  mesh('Velvet crown',head,umber,v(0,.18,-.08),v(.33,.2,.35));
  featherTufts(head,v(0,.2,-.12),v(.28,.14,.28),21,.2);
  const beakGeo=new THREE.ConeGeometry(1,1,4);beakGeo.rotateX(Math.PI/2);beakGeo.rotateZ(Math.PI/4);geometries.push(beakGeo);
  mesh('Broad hooked upper beak',head,horn,v(0,-.04,.52),v(.25,.21,.62),beakGeo);
  mesh('Hooked tip',head,dark,v(0,-.09,.77),v(.042,.045,.095),beakGeo);
  const jaw=pivot('Moa_Jaw',head);jaw.position.set(0,-.14,.24);
  mesh('Lower bill',jaw,horn,v(0,0,.22),v(.18,.09,.47),beakGeo);
  mesh('Pink mouth',jaw,mat(0xb5604b),v(0,.052,.23),v(.12,.025,.2));
  const lids:THREE.Mesh[]=[];
  for(const side of [-1,1]){
    mesh('Amber eye',head,eyeWhite,v(side*.296,.035,.13),v(.115,.147,.15));
    mesh('Sideways suspicious pupil',head,black,v(side*.385,.027,.18),v(.045,.081,.071));
    mesh('Eye glint',head,mat(0xfff6dc),v(side*.414,.062,.208),v(.012,.022,.022));
    const brow=mesh('Heavy unimpressed brow',head,umber,v(side*.31,.16,.13),v(.14,.066,.19));brow.rotation.z=side*.16;lids.push(brow);
    mesh('Nostril',head,dark,v(side*.155,-.012,.51),v(.022,.022,.05));
  }
  const legs=[-1,1].map(side=>{
    const upper=mesh('Moa_Thigh',body,rust,v(0,0,0),v(.23,1,.23));
    const lower=mesh('Moa_Shin',body,skin,v(0,0,0),v(.085,1,.085),tube);
    const hock=mesh('Moa_Hock',body,skin,v(0,0,0),v(.125,.14,.13));
    const foot=pivot(side<0?'Moa_FootLeft':'Moa_FootRight',body);
    mesh('Foot pad',foot,skin,v(0,.065,.055),v(.16,.09,.25));
    for(let toe=-1;toe<=1;toe++){
      const toeRoot=pivot('Splayed toe',foot);toeRoot.rotation.y=toe*.32;toeRoot.position.x=toe*.085;
      mesh('Long scaled toe',toeRoot,skin,v(0,.055,.3),v(.063,.055,.27));
      mesh('Dark toenail',toeRoot,dark,v(0,.048,.56),v(.045,.04,.095));
      for(let j=0;j<3;j++)mesh('Toe scale',toeRoot,horn,v(0,.102,.18+j*.1),v(.057,.012,.033));
    }
    mesh('Rear toe',foot,skin,v(.04,.06,-.17),v(.055,.05,.18));
    return {side,upper,lower,hock,foot};
  });
  const attackTip=new THREE.Object3D();attackTip.name='Moa_BeakTip';attackTip.position.set(0,-.08,.83);head.add(attackTip);
  let phase=0,moveWeight=0,stepWeight=0,deathTime=0,disposed=false;
  const diagnostic:EnemyVisualDiagnostics={kind:'moa',status:'ready',url:'code:moa',clips:['High step','Peck','Idle squawk'],activeClip:'High step',mappedNodes:{torso:torso.name,head:head.name,jaw:jaw.name,frontFootLeft:legs[0].foot.name,frontFootRight:legs[1].foot.name},skinnedMeshes:0,meshes:0,animationTime:0,gaitPhase:0,state:'patrol'};
  group.userData.enemyVisual=diagnostic;
  group.traverse(o=>{if((o as THREE.Mesh).isMesh)diagnostic.meshes++;});
  const idle:EnemyAnimationFrame={state:'patrol',stateTime:0,time:0,speed:0,verticalVelocity:0,grounded:true,alive:true,flung:false};
  function link(m:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3,radius:number,ratio=1){
    m.position.copy(a).lerp(b,.5);m.quaternion.setFromUnitVectors(UP,b.clone().sub(a).normalize());
    const half=m.geometry===sphere?.5:1;m.scale.set(radius/Math.sqrt(ratio),a.distanceTo(b)*half,radius/Math.sqrt(ratio));
  }
  function update(dt:number,f:EnemyAnimationFrame){
    if(disposed)return;
    const moving=f.alive&&f.speed>.03&&f.grounded;
    moveWeight=f.alive?THREE.MathUtils.damp(moveWeight,moving?1:0,12,dt):0;
    if(!moving&&moveWeight<.001)moveWeight=0;
    if(moving){phase=(phase+f.speed*dt/MOA.stride)%1;stepWeight=moveWeight;}
    if(f.gaitPhase!==undefined)phase=f.gaitPhase;
    if(!f.alive)deathTime+=dt;else deathTime=0;
    const p=f.stateTime;
    const wind=f.state==='windup'?smooth(p/MOA.windup):f.state==='peck'?1-smooth(p/.12):0;
    const strike=f.state==='peck'?smooth(p/.12)*(1-smooth((p-.2)/.16)):0;
    const recoil=f.state==='recover'?enemyElasticPulse(p,MOA.recover):0;
    const call=f.state==='squawk'?(hump(p,.22,.8)+.7*hump(p,.86,1.3)):0;
    const inhale=f.state==='squawk'?hump(p,0,.42):0;
    const planted={frontLeft:!moving||phase<MOA.stance,frontRight:!moving||(phase+.5)%1<MOA.stance};
    const elastic=sampleEnemyElasticity('moa',f,phase,planted,deathTime);
    const sway=Math.sin(phase*TAU)*moveWeight;
    const bob=(1-Math.cos(phase*TAU*2))*.065*moveWeight;
    torso.position.set(sway*.11,2.23+bob-wind*.18-strike*.23,0);
    torso.rotation.set(-.08+wind*.14+strike*.22,0,-sway*.09);
    torsoSurface.scale.set(1/Math.sqrt(elastic.torso),elastic.torso,1/Math.sqrt(elastic.torso));
    rump.rotation.x=-sway*.13+recoil*.1;
    const neckBase=v(sway*.06,2.8+bob-wind*.15,.53);
    const headAt=v(-sway*.1,3.96+bob+wind*.11-strike*2.68+call*.2-inhale*.16, .96-wind*.48+strike*1.52);
    head.position.copy(headAt);head.rotation.set(-wind*.26+strike*.53-call*.63,f.alive?Math.sin(f.time*1.1)*.07*(1-strike):0,sway*.08+call*.1*Math.sin(p*43));
    const neckPoints=[neckBase,v(sway*.08,3.19+bob-wind*.28-strike*.61,.28+strike*.76),
      v(-sway*.06,3.63+bob-wind*.08-strike*1.87,.51+strike*1.3),headAt];
    const curve=new THREE.CatmullRomCurve3(neckPoints),centre=new THREE.Vector3(),tangent=new THREE.Vector3(),side=new THREE.Vector3(),normal=new THREE.Vector3();
    for(let j=0;j<=rings;j++){
      const u=j/rings;curve.getPoint(u,centre);curve.getTangent(u,tangent);
      side.crossVectors(v(1,0,0),tangent).normalize();normal.crossVectors(tangent,side).normalize();
      const radius=(.27-.115*u)*(1+inhale*.12-call*.055)/Math.sqrt(elastic.torso);
      for(let k=0;k<=sides;k++){
        const a=k/sides*TAU,index=(j*(sides+1)+k)*3;
        neckPositions[index]=centre.x+radius*(Math.cos(a)*side.x+Math.sin(a)*normal.x);
        neckPositions[index+1]=centre.y+radius*(Math.cos(a)*side.y+Math.sin(a)*normal.y);
        neckPositions[index+2]=centre.z+radius*(Math.cos(a)*side.z+Math.sin(a)*normal.z);
      }
    }
    neckGeometry.attributes.position.needsUpdate=true;neckGeometry.computeVertexNormals();neckGeometry.computeBoundingSphere();
    collar.position.copy(neckBase);collar.rotation.x=strike*.4;
    jaw.rotation.x=call*.82+strike*.2+wind*.09;
    lids.forEach((lid,i)=>{lid.position.y=.16+call*.045;lid.rotation.z=(i===0?-1:1)*(.16+wind*.13);});
    for(const leg of legs){
      const cycle=(phase+(leg.side<0?0:.5))%1,stance=cycle<MOA.stance;
      const t=stance?cycle/MOA.stance:(cycle-MOA.stance)/(1-MOA.stance);
      const travel=MOA.stride*MOA.stance;
      const footZ=(stance?travel*(.5-t):travel*(-.5+smooth(t)))*stepWeight;
      const lift=stance?0:Math.sin(Math.PI*t)**1.4*.48*moveWeight;
      leg.foot.position.set(leg.side*(.49+(stance?0:Math.sin(Math.PI*t)*.14*stepWeight)),lift,footZ);
      leg.foot.rotation.set(stance?0:-.42*Math.sin(Math.PI*t)*moveWeight,leg.side*.17,0);
      const ankle=leg.foot.position.clone().add(v(0,.18,0));
      const hip=v(leg.side*.46+sway*.11,1.94+bob-wind*.18-strike*.16,-.12);
      // Knee swings forward; the slender hock folds back, leaving the long toes planted.
      const knee=hip.clone().lerp(ankle,.46).add(v(0,.05,.35+.24*Math.sin(Math.PI*t)*(stance?0:moveWeight)));
      const ratio=elastic.legs[leg.side<0?'frontLeft':'frontRight'];
      link(leg.upper,hip,knee,.245,ratio.upper);link(leg.lower,knee,ankle,.087,ratio.lower);leg.hock.position.copy(knee);
    }
    if(!f.alive){
      const settle=enemyElasticPulse(deathTime,f.flung?.45:.12);
      torso.rotation.z=settle*.25;head.rotation.z=-settle*.32;jaw.rotation.x=Math.abs(settle)*.5;
    }
    diagnostic.animationTime+=dt;diagnostic.gaitPhase=phase;diagnostic.state=f.state;
    diagnostic.activeClip=f.state==='squawk'?'Idle squawk':['windup','peck','recover'].includes(f.state)?'Peck':moving?'High step':'Idle';
    group.updateMatrixWorld(true);
  }
  function reset(){phase=moveWeight=stepWeight=deathTime=0;diagnostic.animationTime=0;update(0,idle);}
  reset();
  return {group,body,ready:Promise.resolve(),diagnostics:diagnostic,update,reset,
    getMuzzlePosition:()=>false,
    getAttackPosition(target){if(disposed)return false;attackTip.getWorldPosition(target);return true;},
    dispose(){if(disposed)return;disposed=true;group.removeFromParent();group.clear();for(const g of geometries)g.dispose();for(const m of materials)m.dispose();diagnostic.status='disposed';},
  };
}
