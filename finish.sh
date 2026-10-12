#!/bin/sh
# Mux picture + sound into delivery files for one language.
#   sh finish.sh ku <picture.mp4>      (or: sh finish.sh ar <picture.mp4>)
# Loudness: two-pass loudnorm to -14 LUFS integrated, -1 dBTP (Instagram / Facebook Reels).
set -e
cd "$(dirname "$0")"
L="$1"; PIC="$2"
NAME="MARNYS_BeautyInOut_MirrorVsReality_${L}_1080x1920"
OUTDIR="deliverables"; mkdir -p "$OUTDIR"

norm() { # in.wav out.wav
  J=$(ffmpeg -hide_banner -nostats -i "$1" -af loudnorm=I=-14:TP=-1.0:LRA=7:print_format=json -f null - 2>&1 | sed -n '/{/,/}/p')
  get() { echo "$J" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
  ffmpeg -v error -y -i "$1" -af "loudnorm=I=-14:TP=-1.0:LRA=7:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true,aresample=48000" -c:a pcm_s16le "$2"
}
norm audio/build/mix.wav audio/build/_mix_norm.wav
norm audio/build/sfx_only.wav audio/build/_sfx_norm_raw.wav
# the effects-only track should keep its level relative to the full mix, not be pushed up to -14 on its own
ffmpeg -v error -y -i audio/build/sfx_only.wav -af "volume=$(python -c "
import json,subprocess
def I(f):
    o=subprocess.run(['ffmpeg','-hide_banner','-nostats','-i',f,'-af','ebur128','-f','null','-'],capture_output=True,text=True).stderr
    return float([l for l in o.splitlines() if l.strip().startswith('I:')][-1].split()[1])
print(f'{I(\"audio/build/_mix_norm.wav\")-I(\"audio/build/mix.wav\"):.2f}dB')
"),alimiter=limit=0.89:level=false,aresample=48000" -c:a pcm_s16le audio/build/_sfx_norm.wav

enc() { # audio out
  # intermediate is full-range (JPEG captures); deliver standard limited-range BT.709 4:2:0
  ffmpeg -v error -y -i "$PIC" -i "$1" -map 0:v -map 1:a \
    -vf "scale=in_range=pc:out_range=tv:in_color_matrix=bt709:out_color_matrix=bt709,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709" \
    -c:v libx264 -preset slow -crf 16 -profile:v high -color_range tv -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
    -r 50 -g 100 -movflags +faststart -c:a aac -b:a 320k -ar 48000 -shortest "$2"
}
enc audio/build/_mix_norm.wav "$OUTDIR/${NAME}.mp4"
enc audio/build/_sfx_norm.wav "$OUTDIR/${NAME}_SFX-only.mp4"
ffmpeg -v error -y -ss 1.6 -i "$PIC" -frames:v 1 "$OUTDIR/${NAME}_cover.png"
ls -la "$OUTDIR"
