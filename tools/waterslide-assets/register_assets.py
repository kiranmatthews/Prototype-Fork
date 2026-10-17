from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[2];HERE=Path(__file__).resolve().parent
manifest=json.loads((HERE/'asset-manifest.json').read_text())
lines=['/** Measured Meshy kit, rendered through the existing shared scenery pipeline. */','export const WATERSLIDE_ASSETS = {']
for name,v in manifest.items():
 key='waterslide'+name.replace('-','')
 lines.append(f"  {key}:{{file:'../waterslide/{name}',label:'Waterpark / {name.replace('-',' ')}',size:{json.dumps(v['size'])},wind:false,normalStrength:.2,lod:false,distanceLod:true,doubleSided:true,cellSize:70}},")
lines.append('} as const;\n')
(ROOT/'src/waterslideAssets.ts').write_text('\n'.join(lines))
