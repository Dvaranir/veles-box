import * as cheerio from 'cheerio';
import { cleanText, createTrack } from '../domain/tracks.js';

export function skySoundSearchUrl(query) {
  const slug = cleanText(query).toLocaleLowerCase('ru-RU').replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '-').replace(/-+/g, '-');
  if (!slug) throw new Error('Search query is empty');
  return new URL(`https://${slug}.skysound7.com/`).toString();
}

export function parseSkySoundSearch(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const tracks = [];
  $('.__adv_list_track').each((_, element) => {
    const detailUrl = $(element).find('a.playlist-down.no-ajax').first().attr('href');
    if (!detailUrl || seen.has(detailUrl)) return;
    seen.add(detailUrl);
    const artist = cleanText($(element).find('.__adv_artist').first().text());
    const title = cleanText($(element).find('.__adv_name').first().text());
    if (!artist || !title) return;
    tracks.push(createTrack({
      source: 'skysound', artist, title,
      duration: cleanText($(element).find('.__adv_duration').first().text()),
      detailUrl: new URL(detailUrl, 'https://skysound7.com').toString(),
    }));
  });
  return tracks;
}

export function parseSkySoundDownloadUrl(html) {
  const url = cheerio.load(html)('.onesongblock-down.__adv_download').first().attr('href');
  if (!url) throw new Error('SkySound download link was not found');
  return url;
}

export class SkySoundProvider {
  constructor({ timeoutMs }) { this.timeoutMs = timeoutMs; this.name = 'skysound'; }

  async search(query) {
    const response = await fetch(skySoundSearchUrl(query), {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; VelesMusic/1.0)' },
    });
    if (!response.ok) throw new Error(`SkySound search failed: HTTP ${response.status}`);
    return parseSkySoundSearch(await response.text());
  }

  async resolveDownload(track) {
    const response = await fetch(track.detailUrl, {
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; VelesMusic/1.0)' },
    });
    if (!response.ok) throw new Error(`SkySound track page failed: HTTP ${response.status}`);
    return { ...track, url: new URL(parseSkySoundDownloadUrl(await response.text()), track.detailUrl).toString() };
  }
}
