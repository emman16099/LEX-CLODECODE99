#!/usr/bin/env python3
"""Turn HeyGen word timestamps into a shot plan for a 2D explainer.

Usage:
    python3 shot_planner.py timestamps.json [--target 4.5] [--min 3] [--max 6]
                            [--animate-ratio 0.28] [--fps 24]
                            [--out shots.json] [--md shots.md]
    python3 shot_planner.py --demo            # runs on built-in sample data

If the JSON has a top-level "duration" (HeyGen does), the last shot runs to that
length so the picture track matches the audio track, trailing silence included.

Input: a JSON file that is either a list of {"word","start","end"} objects
(HeyGen create_speech word_timestamps), or an object with a "word_timestamps"
key holding that list. Times are seconds.

What it does:
  * splits speech at sentence ends (. ? !) and clause marks (, ; :) into shots
    whose length aims for --target seconds and stays inside --min/--max where
    the words allow it;
  * computes exact frame counts so stills and clips concat to the voice length;
  * marks ANIMATE shots: the first shot (hook), the last shot (ending), and the
    strongest sentence-ending shots spread across the video until the ratio is
    met. Reasoning: a change of motion at the start, the end and the payoffs is
    where it pays; the rest can be a still with a slow zoom;
  * suggests a framing per shot (wide / medium / insert / label card / split)
    and alternates background A/B so neighbouring shots never look the same;
  * warns on any shot longer than 10 s (viewers leave during static stretches)
    and on ANIMATE shots over 10 s (Kling clip limit);
  * estimates Higgsfield credits (0.25 per still, 1.5 per animated second).
"""
import argparse
import json
import math
import sys

SENTENCE_END = (".", "?", "!")
CLAUSE_END = (",", ";", ":")


def load_words(path):
    """Return (words, duration). duration is the file's own audio length when it
    has one (HeyGen includes trailing silence there); else the last word's end."""
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    duration = None
    if isinstance(data, dict):
        duration = data.get("duration")
        data = data.get("word_timestamps") or data.get("words") or []
    words = []
    for w in data:
        text = str(w.get("word", w.get("text", ""))).strip()
        if not text:
            continue
        words.append({"word": text, "start": float(w["start"]), "end": float(w["end"])})
    if not words:
        sys.exit("No words found in input.")
    return words, float(duration) if duration else None


def split_shots(words, target, min_len, max_len):
    """Greedy split with backtracking: close a shot at a sentence end once it is
    long enough, at a clause end once it is near target, and when a shot runs
    past max, cut at the last clause or sentence break that still leaves the
    shot at least min long (so we never split mid-phrase unless the words give
    us no choice)."""
    shots, cur = [], []

    def length(seq):
        return seq[-1]["end"] - seq[0]["start"]

    def close(upto=None):
        nonlocal cur
        if not cur:
            return
        if upto is None:
            shots.append(cur)
            cur = []
        else:
            shots.append(cur[:upto + 1])
            cur = cur[upto + 1:]

    for i, w in enumerate(words):
        cur.append(w)
        last = i == len(words) - 1
        ends_sentence = w["word"].endswith(SENTENCE_END)
        ends_clause = w["word"].endswith(CLAUSE_END)
        if last:
            close()
        elif ends_sentence and length(cur) >= min_len:
            close()
        elif ends_clause and length(cur) >= target:
            close()
        elif length(cur) >= max_len:
            # Back up to the latest break that keeps the shot >= min_len; if
            # the only break is earlier, accept one >= 2 s (a short insert
            # beats a 10 s static stretch); past the 7.5 s hard cap, cut anyway.
            cut = None
            for floor in (min_len, 2.0):
                for j in range(len(cur) - 2, -1, -1):
                    if cur[j]["word"].endswith(SENTENCE_END + CLAUSE_END) and length(cur[:j + 1]) >= floor:
                        cut = j
                        break
                if cut is not None:
                    break
            if cut is None and length(cur) < 7.5:
                continue
            close(cut)

    if len(shots) > 1 and shots[-1] and length(shots[-1]) < min_len * 0.6:
        shots[-2].extend(shots.pop())
    return shots


