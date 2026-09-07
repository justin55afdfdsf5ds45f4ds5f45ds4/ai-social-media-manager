#!/bin/sh
# Render the missing 130-frame segments of a reel until ~36 s have elapsed; rerun until it prints ALLDONE.
#   REEL=vo-04-tight ./drive.sh
cd "$(dirname "$0")"
REEL="${REEL:-.}"; mkdir -p "$REEL/seg"
TOTAL=$(node -p "Math.round(require(require('path').resolve(process.argv[1])).DUR*25)" "$REEL/engine.js")
START=$(date +%s)
i=0
while [ $i -lt $TOTAL ]; do
  e=$((i+130)); [ $e -gt $TOTAL ] && e=$TOTAL
  f=$REEL/seg/seg_$(printf %04d $i).mp4
  if [ ! -s "$f" ] || [ "$(ffprobe -v error -show_entries stream=nb_frames -of csv=p=0 "$f" 2>/dev/null)" != "$((e-i))" ]; then
    now=$(date +%s); [ $((now-START)) -gt 36 ] && { echo "budget hit at $i / $TOTAL"; exit 0; }
    rm -f "$f"; SC=${SC:-1.5} REEL="$REEL" node render_seg.js $i $e "$f"
  fi
  i=$e
done
echo ALLDONE
