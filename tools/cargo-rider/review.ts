import * as THREE from 'three';
import { Player } from '../../src/player';
import { cargoPerformances, performanceControls, type CargoExpression } from '../../src/character/cargoRiderPerformance';
import { RigBinding } from '../../src/animation/rigBinding';
import { createPlayerStarterAnimationSuite } from '../../src/animation/playerCatalog';
import { sampleClip } from '../../src/animation/sampling';
import { withSkatePresentationRig, loadSkateReviewCatalog, skateBoardVisibleAt } from '../../src/animation/skateCatalog';
import { gameplayAnimationDocument, prepareGameplayAnimationAssets } from '../../src/gameplayAnimationScheme';
import { SkateRetargeter } from '../../src/skateReferenceLab/retarget';

/** The native Animation Studio evaluator and the selectable production skin, in neutral studio light. */
export async function openReview() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xded4dc);
  const player = new Player(scene);
  player.setCharacterHeadStyle('cargo');
  for (let i=0; i<600 && player.cargoLoadState==='loading'; i++) await new Promise(done=>setTimeout(done,50));
  const skin = player.cargoSurface;
  if (!skin || !skin.root.visible) throw new Error(`Cargo Roo load ${player.cargoLoadState}`);
  const renderer = new THREE.WebGLRenderer({ antialias:true, preserveDrawingBuffer:true });
  renderer.setSize(640,720); document.body.replaceChildren(renderer.domElement);
  document.body.style.cssText='margin:0;background:#ded4dc';
  const camera = new THREE.PerspectiveCamera(27,640/720,.03,50);
  scene.add(new THREE.HemisphereLight(0xfff5ed,0xffdcdf,1.55));
  const key = new THREE.DirectionalLight(0xffeee3,2.1); key.position.set(3,6,-4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffdfad,1.35); rim.position.set(-3,3,2); scene.add(rim);
  const rig = player.enterAnimationPreview();
  const board = rig.root.getObjectByName('board');
  const binding = RigBinding.fromDefinition(rig.root, withSkatePresentationRig(RigBinding.fromSculptRuntime(rig.root).definition), {strict:false});
  const starter = createPlayerStarterAnimationSuite(binding.definition);
  const [assets, studio] = await Promise.all([prepareGameplayAnimationAssets(), loadSkateReviewCatalog()]);
  const gameplay = gameplayAnimationDocument(starter, binding.definition, assets.jak);
  const regular = new SkateRetargeter(rig, assets.skate, .25*1.34+.24*1.47, {mirror:true});
  const fakie = new SkateRetargeter(rig, assets.skate, .25*1.34+.24*1.47);
  const catalog = [
    ...gameplay.clips.map(clip=>({id:clip.id,name:clip.name,duration:clip.duration,clip})),
    ...starter.clips.filter(clip=>!gameplay.clips.includes(clip)).map(clip=>({id:'starter/'+clip.id,name:clip.name,duration:clip.duration,clip})),
    ...studio.clips.map(clip=>({id:'studio/'+clip.id,name:clip.name,duration:clip.duration,clip})),
    ...[regular,fakie].flatMap(retarget=>assets.skate.clips.map(source=>({id:(retarget===regular?'regular/':'fakie/')+source.name,name:source.name,duration:(source.frames.length-1)/source.fps,source,retarget}))),
  ];
  const unique = [...new Set(skin.meshes.map(mesh=>mesh.skeleton))];
  const vertex = new THREE.Vector3(), box = new THREE.Box3();
  const checkIndices = skin.meshes.map(mesh => {
    const count=mesh.geometry.getAttribute('position').count;
    return Array.from({length:Math.min(24,count)},(_,i)=>Math.floor(i*(count-1)/Math.max(1,Math.min(24,count)-1)));
  });
  function pose(id: string, clock: number) {
    const clip = catalog.find(entry=>entry.id===id);
    if (!clip) throw new Error(`Missing clip ${id}`);
    player.resetAnimationPreview();
    player.applyAnimationDeformations({});
    if ('clip' in clip) {
      const sampled = sampleClip(clip.clip, clock);
      binding.applyPose(sampled, {resetUnspecified:true});
      player.applyAnimationDeformations(sampled.scalars);
      if (board) board.visible = clip.clip.metadata?.reviewCapture === true
        ? skateBoardVisibleAt(clip.clip, clock)
        : /player\.(skate|grind|grab|launch-board)/.test(clip.id);
    } else {
      binding.resetPose();
      const scalars=clip.retarget.apply(clip.source,clock,{travel:false,rest:false});
      player.applyAnimationDeformations(scalars);
      if (board) board.visible = true;
    }
    player.syncCharacterAppearance();
    scene.updateMatrixWorld(true); for(const skeleton of unique)skeleton.update();
    return clip;
  }
  function bounds() {
    box.makeEmpty();
    skin!.meshes.forEach((mesh, i) => {
      for (const index of checkIndices[i]) box.expandByPoint(mesh.getVertexPosition(index,vertex).applyMatrix4(mesh.matrixWorld));
    });
    return box;
  }
  return {
    style(style: 'cargo'|'skull') { player.setCharacterHeadStyle(style); },
    suites: {starter:starter.clips.length,gameplay:gameplay.clips.length,studio:studio.clips.length,liveSkate:assets.skate.clips.length},
    catalog: catalog.map(c=>({id:c.id,name:c.name,duration:c.duration})),
    sample(id: string, time: number, angle=15, zoom=1) {
      pose(id,time); const b=bounds(), center=b.getCenter(new THREE.Vector3());
      const maxDim=Math.max(1.85,b.max.y-b.min.y,(b.max.x-b.min.x)*.81); const d=maxDim*2.6/zoom;
      const a=THREE.MathUtils.degToRad(angle);camera.position.copy(center).add(new THREE.Vector3(Math.sin(a)*d,.095*d,-Math.cos(a)*d));camera.up.set(0,1,0);camera.lookAt(center);
      renderer.render(scene,camera);
      return {min:b.min.toArray(),max:b.max.toArray(),gl:renderer.getContext().getError()};
    },
    audit(start: number, count: number) {
      return catalog.slice(start,start+count).map(clip=>{
        let peak=0; const samples=Math.max(14,Math.ceil(clip.duration*20));
        for(let i=0;i<=samples;i++) {
          pose(clip.id,clip.duration*i/samples);const b=bounds(),extent=b.getSize(vertex).length();
          if(!Number.isFinite(extent)||extent<.2||extent>12)throw new Error(`Invalid skinned extent ${clip.id} ${i}/${samples}: ${extent}`);
          peak=Math.max(peak,extent);
          for(const skeleton of unique)if(!skeleton.boneMatrices.every(Number.isFinite))throw new Error(`Nonfinite ${clip.id}`);
        }
        return {id:clip.id,poses:samples+1,maxDiagonal:+peak.toFixed(3)};
      });
    },
    action(id:string) {
      const clip=catalog.find(c=>c.id===id)!;const frames=[];
      const fps=24, n=Math.max(2,Math.ceil(clip.duration*fps));
      const inverse=new THREE.Matrix4(), local=new THREE.Matrix4();
      for (let frame=0;frame<=n;frame++) {
        pose(id,clip.duration*frame/n);inverse.copy(player.vehicleVisualRoot.matrixWorld).invert();
        frames.push(unique[0].bones.map(bone=>local.copy(inverse).multiply(bone.matrixWorld).toArray().map(v=>+v.toFixed(7))));
      }
      return {id,fps,duration:clip.duration,bones:unique[0].bones.map(b=>b.name),frames};
    },
    wipeoutCheck() {
      pose('player.idle',.3);skin.setDetached(true);
      let tris=0;for(const m of skin.meshes)tris+=(m.geometry.index?.count??m.geometry.attributes.position.count)/3;
      const wrist=rig.root.getObjectByName('wrist-left')!;wrist.position.x+=2;
      scene.updateMatrixWorld(true);for(const sk of unique)sk.update();
      let maxEdge=0;const a=new THREE.Vector3(),b=new THREE.Vector3();
      for (const m of skin.meshes) {
        const geo=m.geometry, index=geo.index;const count=index?.count??geo.attributes.position.count;
        for(let k=0;k<count;k+=3)for(let j=0;j<3;j++) {
          m.getVertexPosition(index?.getX(k+j)??k+j,a);m.getVertexPosition(index?.getX(k+(j+1)%3)??k+(j+1)%3,b);maxEdge=Math.max(maxEdge,a.distanceTo(b));
        }
      }
      skin.setDetached(false);pose('player.idle',.3);return {tris,maxEdge};
    },
    spinCheck() {
      player.setCargoExpression('puffer');
      const capture = player.captureSpinSmearSource();
      const surfaces = capture.children.filter((child): child is THREE.Mesh => child instanceof THREE.Mesh);
      const triangles = surfaces.reduce((sum, mesh) => sum + (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, 0);
      const cheek = skin.meshes.find(m => m.geometry.morphAttributes.color);
      const still = surfaces.find(m => m.geometry.attributes.color?.count === cheek?.geometry.attributes.color.count);
      if (!cheek || !still) throw new Error('Spin capture lost the facial vertex pigment');
      const rest = cheek.geometry.attributes.color;
      const colors = still.geometry.attributes.color;
      const puff = cheek.geometry.morphAttributes.color![cheek.morphTargetDictionary!['Pose.puffer']];
      let strongest = 0;
      for (let i = 0; i < rest.count; i++) {
        const delta = puff.getY(i);
        strongest = Math.max(strongest, delta);
        if (Math.abs(colors.getY(i) - Math.min(1, rest.getY(i) + delta)) > .005) {
          throw new Error('Spin capture lost the inflated cheek colour');
        }
      }
      if (strongest < .2) throw new Error('Missing inflation pigment');
      player.setCargoExpression('live');
      for (const mesh of surfaces) {
        mesh.geometry.dispose();
        for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) material.dispose();
      }
      return triangles;
    },
    controls() { return skin.meshes.flatMap(m=>Object.keys(m.morphTargetDictionary??{})).filter((x,i,a)=>a.indexOf(x)===i).sort(); },
    expression(name: CargoExpression){ player.setCargoExpression(name); },
    performances: cargoPerformances,
    face(name: CargoExpression, angle=0, close=1, previous?: CargoExpression, blend=1) {
      pose('player.idle', .3);
      player.setCargoExpression(name);
      const transition=previous && previous!==name && performanceControls(previous) && performanceControls(name);
      if (transition) {
        skin.setChannel('Pose.'+previous, 1-blend);
        skin.setChannel('Pose.'+name, blend);
      }
      const idx=unique[0].bones.findIndex(b=>b.name==='head-presentation');
      const matrix=unique[0].bones[idx].matrixWorld.clone().multiply(unique[0].boneInverses[idx]);
      const target=new THREE.Vector3(0,1.676,.070);
      const a=THREE.MathUtils.degToRad(angle), d=1.62/close;
      camera.position.copy(target).add(new THREE.Vector3(Math.sin(a)*d,.035*d,Math.cos(a)*d)).applyMatrix4(matrix);
      camera.up.set(0,1,0).transformDirection(matrix);
      camera.lookAt(target.applyMatrix4(matrix));
      renderer.render(scene,camera);
      if (transition) {
        skin.setChannel('Pose.'+previous, 0);
        skin.setChannel('Pose.'+name, 1);
      }
      return renderer.getContext().getError();
    },
    expressionAudit() {
      pose('player.idle',.3);
      const faces = skin.meshes.filter(m => ['Face', 'Eyes', 'Ears and hair', 'Dentition'].includes(m.userData.cargoSection));
      const points = faces.flatMap(mesh => {
        const count = mesh.geometry.attributes.position.count;
        return Array.from({length:Math.min(100,count)}, (_,i) => ({mesh, index:Math.floor(i*(count-1)/99)}));
      });
      const read = () => points.flatMap(({mesh,index}) => mesh.getVertexPosition(index,vertex).toArray());
      player.setCargoExpression('live');
      const baseline = read();
      const result = cargoPerformances.map(name => {
        player.setCargoExpression(name);
        const required = performanceControls(name)!;
        for (const [channel,value] of Object.entries(required)) {
          const meshes=faces.filter(m => m.morphTargetDictionary?.[channel] !== undefined);
          if (!meshes.length || !Number.isFinite(value)) throw new Error('Unbound control '+name+' / '+channel);
        }
        const macro='Pose.'+name;
        const bindings=faces.filter(m=>m.morphTargetDictionary?.[macro]!==undefined);
        if (!bindings.length || bindings.some(m=>m.morphTargetInfluences![m.morphTargetDictionary![macro]]!==1)) {
          throw new Error('Unbound performance pose '+name);
        }
        const v=read();
        skin.setChannel(macro,0);
        for (const [channel,value] of Object.entries(required)) skin.setChannel(channel,value);
        skin.setChannel('IrisFit.'+name,1);skin.setChannel('MaskFit.'+name,1);
        const editable=read();
        if (editable.some((n,i)=>Math.abs(n-v[i])>.00002)) throw new Error('Editable controls diverged from '+name);
        if (!v.every(Number.isFinite)) throw new Error('Invalid posed vertex for '+name);
        const maximum=Math.max(...v.map((n,i)=>Math.abs(n-baseline[i])));
        return {name,maximum,signature:v.reduce((s,n,i)=>s+Math.sin(i+.7)*n,0)};
      });
      player.setCargoExpression('live');
      const restored=read();
      if (restored.some((v,i)=>Math.abs(v-baseline[i])>1e-6)) throw new Error('Expression residues after returning to Live');
      return result;
    },
    dimensions: { triangles:skin.meshes.reduce((s,m)=>s+(m.geometry.index?.count??m.geometry.attributes.position.count)/3,0), meshes:skin.meshes.length,nativeNodes:unique[0].bones.length },
  };
}
