# Veles Music browser extension

Build targets:

```sh
npm run build --workspace @veles/browser-extension
npm run build:firefox --workspace @veles/browser-extension
```

Load `browser-extension/.output/chrome-mv3` as an unpacked Chromium extension or `browser-extension/.output/firefox-mv3` as a temporary Firefox add-on during development. The extension uses `https://music-backend.dvaranir.com` as its only backend API.
