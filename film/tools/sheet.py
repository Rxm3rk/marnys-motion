# Delivery contact sheet: N evenly spaced frames from a finished reel, with timestamps.
#   python tools/sheet.py <video.mp4> <out.jpg> [n=12] [cols=6]
import subprocess, sys, os, tempfile
from PIL import Image, ImageDraw, ImageFont

video, out = sys.argv[1], sys.argv[2]
n = int(sys.argv[3]) if len(sys.argv) > 3 else 12
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 6
dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', video], capture_output=True, text=True).stdout)
TW, TH, GAP, HEAD = 300, 533, 10, 70
rows = (n + cols - 1) // cols
sheet = Image.new('RGB', (cols * (TW + GAP) + GAP, HEAD + rows * (TH + GAP + 30) + GAP), (14, 42, 71))
d = ImageDraw.Draw(sheet)
f_head = ImageFont.truetype('C:/Windows/Fonts/arialbd.ttf', 28); f_t = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 20)
d.text((GAP + 4, 20), os.path.basename(video), font=f_head, fill=(247, 244, 238))
with tempfile.TemporaryDirectory() as tmp:
    for i in range(n):
        t = dur * (i + 0.5) / n
        fp = os.path.join(tmp, f'{i}.png')
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.3f}', '-i', video, '-frames:v', '1', fp])
        im = Image.open(fp).convert('RGB').resize((TW, TH), Image.LANCZOS)
        x, y = GAP + (i % cols) * (TW + GAP), HEAD + (i // cols) * (TH + GAP + 30)
        sheet.paste(im, (x, y)); d.text((x + 2, y + TH + 4), f'{t:5.2f} s', font=f_t, fill=(169, 199, 214))
sheet.save(out, quality=90)
print(out)