def build_plan(words, target=4.5, min_len=3.0, max_len=6.0, animate_ratio=0.28, fps=24, duration=None):
    groups = split_shots(words, target, min_len, max_len)
    # The last shot runs to the end of the audio file, not the last word, so the
    # edit matches the voice track exactly (HeyGen leaves trailing silence).
    total_end = max(duration or 0.0, words[-1]["end"])
    plan = []
    for idx, g in enumerate(groups):
        start = g[0]["start"] if idx else 0.0
        end = groups[idx + 1][0]["start"] if idx + 1 < len(groups) else total_end
        frames = round(end * fps) - round(start * fps)
        plan.append({
            "shot": idx + 1,
            "start": round(start, 2),
            "end": round(end, 2),
            "seconds": round(end - start, 2),
            "frames": frames,
            "line": " ".join(w["word"] for w in g),
            "ends_sentence": g[-1]["word"].endswith(SENTENCE_END),
            "mode": "STILL",
            "framing": "",
            "background": "A" if idx % 2 == 0 else "B",
            "picture_idea": "",
        })

    # Choose ANIMATE shots.
    want = max(2, round(len(plan) * animate_ratio))
    chosen = {0, len(plan) - 1}
    candidates = [s for s in plan[1:-1] if s["ends_sentence"]] or plan[1:-1]
    if candidates and len(chosen) < want:
        need = want - len(chosen)
        step = len(candidates) / need
        for k in range(need):
            s = candidates[min(int(k * step + step / 2), len(candidates) - 1)]
            chosen.add(s["shot"] - 1)
    for i in chosen:
        plan[i]["mode"] = "ANIMATE"

    # Suggest a framing rotation so no two neighbours share one (the style
    # bible's variety rule). The director can overwrite any of these.
    rotation = ["wide", "medium", "insert", "label card", "medium", "insert", "split"]
    for i, s in enumerate(plan):
        s["framing"] = "medium" if i == 0 else rotation[i % len(rotation)]

    warnings = []
    for s in plan:
        if s["seconds"] > 10:
            warnings.append(f"Shot {s['shot']} is {s['seconds']} s with one picture. Split it or add a second still; viewers leave during static stretches over 10 s.")
        if s["mode"] == "ANIMATE" and s["seconds"] > 10:
            warnings.append(f"Shot {s['shot']} is ANIMATE but longer than Kling's 10 s clip limit. Split it in the plan.")
    if sum(s["frames"] for s in plan) != round(total_end * fps):
        warnings.append("Frame counts do not sum to the voice length. Check the timestamps file.")

    stills = len(plan)
    anim_seconds = sum(math.ceil(max(3, s["seconds"])) for s in plan if s["mode"] == "ANIMATE")
    est = {
        "shots": stills,
        "animated_shots": sum(1 for s in plan if s["mode"] == "ANIMATE"),
        "voice_seconds": round(total_end, 2),
        "credits_stills": round(stills * 0.25, 1),
        "credits_clips": round(anim_seconds * 1.5, 1),
        "credits_total": round(stills * 0.25 + anim_seconds * 1.5, 1),
    }
    return {"fps": fps, "estimate": est, "warnings": warnings, "shots": plan}


def to_markdown(result):
    e = result["estimate"]
    lines = [
        f"# Shot plan — {e['shots']} shots, {e['animated_shots']} animated, voice {e['voice_seconds']} s",
        "",
        f"Estimated Higgsfield credits: stills {e['credits_stills']} + clips {e['credits_clips']} = **{e['credits_total']}**",
        "",
    ]
    if result["warnings"]:
        lines.append("## Warnings")
        lines += [f"- {w}" for w in result["warnings"]]
        lines.append("")
    lines.append("| # | Start | End | s | Frames | Mode | Framing | BG | Voice line | Picture idea |")
    lines.append("|---|---|---|---|---|---|---|---|---|---|")
    for s in result["shots"]:
        lines.append(f"| {s['shot']} | {s['start']} | {s['end']} | {s['seconds']} | {s['frames']} | {s['mode']} | {s['framing']} | {s['background']} | {s['line']} | {s['picture_idea']} |")
    lines.append("")
    lines.append("Fill the Picture idea column: one clear thing to look at per shot, a Pinoy prop in every frame. Framing and BG (A = warm cream, B = sky blue) are suggestions that already alternate; change them when the story needs it, e.g. switch BG when the script turns from problem to answer.")
    return "\n".join(lines)


def demo_words():
    text = ("Isang maliit na puno. Presyo: isang milyon. Bakit? Sa dulo nito, alam mo na kung bakit may bagay na mahal "
            "hindi dahil malaki, kundi dahil matagal. Si Lia, nakita niya sa plant show ang bonsai na kasing laki ng "
            "kanyang kamay. Tag-price: siyam na raan at walumpung libo. Tumawa siya. Tapos tumingin siya sa label. "
            "Edad: walumpu't anim na taon. Unang dahilan: oras. Hindi mo mabibili ang walumpu't anim na taon. Kaya ang "
            "binabayaran mo, hindi ang puno, kundi ang panahon na inalagaan ito. Kaya pala kahit maliit, mahal. Pero teka. "
            "May bonsai na limang taon lang, limampung libo na. Hindi oras ang sagot doon. Ano?")
    words, t = [], 0.0
    for w in text.split():
        dur = 0.22 + 0.05 * len(w)
        words.append({"word": w, "start": round(t, 3), "end": round(t + dur, 3)})
        t += dur + (0.35 if w.endswith(SENTENCE_END) else 0.08)
    return words


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("timestamps", nargs="?", help="JSON with word timestamps")
    ap.add_argument("--target", type=float, default=4.5)
    ap.add_argument("--min", dest="min_len", type=float, default=3.0)
    ap.add_argument("--max", dest="max_len", type=float, default=6.0)
    ap.add_argument("--animate-ratio", type=float, default=0.28)
    ap.add_argument("--fps", type=int, default=24)
    ap.add_argument("--out", help="write JSON plan here")
    ap.add_argument("--md", help="write Markdown table here")
    ap.add_argument("--demo", action="store_true", help="run on built-in sample")
    a = ap.parse_args()

    duration = None
    if a.demo:
        words = demo_words()
    elif a.timestamps:
        words, duration = load_words(a.timestamps)
    else:
        ap.error("give a timestamps file or --demo")

    result = build_plan(words, a.target, a.min_len, a.max_len, a.animate_ratio, a.fps, duration)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
    md = to_markdown(result)
    if a.md:
        with open(a.md, "w", encoding="utf-8") as f:
            f.write(md)
    print(md)


if __name__ == "__main__":
    main()
