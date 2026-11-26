# DIY and Open-Source "Content Producer Agent" Builds (trends / news / Reddit / Gmail + brand voice -> daily post ideas or drafts)

Research date: 2026-11-26. Method note: direct WebFetch to n8n.io was blocked in this sandbox (DNS not allowed), so n8n, GitHub, YouTube and marketplace pages were read through the Perplexity Context API (live or cached copies fetched 2026-11-24 to 2026-11-26) and Perplexity/web search snippets. Every URL below was returned by those tools; none were constructed by hand. Star counts are as shown on the fetched GitHub page.

## Master table (25 entries)

| # | Name | Platform | What it does | Inputs | Feedback loop from results? | Cost | URL |
|---|------|----------|--------------|--------|------------------------------|------|-----|
| 1 | Automated content strategy with Google Trends, News, Firecrawl & Claude AI (Allan Vaccarizi / Growth AI) | n8n | Finds fastest-growing related searches for your topics, pulls 3 Google News articles each, scrapes them, Claude writes content ideas to a Sheet per month/topic | Google Trends + Google News (SerpAPI), Firecrawl | No | Paid template, $10 (plus SerpAPI, Firecrawl, Anthropic) | https://n8n.io/workflows/7372-automated-content-strategy-with-google-trends-news-firecrawl-and-claude-ai/ |
| 2 | AI-powered multi-social media post automation: Google Trends & Perplexity AI | n8n | Twice daily pulls Google Trends, GPT picks topic, Perplexity researches, writes LinkedIn post (X/FB ready), logs to Sheets | Google Trends (SerpAPI), Perplexity | Partial: logs posts and metrics to Google Sheets, does not feed them back into generation | Free template (API costs apply) | https://n8n.io/workflows/4352-ai-powered-multi-social-media-post-automation-google-trends-and-perplexity-ai/ |
| 3 | Extract trends, auto-generate social content with AI, Reddit, Google & post | n8n | Daily: fetches Reddit, X and Google Trends, OpenAI scores relevance against a brand_voice / audience_mood setting, writes posts for X, LinkedIn, IG, FB, optional approval, posts, logs to Sheets | Reddit, X, Google Trends (SerpApi), news sentiment, brand voice field | No (tracking only) | Paid template, $20 | https://n8n.io/workflows/3560-extract-trends-auto-generate-social-content-with-ai-reddit-google-and-post/ |
| 4 | Discover viral content opportunities from Twitter, Reddit and Google Trends with Claude AI (Oneclick AI Squad) | n8n | Every 2 hours scans 3 sources, scores viral potential 0-100, Claude writes 5 ideas per trend (hooks, key points, platform), sends HTML email digest + Slack, logs to DB | X/Twitter API, Reddit, Google Trends | No | Template price not captured; author estimates about $15-30/month in APIs | https://n8n.io/workflows/13707-discover-viral-content-opportunities-from-twitter-reddit-and-google-trends-with-claude-ai |
| 5 | Plan niche content ideas from Google Trends with Gemini and Apify (Lakshay Jain) | n8n (+ GitHub companion repo) | Niche description -> Gemini plans about 8 seed terms -> Apify Google Trends rising searches -> scored ideas with title, hook, angle, "why rising", fact-check list; weekly Monday run to Sheets + Slack/Telegram | Google Trends (Apify actor) | No | Free; Apify free plan and Gemini free tier are enough to try | https://n8n.io/workflows/21914-plan-niche-content-ideas-from-google-trends-with-gemini-and-apify/ and https://github.com/lakshay-jainn/n8n-niche-trend-content-planner (0 stars, MIT) |
| 6 | Spot social media trends and generate post ideas with Claude and Google Sheets | n8n | Pulls X, Reddit, Google Trends; Claude writes ideas, captions, hashtags, visual concepts with "brand voice matching", suggests posting times, logs ideas | X, Reddit, Google Trends (no auth) | Claimed: "logs which ideas perform best" (performance tracking) | Free template | https://n8n.io/workflows/15017-spot-social-media-trends-and-generate-post-ideas-with-claude-and-google-sheets/ |
| 7 | Research Reddit trends and publish LinkedIn posts with Gemini and PostPeer (Hesham Mashhour) | n8n | Daily: picks a subreddit from Sheets, Apify scrape, AI vets ideas, Brave + Jina research, writes LinkedIn draft + Gemini image, email approval, publishes | Reddit (Apify), Brave Search web sources | Human approve/reject is recorded, not engagement | Price not captured (APIs: Apify, Brave, Eden AI, Gemini, PostPeer) | https://n8n.io/workflows/16751-research-reddit-trends-and-publish-linkedin-posts-with-gemini-and-postpeer/ |
| 8 | Publish LinkedIn posts from tech trends with Ollama AI quality checks | n8n | 6 AM: Hacker News, 8 subreddits, Product Hunt -> dedupe -> 3 drafts to a Sheets queue; Tue-Thu: AI selector + quality gate (1-10), rewrite or publish, Telegram alerts | HN, Reddit, Product Hunt; persona/brand voice in prompts | No engagement loop (AI quality gate only) | Free template; local Ollama = no LLM cost | https://n8n.io/workflows/13465-publish-linkedin-posts-from-tech-trends-with-ollama-ai-quality-checks/ |
| 9 | Transform Gmail newsletters into insightful LinkedIn posts using OpenAI | n8n | Gmail filter by newsletter sender -> OpenAI extracts top news items -> one LinkedIn post per item -> publishes | Gmail inbox (newsletters) | No | Free template | https://n8n.io/workflows/3509-transform-gmail-newsletters-into-insightful-linkedin-posts-using-openai/ |
| 10 | LinkedIn content machine: Email-approved posts with Gemini AI | n8n | Generates 10 post ideas, emails them; you reply with a number -> 3 drafts -> reply to pick -> auto-publish; tracks ideas -> drafts -> published in Sheets | Niche/audience prompt; Gmail as control channel | Human selection only | Free template (Gemini API) | https://n8n.io/workflows/8136-linkedin-content-machine-email-approved-posts-with-gemini-ai/ |
| 11 | Review social post performance and plan content experiments with Sheets and OpenAI | n8n | Imports your own post metrics (CSV or Sheets), computes cohort engagement rates, GPT-4.1-mini drafts 5 evidence-cited content experiments | Past post analytics (own data) | Yes: this is the analytics-to-plan half of a feedback loop (no trend input) | Price not captured | https://n8n.io/workflows/22323-review-social-post-performance-and-plan-content-experiments-with-sheets-and-openai/ |
| 12 | Create social media posts on Buffer from new articles using RSS and ChatGPT | Make.com | RSS article -> ChatGPT post -> Buffer | RSS news | No | Free template (Make + OpenAI usage) | https://www.make.com/templates/15169-create-social-media-posts-on-buffer-from-new-articles-using-rss-and-chatgpt |
| 13 | Create and share new articles using RSS feeds on social media with Buffer, Claude and Perplexity AI | Make.com | RSS trigger -> Perplexity research -> 2 Claude prompts -> Buffer | RSS news, Perplexity | No | Free template (API costs) | https://www.make.com/templates/14645-create-and-share-new-articles-using-rss-feeds-on-social-media-with-buffer-claude-and-perplexity-ai |
| 14 | Create LinkedIn posts from new articles using RSS feeds and OpenAI GPT-3 | Make.com | RSS -> ChatGPT -> LinkedIn post | RSS news | No | Free template | https://www.make.com/templates/13163-create-linkedin-posts-from-new-articles-using-rss-feeds-and-openai-gpt-3 |
| 15 | Generate tailored social media posts from RSS feed, and send for review via email and Slack | Zapier | RSS -> ChatGPT drafts -> email + Slack review | RSS news | No | Free template (Zapier plan + ChatGPT) | https://zapier.com/templates/details/a452bf6c8d8292f9f633c098ff531fa3865071ddd8eae0875636eb69fbfc6591 |
| 16 | Daily Content Strategy Generator (Zapier Agents template) | Zapier Agents | 8 AM daily: searches Reddit, LinkedIn, newsletters for trending topics, ranks, top 10 to Notion, briefs for top 3, Slack message | Reddit, LinkedIn, newsletters (web search) | No | Template free; Zapier Agents plan limits apply | https://zapier.com/templates/details/daily-content-strategy-generator-dc2989 |
| 17 | Viral Content Creation Agent (Zapier Agents template) | Zapier Agents | Daily: 3 trending topics in your niche, picks top, writes hook + short and long scripts, captions, hashtags, newsletter blurb, into a Google Doc + Slack | Web search for trends | No | Template free; Zapier plan | https://zapier.com/templates/details/viral-content-creation-agent |
| 18 | Social Media Manager agent (Scott Henderson) | Relevance AI marketplace | Trending topic research, content calendar, repurposing, competitor analysis, hashtag sets, posts with 3 hook variants; can run on schedule or from incoming emails | Web research, competitor sites | No | Listing price $0.00; 166 clones, 3.4 stars (5 ratings); Relevance free signup | https://marketplace.relevanceai.com/listing/a96f80c0-3bd5-4637-ab27-305aaef0fbe2 |
| 19 | AI social media agent | Gumloop | Analyzes your Instagram/TikTok content to find what works, researches niche trends/hashtags/sounds, recommends ideas each tied to a data point from your account, builds dated calendar in Google Sheets | Your IG/TikTok analytics, niche trends | Yes: ideas grounded in your own account performance | Gumloop free tier, paid from $37/month | https://www.gumloop.com/use-cases/ai-social-media-agent |
| 20 | Support Inbox Content Creator | Lindy | Scans the past 24h of customer support emails for recurring themes, drafts LinkedIn and X posts | Email inbox | No | Lindy free start, paid plans | https://www.lindy.ai/templates/support-inbox-content-creator?f61d71a4_page=2 |
| 21 | [Official Template] Turn Curated Industry News into Social Media Content ("News to Social Media Agent") | MindStudio | Finds recent news about a company/topic, turns it into ready-to-post X content; tone tunable with your own example posts | News search | No | Remixable template; MindStudio plan | https://community.mindstudio.ai/t/official-template-turn-curated-industry-news-into-social-media-content/203 |
| 22 | Social Media Monitoring for Content Ideas (automation) | Taskade | Scheduled agent "Social Editor" that knows your brand voice guide, "remembers which posts landed", adds idea tasks | Social trends, brand voice doc | Claimed memory of which posts landed | Taskade plan | https://www.taskade.com/automate/content/social-media-monitoring-for-content-ideas |
| 23 | langchain-ai/social-media-agent | GitHub (LangGraph, TypeScript) | URL -> Twitter + LinkedIn post with human-in-the-loop; LangChain runs it daily on links dropped in a Slack channel | URLs, Slack channel | No | Free, MIT; 3.1k stars; needs Anthropic, FireCrawl, Arcade keys | https://github.com/langchain-ai/social-media-agent |
| 24 | kgarbacinski/AutoViralAI | GitHub (LangGraph + Claude) | Researches viral content (HN + Threads), extracts patterns, generates variants, human approval, publishes, collects engagement after 24h and rewrites its own strategy daily | HN, Threads, own engagement metrics, knowledge base | Yes: explicit daily learning loop | Free open source; 49 stars | https://github.com/kgarbacinski/AutoViralAI |
| 25 | ZJU-REAL/Easel | GitHub (OpenClaw agent) | Discover trends -> plan topics/scripts -> create text, image, audio, video -> publish -> attribution reads plays/engagement and writes lessons back into the account profile | Hot lists, industry news, competitor activity, own analytics | Yes: "attribution" step feeds account profile | Free, Apache-2.0; 4.9k stars; China platforms (Xiaohongshu, Douyin, Zhihu, Bilibili) | https://github.com/ZJU-REAL/Easel |

