#!/usr/bin/env python3
"""Generate the WebGL2 CRT Guest shader bundle from the pinned Slang snapshot.

The checked-in Slang files are the complete selected fragment-stage source from
libretro/slang-shaders at PINNED_COMMIT.  Generation intentionally goes through
Vulkan SPIR-V (glslangValidator) and SPIRV-Cross before applying the small,
documented WebGL2 binding adaptations below.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path


PINNED_COMMIT = "a62d9cda9140294d22b6da5e4ff4187365890d42"
ADVANCED_PRESET_SHA256 = (
    "eb597473e15639e9dec4f11a18d4a789f5f901e9368816d4e5114b09b51c2d19"
)
HD_PRESET_SHA256 = (
    "1cf2a61bce42a6fd6679f3bbf50b0a94194dcf7e498b6b3abdf9572aefcc7e40"
)
LUT_SHA256 = {
    "trinitron-lut.png":
        "bcc8c237eb39ed2a632554959cb4c5e0dd52b59a4922745b46b7525fc6b6b61a",
    "inv-trinitron-lut.png":
        "2acb6633e4dede7f36e3e62b7aa9d0ed76ecfbc5cb7ed7f3f8813dddec0e9145",
    "nec-lut.png":
        "86ec3d2e21138845cb73500e915425582b991e173a4149fa192a62d798382b59",
    "ntsc-lut.png":
        "a23ae9d27d6d5f9073d4a84678187f54758b329387c47686294ea979dcde6d03",
}


@dataclass(frozen=True)
class Stage:
    variant: str
    key: str
    name: str
    source: str
    linear_sampling: bool


STAGES = (
    Stage("advanced", "stock", "Stock", "advanced/stock.slang", False),
    Stage(
        "advanced", "afterglow", "Afterglow",
        "advanced/afterglow0.slang", False,
    ),
    Stage(
        "advanced", "pre", "PreShader",
        "advanced/pre-shaders-afterglow.slang", False,
    ),
    Stage(
        "advanced", "variant4", "AverageLuminance",
        "advanced/avg-lum.slang", True,
    ),
    Stage(
        "advanced", "variant5", "Linearize",
        "advanced/linearize.slang", True,
    ),
    Stage(
        "advanced", "gaussianHorizontal", "GaussianHorizontal",
        "advanced/gaussian_horizontal.slang", True,
    ),
    Stage(
        "advanced", "gaussianVertical", "GaussianVertical",
        "advanced/gaussian_vertical.slang", True,
    ),
    Stage(
        "advanced", "bloomHorizontal", "BloomHorizontal",
        "advanced/bloom_horizontal.slang", True,
    ),
    Stage(
        "advanced", "bloomVertical", "BloomVertical",
        "advanced/bloom_vertical.slang", True,
    ),
    Stage(
        "advanced", "main", "Main",
        "advanced/crt-guest-advanced.slang", True,
    ),
    Stage(
        "advanced", "deconvergence", "Deconvergence",
        "advanced/deconvergence.slang", True,
    ),
    Stage("hd", "stock", "Stock", "hd/stock.slang", False),
    Stage("hd", "afterglow", "Afterglow", "hd/afterglow0.slang", False),
    Stage(
        "hd", "pre", "PreShader",
        "hd/pre-shaders-afterglow.slang", False,
    ),
    Stage("hd", "variant4", "Linearize", "hd/linearize-hd.slang", True),
    Stage(
        "hd", "variant5", "Reconstruction",
        "hd/crt-guest-advanced-hd-pass1.slang", True,
    ),
    Stage(
        "hd", "gaussianHorizontal", "GaussianHorizontal",
        "hd/gaussian_horizontal.slang", True,
    ),
    Stage(
        "hd", "gaussianVertical", "GaussianVertical",
        "hd/gaussian_vertical.slang", True,
    ),
    Stage(
        "hd", "bloomHorizontal", "BloomHorizontal",
        "hd/bloom_horizontal.slang", True,
    ),
    Stage(
        "hd", "bloomVertical", "BloomVertical",
        "hd/bloom_vertical.slang", True,
    ),
    Stage(
        "hd", "main", "Main",
        "hd/crt-guest-advanced-hd-pass2.slang", True,
    ),
    Stage(
        "hd", "deconvergence", "Deconvergence",
        "hd/deconvergence-hd.slang", True,
    ),
)


SAMPLE_HELPERS = r"""
float crtGuestInsideUv(vec2 uv)
{
    vec2 insideLow = step(vec2(0.0), uv);
    vec2 insideHigh = step(uv, vec2(1.0));
    return insideLow.x * insideLow.y * insideHigh.x * insideHigh.y;
}

