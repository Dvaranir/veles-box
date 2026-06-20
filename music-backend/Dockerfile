FROM node:22-bookworm-slim

ARG YTDLP_VERSION=2024.12.23

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux" -o /usr/local/bin/yt-dlp \
    && chmod 0755 /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/music-core/package.json packages/music-core/package.json
COPY telegram-bot/package.json telegram-bot/package.json
COPY music-backend/package.json music-backend/package.json
COPY browser-extension/package.json browser-extension/package.json
RUN npm ci --omit=dev --workspace @veles/music-backend --include-workspace-root

COPY packages/music-core packages/music-core
COPY music-backend music-backend

RUN mkdir -p /app/data /app/music /app/temp

WORKDIR /app/music-backend
CMD ["node", "src/server.js"]
