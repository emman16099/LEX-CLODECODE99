# Production pipeline for 4–8 minute videos

Read at Step 5. This extends the proven 1:40 pipeline in `avatar-cartoon-explainer-video` to longer videos. Where the two disagree, this file wins for bakit videos.

## Order of work

1. Voice (HeyGen) → 2. Avatar bubble (HeyGen, runs while you do 3–5) → 3. Shot plan (`scripts/shot_planner.py`) → 4. Stills (Higgsfield batch) → 5. Clips for ANIMATE shots → 6. Edit (ffmpeg in `sandbox_exec`) → 7. Shorts renders → 8. Thumbnail → 9. Deliver.

## 1. Voice

- `create_speech`, approved script, language en (Tagalog text reads fine), voice Manny's clone `9388964b4a1c43a2943be382c72ddb56` (default; ask once, then reuse) or `3cbd072a1d2b4e799429570916f53e51`.
- Keep `audio_url`, `duration`, `word_timestamps`. Save the timestamps as JSON for the planner.
- Listen check: ask Manny to play the first 30 s before you spend Higgsfield credits. A mispronounced brand name is cheap now and expensive later.

## 2. Avatar

- `create_video_from_avatar`, `audioUrl` = voice, 1:1, cover, 720p, title "<title> - Talking head". Look `2673aefecfc44ddd983a56551f6215f1`. Poll `get_video` every ~30 s.
- Cost scales with length: about 60 HeyGen credits per minute. For a 6-minute video that is roughly 360. If the budget is tight, use the bubble only for Hook, each reason's name card, and the CTA (about 90 s total) and render the avatar from a trimmed audio of those lines.

## 3. Shot plan

```
python3 scripts/shot_planner.py timestamps.json --target 4.5 --animate-ratio 0.28 --out shots.json --md shots.md
```

Then fill the picture-idea column. Rules of thumb for a 5-minute video: 60–75 shots, 15–20 animated. Animated shots: hook, twist, each reason's mini-payoff, the mistake moment, the "gamit" scene, the answer callback, the ending.

## 4. Stills

- One `generate_image_batch` per 10–12 prompts (keeps failures contained). Model `gpt_image_2_5`, 16:9, `medias` = character sheet as `image_references`. ~0.25 credit each.
- Inspect every labeled image; regenerate misspellings.
- Leave the right third empty on the final shot for the subscribe button.

## 5. Clips

- `generate_video_batch`, `kling3_0`, mode std, sound off, 16:9, `start_image` = still job id, duration = ceil(shot seconds), min 3 s, max 10 s. If a planned ANIMATE shot is longer than 10 s, split it in the shot plan first.
- ~1.5 credits per second. 18 clips × 5 s ≈ 135 credits. Tell Manny the number before submitting.
- If a submission returns a recommended preset, retry with `declined_preset_id`. A false out-of-credits error: retry once.
- `jobs_wait` (timeout ≤ 15 s, repeat), then one `show_generation_by_ids`.

## 6. Edit (ffmpeg, in the Higgsfield sandbox)

Downloads from the local shell are blocked; do all media work with `sandbox_exec`. Re-download inputs when a result says `sandbox_created: true`.

- Frame math per shot: n = round(end × 24) − round(start × 24). Stills loop for n frames; clips trim to n frames. Scale to 3840×2160 then `zoompan` to 1920×1080, zoom 1.00→1.05 on odd shots and 1.05→1.00 on even, 24 fps. Concat with the demuxer.
- For long videos, build in chunks of ~15 shots to intermediate MP4s, then concat the chunks. One giant filter graph will run out of memory.
- Background color beat: when the script moves from the problem to the answer, the next still should use the other background. The edit doesn't need a transition; the color shift is the transition.
- Captions: PNG pills, Montserrat ExtraBold from `/usr/share/fonts/truetype/higgsfield/`, white on dark-brown box ~80% opacity, max width 1640 px, 0.18 s fade. Top by default; bottom when the top is busy. Skip shots whose label already says the words.
- Avatar bubble: crop head and shoulders (≈ 420×420 from x150,y0), scale 264, circle mask + white ring + soft shadow at x1614,y608. Mute its audio. If using the trimmed-avatar budget option, show the bubble only during those lines.
- Reason name cards: when Robo holds a sign, also pop a caption with the same word so it reads on mute.
- Subscribe button: red rounded PNG, right side, from 4 s before the end.
- Audio: voice loudnorm I=-15; music ~0.22 looped with acrossfade and sidechaincompress ducked under voice; SFX with adelay at visual hits; amix normalize=0; alimiter. Music and SFX from HeyGen `search_audio_sounds`. Switch music track at the problem→answer turn.
- Output: H.264 1920×1080 24 fps, AAC 192k, faststart. Verify duration = voice length and frame count; inspect 8–12 frames spread across the video for caption fit, bubble placement, and label spelling.

## 7. Shorts

Two 1080×1920 renders from the plan in the playbook. Use the 9:16 stills generated for the hook and payoff; for other shots, scale the 16:9 frame to width 1080 and place it in the middle third over a blurred, darkened copy of itself. Captions centered, 1–2 words at a time, larger (Montserrat ExtraBold ~96 px). End card: "Buong sagot sa channel" + arrow.

## 8. Thumbnail

Per the style bible. Two options for Manny, each checked at 320 px wide.

## 9. Deliver

`media_upload` → PUT from the sandbox in the same command → `media_confirm`. Give Manny: long video URL, two Shorts URLs, two thumbnail URLs, the three titles, the description with sources, credits spent (HeyGen and Higgsfield), and anything you could not verify (usually: audio not listened to end to end). Remind him to turn on the altered/synthetic content label when uploading.

## Budget table (approximate)

| Length | HeyGen (voice+avatar) | Higgsfield stills | Higgsfield clips | Total Higgsfield |
|---|---|---|---|---|
| 4 min | ~240 | ~12 | ~90 (12 clips) | ~105 |
| 5 min | ~300 | ~16 | ~120 (16 clips) | ~140 |
| 8 min | ~480 | ~25 | ~180 (24 clips) | ~210 |

Trimmed-avatar option cuts HeyGen to ~90 per video regardless of length.
