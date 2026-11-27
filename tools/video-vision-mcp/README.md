# Video Vision MCP: let Claude watch videos

Free and runs on your own computer. It cuts a video into time-stamped frame grids and writes down the speech with Whisper.
Source: https://github.com/OAMaestro/video-vision-mcp (MIT), pinned to commit `cb85427` (code reviewed 2026-11-27).

## Install (one command)
```bash
bash tools/video-vision-mcp/install.sh
```
Then **start a new Claude Code session** so the `video-vision` tools load. Check with `claude mcp list` (it should say `video-vision … √ Connected`).

## Use it
Just ask Claude:
- "Watch `/path/to/video.mp4` in detailed mode and give me a second-by-second shot list."
- "Watch this TikTok/YouTube link and tell me how they edited it." *(links only work on your own computer; see the limits below)*

Tools: `analyze_video` (frames + transcript), `extract_frames`, `extract_frame_at`, `get_transcript`, `transcribe_audio`, `get_video_info`, `create_frame_grid`, `cleanup`.

## Why not the README's `npx @oamaestro/video-vision-mcp`?
1. **That package isn't on npm** (checked 2026-11-27). If someone else ever publishes under that name, the command would run their code.
2. That command starts the command-line tool, not the MCP server. The MCP server is `dist/index.js`.

## Fixes applied (`fixes.patch`)
1. **Speech-to-text was broken in Node.js.** It passed a file path to Whisper, which can't open files in Node ("AudioContext is not available"). Now it reads the WAV samples and passes those.
2. Uses the smaller **q8 Whisper model** (faster on CPU, slightly less accurate).

## Limits
- **Cloud sessions:** YouTube and the yt-dlp download from GitHub are blocked. Use local files: download the MP4 and upload it.
- **Own computer:** YouTube/TikTok links work. Private or login-only videos need a `cookies.txt`.
- Whisper "base" is small. It makes small mistakes (it heard "gas" for "gaps"). Good enough for shot lists and scripts.
- First run on a link downloads yt-dlp to `~/.oamaestro/bin/`. Temp files go to `~/.oamaestro/sessions/`.
