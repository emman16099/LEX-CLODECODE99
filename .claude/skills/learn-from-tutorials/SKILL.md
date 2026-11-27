---
name: learn-from-tutorials
description: Teach the attention agent from tutorials and example videos on YouTube, TikTok, Instagram/Facebook Reels and YouTube Shorts. Finds the videos, pulls transcripts or video breakdowns, turns them into short cited "lesson cards", grades how much proof each lesson has, merges them with what the agent already knows, and only promotes well-proven lessons into the agent's rulebook. Use this whenever the user says "learn from this video", "study this creator", "watch these tutorials", "what do the experts say about hooks/scripts/ads", pastes a YouTube/TikTok/Reels link to learn from, or wants to grow the agent's knowledge base — even if they don't say "skill" or "lesson".
---

# Learn From Tutorials

This agent exists to earn, hold and convert attention (read `PURPOSE.md` at the
repo root first). This skill is how it gets smarter: it studies videos and
writes down what it learned, with proof, so future tasks can use it.

## Why the agent works this way

An AI agent does not "remember" a video it watched. It only knows what is
written in its files. So learning = **writing good notes in the right place**.
Bad notes (copied scripts, unproven claims, no source) make the agent
confidently wrong, which is worse than not knowing.

Two ideas shape every step:

1. **A tutorial teaches two lessons.** What the creator *says* (their advice)
   and what the creator's video *does* (its own hook, structure, call to
   action). The view count only proves the second one. A tutorial with 5
   million views proves its *packaging* worked; it does not prove its *advice*
   is true. Keep these apart on every lesson card.
2. **Advice expires.** Platform tips (algorithm, best length, posting time)
   go stale in months. Human tips (curiosity, clear promise, story) last for
   years. Tag every lesson so the agent knows which kind it is.

## What "learning" means here

**Learning from a video = pulling out an idea you can reuse on a different
topic, explaining why it works, writing it down with proof, and later checking
that it works for us.** If the last part never happens, it was note-taking,
not learning.

| The agent does this… | Learning? |
|---|---|
| Watches or reads the whole video | No: that's looking |
| Writes a summary ("he talked about hooks") | No: that's a book report |
| Copies the creator's script | No: that's copying |
| Saves 50 tips in a file | No: that's collecting |
| Pulls out a reusable idea, explains why, applies it to our business, grades the proof, plans a test | Yes |

### The 5 stairs of learning

1. **Remember**: what did they say?
2. **Understand**: why does it work on a viewer's attention?
3. **Use**: apply it to our business with a real example.
4. **Judge**: should we believe it? Give an evidence grade (A–D).
5. **Prove**: did it work on our own posts or ads?

A lesson card may be saved only after stair **4**. A lesson enters the
"Proven for us" part of the rulebook only after stair **5** (see step 7).

### A script is only half the video

A transcript gives the **words** only. It misses on-screen text, the first
frame, cuts, pacing, camera moves, and what is shown with hands or objects.
- Lesson about **words** (hook lines, story, CTA) → the transcript is enough (cheap).
- Lesson about **looks** (editing, text hooks, first frame) → "watch" the video
  with a vision tool (costs more). Never guess the visuals from the words.

## The 7 learning steps

### 1. Pick the question
Never "learn everything about TikTok". Pick one question tied to a step in
`PURPOSE.md`: **Stop**, **Hold**, **Pay back** or **Move**.
Good: "How do top creators write the on-screen text hook in the first 3 seconds?"
Check `knowledge/CURRICULUM.md` for the next open question if the user didn't give one.

### 2. Find sources (mix two kinds)
- **Teachers:** tutorials where someone explains a method.
- **Proof:** videos that over-performed (high *outlier score* = many more views
  than that creator usually gets) in the user's niche, even if they are not tutorials.

Aim for at least 3 different creators. One creator is one opinion.
See `references/sources.md` for which tool reaches which platform and what it costs.

