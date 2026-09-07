#!/bin/sh
# Stitch a reel's segments, mix the audio (mix.js: voice + riser + music + button hits), final encode.
#   REEL=vo-04-tight ./build.sh        -> vo-04-tight/reel.mp4
cd "$(dirname "$0")"
REEL="${REEL:-.}"
OUT="${OUT:-$REEL/reel.mp4}"
ls "$REEL/seg" | grep '^seg_.*\.mp4$' | sort | sed "s#^#file '#;s#\$#'#" > "$REEL/seg/list.txt"
ffmpeg -v error -y -f concat -safe 0 -i "$REEL/seg/list.txt" -c copy "$REEL/video_only.mp4"
ffmpeg -v error -y -i "$REEL/vo.mp3" -af "loudnorm=I=-14:TP=-1.5:LRA=11" -ar 48000 -ac 2 "$REEL/vo_norm.wav"
node mix.js "$REEL"
ffmpeg -v error -y -i "$REEL/video_only.mp4" -i "$REEL/mix.wav" -map 0:v -map 1:a -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p   -c:a aac -b:a 192k -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_type,nb_frames,width,height:format=duration,size -of csv=p=0 "$OUT"
