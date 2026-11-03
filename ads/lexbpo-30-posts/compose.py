"""Build the LEX BPO "30 static posts" ad (1080x1350, 4:5).

Usage:  python3 compose.py scene.png logo.png

The scene is an AI-generated photo (cafe owner at a blank laptop, sample
post designs on the right).  Every word and the logo are drawn here with
code so the copy is rendered exactly as written.
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

W, H = 1080, 1350
M = 64                                  # safe margin from the edges
WARM = (248, 244, 237)
CHAR = (38, 38, 38)
CHAR_SOFT = (52, 52, 52)
ORANGE = (232, 112, 26)
HEAD_F = "/usr/share/fonts/truetype/higgsfield/Montserrat-ExtraBold.ttf"
BODY_F = "/usr/share/fonts/opentype/urw-base35/NimbusSans-Regular.otf"

HEADLINE = ["TAPOS NA ANG ARAW.", "GAGAWA KA PA NG POST?"]
BRIDGE = ("Ipagawa sa LEX BPO ang 30 static posts—para hindi ka "
          "laging nagsisimula sa blankong design.")
OFFER = "30 STATIC POSTS • ₱5,000"
CTA = "MESSAGE ‘CONTENT’ FOR SAMPLES"

scene = sys.argv[1] if len(sys.argv) > 1 else "sceneA.png"
logo_path = sys.argv[2] if len(sys.argv) > 2 else "logo.png"
img = Image.open(scene).convert("RGB").resize((W, H), Image.LANCZOS).convert("RGBA")

# Top scrim: clear at the very top (keeps the lamp crisp), lifts the
# headline zone to warm white, fades out above the owner.
scrim = Image.new("RGBA", (W, H), WARM + (0,))
px = scrim.load()


def alpha_at(y):
    if y < 150:
        return 0.50 * y / 150
    if y < 470:
        return 0.50
    if y < 680:
        return 0.50 * (680 - y) / 210
    return 0.0


for y in range(0, 680):
    a = int(255 * alpha_at(y))
    for x in range(W):
        px[x, y] = WARM + (a,)
img = Image.alpha_composite(img, scrim)
d = ImageDraw.Draw(img)


def fit_font(path, lines, max_w, start=120):
    s = start
    while s > 20:
        f = ImageFont.truetype(path, s)
        if max(f.getlength(t) for t in lines) <= max_w:
            return f, s
        s -= 1
    return ImageFont.truetype(path, 20), 20


def wrap(text, font, max_w):
    words, lines, cur = text.split(" "), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if font.getlength(t) <= max_w:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# Headline (largest element)
hf, hs = fit_font(HEAD_F, HEADLINE, W - 2 * M)
y = 186
asc, _ = hf.getmetrics()
lh = int(hs * 1.08)
for line in HEADLINE:
    d.text((M, y), line, font=hf, fill=CHAR)
    y += lh
head_bottom = y - lh + asc + 8

# Bridge sentence
bf = ImageFont.truetype(BODY_F, 35)
y = head_bottom + 30
for line in wrap(BRIDGE, bf, 900):
    d.text((M, y), line, font=bf, fill=CHAR_SOFT)
    y += int(35 * 1.38)

# Bottom band: offer (second largest) + CTA pill + logo
BAND_Y = 1190
d.rectangle((0, BAND_Y, W, H), fill=WARM)
d.rectangle((0, BAND_Y, W, BAND_Y + 5), fill=ORANGE)

of = ImageFont.truetype(HEAD_F, 40)
d.text((M, BAND_Y + 24), OFFER, font=of, fill=CHAR)

cf = ImageFont.truetype(HEAD_F, 22)
tw = cf.getlength(CTA)
pill_h, pad = 52, 24
py0 = BAND_Y + 24 + 40 + 20
d.rounded_rectangle((M, py0, M + tw + 2 * pad, py0 + pill_h), radius=26, fill=ORANGE)
ca, cd_ = cf.getmetrics()
d.text((M + pad, py0 + (pill_h - (ca + cd_)) // 2), CTA, font=cf, fill=(255, 255, 255))

if os.path.exists(logo_path):
    lg = Image.open(logo_path).convert("RGBA")
    lh_ = 128
    lw_ = round(lg.width * lh_ / lg.height)
    lg = lg.resize((lw_, lh_), Image.LANCZOS)
    img.alpha_composite(lg, (W - M - lw_, BAND_Y + (H - BAND_Y - lh_) // 2 + 2))
else:
    print("WARNING: logo missing, skipped")

out = img.convert("RGB")
out.save("final.png", optimize=True)
out.save("final.jpg", quality=92)
out.resize((540, 675), Image.LANCZOS).save("preview.jpg", quality=82)
out.crop((0, 1150, 1080, 1350)).save("crop_bottom.jpg", quality=80)
print("final", out.size)
