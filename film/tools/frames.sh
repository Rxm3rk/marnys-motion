#!/bin/sh
# Extract graded 1080x1920 JPEG frame caches for each shot into $WORK_DIR/frames/<shot>/0001.jpg ...
# All five shots come from one 3840x2160 24p take (Pexels 8956123, KoolShooters). Every source frame is kept and played
# at 25 fps (1.04x, so each frame holds exactly 2 frames of the 50 fps render): cache frame k = source frame IN + k - 1.
# B-E: a full-height 9:16 window (1215x2160 source px) that follows her face. Its left edge is keyframed per shot as
#      "n:x" pairs (n = frame inside the shot, linear in between), taken from a smoothed face track.
# A:   the mirror. The whole frame is shrunk to SCALE so her face sits in the arch like before, held steady by keyframed
#      placement of her eye midpoint (target 530,700 before the CSS mirror), feathered into its own edges continued
#      beyond the picture and blurred, then misted.
# Also writes ../assets/hazy_fill.jpg (blurred, mirrored cover plate behind the mirror shot).
set -e
SRC="$(cd "$(dirname "$0")/../../source/pexels" && pwd)/pexels_8956123_koolshooters_window-beauty-closeups_3840x2160_24p.mp4"
ASSETS="$(cd "$(dirname "$0")/../assets" && pwd)"
OUT="${WORK_DIR:?set WORK_DIR}/frames"
GRADE="eq=contrast=0.97:brightness=0.015:saturation=1.0:gamma=1.03,colorbalance=rs=-0.015:bs=0.025:rh=-0.01:bh=0.015,curves=all='0/0.02 0.5/0.52 1/0.98',split[a][b];[b]curves=all='0/0 0.62/0 1/1',gblur=sigma=36[g];[a][g]blend=all_mode=screen:all_opacity=0.22,unsharp=5:5:0.3"
# mirror haze: clear around the eyes, misted towards the edges and the bottom of the glass
HAZE_MASK="geq=lum='255*clip(0.04+0.96*(1-exp(-(pow((X-530)/430\,2)+pow((Y-760)/330\,2))))+0.35*clip((Y-1000)/700\,0\,1)\,0\,1)'"
HAZE="gblur=sigma=16,curves=all='0/0.12 0.5/0.58 1/1'"
pl() { # "n:v n:v ..." -> piecewise-linear ffmpeg expression in n (commas escaped for the filtergraph)
  echo "$1" | awk '{ split($NF, z, ":"); e = z[2]
    for (i = NF - 1; i >= 1; i--) { split($i, a, ":"); split($(i + 1), b, ":")
      e = sprintf("if(lt(n\\,%d)\\,%s+(%d)*(n-%d)/%d\\,%s)", b[1], a[2], b[2] - a[2], a[1], b[1] - a[1], e) }
    print e }'
}
shot() { # name in_frame frames "n:x ..." first_index
  mkdir -p "$OUT/$1"
  ffmpeg -v error -y -i "$SRC" -vf "select=gte(n\,$2),format=yuv444p,crop=1215:2160:$(pl "$4"):0,scale=1080:1920:flags=lanczos,$GRADE" \
    -frames:v "$3" -fps_mode passthrough -q:v 2 -start_number "$5" "$OUT/$1/%04d.jpg"
  echo "$1 $3 frames from source frame $2"
}
mirror() { # name in_frame frames scale "n:x ..." "n:y ..."   (x/y: top-left of the shrunk frame)
  mkdir -p "$OUT/$1"
  FW=$(awk "BEGIN { print 2 * int(3840 * $4 / 2) }"); FH=$(awk "BEGIN { print 2 * int(2160 * $4 / 2) }")
  X=$(pl "$5"); Y=$(pl "$6")
  # beyond the picture the glass continues its edges: the top rows smeared up, the bottom rows reflected and stretched down
  # (hair and shoulders), all blurred; the sharp picture is feathered in on top
  ffmpeg -v error -y -i "$SRC" -f lavfi -i "color=black:s=1080x1920:r=24,format=gray,$HAZE_MASK,format=gbrp" \
    -f lavfi -i "color=black:s=${FW}x${FH}:r=24,format=gray,geq=lum='255*clip(min(min(X\,W-1-X)\,min(Y\,H-1-Y))/90\,0\,1)'" -filter_complex \
    "[0:v]select=gte(n\,$2),format=yuv444p,split[a][c];[c]scale=1:1:flags=area,scale=1080:1920:flags=neighbor[base];[a]scale=$FW:$FH:flags=lanczos,split=4[m][t][b][f];[t]crop=$FW:24:0:0,scale=$FW:420,gblur=sigma=40[tt];[b]crop=$FW:120:0:$((FH - 120)),vflip,scale=$FW:1000[bb];[tt][m][bb]vstack=3,gblur=sigma=24[ext];[base][ext]overlay=x=$X:y=$Y-420:format=yuv444,gblur=sigma=12[bg];[f][2:v]alphamerge[fa];[bg][fa]overlay=x=$X:y=$Y:format=yuv444,$GRADE,format=gbrp,split[s][h];[h]$HAZE[hz];[s][hz][1:v]maskedmerge,curves=all='0/0.04 1/0.985'" \
    -frames:v "$3" -fps_mode passthrough -q:v 2 -start_number 1 "$OUT/$1/%04d.jpg"
  echo "$1 $3 frames from source frame $2 (mirror)"
}
rm -rf "$OUT"
# 0 - 2.65: her face in the misted mirror, head tilted, leaning in (9.2 - 12.1 s of the take)
mirror A 220 72 0.34 "0:-81 6:-102 12:-130 18:-145 24:-142 30:-128 36:-109 42:-97 48:-95 54:-113 60:-143 66:-177 71:-196" \
  "0:326 6:342 12:361 18:370 24:381 30:396 36:413 42:426 48:441 54:458 60:468 66:470 71:462" &
shot B 30 131 "0:1293 6:1314 12:1378 18:1470 24:1590 30:1713 36:1807 42:1844 48:1794 54:1668 60:1497 66:1330 72:1187 78:1056 84:962 90:908 96:891 102:928 108:958 114:968 120:967 126:956 130:963" 1 &   # 2.2 - 7.4 through the glass: hands through her hair, the flip on the 4.4 downbeat, face to camera under the thesis
shot C 180 40 "0:958 6:1013 12:1053 18:1079 24:1085 30:1081 36:1080 39:1093" 1 &          # her hair framing her face
shot D 486 40 "0:1078 6:1079 12:1126 18:1199 24:1264 30:1307 36:1324 39:1310" 1 &        # skin, extreme close-up
shot E 616 64 "0:1000 33:1000 36:1018 39:1063 42:1120 45:1174 48:1211 50:1220 63:1215" 1 &   # fingertips along her jaw (nails); eases onto her face as the mirror closes
wait
ffmpeg -v error -y -i "$OUT/A/0001.jpg" -vf "hflip,gblur=sigma=40" -q:v 4 "$ASSETS/hazy_fill.jpg"
for k in A B C D E; do echo "$k $(ls "$OUT/$k" | wc -l) frames"; done
