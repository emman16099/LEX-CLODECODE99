# Reel Criteria

> **These are STARTER rules. Replace them with your own.**
> Keep the same shape for each rule so the critic can read it.

## How the verdict works

- **MUST** rules: if even one fails, the whole reel **FAILS**. No matter the score.
- **SCORE** rules: each is worth points. The reel needs **70 or more out of 100** to pass.
- A reel **PASSES** only when every MUST rule passes **and** the score is 70+.

Change the pass mark here: `PASS_MARK: 70`

---

## MUST rules

### M1. Hook in the first 2 seconds
- **Check:** By 2.0s, does the viewer see or hear a reason to keep watching? (A problem, a promise, a surprise, a bold claim.)
- **Pass:** Clear hook in text on screen OR spoken by 2.0s.
- **Fail:** Logo intro, slow pan, "Hi guys", or nothing happens.
- **Look at:** frames t0.00–t2.00, transcript before 2.0s.

### M2. Vertical 9:16
- **Check:** `is_vertical_9x16` in meta.json.
- **Pass:** true (1080×1920 is best).
- **Fail:** square, sideways, or black bars.

### M3. Captions on screen
- **Check:** Is there readable text for the spoken words? Most people watch with sound off.
- **Pass:** Captions on most frames with speech, big enough to read on a phone.
- **Fail:** No captions, or too small / low contrast.

### M4. Clear call to action at the end
- **Check:** Last 5 seconds. Does it tell the viewer exactly what to do? (Comment a word, tap the link, call, follow.)
- **Pass:** One clear action, shown or said.
- **Fail:** Just ends, or gives 3 different asks.

---

## SCORE rules (total 100)

### S1. Pacing (20 pts)
- **Check:** `longest_shot_s` and `avg_shot_s` in meta.json, plus what you see change in frames (zooms, text pops, B-roll).
- **Full points:** something new every 3s or less, no shot longer than 5s.
- **Half:** longest shot 5–8s.
- **Zero:** any shot over 8s with nothing changing.

### S2. No dead air (10 pts)
- **Check:** `silences` in meta.json.
- **Full:** no silence over 0.7s (except a planned pause).
- **Zero:** any silence over 1.5s.

### S3. Sound level (10 pts)
- **Check:** `integrated_lufs` and `true_peak_dbfs`.
- **Full:** between -16 and -10 LUFS, peak below -1 dBFS.
- **Half:** -20 to -16, or peak between -1 and 0.
- **Zero:** quieter than -20, or peak above 0 (clipping).

### S4. Text in the safe zone (10 pts)
- **Check:** Frames. Text must not sit under the app buttons.
- **Full:** No important text in the top 14%, bottom 20%, or right 12% of the frame.
- **Zero:** captions or key words hidden by those areas.

### S5. One clear message (20 pts)
- **Check:** Transcript + frames. Can you say what the reel is about in one sentence?
- **Full:** Yes, and every part supports it.
- **Half:** Main point is there but it wanders.
- **Zero:** Two or more different topics.

### S6. Picture quality (10 pts)
- **Check:** Frames. Sharp, well lit, face visible, not shaky.
- **Full:** All good. **Half:** One problem. **Zero:** Blurry or dark most of the time.

### S7. Length fits the content (10 pts)
- **Check:** `duration_s`.
- **Full:** 15–60s with no slow parts. **Half:** 60–90s, or a slow middle. **Zero:** under 7s or over 90s.

### S8. Brand shown (10 pts)
- **Check:** Logo, name, or product visible at least once.
- **Full:** Yes, without being a slow intro. **Zero:** Not shown.
