import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

await withSkateRuntime(async ({player:p,server,THREE})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {SKATE_REVIEW_ENTRIES,SKATE_REVIEW_REVISION,withSkatePresentationRig,addSkateReviewClips,skateReviewSignature,skateBoardVisibleAt}=await server.ssrLoadModule('/src/animation/skateCatalog.ts');
  const data=JSON.parse(await readFile(new URL('../public/animations/skate-review/catalog.json',import.meta.url),'utf8'));
  const rig=withSkatePresentationRig(a.RigBinding.fromSculptRuntime(p.animationRig.root).definition);
  assert.equal(a.validateRigDefinition(rig).valid,true,JSON.stringify(a.validateRigDefinition(rig)));
  assert.equal(data.revision,SKATE_REVIEW_REVISION);assert.equal(data.clips.length,SKATE_REVIEW_ENTRIES.length);
  assert.equal(new Set(data.clips.map(c=>c.id)).size,data.clips.length);
  const original=a.createPlayerStarterAnimationSuite(rig),merged=addSkateReviewClips(original,data);
  for(const clip of original.clips)assert.deepEqual(merged.clips.find(c=>c.id===clip.id),clip,'review import replaced gameplay clip');
  const parsed=a.parseAnimationSuite(a.stringifyAnimationSuite(merged));
  const edited=structuredClone(parsed),target=edited.clips.find(c=>c.id===SKATE_REVIEW_ENTRIES[26].clipId);
  target.playbackSpeed=.37;target.tracks[0].keys[0].value=[.2,.3,.4];
  edited.clips=edited.clips.filter(c=>c.id!==SKATE_REVIEW_ENTRIES[0].clipId);
  assert.equal(addSkateReviewClips(edited,data),edited,'reimport must preserve edits and intentional deletions');
  for(const source of data.clips)assert.equal(skateReviewSignature(source),skateReviewSignature(parsed.clips.find(c=>c.id===source.id)),'draft normalization must not look like a pose edit');
  const legacy=structuredClone(parsed);legacy.metadata.skateReviewRevision=data.revision-1;
  const untouched=legacy.clips.find(c=>c.id===SKATE_REVIEW_ENTRIES[26].clipId);
  untouched.tracks.find(t=>t.kind==='position').keys[0].value[1]+=.03;
  const previousSignatures=Object.fromEntries(legacy.clips.filter(c=>c.metadata?.reviewCapture).map(c=>[c.id,[skateReviewSignature(c)]]));
  untouched.name='My nosegrind review';untouched.playbackSpeed=.37;
  const repaired=legacy.clips.find(c=>c.id===SKATE_REVIEW_ENTRIES[27].clipId);
  repaired.tracks.find(t=>t.kind==='position').keys[0].value[1]+=.4;
  legacy.clips=legacy.clips.filter(c=>c.id!==SKATE_REVIEW_ENTRIES[0].clipId);
  const upgraded=addSkateReviewClips(legacy,{...data,previousSignatures});
  const refreshed=upgraded.clips.find(c=>c.id===untouched.id);
  assert.equal(skateReviewSignature(refreshed),skateReviewSignature(data.clips.find(c=>c.id===untouched.id)),'untouched old captures must receive the new transitions');
  assert.equal(refreshed.playbackSpeed,.37);assert.equal(refreshed.name,'My nosegrind review');
  assert.deepEqual(upgraded.clips.find(c=>c.id===repaired.id),repaired,'source upgrade overwrote a repaired pose');
  assert.ok(!upgraded.clips.some(c=>c.id===SKATE_REVIEW_ENTRIES[0].clipId),'source upgrade resurrected a deleted study');
  const visibility={metadata:{boardVisibility:[[0,false],[.5,true],[2,false]]}};
  assert.equal(skateBoardVisibleAt(visibility,.49),false);assert.equal(skateBoardVisibleAt(visibility,.5),true);assert.equal(skateBoardVisibleAt(visibility,2),false);

  const before=[];p.group.traverse(node=>before.push({node,p:node.position.clone(),q:node.quaternion.clone(),s:node.scale.clone(),visible:node.visible}));
  p.enterAnimationPreview();
  const binding=a.RigBinding.fromDefinition(p.animationRig.root,rig),motion=a.createProceduralMotionContext();
  let frames=0;
  for(const entry of SKATE_REVIEW_ENTRIES){
    const clip=parsed.clips.find(c=>c.id===entry.clipId);assert.ok(clip,entry.name);
    assert.ok(clip.tracks.some(t=>t.kind==='quaternion'&&t.keys.length>1),`${entry.name} is a static placeholder`);
    assert.ok(clip.tracks.some(t=>t.kind==='scalar'),'captured elasticity is missing');
    assert.ok(clip.tracks.some(t=>t.target==='skateBoard'),'board was omitted from capture');
    assert.equal(clip.metadata.reviewCapture,true);
    const trace=clip.metadata.transitionEvidence;
    if(['Grinds','Lip stalls'].includes(entry.category)||['basic:Manual','basic:Nose Manual','basic:Wallride','special:darkslide'].includes(entry.id)){
      assert.equal(clip.metadata.transitionCapture,'native Player.step inputs');
      assert.ok(trace.some(s=>s.state==='air')&&trace.at(-1).grounded,`${entry.name} does not show an exit and landing`);
    }
    if(entry.id==='grind:under'){
      const at=t=>trace.filter(s=>s.time<=t).at(-1);
      assert.equal(at(.4).underFlag,false);assert.equal(at(1.1).underFlag,true);
      assert.equal(at(2.8).underFlag,false);assert.equal(at(4.6).underFlag,true);
      assert.equal(at(5.5).state,'air');assert.equal(at(6.8).grounded,true);
      const rootY=t=>a.sampleComposedClip(clip,t,motion).joints.skateBody.position[1];
      assert.ok(rootY(.4)-rootY(1.1)>1.6&&rootY(2.8)-rootY(4.6)>1.6,'under-rail transitions have no visible vertical travel');
      assert.ok(rootY(6.8)<.25,'the drop never reaches the floor');
    }
    for(let f=0;f<45;f++){
      p.applyAnimationDeformations({});
      const pose=a.sampleComposedClip(clip,clip.duration*f/45,motion);
      binding.applyPose(pose,{resetUnspecified:true});p.applyAnimationDeformations(pose.scalars);p.syncCharacterAppearance({upperArmRestAngleWeight:0});
      p.group.updateMatrixWorld(true);
      for(const node of binding.joints.values())assert.ok(node.matrixWorld.elements.every(Number.isFinite),`${entry.name} produced invalid transforms`);
      for(const [key,value] of Object.entries(pose.scalars))assert.ok(value>=.54&&value<=1.76,`${entry.name} ${key} exceeds deformation bounds`);
      assert.ok(p.bodyGroup.scale.distanceTo(new THREE.Vector3(1.18,1.36,1.18))<1e-6,'capture scales the entire skeleton');
      frames++;
    }
  }
  p.exitAnimationPreview();
  for(const state of before){assert.ok(state.node.position.distanceTo(state.p)<1e-8);assert.ok(state.node.quaternion.angleTo(state.q)<1e-6);assert.ok(state.node.scale.distanceTo(state.s)<1e-8,`${state.node.name} scale after preview ${state.node.scale.toArray()} != ${state.s.toArray()}`);assert.equal(state.node.visible,state.visible);}
  const html=await readFile(new URL('../skate-pose-review.html',import.meta.url),'utf8');
  const config=await readFile(new URL('../vite.config.ts',import.meta.url),'utf8');
  assert.ok(html.includes("location.protocol === 'file:'")&&html.includes('location.replace'));
  assert.ok(config.includes("skatePoseReview: 'skate-pose-review.html'"),'contact sheet is absent from production build');
  console.log(`PASS ${data.clips.length} editable skate captures; ${frames} finite playback frames, native entries/exits including the full S42 cycle, independent elasticity, board tracks/visibility, safe source upgrades, saved edits/deletions, complete preview restoration and published/file-link entry.`);
});
