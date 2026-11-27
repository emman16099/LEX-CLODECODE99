# Demo video for Ken — how it was built

**Video:** `../lexiewood-cabinet-demo-for-ken.mp4` (40 s, 1080×1920, 38 shots)
**Purpose:** teach the editing style only. It uses stock footage, so **don't post it.** The real one must be shot on a real Lexie Wood job.

## The style rules this demo shows (copy these, Ken)
1. **Start and end on the same finished shot.** The last second is the exact opening frame, so the loop feels seamless.
2. **Hook in 3 seconds:** pain + surprise + a question ("Hindi pantay ang sahig. Pero pantay ang cabinets. Paano?").
3. **Fastest cuts in the hook** (~0.7 s per shot), then ~1.2 s per shot.
4. **Order of the story:** problem → shop (CAD, CNC, labels) → base and level → toe kick → join boxes and fix to the wall → doors and drawers → payoff.
5. **The picture matches the word.** When the voice says "level," we see a level.
6. **One caption line at a time, always in the same spot,** big and bold, white with a black outline.
7. **The ending "Sukat. Check. Cut. Ayos."** has one cut per word, and the caption builds up one word at a time.
8. **Music very low** under the voice (about 16 dB lower).

## What to shoot on the next real job (to replace each stock clip)
| Beat | Stock used in demo | Real shot to get |
|---|---|---|
| Hook / ending | Modern kitchen (Mixkit 43033) | The finished Lexie Wood kitchen, same angle at start and end |
| Problem | People frustrated assembling furniture | A real old cabinet with a gap, a crooked door, a stuck drawer |
| Shop | Carpenter, boards, 3D screen, panel saw | Our CAD screen, our CNC cutting a board, a hand holding a labelled part |
| Base / level | Tape measure, planer | Base going down, **level bubble in the center (close-up)** |
| Toe kick | Miter saw | Marking and trimming the toe kick on site |
| Join / wall | Drill on a frame | Clamps pulling two boxes flush, screw into the wall |
| Fronts | Couple building a chair | Fitting doors and drawers, a spacer in the gap |

## Sources (all free)
- Video: Mixkit free stock video license (clip IDs are in `plan.py`).
- Music: "Motivating Mornings" by Ahjay Stelino, Mixkit Stock Music Free License.
- Voice: Microsoft Edge neural voice `fil-PH-AngeloNeural` via the free `edge-tts` tool.

## To rebuild
`plan.py` holds the script, captions and clip choices. `build.py` cuts the shots, adds captions and the voice. It needs ffmpeg, edge-tts, and the Mixkit clips downloaded into `../stock/hd/`.
