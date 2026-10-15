# StudyStand by Nova Prestige

Interactive 3D marketing website for **StudyStand**, the foldable, lightweight, adjustable laptop stand from the Nova Prestige entrepreneurship project.

## What's on the site

- **Intro film:** the product video plays full-screen when the site opens, then fades into the 3D stand. "Passer l'intro" skips it, and "Voir le film" replays it.
- **3D product:** the stand folds, opens, and adjusts its height as you scroll. Drag it to rotate it, hover the feature points, and switch finishes (Argent, Graphite, Nuit).
- **Sections:** project, problem and solution (animated posture drawing), video stills, differentiation, target customers, pricing (100 DH price, 60 DH cost, 40 DH margin), market study and marketing plan, development roadmap, SWOT, pre-order form, and team.
- Works on phones and computers.

## How to open it

- **Simplest:** double-click `index.html`. Everything is local except the Google Fonts, which fall back to system fonts when offline.
- **Local server:** run `python3 -m http.server 8000` in this folder, then open http://localhost:8000.
- Add `?nointro` to the URL to skip the film, for example `index.html?nointro`.

The pre-order form is a demo: it saves orders only in the browser on that device and never asks for payment.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page content (French) |
| `assets/css/style.css` | All styles and the brand tokens (navy and orange) |
| `assets/js/main.js` | Intro film, scroll story, animations, form (source) |
| `assets/js/stand.js` | Procedural 3D StudyStand model in Three.js (source) |
| `assets/js/app.js` | Bundled build of the two files above, loaded by the page |
| `assets/js/vendor/` | GSAP 3.12.5, ScrollTrigger, and Three.js 0.160.0 |
| `assets/video/` | 8.5 s intro film (MP4 and WebM) |
| `assets/img/` | Stills taken from the film |

## Editing the scripts

After changing `main.js` or `stand.js`, rebuild `app.js`:

```bash
npx esbuild@0.24.0 assets/js/main.js --bundle --format=iife --minify --target=es2019 --legal-comments=eof --outfile=assets/js/app.js
```

To use another video, replace the files in `assets/video/` and keep the same names.
