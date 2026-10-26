import {createRequire} from 'node:module';import {mkdir,writeFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const b=await chromium.launch({channel:'chrome',headless:true}),p=await b.newPage();
const url=await p.evaluate(()=>{
 const c=document.createElement('canvas');c.width=c.height=1024;const x=c.getContext('2d');
 const brands=[['BOG DOG','MUDBOG SUPPLY CO.','#b75e3c','#f4e4b8','BD'],['CROOKED AXLE','GARAGE & RECOVERY','#e1c285','#293c3a','CA'],['HOG WASH','HEAVY DUTY CLEANERS','#40594f','#eedcb4','HW'],['DIRT CHEAP','PARTS • TYRES • BAD ADVICE','#c29b4c','#363729','DC']];
 let seed=7361;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 brands.forEach(([name,tag,bg,fg,initial],i)=>{x.save();x.translate(0,i*256);x.fillStyle=bg;x.fillRect(0,0,1024,256);
  x.strokeStyle=fg;x.lineWidth=4;x.strokeRect(12,12,1000,232);x.globalAlpha=.45;x.lineWidth=1;x.strokeRect(21,21,982,214);x.globalAlpha=1;
  x.save();x.translate(131,128);x.rotate(-.08);x.fillStyle=fg;x.beginPath();for(let n=0;n<16;n++){const a=n*Math.PI/8,r=n%2?74:86;x.lineTo(Math.cos(a)*r,Math.sin(a)*r);}x.closePath();x.fill();x.fillStyle=bg;x.font='900 59px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(initial,0,3);x.restore();
  x.fillStyle=fg;x.textAlign='center';x.font='900 94px Impact, Arial Black, sans-serif';x.fillText(name,615,137,740);x.font='bold 29px Arial, sans-serif';x.fillText(tag,615,185,690);
  // Printed wear remains compact in PNG: sparse rubbed ink and thrown mud.
  x.globalAlpha=.23;x.fillStyle=bg;for(let n=0;n<360;n++){x.fillRect(random()*1024,random()*256,1+random()*13,1+random()*3);}
  x.fillStyle='#392f22';for(let n=0;n<170;n++){const xx=random()*1024,yy=210+random()*46,rr=1+random()*6;x.globalAlpha=.15+random()*.25;x.beginPath();x.ellipse(xx,yy,rr,rr*.6,random(),0,Math.PI*2);x.fill();}
  x.globalAlpha=.7;x.fillStyle='#d6c8a1';for(const xx of [32,992])for(const yy of [32,224]){x.beginPath();x.arc(xx,yy,3,0,7);x.fill();}x.restore();
 });return c.toDataURL('image/png');
});
await mkdir('public/rally',{recursive:true});await writeFile('public/rally/sponsors.png',Buffer.from(url.split(',')[1],'base64'));await b.close();
