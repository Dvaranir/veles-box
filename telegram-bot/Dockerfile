FROM node:22-bookworm-slim

ARG YTDLP_VERSION=2024.12.23
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg cron zip curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && case "${TARGETARCH:-amd64}" in amd64) ytdlp_asset=yt-dlp_linux ;; arm64) ytdlp_asset=yt-dlp_linux_aarch64 ;; *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; esac \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${ytdlp_asset}" -o /usr/local/bin/yt-dlp \
    && chmod 0755 /usr/local/bin/yt-dlp

WORKDIR /app

# npm ci resolves workspaces from their on-disk package directories. Copy the
# workspace tree before dependency installation; copying manifests alone makes
# npm report "No workspaces found" in a Docker build context.
COPY . .
RUN npm ci --omit=dev --workspace @veles/telegram-bot --include-workspace-root

RUN install -m 0755 telegram-bot/docker-start.sh /usr/local/bin/start-bot \
    && install -m 0755 telegram-bot/backup_to_pixeldrain.sh /usr/local/bin/backup_to_pixeldrain.sh \
    && install -m 0755 telegram-bot/backup_wrapper.sh /usr/local/bin/backup_wrapper.sh \
    && mkdir -p /bot/temp /bot/music /app/telegram-bot/log/cron \
    && printf '%s\n' '0 0 */14 * * root /usr/local/bin/backup_wrapper.sh >> /app/telegram-bot/log/cron/backup.log 2>&1' > /etc/cron.d/veles-backup \
    && chmod 0644 /etc/cron.d/veles-backup

WORKDIR /app/telegram-bot
CMD ["/usr/local/bin/start-bot"]
