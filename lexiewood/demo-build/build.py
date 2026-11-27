import subprocess, os, json
exec(open('plan.py').read())
HD = '../stock/hd'
W, H, FPS = 1080, 1920, 30
FONT = '/usr/share/fonts/opentype/inter/InterDisplay-ExtraBold.otf'
FONT2 = '/usr/share/fonts/opentype/inter/Inter-Bold.otf'
os.makedirs('shots', exist_ok=True); os.makedirs('caps', exist_ok=True)

def probe(path, entries):
    out = subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', entries, '-of', 'json', path])
    return json.loads(out)

meta = {}
def clip_meta(cid):
    if cid not in meta:
        p = f'{HD}/{cid}.mp4'
        s = probe(p, 'stream=width,height:format=duration')
        meta[cid] = (s['streams'][0]['width'], s['streams'][0]['height'], float(s['format']['duration']))
    return meta[cid]

def dur(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

# ---- timeline ----
timeline = []   # (start, length, cid, cx, src_start)
captions = []   # (start, end, text)
voice = []      # (start, wav)
t = 0.0
for b, beat in enumerate(BEATS):
    for p, (txt, cap, clips, sl) in enumerate(beat):
        wav = f'vo2/{b}_{p}.wav'
        vd = dur(wav)
        last_phrase = (p == len(beat) - 1)
        gap = BEAT_GAP if last_phrase else PHRASE_GAP
        if b == len(BEATS) - 1 and p >= 1:
            gap = 0.32 if not last_phrase else 0.15
        seg = vd + gap
        voice.append((t, wav))
        captions.append((t, t + seg - 0.02, cap))
        n = max(1, round(seg / sl))
        ln = seg / n
        for k in range(n):
            cid, cx, st = clips[k % len(clips)]
            reuse = k // len(clips)
            timeline.append([t + k * ln, ln, cid, cx, st + reuse * 1.7])
        t += seg
# tail: hold on the opening shot (same source frame as second 0) for a clean loop
o = timeline[0]
timeline.append([t, TAIL, o[2], o[3], o[4]])
total = t + TAIL

# ---- render shots ----
for i, (st, ln, cid, cx, ss) in enumerate(timeline):
    w, h, d = clip_meta(cid)
    ss = max(0.0, min(ss, d - ln - 0.1))
    if w > h:
        cw = int(h * 9 / 16) // 2 * 2
        x = int(min(max(cx * w - cw / 2, 0), w - cw))
        vf = f'crop={cw}:{h}:{x}:0,scale={W}:{H}:flags=lanczos'
    else:
        vf = f'scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}'
    vf += f',fps={FPS},setsar=1,eq=contrast=1.05:saturation=1.08'
    frames = max(1, round((st + ln) * FPS) - round(st * FPS))
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{ss:.3f}', '-i', f'{HD}/{cid}.mp4', '-vf', vf,
                    '-frames:v', str(frames), '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                    '-pix_fmt', 'yuv420p', f'shots/{i:03d}.mp4'], check=True)
with open('shots/list.txt', 'w') as f:
    for i in range(len(timeline)):
        f.write(f"file '{i:03d}.mp4'\n")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', 'shots/list.txt', '-c', 'copy', 'video_nocap.mp4'], check=True)

# ---- captions: one line at a time, same spot every frame ----
def wrap(s, n=18):
    if len(s) <= n:
        return s
    words = s.split(); best = None
    for k in range(1, len(words)):
        a, b2 = ' '.join(words[:k]), ' '.join(words[k:])
        score = max(len(a), len(b2))
        if best is None or score < best[0]:
            best = (score, a + '\n' + b2)
    return best[1]

filters = []
for i, (a, b2, text) in enumerate(captions):
    fn = f'caps/{i:02d}.txt'
    open(fn, 'w').write(wrap(text).upper())
    filters.append(f"drawtext=fontfile={FONT}:textfile={fn}:fontsize=78:fontcolor=white:line_spacing=10:"
                   f"borderw=7:bordercolor=black@0.85:x=(w-text_w)/2:y=h*0.64-text_h/2:enable='between(t,{a:.3f},{b2:.3f})'")
open('caps/demo.txt', 'w').write('DEMO para kay Ken  |  stock footage, hindi pang-post')
filters.append(f"drawtext=fontfile={FONT2}:textfile=caps/demo.txt:fontsize=30:fontcolor=white@0.9:box=1:boxcolor=black@0.55:boxborderw=12:x=(w-text_w)/2:y=70")

# ---- voice track ----
ins, mix = [], []
for k, (st, wav) in enumerate(voice):
    ins += ['-i', wav]
    ms = int(st * 1000)
    mix.append(f'[{k+1}:a]adelay={ms}|{ms},apad[a{k}]')
amix = ''.join(f'[a{k}]' for k in range(len(voice)))
fc = ';'.join(mix) + f';{amix}amix=inputs={len(voice)}:normalize=0,atrim=0:{total:.3f},loudnorm=I=-14:TP=-1.5:LRA=11[aout]'
fc = f"[0:v]{','.join(filters)}[vout];" + fc
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', 'video_nocap.mp4', *ins, '-filter_complex', fc,
                '-map', '[vout]', '-map', '[aout]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', f'{round(total*FPS)/FPS:.3f}', '-movflags', '+faststart', 'lexiewood_demo.mp4'], check=True)

json.dump({'total': total, 'shots': timeline, 'captions': captions}, open('timeline.json', 'w'), indent=1)
print('total', round(total, 2), 'shots', len(timeline), 'avg shot', round(total / len(timeline), 2))
