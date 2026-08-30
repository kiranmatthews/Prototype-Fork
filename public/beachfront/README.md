# Stonecliff Bastion web bake

`stonecliff-bastion.glb` is the presentation-only web bake of the owner-supplied
Meshy `StonecliffBastion.fbx` used by Unity Beachfront Run. Gameplay collision
continues to use the continuous authored cliff proxy; the model is never used
as collision geometry.

The bake preserves all 2,270 source triangles, indexes repeated FBX corners,
embeds one 512 × 512 JPEG base-colour map, and replaces the large auxiliary PBR
maps with matte scalar values. It uses core glTF only—no Draco or Meshopt
decoder is required. Runtime shares one geometry/material pair across the exact
100 primary and 50 staggered backing transforms in 15 cullable route chunks.

Rebuild on macOS with:

```sh
node tools/bake-beachfront-cliff.mjs \
  /path/to/StonecliffBastion.fbx \
  /path/to/StonecliffBastion_BaseColor.png \
  public/beachfront/stonecliff-bastion.glb
```

Source revision:

- FBX SHA-256: `32d2ce8cd2324a20e14a07d8abdd9e878630f7c4b3ba121ee39c5db14d6e94d9`
- Base colour SHA-256: `ebd2c38a57c87b978bc2bb7af04af58cf39333d43f6ab576ffa3bd1b2ee7a62f`
- Original handoff: `Meshy_AI_Stonecliff_Bastion_0824224022_texture_fbx.zip`

## Attribution and licence

Stonecliff Bastion — model created with Meshy. Distributed here under
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

The source archive does not record which Meshy account tier generated the
model. CC BY 4.0 is therefore the deliberately conservative publication basis
until private ownership records establish broader rights.
