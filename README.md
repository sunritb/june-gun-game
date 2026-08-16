# JUNE GUN GAME — Technical Prototype

Browser-based FPS prototype built from the *June Gun Game* Executive Summary (PDF).
This is the **client-side combat core**: realistic ballistics, recoil, layered procedural audio,
wave combat, and a PC-oriented HUD. Networking / backend / monetization from the spec are
architectural recommendations, not implemented here (see PDF).

## Play

**Double-click `index.html`** — no server or install needed. Click **DEPLOY** to start
(mouse locks).

## Controls

| Input            | Action                              |
| ---------------- | ----------------------------------- |
| `W A S D`        | move                                |
| `Mouse`          | aim                                 |
| `LMB`            | fire (hold for auto weapons)        |
| `RMB`            | aim down sights (zoom)              |
| `R`              | reload                              |
| `1–4`            | Pistol / SMG / Assault Rifle / Sniper |
| `Space` / `Shift` / `C` | jump / sprint / crouch       |

## What's implemented (mapped to the spec)

- **Ballistics** (`src/weapons.js`): simulated projectile travel with gravity drop (9.81),
  per-weapon muzzle velocity, and **penetration** — bullets punch through wood crates
  (damage reduced) and stop on concrete.
- **Recoil** (`src/weapons.js`): camera pitch/yaw impulse per shot + smooth recovery,
  per-shot bloom that builds on sustained automatic fire, recoil scaled by ADS/movement.
- **Layered audio** (`src/audio.js`): every shot = muzzle "pop" + mechanical action clicks +
  reverb "tail", randomized per shot; distant enemy fire is low-passed; reload, empty-click,
  hitmarker, pickup, hurt and **footstep** sounds — all procedural, no assets.
- **HUD** (`src/hud.js`): expanding crosshair, ammo/reserve + reload indicator, health/armor,
  hitmarkers, killfeed, damage vignette, banners, and a canvas **minimap**.
- **Wave combat** (`src/enemies.js`): 4 enemy tiers, headshot ×2 damage, health bars, hit
  reactions, knockback, LOS-gated bursts, health/armor drops, escalating waves.
- **Indian-style human enemies** (`src/enemies.js`): procedurally animated NPCs wearing
  colorful kurtas, lungis and turbans (maroon officers, khaki privates) with random skin
  tones, two-bone limb walk cycles, and aim/cover stances.
- **Festival arena** (`src/world.js`): sagging **bunting** garlands of fluttering triangle
  flags between gold-topped poles plus a central **rangoli** ground mandala.
- **First-person presence** (`src/weapons.js`, `src/player.js`): visible FPS hands/arms on
  every weapon, movement sway, synced head-bob + footstep audio.
- **Performance-minded** (`src/world.js`): pooled decals/shells/tracers/flashes, static
  low-draw-call arena.

## Project layout

```
index.html        playable entry (loads the prebuilt bundle)
bundle/game.js    minified single-file build — works from file:// (double-click)
src/              source modules (dev)
vendor/           three.js r160 (dev)
build.mjs         esbuild bundler
```

## Building / developing

Edit files in `src/`, then rebuild the playable bundle:

```sh
node build.mjs
```

`src/main.js` exposes a `window.__jgg` debug handle ({ enemies, player, weapons, world, camera })
for tuning from the console.

## Verified

- Loaded from both `file://` and `http://` in headless Chrome: no JS exceptions, WebGL renders
  (100% non-black pixels), DEPLOY starts the match, and aiming at a bot and firing registers a
  kill (HUD + killfeed update).
- All modules pass `node --check`.

## License

Released under the [MIT License](LICENSE). See also the [Security Policy](SECURITY.md).
