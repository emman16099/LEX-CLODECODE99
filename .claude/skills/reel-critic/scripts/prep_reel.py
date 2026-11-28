#!/usr/bin/env python3
"""Turn a reel into things Claude can actually look at.

Claude cannot play a video. This script breaks the reel into:
  - still frames (more of them in the first 3 seconds, where the hook lives)
  - hard numbers: size, length, loudness, silences, how often the shot changes
  - a transcript (from faster-whisper if it works, or a .srt/.txt you put next to the video)

Usage:
  python3 prep_reel.py path/to/reel.mp4 [--out reviews/<name>]
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def probe(video):
    r = run(["ffprobe", "-v", "error", "-print_format", "json",
             "-show_format", "-show_streams", str(video)])
    if r.returncode != 0:
        sys.exit(f"ffprobe could not read the file: {r.stderr.strip()}")
    data = json.loads(r.stdout)
    v = next((s for s in data["streams"] if s["codec_type"] == "video"), None)
    a = next((s for s in data["streams"] if s["codec_type"] == "audio"), None)
    if v is None:
        sys.exit("No video track found.")
    w, h = int(v["width"]), int(v["height"])
    # Phones often store vertical video sideways plus a "rotate" flag.
    rot = 0
    for sd in v.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = abs(int(float(sd["rotation"])))
    rot = rot or abs(int(v.get("tags", {}).get("rotate", 0) or 0))
    if rot in (90, 270):
        w, h = h, w
    num, den = (v.get("avg_frame_rate") or "0/1").split("/")
    fps = round(float(num) / float(den), 2) if float(den) else 0
    return {
        "duration_s": round(float(data["format"]["duration"]), 2),
        "width": w,
        "height": h,
        "aspect": f"{w}:{h}",
        "is_vertical_9x16": abs((w / h) - (9 / 16)) < 0.02,
        "fps": fps,
        "has_audio": a is not None,
        "file_size_mb": round(int(data["format"]["size"]) / 1e6, 2),
    }


def frame_times(duration):
    """Every 0.5s for the first 3s (the hook), then every 1s, max 45 frames."""
    times = [t / 2 for t in range(0, 7) if t / 2 < duration]
    t = 4.0
    while t < duration:
        times.append(t)
        t += 1.0
    if len(times) > 45:  # long video: keep hook, thin out the rest evenly
        head, tail = times[:7], times[7:]
        step = len(tail) / 38
        times = head + [tail[int(i * step)] for i in range(38)]
    last = max(duration - 0.1, 0)
    if times and last - times[-1] > 0.3:
        times.append(round(last, 2))  # always show the very end (the CTA)
    return times


def extract_frames(video, duration, out):
    fdir = out / "frames"
    if fdir.exists():
        shutil.rmtree(fdir)
    fdir.mkdir(parents=True)
    saved = []
    for t in frame_times(duration):
        name = fdir / f"t{t:06.2f}s.jpg"
        r = run(["ffmpeg", "-v", "error", "-ss", f"{t}", "-i", str(video),
                 "-frames:v", "1", "-vf", "scale=540:-2", "-q:v", "4", str(name)])
        if r.returncode == 0 and name.exists():
            saved.append(name.name)
    return saved


def scene_cuts(video):
    r = run(["ffmpeg", "-i", str(video), "-vf",
             "select='gt(scene,0.2)',showinfo", "-an", "-f", "null", "-"])
    return [round(float(m), 2) for m in re.findall(r"pts_time:([\d.]+)", r.stderr)]


def silences(video):
    r = run(["ffmpeg", "-i", str(video), "-af",
             "silencedetect=noise=-40dB:d=0.7", "-vn", "-f", "null", "-"])
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", r.stderr)]
    ends = re.findall(r"silence_end: ([\d.]+) \| silence_duration: ([\d.]+)", r.stderr)
    out = []
    for i, s in enumerate(starts):
        if i < len(ends):
            out.append({"start": round(s, 2), "end": round(float(ends[i][0]), 2),
                        "length": round(float(ends[i][1]), 2)})
        else:
            out.append({"start": round(s, 2), "end": None, "length": None})
    return out


def loudness(video):
    r = run(["ffmpeg", "-i", str(video), "-af", "ebur128=peak=true",
             "-vn", "-f", "null", "-"])
    i = re.findall(r"I:\s+(-?[\d.]+) LUFS", r.stderr)
    p = re.findall(r"Peak:\s+(-?[\d.]+) dBFS", r.stderr)
    return {"integrated_lufs": float(i[-1]) if i else None,
            "true_peak_dbfs": float(p[-1]) if p else None}


def srt_to_text(path):
    lines, out = path.read_text(errors="ignore").splitlines(), []
    stamp = None
    for ln in lines:
        m = re.match(r"(\d+):(\d+):(\d+)[,.](\d+)\s*-->", ln)
        if m:
            h, mi, s, ms = map(int, m.groups())
            stamp = h * 3600 + mi * 60 + s + ms / 1000
        elif ln.strip() and not ln.strip().isdigit():
            out.append(f"[{stamp:6.2f}s] {ln.strip()}" if stamp is not None else ln.strip())
    return "\n".join(out)


def transcript(video, has_audio):
    # 1) A caption file the user put next to the video wins.
    for ext in (".srt", ".vtt", ".txt"):
        side = video.with_suffix(ext)
        if side.exists():
            text = srt_to_text(side) if ext in (".srt", ".vtt") else side.read_text(errors="ignore")
            return text, f"from {side.name}"
    if not has_audio:
        return "", "no audio track"
    # 2) Try speech-to-text on this machine.
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segs, _ = model.transcribe(str(video), vad_filter=True)
        text = "\n".join(f"[{s.start:6.2f}s] {s.text.strip()}" for s in segs)
        return text, "faster-whisper (base)"
    except Exception as e:  # model download blocked, not installed, etc.
        return "", f"unavailable ({type(e).__name__}). Put a .srt or .txt with the same name next to the video."


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--out")
    args = ap.parse_args()
    video = Path(args.video).resolve()
    if not video.exists():
        sys.exit(f"File not found: {video}")
    out = Path(args.out) if args.out else Path("reviews") / video.stem
    out.mkdir(parents=True, exist_ok=True)

    meta = probe(video)
    meta["frames"] = extract_frames(video, meta["duration_s"], out)
    cuts = scene_cuts(video)
    meta["scene_cuts_s"] = cuts
    # Longest stretch with no new shot (start, every cut, end).
    marks = [0.0] + cuts + [meta["duration_s"]]
    gaps = [round(b - a, 2) for a, b in zip(marks, marks[1:])]
    meta["longest_shot_s"] = max(gaps) if gaps else meta["duration_s"]
    meta["avg_shot_s"] = round(meta["duration_s"] / (len(cuts) + 1), 2)
    if meta["has_audio"]:
        meta["silences"] = silences(video)
        meta.update(loudness(video))
    text, source = transcript(video, meta["has_audio"])
    meta["transcript_source"] = source
    (out / "transcript.txt").write_text(text or "(no transcript)\n")
    (out / "meta.json").write_text(json.dumps(meta, indent=2))
    print(json.dumps({"out_dir": str(out), **{k: v for k, v in meta.items() if k != "frames"},
                      "frame_count": len(meta["frames"])}, indent=2))


if __name__ == "__main__":
    main()
