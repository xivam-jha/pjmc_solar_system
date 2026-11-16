# PJMC challenge roadmap

The mission chooser has two categories: four sequential Gold exploration missions and six independently selectable challenges. Free flight stays in Missions. Selection shows a short Hindi briefing, reward and launch button. Existing flight controls remain: joystick, Speed + and Brake. No multiplayer service is required.

| Card | Play loop | Challenge / recovery | Reward |
| --- | --- | --- | --- |
| SOS Rescue | Slowly recover three capsules, then unload at the rescue station | 180 seconds; moving debris reduces hull; retry starts a new rescue | Rescue Captain |
| Satellite Repair | Recover three spare parts, approach the satellite, hold steady for six seconds | Moving away/turning loses repair progress; debris damages hull | Space Engineer |
| Fragile Cargo | Follow two route beacons, then unload at Lunar Transfer Station | Fast turns above 5 game units/s strain cargo; collisions remove 20 integrity; zero fails | Careful Courier |
| Lost Signal | Follow increasing signal strength and recover probe data | No distant objective arrow; optional eight-second hint with cooldown; no countdown | Signal Seeker |
| Asteroid Samples | Scan marked C, S and M rocks one at a time | Three-second scan while slow and steady; moving debris damages hull | Rock Detective |
| Laser Link | Approach each relay, align antenna in 45-degree steps, confirm Link | Contextual dial appears only near a relay while steady; incorrect angles can be retried freely | Relay Architect |

## Interaction and presentation

- Scans, pickup, repair and unloading are automatic within 3.4 world units, at speed <= 1.8 and angular speed < .45 rad/s. Cargo route beacons use swept passage detection.
- Objectives are staged above the orbital plane, relative to the existing safe launch point. The Lunar Transfer Station is an overhead transfer challenge, not a simulated Moon landing. Distances, timing and visible laser guides are game abstractions.
- Capsules, spare crates, satellites with solar arrays, rocky samples and stations have distinct meshes. Only the current object is highlighted. No per-object lights, external models, or texture downloads are needed.
- Up to nine drifting rocks use shared irregular geometry and swept relative collision checks. Collisions grant 1.8 seconds of grace; docking areas remain clear of debris.
- A compact glass panel shows the current objective, health/cargo/signal, work progress and rescue clock. Only Lost Signal and Laser Link add contextual buttons.
- Pause/menu freezes simulation. Retry fully resets that challenge; exiting removes its scene resources. Existing Gold missions keep their meteor checkpoint recovery.
- Every learning question completed grants a unique badge and three stars once. Ten awards total thirty stars. Replays do not inflate the leaderboard.

## Progress and hosting

The game keeps old badges and pending awards. The PHP records allowlist contains the ten mission IDs; only the original four require the previous mission. Account/session, CSRF, origin, nonce and idempotency protections remain.

Upload both updated `student/explore-universe.php` and `student/universe-records.php` from the PHP package. Existing installations do not need a database migration: challenge IDs fit the current `VARCHAR(16)` mission key. Counts in the leaderboard are derived from the server's allowlist. Without the API update, new badges remain pending locally until the endpoint accepts them.

## Verification

Run `node --test tests/*.test.js` and `npm run build`. Tests cover all six objective rules, failures, pause/retry, safe placement, swept collision detection, classic mission regression, idempotent awards and account-isolated online synchronization. PHP syntax and UI DOM checks are separate local checks; actual hosting execution and physical mobile performance need verification after upload.

Not included: real-time multiplayer, invitations, a daily challenge service or server-authoritative flight validation.
