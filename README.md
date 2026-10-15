# StudyStand by Nova Prestige

Scroll-driven website for **StudyStand**, the foldable laptop stand from the Nova Prestige entrepreneurship project. All copy comes from the project PDF, in French.

## The scroll, in order

1. **Entrée:** the product video plays forward and backward as you scroll (the logo card at the end is cut).
2. **Problématique:** the problem sentence builds line by line while a head bends toward a low screen.
3. **Solution proposée:** the paragraph from the deck, with the product in profile.
4. **Réglez la hauteur:** a 3D StudyStand folds, opens, and gets a laptop. You raise it with the slider until the line from your eyes to the top of the screen goes level and turns orange.
5. **Différenciation:** a generated camera orbit around the stand (Kling, via kie.ai) scrubs under the four differentiators.
6. **Segments de clientèle:** the target customers scroll past sideways.
7. **Modèle économique:** a balance tips from 60 DH (cost) toward 100 DH (price), then the 40 DH margin lands.
8. **Étude de marché, stratégie marketing, 6 étapes:** the steps draw their own line.
9. **Analyse SWOT.**
10. **Conclusion, précommande, équipe.** The pre-order form is a demo: it saves only in that browser and never asks for payment.

## Run it

The videos load through `fetch`, so the page has to be served over HTTP. Opening `index.html` by double-click (file://) shows the still frames instead of the scrubbing videos.

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

Works in Chrome, Edge, Safari, and Firefox on desktop and phones. It needs internet only for the Google Fonts; otherwise it falls back to system fonts.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page content and the scroll acts (`data-sc-*` attributes) |
| `assets/engine/` | scroll-craft engine (do not edit; restyle in `page.css`) |
| `assets/css/page.css` | Theme tokens and page styles |
| `assets/js/stand3d.js` | 3D stand + laptop (Three.js), source |
| `assets/js/page.src.js` | 3D act control, sightline, pre-order form, source |
| `assets/js/page.js` | Bundled build of the two sources above, loaded by the page |
| `assets/js/vendor/` | Three.js 0.160.0 |
| `assets/media/` | Scrub clips (desktop + phone versions), posters, stills |
| `scrollcraft/` | Build brief and fingerprint registry used by the scroll-craft skill |

After editing `page.src.js` or `stand3d.js`, rebuild the bundle:

```bash
npx esbuild@0.24.0 assets/js/page.src.js --bundle --format=iife --minify --target=es2019 --legal-comments=eof --outfile=assets/js/page.js
```

Scrub clips need dense keyframes or they stutter. Re-encode new clips with `.claude/skills/scroll-craft/scripts/encode.sh` (landscape) or with `-g 8 -keyint_min 8 -sc_threshold 0 -an` for portrait footage.