vec4 crtGuestSamplePointBorder(sampler2D textureObject, vec2 uv, float lod)
{
    int lodLevel = max(int(floor(lod + 0.5)), 0);
    ivec2 levelSize = textureSize(textureObject, lodLevel);
    ivec2 texel = ivec2(floor(clamp(uv, 0.0, 1.0) * vec2(levelSize)));
    texel = clamp(texel, ivec2(0), levelSize - ivec2(1));
    return texelFetch(textureObject, texel, lodLevel) * crtGuestInsideUv(uv);
}

vec4 crtGuestSampleLinearBorder(sampler2D textureObject, vec2 uv, float lod)
{
    return textureLod(textureObject, clamp(uv, 0.0, 1.0), lod)
        * crtGuestInsideUv(uv);
}
""".strip()


FULLSCREEN_VERTEX_SHADER = r"""#version 300 es
precision highp float;
precision highp int;

in vec3 position;
in vec2 uv;
out vec2 vTexCoord;

void main()
{
    vTexCoord = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
}
"""


LINEAR_TO_GUEST_SRGB = r"""#version 300 es
precision highp float;
precision highp int;

uniform sampler2D Source;
in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

float crtGuestInsideUv(vec2 uv)
{
    vec2 insideLow = step(vec2(0.0), uv);
    vec2 insideHigh = step(uv, vec2(1.0));
    return insideLow.x * insideLow.y * insideHigh.x * insideHigh.y;
}

vec4 crtGuestSampleLinearBorder(sampler2D textureObject, vec2 uv, float lod)
{
    return textureLod(textureObject, clamp(uv, 0.0, 1.0), lod)
        * crtGuestInsideUv(uv);
}

vec3 crtGuestLinearToSrgb(vec3 color)
{
    vec3 linearPart = color * 12.92;
    vec3 powerPart = 1.055 * pow(max(color, 0.0), vec3(1.0 / 2.4)) - 0.055;
    return mix(
        powerPart,
        linearPart,
        vec3(lessThanEqual(color, vec3(0.0031308)))
    );
}

void main()
{
    vec4 color = crtGuestSampleLinearBorder(Source, vTexCoord, 0.0);
    color.rgb = crtGuestLinearToSrgb(max(color.rgb, 0.0));
    FragColor = clamp(color, 0.0, 1.0);
}
"""


GUEST_SRGB_TO_LINEAR = r"""#version 300 es
precision highp float;
precision highp int;

uniform sampler2D Source;
in vec2 vTexCoord;
layout(location = 0) out vec4 FragColor;

float crtGuestInsideUv(vec2 uv)
{
    vec2 insideLow = step(vec2(0.0), uv);
    vec2 insideHigh = step(uv, vec2(1.0));
    return insideLow.x * insideLow.y * insideHigh.x * insideHigh.y;
}

vec4 crtGuestSampleLinearBorder(sampler2D textureObject, vec2 uv, float lod)
{
    return textureLod(textureObject, clamp(uv, 0.0, 1.0), lod)
        * crtGuestInsideUv(uv);
}

vec3 crtGuestSrgbToLinear(vec3 color)
{
    vec3 linearPart = color / 12.92;
    vec3 powerPart = pow((max(color, 0.0) + 0.055) / 1.055, vec3(2.4));
    return mix(
        powerPart,
        linearPart,
        vec3(lessThanEqual(color, vec3(0.04045)))
    );
}

