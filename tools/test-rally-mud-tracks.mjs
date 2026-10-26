import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {createServer} from 'vite';
const server=await createServer({logLevel:'silent',server:{middlewareMode:true}});
try{
 const {RallyMudTracks}=await server.ssrLoadModule('/src/golf-cart/mudTracks.ts');
 const {createCartState}=await server.ssrLoadModule('/src/golf-cart/physics.ts');
 const layout=await server.ssrLoadModule('/src/levels/cart-stadium-layout.ts');
 const tracks=new RallyMudTracks(),c=createCartState({x:0,z:0,yaw:0},()=>({height:18,grip:1,drag:0,safe:true}));let time=0;
 const at=(s,u=0)=>{const p=layout.rallySurfacePoint(s,u),f=layout.cartRallyFrame(s);Object.assign(c,{x:p[0],y:p[1],z:p[2],yaw:Math.atan2(-f.dx,1),travel:s,speed:25});time+=1/30;tracks.update(time,[c],[0]);};
 at(70);const start=tracks.diagnostics.emitted;for(let i=0;i<20;i++)at(70);assert.equal(tracks.diagnostics.emitted,start,'Stationary positions cannot leave repeated tracks');
 for(let s=70;s<128;s+=1.2)at(s);const driven=tracks.diagnostics.emitted;assert.ok(driven>50,'Both actual moving tyres create a trail');
 c.grounded=false;for(let s=128;s<145;s++)at(s);assert.equal(tracks.diagnostics.emitted,driven,'No track while airborne');
 c.grounded=true;at(155);assert.equal(tracks.diagnostics.emitted,driven,'Landing must start a new trail');
 at(580);assert.equal(tracks.diagnostics.emitted,driven,'Teleport cannot draw a bridge');
 // Repeated laps through one chunk reuse its bounded slots, without growing buffers.
 for(let lap=0;lap<32;lap++)for(let s=520;s<580;s+=1.05)at(s,Math.sin(s*.02+lap)*6);
 const final=tracks.diagnostics;assert.ok(final.emitted>3000);assert.ok(final.segments<=final.capacity);
 let vertices=0,longest=0,minNormal=Infinity;
 for(const chunk of tracks.root.children){
  const g=chunk.geometry,p=g.getAttribute('position'),ind=g.index;if(!g.drawRange.count)continue;
  for(let i=0;i<g.drawRange.count;i+=6){
   const a=ind.getX(i),b=ind.getX(i+1),d=ind.getX(i+2);
   const x=p.getX(b)-p.getX(a),z=p.getZ(b)-p.getZ(a),dx=p.getX(d)-p.getX(a),dz=p.getZ(d)-p.getZ(a);
   minNormal=Math.min(minNormal,z*dx-x*dz);longest=Math.max(longest,Math.hypot(dx,dz));
   for(let j=0;j<4;j++){assert.ok(Number.isFinite(p.getY(a+j)));assert.ok(chunk.geometry.boundingBox.containsPoint({x:p.getX(a+j),y:p.getY(a+j),z:p.getZ(a+j)}));vertices++;}
  }
 }
 assert.ok(minNormal>0,'Track winding faces upwards');assert.ok(longest<3.1);
 for(const chunk of tracks.root.children)for(const key of ['position','uv','trackBirth'])assert.ok(chunk.geometry.getAttribute(key).updateRanges.length<=1,'Offscreen pending uploads stay bounded');
 at(570);for(const chunk of tracks.root.children)for(const key of ['position','uv','trackBirth'])chunk.geometry.getAttribute(key).clearUpdateRanges();
 at(571.4);let uploadBytes=0,fullUploadBytes=0;
 for(const chunk of tracks.root.children){let dirty=false;for(const key of ['position','uv','trackBirth']){const a=chunk.geometry.getAttribute(key);if(a.updateRanges.length)dirty=true;uploadBytes+=a.updateRanges.reduce((n,r)=>n+r.count*4,0);}if(dirty)for(const key of ['position','uv','trackBirth'])fullUploadBytes+=chunk.geometry.getAttribute(key).array.byteLength;}
 assert.ok(uploadBytes>0&&uploadBytes<fullUploadBytes*.01,'Wheel histories upload changed vertices rather than entire chunks');
 const emitted=tracks.diagnostics.emitted;c.tumbling=true;at(572);assert.equal(tracks.diagnostics.emitted,emitted,'Rolling carts cannot stamp upside-down tracks');
 tracks.update(time+112,[c],[-1]);assert.ok(tracks.root.children.every(o=>!o.visible),'Expired histories stop drawing');
 let disposed=0;tracks.root.children.forEach(o=>o.geometry.addEventListener('dispose',()=>disposed++));tracks.dispose();assert.equal(disposed,final.chunks);
 const report={passed:true,driven,final,vertices,longest,minNormal,disposed,uploadBytes,fullUploadBytes};await writeFile(process.env.RALLY_TRACK_REPORT??'/private/tmp/rally-style-tracks.json',JSON.stringify(report,null,2));console.log('PASS rally wheel histories',JSON.stringify(report));
}finally{await server.close();}
