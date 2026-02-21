# Asset Pipeline (Free / Zero-Dollar)

## Local Sources
- `Webgl/` → UI graphics, icons, bars, particles.
- `Sounds/` → interaction and glitch SFX.

## Manifest Generation
A script (`scripts/generate-asset-manifest.mjs`) scans `Webgl/` and `Sounds/` for image/audio files and writes:
- `src/data/assetManifest.json`

This keeps art/audio inventory visible to frontend code without hardcoding file lists.

## Commands
```bash
npm run assets:manifest
```

## Free Online Sources (for expansion)
- OpenGameArt (sprites/UI packs)
- Kenney (icons and UI)
- Freesound (SFX)
- Google Fonts (typography)

## Guardrails
1. Use only assets with clear free/commercial-use licenses.
2. Keep attribution notes in docs when required.
3. Optimize heavy images before shipping to GitHub Pages.
