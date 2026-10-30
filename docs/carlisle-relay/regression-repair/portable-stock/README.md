# Portable stock snapshot certificates

Pages run [41073530678](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/41073530678)
built successfully but measured 1,007,910,103 bytes. Linux retained a 9,619,926-byte
Rooftop Relay snapshot because its certificate predated the pit-polygon repair.
Including sync provenance, the extra output was 9,619,950 bytes. Local exact
source equality had hidden the stale certificate.

The existing exact-data certification tool verified Sky and Rooftop Relay against
the complete current source entries. Only their two stale records were refreshed;
all other certificates and their recorded runtimes are preserved. No runtime
comparison tolerance, saved-snapshot hash rule, game source, geometry, art or
published level data changed.

The new regression fails with the stale certificates. It requires fresh exact
snapshot hashes for all stock courses and checks compaction with bounded runtime
roundoff across every course. Existing sub-nanometre edited-snapshot retention,
atomic saves, quota handling and import-security cases still pass. The sync file
contains both genuine overrides and omits 12 duplicate source entries (40,099
bytes). Build and the unchanged 1 GB release gate pass at 998,290,153 bytes.

See results.json and logs.tar.gz for the before/after regression, certification,
build and release output. The 203-command suite's gameplay/test inputs remain
unchanged; this additional focused release regression also passes. All five
previously reviewed packaged asset hashes are unchanged.
