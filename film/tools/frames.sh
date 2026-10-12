#!/bin/sh
# Extract graded 1080x1920 JPEG frame caches for each shot into $WORK_DIR/frames/<shot>/0001.jpg ...
# Sources are one 2160x3840 30p Pexels shoot (Artem Podrez). Every source frame is kept and played at 25 fps (0.83x, so
# each frame holds exactly 2 frames of the 50 fps render): cache frame k = source frame IN + k - 1.
# Each shot is reframed from the 4K master (crop W:H:X:Y in 4K pixels) before scaling to 1080x1920.
# Also writes ../assets/hazy_fill.jpg (blurred, mirrored cover plate behind the mirror shot).
set -e
SRC="$(cd "$(dirname "$0")/../../source/pexels" && pwd)"
ASSETS="$(cd "$(dirname "$0")/../assets" && pwd)"
OUT="${WORK_DIR:?set WORK_DIR}/frames"
GRADE="eq=contrast=0.97:brightness=0.015:saturation=1.0:gamma=1.03,colorbalance=rs=-0.015:bs=0.025:rh=-0.01:bh=0.015,curves=all='0/0.02 0.5/0.52 1/0.98',split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=36[g];[a][g]blend=all_mode=screen:all_opacity=0.22,unsharp=5:5:0.3"
# mirror haze: clear around the eyes, misted towards the edges and the bottom of the glass
HAZE_MASK="geq=lum='255*clip(0.04+0.96*(1-exp(-(pow((X-530)/430\,2)+pow((Y-760)/330\,2))))+0.35*clip((Y-1000)/700\,0\,1)\,0\,1)'"
HAZE="gblur=sigma=16,curves=all='0/0.12 0.5/0.58 1/1'"
shot() { # name file in_frame frames crop first_index
  mkdir -p "$OUT/$1"
  ffmpeg -v error -y -i "$SRC/$2" -vf "select=gte(n\,$3),crop=$5,scale=1080:1920:flags=lanczos,$GRADE" \
    -frames:v "$4" -fps_mode passthrough -q:v 2 -start_number "$6" "$OUT/$1/%04d.jpg"
  echo "$1 $4 frames from $2 frame $3"
}
haze() { # name file in_frame frames crop
  mkdir -p "$OUT/$1"
  ffmpeg -v error -y -i "$SRC/$2" -f lavfi -i "color=black:s=1080x1920:r=30,format=gray,$HAZE_MASK,format=gbrp" -filter_complex \
    "[0:v]select=gte(n\,$3),crop=$5,scale=1080:1920:flags=lanczos,$GRADE,format=gbrp,split[s][h];[h]$HAZE[hz];[s][hz][1:v]maskedmerge,curves=all='0/0.04 1/0.985'" \
    -frames:v "$4" -fps_mode passthrough -q:v 2 -start_number 1 "$OUT/$1/%04d.jpg"
  echo "$1 $4 frames from $2 frame $3 (hazed)"
}
rm -rf "$OUT"
haze A pexels_7957707_artempodrez_face-to-camera_2160x3840_30p.mp4 0 72 2160:3840:0:0 &
{ shot B pexels_7957700_artempodrez_back-of-hair_2160x3840_30p.mp4 0 55 1928:3428:232:6 1                  # 2.2 - 4.4
  shot B pexels_7957703_artempodrez_hair-hand-chin_2160x3840_30p.mp4 9 76 1964:3490:138:214 56; } &      # cut on the 4.4 downbeat
shot C pexels_7957699_artempodrez_hair-in-air_2160x3840_30p.mp4 36 40 2160:3840:0:0 1 &
shot D pexels_7957697_artempodrez_skin-closeup_2160x3840_30p.mp4 9 40 2160:3840:0:0 1 &
shot E pexels_7957703_artempodrez_hair-hand-chin_2160x3840_30p.mp4 189 64 1728:3072:286:0 1 &
wait
ffmpeg -v error -y -i "$OUT/A/0001.jpg" -vf "hflip,gblur=sigma=40" -q:v 4 "$ASSETS/hazy_fill.jpg"
for k in A B C D E; do echo "$k $(ls "$OUT/$k" | wc -l) frames"; done
