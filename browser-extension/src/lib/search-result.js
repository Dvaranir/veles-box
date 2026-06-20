const SOURCE_LABELS = { skysound: 'SkySound', youtube: 'YouTube' };

export function formatSearchResult(track) {
  const source = SOURCE_LABELS[track.source] || track.source;
  const details = [source, track.duration, track.bitrate ? `${track.bitrate} кбит/с` : ''].filter(Boolean);
  return `${details.join(' · ')}: ${track.artist} — ${track.title}`;
}
