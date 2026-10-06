"""
High-End Open Graph Banner Compositor for Tepi Sawah
Uses:
- Background: Generated cinematic rice terrace landscape
- Logo: User uploaded authentic transparent logo
- Typography: Windows Georgia + Segoe UI
- Output: 1200x630 JPEG (~160KB) for WhatsApp & Telegram
"""
import os
import base64
from PIL import Image, ImageDraw, ImageFont, ImageFilter

BG_PATH = r"C:\Users\sisig\.gemini\antigravity-ide\brain\21c2b2d5-0b5a-4ed2-82d6-444cc010b57a\tepisawah_bg_landscape_1791298885032.jpg"
SRC_PATH = r"C:\Users\sisig\.gemini\antigravity-ide\brain\21c2b2d5-0b5a-4ed2-82d6-444cc010b57a\.user_uploaded\media_1791295920324.png"
OUTPUT_DIR = r"d:\Projects\TepiSawah\POS Final\TepiSawah_MASTER_PROJECT_PACK_v1\scripts\generated_assets"
os.makedirs(OUTPUT_DIR, exist_ok=True)

OG_W, OG_H = 1200, 630

# 1. Load and prepare user logo
src_logo = Image.open(SRC_PATH).convert("RGBA")
bbox = src_logo.getbbox()
cropped_logo = src_logo.crop(bbox)
cw, ch = cropped_logo.size
max_dim = max(cw, ch)
pad = int(max_dim * 0.06)
canvas_dim = max_dim + 2 * pad
sq_logo = Image.new("RGBA", (canvas_dim, canvas_dim), (0, 0, 0, 0))
sq_logo.paste(cropped_logo, ((canvas_dim - cw) // 2, (canvas_dim - ch) // 2), cropped_logo)

# Also save transparent master logo
master_logo = sq_logo.resize((1024, 1024), Image.Resampling.LANCZOS)
master_logo.save(os.path.join(OUTPUT_DIR, "logo.png"), "PNG", optimize=True)

# 2. Favicons
fav_64 = sq_logo.resize((64, 64), Image.Resampling.LANCZOS)
fav_64.save(os.path.join(OUTPUT_DIR, "favicon.png"), "PNG")

# Apple touch icon (180x180) - Solid dark emerald with subtle gold border
ati = Image.new("RGBA", (180, 180), (20, 48, 28, 255))
d_ati = ImageDraw.Draw(ati)
d_ati.ellipse([4, 4, 175, 175], outline=(205, 168, 81, 200), width=2)
# White circular backing for the logo sticker inside the 180x180
d_ati.ellipse([14, 14, 165, 165], fill=(255, 255, 255, 245))
logo_130 = sq_logo.resize((136, 136), Image.Resampling.LANCZOS)
ati.paste(logo_130, (22, 22), logo_130)
ati.save(os.path.join(OUTPUT_DIR, "apple-touch-icon.png"), "PNG")

# SVG favicon
with open(os.path.join(OUTPUT_DIR, "favicon.png"), "rb") as f:
    b64_fav = base64.b64encode(f.read()).decode("utf-8")
svg_code = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <image width="64" height="64" href="data:image/png;base64,{b64_fav}"/>
</svg>'''
with open(os.path.join(OUTPUT_DIR, "favicon.svg"), "w", encoding="utf-8") as f:
    f.write(svg_code)

# 3. Create Scenic OG Banner (1200 x 630)
bg_raw = Image.open(BG_PATH).convert("RGBA")
# Resize and crop to 1200x630
bg_aspect = bg_raw.width / bg_raw.height
target_aspect = OG_W / OG_H
if bg_aspect > target_aspect:
    new_h = OG_H
    new_w = int(OG_H * bg_aspect)
else:
    new_w = OG_W
    new_h = int(OG_W / bg_aspect)
bg_scaled = bg_raw.resize((new_w, new_h), Image.Resampling.LANCZOS)
crop_x = (new_w - OG_W) // 2
crop_y = (new_h - OG_H) // 2
bg = bg_scaled.crop((crop_x, crop_y, crop_x + OG_W, crop_y + OG_H))

# Apply rich culinary dark emerald scrim/overlay for exceptional readability
# Gradient from deep dark emerald on left (opacity 0.94) to dark emerald on right (opacity 0.88)
overlay = Image.new("RGBA", (OG_W, OG_H), (0, 0, 0, 0))
d_ov = ImageDraw.Draw(overlay)

# Left panel backdrop for logo: darker gradient
for x in range(OG_W):
    # progress 0 to 1
    t = x / OG_W
    # Base color: deep emerald #0c2013 to #142e1d
    r = int(12 + t * 8)
    g = int(32 + t * 14)
    b = int(19 + t * 10)
    # Opacity: very high to ensure text is 100% legible
    alpha = int(240 - t * 15)
    d_ov.line([(x, 0), (x, OG_H)], fill=(r, g, b, alpha))

# Composite overlay on background
comp = Image.alpha_composite(bg, overlay)
d = ImageDraw.Draw(comp)

# Outer decorative gold border
d.rectangle([18, 18, OG_W - 19, OG_H - 19], outline=(205, 168, 81, 160), width=2)
d.rectangle([24, 24, OG_W - 25, OG_H - 25], outline=(205, 168, 81, 70), width=1)
# Corner diamonds
for cx, cy in [(26, 26), (OG_W - 26, 26), (26, OG_H - 26), (OG_W - 26, OG_H - 26)]:
    d.polygon([(cx, cy - 6), (cx + 6, cy), (cx, cy + 6), (cx - 6, cy)], fill=(225, 190, 95, 230))

# Left Side: White/Ivory Card with the User's exact Logo
logo_card_w = 420
logo_card_h = 420
card_cx = 250
card_cy = 315

# Soft shadow behind logo circle
shadow_img = Image.new("RGBA", (OG_W, OG_H), (0, 0, 0, 0))
d_sh = ImageDraw.Draw(shadow_img)
d_sh.ellipse([card_cx - 200, card_cy - 195, card_cx + 200, card_cy + 205], fill=(0, 0, 0, 140))
shadow_img = shadow_img.filter(ImageFilter.GaussianBlur(14))
comp = Image.alpha_composite(comp, shadow_img)
d = ImageDraw.Draw(comp)

# Circular emblem base: warm ivory with gold outline
d.ellipse([card_cx - 195, card_cy - 195, card_cx + 195, card_cy + 195], fill=(255, 255, 255, 250), outline=(205, 168, 81, 240), width=4)
d.ellipse([card_cx - 186, card_cy - 186, card_cx + 186, card_cy + 186], outline=(205, 168, 81, 100), width=2)

# Paste User Logo
logo_size = 420
logo_resized = sq_logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)
comp.paste(logo_resized, (card_cx - logo_size // 2, card_cy - logo_size // 2), logo_resized)
d = ImageDraw.Draw(comp)

# Right Side: Typography & Brand Information
font_badge = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 18)
font_title = ImageFont.truetype(r"C:\Windows\Fonts\georgiab.ttf", 54)
font_subtitle = ImageFont.truetype(r"C:\Windows\Fonts\georgiai.ttf", 30)
font_desc = ImageFont.truetype(r"C:\Windows\Fonts\segoeui.ttf", 22)
font_pill = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 19)
font_url = ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf", 20)

tx = 490
ty = 78

# 1. Gold Pill Badge (Location / Cuisine)
badge_text = "  KULINER NUSANTARA & KOPI  •  CIPERNA, CIREBON  "
b_box = font_badge.getbbox(badge_text)
bw = b_box[2] - b_box[0] + 16
bh = b_box[3] - b_box[1] + 14
d.rounded_rectangle([tx, ty, tx + bw, ty + bh], radius=12, fill=(205, 168, 81, 235))
d.text((tx + 8, ty + 5), badge_text, font=font_badge, fill=(20, 48, 28, 255))

# 2. Main Title: TEPI SAWAH
ty += bh + 22
d.text((tx, ty), "TEPI SAWAH", font=font_title, fill=(255, 252, 245, 255))

# 3. Subtitle: Resto & Cafe
ty += 68
d.text((tx, ty), "Resto & Cafe", font=font_subtitle, fill=(228, 196, 115, 255))

# 4. Gold separator
ty += 48
d.line([(tx, ty), (tx + 650, ty)], fill=(205, 168, 81, 160), width=2)

# 5. Descriptive text
ty += 22
d.text((tx, ty), "Sensasi kuliner nusantara lezat di tepi hamparan sawah asri.", font=font_desc, fill=(235, 242, 236, 255))
ty += 34
d.text((tx, ty), "Pemesanan mandiri via scan QR meja, cepat dan praktis.", font=font_desc, fill=(200, 218, 204, 255))

# 6. Feature Pills (using clean dot bullets for bulletproof cross-platform rendering)
ty += 52
feature_tags = [
    "● Pesan QR Meja",
    "● View Sawah Asri",
    "● Kopi & Kuliner Khas"
]
fx = tx
for ftag in feature_tags:
    ft_box = font_pill.getbbox(ftag)
    fw = ft_box[2] - ft_box[0] + 24
    fh = ft_box[3] - ft_box[1] + 14
    d.rounded_rectangle([fx, ty, fx + fw, ty + fh], radius=8, fill=(26, 60, 36, 220), outline=(205, 168, 81, 150), width=1)
    d.text((fx + 12, ty + 5), ftag, font=font_pill, fill=(255, 246, 224, 255))
    fx += fw + 14

# 7. Website Domain Footer Pill
ty += 56
url_text = "tepisawah.id   •   order.tepisawah.id"
u_box = font_url.getbbox(url_text)
uw = u_box[2] - u_box[0] + 28
uh = u_box[3] - u_box[1] + 14
d.rounded_rectangle([tx, ty, tx + uw, ty + uh], radius=8, fill=(12, 28, 18, 240), outline=(205, 168, 81, 160), width=1)
d.text((tx + 14, ty + 5), url_text, font=font_url, fill=(225, 195, 115, 255))

# Save high-quality optimized JPEG
final_rgb = comp.convert("RGB")
og_path = os.path.join(OUTPUT_DIR, "og-image.jpg")
final_rgb.save(og_path, "JPEG", quality=90, optimize=True)

size_kb = os.path.getsize(og_path) / 1024
print(f"Composited OG Image: {og_path} ({size_kb:.1f} KB)")
