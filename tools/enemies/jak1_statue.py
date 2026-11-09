"""Join Oracle's complete named background meshes to its attachment rig.

The character GLB contains a hidden helper quad. The visible statue is authored
as five named level meshes. This assembles that asset data without replacing or
simplifying any of the statue's geometry.
"""
import copy
import math


def attach_statue(source, background, actor, names):
    doc, other = source.doc, background.doc
    nodes = [copy.deepcopy(n) for n in other['nodes'] if n.get('name') in names]
    assert sorted(n['name'] for n in nodes) == sorted(names)
    assert all('mesh' in n and 'children' not in n for n in nodes)
    meshes = [copy.deepcopy(other['meshes'][n['mesh']]) for n in nodes]
    material_ids = sorted({p['material'] for m in meshes for p in m['primitives']})
    materials = [copy.deepcopy(other['materials'][i]) for i in material_ids]
    texture_ids = set()

    def textures(value, remap=None):
        if isinstance(value, dict):
            for key, child in value.items():
                if key.endswith('Texture') and isinstance(child, dict) and 'index' in child:
                    if remap is None:
                        texture_ids.add(child['index'])
                    else:
                        child['index'] = remap[child['index']]
                else:
                    textures(child, remap)
        elif isinstance(value, list):
            for child in value:
                textures(child, remap)

    textures(materials)
    image_ids = sorted({other['textures'][i]['source'] for i in texture_ids})
    image_map = {old: len(doc.get('images', [])) + i for i, old in enumerate(image_ids)}
    texture_map = {old: len(doc.get('textures', [])) + i for i, old in enumerate(sorted(texture_ids))}
    material_map = {old: len(doc.get('materials', [])) + i for i, old in enumerate(material_ids)}
    textures(materials, texture_map)
    buffer_offset, view_offset = len(doc['buffers']), len(doc['bufferViews'])
    accessor_offset, sampler_offset = len(doc['accessors']), len(doc.get('samplers', []))
    doc['buffers'].extend(copy.deepcopy(other['buffers']))
    source.buffers.extend(background.buffers)
    for view in other['bufferViews']:
        item = copy.deepcopy(view); item['buffer'] += buffer_offset
        doc['bufferViews'].append(item)
    for accessor in other['accessors']:
        item = copy.deepcopy(accessor)
        if 'bufferView' in item:
            item['bufferView'] += view_offset
        assert 'sparse' not in item
        doc['accessors'].append(item)
    for index in image_ids:
        item = copy.deepcopy(other['images'][index])
        if 'bufferView' in item:
            item['bufferView'] += view_offset
        else:
            assert item['uri'].startswith('data:')
        doc.setdefault('images', []).append(item)
    for index in sorted(texture_ids):
        item = copy.deepcopy(other['textures'][index]); item['source'] = image_map[item['source']]
        if 'sampler' in item:
            item['sampler'] += sampler_offset
        doc.setdefault('textures', []).append(item)
    doc.setdefault('samplers', []).extend(copy.deepcopy(other.get('samplers', [])))
    doc.setdefault('materials', []).extend(materials)
    for mesh in meshes:
        for primitive in mesh['primitives']:
            primitive['material'] = material_map[primitive['material']]
            primitive['indices'] += accessor_offset
            primitive['attributes'] = {k: v + accessor_offset for k, v in primitive['attributes'].items()}
            assert 'targets' not in primitive
    # The source helper quad is never the visible character in the game.
    for node in doc['nodes']:
        node.pop('mesh', None); node.pop('skin', None)
    doc['meshes'] = meshes
    first = len(doc['nodes'])
    for index, node in enumerate(nodes):
        node['mesh'] = index
        doc['nodes'].append(node)
    # Background vertices are in world metres. Put the complete assembly in
    # the actor's local frame with one parent transform; vertex bytes stay exact.
    x, y, z, w = actor['quat']; norm = math.sqrt(x*x+y*y+z*z+w*w)
    x, y, z, w = -x/norm, -y/norm, -z/norm, w/norm
    rotation = [[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)],
                [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)],
                [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]]
    shift = [-sum(row[i]*actor['trans'][i] for i in range(3)) for row in rotation]
    matrix = [rotation[row][column] for column in range(3) for row in range(3)]
    matrix = matrix[:3]+[0]+matrix[3:6]+[0]+matrix[6:]+[0]+shift+[1]
    root = len(doc['nodes'])
    doc['nodes'].append(dict(name='Oracle statue', matrix=matrix, children=list(range(first, root))))
    doc['scenes'][doc.get('scene', 0)]['nodes'].append(root)
