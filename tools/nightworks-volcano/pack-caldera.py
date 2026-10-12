from pathlib import Path
import importlib.util,json,struct,hashlib
r=Path(__file__).resolve().parents[2]
work=r/'.img2threejs/nightworks-caldera'
spec=importlib.util.spec_from_file_location('packer',r/'tools/jungle-kit/pack_modular.py')
engine=importlib.util.module_from_spec(spec);spec.loader.exec_module(engine)
engine.WORK=work;engine.OUT=r/'public/nightworks-kit'
row=engine.pack(json.loads((r/'tools/nightworks-volcano/basalt-spec.json').read_text())[0])
p=engine.OUT/'caldera-basalt.glb';raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
doc=json.loads(raw[20:20+n]);binary=raw[28+n:]
doc['asset']['generator']='Meshy smart-topology / fitted Nightworks caldera basalt'
doc['asset']['extras'].update(normalizedCoordinates=True,nominalSizeMetres=row['size'],sizeMetres=[1,1,1])
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*(-len(encoded)%4)
output=struct.pack('<III',0x46546c67,2,28+len(encoded)+len(binary))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+struct.pack('<II',len(binary),0x004e4942)+binary
p.write_bytes(output)
row.update(bytes=len(output),sha256=hashlib.sha256(output).hexdigest(),sourceTask='01a131b3-ac23-7569-a42f-69df6f6bc052')
(engine.OUT/'caldera-basalt.provenance.json').write_text(json.dumps(row,indent=2)+'\n')
print(json.dumps(row,indent=2))
