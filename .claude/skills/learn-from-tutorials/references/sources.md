# Where to get the videos (tools per platform)

Checked 2026-11-27. Tool limits and credits change, so re-check if a call fails.

| Platform | Best tool | What you get | Cost | Notes |
|---|---|---|---|---|
| TikTok, Instagram/Facebook Reels, YouTube Shorts | **Sandcastles** `search_all_videos`, `top_hooks`, `top_formats` | Lists of videos with views, outlier score, hook type, format, summary | Free | Best place to find **proof** videos. `scope: all` needs a paid plan. |
| Same | **Sandcastles** `analyze_video` then `get_video_details` | Hook, structure sections, full transcript | 1 credit per new video (free if already in workspace) | Takes 1–3 minutes. Batch up to 100 in one call. |
| Same | **vidIQ** `vidiq_watch_shortform_content` | Scene-by-scene walkthrough (visuals + words) | 10 credits | Use when the lesson is visual (edits, text, framing). |
| YouTube long videos | **vidIQ** `vidiq_video_transcript` | Full transcript | 5 credits | Cheapest for long tutorials. |
| YouTube long videos | **vidIQ** `vidiq_video_watch` | Scene-by-scene walkthrough | 25 credits | Only when visuals matter. |
| YouTube (search) | **vidIQ** `vidiq_youtube_search`, `vidiq_outliers` | Find tutorials / over-performing videos | 5 credits | |
| Any web page, article, course notes | **Perplexity** `perplexity_search`, `perplexity_context` | Text and sources | — | Good for checking if platform advice is still current. |
| Facebook ads | **Meta Ad Library** `ads_library_search` | Live ads from any advertiser | Free | Ads running a long time are a proof signal. |

## Fallback order

1. Sandcastles (short-form) or vidIQ transcript (YouTube).
2. If out of credits: tell the user, and ask if they can paste the transcript
   (YouTube shows it under "…more → Show transcript").
3. On the user's own computer, open-source skills can fetch YouTube captions
   for free, e.g. `Oal36ar/ytmaxxing`, `vlaloban/youtube-knowledge`,
   `Paldom/video-to-skill`. Read their code before installing; they are third-party.

## Known limits in the cloud session

- Direct access to youtube.com and tiktok.com is blocked by the network here,
  so local tools like `yt-dlp` will not work in this container. Use the
  connected tools above.
- vidIQ was out of credits on 2026-11-27.
