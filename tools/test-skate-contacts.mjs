import assert from 'node:assert/strict';
import { withSkateRuntime, makeInput } from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({player:p,level,THREE,server,step})=>{
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const {DECK_TRICKS,GRAB_TRICKS,GRIND_TRICKS,sampleMcTwist,skateContactBounce}=await server.ssrLoadModule('/src/skateTricks.ts');
  const v=(...xyz)=>new THREE.Vector3(...xyz),up=v(0,1,0);
  let frames=0,maxFoot=0,maxHand=0;
  const tick=()=>{p.runTime+=1/60;p.syncVisual(makeInput(),1/60);frames++;};
  const settle=(count=65)=>{for(let f=0;f<count;f++)tick();};
  function reset(stance=1,heading=v(0,0,-1)){
    p.respawn(level,true,true,{position:v(0,5,0),heading});
    p.freeSkate=p.airFromSkate=true;p.visualYaw=Math.atan2(heading.x,heading.z)-Math.PI;
    p.sidePose=p.deckPose=p.skatePose=1;p.speed=10;p.stance=stance;p.skateMountT=-1;
    p.state='air';p.grounded=false;p.balance=0;p.wallridePose=0;p.grabPose=0;
    p.grindPoseX=p.grindPoseZ=p.grindYawPose=p.grindCrossPose=0;
    p.alignPose=p.slopePose=p.slopeRoll=0;p.specialGrind=p.specialFlip=p.specialGrab=null;
  }
  const world=(x,y,z)=>p.boardG.localToWorld(v(x,y,z));
  const contact=()=>p.boardG.userData.skateContact;
  const checkFeet=(label,tolerance=.006)=>{
    const error=contact()?.footError;maxFoot=Math.max(maxFoot,error);
    assert.ok(error<tolerance,`${label}: feet detached by ${error}m`);
  };
  let grinds=0;
  // Independent geometric requirements in both stances and rail directions,
  // on a horizontal rail and a sloped rail crossing the world axes.
  for(const slope of [false,true])for(const dir of [-1,1])for(const stance of [-1,1])for(const style of Object.keys(GRIND_TRICKS)){
    const rail=slope?new Rail([v(-30,9,14),v(30,3,-14)],false):new Rail([v(0,5,40),v(0,5,-40)],false);
    const t=rail.totalLength/2,tangent=rail.tangentAt(t).multiplyScalar(dir),right=v().crossVectors(up,tangent).normalize(),normal=v().crossVectors(tangent,right).normalize();
    reset(stance,tangent);p.state='grind';p.grindRail=rail;p.grindT=t;p.grindDir=dir;p.grindStyle=style;
    p.grindApproachSide=stance;p.grindCrossDir=dir;p.grindYawDir=stance;p.pos.copy(rail.pointAt(t)).addScaledVector(up,.15);p.prevPos.copy(p.pos);
    settle();
    const s=p.boardG.userData.settings,top=rail.pointAt(t).addScaledVector(normal,.09),hy=s.wheelRadius-s.truckHangerRadius;
    const front=world(0,hy,s.frontTruckLocalZ),rear=world(0,hy,s.rearTruckLocalZ);
    const height=point=>point.clone().sub(top).dot(normal);
    const locked=point=>{assert.ok(Math.abs(height(point))<.002,`${style}: wrong hanger height`);assert.ok(Math.abs(point.clone().sub(top).dot(right))<.002,`${style}: hanger off rail`);};
    if(style==='normal'){locked(front);locked(rear);}
    if(style==='nose'||style==='crook'){locked(front);assert.ok(height(rear)>.15,'nose grind did not lift the rear truck');}
    if(style==='five0'){locked(rear);assert.ok(height(front)>.15,'5-0 did not lift the front truck');}
    if(style==='smith'||style==='feeble'){
      locked(rear);assert.ok(height(front)<-.15,'Smith/Feeble nose must hang below rail');
      assert.ok(front.clone().sub(rear).dot(right)*stance*(style==='smith'?1:-1)>.2,'Smith/Feeble must use approach/opposite sides');
    }
    if(style==='board'||style==='lip'){
      const belly=world(0,s.boardToGroundDistance-s.deckThickness,0);assert.ok(belly.distanceTo(top)<.002,'slide must contact the deck belly');
      assert.ok(Math.abs(front.clone().sub(rear).normalize().dot(tangent))<.002,'slide deck must be perpendicular');
    }
    if(style==='crook')assert.ok(Math.abs(front.clone().sub(rear).normalize().dot(right))>.3,'crooked grind must be crooked');
    checkFeet(style);grinds++;
  }
  let grabs=0;
  const expected={indy:['trailing','toe'],melon:['leading','heel'],nose:['leading','nose'],tail:['trailing','tail'],method:['leading','heel'],mute:['leading','toe'],stalefish:['trailing','heel'],japan:['leading','toe']};
  for(const stance of [-1,1])for(const heading of [v(0,0,-1),v(1,0,0)])for(const grab of GRAB_TRICKS){
    reset(stance,heading);p.grabKind=grab.kind;p.grabPhase='held';settle();
    const info=p.boardG.userData.skateGrab;assert.ok(info,grab.kind);
    const leading=stance>0?'right':'left',trailing=stance>0?'left':'right';
    assert.equal(info.hand,`socket-grip-${expected[grab.kind][0]==='leading'?leading:trailing}`);
    const palm=p.riderG.getObjectByName(info.hand).getWorldPosition(v());
    const local=p.boardG.worldToLocal(palm.clone()),s=p.boardG.userData.settings;
    const edge=expected[grab.kind][1];
    if(edge==='nose')assert.ok(local.z>s.deckNoseLength*.9,'nosegrab misses nose');
    else if(edge==='tail')assert.ok(local.z<-s.deckTailLength*.9,'tailgrab misses tail');
    else {assert.ok(local.x*stance*(edge==='toe'?1:-1)>s.deckHalfWidth*.9,`${grab.kind}: wrong edge`);assert.ok(Math.abs(local.z)<.3,'edge grab must be between feet');}
    const err=palm.distanceTo(v(...info.target));maxHand=Math.max(maxHand,err);assert.ok(err<.006,`${grab.kind}/${stance}: hand gap ${err}`);
    checkFeet(grab.kind);grabs++;
    p.grabPhase='none';settle(24);assert.equal(p.boardG.userData.skateGrab,undefined,'release keeps holding');checkFeet('released grab');
  }
  for(const stance of [-1,1])for(const type of [-1,1])for(const bal of [-.8,0,.8]){
    reset(stance);p.state='ride';p.grounded=true;p.manualing=type;p.balance=bal;settle();
    const s=p.boardG.userData.settings;
    const front=world(0,s.wheelRadius,s.frontTruckLocalZ).y-s.wheelRadius-p.pos.y;
    const rear=world(0,s.wheelRadius,s.rearTruckLocalZ).y-s.wheelRadius-p.pos.y;
    assert.ok(Math.abs(type>0?rear:front)<.009,'manual wheels lost ground');
    assert.ok((type>0?front:rear)>.10,'manual changed into the opposite trick');checkFeet('manual');
  }
  for(const stance of [-1,1]){
    reset(stance);const rail=new Rail([v(0,5,10),v(0,5,-10)],false);
    p.state='grind';p.grindRail=rail;p.grindT=10;p.grindDir=1;p.grindStyle='board';p.grindCrossDir=1;p.specialGrind={id:'darkslide'};settle();
    const s=p.boardG.userData.settings,normal=world(0,1,0).sub(world(0,0,0)).normalize();
    assert.ok(normal.y<-.999,'Darkslide must be grip down');
    assert.ok(Math.abs(world(0,s.boardToGroundDistance,0).y-5.09)<.002,'griptape must contact rail');checkFeet('Darkslide');
  }
  for(const lip of ['axle','rock','nose','tail']){
    reset();p.state='ride';p.grounded=true;p.lipStyle=lip;p.lipStallT=5;settle();
    const s=p.boardG.userData.settings,c=contact();
    assert.ok(Math.abs(world(...c.local).y-p.pos.y-.09)<.002,`${lip} stall is floating`);
    if(lip==='axle')assert.ok(Math.abs(world(0,0,1).sub(world(0,0,0)).normalize().z)<.002,'axle stall must turn along coping');
    if(lip==='nose')assert.ok(c.local[2]>.9*s.deckNoseLength);
    if(lip==='tail')assert.ok(c.local[2]<-.9*s.deckTailLength);checkFeet(`${lip} stall`);
  }
  for(const stance of [-1,1])for(const normal of [v(1,0,0),v(-1,0,0)]){
    reset(stance);p.wallNormal.copy(normal);p.wallriding=true;p.wallridePose=1;settle();
    const gripNormal=world(0,1,0).sub(world(0,0,0)).normalize();
    assert.ok(gripNormal.dot(normal)>.999,'wallride wheels face away from wall');checkFeet('wallride');
  }
  // Every flip is finite through its complete cycle and returns upright.
  // The Impossible's actual material pivot stays at the trailing foot.
  for(const stance of [-1,1])for(const trick of DECK_TRICKS){
    reset(stance);p.flipKind=trick.kind;p.flipDuration=1;let pivot=null;
    for(let f=0;f<=60;f++){
      p.flipT=Math.max(.000001,1-f/60);tick();
      assert.ok(p.boardG.matrixWorld.elements.every(Number.isFinite),`${trick.kind}: non-finite pose`);
      assert.deepEqual(p.pos.toArray(),[0,5,0],'animation changed physics');
      if(trick.kind==='imposs'){
        const wrap=v(...p.boardG.userData.skateWrapPivot);pivot??=wrap.clone();assert.ok(wrap.distanceTo(pivot)<.002,'Impossible pivot wanders away from back foot');
        const side=stance>0?'left':'right';assert.ok(p.riderG.getObjectByName(`socket-foot-${side}`).getWorldPosition(v()).distanceTo(wrap)<.015,'Impossible loses its back-foot wrap');
      }
    }
    assert.ok(world(0,1,0).sub(world(0,0,0)).normalize().y>.999,'flip never catches upright');
  }
  assert.equal(sampleMcTwist(1).yaw,3*Math.PI);assert.ok(Math.abs(sampleMcTwist(.5).inversion-Math.PI)<1e-12);
  assert.equal(sampleMcTwist(.5).deckProgress,1,'McTwist grabs before catching kickflip');
  assert.ok(skateContactBounce(.08)>0&&skateContactBounce(.26)<0,'cartoon contact must compress then rebound');assert.equal(skateContactBounce(.7),0);
  reset();p.pos.set(0,.1,10);p.prevPos.copy(p.pos);p.state='ride';p.grounded=true;p.revertT=.4;p.speed=10;
  step(makeInput({transferPressed:true}));assert.ok(p.comboLabels.includes('Revert'));assert.ok(p.revertPoseT>0);assert.ok(Math.abs(p.deckYawOffset)>3);
  console.log(`PASS ${grinds} mirrored/sloped grind contacts, ${grabs} grab contacts/releases, 12 manuals, both Darkslides, 4 lip stalls, 16 complete flip cycles, McTwist definition and live revert. ${frames} pose frames; worst sole ${(maxFoot*1000).toFixed(2)} mm, palm ${(maxHand*1000).toFixed(2)} mm.`);
});
