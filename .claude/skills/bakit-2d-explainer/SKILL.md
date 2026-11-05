---
name: "bakit-2d-explainer"
description: "Director skill for Manny's Tagalog 2D cartoon channel: plan, script, shot-list and style a viral-ready 'Bakit nga ba?' / 'Paano' explainer (4–8 min YouTube + Shorts cutdowns), then hand off to the HeyGen + Higgsfield + ffmpeg pipeline. Use this whenever Manny or Ken mentions the bakit channel, a 2D or cartoon explainer, Lia and Robo, topic ideas for the channel, a how-to or 'why' video in Tagalog, making the channel viral or more engaging, or wants a script, shot list, hook, title or thumbnail for an animated video — even if they don't say 'skill' or 'bakit'."
---

# Bakit 2D Explainer — the director skill

This skill turns a question like "Bakit sobrang mahal ng bonsai?" into a finished plan for a 2D cartoon video that Filipinos click, finish, and share. It decides the topic, the hook, the script, the shot plan and the look. The existing `avatar-cartoon-explainer-video` skill (and `references/production-pipeline.md` here) does the rendering. Think of this skill as the director and that one as the crew.

Read this file fully, then open only the reference you need for the step you are on.

## Who this is for and why it exists

Manny runs a Facebook-ads management service (the "322" offer) for Filipino small business owners. The channel's real job is trust: a viewer should finish a video thinking "these people explain money and business clearly, in my language." Ad money from Filipino views is small (about $0.66 per 1,000 views, so one million views is roughly ₱38,000). So every decision below favors a loyal, business-minded Filipino audience over raw view counts. Challenge Manny with data when a topic idea is fun but off-funnel.

Write to Manny in plain, grade-5 Tagalog or Taglish. Short sentences. If a claim in a script can't be backed by a source, say so and rewrite it. When you quote a channel number, a pay rate or a policy line to Manny, add its link from `references/research-notes.md` so he can check it himself; an unsourced "₱38K per 1M views" is just an opinion.

## Hard rules (these never bend)

- **No contrarian-slop hooks.** Never write "Hindi X ang problema. Y pala." or "Her ads weren't bad. Her setup was." Manny calls this AI contrarian slop. Use the hook formulas in `references/topic-and-hook-playbook.md` instead.
- **One question per video.** Anthology videos lose viewers. If a topic has two questions, that is two videos.
- **Keep Lia and Robo on-model.** Reuse the approved character sheet (job id `a34cbaf0-4de8-4ad1-be5f-1715c53f8ece`) for every image. New characters need Manny's approval.
- **Facts must be real.** Numbers, prices and dates come from a source you can name. Cartoon examples must be labeled as examples, never presented as a client's real result.
- **Stay inside YouTube's AI rules.** YouTube allows AI used "to visualize a unique character and narrative you invented" and bans "generic or unoriginal templates giving the impression of mass production." Our protection is a recurring cast, a scripted story, and Manny's own voice. Never batch out templated videos. Always tell Manny to turn on the altered/synthetic content label.
- **Approvals at four points only:** topic + hook, script, title + thumbnail, and any new character. Do everything else without stopping.

## The workflow

| Step | Output | Reference to open |
|---|---|---|
| 1. Pick the topic | 1 chosen question + score card | `references/topic-and-hook-playbook.md` |
| 2. Write the hook and script | Clean voiceover script, 600–1,200 words | `references/script-structure.md` |
| 3. Shot plan | Shot table (ANIMATE/STILL), pacing check, credit estimate | `scripts/shot_planner.py` |
| 4. Style prompts | Character/scene/animation prompts in the house style | `references/style-bible.md` |
| 5. Produce | Voice, avatar, images, clips, edit | `references/production-pipeline.md` |
| 6. Package | 3 titles, thumbnail text, 2 Shorts cutdowns, description | `references/topic-and-hook-playbook.md` (titles section) |
| 7. Review after 7 days | What to change next time | "After publishing" below |

### Step 1 — Pick the topic (the part that actually makes videos travel)

The research is blunt: for Tagalog "bakit" content, the hook is the topic, not the drawing. The breakouts on the closest existing channel all share one shape, a **familiar Pinoy thing plus a contradiction**: bonsai is tiny but costs ₱1M; BGC is in Metro Manila but never floods; Ministop was everywhere, then gone. Score every candidate with the 5-point card in the playbook. Ship only topics scoring 18/25 or higher, and favor money, negosyo and OFW questions because they match the funnel and pay 3–5× more per view.