Additional verified entries (beyond 25) are listed in the sections below (SocialFlow, trendflow-ai, crewAI-examples, last30days skill, Taskade agents, YouTube tutorials).

## n8n workflow templates using Google Trends, news RSS, Reddit or Gmail

### Takeaway
n8n has by far the deepest bench: at least 11 public templates matching the brief, covering Google Trends (usually via SerpAPI or Apify), Google News, Reddit, X, HN and Gmail newsletters. Most are free; two of the most complete trend-to-post ones are paid ($10 and $20). Almost none close the loop from post performance back into idea generation; the analytics half exists as a separate template (#22323).

### Cited Findings
- Template 7372 is sold for $10, created by Allan Vaccarizi; it identifies trending searches with the strongest recent growth, collects Google News articles, scrapes them and generates content suggestions, defaulting to a monthly cron (0 8 1 * *) with output columns Query / Evolution / News / Idea — [n8n 7372](https://n8n.io/workflows/7372-automated-content-strategy-with-google-trends-news-firecrawl-and-claude-ai/)
- The 7372 page links a full walkthrough video by Growth AI (94 views, French) — [YouTube](https://www.youtube.com/watch?v=dXz5OTbm4c8)
- Template 4352 is "Use for free", pulls Google Trends via SerpAPI, filters keywords with 30+ search volume, uses GPT-3.5 to pick a topic, Perplexity to research, posts at 6 AM and 6 PM daily, and logs "timestamps and metrics" to Google Sheets — [n8n 4352](https://n8n.io/workflows/4352-ai-powered-multi-social-media-post-automation-google-trends-and-perplexity-ai/)
- Template 3560 is "Buy for $20"; it fetches trends from Reddit, X and Google Trends (SerpApi), scores them with OpenAI using configurable `brand_voice` and `audience_mood` inputs, includes a news-sentiment node, runs daily, and posts to LinkedIn/Facebook/X — [n8n 3560](https://n8n.io/workflows/3560-extract-trends-auto-generate-social-content-with-ai-reddit-google-and-post/)
- Template 13707 (Oneclick AI Squad) runs every 2 hours across X, Reddit and Google Trends, calculates a 0-100 viral score, has Claude produce 5 ideas per trend with hooks, and delivers an HTML email digest + Slack; author estimates $15-30/month and notes X API may need a paid tier — [n8n 13707](https://n8n.io/workflows/13707-discover-viral-content-opportunities-from-twitter-reddit-and-google-trends-with-claude-ai)
- Template 21914 (Lakshay Jain, updated about 23 days before fetch) has Gemini plan about 8 Google Trends seed terms, fetches rising searches via an Apify actor, and returns title, hook, angle, format, why-rising and a fact-check list; Gemini free tier works — [n8n 21914](https://n8n.io/workflows/21914-plan-niche-content-ideas-from-google-trends-with-gemini-and-apify/)
- Its companion repo is MIT, 0 stars, and the author discloses "I built the Google Trends Actor this workflow uses" — [GitHub](https://github.com/lakshay-jainn/n8n-niche-trend-content-planner)
- Template 15017 is free, pulls X, Reddit and Google Trends (no auth), advertises "brand voice matching" and "Performance tracking - logs which ideas perform best" — [n8n 15017](https://n8n.io/workflows/15017-spot-social-media-trends-and-generate-post-ideas-with-claude-and-google-sheets/)
- Template 16751 runs daily, scrapes a subreddit via Apify, vets ideas with Eden AI (DeepSeek), researches with Brave Search + Jina Reader, writes a LinkedIn draft + Gemini image, sends approval email, publishes via PostPeer — [n8n 16751](https://n8n.io/workflows/16751-research-reddit-trends-and-publish-linkedin-posts-with-gemini-and-postpeer/)
- Template 13465 is free; it pulls HN, 8 subreddits and Product Hunt at 6 AM, generates 3 drafts into a Sheets queue, and on Tue/Wed/Thu an AI selector + quality gate (scored 1-10) publishes, rewrites, or skips; brand voice is set by editing prompts; uses local Ollama — [n8n 13465](https://n8n.io/workflows/13465-publish-linkedin-posts-from-tech-trends-with-ollama-ai-quality-checks/)
- Template 3509 is free; a Gmail node filters by newsletter sender, OpenAI extracts top news items, and each becomes a LinkedIn post published directly — [n8n 3509](https://n8n.io/workflows/3509-transform-gmail-newsletters-into-insightful-linkedin-posts-using-openai/)
- Template 14080 uses a Gmail trigger on a subject line with a long-form attachment (podcast transcript, newsletter), extracts 5 content pillars, produces IG carousel, LinkedIn carousel, text and media posts, with Teams approval and Blotato publishing — [n8n 14080](https://n8n.io/workflows/14080-repurpose-long-form-content-into-instagram-and-linkedin-posts-with-openai-and-teams/)
- Template 8136 emails 10 AI post ideas, you reply with a number to get 3 drafts, reply again to publish to LinkedIn; tracked in Sheets — [n8n 8136](https://n8n.io/workflows/8136-linkedin-content-machine-email-approved-posts-with-gemini-ai/)
- Template 8850 pulls its system prompt and per-platform output schemas from Google Docs (a lightweight brand knowledge base), adds web search, generates images, and sends Gmail approval before publishing — [n8n 8850](https://n8n.io/workflows/8850-ai-powered-multi-platform-social-media-content-factory-with-dynamic-system-prompts-and-gpt-4o/)
- Template 16018 looks up client brand fields (brand_voice, tone per platform, language_avoid, key_messages) in Google Sheets and runs three human-in-the-loop Gemini stages (angles, draft, quality audit) — [n8n 16018](https://n8n.io/workflows/16018-route-social-media-content-reviews-with-google-gemini-and-google-sheets/)
- Template 22323 analyzes your own post metrics from CSV/Sheets, computes cohort engagement rates and medians, and has GPT-4.1-mini draft exactly five content experiments with validated citations; it explicitly does not collect Meta Insights itself — [n8n 22323](https://n8n.io/workflows/22323-review-social-post-performance-and-plan-content-experiments-with-sheets-and-openai/)
- Template 13528 scrapes a target X account daily via Apify, has Gemini reverse-engineer the top post's structure into a template, GPT rewrites it for your niche, then posts to X, Threads, LinkedIn, FB, IG after Airtable approval — [n8n 13528](https://n8n.io/workflows/13528-create-ai-driven-social-media-posts-and-publish-to-all-major-platforms/)

### Inferences
- The closest off-the-shelf n8n match to "Google Trends + news + Reddit + brand voice -> daily ideas" is #3560 (paid) or the free #15017/#13707; for Gmail-inbox input, #3509 and #14080.
- A full loop (trends -> drafts -> publish -> analytics -> better ideas) would require chaining a trend template with #22323; no single n8n template seen does both.
- Most "Google Trends" n8n templates do not call Google directly; they rely on SerpAPI or an Apify actor (paid beyond free tiers). #13707 and #15017 claim Google Trends works with no auth.

### Gaps
- Price/"free" label was not captured for 13707, 16751, 21914, 22323, 8136 (n8n templates are usually free unless marked "Buy"; only 7372 and 3560 showed a price).
- View counts for n8n templates were not visible in fetched text.
- Claim in #15017 that it "logs which ideas perform best" was not verified against the workflow JSON.

## Make.com and Zapier templates for AI social content from trends or email

### Takeaway
Make and Zapier mostly offer simple RSS -> ChatGPT/Claude -> Buffer/LinkedIn/Facebook templates (news-driven, no Google Trends, no feedback). The more "agentic" daily ideation exists as Zapier Agents templates that do web/Reddit trend searches on a schedule and push briefs to Notion, Google Docs and Slack.

### Cited Findings
- Make template 15169 turns new RSS articles into social posts with ChatGPT and publishes via Buffer — [Make 15169](https://www.make.com/templates/15169-create-social-media-posts-on-buffer-from-new-articles-using-rss-and-chatgpt)
- Make template 14645 triggers on RSS, researches with Perplexity, uses 2 Anthropic Claude prompts, posts via Buffer — [Make 14645](https://www.make.com/templates/14645-create-and-share-new-articles-using-rss-feeds-on-social-media-with-buffer-claude-and-perplexity-ai)
- Make template 13163 generates LinkedIn posts from RSS articles with ChatGPT — [Make 13163](https://www.make.com/templates/13163-create-linkedin-posts-from-new-articles-using-rss-feeds-and-openai-gpt-3)
- Make template 17261 fetches content URLs via RSS, scrapes with BrowserAct, writes with OpenAI and publishes to Facebook; a related BrowserAct template scrapes Google News on chosen topics and produces 3 key insights + Facebook posts — [Make 17261](https://www.make.com/templates/17261-generate-social-media-posts-with-chatgpt-and-browseract); [Make BrowserAct+OpenAI](https://www.make.com/integrations/browser-act/openai-gpt-3)
- Zapier template: RSS -> ChatGPT tailored posts -> sent for review via email and Slack — [Zapier](https://zapier.com/templates/details/a452bf6c8d8292f9f633c098ff531fa3865071ddd8eae0875636eb69fbfc6591)
- Zapier template: RSS -> ChatGPT posts stored in Google Sheets — [Zapier](https://zapier.com/templates/details/07ced61006dc3d169d744fd6d922ed575468339317c13104b831a81f04aa15d1)
- Zapier template: RSS + Web Parser + ChatGPT -> Buffer scheduling — [Zapier](https://zapier.com/templates/details/f7a2a08f4f306a676b2d49525b47dec46e398c5871f6f1e13b4a58764779fe84)
- Zapier Agents "Daily Content Strategy Generator": at 8 AM searches Reddit, LinkedIn and top newsletters for trending topics, ranks by novelty/relevance, writes top 10 to Notion, briefs the top 3, sends Slack — [Zapier](https://zapier.com/templates/details/daily-content-strategy-generator-dc2989)
- Zapier Agents "Viral Content Creation Agent": daily searches 3 trending topics in your niche, writes a 5-second hook, 80-second short script, 5-minute long script, captions, hashtags and a newsletter blurb into a Google Doc, then Slack — [Zapier](https://zapier.com/templates/details/viral-content-creation-agent)
- Zapier Agents "Reddit Trend Content Generator by Kiran Shahid": takes uploaded/pasted Reddit data plus audience, platform, tone and positioning, outputs 5 content concepts with hooks into a Google Doc — [Zapier](https://zapier.com/ja/agents/templates/reddit-trend-content-generator-by-kiran-shahid-9aee66)
- Zapier Agents "Social Media Posting Agent" claims to schedule per-platform versions "based on engagement data" — [Zapier](https://zapier.com/templates/details/social-media-posting-agent-03791f)

### Inferences
- For a non-technical user, Zapier's "Daily Content Strategy Generator" is the closest daily-ideas agent template; Make is better suited for RSS-to-draft pipelines.
- No Make or Zapier template found uses Google Trends directly or reads a Gmail inbox for content ideas.

### Gaps
- No Make.com template found for Gmail -> content ideas, or for Google Trends.
- Zapier Agents pricing/limits per plan not captured.

## GitHub open-source projects (CrewAI, LangChain/LangGraph, trend-to-post)

### Takeaway
The best-known repos are LangChain's social-media-agent (3.1k stars, URL-to-post with HITL) and the CrewAI examples (6.2k stars, includes a Content Creator Flow and Instagram post crew). True trend -> draft -> publish -> learn loops exist in smaller repos (AutoViralAI, 49 stars) and in Easel (4.9k stars, China-platform focused). Many trend-to-post repos are tiny (0-50 stars) personal projects.

### Cited Findings
- langchain-ai/social-media-agent: 3.1k stars, MIT; takes a URL and generates Twitter and LinkedIn posts with a human-in-the-loop flow; can be cron'd to read a Slack channel of links "turned into posts once daily" (used internally at LangChain); needs Anthropic, LangSmith, FireCrawl, Arcade — [GitHub](https://github.com/langchain-ai/social-media-agent)
- crewAIInc/crewAI-examples: 6.2k stars; includes "Content Creator Flow - Multi-crew content generation system for blogs, LinkedIn posts, and research reports" and a "Self Evaluation Loop Flow" — [GitHub](https://github.com/crewAIInc/crewAI-examples); the older Instagram post crew README is at [GitHub](https://github.com/joaomdmoura/crewAI-examples/blob/main/instagram_post/README.md)
- kgarbacinski/AutoViralAI: 49 stars; researches viral content from HackerNews + Threads, extracts patterns, ranks variants on AI score + historical pattern performance + novelty, measures engagement after 24h, and "rewrites its own strategy" daily; reject reasons feed the learning loop — [GitHub](https://github.com/kgarbacinski/AutoViralAI)
- ZJU-REAL/Easel: 4.9k stars, Apache-2.0; five stages discover -> plan -> create -> publish -> attribution, where attribution reads plays, engagement and comments and writes effective patterns back into the account profile; targets Xiaohongshu, Douyin, Zhihu, Bilibili — [GitHub](https://github.com/ZJU-REAL/Easel)
- inbharatai/SocialFlow: 46 stars; self-hosted "AI CMO" with Scout (HN, RSS, GitHub trends at 8 AM/2 PM/8 PM), Planner, Creator, Reviewer (brand voice gate), Publisher and Analyst agents across 12 platforms; default LLM is free local Ollama; has brand-kit and analytics endpoints — [GitHub](https://github.com/inbharatai/SocialFlow)
- karthikota/trendflow-ai: 0 stars; Python CLI pulling Google Trends RSS + Reddit RSS, Gemini 2.5 Flash scores engagement and suggests angles, outputs LinkedIn, Medium and X drafts — [GitHub](https://github.com/karthikota/trendflow-ai)
- Klaudiusz321/social-media-agents: TrendScannerAgent monitors social/news for trends, ContentCreatorAgent writes per-platform posts using a brand-guidelines JSON — [GitHub](https://github.com/Klaudiusz321/social-media-agents)
- namankhandelwal1607/SocialMedia_Agent: LangGraph + RAG over company knowledge; discovers trends from Reddit and AI news, aligns with company expertise, HITL approval — [GitHub](https://github.com/namankhandelwal1607/SocialMedia_Agent)
- gabogabucho/trendingcontent-agent: two-phase skill (research Reddit, X, YouTube, TikTok, HN, Bluesky, Brave over 7-90 days, then write X threads, LinkedIn posts, IG captions), built on last30days — [GitHub](https://github.com/gabogabucho/trendingcontent-agent)
- Ahmed-Adel-Hekal/TrendPulse: Gemini-based ideas/posts/calendars with a trend engine across 14 sources including Reddit, Google News and Google Trends — [GitHub](https://github.com/Ahmed-Adel-Hekal/TrendPulse)
- The GitHub "content-automation" topic lists darkzOGx/youtube-automation-agent (5.4k stars) which "learns from analytics", and vedantdhande04/tweetytweets (84 stars) which "writes in your voice" — [GitHub topic](https://github.com/topics/content-automation)

### Inferences
- For a self-hosted build with a genuine feedback loop, AutoViralAI (LangGraph + Claude) is the clearest reference architecture; SocialFlow is the most complete English-language multi-agent "content department" but young (46 stars).
- High-star repos (LangChain, CrewAI) are frameworks/examples, not turnkey trend-to-post daily agents; they need assembly.

### Gaps
- Star counts for gabogabucho/trendingcontent-agent, TrendPulse, Klaudiusz321 and namankhandelwal1607 repos were not captured.
- Did not find a well-starred CrewAI repo specifically wired to Google Trends + Gmail.

## Agent platforms with ready-made "content strategist" / "social media manager" agents

### Takeaway
Relevance AI (free-to-clone Social Media Manager), Gumloop (AI social media agent grounded in your own IG/TikTok data), Zapier Agents (daily content strategy templates), MindStudio (official news-to-social template), Taskade (62 social agents, plus a trend-monitoring automation with brand-voice memory) and Lindy (inbox-to-content template) all have ready templates. Gumloop's agent is the only platform template seen that explicitly bases ideas on the user's own past performance.

### Cited Findings
- Relevance AI "Social Media Manager" by Scott Henderson: price $0.00, 166 clones, 3.4 stars (5 ratings); does trending topic research, calendars, repurposing, competitor analysis, hashtags, posts with 3 hook variants; agents can be triggered on a schedule or from incoming emails — [Relevance marketplace](https://marketplace.relevanceai.com/listing/a96f80c0-3bd5-4637-ab27-305aaef0fbe2)
- Gumloop "AI social media agent" analyzes your Instagram and TikTok content, researches niche trends, recommends ideas "each tied to a number from your own account", and builds a dated calendar in Google Sheets — [Gumloop](https://www.gumloop.com/use-cases/ai-social-media-agent)
- Gumloop pricing stated as starting at $37/month with a 14-day free trial (Gumloop's own blog) — [Gumloop blog](https://www.gumloop.com/blog/best-social-media-automation-tools?5e63b592_page=32)
- MindStudio official template "Turn Curated Industry News into Social Media Content" (remix link "News to Social Media Agent"); tone can be tuned by adding examples of your own posts; X block can be swapped for LinkedIn or Sheets — [MindStudio community](https://community.mindstudio.ai/t/official-template-turn-curated-industry-news-into-social-media-content/203)
- Lindy "Support Inbox Content Creator" reviews the last 24 hours of support emails to find themes and drafts LinkedIn/Twitter posts — [Lindy](https://www.lindy.ai/templates/support-inbox-content-creator?f61d71a4_page=2); Lindy also has a generic "AI Social Media Assistant" template — [Lindy](https://wf.lindy.ai/templates/ai-social-media-assistant)
- Taskade lists 62 social media agents (e.g., Cross-Platform Content Planner, Visual Content Trends Predictor) — [Taskade](https://www.taskade.com/agents/social-media); its "Social Media Trend Integration Agent" suggests content aligned with current trends — [Taskade](https://www.taskade.com/agents/digital-advertising/social-media-trend-integration)
- Taskade's "Social Media Monitoring for Content Ideas" automation runs on a schedule with an agent that "Knows your brand voice guide" and "Remembers which posts landed" — [Taskade](https://www.taskade.com/automate/content/social-media-monitoring-for-content-ideas)
- Zapier Agents templates: see Daily Content Strategy Generator and Viral Content Creation Agent above — [Zapier](https://zapier.com/templates/details/daily-content-strategy-generator-dc2989)

### Inferences
- Relevance AI's agent is the closest free "content strategist" clone-and-go option; Gumloop's is the closest to "uses my past analytics."
- Lindy's catalog leans to inbox/ops; its inbox-to-content template is the only platform template found that uses email as the idea source.

### Gaps
- No verified ready-made content-strategist agent page found for Agent.ai or Microsoft Copilot Studio in this pass (search returned nothing citable).
- Clone/usage stats for Gumloop, MindStudio, Taskade and Lindy templates not visible.

## Custom GPTs and Claude projects/skills

### Takeaway
GPT Store has many generic "social post" GPTs but they are prompt wrappers without live trend feeds or scheduling. The most notable Claude-side asset is the open-source `/last30days` Claude Code skill, which researches Reddit, X, YouTube, HN, TikTok, Polymarket and the web and has a "what's trending" discovery mode that writes content angles.

### Cited Findings
- "Social GPT - Create Social Media Posts" by Christina Kumar on ChatGPT — [ChatGPT](https://chatgpt.com/g/g-rEyKMYJHV-social-gpt-create-social-media-posts)
- GPTs Hunter lists "Viral Post Creator" (prompt starters include "What are the current trends I should include in my tweet?" and "Load documents and generate viral post"); requires ChatGPT Plus per the directory — [GPTs Hunter](https://www.gptshunter.com/gpt-store/MDAwMDM1NTk1MDA0MGIyODE4)
- mvanhorn/last30days-skill: installs via `/plugin marketplace add mvanhorn/last30days-skill`; v4.6.0 pulls posts and engagement from Reddit, X, YouTube, TikTok, HN, Polymarket, GitHub and the web; `/last30days what's trending in AI agents?` returns a ranked discovery brief with content angles; works across Claude Code, Codex, Cursor and 50+ hosts — [GitHub](https://github.com/mvanhorn/last30days-skill); [SKILL.md](https://github.com/mvanhorn/last30days-skill/blob/main/skills/last30days/SKILL.md)

### Inferences
- A Claude Project with brand-voice docs as knowledge + the last30days skill (or a trend MCP) approximates the "knowledge base + trends -> ideas" pattern, but scheduling would need Claude Code cron/routines or an external scheduler.

### Gaps
- Star count for last30days-skill not captured (README quotes a user saying it was #1 trending on GitHub, which is anecdotal).
- No published "Claude Project" template for this use case was found.

## Popular YouTube tutorials teaching this build

### Takeaway
Several creators publish step-by-step n8n builds with free downloadable JSON: Chase AI (trend scraping across YouTube, X, Reddit -> daily inbox report + Airtable), Zuber Shaik (HN trends -> Claude scoring -> scripts -> Sheets + Gmail at 6 AM), Jamie Garside (daily 8 AM Slack briefing of trending ideas with hooks).

### Cited Findings
- Chase AI, "This AI Automation Built Me 175k Followers In Under a Year (n8n Tutorial)" (2025-10-27): scrapes YouTube, X, Reddit and the web for niche trends, produces a daily inbox report and an Airtable of ideas with hook-to-outro instructions; template free via his Skool community; credits Kallaway for storyline inspiration — [YouTube](https://www.youtube.com/watch?v=m-7egcppFPk)
- Zuber Shaik, "I Built An AI Agent That Runs My Entire Content Pipeline 24/7 (n8n + Claude)" (2026-11-04): Hacker News API trends, Claude Sonnet via OpenRouter scores topics and keeps 8/10+, writes script package, saves to Sheets and emails daily at 6 AM; free workflow download — [YouTube](https://www.youtube.com/watch?v=pCZMM0tCugg)
- Jamie Garside | AI Business Growth, "I Built an AI That Finds Viral Content Ideas for Any Niche (n8n Workflow Tutorial)" (2025-09-17, 15:54): 8 AM daily, Perplexity-powered research, 5-7 trending opportunities with hooks/formats delivered to Slack; free JSON via community — [YouTube](https://www.youtube.com/watch?v=cfPHbgdpeQI)
- "Build an AI Agent That Finds Viral Video Ideas (n8n Tutorial)" (2026-01-21): pulls trending topics, hashtags and viral videos from YouTube and TikTok daily via Virlo API, logs to Sheets, sends a morning email briefing, plus a chat agent — [YouTube](https://www.youtube.com/watch?v=kcppe4vFvsw)
- AiandCodewithYar, "Automate Your Daily Social Media Content with n8n & AI Agents" (2026-09-19): 6 AM cron, Tavily search for AI news, GPT-4o-mini agent writes 25 fields to Google Sheets — [YouTube](https://www.youtube.com/watch?v=Wg0fVqIZqM8)
- "I Built a 24/7 AI Agent that Writes My LinkedIn Posts (n8n Tutorial)" (2026-01-01): daily trigger, idea agent, Tavily research, OpenRouter, Sheets — [YouTube](https://www.youtube.com/watch?v=77y-vSQm0oI)
- "How I Automated My YouTube Channel with n8n" (2026-02-26): YouTube Strategist agent analyzes competitors, trends, your channel performance and audience comments via Apify + OpenAI -> daily video ideas in Sheets (includes own-channel performance input) — [YouTube](https://www.youtube.com/watch?v=iHiQ2aSf6JY)
- Growth AI walkthrough for n8n template 7372 (French, 94 views) — [YouTube](https://www.youtube.com/watch?v=dXz5OTbm4c8)

### Inferences
- Chase AI's video is the most directly on-brief and comes from a large AI-automation channel; the Zuber Shaik one is the most recent (Nov 2026) and uses Claude.
- The "YouTube Strategist" tutorial is one of the few creator builds that feeds own-channel performance into idea generation.

### Gaps
- View counts were not visible for most videos (only the Growth AI video showed 94 views); channel name not captured for kcppe4vFvsw, 77y-vSQm0oI and iHiQ2aSf6JY.
- Did not find a widely-viewed Make.com or Zapier tutorial specifically on trend-to-post ideation in this pass.
