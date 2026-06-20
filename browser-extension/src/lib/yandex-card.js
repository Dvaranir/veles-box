const likeLabels = new Set(['like', 'нравится']);

function labelValue(element, prefixes) {
  const label = element?.getAttribute('aria-label') || '';
  const prefix = prefixes.find((item) => label.toLowerCase().startsWith(item.toLowerCase()));
  return prefix ? label.slice(prefix.length).trim() : '';
}

export function highResolutionCoverUrl(value) {
  const url = new URL(value);
  if (url.hostname !== 'avatars.yandex.net') return null;
  url.pathname = url.pathname.replace(/\/\d+x\d+(?=\/|$)/, '/1000x1000');
  return url.toString();
}

export function isLikeButton(button) {
  const label = (button?.getAttribute('aria-label') || '').trim().toLowerCase();
  return button?.getAttribute('aria-pressed') !== null && likeLabels.has(label);
}

export function extractTrackFromLikeButton(button) {
  for (let card = button?.parentElement; card && card !== document.body; card = card.parentElement) {
    const trackLink = card.querySelector('a[href*="/track/"][aria-label]');
    const artistLink = card.querySelector('a[href*="/artist/"][aria-label]');
    const title = labelValue(trackLink, ['Track ', 'Трек ']);
    const artist = labelValue(artistLink, ['Artist ', 'Исполнитель ']);
    if (!title || !artist) continue;
    const image = card.querySelector('img[src*="avatars.yandex.net"]');
    return {
      id: trackLink.getAttribute('href'), title, artist,
      sourceUrl: new URL(trackLink.getAttribute('href'), location.origin).toString(),
      coverUrl: image ? highResolutionCoverUrl(image.currentSrc || image.src) : null,
    };
  }
  return null;
}

export function installLikeListener(onLiked) {
  const prompted = new Set();
  const handler = (event) => {
    const button = event.target.closest?.('button[aria-pressed]');
    if (!isLikeButton(button)) return;
    const wasLiked = button.getAttribute('aria-pressed') === 'true';
    queueMicrotask(() => requestAnimationFrame(() => {
      const track = extractTrackFromLikeButton(button);
      if (!track) return;
      if (wasLiked && button.getAttribute('aria-pressed') === 'false') prompted.delete(track.id);
      if (!wasLiked && button.getAttribute('aria-pressed') === 'true' && !prompted.has(track.id)) {
        prompted.add(track.id);
        onLiked(track);
      }
    }));
  };
  document.addEventListener('click', handler, true);
  return () => document.removeEventListener('click', handler, true);
}
