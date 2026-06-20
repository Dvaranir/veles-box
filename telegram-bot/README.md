# Veles Telegram bot

Node.js Telegram bot for downloading user audio and searching SkySound/YouTube.

Required environment variables:

- `TELEGRAM_TOKEN` (or legacy `TELEGRAM_BOT_TOKEN`)
- `TELEGRAM_USERS_WHITELIST` — comma-separated Telegram user IDs
- `PIXELDRAIN_TOKEN` — used by the preserved scheduled project backup

Optional variables: `SEARCH_PAGE_SIZE` (default `10`), `SEARCH_SESSION_TTL_MINUTES`, `DOWNLOAD_TIMEOUT_MS`, `YOUTUBE_SEARCH_LIMIT`, `YTDLP_PATH`, `MUSIC_DIR`, and `TEMP_DIR`.

Run locally with Node.js 22+:

```sh
npm install
npm test
npm start
```

The Docker image contains FFmpeg, cron, and a pinned `yt-dlp` binary. It stores finished tracks in `/bot/music` and archives the mounted `/project` directory to PixelDrain every 14 days using the existing backup script.
