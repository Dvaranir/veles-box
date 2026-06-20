FROM node:22-bookworm-slim

ARG YTDLP_VERSION=2024.12.23

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg cron zip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp_linux" -o /usr/local/bin/yt-dlp \
    && chmod 0755 /usr/local/bin/yt-dlp

WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/music-core/package.json packages/music-core/package.json
COPY telegram-bot/package.json telegram-bot/package.json
COPY music-backend/package.json music-backend/package.json
COPY browser-extension/package.json browser-extension/package.json
RUN npm ci --omit=dev --workspace @veles/telegram-bot --include-workspace-root

COPY packages/music-core packages/music-core
COPY telegram-bot telegram-bot

RUN install -m 0755 telegram-bot/docker-start.sh /usr/local/bin/start-bot \
    && install -m 0755 telegram-bot/backup_to_pixeldrain.sh /usr/local/bin/backup_to_pixeldrain.sh \
    && install -m 0755 telegram-bot/backup_wrapper.sh /usr/local/bin/backup_wrapper.sh \
    && mkdir -p /bot/temp /bot/music /app/telegram-bot/log/cron \
    && printf '%s\n' '0 0 */14 * * root /usr/local/bin/backup_wrapper.sh >> /app/telegram-bot/log/cron/backup.log 2>&1' > /etc/cron.d/veles-backup \
    && chmod 0644 /etc/cron.d/veles-backup

WORKDIR /app/telegram-bot
CMD ["/usr/local/bin/start-bot"]
