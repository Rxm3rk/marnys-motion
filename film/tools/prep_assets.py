# Cut the real Elixir packshots out of their white backgrounds and key the MARNYS logo.
# Box and vial are convex solids, so the matte is the anti-aliased convex hull of the non-white pixels
# (vial: cap and body hulls separately, so the neck shoulders stay clean).
import cv2, numpy as np
from PIL import Image
ROOT = r"C:/Users/Surface/OneDrive/Desktop/marnys"
PK = ROOT + "/assets/packshot/"
OUT = ROOT + "/film/assets/"
SS = 4  # supersampling for the matte edge

def hull_alpha(img, parts, thr=12, choke=1.0):
    h, w = img.shape[:2]
    d = 255 - img.min(axis=2).astype(np.int16)          # distance from white
    nonwhite = (d > thr).astype(np.uint8)
    nonwhite = cv2.morphologyEx(nonwhite, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    big = np.zeros((h * SS, w * SS), np.uint8)
    for (y0, y1) in parts:
        m = np.zeros_like(nonwhite); m[y0:y1] = nonwhite[y0:y1]
        n, lab, stats, _ = cv2.connectedComponentsWithStats(m)
        keep = [i for i in range(1, n) if stats[i, cv2.CC_STAT_AREA] > 500]
        pts = np.column_stack(np.where(np.isin(lab, keep)))[:, ::-1].astype(np.float32)
        hull = cv2.convexHull(pts)
        cv2.fillPoly(big, [np.round(hull * SS).astype(np.int32)], 255, lineType=cv2.LINE_AA)
    if choke > 0:
        k = int(round(choke * SS)) * 2 + 1
        big = cv2.erode(big, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
    a = cv2.resize(big, (w, h), interpolation=cv2.INTER_AREA)
    return a

def save_rgba(img_bgr, a, path, pad=8):
    ys, xs = np.where(a > 0)
    y0, y1, x0, x1 = max(ys.min() - pad, 0), min(ys.max() + pad, a.shape[0]), max(xs.min() - pad, 0), min(xs.max() + pad, a.shape[1])
    rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)[y0:y1, x0:x1]
    Image.fromarray(np.dstack([rgb, a[y0:y1, x0:x1]])).save(path)
    print(path, (x1 - x0, y1 - y0))

box = cv2.imread(PK + "lifepharmacy_130954-1.jpg")
a = hull_alpha(box, [(0, box.shape[0])], thr=10, choke=1.2)
save_rgba(box, a, OUT + "elixir_box.png")

vial = cv2.imread(PK + "lifepharmacy_130954-2.jpg")
# find the cap/body split: first row below the cap where the amber glass starts (widest jump in row width)
d = 255 - vial.min(axis=2).astype(np.int16)
widths = [(np.ptp(np.where(d[y] > 30)[0]) if (d[y] > 30).sum() > 5 else 0) for y in range(vial.shape[0])]
split = 128
for y in range(90, 200):
    if widths[y] - widths[y - 1] > 6: split = y; break
print("vial cap/body split at", split)
a = hull_alpha(vial, [(0, split), (split, vial.shape[0])], thr=12, choke=1.0)
save_rgba(vial, a, OUT + "elixir_vial.png")

# Logo: white mark on flat navy -> white with alpha from luminance distance to the navy
logo = np.asarray(Image.open(r"C:/Users/Surface/Downloads/logo-marnys-cphi.webp").convert("RGB")).astype(np.float32)
bg = np.median(logo[5:40, 5:40].reshape(-1, 3), axis=0)
lum = logo @ np.array([0.299, 0.587, 0.114]); lb = bg @ np.array([0.299, 0.587, 0.114])
al = np.clip((lum - lb) / (255 - lb), 0, 1)
al = np.clip((al - 0.06) / 0.88, 0, 1)
ys, xs = np.where(al > 0.02)
y0, y1, x0, x1 = ys.min() - 6, ys.max() + 6, xs.min() - 6, xs.max() + 6
A = (al[y0:y1, x0:x1] * 255).astype(np.uint8)
W = np.full(A.shape + (3,), 255, np.uint8)
Image.fromarray(np.dstack([W, A])).save(OUT + "marnys_logo_white.png")
print("logo bg", bg, "size", A.shape[::-1])
# split lockup: wordmark pill vs "Natural Quality" script (gap row between them)
rows = (A > 20).sum(1)
gaps = [y for y in range(int(A.shape[0] * 0.35), int(A.shape[0] * 0.8)) if rows[y] == 0]
if gaps:
    g = gaps[len(gaps) // 2]
    Image.fromarray(np.dstack([W[:g], A[:g]])).save(OUT + "marnys_wordmark_white.png")
    Image.fromarray(np.dstack([W[g:], A[g:]])).save(OUT + "marnys_tagline_white.png")
    print("split at", g)
