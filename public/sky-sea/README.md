# Sea-level sky artwork

Created with the built-in imagegen tool, using the existing `public/sky-coast.png` as the visual reference. Day/coast/clouds share `day.png`; sunset and night have matching lighting variants. Exact prompts, hashes and crop coordinates are in [provenance.json](provenance.json).

These sources contain sky and islands, with no painted sea. Their small generated footer is excluded on load: only the top **866 of 887 rows** become the texture. The cropped texture’s bottom edge maps to the actual sky dome’s bottom vertices at `water.seaLevel`.

The sea disk copies those same 96 edge segments and uses the same world transform and clip-depth convention. Both retain their actual 3D projected positions. The image is not anchored to the camera’s eye height; no fog covers the join. The dome follows horizontal camera movement while its vertical cut stays on the sea plane. Reflections intersect this same dome and reuse its texture.
