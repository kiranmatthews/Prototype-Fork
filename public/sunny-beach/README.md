# Sunny Beachside Run

Beachside Run continues through a departure pier into all five Island Hopper
islands. The finish and crystal now sit on the last island. The standalone
Island Hopper destination and its Lagoon Relay bonus have been retired; old
Island Hopper links open the combined Beachside Run.

[Eight-view hero / playable / before gallery](gallery/index.html)

The hero images are generated art targets. Playable images are actual browser
captures at matching camera positions, using the full renderer with HUD hidden.

## Asset provenance

- Eight original hero renders, two model references and the sand albedo were
  created with the built-in ImageGen tool. Exact prompts and original image
  paths are retained in `docs/sunny-beach/prompts.json` and
  `tools/sunny-beach-assets/` in the source repository.
- `sunny-sandstone.glb`: Meshy task `01a13a19-8dee-76ab-9851-a018bc8690e7`,
  15 credits; 7,149 near / 1,572 distant triangles; 2K albedo; 1,010,312 bytes.
- `sunny-hibiscus.glb`: Meshy task `01a13a19-9f51-7715-8f0e-818e958dce87`,
  15 credits; 5,331 near / 1,172 distant triangles; 1K albedo; 617,752 bytes.
- Both models preserve the provider's LOD0 geometry and UVs. Blender adds a
  distant mesh and the packer compresses the atlas. The JSON manifests record
  dimensions and final hashes. Total Meshy use: **30 credits**.
- Palms and hanging flowers reuse the existing Coastal town Meshy kit;
  broadleaf plants reuse the Jungle kit; boards and ropes reuse the rustic
  Meshy boardwalk kit with a level-specific honey-oak colour treatment.

New model attribution: **Sunny sandstone and hibiscus — created with Meshy
from original ImageGen references for Kiran Matthews's Prototype Fork.**
These scenery models are conservatively distributed under CC BY 4.0, following
the repository's existing Meshy scenery attribution practice. Original Meshy
responses and source GLBs remain in the ignored local authoring directory;
no credentials or signed provider URLs are included in the web assets.

## Reproduce

Run `tools/sunny-beach-assets/meshy_jobs.py` for recorded jobs (submission is
idempotent), Blender with `tools/sunny-beach-assets/prepare.py`, then `pack.py`.
`package-gallery.py` packages the saved images without repainting gameplay.

Focused checks: `tools/test-sunny-beach.mjs`,
`tools/test-sunny-beach-browser.mjs <game URL> [--full]`, `check:levels`, and the
production build. The browser check uses `PLAYWRIGHT_MODULE` when supplied.
