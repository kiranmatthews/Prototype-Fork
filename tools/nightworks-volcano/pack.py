"""Package the fitted volcano with a mipmapped GPU atlas and portable fallback.
Uses the same exporter/packer as the first Nightworks kit.
"""
from pathlib import Path
import importlib.util, json, struct, hashlib
root=Path(__file__).resolve().parents[2]
work=root/'.img2threejs/nightworks-volcano'
path=work/'modular-baked/volcano.glb'
raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
# The detailed source already carries painted illumination. The volcano uses
# one unlit atlas plus a shader-derived red emission mask, so don't ship maps
# that the backdrop material cannot use.
for m in doc['materials']:
    m.pop('normalTexture',None);m.pop('emissiveTexture',None)
    m['pbrMetallicRoughness'].pop('metallicRoughnessTexture',None)
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary)
spec=importlib.util.spec_from_file_location('pack_modular',root/'tools/jungle-kit/pack_modular.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.WORK=work;engine.OUT=root/'public/nightworks-kit'
specification=json.loads((root/'tools/nightworks-volcano/module-specs.json').read_text())[0]
row=engine.pack(specification)
output_path=engine.OUT/'volcano.glb'
raw=output_path.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
doc['asset']['generator']='Meshy smart-topology / fitted Nightworks volcano'
doc['asset']['extras'].update(normalizedCoordinates=True,nominalSizeMetres=specification['size'],sizeMetres=[1,1,1])
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
output_path.write_bytes(output)
row.update(bytes=len(output),sha256=hashlib.sha256(output).hexdigest())
row['sourceTask']='01a12fca-0e85-746f-9197-d86fc83f3bb2';row['source']='Meshy smart-topology from original OpenAI imagegen reference'
(engine.OUT/'volcano.provenance.json').write_text(json.dumps(row,indent=2)+'\n')
print(json.dumps(row,indent=2))
