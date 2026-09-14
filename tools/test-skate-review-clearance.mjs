import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {withSkateRuntime} from './jungle-cup-harness.mjs';

await withSkateRuntime(async({player:p,THREE,server})=>{
  const a=await server.ssrLoadModule('/src/animation/index.ts');
  const {withSkatePresentationRig}=await server.ssrLoadModule('/src/animation/skateCatalog.ts');
  const {evaluateSkateboardSurfaceHeight}=await server.ssrLoadModule('/src/skateboard/model.ts');
  const catalog=JSON.parse(await readFile(new URL('../public/animations/skate-review/catalog.json',import.meta.url),'utf8'));
  const selected=catalog.clips.filter(c=>/Skate · S(?:09|10|2[6-9]|3[0-8]|42) ·/.test(c.name));assert.equal(selected.length,16);
  const base=p.enterAnimationPreview();p.group.position.set(0,0,0);p.group.rotation.set(0,Math.PI,0);
  const binding=a.RigBinding.fromDefinition(base.root,withSkatePresentationRig(a.RigBinding.fromSculptRuntime(base.root).definition));
  const motion=a.createProceduralMotionContext(),shorts=p.riderG.getObjectByName('meshy-shorts-surface'),deck=p.boardG.getObjectByName('Deck_ContinuousRoundedKick');
  const point=new THREE.Vector3(),matrix=new THREE.Matrix4();let samples=0,vertices=0;const failures=[],results=[];
  for(const clip of selected){
    let minShorts=Infinity,minCoping=Infinity,minShoe=Infinity;
    const kick=clip.metadata.skateReviewId==='flip:kick',trace=clip.metadata.transitionEvidence??[],flight=[];
    const flipStart=trace.find(s=>s.flipping)?.time??Infinity;
    const flipEnd=trace.find(s=>s.time>flipStart&&!s.flipping)?.time??-Infinity;
    for(let f=0;f<=120;f++){
      const time=clip.duration*f/120;p.applyAnimationDeformations({});
      const pose=a.sampleComposedClip(clip,time,motion);binding.applyPose(pose,{resetUnspecified:true});
      p.applyAnimationDeformations(pose.scalars);p.syncCharacterAppearance({upperArmRestAngleWeight:0});p.group.updateMatrixWorld(true);samples++;
      const s=p.boardG.userData.settings,k=s.overallScale;
      matrix.copy(p.boardG.matrixWorld).invert().multiply(shorts.matrixWorld);
      for(let i=0;i<shorts.geometry.attributes.position.count;i++){
        shorts.getVertexPosition(i,point).applyMatrix4(matrix);vertices++;
        if(Math.abs(point.x)>s.deckHalfWidth*k||point.z< -s.deckTailLength*k||point.z>s.deckNoseLength*k)continue;
        const gap=point.y-(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
        const clearance=clip.metadata.skateReviewId==='grind:under'||kick?(gap>=0?gap:-gap-s.deckThickness*k):gap;
        minShorts=Math.min(minShorts,clearance);
        if(clearance<(clip.metadata.skateReviewId==='grind:under'?.002:.02)&&failures.length<12)failures.push({clip:clip.name,time,kind:'shorts',gap:clearance});
      }
      if(kick&&time>=flipStart&&time<flipEnd){
        const centreY=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,0,0)-s.deckThickness*.5)*k;
        flight.push(p.boardG.localToWorld(new THREE.Vector3(0,centreY,0)).y);
        for(const side of ['left','right'])for(const part of ['shoe','sole','shoe-foxing']){
          const mesh=p.riderG.getObjectByName(`${part}-${side}`);matrix.copy(p.boardG.matrixWorld).invert().multiply(mesh.matrixWorld);
          for(let i=0;i<mesh.geometry.attributes.position.count;i++){
            point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);
            if(Math.abs(point.x)>s.deckHalfWidth*k*.95||point.z< -s.deckTailLength*k*.95||point.z>s.deckNoseLength*k*.95)continue;
            const surface=(s.boardToGroundDistance+evaluateSkateboardSurfaceHeight(s,point.x/k,point.z/k))*k;
            const gap=Math.abs(point.y-surface+s.deckThickness*k*.5)-s.deckThickness*k*.5;minShoe=Math.min(minShoe,gap);
            if(gap<-.004&&failures.length<12)failures.push({clip:clip.name,time,kind:'shoe',gap});
          }
        }
      }
      if(clip.metadata.reviewPipe)for(let i=0;i<deck.geometry.attributes.position.count;i++){
        point.fromBufferAttribute(deck.geometry.attributes.position,i).applyMatrix4(deck.matrixWorld);
        const gap=Math.hypot(point.y-clip.metadata.reviewRailHeight,point.z)-.09;
        minCoping=Math.min(minCoping,gap);
        if(gap<-.002&&failures.length<12)failures.push({clip:clip.name,time,kind:'coping',gap});
      }
      if(clip.metadata.skateReviewId==='grind:under'){
        const box=new THREE.Box3().setFromObject(p.headM),y=clip.metadata.reviewRailHeight;
        const dx=Math.max(box.min.x,0,-box.max.x),dy=Math.max(box.min.y-y,0,y-box.max.y);
        const gap=Math.hypot(dx,dy)-.09;minCoping=Math.min(minCoping,gap);
        if(gap<-.001&&failures.length<12)failures.push({clip:clip.name,time,kind:'head/rail',gap});
      }
    }
    if(kick)for(let i=1;i<flight.length-1;i++)assert.ok(flight[i+1]-2*flight[i]+flight[i-1]<.002,'captured Kickflip accelerates upward toward the feet');
    results.push({clip:clip.name,minShorts,minCoping,...(kick?{minShoe}:{})});
  }
  p.exitAnimationPreview();console.log({samples,vertices,results,failures});assert.deepEqual(failures,[]);
  console.log('PASS S09/S10/S26–S38/S42 captured entry, trick and exit garment/board and rail clearance.');
});
