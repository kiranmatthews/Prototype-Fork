import type {SpriteFireSpec} from '../spriteFire';

export const EXHIBITS:(SpriteFireSpec&{name:string;tag:string;colour:string;description:string})[]=[
  {arrangement:'torch',family:'narrow',hue:0,name:'Golden torch',tag:'THE ORIGINAL',colour:'#ffbb61',description:'A steady hot foot feeds thin orange sheets. The upper material rises, tears and fades into red.'},
  {arrangement:'bonfire',family:'medium',hue:0,name:'Wild bonfire',tag:'GATHERING HEAT',colour:'#ff7655',description:'Three medium flames overlap at different phases. Broad colour shapes stretch, separate and reform above a steady bed.'},
  {arrangement:'wall',family:'broad',hue:.025,name:'Solar curtain',tag:'LINE OF FIRE',colour:'#ffe485',description:'Overlapping tongues form a low curtain along the temple altar. Neighbouring flames rise and break at different times.'},
  {arrangement:'ring',family:'narrow',hue:.25,name:'Alchemist’s ring',tag:'CLOSED CIRCUIT',colour:'#adf363',description:'Ten small green flames circle an open centre. Each keeps the source frame’s proportions as it turns toward the camera.'},
  {arrangement:'jet',family:'narrow',hue:.49,name:'Blue jet',tag:'UNDER PRESSURE',colour:'#84baff',description:'A continuous sideways stream from the fire trap. Its hot source stays at the mouth while the flame flows outward.'},
  {arrangement:'wisp',family:'narrow',hue:.41,name:'Spirit flame',tag:'SLOW BURN',colour:'#7bf1dc',description:'A single slender cyan flame. Slower playback exposes the rising holes, separating tips and changing luminous core.'},
  {arrangement:'vortex',family:'narrow',hue:.69,name:'Violet spiral',tag:'UPWARD CURRENT',colour:'#c9a0ff',description:'Five violet flames orbit a rising column. Offset phases and circular motion create a twisting plume.'},
  {arrangement:'embers',family:'broad',hue:.86,name:'Rose firebed',tag:'LOW BURN',colour:'#ff9ac7',description:'A low, connected bed of rose-coloured fire. Overlapping source frames carry the rising motion within the flame itself.'},
];