### 3. Get the content
Prefer the cheapest thing that answers the question:
transcript or existing analysis first, full "watch" only when the lesson is
visual (editing, on-screen text, camera framing). Do not download or re-upload
other people's videos; use the tools' transcripts and analyses.

### 4. Read the skeleton, then write lesson cards
Don't read a script top to bottom like a story. Mark its skeleton first:

| Part | Ask |
|---|---|
| **Hook** (first 1–2 lines) | What made people stop? Which hook type? |
| **Lock-in** (next 2–3 lines) | How did they promise it's worth staying? |
| **Body** | How many sections, and what's in each? |
| **Re-hooks** | Where did they give a new reason to keep watching? |
| **Payoff** | Did they deliver what the hook promised? |
| **CTA** | What did they ask the viewer to do? |

Then ask: *which part of this skeleton could be reused on a different topic?*
That reusable part is the lesson.

Every video gives two kinds of lesson. Write them separately:
- **What they SAY** (their advice): an opinion until tested.
- **What they DO** (how this video is built): backed by its views and outlier score.

One card per idea, using `references/lesson-card-template.md`.
Save to `knowledge/lessons/<topic>--<short-name>.md`.
Write the *pattern* in your own words. A short quote (one sentence) is fine
as evidence; do not copy a creator's whole script.

### 5. Grade the proof
Give every card an evidence level using `references/evidence-levels.md`
(A = tested on our own content, B = seen across many winning videos,
C = one expert with a reason, D = opinion or sales pitch).
Watch for red flags: the "tip" is really a funnel ("comment HOOKS for my
prompt"), the creator sells a course about it, numbers have no source,
or the advice is about an old version of the app.

### 5b. The "did I really learn it?" check
Before saving a card, answer all five. If any answer is missing, don't save it
as a lesson. Tell the user what is missing instead of pretending.

1. State the lesson **in my own words**, in one sentence.
2. Explain **why** it works.
3. Apply it to **our business** with a real example.
4. Give a **proof grade** (A–D) and say why.
5. Say **how we'd test it** and which number decides.

### 6. Connect to what the agent knows
Before saving, search `knowledge/` for cards on the same idea.
- Same idea → merge into the older card, add the new source, raise the grade if earned.
- Opposite idea → keep both, write the conflict in both cards under "Conflicts",
  and add a test to `knowledge/TEST-QUEUE.md` so real numbers can settle it.

### 7. Promote, or queue for testing
- Level **A** (stair 5: proven on our own content) → add to the **Proven for us**
  section of `knowledge/RULEBOOK.md`.
- Level **B** → add to the **Strong bets** section of the rulebook (use it, but
  it still needs our own test), *and* add it to `knowledge/TEST-QUEUE.md`.
- Level **C** → add to `knowledge/TEST-QUEUE.md` with how to test it.
- Level **D** → keep the card (so we don't re-study it) but never promote it.

Update `knowledge/SOURCES.md` with every video studied (link, creator, date
studied) so the agent never pays to study the same video twice.

## What to report back

Finish with a short report in plain words a 10-year-old could follow:

```
Question: <the question>
Studied: <N> videos from <M> creators (<platforms>)
New lessons: <list, each with its grade and which stair it reached>
Not learned yet: <ideas that failed the 5-question check, and what's missing>
Merged into old lessons: <list>
Conflicts found: <list, or "none">
Added to rulebook: <list>
Added to test queue: <list>
Cost: <credits used per tool>
Next question I suggest: <one>
```

## Things that go wrong (and what to do)

- **No transcript / tool out of credits:** say so plainly, name which tool
  failed, and offer the next option from `references/sources.md`. Never invent
  what a video "probably" says.
- **Video is a sales funnel:** still record what its packaging *does* (that is
  real evidence), but grade its *advice* D unless other sources back it up.
- **Only one creator found:** save cards as level C at most and say the
  sample is too small.
