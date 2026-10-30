# Clean-checkout release verification

Pages run [41071066668](https://github.com/kiranmatthews/Prototype-Fork/actions/runs/41071066668)
identified the approved cone-only model as locally present but ignored by Git.
The exact 3,483,528-byte asset now has an explicit production exception to the
old experiment ignore rule. Its SHA-256 matches the existing provenance:
`d413b5d213824e2ece0de719dd056e5958a835e5cfdb25235d90b9179a098e42`.

Every packaged public source and texture/image manifest source is tracked.
An isolated export of the 12,325 tracked/indexed files, excluding ignored local
assets and leaving Git submodules uninitialised as in Pages, passes build and
release-size validation. Five final asset hashes (including the cone) match the
previous validated local package. See build.json and the two raw logs in
logs.tar.gz. Gameplay source, tuning and tests are unchanged, so the completed
203-invocation full-suite result remains applicable.
