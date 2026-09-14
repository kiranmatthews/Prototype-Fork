import assert from 'node:assert/strict';
import {withSkateRuntime,makeInput} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,THREE,server,Level})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {createCharacterAnimationRuntime}=await server.ssrLoadModule('/src/characterAnimationRuntime.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const {Rail}=await server.ssrLoadModule('/src/rails.ts');
  const runtime=createCharacterAnimationRuntime(p,a.createPlayerStarterAnimationSuite(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition));
  const level=new Level(new THREE.Scene(),{id:'grind-posture-test',name:'Grind posture',data:{v:1,name:'Grind posture',spawn:[0,.02,0],killY:-30,
    components:[{t:'platform',p:[0,-.5,0],s:[1000,1,1000]},{t:'gate',p:[0,0,-450]}]}});
  const v=(...xyz)=>new THREE.Vector3(...xyz),at=name=>p.riderG.getObjectByName(name).getWorldPosition(v());
  const shorts=p.riderG.getObjectByName('meshy-shorts-surface'),point=v(),matrix=new THREE.Matrix4();
  const directions={normal:[0,0],nose:[0,1],five0:[0,-1],board:[1,0],lip:[1,0],smith:[-1,-1],feeble:[1,-1],crook:[-1,1]};
  let frames=0,vertices=0,cases=0,minShorts=Infinity,maxFoot=0,maxFootCase=null;const failures=[],results={};
  for(const sloped of [false,true])for(const direction of [-1,1])for(const stance of [-1,1])for(const [style,command] of Object.entries(directions).filter(([style])=>!process.env.GRIND_STYLE||style===process.env.GRIND_STYLE)){
    const rail=new Rail([v(0,sloped?2.6:.8,70),v(0,sloped?1.2:.8,-70)],false);
    level.grindRails.length=level.rails.length=0;level.grindRails.push(rail);level.rails.push(rail);
    p.respawn(level,true,true,{position:v(0,0,0),heading:v(0,0,-direction)});runtime.restart();
    p.freeSkate=p.airFromSkate=true;p.skateMountT=-1;p.sidePose=p.deckPose=p.skatePose=1;p.stance=stance;
    p.state='ride';p.grounded=true;p.speed=12;p.balanceBoostT=60;
    for(let f=0;f<45;f++){p.runTime=f/60;p.syncVisual(makeInput(),1/60);}
    p.pos.copy(rail.pointAt(rail.totalLength/2)).add(v(style==='lip'?.12:style==='board'?-.12:0,.25,0));p.prevPos.copy(p.pos);
    p.state='air';p.grounded=false;p.vVel=-1;p.grindVel=12;p.regrindCd=0;
    p.axisF.set(style==='board'||style==='lip'?.3:0,0,-direction).normalize();p.axisL.set(p.axisF.z,0,-p.axisF.x);p.visualYaw=Math.atan2(p.axisF.x,p.axisF.z)-Math.PI;
    let entered=false,held=0,landed=false;const label=`${style}/${sloped}/${direction}/${stance}`;
    results[style]??={minHip:Infinity,maxKnee:0,minShorts:Infinity,minBias:Infinity,maxBias:-Infinity};const result=results[style];
    for(let f=0;f<=210;f++){
      const input=makeInput();if(f===0){input.grindPressed=input.grindHeld=true;[input.moveX,input.moveY]=command;}
      if(p.state==='grind'&&f>8&&f<88){p.balanceBoostT=0;p.balance=.72*Math.sin(f*.12);p.balanceVel=0;}
      if(f>=88)p.balanceBoostT=60;
      input.jumpHeld=f>=90&&f<102;input.jumpPressed=f===90;input.jumpReleased=f===102;
      if(f>=103&&f<118)input.moveX=1;
      p.step(1/60,input,level);frames++;p.group.updateMatrixWorld(true);
      assert.equal(p.isBailing,false,`${label}: bailed at ${f}; ${JSON.stringify({results,failures})}`);
      if(p.state==='grind'){
        entered=true;held++;assert.equal(p.grindStyle,style,`${label}: wrong grind catch`);
        const normal=v(0,1,0).transformDirection(p.boardG.matrixWorld);
        const hip=at('hips').sub(at('socket-foot-left').add(at('socket-foot-right')).multiplyScalar(.5)).dot(normal);
        const knees=['left','right'].map(side=>at(`knee-${side}`).sub(at(`hip-${side}`)).angleTo(at(`ankle-${side}`).sub(at(`knee-${side}`))));
        result.minHip=Math.min(result.minHip,hip);result.maxKnee=Math.max(result.maxKnee,...knees);
        if((hip<.62||Math.max(...knees)>1.6)&&failures.length<12)failures.push({label,f,kind:'deep squat',hip,knees});
        if(f>40&&(style==='board'||style==='lip')){
          const tangent=rail.tangentAt(p.grindT).multiplyScalar(p.grindDir),nose=v(0,0,1).transformDirection(p.boardG.matrixWorld);
          const bias=Math.asin(THREE.MathUtils.clamp(nose.dot(tangent),-1,1))*180/Math.PI;
          result.minBias=Math.min(result.minBias,bias);result.maxBias=Math.max(result.maxBias,bias);
          assert.ok(Math.abs(bias-(style==='board'?10:-10))<.03,`${label}: incorrect 10-degree slide bias ${bias}`);
        }
      }
      if(entered){
        const footError=p.boardG.userData.skateContact?.footError??0;
        if(footError>maxFoot){maxFoot=footError;maxFootCase={label,f,state:p.state,pose:p.boardG.userData.skateContact};}
        const s=p.boardG.userData.settings,k=s.overallScale;
        matrix.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
        if(!process.env.GRIND_KINEMATICS_ONLY)for(let i=0;i<shorts.geometry.attributes.position.count;i++){
          shorts.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
          if(Math.abs(point.x)>s.deckHalfWidth*k||point.z< -s.deckTailLength*k||point.z>s.deckNoseLength*k)continue;
          const gap=point.y-(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
          minShorts=Math.min(minShorts,gap);result.minShorts=Math.min(result.minShorts,gap);
          if(gap<.02&&failures.length<12)failures.push({label,f,kind:'shorts/board',gap});
        }
      }
      if(f>102&&p.grounded){landed=true;break;}
    }
    assert.ok(entered&&held>50&&landed,`${label}: incomplete entry/hold/exit/landing`);cases++;
  }
  runtime.dispose();level.dispose();
  for(const result of Object.values(results))result.maxKnee=result.maxKnee*180/Math.PI;
  console.log({cases,frames,vertices,minShorts,maxFoot,maxFootCase,results,failures});assert.deepEqual(failures,[]);assert.ok(maxFoot<.006);
  console.log(`PASS ${cases} native grind cases: shallow pose and garment clearance through entry/hold/exit, both stances/directions/slopes and opposing 10-degree slides.`);
});
