import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import ts from 'typescript';
import { createServer } from 'vite';

// A bridge rebuilt each frame is the independent lifetime/reuse oracle.
const source=await readFile(new URL('./test-character-lab.mjs',import.meta.url),'utf8');
const ast=ts.createSourceFile('fixture.mjs',source,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='fixture');
const fixture=new Function('THREE',declaration.getText(ast)+';return fixture;')(THREE);
const server=await createServer({appType:'custom',logLevel:'silent',server:{middlewareMode:true}});
try {
  const {PlayerAnimationBridge}=await server.ssrLoadModule('/src/animation/bridge.ts');
  const cached=fixture(),fresh=fixture();
  const bridge=new PlayerAnimationBridge(cached.root,cached.root);
  let reference=new PlayerAnimationBridge(fresh.root,fresh.root),comparisons=0;
  const snapshot=root=>{
    const values=[];root.traverse(n=>values.push([n.name,...n.position.toArray(),...n.quaternion.toArray(),
      ...n.scale.toArray(),...(n.morphTargetInfluences??[])]));return values;
  };
  const compare=label=>{assert.deepEqual(snapshot(cached.root),snapshot(fresh.root),label);comparisons++;};
  for(let frame=0;frame<300;frame++){
    bridge.prepareLegacyPose();reference.prepareLegacyPose();
    reference=new PlayerAnimationBridge(fresh.root,fresh.root);
    for(const scene of [cached,fresh]){
      const runtime=scene.root.userData.sculptRuntime,torso=scene.nodes.get('meshy-torso-surface');
      scene.nodes.get('spine').position.y=.12+.02*Math.sin(frame*.13);
      scene.nodes.get('elbow-left').position.y=-.22+.03*Math.cos(frame*.17);
      torso.scale.set(.6+.05*Math.sin(frame),.615,.7+.06*Math.cos(frame));
      for(let i=0;i<(torso.morphTargetInfluences?.length??0);i++)torso.morphTargetInfluences[i]=.1*Math.sin(frame*.1+i);
      if(frame===30){scene.nodes.get('elbow-left').name='renamed-elbow';runtime.joints.elbowLeft='renamed-elbow';}
      if(frame===60){
        const old=scene.nodes.get('upper-arm-left'),replacement=old.clone();
        old.parent.add(replacement);old.removeFromParent();scene.nodes.set('upper-arm-left',replacement);
      }
      // The same surface changes from morph-only to scaled visual ownership,
      // then back; its cached restoration flags must follow the current pass.
      if(frame===90)scene.nodes.get('spine').add(torso);
      if(frame===120)scene.rider.add(torso);
      if(frame===150)torso.morphTargetInfluences=[.15];
      if(frame===180)torso.morphTargetInfluences=[.1,-.2,.3];
      if(frame===210){runtime.deformations[2].lengthAxis=[.2,-1,.05];runtime.deformations[2].volume='none';}
      if(frame===240)scene.rider.add(scene.nodes.get('elbow-left'));
      if(frame===250)scene.nodes.get('shoulder-left').add(scene.nodes.get('elbow-left'));
      if(frame===270){scene.savedPolicies=runtime.deformations;runtime.deformations=[];}
      if(frame===280)runtime.deformations=scene.savedPolicies;
    }
    const values=Object.fromEntries(cached.root.userData.sculptRuntime.deformations.map((p,i)=>
      [p.controlId,frame%9===0?1:1+.2*Math.sin(frame*.2+i)]));
    const factors={'deform.torso.length':.9,'deform.arm.upper.left.length':1.12};
    bridge.applyDeformations(values);reference.applyDeformations(values);compare(`authored frame ${frame}`);
    bridge.modulateDeformations(factors);reference.modulateDeformations(factors);compare(`composed frame ${frame}`);
    // External authoring writes during a layer become its new baseline. An
    // old cached record must neither overwrite them nor reapply old morphs.
    for(const scene of [cached,fresh]){
      scene.nodes.get('elbow-left').position.y+=.017;
      scene.nodes.get('meshy-torso-surface').morphTargetInfluences[0]+=.033;
    }
    bridge.applyDeformations({});reference.applyDeformations({});compare(`edited clear ${frame}`);
  }
  bridge.prepareLegacyPose();reference.prepareLegacyPose();compare('final restoration');

  const warm=fixture(),pooled=new PlayerAnimationBridge(warm.root,warm.root);
  const active=Object.fromEntries(warm.root.userData.sculptRuntime.deformations.map(p=>[p.controlId,1.2]));
  pooled.applyDeformations(active);
  const states=new Set(pooled.deformationStates),transforms=new Set(),morphs=new Set();
  for(const state of states){
    for(const v of [state.basePosition,state.baseScale,state.deformedPosition,state.deformedScale])transforms.add(v);
    for(const morph of state.morphs)morphs.add(morph);
  }
  let warmStateVisits=0;
  for(let frame=0;frame<240;frame++){
    for(const id in active)active[id]=frame%5===0?1:1+.18*Math.cos(frame*.17);
    pooled.applyDeformations(active);
    for(const state of pooled.deformationStates){
      warmStateVisits++;assert.ok(states.has(state),'a warm layer allocated a replacement state');
      for(const v of [state.basePosition,state.baseScale,state.deformedPosition,state.deformedScale])
        assert.ok(transforms.has(v),'a warm layer allocated a replacement transform');
      for(let i=0;i<state.morphCount;i++)assert.ok(morphs.has(state.morphs[i]),'a warm layer allocated a replacement morph record');
    }
  }
  pooled.prepareLegacyPose();
  assert.equal(pooled.deformationStates.length,0);
  assert.equal(pooled.visualDeformations.size,0);assert.equal(pooled.endpointDeformations.size,0);
  assert.deepEqual(snapshot(warm.root),snapshot(fixture().root),'clear retained an old deformation');
  console.log(JSON.stringify({passed:true,editedFrames:300,comparisons,warmFrames:240,warmStateVisits,
    newWarmStateRecords:0,newWarmTransforms:0,newWarmMorphRecords:0,activeStrongReferencesCleared:true},null,2));
}finally{await server.close();}
