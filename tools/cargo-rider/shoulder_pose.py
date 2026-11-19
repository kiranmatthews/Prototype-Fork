"""Fair the deltoid and axillary folds in the calibrated arms-down pose."""

import numpy as np
from mathutils import Matrix
from mathutils.bvhtree import BVHTree
from reference_pose import reference_pose


def add_shoulder_correctives(bpy, rig):
    body = next(
        o
        for o in bpy.context.scene.objects
        if o.type == 'MESH' and o.vertex_groups.get('Island • Fitted tank, neck and midriff')
    )
    mesh = body.data
    reference_pose(rig, False)
    bpy.context.view_layer.update()
    ev = body.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    rest = np.empty(len(mesh.vertices) * 3, np.float32)
    mesh.vertices.foreach_get('co', rest)
    rest = rest.reshape(-1, 3)
    posed = np.empty_like(rest)
    ev.vertices.foreach_get('co', posed.ravel())
    island = {
        g.index: g.name.removeprefix('Island • ') for g in body.vertex_groups if g.name.startswith('Island • ')
    }
    labels = [[island[g.group] for g in v.groups if g.group in island] for v in mesh.vertices]
    skin = np.array([any(n.startswith(('Arm left', 'Arm right', 'Fitted tank')) for n in l) for l in labels])
    binding = np.array([any('bound knit' in n for n in l) for l in labels])
    edges = np.array([e.vertices[:] for e in mesh.edges])
    edges = edges[skin[edges].all(axis=1)]
    src, dst = np.concatenate([edges[:, 0], edges[:, 1]]), np.concatenate([edges[:, 1], edges[:, 0]])
    degree = np.maximum(1, np.bincount(src, minlength=len(rest)))
    matrices = {b.name: np.array((b.matrix @ b.bone.matrix_local.inverted()).to_3x3()) for b in rig.pose.bones}
    bone_groups = {g.index: matrices[g.name] for g in body.vertex_groups if g.name in matrices}
    skin_matrix = np.array(
        [
            sum((bone_groups[g.group] * g.weight for g in v.groups if g.group in bone_groups), np.zeros((3, 3)))
            for v in mesh.vertices
        ]
    )
    body.shape_key_add(name='Basis', from_mix=False)

    def ease(v):
        v = np.clip(v, 0, 1)
        return v * v * (3 - 2 * v)

    for sign, suffix in [(1, '.L'), (-1, '.R')]:
        x = sign * rest[:, 0]
        z = rest[:, 2]
        active = (
            skin
            * ease((x - 0.060) / 0.065)
            * ease((0.349 - x) / 0.074)
            * ease((z - 1.24) / 0.070)
            * ease((1.53 - z) / 0.050)
        )
        # Restrict the correction to the shoulder cap and the skin that rolls
        # into the axilla. Lower arm shafts, the breastbone and neck stay anchored.
        p = posed.astype(float)
        for step in range(112):
            avg = np.column_stack(
                [np.bincount(src, weights=p[dst, i], minlength=len(p)) / degree for i in range(3)]
            )
            rate = 0.55 if step % 3 != 2 else -0.46
            p += rate * (avg - p) * active[:, None]
        change = p - posed
        # Resew each nearby trim vertex to the deformation of the underlying knit.
        vertices = np.flatnonzero(skin & (active > 0.015))
        for i in np.flatnonzero(binding & (x > 0.041) & (z > 1.23)):
            dist = np.linalg.norm(rest[vertices] - rest[i], axis=1)
            ids = np.argpartition(dist, 5)[:6]
            if dist[ids].min() > 0.034:
                continue
            w = 1 / np.maximum(0.0012, dist[ids]) ** 2.7
            change[i] = np.average(change[vertices[ids]], weights=w, axis=0)
        # Fair the piping in the pose where the two axillary folds meet. Project
        # the rounded seam to the actual posed skin, then carry the neighbouring
        # fabric UVs through its tangential displacement. The rest mesh keeps
        # its sewn pattern for the player’s raised and extended arm poses.
        surface = posed + change
        polygons = [list(f.vertices) for f in mesh.polygons if np.all(skin[list(f.vertices)])]
        bvh = BVHTree.FromPolygons(surface.tolist(), polygons)
        guide, motion = [], []
        for name in ('Scoop neckline', 'Left armhole', 'Right armhole'):
            group = body.vertex_groups['Island • ' + name + ' | bound knit'].index
            ring = np.array(
                [v.index for v in mesh.vertices if any(g.group == group for g in v.groups)]
            ).reshape(7, -1)
            center = 0.5 * (surface[ring[0]] + surface[ring[3]])
            length = np.linalg.norm(np.roll(center, -1, axis=0) - center, axis=1)
            arc = np.r_[0, np.cumsum(length[:-1])]
            dist = abs(arc[:, None] - arc[None, :])
            dist = np.minimum(dist, length.sum() - dist)
            weights = np.exp(-0.5 * (dist / 0.024) ** 2)
            weights /= weights.sum(axis=1, keepdims=True)
            middle = weights @ center
            nearest = [bvh.find_nearest(q) for q in middle]
            normals = np.asarray([hit[1][:] for hit in nearest])
            projected = np.asarray([hit[0][:] for hit in nearest])
            up = surface[ring[0]] - surface[ring[3]]
            normals *= np.where(np.sum(up * normals, axis=1) < 0, -1.0, 1.0)[:, None]
            middle = projected + 0.0017 * normals
            tangent = np.roll(middle, -1, axis=0) - np.roll(middle, 1, axis=0)
            across = np.cross(normals, tangent)
            across /= np.maximum(0.00001, np.linalg.norm(across, axis=1, keepdims=True))
            across *= np.where(np.sum(across * (surface[ring[1]] - surface[ring[5]]), axis=1) < 0, -1.0, 1.0)[
                :, None
            ]
            factor = ease((sign * center[:, 0] - 0.020) / 0.058)
            delta = (middle - center) * factor[:, None]
            guide.extend(center)
            motion.extend(delta)
            for j, angle in enumerate(np.arange(7) * np.pi / 3):
                rounded = middle + np.cos(angle) * 0.00165 * normals + np.sin(angle) * 0.00445 * across
                change[ring[j]] += (rounded - surface[ring[j]]) * factor[:, None]
        guide, motion = np.array(guide), np.array(motion)
        for i in np.flatnonzero(skin & (x > 0.035) & (z > 1.22)):
            d2 = np.sum((guide - surface[i]) ** 2, axis=1)
            closest = d2.min()
            if closest < 0.047**2:
                w = np.exp(-0.5 * (d2 - closest) / 0.008**2)
                change[i] += np.average(motion, axis=0, weights=w) * np.exp(-0.5 * closest / 0.017**2)
        affected = np.linalg.norm(change, axis=1) > 1e-8
        local = np.zeros_like(change)
        local[affected] = np.linalg.solve(skin_matrix[affected], change[affected, :, None])[:, :, 0]
        key = 'ShoulderRelax' + suffix
        block = body.shape_key_add(name=key, from_mix=False)
        block.data.foreach_set('co', (rest + local).astype(np.float32).ravel())
        rig[key] = 0.0
        rig.id_properties_ui(key).update(
            min=0.0, max=1.0, description='Manual override for the arms-down deltoid corrective'
        )
        driver = block.driver_add('value').driver
        driver.type = 'SCRIPTED'
        v = driver.variables.new()
        v.name = 'manual'
        v.targets[0].id = rig
        v.targets[0].data_path = '["' + key + '"]'
        side = 'left' if sign > 0 else 'right'
        for prefix, bone in [('s', 'shoulder-'), ('e', 'elbow-')]:
            for axis in 'xyz':
                v = driver.variables.new()
                v.name = prefix + axis
                v.type = 'TRANSFORMS'
                t = v.targets[0]
                t.id = rig
                t.bone_target = bone + side
                t.transform_type = 'LOC_' + axis.upper()
                t.transform_space = 'WORLD_SPACE'
        length = 'max(.001,sqrt((ex-sx)**2+(ey-sy)**2+(ez-sz)**2))'
        driver.expression = (
            'max(manual,min(1,max(0,(.64-sqrt((ex-sx)**2)/'
            + length
            + ')/.35))*min(1,max(0,((sz-ez)/'
            + length
            + '-.60)/.27)))'
        )
    for bone in rig.pose.bones:
        bone.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


