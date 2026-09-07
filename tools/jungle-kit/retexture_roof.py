"""Repaint the cleaned roof block with fresh UVs using the official Meshy CLI."""
import json
import fcntl
from pathlib import Path
import subprocess
from generate import ROOT, WORK, cli, ledger, save

# Share the generation lock so this repaint cannot race another credit reservation.
with (WORK / 'ledger.lock').open('w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    name='roof-wedge-texture2'
    data=ledger()
    if name in data['tasks']:
        print(data['tasks'][name])
        raise SystemExit(0)
    export_script=WORK/'export-roof-high.py'
    export_script.write_text('\n'.join([
        'import bpy',
        "bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)",
        f"bpy.ops.import_scene.gltf(filepath={str(WORK/'modular-baked/roof-wedge.glb')!r})",
        'for obj in bpy.context.scene.objects:',
        "    obj.select_set(obj.type=='MESH' and obj.name.endswith('LOD0'))",
        "bpy.context.view_layer.objects.active=next(o for o in bpy.context.selected_objects if o.type=='MESH')",
        f"bpy.ops.export_scene.gltf(filepath={str(WORK/'roof-wedge-clean.glb')!r},export_format='GLB',use_selection=True,export_animations=False)",
        '',
    ]))
    subprocess.run(['/Applications/Blender.app/Contents/MacOS/Blender','--background','--factory-startup','--python',str(export_script)],check=True,capture_output=True)
    balance=cli('balance')['balance']
    if data['reservedCredits']+10>data['budget'] or balance<36:raise RuntimeError('Credit ceiling reached')
    data['reservedCredits']+=10
    data['tasks'][name]={'credits':10,'resource':'retexture','state':'submitting','note':'Fresh UVs and textures for the cleaned modular roof; original panel contained an unpainted UV region.'}
    save(data)
    result=cli('retexture','create','--model-url',str(WORK/'roof-wedge-clean.glb'),
        '--image-style-url',str(ROOT/'tools/jungle-kit/references/modular/roof-wedge.png'),
        '--enable-original-uv','false','--enable-pbr','true','--texture-resolution','2k',
        '--target-formats','glb','--async')
    (WORK/(name+'-create.json')).write_text(json.dumps(result,indent=2))
    data['tasks'][name].update(id=result['task_id'],state=result['status']);data['lastBalance']=cli('balance')['balance'];save(data)
    print(name,result['task_id'],'balance',data['lastBalance'])
