#!/bin/sh
# Extract graded 1080x1920 JPEG frame caches for each shot into $WORK_DIR/frames/<shot>/0001.jpg ...
# frame k (1-based) = source time START + (k-1)/25
set -e
SRC="C:/Users/Surface/OneDrive/Desktop/marnys/source/pexels"
OUT="${WORK_DIR:?set WORK_DIR}/frames"
GRADE="eq=contrast=0.97:brightness=0.015:saturation=1.0:gamma=1.03,colorbalance=rs=-0.015:bs=0.025:rh=-0.01:bh=0.015,curves=all='0/0.02 0.5/0.52 1/0.98',split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=36[g];[a][g]blend=all_mode=screen:all_opacity=0.22,unsharp=5:5:0.3"
shot() { # name file start dur
  mkdir -p "$OUT/$1"; rm -f "$OUT/$1"/*.jpg
  ffmpeg -v error -y -ss "$3" -i "$SRC/$2" -t "$4" -vf "$GRADE" -q:v 2 -start_number 1 "$OUT/$1/%04d.jpg"
  echo "$1 $(ls "$OUT/$1" | wc -l) frames from $3s"
}
shot A pexels_35088445_khezez_hazy-mirror_1080x1920_25p.mp4 0.80 3.60 &
shot B pexels_35088444_khezez_hair-turn_1080x1920_25p.mp4 5.00 6.00 &
shot C pexels_35088462_khezez_hair-toss_1080x1920_25p.mp4 8.80 1.92 &
shot D pexels_35088447_khezez_closeups-hands_1080x1920_25p.mp4 1.20 1.92 &
shot E pexels_35088453_khezez_turn-chin_1080x1920_25p.mp4 18.28 2.80 &
wait
