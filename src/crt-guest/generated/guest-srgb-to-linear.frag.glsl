#version 300 es
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