void main()
{
    vec4 color = crtGuestSampleLinearBorder(Source, vTexCoord, 0.0);
    color.rgb = crtGuestSrgbToLinear(clamp(color.rgb, 0.0, 1.0));
    FragColor = color;
}
"""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="Verify checked-in output without rewriting it.",
    )
    parser.add_argument(
        "--glslang",
        default=shutil.which("glslangValidator") or "glslangValidator",
    )
    parser.add_argument(
        "--spirv-cross",
        default=shutil.which("spirv-cross") or "spirv-cross",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_snapshot(project_root: Path, upstream_root: Path) -> None:
    checksum_manifest = upstream_root.parent / "UPSTREAM-SHA256SUMS.txt"
    manifest_entries: dict[str, str] = {}
    for line in checksum_manifest.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        expected, relative = line.split(maxsplit=1)
        relative = relative.strip()
        manifest_entries[relative] = expected
        path = upstream_root.parent / relative
        actual = sha256(path)
        if actual != expected:
            raise RuntimeError(
                f"Pinned upstream checksum mismatch for {relative}: {actual}"
            )
        public_relative = relative.removeprefix("upstream/")
        public_source = (
            project_root
            / "public/crt-guest/provenance/UpstreamSource"
            / public_relative
        )
        public_actual = sha256(public_source)
        if public_actual != expected:
            raise RuntimeError(
                "Published corresponding-source checksum mismatch for "
                f"{public_relative}: {public_actual}"
            )

    expected_presets = {
        "crt-guest-advanced.slangp": ADVANCED_PRESET_SHA256,
        "crt-guest-advanced-hd.slangp": HD_PRESET_SHA256,
    }
    for name, expected in expected_presets.items():
        actual = sha256(upstream_root / name)
        if actual != expected:
            raise RuntimeError(f"Pinned preset checksum mismatch for {name}: {actual}")

    for name, expected in LUT_SHA256.items():
        path = project_root / "public/crt-guest/lut" / name
        actual = sha256(path)
        if actual != expected:
            raise RuntimeError(f"Pinned LUT checksum mismatch for {name}: {actual}")

    missing = [stage.source for stage in STAGES if not (upstream_root / stage.source).is_file()]
    if missing:
        raise RuntimeError("Missing pinned Slang stages: " + ", ".join(missing))
    expected_source_entries = {
        "upstream/" + stage.source for stage in STAGES
    } | {
        "upstream/crt-guest-advanced.slangp",
        "upstream/crt-guest-advanced-hd.slangp",
    }
    if set(manifest_entries) != expected_source_entries:
        raise RuntimeError("UPSTREAM-SHA256SUMS.txt does not cover the exact snapshot.")


def run(command: list[str], *, stdin: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        input=stdin,
        text=True,
        check=True,
        capture_output=True,
    )


def split_fragment_stage(source: str) -> str:
    common: list[str] = []
    vertex: list[str] = []
    fragment: list[str] = []
    destination = common
    for line in source.splitlines():
        if line.startswith("#pragma stage vertex"):
            destination = vertex
            continue
        if line.startswith("#pragma stage fragment"):
            destination = fragment
            continue
        destination.append(line)
    if not fragment:
        raise RuntimeError("Slang source has no fragment stage.")
    result = "\n".join(common + fragment) + "\n"
    # Pinned upstream typo: these are push constants, not members of the MVP UBO.
    result = result.replace("global.VSHARPNESS", "params.VSHARPNESS")
    result = result.replace("global.SIGMA_VER", "params.SIGMA_VER")
    return result


def find_call_end(source: str, opening: int) -> int:
    depth = 0
    for index in range(opening, len(source)):
        character = source[index]
        if character == "(":
            depth += 1
        elif character == ")":
            depth -= 1
            if depth == 0:
                return index
    raise RuntimeError("Unbalanced shader call.")


def split_arguments(arguments: str) -> list[str]:
    result: list[str] = []
    start = 0
    depth = 0
    for index, character in enumerate(arguments):
        if character in "([<{":
            depth += 1
        elif character in ")]>}":
            depth -= 1
        elif character == "," and depth == 0:
            result.append(arguments[start:index].strip())
            start = index + 1
    result.append(arguments[start:].strip())
    return result


def bound_do_while_loops(source: str) -> str:
    """Give every upstream radius loop the same 512-iteration bound as Unity."""
    search_from = 0
    loop_index = 0
    while True:
        match = re.search(r"\bdo\s*\{", source[search_from:])
        if match is None:
            return source
        start = search_from + match.start()
        opening_brace = source.find("{", start)
        depth = 0
        closing_brace = -1
        for index in range(opening_brace, len(source)):
            if source[index] == "{":
                depth += 1
            elif source[index] == "}":
                depth -= 1
                if depth == 0:
                    closing_brace = index
                    break
        if closing_brace < 0:
            raise RuntimeError("Unbalanced generated do/while loop.")
        tail = closing_brace + 1
        while tail < len(source) and source[tail].isspace():
            tail += 1
        if not source.startswith("while", tail):
            search_from = closing_brace + 1
            continue
        condition_open = source.find("(", tail + len("while"))
        condition_close = find_call_end(source, condition_open)
        semicolon = source.find(";", condition_close)
        body = source[opening_brace + 1:closing_brace]
        condition = source[condition_open + 1:condition_close].strip()
        iterator = f"crtGuestLoop{loop_index}"
        replacement = (
            f"for (int {iterator} = 0; {iterator} < 512; ++{iterator})\n"
            "    {"
            + body
            + f"\n        if (!({condition}))\n            break;\n    }}"
        )
        source = source[:start] + replacement + source[semicolon + 1:]
        search_from = start + len(replacement)
        loop_index += 1


def cross_compile(
    source: str,
    glslang: str,
    spirv_cross: str,
    temporary: Path,
) -> str:
    source_path = temporary / "source.frag"
    spirv_path = temporary / "source.spv"
    output_path = temporary / "source.webgl.frag"
    source_path.write_text(source, encoding="utf-8")
    run([
        glslang,
        "-S", "frag",
        "-V",
        "--target-env", "vulkan1.1",
        "-o", str(spirv_path),
        str(source_path),
    ])
    run([
        spirv_cross,
        str(spirv_path),
        "--es",
        "--version", "300",
        "--output", str(output_path),
    ])
    return output_path.read_text(encoding="utf-8")


def parse_block_declarations(body: str, prefix: str) -> tuple[str, list[str]]:
    body = re.sub(r"/\*.*?\*/", "", body, flags=re.DOTALL)
    body = re.sub(r"//[^\n]*", "", body)
    declarations: list[str] = []
    names: list[str] = []
    for raw_statement in body.split(";"):
        statement = " ".join(raw_statement.split())
        if not statement:
            continue
        match = re.fullmatch(
            r"(?:(lowp|mediump|highp)\s+)?"
            r"(float|uint|int|vec2|vec3|vec4|ivec2|ivec3|ivec4|mat3|mat4)\s+(.+)",
            statement,
        )
        if match is None:
            raise RuntimeError(f"Unsupported uniform declaration: {statement}")
        precision, value_type, declarators = match.groups()
        for declarator in split_arguments(declarators):
            name_match = re.fullmatch(r"([A-Za-z_]\w*)", declarator)
            if name_match is None:
                raise RuntimeError(f"Unsupported uniform declarator: {declarator}")
            name = name_match.group(1)
            output_type = "float" if name == "FrameCount" and value_type == "uint" else value_type
            output_precision = precision or ("highp" if output_type != "int" else "highp")
            declarations.append(
                f"uniform {output_precision} {output_type} {prefix}{name};"
            )
            names.append(name)
    return "\n".join(declarations), names


def flatten_uniform_structs(source: str) -> str:
    push_pattern = re.compile(
        r"struct\s+Push\s*\{(?P<body>.*?)\}\s*;\s*"
        r"uniform\s+Push\s+params\s*;",
        flags=re.DOTALL,
    )
    push_match = push_pattern.search(source)
    if push_match is None:
        raise RuntimeError("SPIRV-Cross output has no params Push uniform.")
    push_declarations, push_names = parse_block_declarations(
        push_match.group("body"), "uParams_"
    )
    source = source[:push_match.start()] + push_declarations + source[push_match.end():]
    for name in push_names:
        source = re.sub(
            rf"\bparams\.{re.escape(name)}\b",
            "uParams_" + name,
            source,
        )

    global_pattern = re.compile(
        r"layout\s*\([^)]*std140[^)]*\)\s*uniform\s+UBO\s*"
        r"\{(?P<body>.*?)\}\s*global\s*;",
        flags=re.DOTALL,
    )
    global_match = global_pattern.search(source)
    if global_match is not None:
        global_declarations, global_names = parse_block_declarations(
            global_match.group("body"), "uGlobal_"
        )
        source = (
            source[:global_match.start()]
            + global_declarations
            + source[global_match.end():]
        )
        for name in global_names:
            source = re.sub(
                rf"\bglobal\.{re.escape(name)}\b",
                "uGlobal_" + name,
                source,
            )

    if "params." in source or "global." in source:
        raise RuntimeError("A params/global aggregate reference survived flattening.")
    return source


def replace_texture_calls(source: str, linear_sampling: bool) -> str:
    samplers = set(re.findall(
        r"uniform\s+(?:lowp\s+|mediump\s+|highp\s+)?sampler2D\s+(\w+)\s*;",
        source,
    ))
    if not samplers:
        raise RuntimeError("Generated fragment has no sampler2D uniform.")

    for function_name, expected_count in (("textureLod", 3), ("texture", 2)):
        needle = function_name + "("
        cursor = 0
        while True:
            start = source.find(needle, cursor)
            if start < 0:
                break
            opening = start + len(function_name)
            end = find_call_end(source, opening)
            arguments = split_arguments(source[opening + 1:end])
            if len(arguments) != expected_count or arguments[0] not in samplers:
                cursor = end + 1
                continue
            sampler = arguments[0]
            uv = arguments[1]
            lod = arguments[2] if expected_count == 3 else "0.0"
            use_linear = linear_sampling or sampler.startswith("SamplerLUT")
            helper = (
                "crtGuestSampleLinearBorder"
                if use_linear
                else "crtGuestSamplePointBorder"
            )
            replacement = f"{helper}({sampler}, {uv}, {lod})"
            source = source[:start] + replacement + source[end + 1:]
            cursor = start + len(replacement)

    # Inject after precision declarations, before any uniforms/functions.
    precision_matches = list(re.finditer(r"^precision\s+[^;]+;\s*$", source, re.MULTILINE))
    if not precision_matches:
        raise RuntimeError("Generated fragment has no precision declaration.")
    insertion = precision_matches[-1].end()
    source = source[:insertion] + "\n\n" + SAMPLE_HELPERS + "\n" + source[insertion:]
    return source


def finalize_fragment(source: str, stage: Stage, source_digest: str) -> str:
    source = source.replace("precision mediump float;", "precision highp float;")
    source = flatten_uniform_structs(source)
    source = replace_texture_calls(source, stage.linear_sampling)
    banner = (
        "// AUTO-GENERATED. DO NOT HAND EDIT.\n"
        f"// WebGL2 translation of {stage.source}\n"
        f"// libretro/slang-shaders @ {PINNED_COMMIT}\n"
        f"// Source SHA-256: {source_digest}\n"
        "// Copyright (C) 2018-2025 guest(r), GPL-2.0-or-later.\n"
        "// See /crt-guest/provenance/THIRD-PARTY-NOTICES.md.\n"
    )
    version_end = source.find("\n") + 1
    source = source[:version_end] + banner + source[version_end:]
    source = "\n".join(line.rstrip() for line in source.splitlines()) + "\n"
    if re.search(r"\bdo\s*\{", source) or re.search(r"\bwhile\s*\(", source):
        raise RuntimeError(f"Unbounded loop survived in {stage.variant}/{stage.key}.")
    return source


def validate_shader(shader: str, glslang: str, label: str) -> None:
    try:
        run([glslang, "--stdin", "-S", "frag"], stdin=shader)
    except subprocess.CalledProcessError as exception:
        raise RuntimeError(
            f"WebGL GLSL validation failed for {label}:\n"
            + exception.stdout
            + exception.stderr
        ) from exception


def validate_vertex(shader: str, glslang: str, label: str) -> None:
    try:
        run([glslang, "--stdin", "-S", "vert"], stdin=shader)
    except subprocess.CalledProcessError as exception:
        raise RuntimeError(
            f"WebGL GLSL validation failed for {label}:\n"
            + exception.stdout
            + exception.stderr
        ) from exception


def output_filename(stage: Stage) -> str:
    key = re.sub(r"([a-z0-9])([A-Z])", r"\1-\2", stage.key).lower()
    return f"{stage.variant}/{key}.frag.glsl"


def ts_identifier(stage: Stage) -> str:
    key = stage.key[0].upper() + stage.key[1:]
    variant = stage.variant[0].upper() + stage.variant[1:]
    return f"crtGuest{variant}{key}Fragment"


def generate_typescript() -> str:
    lines = ["// AUTO-GENERATED by tools/crt-guest-web/generate.py. DO NOT EDIT."]
    for stage in STAGES:
        lines.append(
            f'import {ts_identifier(stage)} from "./{output_filename(stage)}?raw";'
        )
    lines.extend([
        'import crtGuestFullscreenVertex from "./fullscreen.vert.glsl?raw";',
        'import crtGuestLinearToSrgb from "./linear-to-guest-srgb.frag.glsl?raw";',
        'import crtGuestSrgbToLinear from "./guest-srgb-to-linear.frag.glsl?raw";',
        "",
        f'export const CRT_GUEST_UPSTREAM_COMMIT = "{PINNED_COMMIT}" as const;',
        "",
        "const forThreeRawShaderMaterial = (source: string): string =>",
        '  source.replace(/^#version 300 es\\s*\\n/, "");',
        "",
        "// Three prepends its own version line when RawShaderMaterial.glslVersion is GLSL3.",
        "export const CRT_GUEST_FULLSCREEN_VERTEX_SHADER =",
        "  forThreeRawShaderMaterial(crtGuestFullscreenVertex);",
        "export const CRT_GUEST_STANDALONE_FULLSCREEN_VERTEX_SHADER =",
        "  crtGuestFullscreenVertex;",
        "",
        "export const CRT_GUEST_CONVERSION_SHADERS = {",
        "  linearToGuestSrgb: forThreeRawShaderMaterial(crtGuestLinearToSrgb),",
        "  guestSrgbToLinear: forThreeRawShaderMaterial(crtGuestSrgbToLinear),",
        "} as const;",
        "",
        "export const CRT_GUEST_STANDALONE_CONVERSION_SHADERS = {",
        "  linearToGuestSrgb: crtGuestLinearToSrgb,",
        "  guestSrgbToLinear: crtGuestSrgbToLinear,",
        "} as const;",
        "",
        "export const CRT_GUEST_SHADERS = {",
    ])
    for variant in ("advanced", "hd"):
        lines.append(f"  {variant}: {{")
        for stage in (value for value in STAGES if value.variant == variant):
            lines.append(
                f"    {stage.key}: forThreeRawShaderMaterial({ts_identifier(stage)}),"
            )
        lines.append("  },")
    lines.extend(["} as const;", "", "export const CRT_GUEST_STANDALONE_SHADERS = {"])
    for variant in ("advanced", "hd"):
        lines.append(f"  {variant}: {{")
        for stage in (value for value in STAGES if value.variant == variant):
            lines.append(f"    {stage.key}: {ts_identifier(stage)},")
        lines.append("  },")
    lines.extend(["} as const;", "", "export const CRT_GUEST_STAGE_NAMES = {"])
    for variant in ("advanced", "hd"):
        lines.append(f"  {variant}: {{")
        for stage in (value for value in STAGES if value.variant == variant):
            lines.append(f'    {stage.key}: "{stage.name}",')
        lines.append("  },")
    lines.extend(["} as const;", "", "export const CRT_GUEST_STAGE_SAMPLING = {"])
    for variant in ("advanced", "hd"):
        lines.append(f"  {variant}: {{")
        for stage in (value for value in STAGES if value.variant == variant):
            mode = "linear" if stage.linear_sampling else "point"
            lines.append(f'    {stage.key}: "{mode}",')
        lines.append("  },")
    lines.extend([
        "} as const;",
        "",
        "export type CrtGuestGeneratedVariant = keyof typeof CRT_GUEST_SHADERS;",
        "export type CrtGuestGeneratedStage = keyof typeof CRT_GUEST_SHADERS.advanced;",
        "",
    ])
    return "\n".join(lines)


def write_or_check(path: Path, contents: str, check: bool) -> None:
    if check:
        if not path.is_file() or path.read_text(encoding="utf-8") != contents:
            raise RuntimeError(f"Generated output is stale: {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.read_text(encoding="utf-8") == contents:
        return
    path.write_text(contents, encoding="utf-8")


def main() -> None:
    args = parse_args()
    script_root = Path(__file__).resolve().parent
    project_root = script_root.parents[1]
    upstream_root = script_root / "upstream"
    output_root = project_root / "src/crt-guest/generated"
    verify_snapshot(project_root, upstream_root)

    emitted: dict[str, str] = {}
    for stage in STAGES:
        path = upstream_root / stage.source
        original = path.read_text(encoding="utf-8")
        fragment = bound_do_while_loops(split_fragment_stage(original))
        with tempfile.TemporaryDirectory(prefix="crt-guest-web-") as temporary_name:
            crossed = cross_compile(
                fragment,
                args.glslang,
                args.spirv_cross,
                Path(temporary_name),
            )
        generated = finalize_fragment(crossed, stage, hashlib.sha256(
            original.encode("utf-8")
        ).hexdigest())
        validate_shader(generated, args.glslang, f"{stage.variant}/{stage.key}")
        emitted[output_filename(stage)] = generated

    wrappers = {
        "fullscreen.vert.glsl": FULLSCREEN_VERTEX_SHADER,
        "linear-to-guest-srgb.frag.glsl": LINEAR_TO_GUEST_SRGB,
        "guest-srgb-to-linear.frag.glsl": GUEST_SRGB_TO_LINEAR,
    }
    validate_vertex(FULLSCREEN_VERTEX_SHADER, args.glslang, "fullscreen vertex")
    validate_shader(LINEAR_TO_GUEST_SRGB, args.glslang, "linear-to-sRGB wrapper")
    validate_shader(GUEST_SRGB_TO_LINEAR, args.glslang, "sRGB-to-linear wrapper")
    emitted.update(wrappers)
    emitted["shaders.ts"] = generate_typescript()

    for relative, contents in emitted.items():
        write_or_check(output_root / relative, contents, args.check)

    expected_paths = {output_root / relative for relative in emitted}
    actual_paths = {
        path for path in output_root.rglob("*")
        if path.is_file()
    }
    extras = sorted(actual_paths - expected_paths)
    if extras:
        raise RuntimeError(
            "Unexpected files in generated output: "
            + ", ".join(str(path) for path in extras)
        )

    action = "verified" if args.check else "generated"
    print(
        f"CRT Guest WebGL shaders {action}: "
        f"{len(STAGES)} canonical fragments + 2 conversion fragments."
    )


if __name__ == "__main__":
    main()
