"""Portable Principled materials; the maps and independent response survive the game export."""

from pathlib import Path
import bpy


class Library:
    def __init__(self, folder):
        self.folder = Path(folder)
        self.images = {}
        self.materials = {}

    def texture(self, family, kind):
        pair = (family, kind)
        if pair not in self.images:
            suffix = "jpg" if kind == "color" else "png"
            im = bpy.data.images.load(str(self.folder / f"{family}-{kind}.{suffix}"))
            im.name = family.title() + " | " + kind
            im.colorspace_settings.name = "sRGB" if kind == "color" else "Non-Color"
            im.pack()
            self.images[pair] = im
        return self.images[pair]

    def make(self, name, family, rough, spec=0.32, coat=0, sheen=0, normal=1, color=None):
        if name in self.materials:
            return self.materials[name]
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        mat.diffuse_color = (*(color or (0.72, 0.42, 0.21)), 1)
        bs = mat.node_tree.nodes.get("Principled BSDF")
        nodes = mat.node_tree.nodes
        link = mat.node_tree.links.new
        bs.inputs["Roughness"].default_value = rough
        bs.inputs["Specular IOR Level"].default_value = spec
        bs.inputs["Coat Weight"].default_value = coat
        bs.inputs["Coat Roughness"].default_value = max(0.14, rough * 0.77)
        bs.inputs["Sheen Weight"].default_value = sheen
        if family:
            tex = nodes.new("ShaderNodeTexImage")
            tex.image = self.texture(family, "color")
            tex.location = (-760, 250)
            tex.label = "Authored pigmentation"
            link(tex.outputs["Color"], bs.inputs["Base Color"])
            n = nodes.new("ShaderNodeTexImage")
            n.image = self.texture(family, "normal")
            n.location = (-760, -90)
            nmap = nodes.new("ShaderNodeNormalMap")
            nmap.location = (-205, -80)
            nmap.inputs["Strength"].default_value = normal
            link(n.outputs["Color"], nmap.inputs["Color"])
            link(nmap.outputs["Normal"], bs.inputs["Normal"])
            r = nodes.new("ShaderNodeTexImage")
            r.image = self.texture(family, "rough")
            r.location = (-760, -390)
            mul = nodes.new("ShaderNodeMath")
            mul.operation = "MULTIPLY"
            mul.inputs[1].default_value = rough
            mul.location = (-190, -370)
            link(r.outputs["Color"], mul.inputs[0])
            link(mul.outputs[0], bs.inputs["Roughness"])
        else:
            bs.inputs["Base Color"].default_value = (*color, 1)
        self.materials[name] = mat
        return mat

    def eye(self):
        mat = self.make(
            "Violet iris and sclera | cornea", None, 0.21, 0.36, 0.15, color=(0.97, 0.92, 0.90)
        )
        bs = mat.node_tree.nodes.get("Principled BSDF")
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = self.texture("iris", "color")
        tex.location = (-380, 220)
        mat.node_tree.links.new(tex.outputs["Color"], bs.inputs["Base Color"])
        return mat
