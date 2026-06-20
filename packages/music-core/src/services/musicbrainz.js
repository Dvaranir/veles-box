import { cleanText } from '../domain/tracks.js';

export class MusicBrainzService {
  constructor({ timeoutMs, userAgent }) { Object.assign(this, { timeoutMs, userAgent }); }

  async findRecording(artist, title) {
    if (!cleanText(artist) || !cleanText(title)) return null;
    const url = new URL('https://musicbrainz.org/ws/2/recording/');
    url.searchParams.set('query', `artist:"${artist}" AND recording:"${title}"`);
    url.searchParams.set('fmt', 'json');
    url.searchParams.set('limit', '1');
    try {
      const response = await fetch(url, { headers: { 'user-agent': this.userAgent, accept: 'application/json' }, signal: AbortSignal.timeout(this.timeoutMs) });
      if (!response.ok) return null;
      const recording = (await response.json()).recordings?.[0];
      if (!recording) return null;
      return {
        artist: cleanText(recording['artist-credit']?.[0]?.name || recording['artist-credit']?.[0]?.artist?.name),
        title: cleanText(recording.title), album: cleanText(recording.releases?.[0]?.title),
      };
    } catch { return null; }
  }
}
