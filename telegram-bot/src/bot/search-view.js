import { InlineKeyboard } from 'grammy';
import { searchCancelCallback, searchPageCallback, searchSelectCallback } from '../services/search-sessions.js';

const SOURCE_LABELS = { skysound: 'SkySound', youtube: 'YouTube' };

function truncate(value, maxLength = 60) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

export function resultLabel(track) {
  const source = SOURCE_LABELS[track.source] || track.source;
  const bitrate = track.bitrate ? ` · ${track.bitrate} кбит/с` : '';
  return truncate(`${source}${bitrate}: ${track.artist} — ${track.title}`);
}

export function createSearchPage(session, page, pageSize) {
  const pageCount = Math.max(1, Math.ceil(session.tracks.length / pageSize));
  const safePage = Math.min(Math.max(page, 0), pageCount - 1);
  const firstIndex = safePage * pageSize;
  const tracks = session.tracks.slice(firstIndex, firstIndex + pageSize);
  const keyboard = new InlineKeyboard();

  tracks.forEach((track, offset) => {
    keyboard.text(resultLabel(track), searchSelectCallback(session.id, firstIndex + offset)).row();
  });

  if (pageCount > 1) {
    if (safePage > 0) keyboard.text('‹ Назад', searchPageCallback(session.id, safePage - 1));
    if (safePage < pageCount - 1) keyboard.text('Далее ›', searchPageCallback(session.id, safePage + 1));
    keyboard.row();
  }
  keyboard.text('Отмена', searchCancelCallback(session.id));

  return {
    page: safePage,
    text: `Найдено треков: ${session.tracks.length}. Страница ${safePage + 1}/${pageCount}. Выберите трек:`,
    replyMarkup: keyboard,
  };
}
