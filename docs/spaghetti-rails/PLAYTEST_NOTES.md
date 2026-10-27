# Local playtest notes

- [New race](http://127.0.0.1:5237/?playtest&level=spaghetti-rails)
- [Preserved platformer](http://127.0.0.1:5237/?playtest&level=spaghetti-rails-platforming)

The platformer is the rejected compact course saved independently. Its original rail and platform geometry is intact, with ordinary checkpoints and a crystal finish. Race edits do not rewrite that source or its standalone editor JSON.

## Finding a fast line

The new race gives you a wide planning island before each of six huge chasms. Every whole rail reaches the next island. Missing a shortcut can cost time without ending the run: stay balanced and follow that thread to supported ground.

At the first island, the mint arrow is the second entrance from the left. It starts **Lace into the eye**, the fast combo's opening thread. The layout mirrors at some later islands, so follow the mint colour instead of memorising left or right. The source route names are useful in the editor; they are not a left-to-right numbering system.

Use the paired gold chevrons to spot the two deliberate transfer windows. Charge the jump while grinding, aim toward the nearby lower parallel thread, release the jump and catch again. The first switch reaches **Pretzel heart**; the second reaches **Needle-thread escape**. This skips the long loops that make those intact routes slower. Land on the next wide island, choose the mint entrance again, and repeat. The race's control panel shows the active device's grind, charge and balance controls.

The reference input run chains the course in 96.32 seconds. The independent keyboard run, including a recovered fall, finishes in 129.82 seconds. These are automated test results, not promised human times. Gold is 115 seconds, silver 155 and bronze 205. All eight native racers finish, and the rivals make actual balance mistakes rather than receiving immunity.

## Useful feedback

Review a transfer that felt unclear by naming the island, the arrow colour and the rail you caught. Note whether the problem was seeing the receiving thread, holding balance through the curve, lining up from the island or recovering after a miss. That separates a route-reading problem from a physical catch problem without changing the authored movement model.

For visual review, select MAX/native resolution. The recorded detailed checks use an actual 2560×1440 drawing buffer. Normal presentation was also checked at 1280×720. The editor intentionally removes play fog and shows camera/pit guides, so judge the cavern atmosphere in play mode.
