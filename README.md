# StudyStand by Nova Prestige

Scroll-driven website for **StudyStand**, the foldable laptop stand from the Nova Prestige entrepreneurship project. All copy comes from the project PDF, in French.

## The scroll, in order

1. **Entrée:** the product fills the screen with no text. Scrolling moves the footage frame by frame, then the title and the project statement fade in. The logo card at the end of the original video is cut.
2. **Problématique:** the problem sentence builds line by line while a head bends toward a low screen.
3. **Solution proposée:** the paragraph from the deck, with the product in profile.
4. **Réglez la hauteur:** a 3D StudyStand folds, opens, and gets a laptop. You raise it with the slider until the line from your eyes to the top of the screen goes level and turns orange.
5. **Différenciation:** a full-screen camera orbit around the stand (generated with Kling via kie.ai) moves frame by frame under the four differentiators.
6. **Segments de clientèle:** the target customers scroll past sideways.
7. **Modèle économique:** a balance tips from 60 DH (cost) toward 100 DH (price), then the 40 DH margin lands.
8. **Étude de marché, stratégie marketing, 6 étapes:** the steps draw their own line.
9. **Analyse SWOT.**
10. **Conclusion, précommande, équipe.** The pre-order form is a demo: it saves only in that browser and never asks for payment. Confetti fires when the team names arrive, and again on a confirmed pre-order.

The two footage sections (opening and orbit) play their frames early in the section (`data-seq-speed` in `index.html`: 2 and 2.4) and then hold the last frame under the text. The text sections (solution, market study and strategy, the six steps, SWOT) hold on screen for a while (`data-hold`, in screen-heights) instead of scrolling straight past; a section taller than the screen simply does not hold.

On computers the page also has smooth wheel scrolling (Lenis) and a custom cursor that turns into a "Glisser" disc over the 3D stand. Phones keep their native scrolling and no custom cursor.

## Auto-scroll (hidden)

Press the **NP** mark in the top-left corner (it is clickable even when the bar is invisible on the opening shot). A small panel opens:

- the time defaults to **3 min**; change it with **−** / **+** (15 s steps, 0:30 to 10:00) or the 1 / 2 / 3 / 5 min buttons, then press **Lancer**;
- the whole page then plays through by itself and reaches the end in exactly that time (constant speed with a short ease in and out);
- scrolling with the wheel, touching the screen, pressing arrow/space keys, or using the 3D stand or the form **pauses** it. Open the panel again for **Reprendre** or **Arrêter**;
- the chosen time is remembered in the browser. Esc or a second press on NP closes the panel.

## Run it

Double-click `index.html`, or serve the folder:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The scroll footage is plain image frames drawn on a canvas, not video, so it works offline, in every browser, and on iPhone. It needs internet only for the Google Fonts; otherwise it falls back to system fonts.

## Files

| Path | Purpose |
| --- | --- |
| `index.html` | Page content and the scroll acts (`data-sc-*` attributes) |
| `assets/engine/` | scroll-craft engine (do not edit; restyle in `page.css`) |
| `assets/css/page.css` | Theme tokens and page styles |
| `assets/js/stand3d.js` | 3D stand + laptop (Three.js), source |
| `assets/js/page.src.js` | One animation loop: smooth scroll, auto-scroll, cursor, frame sequences, 3D act, confetti, pre-order form (source) |
| `assets/js/page.js` | Bundled build of the two sources above, loaded by the page |
| `assets/js/vendor/` | Three.js 0.160.0 |
| `assets/seq/` | Scroll frames: `entree` (110) and `orbite` (81); `d/` = 1280×720 desktop crops, `m/` = 720×1280 phone frames |
| `assets/media/` | Stills; `source/` holds the two clips the frames were cut from |
| `scrollcraft/` | Build brief and fingerprint registry used by the scroll-craft skill |

After editing `page.src.js` or `stand3d.js`, rebuild the bundle (Lenis and canvas-confetti are bundled in, so the site still works offline):

```bash
npm install
npm run build
```

To re-cut frames from a clip (example: the orbit), then set `data-seq-count` in `index.html` to the new frame count:

```bash
ffmpeg -i assets/media/source/orbite.mp4 -vf "fps=16,crop=iw:iw*9/16:0:ih*0.355,scale=1280:720" -c:v libwebp -quality 72 assets/seq/orbite/d/%03d.webp
ffmpeg -i assets/media/source/orbite.mp4 -vf "fps=16,scale=720:1280" -c:v libwebp -quality 64 assets/seq/orbite/m/%03d.webp
```
