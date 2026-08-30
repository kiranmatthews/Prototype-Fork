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
