import { InlineKeyboard } from 'grammy';
import { ingestionCallback } from '../services/ingestion-sessions.js';

function flowCancelButton(keyboard, session) {
  return keyboard.row().text('Отмена', ingestionCallback(session.id, 'flow', 'cancel'));
}

export function albumPrompt(session) {
  const keyboard = new InlineKeyboard();
  if (session.metadata.album) {
    keyboard
      .text('Оставить', ingestionCallback(session.id, 'album', 'keep'))
      .text('Изменить', ingestionCallback(session.id, 'album', 'change'));
    return {
      text: `Альбом: ${session.metadata.album}`,
      replyMarkup: flowCancelButton(keyboard, session),
    };
  }
  keyboard
    .text('Добавить', ingestionCallback(session.id, 'album', 'change'))
    .text('Пропустить', ingestionCallback(session.id, 'album', 'skip'));
  return {
    text: 'Альбом не найден. Хотите добавить его?',
    replyMarkup: flowCancelButton(keyboard, session),
  };
}

export function coverPrompt(session) {
  const hasCover = session.hasCover || Boolean(session.coverPath);
  const keyboard = new InlineKeyboard();
  if (hasCover) {
    keyboard
      .text('Оставить', ingestionCallback(session.id, 'cover', 'keep'))
      .text('Заменить', ingestionCallback(session.id, 'cover', 'change'));
    return {
      text: 'У трека уже есть обложка.',
      replyMarkup: flowCancelButton(keyboard, session),
    };
  }
  keyboard
    .text('Добавить', ingestionCallback(session.id, 'cover', 'change'))
    .text('Пропустить', ingestionCallback(session.id, 'cover', 'skip'));
  return {
    text: 'Обложка не найдена. Хотите добавить её?',
    replyMarkup: flowCancelButton(keyboard, session),
  };
}
