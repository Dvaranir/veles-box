FROM node:22-bookworm-slim

ARG YTDLP_VERSION=2024.12.23
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && case "${TARGETARCH:-amd64}" in amd64) ytdlp_asset=yt-dlp_linux ;; arm64) ytdlp_asset=yt-dlp_linux_aarch64 ;; *) echo "Unsupported architecture: ${TARGETARCH}" >&2; exit 1 ;; esac \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/${ytdlp_asset}" -o /usr/local/bin/yt-dlp \
    && chmod 0755 /usr/local/bin/yt-dlp

WORKDIR /app

# npm ci resolves workspaces from their on-disk package directories. Copy the
# workspace tree before dependency installation; copying manifests alone makes
# npm report "No workspaces found" in a Docker build context.
COPY . .
RUN npm ci --omit=dev --workspace @veles/music-backend --include-workspace-root

RUN mkdir -p /app/data /app/music /app/temp

WORKDIR /app/music-backend
CMD ["node", "src/server.js"]
