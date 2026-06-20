import crypto from 'node:crypto';

export function createTrack({ source, artist = '', title = '', duration = '', bitrate, detailUrl, url, id }) {
  return Object.freeze({
    id: id || crypto.randomUUID(),
    source,
    artist: cleanText(artist),
    title: cleanText(title),
    duration: cleanText(duration),
    bitrate: Number.isFinite(bitrate) && bitrate > 0 ? Math.round(bitrate) : undefined,
    detailUrl,
    url,
  });
}

export function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function splitArtistTitle(value) {
  const [artist, ...titleParts] = cleanText(value).split(/\s+-\s+/);
  const title = titleParts.join(' - ');
  if (!artist || !title) return null;
  return { artist, title };
}

export function mergeMetadata(base, enrichment) {
  return {
    artist: cleanText(enrichment?.artist || base.artist),
    title: cleanText(enrichment?.title || base.title),
    album: cleanText(enrichment?.album || base.album),
  };
}
