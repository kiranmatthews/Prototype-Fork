"""The relaxed shoulder stance and asymmetric glance in the supplied three-view portrait."""

import math
from mathutils import Matrix, Vector


def turn(bone, axis, degrees):
    basis = bone.bone.matrix_local.to_quaternion()
    rotation = Matrix.Rotation(math.radians(degrees), 3, axis).to_quaternion()
    bone.rotation_mode = 'QUATERNION'
    bone.rotation_quaternion = basis.inverted() @ rotation @ basis


def reference_pose(rig, portrait):
    for b in rig.pose.bones:
        b.matrix_basis = Matrix.Identity(4)
    for left in [True, False]:
        side = 'left' if left else 'right'
        sign = 1 if left else -1
        turn(rig.pose.bones['clavicle-' + side], Vector((0, 1, 0)), sign * 14)
        turn(rig.pose.bones['shoulder-' + side], Vector((0, 1, 0)), sign * 16)
        collar = rig.pose.bones['clavicle-' + side]
        collar.location = collar.bone.matrix_local.to_quaternion().inverted() @ Vector(
            (-sign * 0.031, 0.023, 0.006)
        )
    values = {
        'HairSweep.L': 0.98,
        'Smile.R': 0.38,
        'JawOpen': 0.012,
        'Smile.L': 0.035,
        'BrowUp.R': 0.16,
        'BrowDown.L': 0.07,
        'Squint.L': 0.22,
        'LookRight': 0.54,
        'LookDown': 0.12,
        'EarFold.L': 0.17,
        'EarFold.R': 0.43,
        'EarStretch.R': 0.98,
    }
    if portrait:
        turn(rig.pose.bones['chest'], Vector((0, 0, 1)), 14.0)
        turn(rig.pose.bones['neck'], Vector((0, 0, 1)), -14.0)
        turn(rig.pose.bones['head'], Vector((0, 1, 0)), 2.65)
    for k, v in values.items():
        if k in rig:
            rig[k] = v if portrait else 0.0
    for k in ('ShoulderRelax.L', 'ShoulderRelax.R'):
        if k in rig:
            rig[k] = 1.0
    rig.update_tag()


REFERENCE_VIEWS = [('three-quarter', -26, 3.5, 400), ('rear', 180, 0, 372), ('profile', 90, 0, 330)]


def place_camera(cam, az, pitch, u0):
    a, e = map(math.radians, (az, pitch))
    view = Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e)))
    right = Vector((math.cos(a), math.sin(a), 0))
    up = view.cross(right).normalized()
    center = Vector((0, 0.015, 1.542 + (538 - 362) * 0.00125)) + right * ((362 - u0) * 0.00125)
    cam.location = center + view * 4.5
    cam.rotation_euler = (-view).to_track_quat('-Z', 'Y').to_euler()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 724 * 0.00125
    return center, view, right, up


def portrait_lights(objects, frame):
    center, view, right, up = frame
    for light, offset, power, size in [
        ('Key softbox', (-2.6, 3.3, 3.5), 375, 3.4),
        ('Cool fill', (3.1, 2.8, 1.2), 135, 3.6),
        ('Rim', (1.3, -2.6, 2.7), 180, 3.6),
        ('Portrait bounce', (-0.65, 3.0, -1.45), 112, 3.8),
    ]:
        o = objects[light]
        o.location = center + right * offset[0] + view * offset[1] + up * offset[2]
        o.rotation_euler = (center - o.location).to_track_quat('-Z', 'Y').to_euler()
        o.data.energy = power
        o.data.size = size
