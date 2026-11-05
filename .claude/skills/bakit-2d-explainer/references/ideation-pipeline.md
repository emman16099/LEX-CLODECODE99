# Ideation pipeline — from empty pool to "post this one"

Read this when Manny asks for topic ideas, a content calendar, "ano ang susunod," or when a video just finished and the next one needs choosing. Run it monthly for the calendar and weekly to refill the pool. The score card in `topic-and-hook-playbook.md` is the judge; this file is the search that feeds it and the decision rules that follow it.

Why a pipeline and not a brainstorm: a brainstorm produces topics Claude finds interesting. The pipeline produces topics Filipino small-business owners are already asking about, and that is the only kind that travels.

## The topic bank

Keep one CSV at `assets/topic-bank.csv` (template there, columns below). Every idea that survives Step 2 gets a row; every published video gets its results filled in. Rank it with:

```
python3 scripts/topic_bank.py assets/topic-bank.csv            # ranked table of unposted ideas
python3 scripts/topic_bank.py assets/topic-bank.csv --month 2026-12   # month plan with mix check
```

Columns: `id, added, question, shape, segment, lane, source, pamilyar, kontradiksyon, hanap, funnel, drawable, total, demand_note, deadline, status, posted, ctr, avp, lesson`.
- `shape`: one of the six shapes in the playbook (mahal-maliit, nandito-pero-hindi, dati-meron, lahat-gumagawa, ganito-pala, tunay-na-dahilan).
- `segment`: sari-sari, online-seller, food-cart, service, ofw, general.
- `lane`: evergreen, ads, seasonal.
- `status`: pool, shortlist, approved, scripted, posted, killed.

## Step 1 — Fill the pool (weekly, ~30 min, five sources)

Work the sources in this order; the first two are worth more than the rest.

1. **Client and viewer questions.** Ask Manny for the questions 322 clients asked this week, and read the channel's new comments. Write each as a question. Source tag: `client` or `comment`. A paying client's question is the strongest signal we have that thousands of non-clients share it.
2. **Competitor breakouts.** Check the Tagalog explainer channels in `research-notes.md` (EhMagkano?, Kaalaman, The Taglish Explainer) and Kok Bisa? for videos at 3× or more of the channel's usual views. Record the *shape* that made it travel, then find our own topic in that shape. Never take the topic itself. Source tag: `breakout`.
3. **Search demand.** Type `bakit `, `paano kumita `, `bakit mahal `, `bakit lugi ` into YouTube and Google and copy the autocomplete lines. Skim two Facebook groups for Pinoy online sellers or sari-sari owners for repeated questions. Source tag: `search` / `group`. If web tools are not available in the session, say so and mark `hanap` as an estimate.
4. **The Filipino calendar.** Fixed dates that create questions: 11.11 and 12.12 sales; 13th month pay due Dec 15; "petsa de peligro" early January; BIR deadlines Jan–Apr; back-to-school June; Undas Nov 1; Christmas bonus spending. Seasonal ideas get a `deadline` (publish 7–10 days before the date). Source tag: `calendar`.
5. **Manny's ads lane.** What he explained on client calls this week: boost post vs ads manager, cost per click, retargeting, why an ad was rejected. Source tag: `ads`.

Aim for 20–30 raw ideas. Fewer than 15 means a source was skipped; go back.

## Step 2 — Shape check (kills about half)

Rewrite every raw idea as a Tagalog "Bakit / Paano / Ano" question that names a familiar thing and a contradiction. "Paano gumawa ng business plan" has no contradiction and dies. "Bakit may negosyo na puno ng tao pero lugi" lives. Record the shape. If an idea cannot be reshaped in two tries, mark it `killed` with a one-word reason; do not keep it around hoping.

## Step 3 — Score (the card)

Score the survivors on the five axes, 0–5 each. Keep 18 and above as `shortlist`. Be hard on `funnel`: a 5 means Manny could add one sentence at the end that leads to his service without it feeling pasted on.

## Step 4 — Demand check (top 8 only)

For each shortlist idea write one line in `demand_note` with three facts:
- Does autocomplete suggest this question (yes / no / close)?
- How many Tagalog videos already answer it, and are they good (count + one word)?
- Is there a gap? The best bet is "many ask, few good Tagalog answers." Lower an idea with ten good answers already, even if its card says 24.

## Step 5 — Build the month, not one video

At 2–3 videos a week the month holds 8–12. Pick for the mix, in this order:
1. **Deadlines first.** Seasonal ideas slot by their publish-by date.
2. **Lane mix** about 60% evergreen, 20% ads, 20% seasonal. The ads lane is Manny's reason for the channel, but if it leads the month the channel reads as "tech" and the negosyo audience drifts.
3. **Segment rotation.** In any 4 videos, sari-sari, online-seller and food-cart each appear once. A viewer should see their own shop within the first week of finding the channel.
4. **Biggest surprise mid-month.** Put the highest-kontradiksyon idea around video 5–6, when the first batch's viewers are deciding whether to stay.
5. **Shorts pair.** Every long video spawns two Shorts (playbook); no separate Shorts topics.

The script prints a mix check and flags a month that breaks these rules.

## Step 6 — Pre-mortem (per pick, before asking Manny)

Three questions, each needs a yes:
- **Source:** can every number be named (DTI, PSA, BSP, company report, named article)? If a key number has no source, the video waits.
- **Drawable:** can Lia and Robo show every beat with two or three props from the style bible, without a new recurring character? A new character costs an approval and a sheet; schedule it later.
- **Safe:** could the title read as an attack on a real brand or person? "Bakit nawala ang Ministop" is a story. "Bakit scam ang X" is a lawsuit. Rewrite or drop.

## Step 7 — Decision

Present Manny with the month plan: for each pick, the question, shape, segment, lane, score, demand note, deadline, and one hook from the playbook. Ask for approval of topics and hooks together (approval point 1). Mark approved rows `approved`; move the rest back to `pool` with their notes so next month starts warm.

## Step 8 — Learn (7 days after each post)

Fill `ctr`, `avp`, and `lesson`. Then look across the bank:
- Which shapes and segments have the best CTR? Weight them up next month.
- Which lane holds AVP? If ads-lane videos hold 50%+ and evergreen trivia drops to 30%, the audience is telling you what the channel is for.
- A topic that scored 24 and flopped teaches more than one that scored 19 and worked. Write the lesson in one sentence, no blame.

## What the director should refuse

- A topic because it is trending today. Cartoon production takes days; by post time the trend is gone and the viewers it brings are the wrong viewers.
- Two questions in one video. Split it; both go in the bank.
- A pick made on vibes without a card. If Manny insists, note "override" in `lesson` so the review can show whether his instinct beat the card.