def install_chest_space(bpy, rig):
    """Read shoulder directions in chest coordinates, including through a whole-body turn."""
    helpers = bpy.data.collections.new('Rig • shoulder pose readers')
    bpy.context.scene.collection.children.link(helpers)

    def empty(name):
        obj = bpy.data.objects.new(name, None)
        helpers.objects.link(obj)
        obj.empty_display_size = 0.004
        obj.hide_render = True
        obj.hide_select = True
        return obj

    frame = empty('Chest coordinates')
    link = frame.constraints.new('CHILD_OF')
    link.target = rig
    link.subtarget = 'chest'
    link.inverse_matrix = rig.data.bones['chest'].matrix_local.inverted()
    for side, suffix in [('left', '.L'), ('right', '.R')]:
        targets = {}
        for key, bone in [('s', 'shoulder-'), ('e', 'elbow-')]:
            obj = empty(bone + side + ' • chest space')
            obj.parent = frame
            copy = obj.constraints.new('COPY_LOCATION')
            copy.target = rig
            copy.subtarget = bone + side
            targets[key] = obj
        for keys in bpy.data.shape_keys:
            anim = keys.animation_data
            if anim is None:
                continue
            for f in anim.drivers:
                if f.data_path != 'key_blocks["ShoulderRelax' + suffix + '"].value':
                    continue
                for v in f.driver.variables:
                    if v.type == 'TRANSFORMS':
                        t = v.targets[0]
                        t.id = targets[v.name[0]]
                        t.bone_target = ''
                        t.transform_space = 'LOCAL_SPACE'
    bpy.context.view_layer.update()
