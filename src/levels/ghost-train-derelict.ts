import type {CustomComponent} from '../level';
import {GhostArt,type GhostPoint as P} from './ghost-train-art';

interface Context {
  point:(s:number,y?:number,u?:number)=>P;height:(s:number)=>number;yaw:(s:number)=>number;
  rooms:{a:number;b:number;width:number;ceiling:number;id:number;grp:number;style:string}[];
  widthAt:(room:Context['rooms'][number],s:number)=>number;
  gaps:{a:number;b:number;kind:string;name:string}[];
  bonusLines:{a:number;b:number;u:number}[];
}
const random=(n:number)=>{const a=Math.sin(n*91.17+3.3)*41731.7;return a-Math.floor(a);};

/** Dereliction is authored level data: broken tile skirts, leaking services,
 * rubbish, readable jump-edge lights and original vandalism in each chamber. */
export function addDerelictGhostScenes(C:CustomComponent[],q:Context):void {
  const art=new GhostArt(C,40),{point,height,yaw,rooms,gaps}=q;
  const roomAt=(s:number)=>rooms.find(r=>s>=r.a&&s<r.b)??rooms[rooms.length-1];
  const add=(c:CustomComponent)=>C.push(c);
  const prop=(kind:NonNullable<CustomComponent['dkind']>,s:number,u:number,h:number,size:P,angle=yaw(s),lean=0)=>
    add({t:'decor',dkind:kind,p:point(s,height(s)+h,u),s:size,yaw:angle,amp:lean,solid:false,grp:roomAt(s).grp,nm:`Derelict bathhouse · ${kind}`});
  const steam=(s:number,u:number,h=.05,width=4,rise=2.4,density=.4)=>
    add({t:'decor',dkind:'ghoststeam',p:point(s,height(s)+h,u),w:width,rise,amp:density,phase:s*.017+u,grp:roomAt(s).grp,nm:'Leaking green bath steam'});
  const light=(s:number,u:number,h:number,colour='#7bff55',family=0)=>
    add({t:'decor',dkind:'ghostshowlight',p:point(s,height(s)+h,u),to:point(s+7,height(s+7)+1.2),color:colour,amp:family===0?130:90,w:.83,rise:27,vr:family,grp:roomAt(s).grp,nm:'Faulty green bathhouse practical'});

  for(const room of rooms){
    const {a,b,width,grp,id}=room;
    // Tile panels interrupt the old clean masonry at different heights.
    for(let s=a+7;s<b-4;s+=11){
      const i=Math.round(s/11),side=i%2?1:-1,u=side*(q.widthAt(room,s)/2-.48);
      prop('ghostbathwall',s,u,-.02,[3.4,4.5,.5],yaw(s)+(side<0?90:-90));
      if(room.style==='hero')prop('ghostbathwall',s+5,-u,-.04,[3.4,4.5,.5],yaw(s)+(side<0?-90:90));
      // Different lengths, missing runs and rust make service pipes look added
      // to the old bathhouse, rather than perfect castle ornament.
      if(i%3!==1){
        const y=height(s)+3.7;
        art.beam(point(s-3,y,u-side*.22),point(s+6,height(s+6)+3.7,u-side*.22),.12,'#624539',grp,'Corroded exposed steam main',.14);
        art.beam(point(s+6,height(s+6)+3.7,u-side*.22),point(s+6,height(s+6)+1.0,u-side*.22),.12,'#405b4c',grp,'Broken vertical service pipe',.14);
        add({t:'decor',dkind:'ghostgraffiti',p:point(s+6,height(s+6)+.02,side*(q.widthAt(room,s+6)/2-.41)),w:2.7,rise:3.7,yaw:yaw(s+6)+(side<0?90:-90),vr:8+i%3,color:'#10261b',grp,nm:'Black mildew and runoff beneath leaking pipes'});
      }
      if(i%2===0){
        add({t:'decor',dkind:'ghostgraffiti',p:point(s+4,height(s+4)+.85,side*(q.widthAt(room,s+4)/2-.38)),w:3.9,rise:2.3,yaw:yaw(s+4)+(side<0?90:-90),vr:i%8,color:i%3?'#b75cff':'#b1ef50',grp,nm:'UV graffiti and paint drips'});
        steam(s+6,u-side*.5,.06,3.2,2.4,.39);
      }
      if(!gaps.some(g=>s>g.a-4&&s<g.b+4)){
        const junkSide=side<0&&q.bonusLines.some(line=>s>line.a-8&&s<line.b+8)?1:side;
        prop('ghostjunk',s+1,junkSide*Math.min(width/2-1.1,3.5),0,[1.8,.9,1.6],yaw(s)+junkSide*(20+random(i)*30));
        // Loose paper, bent tile slabs and cans, kept clear of the central line.
        for(let n=0;n<10;n++){
          const ds=(random(i*13+n)-.5)*8,uu=side*(.6+random(i+n*7)*2.35),yy=height(s+ds);
          const p=point(s+ds,yy+.028,uu),w=(.24+random(n+i)*.35)/2,d=(.20+random(n+4)*.38)/2,a=(yaw(s)+random(i+n)*170)*Math.PI/180;
          const corners=[[-w,-d],[-w,d],[w,d],[w,-d]].map(([x,z])=>[p[0]+x*Math.cos(a)+z*Math.sin(a),p[1],p[2]-x*Math.sin(a)+z*Math.cos(a)] as P);
          art.face(corners,n%2?'#b4af8b':'#438b81',grp,'Scattered tickets and chipped bath tiles');
        }
      }
    }
    for(let s=a+3;s<b-3;s+=5.5)for(const side of [-1,1]){
      const from=s-2.65,to=s+2.65,h=2.5+random(s+side)*.8,uf=side*(q.widthAt(room,from)/2-.32),ut=side*(q.widthAt(room,to)/2-.32);
      art.face([point(from,height(from),uf),point(to,height(to),ut),point(to,height(to)+h,ut),point(from,height(from)+h,uf)],'#bcccb7',grp,'Chipped turquoise bathhouse tile skirt',undefined,'castle-bath');
    }
    // Every chamber contains readable green light and visible moving vapour.
    const mid=(a+b)/2;
    steam(mid,-Math.min(2.8,width/2-1),.05,4.7,2.4,.38);
    light(a+9,Math.min(3.2,width/2-.5),3.5,'#80ff4e',0);
    light(mid,-Math.min(3.6,width/2-.5),2.3,id%3===1?'#d451d8':'#45deac',id%3===1?2:1);
    if(id%3===0){
      const side=id%2?1:-1;
      prop('ghostboiler',a+15,side*(width/2-1.15),0,[1.5,2.2,1.5],yaw(a+15)+side*20);
      steam(a+15,side*(width/2-1.4),1.3,3.2,3.8,.52);
    }
    // Lamps and signs guide the player into the next room through the haze.
    if(room.style==='hero'){
      // Shallow stagnant baths flank the safe aisle. Deep holes remain the
      // explicitly authored track pits; scenery never invents a lethal floor.
      for(const side of [-1,1]){
        const u=side*(width/2-3.0),s=mid-5;
        add({t:'decor',dkind:'ghostslime',p:point(s,height(s)+.035,u),s:[3.3,.01,11],yaw:yaw(s),grp,nm:'Neglected shallow bath basin'});
        for(const edge of [-1,1])art.box(point(s,height(s)+.18,u+edge*1.75),[.25,.36,11.5],'#517c6b',grp,'Broken turquoise bath coping',yaw(s),undefined,'castle-stone');
        steam(s,u,.1,5.2,3.2,.46);
        prop('ghostbathwall',s+7,side*(width/2-.5),.0,[3.6,4.9,.5],yaw(s)+(side<0?90:-90));
        if(width>=20)prop('ghostbatharch',b-8,side*(width/2-1.7),0,[4.9,4.1,3.63],yaw(b-8)+(side<0?90:-90));
      }
    }
  }

  for(const gap of gaps){
    const mid=(gap.a+gap.b)/2,grp=roomAt(mid).grp;
    // Light the actual takeoff/landing edges. A visible warning is part of
    // the obstacle, while the steam sits below rather than hiding the landing.
    for(const s of [gap.a-.15,gap.b+.2])for(const side of [-1,1]){
      art.box(point(s,height(s)+.035,side*1.55),[.65,.055,.3],'#7dd77a',grp,'Emerald jump-edge marker',yaw(s),'#53c966');
      art.box(point(s,height(s)+.05,side*1.55),[.3,.02,.15],'#d1ffc2',grp,'Glowing landing inset',yaw(s),'#9aff68');
    }
    for(let s=gap.a+2;s<gap.b;s+=11)steam(s,0,-3.4,6.8,4.0,.58);
    add({t:'decor',dkind:'ghostslime',p:point(mid,Math.min(height(gap.a),height(gap.b))-3.4),s:[roomAt(mid).width-.8,.01,gap.b-gap.a],yaw:yaw(mid),grp,nm:'Acid-green water beneath broken track'});
  }

  for(const [s,side]of [[18,1],[44,1],[205,-1],[746,1],[1348,-1],[1760,-1],[2102,1]]){
    const r=roomAt(s),u=side*(r.width/2-1.15);
    prop('ghostcart',s,u,.0,[2,2,4.2],yaw(s)+side*27,side*12);
    steam(s,u,.05,3,1.8,.33);
  }
  add({t:'decor',dkind:'ghostknight',p:point(18,height(18),-2.9),s:[1.7,2.7,1.6],yaw:yaw(18)-28,grp:10,nm:'Caretaker armour watching the boarding queue'});
  for(const [s,u]of [[22,1.9],[163,1.6],[342,1.8],[449,1.6],[606,-2.6],[776,1.7],[895,-1.8],[1127,1.8],[1408,1.6],[1649,-1.7],[1948,1.8],[2078,-1.6]]){
    add({t:'crate',p:point(s,undefined,u),kind:'wood',grp:roomAt(s).grp,nm:'Abandoned ride supply box'});
    add({t:'wumpa',p:point(s,height(s)+1.7,u),grp:roomAt(s).grp,nm:'Supply box fruit reward'});
  }
  for(const s of [65,818,1369,1965])add({t:'crate',p:point(s,undefined,-1.8),kind:'mask',grp:roomAt(s).grp,nm:'Caretaker recovery mask'});
  // Large front-facing names make the theatrical reveals legible in motion.
  for(const [s,variant]of [[14,0],[72,1],[236,5],[593,4],[846,6],[1125,1],[1449,2],[1698,6],[2229,7]])
    add({t:'decor',dkind:'ghostneon',p:point(s,height(s)+3.9),w:5.3,rise:1.5,yaw:yaw(s),vr:variant,color:'#91ff45',grp:roomAt(s).grp,nm:'Big flickering chamber title'});
  for(const c of C.filter(c=>c.t==='decor'&&c.dkind==='ghostneon')){
    const s=18-c.p[2],h=c.rise??1.5,w=c.w??4.2,a=(c.yaw??0)*Math.PI/180;
    art.box([c.p[0]-Math.sin(a)*.08,c.p[1]+h/2,c.p[2]-Math.cos(a)*.08],[w+.22,h*.78,.12],'#24362d',c.grp??10,'Corroded hanging neon backboard',c.yaw??0,'#0b160c');
    for(const side of [-1,1]){const foot=point(s,c.p[1]+h*.84,side*w*.38);art.beam(foot,point(s,height(s)+roomAt(s).ceiling,side*w*.38),.035,'#28392f',c.grp??10,'Dangling sign suspension wire');}
  }
  art.finish();
}
