# Music Backend

Express API for the Veles browser extension. It authenticates extension users, searches shared music providers, keeps short-lived download jobs, converts covers to WebP quality 95, and saves completed tracks into the Navidrome library.

The service listens on HTTP inside Docker. Cloudflare must proxy `music-backend.dvaranir.com` and terminate public HTTPS. The Compose host mapping is `${MUSIC_BACKEND_PORT:-80}:80`.

Persistent data is SQLite at `/app/data/music-backend.sqlite`; finished tracks are written to `/app/music`.
