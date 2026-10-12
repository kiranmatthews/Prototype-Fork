/** Meshy iron parts share the scenery cache, atlases and explicit near/far LODs. */
export const HAZARD_ASSETS = {
  hazardironweight: {file:'../hazards/iron-weight',label:'Meshy forged iron pendulum weight',size:[1.9,2.25,1.8],wind:false,lod:true,normalStrength:.45,doubleSided:false},
  hazardironlink: {file:'../hazards/iron-link',label:'Meshy forged iron chain link',size:[.3,.54,.1],wind:false,lod:true,normalStrength:.35,doubleSided:false},
} as const;
