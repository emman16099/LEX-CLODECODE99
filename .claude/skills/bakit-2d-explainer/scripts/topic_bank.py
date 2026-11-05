#!/usr/bin/env python3
"""Rank the topic bank and check a month plan against the mix rules.

    python3 topic_bank.py assets/topic-bank.csv                 # ranked unposted ideas
    python3 topic_bank.py assets/topic-bank.csv --month 2026-12 # plan + mix check
    python3 topic_bank.py assets/topic-bank.csv --review        # posted videos with CTR/AVP

The CSV columns are documented in references/ideation-pipeline.md. Rows with
status killed or posted are left out of the ranking. The month plan takes
shortlist/approved rows, puts deadline rows first, then fills by score while
rotating segments, and prints warnings when the lane mix or rotation breaks.
"""
import argparse
import csv
import sys
from collections import Counter

AXES = ["pamilyar", "kontradiksyon", "hanap", "funnel", "drawable"]


def load(path):
    with open(path, newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        try:
            r["_total"] = int(r.get("total") or 0) or sum(int(r.get(a) or 0) for a in AXES)
        except ValueError:
            r["_total"] = 0
    return rows


def table(rows, cols):
    widths = {c: max(len(c), *(len(str(r.get(c, ""))) for r in rows)) for c in cols} if rows else {c: len(c) for c in cols}
    line = " | ".join(c.ljust(widths[c]) for c in cols)
    print(line)
    print("-" * len(line))
    for r in rows:
        print(" | ".join(str(r.get(c, "")).ljust(widths[c]) for c in cols))


def rank(rows):
    live = [r for r in rows if r.get("status") not in ("killed", "posted")]
    live.sort(key=lambda r: (-r["_total"], r.get("deadline") or "9999"))
    for r in live:
        r["total"] = r["_total"]
    table(live, ["id", "total", "status", "lane", "segment", "deadline", "question"])
    low = [r for r in live if r["_total"] < 18]
    if low:
        print(f"\n{len(low)} idea(s) below 18 are still in the pool; reshape or kill them.")


def month_plan(rows, month, slots):
    cand = [r for r in rows if r.get("status") in ("shortlist", "approved") and r["_total"] >= 18]
    dated = sorted([r for r in cand if (r.get("deadline") or "").startswith(month)], key=lambda r: r["deadline"])
    rest = sorted([r for r in cand if r not in dated], key=lambda r: -r["_total"])
    plan = dated[:slots]
    seen = Counter(r.get("segment") for r in plan)
    while len(plan) < slots and rest:
        # prefer a segment not used in the last 3 picks (rotation), else best score
        recent = {r.get("segment") for r in plan[-3:]}
        pick = next((r for r in rest if r.get("segment") not in recent), rest[0])
        rest.remove(pick)
        plan.append(pick)
        seen[pick.get("segment")] += 1
    if len(plan) > 5:
        # move the highest-kontradiksyon pick to the middle of the month
        hot = max(plan, key=lambda r: int(r.get("kontradiksyon") or 0))
        plan.remove(hot)
        plan.insert(len(plan) // 2, hot)
    for i, r in enumerate(plan, 1):
        r["slot"] = i
        r["total"] = r["_total"]
    print(f"Month plan {month}: {len(plan)} of {slots} slots\n")
    table(plan, ["slot", "id", "total", "lane", "segment", "deadline", "question"])

    warnings = []
    lanes = Counter(r.get("lane") for r in plan)
    n = max(len(plan), 1)
    if lanes["ads"] / n > 0.3:
        warnings.append(f"Ads lane is {lanes['ads']}/{n}; above 20-30% the channel reads as tech, not negosyo.")
    if lanes["seasonal"] / n > 0.3:
        warnings.append(f"Seasonal is {lanes['seasonal']}/{n}; the evergreen library is what compounds.")
    if lanes["evergreen"] / n < 0.5:
        warnings.append(f"Evergreen is only {lanes['evergreen']}/{n}; aim for about 60%.")
    for seg in ("sari-sari", "online-seller", "food-cart"):
        first = next((r["slot"] for r in plan if r.get("segment") == seg), None)
        if first is None:
            warnings.append(f"No {seg} video this month; that audience never sees itself.")
        elif first > 4:
            warnings.append(f"First {seg} video is slot {first}; rotate it into the first four.")
    if len(plan) < slots:
        warnings.append(f"Only {len(plan)} shortlisted ideas at 18+; refill the pool (Step 1) before planning.")
    print("\nMix check:", "OK" if not warnings else "")
    for w in warnings:
        print(" -", w)


def review(rows):
    posted = [r for r in rows if r.get("status") == "posted"]
    if not posted:
        print("No posted videos with results yet.")
        return
    table(posted, ["id", "posted", "ctr", "avp", "shape", "segment", "lane", "lesson"])
    by_shape = Counter()
    for r in posted:
        try:
            by_shape[r.get("shape")] += float(r.get("avp") or 0)
        except ValueError:
            pass
    if by_shape:
        best = by_shape.most_common(1)[0][0]
        print(f"\nShape with the most AVP so far: {best}. Weight it up next month, but keep testing the others.")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv")
    ap.add_argument("--month", help="YYYY-MM to build a plan for")
    ap.add_argument("--slots", type=int, default=10, help="videos in the month (default 10)")
    ap.add_argument("--review", action="store_true", help="show posted results")
    a = ap.parse_args()
    rows = load(a.csv)
    if a.review:
        review(rows)
    elif a.month:
        month_plan(rows, a.month, a.slots)
    else:
        rank(rows)


if __name__ == "__main__":
    main()
