$ErrorActionPreference = 'Stop'
$videoRoot = $PSScriptRoot
& node (Join-Path $videoRoot 'soundtrack.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Soundtrack generation failed' }
& ffmpeg -y -hide_banner -loglevel warning -framerate 24 -i (Join-Path $videoRoot 'frames/%05d.png') -i (Join-Path $videoRoot 'soundtrack.wav') -vf 'scale=1080:1920:flags=lanczos' -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k -t 24 -movflags +faststart (Join-Path $videoRoot 'DraftLane-social-1080x1920.mp4')
if ($LASTEXITCODE -ne 0) { throw 'Video encoding failed' }
