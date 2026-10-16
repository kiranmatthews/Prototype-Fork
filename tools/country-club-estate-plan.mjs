import {build} from 'esbuild';import{writeFile}from'node:fs/promises';import{tmpdir}from'node:os';import{pathToFileURL}from'node:url';
const file=tmpdir()+'/country-club-layout-review.mjs';await build({entryPoints:['src/levels/country-club-layout.ts'],bundle:true,format:'esm',outfile:file});const m=await import(pathToFileURL(file));
const stroke=(p,w,c)=>`<polyline points="${p.map(q=>q[0]+','+(-q[1])).join(' ')}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
let svg='<svg xmlns="http://www.w3.org/2000/svg" width="804" height="1194" viewBox="-390 -126 804 1194"><rect x="-390" y="-126" width="804" height="1194" fill="#667851"/>';
for(const h of m.COUNTRY_CLUB_HOLES){svg+=stroke(h.path,h.width,'#8ea779');svg+=`<ellipse cx="${h.cup[0]}" cy="${-h.cup[1]}" rx="${h.rx}" ry="${h.rz}" fill="#bbd39a"/><rect x="${h.tee[0]-4}" y="${-h.tee[1]-6}" width="8" height="12" fill="#c4d7ad"/>`;}
for(const b of m.COUNTRY_CLUB_GOLF_BUNKERS)svg+=`<ellipse cx="${b.x}" cy="${-b.z}" rx="${b.rx}" ry="${b.rz}" fill="#dac9a6"/>`;
svg+=stroke(m.COUNTRY_CLUB_ROUTE.filter((_,i)=>i%5===0).map(q=>[q.p[0],q.p[2]]),18,'#c2bca5');
for(const p of m.COUNTRY_CLUB_PONDS)svg+=`<ellipse cx="${p.x}" cy="${-p.z}" rx="${p.rx}" ry="${p.rz}" fill="#658d99" opacity=".8"/>`;
for(const h of m.COUNTRY_CLUB_HOLES)svg+=`<text x="${h.cup[0]}" y="${-h.cup[1]+4}" text-anchor="middle" fill="#172918" font-size="13" font-family="sans-serif" font-weight="bold">${h.n}</text>`;
for(const c of m.COUNTRY_CLUB_CORNERS){const p=m.countryClubPoint((c.entry+c.exit)/2);svg+=`<circle cx="${p[0]}" cy="${-p[2]}" r="5" fill="#b7533e"/>`;}
svg+='</svg>';await writeFile('/private/tmp/country-club-estate-plan.svg',svg);
console.log(JSON.stringify({length:m.COUNTRY_CLUB_LENGTH,corners:m.COUNTRY_CLUB_CORNERS,holes:m.COUNTRY_CLUB_HOLES.map(h=>({n:h.n,cup:h.cup,trackDistance:m.countryClubNearestRoad(...h.cup).distance,waterDistance:Math.min(...m.COUNTRY_CLUB_PONDS.map(p=>Math.hypot((h.cup[0]-p.x)/p.rx,(h.cup[1]-p.z)/p.rz)))})),gaps:m.COUNTRY_CLUB_GAPS.map(g=>({...g,turns:m.COUNTRY_CLUB_CORNERS.filter(c=>c.entry<g.b+35&&c.exit>g.a-50)}))},null,2));
