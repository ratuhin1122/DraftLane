# DraftLane social promo

## Product demo replacement

`DraftLane-product-demo-1920x1080.mp4` and `DraftLane-product-demo-1080x1920.mp4` are 30-second recuts of the existing landing-page product demo at `public/videos/hero-mint.mp4`. They show canvas generation, AI edits, the document/canvas split view, and a document close-up. These are existing demo visuals, not a fresh capture or verification of the current deployed application. The document close-up is cropped from the split-view footage.

Rebuild both with `node media/draftlane-social/product-video.mjs` after generating the soundtrack. The new recut uses FFmpeg; the earlier illustrated promo below uses NullMotion/GSAP. Temporary scene files live in ignored `.local/product-video/`.

24-second vertical motion graphic, designed for Reels, Shorts, and TikTok. Product UI is an animated illustration, not a live screen recording.

Open `index.html` through a local HTTP server to preview. The animation is deterministic and can be scrubbed with `window.renderAt(seconds)`.

## Render

From the repository root:

```powershell
node media/draftlane-social/render.mjs
node media/draftlane-social/encode.mjs
```

Requires the repository's Playwright development dependency, Chromium (`npx playwright install chromium`), and FFmpeg on PATH. Export: 24 fps, H.264, 1080×1920, yuv420p, AAC, fast-start MP4.

## Credits

The prompt scene uses `buildDraft` from [NullMotion](https://github.com/blixvip/NullMotion), MIT licensed; its license is preserved in `vendor/NULLMOTION-LICENSE`. Vendored GSAP 3.14.2 retains its original license header; terms: https://gsap.com/standard-license.

No showcase footage or third-party advertising was reused. Soundtrack is synthesized locally; no stock music is included.
