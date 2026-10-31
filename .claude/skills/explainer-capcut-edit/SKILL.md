---
name: explainer-capcut-edit
description: Plan and prep a vertical talking-head explainer edit in the "graphic on top, speaker inset below" style studied from a Kallaway Marketing short, split between Claude (edit plan, on-screen text, title-card PNGs) and the user (cutting and assembling in CapCut). Use when the user wants to edit a Reel/Short/TikTok "in the Kallaway style", asks for a CapCut edit plan, shot list, B-roll/graphic plan, title cards, or wants their talking-head video to look like an explainer with graphics.
---

# Explainer Edit for CapCut (Claude + CapCut)

## What this style is
A 9:16 talking-head video where, about **70% of the time**, a simple graphic fills the top of the screen and the speaker sits in a **rounded box at the bottom**. The other ~30%, the speaker goes **full screen** for the key lines. Captions show **one or two words at a time** in the middle. Measured from the source in `references/style-measurements.md`.

## Who does what (be honest about this)
Claude cannot open or control CapCut. There is no CapCut connector.
- **Claude does:** read the script or transcript, decide the layout for every line, write all on-screen text, render the title cards as PNG images (`scripts/render-cards.js`), and hand over a CapCut step list.
- **The user does in CapCut:** cut the footage, add captions, place cards and the speaker box, animate, check and export.
Never say an edit is "done" or "exported" — Claude only prepares the parts.

## Inputs
1. **Script with timestamps.** Best: in CapCut run auto captions, then export them as an SRT or TXT file and paste it here. Second best: the script plus the video length. If only a script, estimate time at ~150 words per minute and label times as estimates.
2. **What visuals exist:** B-roll, photos, screenshots, product shots. Use only footage the user owns or has permission to use. The source shows other creators' clips; do not copy that without permission.
3. **Brand colours/fonts** if any. Default: black + light grey themes, red accent, white bold sans + italic serif accent.

## Step 1 — Map every line to a layout
Use three layouts:

| Layout | Use it for | Source share |
|---|---|---|
| **A. Full-face** — speaker fills the screen | Rules, strong claims, punchlines, emotion, the CTA line | ~28% |
| **B. Card + inset** — graphic top ~58%, speaker box bottom ~28% | Explaining, naming a step, lists, diagrams, examples | ~72% |
| **C. Example + inset** — a phone-frame clip or photo in the card area | Showing proof, a real example, before/after | part of B |

Rules from the source:
- Open on **B** (title card) from second 0. Do not open on a blank face.
- Switch layout at **sentence or idea boundaries**, roughly every **3–7 seconds**. Inside a card, something changes about **every 1–2 seconds** (an item lights up, a tick appears, a line draws).
- Go **full-face** right after a list or diagram, to land the rule.
- Each **named term** gets its own title card the moment it is said.
- Use the **light theme** to mark a new section such as "examples" or the CTA; use dark for the main teaching.

## Step 2 — Write the edit plan
Output one table:

| # | Start–End | Spoken line | Layout | Card / visual | Card file | Motion |
|---|---|---|---|---|---|---|

Motion choices (keep to these): list item lights up, tick appears, line/chart draws, card slides in, slow push-in on the full-face shot.

## Step 3 — Render the title cards
Write a `cards.json` (format in the script header) and run:
```
node scripts/render-cards.js cards.json cards/
```
- Cards are 1080x1920 PNGs. The bottom ~42% stays empty for captions and the speaker box.
- `*word*` in a title turns into the italic serif accent (e.g. `"Make Them *Lean In*"`).
- For a list that builds, render **one PNG per state** (`active: 0`, then `1`, then `2`) and stack them on the timeline. This fakes the animation without keyframes.
- Needs Playwright + Chromium. In a Claude cloud session it is installed. On the user's own computer, they may need `npm i playwright` first. If it can't run, give the card text in the plan and let the user build cards with CapCut text templates.
- Send the PNGs to the user with the SendUserFile tool and say where they are.

## Step 4 — Hand over the CapCut steps
Give these in order, adapted to the plan:
1. New project, **9:16**, import the talking-head clip. Cut out mistakes and long pauses first.
2. **Captions → Auto captions.** Fix every wrong word. Style: bold white sans, centered, about 2/3 down the screen, **1–2 words per caption**, no background box. On light cards switch the caption colour to black.
3. For each **B/C** line: put the card PNG on the main track for that time span. Put the talking-head clip on an **overlay** track, scale it down to the bottom ~28%, and add a **rounded-rectangle mask** so it is a box with rounded corners and a small margin.
4. For each **A** line: talking head full screen, no card. Add a slight zoom-in (keyframe scale ~100% → 108%) on key lines.
5. For building lists: line up the state PNGs back to back at the moment each item is said.
6. Add a soft whoosh or click on card changes only if it fits the brand. Music, if used, must be licensed for business use.
7. Watch it on your phone with sound **off**. Every idea should still make sense from captions and cards alone.
8. Export 1080x1920. Do not post until you have checked it.

## Honesty and rights
- Only use clips, logos, and faces the user has rights to.
- Charts must show real numbers or be clearly labelled as an illustration — the source shows a skip-rate chart with no numbers or source.
- Caption text must match what is said.

## Self-check
- Opens on a title card at 0:00?
- Layout changes every 3–7 s, with something moving inside cards every 1–2 s?
- Every named term has a card?
- Full-face used for the rules and the CTA?
- Captions 1–2 words, readable, correct?
- Bottom of every card left clear for captions and the speaker box?
- All footage owned or licensed?

## Related
`kallaway-style-script` writes the script this edit is built on. `social-media-skills:capcut` covers CapCut features and licensing in more depth.
