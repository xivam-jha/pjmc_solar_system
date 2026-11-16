# PJMC challenge gameplay

The compact glass chooser has four sequential Gold missions, six independent challenges and Free Flight. A separate Practice button teaches steering, acceleration, braking and collection in about 30 seconds without a countdown or damage. First-time pilots see this practice before their selected mission and can skip it. The joystick, Speed + and Brake remain unchanged.

| Card | Objective and feedback | Recovery and reward |
| --- | --- | --- |
| SOS Rescue | Recover any of three capsules in any order. Passengers visibly ride with the jet. Brake in the station docking ring to unload. | 180-second timer. Retry keeps rescued passengers and gives at least 60 seconds from the last checkpoint. Rescue Pearl livery. |
| Satellite Repair | Collect three parts; they appear installed on the satellite. Hold steady for six seconds as bent panels straighten and the repair light pulses. | Leaving or turning loses partial repair, not completed pickups. Engineer Blue livery. |
| Fragile Cargo | Pass two route beacons, then brake in a separate docking ring to unload. Fast turns above 5 game units/s strain cargo. The warning overrides route instructions. | Collisions damage cargo. Checkpoint restores route progress and at least 60 cargo integrity. Courier Gold livery. |
| Lost Signal | Follow increasing signal strength, faster/higher beeps and a scan pulse. Stop near the probe to recover data. | Manual eight-second hint with cooldown. After 18 seconds without improvement, a temporary direction hint appears automatically. Signal Violet livery. |
| Asteroid Samples | Scan each marked rock for 2.5 seconds. Read its composition and choose C, S or M; a scan alone does not finish the objective. | Incorrect classifications add a performance mistake and allow another attempt. Completed samples survive retry. Surveyor Copper livery. |
| Laser Link | Rotate mirrors in 45-degree steps. The outgoing beam is calculated from the incident direction and mirror normal. A top-view diagram shows the actual beam path, not an answer angle. Confirm each connection. | Wrong links add a performance mistake. Completed links survive retry. Relay Emerald livery. |

## Flight assistance

- Slow, steady interactions require speed <= 1.8 and angular speed < .45 rad/s. Pickups work within 3.4 world units; solid structures have separate docking positions with a 1.35-unit interaction radius. Cargo beacons use swept passage detection.
- Swept barriers prevent flying through solid stations, satellites, relays and marked rocks. Slow contact stops the jet; high-speed impacts damage it. The previous safe launch and planet recovery behavior remains.
- Arenas are above the orbital plane. Lunar Transfer is an overhead station challenge, not a simulated Moon landing. Distances, visible laser paths and timing are educational game abstractions.
- Up to nine moving rocks share irregular geometry. Hits grant 1.8 seconds of grace. Successful objectives save a position, orientation, completed targets and cargo checkpoint. Retry clears motion and adds three seconds of protection. Partial work resumes from the last completed objective.
- Settings, leaderboard, browser blur and hidden tabs pause an active flight. Closing an overlay leaves the game paused until Resume or Esc. Esc also closes a nested settings/diary view first. Mission instructions stay visible on small landscape layouts.
- Models and materials are shared within each arena and disposed on exit; no additional model or texture downloads are required.

## Rewards and records

Each completed mission and correct learning answer awards three stars once: ten missions, thirty stars maximum. The six challenge badges each unlock one distinct hull/trim/engine livery. Original paint choices remain available.

A completed flight also saves its latest performance and fastest time on this device, separated by student account. Gold medal requires no damage or puzzle mistakes. Silver allows up to 40 damage and two mistakes. Other completions earn Bronze. A checkpoint retry earns Bronze and cannot set a best time; cumulative damage and mistakes are retained. Best times are personal practice records, not an online competition or anti-cheat claim.

Stars/badges continue to sync through the trusted PHP parent. Photos, selected paint, training state and personal flight records stay in the browser. Existing progress is preserved.

## Hosting and validation

Use the updated `student/explore-universe.php` for the authenticated leaderboard pause bridge. Existing installations with the ten-mission records API do not need to change their database. The package also includes `universe-records.php` for installations upgrading from the four-mission API. No new SQL import or dashboard replacement is required for an existing installation.

Run `node --test tests/*.test.js` and `npm run build`. Coverage includes all six completion rules, any-order rescue, visible repair, docking, reflection geometry, classification, signal help, practice, warning priority, checkpoint persistence, medals, liveries, pause, original meteor recovery and authenticated account isolation. Additional DOM/controller checks exercise all six launches, Escape/settings/blur pause, recovery, mission tabs, quizzes and parent message validation. PHP files pass a PHP 7.4 syntax parser.

Actual mobile WebGL rendering and execution on the PHP/MySQL host still require a device/hosting check. Multiplayer, invitations and server-authoritative flight validation remain outside this update.
