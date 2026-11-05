# Style bible — the house look

Read at Step 4. Every prompt sent to Higgsfield starts from these templates so the channel looks like one channel.

## The look in one paragraph

Bright, saturated, flat 2D cartoon. Thick clean dark-brown outlines. Rounded shapes, no gradients, no 3D shading. Warm cream or sky backgrounds, never dark navy. Lia and Robo appear in almost every scene. Each frame has at least one Pinoy prop that places us in the Philippines. Labels are big, few, and in Tagalog. The mood is cheerful even when the topic is "bakit lugi."

Why this and not the Kurzgesagt look: the dark-navy icon style now signals "science explainer" and is copied by thousands of channels. Southeast Asian audiences respond more to a local, warm, character-driven look (Kok Bisa? reached 6.1M subscribers with it, and a 2026 comparative study credits its "cultural proximity" over Kurzgesagt's polish for that audience). Flat shapes also animate reliably in Kling; gradients and 3D shading drift between frames.

## Palette (name them in prompts)

| Role | Color | Hex |
|---|---|---|
| Background A | Warm cream | #FFF4E0 |
| Background B | Sky blue | #BFE6FF |
| Lia accent | Sun yellow | #FFC933 |
| Robo accent | Teal | #2BB3A3 |
| Money / positive | Mango orange | #FF8A3D |
| Problem / warning | Chili red | #E53935 |
| Outline | Dark brown | #3B2A1E |
| Label box | Off-white on dark brown | #FFFFFF / #3B2A1E |

Use red only for the problem beat. When the answer arrives, the scene shifts to orange and yellow. Viewers feel the turn before they hear it.

## Characters

- **Lia** — cheerful Filipina girl, lemonade/sari-sari stand owner, sun-yellow top. Shows the viewer's emotion: curiosity, shock, suspicion, lightbulb.
- **Robo** — her helper robot, teal. Holds signs with the reason's name, points at numbers, does the "Hindi mo gugustuhing malaman" line.
- Reuse character sheet job id `a34cbaf0-4de8-4ad1-be5f-1715c53f8ece` as `image_references` on every image. New recurring characters (a tindera, a kuya rider, a bank teller) need Manny's approval and their own sheet.

## Pinoy prop library (one per frame minimum)

Sari-sari store with hanging sachets · jeepney · tricycle · GCash/Maya phone screen (generic, no real logo) · balikbayan box · tingi coins on a counter · palengke stall · mall escalator · 7-Eleven-style corner store (no real logo) · barangay hall · EDSA bus · rice sack · boodle fight table · tarpaulin banner · electric fan · sachet of 3-in-1 coffee.

Logos: never real ones. "Pink box with a bird" says Shopee without the trademark. If the topic is a specific brand, show the product generically and let the voice name it.

## Shot grammar

Rotate these so no two neighboring shots share a framing:
- **Wide** — Lia in a place (sets the scene, 1 per beat)
- **Medium** — Lia or Robo reacting (emotion)
- **Insert** — the object or number up close (the fact)
- **Label card** — Robo holding a sign with the reason's name (1 per reason)
- **Split** — two things side by side for a comparison (price A vs price B)

Pattern interrupt: something visibly changes at least every 8–10 seconds. The shot planner enforces shot length; you enforce variety by alternating framing and background color between A and B.

## Prompt templates

**Scene still** (`generate_image_batch`, model `gpt_image_2_5`, 16:9, `medias` = character sheet as `image_references`):

> Use the attached character sheet; keep Lia, Robo and props exactly on-model. Flat 2D cartoon, bright saturated colors, thick clean dark-brown outlines, no gradients, no 3D. Background: [warm cream #FFF4E0 | sky blue #BFE6FF]. Scene: [what happens, who feels what, which Pinoy prop]. Framing: [wide | medium | insert | label card | split]. Text allowed only: ["ANCHOR PRICE" on Robo's sign | none]. No other text, no logos, no brand names, widescreen.

**Animated clip** (`generate_video_batch`, `kling3_0`, std, sound off, 16:9, `start_image` = the still's job id, duration = ceil(shot length), min 3 s):

> 2D flat cartoon animation, keep the exact art style, characters and colors. [One simple action: Lia's eyes widen and she drops the price tag | Robo raises the sign | coins slide across the counter]. Static camera, one continuous shot, no new text. Keep all labels exactly unchanged and readable.

**Shorts frame** (9:16, for the two cutdowns): regenerate the hook and payoff stills at 9:16 rather than cropping; keep the top 20% and bottom 25% free for caption and UI. Same palette, same prompt body.

**Thumbnail** (`generate_image`, `gpt_image_2_5`, quality high, 2k, 16:9, count 2, references = character sheet + the twist scene): one object, Lia's reaction face, 2–4 words of huge outlined text, bottom-right clear. Export 1280×720 JPG under 2 MB.

## Text in images

- Tagalog, uppercase, 1–3 words per label, dark-brown box with white text.
- After generation, open the image (image_paths) and read every letter. Regenerate anything misspelled before animating; Kling will smear a bad label further.
- Captions are added in the edit, not in the image. Don't bake subtitles into stills.

## Forbidden

Dark navy backgrounds · gradients and glossy shading · 3D or Pixar look · realistic human faces · real logos · more than 3 labels in one frame · text under 60 px tall at 1080p · stock-photo collage · a frame with no Pinoy prop · Lia in a different outfit without approval.
