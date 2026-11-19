"""Carry the animated cheek undertone into the GLB as vertex-color morphs."""

import json
import struct
import numpy as np


def write_color_morphs(path):
    with path.open('rb') as f:
        header = f.read(12)
        if header[:4] != b'glTF':
            raise ValueError('Invalid Blender GLB export')
        length, kind = struct.unpack('<I4s', f.read(8))
        document = json.loads(f.read(length))
        length, kind = struct.unpack('<I4s', f.read(8))
        binary = bytearray(f.read(length))
    accessors = document['accessors']
    views = document['bufferViews']
    tinted = [n['mesh'] for n in document['nodes'] if n.get('extras', {}).get('cargoCheekUndertone')]
    if len(tinted) != 1:
        raise ValueError('Expected one continuous facial skin')
    for idx in tinted:
        mesh = document['meshes'][idx]
        for primitive in mesh['primitives']:
            colour = accessors[primitive['attributes']['COLOR_0']]
            count = colour['count']
            dims = {'VEC3': 3, 'VEC4': 4}[colour['type']]
            dtype = np.dtype({5121: 'u1', 5123: '<u2', 5126: '<f4'}[colour['componentType']])
            view = views[colour['bufferView']]
            base = np.ndarray(
                (count, dims),
                dtype,
                binary,
                view.get('byteOffset', 0) + colour.get('byteOffset', 0),
                strides=(view.get('byteStride', dims * dtype.itemsize), dtype.itemsize),
            ).astype(float)
            if colour.get('normalized'):
                base /= np.iinfo(dtype).max
            rgba = np.zeros((count, 4), dtype='uint8')
            rgba[:, :3] = np.rint(np.clip(1 - base[:, :3], 0, 1) * 255)
            if rgba[:, :3].max() < 60:
                raise ValueError('Missing fitted cheek pigment')
            while len(binary) % 4:
                binary.append(0)
            views.append({'buffer': 0, 'byteOffset': len(binary), 'byteLength': rgba.nbytes, 'target': 34962})
            binary.extend(rgba.tobytes())
            metadata = {'componentType': 5121, 'count': count, 'type': 'VEC4', 'normalized': True}
            accessors.append({**metadata, 'bufferView': len(views) - 1})
            delta = len(accessors) - 1
            # An explicit zero accessor also supports loaders that substitute
            # the base attribute for an absent morph attribute.
            accessors.append(dict(metadata))
            zero = len(accessors) - 1
            names = mesh['extras']['targetNames']
            for name, target in zip(names, primitive['targets'], strict=True):
                target['COLOR_0'] = delta if name in ('MaskFit.puffer', 'Pose.puffer') else zero
    document['buffers'][0]['byteLength'] = len(binary)
    description = json.dumps(document, separators=(',', ':'), ensure_ascii=False).encode()
    description += b' ' * (-len(description) % 4)
    total = 28 + len(description) + len(binary)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(description), b'JSON'))
        f.write(description)
        f.write(struct.pack('<I4s', len(binary), b'BIN\0'))
        f.write(binary)


def install_source_shader(material, rig):
    tree = material.node_tree
    bs = tree.nodes.get('Principled BSDF')
    pigment = bs.inputs['Base Color'].links[0].from_socket
    tint = tree.nodes.new('ShaderNodeVertexColor')
    tint.layer_name = 'Cheek undertone'
    tint.location = (-630, 520)
    mix = tree.nodes.new('ShaderNodeMixRGB')
    mix.label = 'Down exposed by cheek inflation'
    mix.location = (-400, 500)
    tree.links.new(tint.outputs['Color'], mix.inputs[1])
    mix.inputs[2].default_value = (1, 1, 1, 1)
    driver = mix.inputs[0].driver_add('default_value').driver
    driver.type = 'MAX'
    for name in ('MaskFit.puffer', 'Pose.puffer'):
        binding = driver.variables.new()
        binding.targets[0].id = rig
        binding.targets[0].data_path = '["' + name + '"]'
    multiply = tree.nodes.new('ShaderNodeMixRGB')
    multiply.blend_type = 'MULTIPLY'
    multiply.inputs[0].default_value = 1
    multiply.location = (-100, 280)
    tree.links.new(pigment, multiply.inputs[1])
    tree.links.new(mix.outputs[0], multiply.inputs[2])
    tree.links.new(multiply.outputs[0], bs.inputs['Base Color'])
