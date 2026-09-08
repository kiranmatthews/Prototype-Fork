"""Package fitted Meshy models and their exact source collision triangles."""
import importlib.util
import json
import sys
import struct
import hashlib
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('pack_modular',ROOT/'tools/jungle-kit/pack_modular.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.WORK=ROOT/'.img2threejs/nightworks-kit';engine.OUT=ROOT/'public/nightworks-kit';engine.OUT.mkdir(parents=True,exist_ok=True)
specs=json.loads((ROOT/'tools/nightworks-kit/module-specs.json').read_text())
chosen=[s for s in specs if not sys.argv[1:] or s['file'] in sys.argv[1:]]
manifest=engine.OUT/'manifest.json'
existing=json.loads(manifest.read_text()) if manifest.exists() else []
by_file={s['file']:s for s in existing}
for s in chosen:
    row=engine.pack(s)
    path=engine.OUT/(s['file']+'.glb');raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
    doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
    doc['asset']['generator']='Meshy T2 / fitted Nightworks floating rock kit'
    doc['asset']['extras'].update(normalizedCoordinates=True,nominalSizeMetres=s['size'],sizeMetres=[1,1,1])
    encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
    result=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
    path.write_bytes(result);row.update(bytes=len(result),sha256=hashlib.sha256(result).hexdigest())
    by_file[s['file']]=row
manifest.write_text(json.dumps(list(by_file.values()),indent=2)+'\n')
lines=['// Generated from tools/nightworks-kit/module-specs.json.','export const NIGHTWORKS_MODULES = {']
for s in specs:
    lines.append(s['kind']+':'+json.dumps({'file':'../nightworks-kit/'+s['file'],'label':s['label'],'size':s['size'],'wind':False,'normalStrength':s['normal'],'lod':True,'backdrop':s['file']=='distant-arch'},separators=(',',':'))+',')
lines.append('} as const;\nexport type NightworksKind = keyof typeof NIGHTWORKS_MODULES;\n')
(ROOT/'src/nightworksModules.ts').write_text('\n'.join(lines))
shapes={s['kind']:json.loads((engine.WORK/'modular-baked'/(s['file']+'-collision.json')).read_text()) for s in specs if s['flatTop'] and (engine.WORK/'modular-baked'/(s['file']+'-collision.json')).exists()}
(ROOT/'src/nightworksShapes.json').write_text(json.dumps(shapes,separators=(',',':'))+'\n')
print(json.dumps(list(by_file.values()),indent=2))
