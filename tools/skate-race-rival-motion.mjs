import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.argv.find(a=>a.startsWith('http'))||'http://127.0.0.1:5228';
const output=process.env.RACE_MOTION_OUTPUT||'/private/tmp/skate-race-rival-motion';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,channel:'chrome'}),page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto(`${base}/?playtest&level=slipstream-race`,{timeout:180000});await page.waitForFunction(()=>window.__game?.getSkateRace()?.active&&!window.__game.gameFlow.blocksGameplay,null,{timeout:180000});
 await page.evaluate(()=>{
  const g=window.__game,r=g.getSkateRace(),render=g.renderer.render.bind(g.renderer);
  window.rivalMotion={angle:0,previousJump:false,events:new Set(),pose:[],data:null};
  r.drive=id=>{
   const m=window.rivalMotion,t=r.elapsed,s={moveX:0,moveY:id===1?1:0,jumpHeld:id===1&&t<2.2,grindHeld:false,grabHeld:false,spinHeld:false,transferHeld:false,jumpPressed:false,jumpReleased:false,spinPressed:false,grabPressed:false,itemPressed:false,consumeEdges(){}};
   if(id===1){s.jumpPressed=s.jumpHeld&&!m.previousJump;s.jumpReleased=!s.jumpHeld&&m.previousJump;m.previousJump=s.jumpHeld;
    if(t>2.4&&!m.events.has('spin')){s.spinPressed=s.spinHeld=true;m.events.add('spin');}
    if(t>3.0&&!m.events.has('stomp')){s.grabPressed=s.grabHeld=true;m.events.add('stomp');}
    if(t>6&&!m.events.has('hit')){r.riders[0].item='shock-shell';r.useItem(0);m.events.add('hit');}
    const p=r.riders[1].player;
    m.pose.push({t,state:p.state,bail:p.skateCameraBailing,grounded:p.grounded,position:p.pos.toArray(),root:p.group.scale.toArray(),torso:p.playerAnimationBridge.deformationValue('deform.torso.length')});
   }
   return s;
  };
  g.renderer.render=(scene,camera)=>{
   if(scene===g.scene&&camera===g.camera){const p=r.riders[1].player,f=p.raceHeading,a=window.rivalMotion.angle,dx=f.x*Math.cos(a)+f.z*Math.sin(a),dz=-f.x*Math.sin(a)+f.z*Math.cos(a);
    camera.position.set(p.renderPosition.x+dx*6.5,p.renderPosition.y+2.8,p.renderPosition.z+dz*6.5);camera.fov=45;camera.lookAt(p.renderPosition.x,p.renderPosition.y+1.35,p.renderPosition.z);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);r.updateView(camera);
   }
   render(scene,camera);
  };
 });
 for(const degrees of [0,40,90]){
  await page.evaluate(degrees=>{
   const g=window.__game,r=g.getSkateRace(),m=window.rivalMotion;r.start('race');r.phase='running';m.angle=degrees*Math.PI/180;m.previousJump=false;m.events.clear();m.pose=[];m.data=null;
   const chunks=[],stream=g.renderer.domElement.captureStream(30),recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:2400000});m.recorder=recorder;
   recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
   recorder.onstop=async()=>{const bytes=new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer());let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));m.data=btoa(text);stream.getTracks().forEach(t=>t.stop());};recorder.start();
  },degrees);
  await page.waitForFunction(()=>window.__game.getSkateRace().elapsed>11.8,null,{timeout:45000});
  await page.screenshot({path:`${output}/view-${degrees}.png`});await page.evaluate(()=>window.rivalMotion.recorder.stop());await page.waitForFunction(()=>window.rivalMotion.data!==null);
  const report=await page.evaluate(()=>({data:window.rivalMotion.data,pose:window.rivalMotion.pose,events:[...window.rivalMotion.events]}));
  await writeFile(`${output}/view-${degrees}.webm`,Buffer.from(report.data,'base64'));
  assert.ok(report.pose.every(p=>p.position.every(Number.isFinite)&&p.root.every(v=>v===1)));
  assert.ok(report.pose.some(p=>p.bail));assert.ok(!report.pose.at(-1).bail,'The get-up must finish');assert.ok(report.pose.some(p=>!p.grounded));
  reports.push({degrees,events:report.events,frames:report.pose.length,elasticRange:[Math.min(...report.pose.map(p=>p.torso??1)),Math.max(...report.pose.map(p=>p.torso??1))],settled:!report.pose.at(-1).bail});
 }
 assert.deepEqual(errors,[]);await writeFile(output+'/report.json',JSON.stringify({reports,errors},null,2));console.log(JSON.stringify({reports,errors}));
}finally{await browser.close();}
