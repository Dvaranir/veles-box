export function normalizeYandexCoverUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'avatars.yandex.net') throw new Error('Only https://avatars.yandex.net cover URLs are allowed');
  url.pathname = url.pathname.replace(/\/\d+x\d+(?=\/|$)/, '/1000x1000');
  return url.toString();
}
