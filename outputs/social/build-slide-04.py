from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path(__file__).resolve().parents[2]
source = root / ".codex-attachments/15e45f76-83b7-4f63-972f-56a28093f559/5b63cd12-23b8-4d69-aa85-8e5b0bb7f336/54353.jpg"
target = Path(__file__).with_name("koinonia-slide-04.png")

W, H = 1080, 1920
bg, navy, teal, gold, muted = "#F5F6F2", "#061A34", "#0F6664", "#C99A4A", "#66727A"
im = Image.new("RGB", (W, H), bg)
d = ImageDraw.Draw(im)
serif = r"C:\Windows\Fonts\georgia.ttf"
sans = r"C:\Windows\Fonts\segoeui.ttf"
sans_bold = r"C:\Windows\Fonts\segoeuib.ttf"
f_label = ImageFont.truetype(sans_bold, 28)
f_title = ImageFont.truetype(serif, 76)
f_body = ImageFont.truetype(sans, 34)
f_note = ImageFont.truetype(sans, 27)
f_cta = ImageFont.truetype(sans_bold, 30)

# Series marker and editorial rule.
d.text((92, 88), "EXPLORA · 04", font=f_label, fill=teal)
d.rounded_rectangle((92, 142, 330, 151), radius=5, fill=gold)

# Headline and short explanatory copy.
d.text((88, 190), "Mira cada", font=f_title, fill=navy)
d.text((88, 278), "resultado", font=f_title, fill=navy)
d.rounded_rectangle((92, 384, 278, 393), radius=5, fill=teal)
d.text((92, 425), "Una ficha puede mostrarte su ubicación,", font=f_body, fill=navy)
d.text((92, 474), "reuniones, actividades y más detalles", font=f_body, fill=navy)
d.text((92, 523), "para decidir si quieres conocerla.", font=f_body, fill=navy)

# Place the actual screenshot crop: no browser chrome and no adjacent test card.
screen = Image.open(source).convert("RGB")
crop = screen.crop((22, 467, 555, 1195))
crop.thumbnail((900, 990), Image.Resampling.LANCZOS)
frame = Image.new("RGB", (crop.width + 12, crop.height + 12), "#FFFFFF")
frame.paste(crop, (6, 6))
mask = Image.new("L", frame.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, frame.width - 1, frame.height - 1), radius=26, fill=255)
shadow = Image.new("RGBA", (frame.width + 40, frame.height + 40), (0, 0, 0, 0))
ImageDraw.Draw(shadow).rounded_rectangle((20, 20, frame.width + 19, frame.height + 19), radius=30, fill=(6, 26, 52, 35))
im.paste(shadow, ((W - shadow.width) // 2, 579), shadow)
im.paste(frame, ((W - frame.width) // 2, 599), mask)

# Close with a gentle instruction and keep the Instagram controls clear.
footer_y = 599 + frame.height + 26
d.text((92, footer_y), "Revisa la ficha completa", font=ImageFont.truetype(serif, 38), fill=navy)
d.text((92, footer_y + 55), "y confirma los datos directamente con la iglesia.", font=f_note, fill=muted)
d.rounded_rectangle((730, 1744, 988, 1818), radius=37, fill=teal)
d.text((766, 1760), "Sigue  →", font=f_cta, fill="#FFFFFF")

im.save(target, quality=95)
print(target)

