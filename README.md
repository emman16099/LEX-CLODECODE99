# LEX-CLODECODE99

## Reel Critic agent

Grades a reel against **your** rules, says PASS or FAIL, and writes fix prompts.

### How to use
1. Put your video in `reels/` (optional: a `.srt` caption file with the same name, so the critic can "hear" the words).
2. In Claude Code, type:
   ```
   /reel-critic reels/my-reel.mp4
   ```
3. Read the result in `reviews/my-reel/verdict.md`.

### Change the rules
Edit `.claude/skills/reel-critic/criteria.md`.
- **MUST** rules: fail one and the reel fails.
- **SCORE** rules: points out of 100. Pass mark is set at the top of the file.

### What is inside
| File | Job |
|---|---|
| `.claude/skills/reel-critic/SKILL.md` | The agent's instructions |
| `.claude/skills/reel-critic/criteria.md` | Your rules |
| `.claude/skills/reel-critic/scripts/prep_reel.py` | Cuts the video into frames, measures loudness, silences, cuts, and gets the transcript |

### Needs
`ffmpeg`. Optional: `pip install faster-whisper` for automatic transcripts.
