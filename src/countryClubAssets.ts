import type {JungleAssetSpec} from './jungleAssets';
export const COUNTRY_CLUB_ASSETS={
 countryoak:{file:'../country-club-art/oak',label:'Country Club sculpted oak',size:[18,10.98184,9.31545],wind:true,lod:true,distanceLod:true,cellSize:70,lodRange:[80,130],normalStrength:0,doubleSided:false},
 countryumbrellapine:{"file": "../country-club-art/umbrella-pine", "label": "Country Club sculpted umbrella pine", "size": [17.0, 12.61267, 16.07851], "wind": true, "lod": true, "distanceLod": true, "cellSize": 70, "lodRange": [95, 155], "normalStrength": 0, "doubleSided": false},
 // Locally baked transparent tree groups: two triangles per distant grove.
 countrywoodlanda:{file:'',image:'country-club-art/woodland-a-alpha.webp',label:'Country Club distant oak grove',size:[144,36,.02],wind:false,matte:true,alphaCutout:true,fog:true},
 countrywoodlandb:{file:'',image:'country-club-art/woodland-b-alpha.webp',label:'Country Club distant mixed woodland',size:[144,36,.02],wind:false,matte:true,alphaCutout:true,fog:true},
 countrywoodlandc:{file:'',image:'country-club-art/woodland-c-alpha.webp',label:'Country Club distant pine grove',size:[144,36,.02],wind:false,matte:true,alphaCutout:true,fog:true}
} as const satisfies Record<string,JungleAssetSpec>;
