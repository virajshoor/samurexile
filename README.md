<div align="center">

# SAMUREXILE
### Shadow of the Exile
**An exile. A stolen name. A country worth fighting for.**

[Play the game](https://debt-of-motion-vs.virajshoor.chatgpt.site) · [Source](https://github.com/virajshoor/samurexile)

</div>

---

A compact, retro-inspired hack-and-slash game about Ren, an exiled samurai who returns to stop a coup. Fight from a moonlit bamboo forest through an occupied lantern village to the crimson castle gate. Defeat the commander and restore your name.

## The blade does the talking

- **Three-hit sword combos** — hold slash; every third strike hits harder and reaches farther.
- **Invulnerable dash** — evade a telegraphed attack, cross through an enemy and counterattack.
- **500 sequential levels across ten story arcs** — three waves per level, with a captain every 50 levels and health recovery between waves.
- **Arc captains and a final commander** — more health, faster attacks and a dedicated boss health bar.
- **Animated canvas artwork** — ten arc settings, articulated characters, trailing scarves, sword arcs, sparks and dash afterimages. No raster assets required.
- **Chapter checkpoints** — browser storage remembers the level reached and completion.
- **Mobile support** — automatic touch controls, multitouch input, landscape layout and safe-area padding.

## Play locally

Download the repository and open `index.html`, or serve the folder:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000**. No build step, API key or backend is required. Google Fonts are optional remote typography resources; system fonts are the fallback.

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | A / D or left / right | Hold arrows |
| Jump | W / up / Space | Jump |
| Combo | Hold J or K | Hold Slash |
| Dash | Shift or L | Dash |
| Pause | Escape | Switching away pauses |

An exclamation mark signals an enemy preparing to strike. Dash during the warning and counter before the enemy recovers.

## Code map

| File | Responsibility |
|---|---|
| `index.html` | Canvas, story screens, controls and page structure |
| `style.css` | Retro interface, mobile layout and safe areas |
| `game.js` | Game state, combat, input, procedural art, saves and animation |

### How it works

The canvas renders at **960 × 540**, independently of its displayed size. `loop()` computes a capped elapsed time, calls `update()` for simulation and `render()` for drawing. `start()` initializes a chapter; `nextWave()` creates its opponents. `slash()`, `jump()` and `dash()` update player actions. Enemy attack windups are evaluated in `update()`. Rendering helpers draw scenery and articulated fighters directly to Canvas 2D.

The code is enclosed in an immediately invoked function to avoid global variables. Comments explain each system. Local storage uses `samurexile-v2`: it stores the current level and completion, not individual fights, score or health. Reloading starts at the level checkpoint. Browser storage may be unavailable in restricted contexts; the game still runs without persistence.

## Scope and validation

This is an arcade prototype with a 500-level campaign with fictional characters and events inspired by medieval Japan. It is not a historical simulation. The visual redesign uses original procedural drawing code. Mobile layout includes safe-area support, but physical-device coverage is limited. No credentials, deployment metadata or private repository history are included.

## Extending the game

Change the ten story arcs and five story beats in `arcs` and `beats`, wave composition in `nextWave()`, combat timing in the action functions, and chapter visuals in `scenery()`. Keep the fixed canvas coordinate system when adding new actors or effects.

## Campaign structure

The campaign contains 500 sequential, rule-generated encounters arranged into ten connected arcs of 50 levels. Story text advances in five beats per arc and every 50th level features a captain. Enemy composition and health scale gradually; the three scenery themes repeat across arcs. These are generated variations, not 500 individually authored maps or narrative scenes. Progress is saved at level boundaries; retry starts the current level.

## Campaign art direction

All environments use the original muted indigo, warm lantern light, geometric silhouettes and pixel-aligned drawing style. Decorative landmarks remain behind the fixed combat floor. Level art does not change movement speed, gravity, sword reach, combo timing or dash invulnerability.

| Levels | Setting | Story landmark |
|---|---|---|
| 1–50 | Bamboo refuge | Stolen red seal |
| 51–100 | Lantern village | Courier signals |
| 101–150 | River crossing | Ledger crate and ferry |
| 151–200 | Ash monastery | Bell and witness refuge |
| 201–250 | Northern pass | Snow, pines and road banner |
| 251–300 | Mask quarter | Hanging counterfeit masks |
| 301–350 | Silent harbour | Fleet sails and dock posts |
| 351–400 | Council courtyard | Red pillars and heraldry |
| 401–450 | Banner siege | Fire braziers and rebel standards |
| 451–500 | Dawn gate | Gold standards and rising sun |

Enemy uniforms follow the local palette; Ren retains his blue robes and red scarf for easy recognition. Snow and ember particles are decorative. The ten settings are authored procedural artwork, reused with decorative variations across their 50 levels.

Review checks rendered all 500 backgrounds and exercised combo damage, dash timing, level transitions and final completion saving. These checks do not replace playtesting on physical mobile devices.
