import type {CustomComponent,CustomLevelData} from '../level';
import {dressAncientHoard,ANCIENT_HOARD_ATMOSPHERE} from './ancient-gates-art';

/** Gatekeeper's Hoard: every box is earned by an ordered route. Steel anchors
 * and revealed masonry remain solid after their rewards have been collected. */
const components:CustomComponent[]=[];
const add=(c:CustomComponent):void=>{components.push(c);};
const cube={vertices:[-.5,-.5,-.5,.5,-.5,-.5,.5,.5,-.5,-.5,.5,-.5,-.5,-.5,.5,.5,-.5,.5,.5,.5,.5,-.5,.5,.5],indices:[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,3,7,6,3,6,2,0,4,7,0,7,3,1,2,6,1,6,5]};
const deck=(a:number,b:number,y:number,nm:string,outline=false,grp=1):void=>add({t:'mesh',p:[(a+b)/2,y-.45,0],s:[b-a,.9,6.4],...cube,tex:'checker',color:'#9b978b',nm,grp,...(outline?{outline:true}:{})});
const box=(x:number,y:number,kind:CustomComponent['kind'],nm:string,outline=false,grp=2):void=>add({t:'crate',p:[x,y,0],kind,nm,grp,...(outline?{outline:true}:{})});
const fruit=(a:number,b:number,y:number,rise=2):void=>{for(let i=0;i<5;i++)add({t:'wumpa',p:[a+(b-a)*i/4,y+1.2+Math.sin(i/4*Math.PI)*rise,0],grp:2});};

deck(-16,52,0,'Hoard arrival and return court');
box(-7,0,'wood','Gatekeeper welcome');box(-7,.96,'wood','Gatekeeper welcome cap');
box(6,0,'bouncy','Keep the jade arrow');
deck(10,21,6.4,'Hidden jade gallery',true,20);
box(13,6.4,'life','Revealed jade life',true,20);box(17.5,6.4,'mystery','Revealed jade cache',true,20);
box(31,0,'wood','First sealed offering');box(31,.96,'mystery','First sealed offering cap');
box(39,0,'bang','Jade gallery seal',false,20);
fruit(6,12,3.2,2.4);

// Restore the stepped crossing independently of the upper gallery.
box(47,0,'bang','Three-stone causeway seal',false,21);
for(const [i,[x,y]] of [[58,1],[66,2],[74,1.2]].entries()){
 deck(x-2.1,x+2.1,y,`Restored causeway stone ${i+1}`,true,21);
 box(x,y,i===1?'mystery':'wood',`Causeway offering ${i+1}`,true,21);
}
deck(80,104,0,'Hammered copper store');box(86,0,'wood','Copper store parcel');
box(91,0,'multihit','Copper fruit chest');box(97,0,'mystery','Copper store cache');
fruit(51,58,.5);fruit(75,81,.4);

// A genuine steel-and-wood relay: remove each cap while retaining its support.
for(const [i,x] of [108,112.5,117,121.5,126].entries()){
 box(x,0,'metal',`Permanent relay anchor ${i+1}`);box(x,.96,'wood',`Relay cap ${i+1}`);
}
deck(130,157,0,'Five-bounce treasury');
box(137,0,'multihit','Treasury lower finite chest');box(137,.96,'multihit','Treasury upper finite chest');
box(137,8.2,'life','Treasury crown before supports');box(148,0,'mystery','Treasury exit cache');
fruit(103,108,1);fruit(126,131,1);

// The final vertical detour can be returned from after its arrow is collected.
box(153,0,'bouncy','Final hoard arrow');deck(158,169,6,'Last offering shelf');
box(161,6,'wood','Last shelf offering');box(165,6,'life','Last shelf life');
deck(157,172,0,'Arrow return passage');
deck(178,201,0,'Hoard departure court');box(183,0,'wood','Departure offering');
box(183,.96,'wood','Departure offering cap');box(190,0,'mystery','Gatekeeper farewell');
fruit(171,179,0);fruit(153,160,3,2.4);
for(const [a,b] of [[52,80],[104,130],[172,178]])add({t:'pit',p:[(a+b)/2,-7,0],s:[b-a,1,6.4],nm:'Hoard open chasm',grp:1});
add({t:'gate',p:[197,0,0],yaw:90,nm:'Return with the Gatekeeper’s Hoard',grp:1});
for(const z of [-1.05,1.05])add({t:'wall',p:[92,-18,z],s:[230,52,.6],invisible:true,nm:'Hoard depth boundary',grp:80});
add({t:'zone',p:[92,0,0],s:[230,1,18],dir:'E',grp:80});
add({t:'camnode',p:[-20,0,0],grp:80});add({t:'camnode',p:[210,0,0],grp:80});

components.push(...dressAncientHoard(components));
export const ANCIENT_GATES_BONUS:CustomLevelData={v:1,name:'Bonus: The Gatekeeper’s Hoard',spawn:[-12,.12,0],killY:-10,
 hudMode:'bonus',sky:'day',ledgeAssist:1,components,
 jungleAtmosphere:true,jungleDepthFade:false,jungleStyle:'painterly',keepPlayFog:true,atmosphere:ANCIENT_HOARD_ATMOSPHERE,
 groups:[{id:1,nm:'Permanent hoard support'},{id:2,nm:'Ordered hoard offerings'},{id:20,nm:'Jade gallery seal'},
  {id:21,nm:'Three-stone causeway seal'},{id:80,nm:'Hoard camera and depth boundary',editorOnly:true},{id:90,nm:'Gatekeeper jade reliquary scenery'}]};
