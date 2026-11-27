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

### 4. Write lesson cards
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

### 6. Connect to what the agent knows
Before saving, search `knowledge/` for cards on the same idea.
- Same idea → merge into the older card, add the new source, raise the grade if earned.
- Opposite idea → keep both, write the conflict in both cards under "Conflicts",
  and add a test to `knowledge/TEST-QUEUE.md` so real numbers can settle it.

### 7. Promote, or queue for testing
- Level **A or B** → add a one-line rule to `knowledge/RULEBOOK.md`, linking the card.
- Level **C** → add to `knowledge/TEST-QUEUE.md` with how to test it.
- Level **D** → keep the card (so we don't re-study it) but never promote it.

Update `knowledge/SOURCES.md` with every video studied (link, creator, date
studied) so the agent never pays to study the same video twice.

## What to report back

Finish with a short report in plain words a 10-year-old could follow:

```
Question: <the question>
Studied: <N> videos from <M> creators (<platforms>)
New lessons: <list, each with its grade>
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
