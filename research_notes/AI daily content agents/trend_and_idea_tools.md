# Trend-discovery, creator-ideation, and inbox/newsletter-to-post tools (as of 2026-11-26)

Method note: direct WebFetch to most product domains was blocked by this session's network sandbox, so I read the official pages through the Perplexity Context API (fetched 2026-11-25/26) and Perplexity search. Every URL below is one whose content I actually saw in a tool result. Prices are list prices shown on the page on the fetch date. Several pages showed Black Friday 2026 promos; I flag those where relevant.

Legend for "Inputs": GT = Google/search trends; SOC = social platform trends/outliers (TikTok/IG/YT); NEWS = news/articles; EMAIL = email/newsletters; OWN = user's own channel/account performance. "Learns" = the product says it adapts to the user's own results or feedback.

## Creator ideation tools (vidIQ, TubeBuddy, Spotter Studio, Sandcastles, Subscribr, 1of10, OutlierKit, Viewstats, Virlo, Creator Hooks): what they do and which inputs they use

### Takeaway
The YouTube-native tools (vidIQ, TubeBuddy, Subscribr, 1of10, OutlierKit, Viewstats) now all have "what to make next" features. They take "outliers" (videos beating their channel's average) plus the user's own channel history as inputs. vidIQ Daily Ideas and TubeBuddy Next Video Ideas are the only ones that explicitly push fresh, personalized ideas every day, and they say they adapt to the user's channel and to accept/dismiss feedback. Short-form tools (Sandcastles, Virlo) are built around cross-platform outlier databases rather than search trends. Spotter Studio is shut down. Creator Hooks is a newsletter, not an ideation tool.

### Cited Findings

**1. vidIQ Daily Ideas** (YouTube). Active.
- Gives daily video ideas "tailored to your niche based on what's trending now." It scans "your channel's history, identifying related keywords, examining similar successful YouTube videos" and each idea gets a View Prediction score (Very High/High/Medium/Low) — [vidIQ Daily Ideas](https://vidiq.com/features/daily-ideas/)
- Inputs: the user's own videos (tags, titles, descriptions), "channels that produce similar content," and trending topics. It is "Available on every vidIQ plan, including Free" — [vidIQ Daily Ideas](https://vidiq.com/features/daily-ideas/)
- Learns: "Saving and dismissing ideas will give our algorithm a good direction on what kind of ideas you prefer," and "if you start posting new content, Personalized Ideas should evolve over time" — [vidIQ Help: Personalized and Customized Video Ideas](https://support.vidiq.com/en/articles/7993395-personalized-and-customized-video-ideas)
- Daily quota: Free 3 ideas/day, Pro 10/day, Boost and higher 50/day. The ideas are optimized for English only — [vidIQ Help](https://support.vidiq.com/en/articles/7993395-personalized-and-customized-video-ideas)
- Pricing: a competitor's comparison table puts vidIQ's top individual plan, Max, at $49/mo (Sept 2026). This is competitor-sourced; I did not see it on vidIQ's own pricing page — [TubeBuddy pricing/BF page](https://www.tubebuddy.com/pricing)

**2. vidIQ AI Coach** (YouTube). Active.
- A chat assistant that "connects to your channel data and turns your actual analytics into a clear plan for your next upload." It can "Build a content plan that fits your niche, cadence, and goals." Basic idea generation is free. It needs "at least two videos within the last 60 days" — [vidIQ AI Coach](https://vidiq.com/features/ai-youtube-coach/)
- The "Give me video ideas" prompt "Generates tailored video ideas based on your channel's data, previous successful videos, or trending topics" — [vidIQ Help: AI Coach](https://support.vidiq.com/en/articles/8017871-ai-coach)
- vidIQ also advertises an official Claude connector for "live YouTube analytics, keyword research, trends, and outlier detection across 135M+ channels" — [vidIQ (Creator Hooks partner page)](https://vidiq.com/creatorhooks)

**3. TubeBuddy Next Video Ideas** (YouTube). Active. Labelled "NEW" in 2026.
- "We analyze your actual channel: your videos, your comments, your niche — and weigh it against millions of videos across thousands of trends." It mines comment-section questions and requests to suggest ideas. Users swipe to accept or reject ideas, which are "ranked by potential." "Two creators never get the same list." — [TubeBuddy Next Video Ideas](https://www.tubebuddy.com/tools/next-video-ideas)
- Inputs: OWN (videos, comments, past hits), SOC (YouTube trend detection). Learns: says it analyzes what has and hasn't worked on your channel; accept/reject feedback exists — [TubeBuddy Next Video Ideas](https://www.tubebuddy.com/tools/next-video-ideas)
- Pricing (Black Friday page, Nov 2026): Pro $16/mo regular ($8/mo on the 50%-off annual deal) with "Limited access to Next Video Ideas." Legend $34/mo regular ($17/mo BF annual) with "Unlimited Next Video Ideas." Enterprise is custom — [TubeBuddy pricing](https://www.tubebuddy.com/pricing)

**4. Spotter Studio**: SHUT DOWN to the public.
- Spotter shut off public access to its gen-AI suite Studio and kept it as an internal tool. When public, Studio "would digest a creator's entire channel and use that data to... cold-suggest new video topics and draft thumbnails" — [Tubefilter, 2025-10-22](https://www.tubefilter.com/2025/10/22/spotter-studio-shutdown-layoffs/)
- Public access ended October 2025. When I fetched spotterstudio.com on 2026-11-25 it resolved to spotter.com (a brand-deals site) — [Spotter (spotterstudio.com redirect)](https://www.spotterstudio.com/); also [Creator Handbook](https://www.creatorhandbook.net/spotter-ends-public-access-to-studio-ai-suite-announces-layoffs/)
- Historical price $49/mo or $299/yr. This comes from a competitor's review — [OutlierKit blog](https://outlierkit.com/blog/spotterstudio-review-features-alternatives)

**5. Sandcastles** (short-form: IG, TikTok, YT Shorts). Active.
- "Find outlier videos in your niche, understand why they went viral, and remix them to create your next hit." It covers channel tracking "across Instagram, Tiktok and YouTube," hook templates, and script writing, from a "database with millions of validated outliers" — [Sandcastles](https://sandcastles.ai/)
- Inputs: SOC (outliers from tracked competitors), OWN (Pro includes "Personal analytics to track your content performance" and "Deep-dive content strategy audits on your channels"). The page makes no explicit claim that idea generation learns from the user's results.
- Pricing: Pro $49/mo ($39 annual), Visionary $99 ($79 annual), Titan $499 ($399 annual). It is credit-based, and the Pro plan includes an MCP connector — [Sandcastles](https://sandcastles.ai/)

**6. Subscribr** (YouTube). Active.
- "Viral YouTube Ideas: A fresh set of video ideas every day, pulled from what is working in your niche this week." Its "Ideation bot mines 35M+ viral videos." "You paste your channel link, and we tell you what's broken, what your winners had in common, and exactly what to make next" — [Subscribr](https://subscribr.ai/)
- Inputs: SOC (outlier database), OWN ("Pulls your real numbers. Views, retention, what overperformed"). It works with Claude/ChatGPT via MCP — [Subscribr](https://subscribr.ai/)
- Pricing: "Start for $0." Growth is $99/mo and includes 8 finished eight-minute videos — [Subscribr](https://subscribr.ai/)

**7. 1of10** (YouTube). Active.
- "YouTube Idea Generator: Generate video ideas tailored to your channel, based on real data from YouTube." It finds outliers "10x to 100x better than a channel's average" and offers trending formats and competitor tracking — [1of10](https://1of10.com/)
- Inputs: SOC (YouTube outliers), OWN ("tailored to your channel"). The page makes no explicit claim that it learns from the user's results.
- Pricing: Free $0 (60 credits), Basic $19/mo, Pro $89/mo, Ultra $4,999/yr. Black Friday: Pro yearly $414 instead of $828 until Nov 30 — [1of10](https://1of10.com/)

**8. OutlierKit** (YouTube, aimed at coaches and consultants). Active.
- "OutlierKit tells you what to make next: you name one channel your clients already watch, and it maps the whole field around it." Its output includes "Three topics to film next, ranked by how far each beat its channel." It uses "All public data, nothing to connect" — [OutlierKit](https://outlierkit.com/)
- Inputs: SOC (public YouTube outliers), keyword research. OWN is not required. Learns: no.
- Pricing (quarterly billing): Hobby $33/mo ($99/qtr), Pro $66.33/mo ($199/qtr), Max $266.33/mo ($799/qtr). The first 30 credits are free. The page also says "Plans from $49/mo," which is likely the monthly-billing price, so the page is internally inconsistent — [OutlierKit](https://outlierkit.com/)

**9. Viewstats** (YouTube; MrBeast-affiliated). Active.
- "Create video ideas, titles, and thumbnails that go viral... Track trends, analyze competitors, find outlier videos," built on "real-time YouTube data" — [Viewstats](https://www.viewstats.com/)
- Pricing: Business starts at $249/mo. The Pro price did not render on the fetched page. TubeBuddy's comparison lists "ViewStats $49.99/mo Pro" (Sept 2026, competitor-sourced) — [Viewstats](https://www.viewstats.com/); [TubeBuddy pricing](https://www.tubebuddy.com/pricing)

**10. Virlo** (TikTok, IG Reels, YT Shorts, Meta Ads). Active.
- "Set up a content marketing agent that finds outlier videos in your niche across TikTok, Instagram and YouTube, breaks down exactly why they went viral, then turns them into scripts in your voice." It searches "14.7M+ outlier videos" and "Runs once, or keeps searching every day, week or month." It also has "Content trends: Topics picking up or fading in your niche, week to week" — [Virlo](https://virlo.ai/)
- Inputs: SOC and competitor tracking. Learns from own results: not claimed. Automations deliver to Slack, email, and Notion.
- Pricing: Starter $49/mo, Pro $199/mo, Enterprise $499/mo. 7-day free trial — [Virlo](https://virlo.ai/)

**11. Creator Hooks**: a newsletter, not a software tool.
- "Sign up for the Creator Hooks newsletter... You'll learn to write better YouTube titles in 5 minutes per week and it's free." The site also offers a free title analyzer and "103 YouTube Title A/B Tests" — [Creator Hooks](https://creatorhooks.com/)
- Creator Hooks has an affiliate landing page on vidIQ ($1 30-day trial) — [vidIQ/creatorhooks](https://vidiq.com/creatorhooks)

**12. YouTube Studio: Inspiration tab (being deprecated) and Ask Studio** (native, free).
- Inspiration tab: "you will see nine suggested ideas based on your channel's data." YouTube says "Starting August 2026, we are gradually deprecating the Inspiration tab. For brainstorming content ideas, use Ask Studio" — [YouTube Help: Inspiration tab](https://support.google.com/youtube/answer/15575509?hl=en)
- Ask Studio "uses large language models... to answer a wide array of questions about your channel performance, summarize video comments, and generate video ideas, titles, and thumbnail options" — [YouTube Help: Ask Studio](https://support.google.com/youtube/answer/16291691?hl=en)
- The Inspiration tab tells creators "why" an idea could work, "Pulling from audience behavior" — [YouTube Blog, Made on YouTube 2025](https://blog.youtube/news-and-events/youtube-studio-made-on-youtube-2025/)

**13. TikTok Creator Search Insights** (native, free, select regions).
- Surfaces "topics people are searching for on TikTok." Topics can be sorted by category or "For You (topics related to the type of content you create)," and filtered for "content gap topics," meaning topics that are "searched for often, but aren't featured in a large number of videos" — [TikTok Newsroom](https://newsroom.tiktok.com/creator-search-insights?lang=en)
- Inputs: in-app search demand (search trends), OWN content type, and followers' searches ("Searches by followers") — [TikTok Shop Academy](https://seller-us.tiktok.com/university/essay?knowledge_id=7888324481599278&lang=en)

### Inferences
- "Learns from your results" is explicitly claimed only by vidIQ (evolves with new uploads; save/dismiss feedback), TubeBuddy Next Video Ideas (channel track record; accept/reject), and the 2025-26 startups covered in the fourth section. The outlier tools (1of10, OutlierKit, Virlo, Sandcastles) mostly rank ideas by other channels' over-performance.
- None of the YouTube tools say they use Google Trends or news as a named input. Their "trends" are YouTube-internal (similar channels and outliers).
- Native platform tools (YouTube Ask Studio, TikTok Creator Search Insights) are free and have first-party audience and search data that third parties lack.

### Gaps
- I could not see a current vidIQ pricing page directly (Free/Pro/Boost/Max amounts). The only figure is TubeBuddy's competitor table.
- The Viewstats Pro price did not render on its own site.
- I found no direct evidence that Subscribr's or 1of10's ideas re-rank based on how the user's published videos performed.

## Trend tools (Exploding Topics, Glimpse, Google Trends, TikTok Creative Center, Trendpop, SparkToro, Feedly AI, BuzzSumo, Meltwater): which explicitly suggest what to post?

### Takeaway
Most trend tools show what is rising but stop short of telling a creator what to post. BuzzSumo is the clear exception: it explicitly generates "content ideas and briefs." SparkToro now has a "Take Action" feature that produces headline ideas. Exploding Topics, Glimpse, Google Trends, Feedly AI, and Meltwater are research and monitoring layers. Trendpop no longer exists as a standalone product: Collab acquired it in 2022 and trendpop.com now resolves to collab.inc. TikTok Creative Center now leads with ad-creative AI (Symphony/TikTok One).

### Cited Findings

**14. Exploding Topics**. Active.
- Tracks topics across "Social media platforms, Search engines, Online forums and communities, News articles and blogs, E-commerce websites, Podcasts." Machine-learning models are combined with human curation that filters out fads (movies, TV, celebrity gossip) — [Exploding Topics](https://explodingtopics.com/)
- Suggests what to post: no. It surfaces trends. Learns from user results: no.
- Pricing: Entrepreneur $39/mo, Investor $99/mo, Business $249/mo. 7-day trial — [Exploding Topics pricing](https://explodingtopics.com/pricing)

**15. Glimpse**. Active.
- Trend platform "updated daily" with absolute search volume, a "Channel Breakdown" across TikTok, LinkedIn, Reddit, Instagram, Twitter, YouTube, Facebook, and Pinterest, trend alerts, and forecasting ("95%+ backtested accuracy" is the vendor's own claim). "Trends often show up first in search" — [Glimpse](https://meetglimpse.com/)
- Suggests what to post: no. Pricing was not shown on the fetched homepage.

**16. Google Trends**. Free.
- "Explore what the world is searching for right now. Search interest, past 24 hours," plus curated stories from the Trends Data Team — [Google Trends](https://trends.google.com/trends/)
- Suggests what to post: no. It is a raw signal.

**17. TikTok Creative Center**. Active, now ad-focused.
- The Creative Center landing page now leads with "TikTok Symphony" (AI ad generation), "Explore top-performing ads," and TikTok One's "Learn what's trending with your target audience" — [TikTok Creative Center](https://ads.tiktok.com/business/creativecenter/pc/en)
- The trend page is titled "Trend Discovery: Popular Hashtags On TikTok," but its body did not render in my fetch — [TikTok Creative Center hashtags](https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en)
- Suggests what to post: it shows trending hashtags, songs, and ads and generates ad creative. It is aimed at advertisers. For organic "what to post," TikTok's creator-facing tool is Creator Search Insights (#13).

**18. Trendpop**: ACQUIRED by Collab (2022). The standalone brand is effectively gone.
- "Collab, Inc.... has acquired Trendpop, the leading third-party short-form video database" (Feb 15, 2022) — [PR Newswire](https://www.prnewswire.com/news-releases/collab-acquires-trendpop-creating-a-first-of-its-kind-offering-to-boost-marketers-reach-on-platforms-301482820.html)
- trendpop.com now serves Collab's site. Its remaining Trendpop copy describes it as a TikTok database "for social video marketers and music labels" and promotes copyright-cleared clip licensing — [trendpop.com → collab.inc](https://www.trendpop.com/)
- YC's directory confirms the acquisition — [YC: Trendpop](https://www.ycombinator.com/companies/trendpop)

**19. SparkToro** (audience research). Active.
- Shows audience demographics, search keywords, social accounts followed, podcasts, YouTube channels, subreddits, and AI-tool usage. "Take Action turns your SparkToro insights into ready-to-use marketing tasks, from headline ideas to positioning frameworks" — [SparkToro](https://sparktoro.com/)
- Suggests what to post: partially (headline and content ideas from audience data, not trends). Pricing was not captured.

**20. Feedly AI**. Active.
- "A collection of machine learning models that gathers, analyzes, and prioritizes information from millions of sources in real-time... track topics, companies, and trends across the web" — [Feedly AI](https://feedly.com/ai)
- Suggests what to post: no. It is a news and research intelligence feed. Input: NEWS/RSS.

**21. BuzzSumo**. Active. Explicitly suggests content.
- "Be inspired by engaging topics and real-time trends... Generate content ideas and briefs at the click of a button." Its "Trending Feeds" show "the day's most viral posts – everything is published in the past 24 hours." It investigates content "across Facebook, Twitter, Reddit and YouTube" with an archive of 8bn articles — [BuzzSumo](https://buzzsumo.com/)
- Inputs: NEWS/articles and SOC engagement. Learns from own results: not claimed.
- Pricing (billed yearly): Content Creation $199/mo, PR & Comms $299/mo, a higher tier at $499/mo, Enterprise $999/mo — [BuzzSumo](https://buzzsumo.com/)

**22. Meltwater** (enterprise consumer intelligence). Active.
- "Meltwater's trend detection capabilities use AI-powered analysis to surface emerging conversations, viral content, and shifting consumer sentiment across social platforms and news." It covers Instagram, TikTok, Facebook, X, Reddit, YouTube, news, blogs, forums, reviews, and podcasts. Its "Mira" AI gives source-backed insights — [Meltwater consumer intelligence](https://www.meltwater.com/en/suite/consumer-intelligence)
- Suggests what to post: no explicit post-idea feature on that page. Pricing is not published.

### Inferences
- In this category, BuzzSumo (content ideas and briefs) is the closest to "tell me what to post." SparkToro does this partially. The others supply raw signal that an agent would need to turn into post ideas itself.
- Exploding Topics, Glimpse, and Meltwater are priced and positioned for marketers and investors, not individual creators.

### Gaps
- I could not render TikTok Creative Center's trend-page body or confirm whether it still offers organic "Trend Discovery" in the same form.
- SparkToro, Glimpse, Feedly, and Meltwater pricing was not captured.

## Tools that read an email inbox or newsletters to produce content/post ideas

### Takeaway
I found no shipping commercial product that connects to your Gmail inbox, reads newsletters you subscribe to, and outputs social post ideas as a turnkey feature. LigoSocial lists exactly this as "on the roadmap, not available yet." Two other kinds of product do exist:
- Newsletter readers (Readwise Reader, Meco) ingest newsletters and add AI summaries, but do not generate social posts.
- Newsletter-to-social repurposers (WritePat, Letterflow, WaveGen, Tugan) turn your own newsletter into posts.

The "inbox → post ideas" workflow is today done with general agents or automations: Gemini (Gmail) or Gemini Spark, n8n and Pabbly templates, or Claude Code with Gmail MCP.

### Cited Findings

**23. Readwise Reader**. Active.
- Lets you "Subscribe to your newsletters in Reader to spare your email inbox." It ingests articles, PDFs, EPUBs, email newsletters, RSS, YouTube, and X threads. "The Readwise MCP server connects Claude, ChatGPT, Cursor, or any MCP-compatible assistant directly to your library" — [Readwise Reader](https://readwise.io/read)
- Social post ideation: not native. It is possible via MCP plus an LLM.
- Pricing: $9.99/mo billed annually or $12.99/mo monthly, with a 30-day free trial — [Readwise Reader](https://readwise.io/read)

**24. Meco**. Active.
- Newsletter reader "outside the inbox" with "Daily AI audio roundups of your newsletters," "AI Text Summaries," and personalized newsletter recommendations — [Meco](https://meco.app/)
- Social post ideation: no. Pricing: a paid subscription exists; the amount was not shown.

**25. WritePat**. Active. Repurposes your own newsletter.
- "Turn one newsletter into a week of social posts." It writes platform-native posts for X, LinkedIn, Substack, Threads, and Bluesky and "auto-publishes on your schedule in your voice." It connects to Kit, Beehiiv, or Mailchimp — [WritePat](https://writepat.com/)

**26. Letterflow / WaveGen / Tugan.ai**: own-newsletter repurposers.
- Letterflow: "Paste a sent newsletter and turn it into LinkedIn posts, X posts, subject lines, and pull quotes," then schedule them — [Letterflow](https://letterflow.so/newsletter-social-media-content-tool)
- WaveGen: "Paste any Substack, Beehiiv, ConvertKit, or Mailchimp URL" to get carousels, captions, and Reels — [WaveGen](https://wavegen.ai/newsletter-to-social-posts)
- Tugan.ai: free tool that "mines it for its most shareable ideas" — [Tugan.ai](https://tugan.ai/fr/tools/newsletter-to-social-posts)

**27. LigoSocial for Gmail**: announced, NOT available.
- "Turn newsletters and important email threads into LinkedIn post ideas. It is not available yet." — [LigoSocial Gmail integration](https://ligosocial.com/integrations/gmail)

**28. Google Gemini (Gmail) / Gemini Spark**: general agent, DIY workflow.
- Futurepedia, a secondary source, describes using Gemini Spark (requires Google AI Pro or Ultra) to "scan Gmail, pull out themes & draft social content in the correct voice, every Monday, on autopilot," using a Gmail label for newsletters — [Futurepedia newsletter, 2026-08-04](https://newsletter.futurepedia.io/p/gemini-spark-reads-your-email-so-you-dont-have-to-08-04-2026)
- A creator demo prompts Gemini to "Find my latest newsletters from the last seven days... tell me if there are any ideas that will be useful for my YouTube channel" — [LinkedIn post (Tara Roskell)](https://www.linkedin.com/posts/tararoskellartist_get-the-best-bits-from-the-newsletters-you-activity-7424463043398385665-k68S)

**29. n8n / Pabbly Connect templates**: DIY automation.
- n8n template "Transform Gmail newsletters into insightful LinkedIn posts using OpenAI." It filters by sender, extracts the top news items, writes posts, and publishes to LinkedIn — [n8n template 3509](https://n8n.io/workflows/3509-transform-gmail-newsletters-into-insightful-linkedin-posts-using-openai/)
- The equivalent Pabbly Connect walkthrough — [Pabbly](https://www.pabbly.com/transform-gmail-newsletters-into-insightful-linkedin-posts-using-pabbly-connect/)

**30. Claude Code + Gmail MCP**: DIY agent pattern.
- A guide describes a daily skill that reads the Gmail inbox, scores newsletter stories by relevance, and drafts 2–3 LinkedIn posts each morning — [MindStudio blog](https://www.mindstudio.ai/blog/ai-newsletter-digest-skill-claude-code-gmail-mcp)

### Inferences
- The gap is real. Inbox-to-post-ideas exists only as roadmap items (LigoSocial) or DIY agent and automation recipes. No packaged creator product combines inbox newsletters with trend data and the user's own performance data.
- Readwise's MCP server is a ready-made newsletter ingestion layer an agent could use without touching Gmail directly.

### Gaps
- Superhuman and Shortwave AI: I did not verify whether either offers anything beyond inbox summarization and drafting. My fetch of shortwave.com timed out. I found no evidence that either generates social post ideas.
- Notion AI: I did not verify any Notion or Gmail integration marketed for social post ideation.

## 2025–2026 startups marketed as an "AI content strategist" / "AI that tells you what to post every day"

### Takeaway
2025–26 produced a wave of products positioned as an "AI content strategist," several of them YC-backed (Native F26, Vyra F26, Grocalo S26, Remix W26, Imagine AI). They are the closest match to "tells you what to post every day and learns from results." Vamos explicitly sends a daily "Today's post is ready" script and analyzes the user's own posts. Native's Norn model ranks ideas on brand, social performance, trends, and the user's approvals and rejections. Pattern "watches every post you make, then tells you what to post next."

### Cited Findings

**31. Vamos** (getvamos.ai): "Your AI content strategist" for TikTok, Instagram, YouTube.
- "Tracks millions of creators and brands across Instagram, TikTok & Meta ads and turns what's working into content for you." It "Watches the videos, reads the comments." It "Analyzes your posts: Shows what worked and what didn't on your own account, and what to repeat or drop." It "researches, creates, analyzes the results, and learns. 24/7." — [Vamos](https://getvamos.ai/)
- Daily cadence: scheduled routines send "Today's post is ready (a script, daily at 07:00)," a weekly review, and a Monday brief to your inbox — [Vamos](https://getvamos.ai/)
- Pricing: Free $0 with 200 one-time credits, 1 brand, 1 Routine. Paid tier prices were not captured — [Vamos](https://getvamos.ai/)

**32. Pattern** (pattern.io): "Agentic content strategist for short-form creators" (Product Hunt, 2026).
- "Pattern learns who you are as a creator and watches every post you make, then tells you what to post next... get a fresh content plan every week." It analyzes "thousands of viral short-form videos every week" and schedules and cross-posts to IG and TikTok — [Product Hunt: Pattern](https://www.producthunt.com/products/pattern-io?launch=pattern-6dc2a2e6-746d-41da-85eb-cb2fbdbd4ae4)
- Built by a solo founder — [Product Hunt profile](https://www.producthunt.com/@withstephen). Pricing: not captured; pattern.io failed to load.

**33. Native** (YC F26): "Native predicts what you should post, and then runs it across your socials and ads."
- Its Norn model ranks ideas using "Brand personality... Social performance: what happened after content was published... Trends... Taste: which ideas you approve, rewrite or reject." Native handles scheduling and publishing and claims "over 2000 companies" — [Launch YC: Native](https://www.ycombinator.com/launches/Vdd-native-artificial-intuition-for-marketing)
- It "runs campaigns across your channels, ads, blogs and email, right from your inbox! It tracks your competitors" — [YC: Native](https://www.ycombinator.com/companies/native)
- Learns from results: yes, explicitly. Pricing: not published on YC pages.

**34. Vyra** (YC Fall 2026): "Vyra researches what's performing well, tells creators what to film, edits it, and posts it." It pulls reference videos from Instagram and TikTok — [YC: Vyra](https://www.ycombinator.com/companies/vyra)

**35. Grocalo** (YC S26): "AI brain for creators that runs their social content... using video understanding and deep platform analytics to bottle up the taste behind each creator" — [YC: Grocalo](https://www.ycombinator.com/companies/grocalo)

**36. Remix** (YC W26): turns your photos, voice notes, messages, and social profile into posts, "even content riffing on the latest trending formats," using parallel agents that "figure out what is worth creating" — [YC: Remix](https://www.ycombinator.com/companies/remix-3)

**37. Imagine AI** (YC, B2B LinkedIn): "our content agent decides what your team should post based on data from 1M+ people," drafts posts and graphics, schedules them, and "maps engagement back to your pipeline" — [YC: Imagine AI](https://www.ycombinator.com/companies/imagine-ai)

**38. Scripe 2.0** (LinkedIn): "Your first AI content strategist for LinkedIn," launched June 12, 2025.
- Claims "1M+ daily-analyzed B2B posts," "Real-time trends," "Weekly post ideas in your style," "Post drafts... in your inbox," and "Continuous optimization based on real-time analytics" — [Product Hunt: Scripe 2.0](https://www.producthunt.com/p/scripe-2/scripe-2-0)
- Now positioned as LinkedIn-first social media management for B2B teams, with an MCP server and API — [Product Hunt: Scripe](https://www.producthunt.com/products/scripe-2)

**39. V30** (Product Hunt, 2025): "creates your 30-day content plan and tells you exactly what to post each day to turn followers into customers." Free options are available — [Product Hunt: V30](https://www.producthunt.com/posts/v30-2)
- Status: its Product Hunt pages were last updated March 2025. I found no 2026 activity, so it may be dormant (unverified).

**40. CreatorML** (YC W23): predictive AI for which "topics, titles, and thumbnails will get the most views before they upload" — [YC: CreatorML](https://www.ycombinator.com/companies/creatorml)

### Inferences
- The fully closed loop (trends + own performance + daily "post this" + learning from results) is explicitly claimed by Vamos, Native (Norn), and Pattern, and by Scripe for LinkedIn. vidIQ Daily Ideas and TubeBuddy Next Video Ideas cover it for YouTube only.
- None of these startups advertise email or newsletter inbox ingestion as an idea source. Native operates "from your inbox," but as a control surface, not as a newsletter input. Combining inbox newsletters with trends and own-performance data appears to be an unoccupied position in the market.

### Gaps
- Paid pricing for Vamos, Pattern, Native, Vyra, Grocalo, Remix, and Imagine AI was not visible on the pages I read.
- I could not load pattern.io directly; Pattern claims come from its Product Hunt pages.
- I did not verify V30's current operating status.
