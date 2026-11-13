import type {CustomComponent} from '../level';

type Point=[number,number,number];
export const COURT_SPAWN:Point=[0,.02,13];
export const COURT_EXTRA_TORCHES:Point[]=[[5,0,7],[-16.65,0,-2],[16.65,0,-2],[-16.65,0,-10],[16.65,0,-10],[-2.6,1.15,-30],[2.6,1.15,-30]];
export const COURT_FIRES:{p:Point;scale:number;context:string}[]=[
  {p:[-5,2.1,7],scale:.43,context:'Gateway torch'},
  {p:[0,1.25,-5],scale:.88,context:'Temple basin'},
  {p:[0,2.05,-20],scale:1.15,context:'Altar fire channel'},
  {p:[-10,.28,-8],scale:.8,context:'Ritual circle'},
  {p:[10.5,.6,-8],scale:.85,context:'Fire trap'},
  {p:[-10,1.65,3],scale:.4,context:'Shrine lantern'},
  {p:[-9,2.4,-19],scale:.7,context:'Offering bowl'},
  {p:[9,.35,4],scale:.85,context:'Camp hearth'},
];
// Source-owned solids use the same platform/wall semantics as the level editor.
// Both the source level and the authoring viewer use this exact layout.
export const COURT_SOLIDS:CustomComponent[]=[
  {t:'platform',p:[0,-.55,-4],s:[36,1,42],color:'#716f51'},
  {t:'platform',p:[0,.55,-20],s:[30,1.2,10],color:'#b3a47c'},
  {t:'platform',p:[0,.55,-29.5],s:[8,1.2,9],color:'#8f8e71'},
  {t:'wall',p:[-4,1.15,-29.5],s:[.6,5.5,9],color:'#657963'},
  {t:'wall',p:[4,1.15,-29.5],s:[.6,5.5,9],color:'#657963'},
  {t:'wall',p:[0,1.15,-34],s:[8,5.5,.6],color:'#657963'},
  ...Array.from({length:4},(_,i):CustomComponent=>({t:'platform',p:[0,(i+1)*.15-.05,-12.3-i*.8],s:[7,(i+1)*.3,.84],color:'#bead82'})),
  {t:'wall',p:[-18,-.05,-4],s:[.8,4.6,42],color:'#858465'},
  {t:'wall',p:[18,-.05,-4],s:[.8,4.6,42],color:'#858465'},
  {t:'wall',p:[-10.5,-.05,17],s:[15,4.6,.8],color:'#858465'},
  {t:'wall',p:[10.5,-.05,17],s:[15,4.6,.8],color:'#858465'},
  {t:'wall',p:[-10.5,1.15,-25],s:[15,4.6,.8],color:'#858465'},
  {t:'wall',p:[10.5,1.15,-25],s:[15,4.6,.8],color:'#858465'},
  ...[-14,14].flatMap(x=>[6,-4,-14].map((z):CustomComponent=>({t:'wall',p:[x,-.05,z],s:[1.15,4.6,1.15],color:'#bbad83'}))),
];

