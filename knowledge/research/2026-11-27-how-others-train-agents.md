# How other people train their AI agents (research, 2026-11-27)

## 1. Almost nobody changes the model itself
Most builders leave the AI model as it is and improve what goes *around* it:
instructions, skills, memory/knowledge files, tools, and tests.
Changing the model ("fine-tuning") is done last, and only for behaviour that
stays the same for months. Facts that change (platform tips, trends) belong in
files the agent reads, not in the model.
- https://lofingo.com/blog/how-to-train-ai-agent-2026-evals-prompts-tools-memory-fine-tuning
- https://vectorize.io/articles/how-do-ai-agents-learn
- https://www.getorchestra.io/guides/train-ai-agent

Common order: define the task → write tests (30–50 real examples) → fix
instructions → fix tools → fix memory/knowledge → add checks → fine-tune last.

## 2. The 5 levels of a marketing agent (Virlo)
1. Generic one-line prompts.
2. Detailed skill files + swipe files (saved examples).
3. Skills + **one brand foundation file** every skill reads.
4. Agents that run on **live data** (outlier videos, hooks) by themselves.
5. Teams of agents that share memory and **learn from each week's results**.
- https://virlo.ai/resources/agentic-marketing (vendor — sells the data layer)

## 3. Marketing agents learn mostly from their OWN numbers
Ad/content agents read results back (CTR, thumb-stop rate, hook retention,
cost per lead), keep winners, kill losers, and make the next batch from what
converted. "Ungrounded generation produces plausible-sounding ads based on
training data, not on what converts for this brand."
- https://superscale.ai/learn/what-is-an-ai-marketing-agent/ (vendor)
- https://siinxu.github.io/agent-academy/r/coreyhaines31-marketingskills-skills-ad-creative/
- https://socialmediastrategyhq.com/insights/how-social-media-agencies-are-using-ai-to-10x-content-output

## 4. Self-improving skills: learn from mistakes and corrections
Loop: mistake → reflect (what went wrong, why) → turn it into a general rule
→ write it to a file → the agent reads it next time.
Good versions make a **person approve** a rule before it becomes permanent,
because a wrong rule repeats its mistake every time.
- https://viktor.com/blog/self-improving-skills
- https://github.com/borghei/Claude-Skills/blob/main/engineering/self-improving-agent/SKILL.md
- https://www.developersdigest.tech/blog/continual-learning-claude-code

## 5. Test the skill, don't just trust it
Run the same request with and without the skill in a fresh session and compare.
- https://code.claude.com/docs/en/skills

## Where LEX-CLODECODE99 stands (vs. the levels above)
| Piece | Status |
|---|---|
| Purpose file | Done (`PURPOSE.md`) |
| Learning skill + knowledge base | Done (`learn-from-tutorials`, `knowledge/`) |
| Brand foundation file (customer, offer, voice) | Missing — open questions in PURPOSE.md |
| Feedback loop from our own ads/posts | Missing — Meta Ads connector is available |
| Learn-from-corrections loop | Missing |
| Tests (evals) for the skills | Missing |
