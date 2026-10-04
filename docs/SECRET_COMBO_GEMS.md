# Optional secret combo gems

The green plus is no longer required level furniture. No shipped level or
starter contains one. Old snapshots lose the former compulsory activator on
migration unless their author explicitly opts into a secret challenge.
The world-map card and Level Select show crystal, box gem and time medal;
combo gems do not contribute to the standard gem quota or 100% completion.
Existing `comboGem` save flags remain intact.

## Author a challenge case by case

Set `secretComboGem: true` on the level and add one `comboorb` component with
`p: [x, supportedDeckY, z]`. Placing the component through the editor opts in
automatically. Move it wherever the secret should begin; it does not need to
be near spawn. At most one activator is retained. Removing it is allowed and
does not regenerate it, even if the metadata remains enabled. The opt-in
survives copy, export, import and runtime capture. Bonus, hub, skatepark and
competition rules still exclude challenge activators.

Touching the plus uses the retained Player/Level plumbing: it starts the
challenge, hides the activator, applies combo-run crate dress/boosts and makes
the green prize appear just before the finish gate. The player has 2.5 seconds
to start a combo, then must keep it alive to collect the prize. A broken chain
removes the prize and restarts after the existing failure beat. Death/restart
and level changes clear the temporary mode. Winning banks the combo, records
`comboGemEarned`, and uses the existing saved-award, earned-only HUD, result
model, halo and event hooks. The result's accessible reward name is “Secret
gem”. Normal skating combo scoring is unchanged.

No secret challenge is enabled by this retirement. A future level brief must
choose its own placement, supported traversal and discovery/presentation;
the generic map does not advertise an empty secret slot.
