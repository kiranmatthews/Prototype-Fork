// Uniform temporal bisection of separately drawn keys. Emits prompts only.
// Every resulting cel still requires its own built-in imagegen call and review.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..'),dir=resolve(root,'docs/fire-sprite-lab/v4');
const record=JSON.parse(await readFile(resolve(dir,'generation.json'),'utf8'));
const family=process.argv[2]||'narrow',count=Number(process.argv[3]||3);
const frames=record.frames.filter(f=>f.family===family).sort((a,b)=>a.phase-b.phase);
if(![0,8,16,24,32,40].every(p=>frames.some(f=>f.phase===p)))throw Error('Finish and review the six planned keys first.');
const directions={
 narrow:[
  'The old upper-right hole expands and rises; its top bridge thins and tears open into two unequal tips. The left shoulder rolls upward while a younger right lobe grows from below. Draw the bridge progressively thinner before it opens; do not make it pop.',
  'Old upper prongs thin and burn away while a NEW right-hand rounded sheet rises from BELOW. Keep all visible fire connected; do not introduce detached ribbons or miniature flames. The new lower opening grows within the new sheet. Do not slide the old crown downward to form the new head.',
  'The young broad right-hand orange head and its internal opening both travel UP and expand. The left lower lobe stretches upward. The dying upper remnant shrinks away; new lower light replaces the rising inner crests.',
  'The old broad right head thins, opens and is consumed. Its opening stretches UP while a fresh smaller opening forms below it. Preserve an evolving thin neck between old and young parts, then let it disappear. The left swelling feeds new upward flow.',
  'The very thin old upper rim is consumed; the NEW opening below widens and starts rising in a fresh orange sheet from the left shoulder. Distinguish the upper material dying from the lower material being born; never move an old hole downward.',
  'Seam transition: the new sheet and its opening rise UP toward the initial pose. The lower-left swelling moves upward and narrows; a young small right lobe forms. This is continuous forward motion into the first frame, not a reverse, duplicate endpoint, reset or crossfade.'
 ],
 medium:[
  'The old large upper opening rises and breaks through its crown; the left old tip thins and burns away. The young right lobe grows upward; new yellow crests rise from the low white source.',
  'The old two-pronged crown is consumed while young right and left lobes rise from below. Do not reuse the old crown as a new bulb by sliding it down. Show upward replacement and a progressively opening cleft.',
  'New unequal right and left lobes swell and move upward, internal holes rise and expand, and the earlier upper scraps fade. New low bright shapes replace the rising light.',
  'The mature right sheet opens through its thin crown while the left sheet narrows and burns away. New low middle material grows upward into their place. The large shapes change through their own lifetimes.',
  'Old upper membranes are consumed as a new middle-right sheet rises from a lower shoulder, with its own young opening and rising yellow feed. Keep brightness and registration continuous.',
  'Seam transition: new middle-right material and its hollow rise into the first key while the left younger lobe stretches into its initial position. Continue forward growth, never reverse the cycle or add a duplicate endpoint.'
 ],
 broad:[
  'The old central-left hollow rises, thins and opens at its crown; the mid-right swell rises and the far-right lobe grows. The long luminous low source remains connected. Consume tips before they reach the canvas edge.',
  'The old tall central-left crown burns away while the middle-right sheet grows upward to replace it. Young low lobes replenish the central-left area. Do not move the old tallest crown sideways as one object.',
  'The growing middle-right head and its hole rise and expand. The left old sheet tears and dissipates; younger left and far-right lobes rise at unequal rates. Inner light flows upward independently.',
  'The mature middle-right sheet opens and thins at the crown while a new central-left lower sheet rises. The far-right and left lobes are at different growth phases. Avoid a mechanically swaying crown.',
  'Old upper-right material disappears while fresh central-left material rises into a new broad sheet and opening; the other lobes continue growing or dying at staggered phases.',
  'Seam transition: the young central-left hollow rises into the initial drawing; older mid-right material is consumed as a low young right swell replaces it. Continuous forward motion across the boundary, not a reset or reversal.'
 ]
};
const gaps=frames.map((left,i)=>{const right=frames[(i+1)%frames.length],end=i===frames.length-1?48:right.phase;return{left,right,end,gap:end-left.phase};}).filter(x=>x.gap>1).sort((a,b)=>b.gap-a.gap||a.left.phase-b.left.phase).slice(0,count);
const defs=[];
for(const {left,right,end,gap} of gaps){
 const phase=(left.phase+end)/2;if(!Number.isInteger(phase))throw Error('Non-dyadic gap');
 const revision=record.rejected.filter(f=>f.family===family&&f.phase===phase).length+1;
 const id=String(phase).padStart(2,'0')+(revision>1?'-r'+revision:''),promptName=`${family}-${id}.txt`;
 const prompt=`Use case: stylized-concept. Asset: exactly ONE newly drawn fire animation cel.\nImage1 is the EARLIER drawing at phase${left.phase}/48. Image2 is the LATER drawing at phase${end}/48${end===48?' (the first drawing of the next cycle)':''}. Generate the cel exactly HALFWAY between these poses, phase${phase}/48. Time from either neighbour is${(gap/2/40).toFixed(3)}seconds. Do not duplicate either endpoint.\n\nMotion in this interval: ${gap>4?("Show only HALF of this change at the requested intermediate moment. Keep half of the old structure and half of the new growth, in strictly intermediate positions. Do not complete the action or copy image2: "+directions[family][Math.floor(left.phase/8)]):"These are closely spaced neighbour poses. Put each corresponding contour and hole boundary halfway between the two references. Do not extrapolate the larger key-pose action, invent extra holes, or jump to an endpoint. The references define the full extent of the small change."}\n\nRespect the very close temporal spacing. Draw one definite contour at each intermediate position: expanding holes, thinning bridges, moving shoulders and bright internal crests all occupy intermediate shapes. For disappearing material, reduce its thickness and opacity as it is consumed; for growing material, build it from its connected lower source. No double exposures, dissolve, optical-flow texture, blur, new unrelated tongues or whole-image sway. At fine intervals use tiny controlled changes, not a fresh key pose.\n\nRetain the exact${family==='broad'?'1774×887 wide':'1254×1254 square'} canvas, original pixel scale, stable foot position and native transparent padding. Keep the lumen/colour level continuous between the two references. Match the softly luminous warm white/lemon base, orange flowing sheets and thin reddish tips, painted as large cel colour masses with restrained soft transitions. The inner light shapes also move between their two references rather than remaining frozen. No outlines, nested flame-logo bands, extra miniature flames, sparks, smoke, exterior haze, noise, text, props, grid or sheet. The empty surroundings and interior holes must have exactly alpha ZERO: no grey/white haze, pale background, exterior bloom or stray particles. Keep all flame shapes connected to the body. Genuine alpha outside the effect and through its openings. Output one transparent PNG cel only.`;
 await writeFile(resolve(dir,'prompts',promptName),prompt+'\n');
 defs.push({id:family+'-'+id,family,celId:id,phase,promptFile:'prompts/'+promptName,prompt,refs:[resolve(root,left.file),resolve(root,right.file)]});
}
await writeFile(resolve(dir,'next-batch.json'),JSON.stringify(defs,null,2)+'\n');
console.log(JSON.stringify(defs));