If Manny gives a topic that scores low, say so with the score, offer the two nearest high-scoring versions, and let him decide.

### Step 2 — Hook and script

Open with the contradiction inside 5 seconds, promise the answer, then earn it in three beats with a small payoff each. Target 150 words per minute of Tagalog voice; a 5-minute video is about 750 words. Deliver the script clean: no scene notes, no headings, nothing a voice actor would stumble on. Full structure and a worked example are in `references/script-structure.md`.

Get Manny's approval on the script before any media is generated. Changing a script after voice is recorded wastes HeyGen credits.

### Step 3 — Shot plan

Run the planner on the HeyGen word timestamps:

```
python3 scripts/shot_planner.py timestamps.json --out shots.json --md shots.md
```

It splits the voice at sentence and clause boundaries into 3–6 second shots, marks which shots to animate, computes exact frame counts, flags any stretch over 10 seconds without a visual change (that is where viewers leave), and estimates Higgsfield credits. Open `shots.md`, then write the "picture idea" column yourself: every shot needs one clear thing to look at that matches the words being said. Animate the hook, the reveal, each beat's payoff, the mistake moment, and the ending. Everything else is a still with a slow zoom. Target 25–30% animated shots on a 5-minute video.

### Step 4 — Style prompts

The house look is a Filipino cousin of Indonesia's Kok Bisa? channel (6.1M subscribers): bright, saturated flat 2D cartoon, thick clean outlines, recurring characters, local props in every frame, and humor from everyday Pinoy life. Studies comparing it with Kurzgesagt found viewers in Southeast Asia respond to "this looks like my street" more than to polished science icons. Build every prompt from the templates in `references/style-bible.md`; the palette, prop library and forbidden list are there. Check every image that contains text before it goes to animation; regenerate misspellings.

### Step 5 — Produce

Follow `references/production-pipeline.md`. It extends the proven 1:40 pipeline to 4–8 minutes, sets credit budgets per minute, and specifies the 9:16 Shorts render. Do all media work in the Higgsfield sandbox.

### Step 6 — Package

Three title options, each planting the contradiction in two seconds, with 2–4 words of thumbnail text. Two Shorts cutdowns: the hook + first payoff (30–45 s) and the best single beat (20–30 s), each ending with "buong kwento sa channel." Write a description with the sources listed. Title and thumbnail need Manny's sign-off.

## After publishing (close the loop)

Seven days after a video goes live, ask Manny for three numbers from YouTube Studio: click-through rate, average view percentage, and where the retention graph dips first. Then:
- CTR under 4%: the title or thumbnail didn't plant the contradiction. Rewrite with the playbook's title formulas.
- Retention dip in the first 30 s: the hook took too long to reach the twist. Cut setup next time.
- Dip at a specific beat: that beat lacked a payoff or had a 10+ second static stretch. Check the shot plan for it.
- Average view percentage above 50% on a 5-minute video is strong for this format. Say so plainly.

Record the result as one line in the topic bank (topic, CTR, AVP, lesson) so the next scoring run is smarter.

## Budget (tell Manny before starting)

Check `HEYGEN get_current_user` and Higgsfield `balance`. Rough costs for a 5-minute video: HeyGen about 300 credits (voice + avatar), Higgsfield about 15 credits for stills, 90–130 for 15–18 animated clips, 2 for the thumbnail. If the balance can't cover it, propose a shorter cut or fewer animated shots rather than silently downgrading.

## Self-check before handing anything to Manny

- One question, stated as a Tagalog "Bakit / Paano / Ano" title?
- Contradiction visible in the first 5 seconds of the script and in the thumbnail text?
- No contrarian-slop phrasing anywhere?
- Every number has a source in the description?
- Shot plan: no gap over 10 s without a visual change; 25–30% animated; frame counts sum to voice length?
- Prompts name the character sheet and the house palette?
- Synthetic-content label reminder included?

## Where the evidence comes from

`references/research-notes.md` holds the channel numbers, studies and policy text behind these rules, with links, so you can explain the "why" to Manny or update a rule when the data changes.
