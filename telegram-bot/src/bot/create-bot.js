import path from 'node:path';
import { Bot } from 'grammy';
import { createSearchPage } from './search-view.js';
import { albumPrompt, coverPrompt } from './metadata-view.js';
import { splitArtistTitle } from '../domain/tracks.js';
import { downloadUrl, extensionFromFilename, removeIfExists, temporaryPath } from '../infrastructure/files.js';
import { parseSearchCallback } from '../services/search-sessions.js';
import { parseIngestionCallback } from '../services/ingestion-sessions.js';
import { searchProviders } from '../services/provider-search.js';
import { isYouTubeUrl } from '../providers/youtube-provider.js';

function userId(ctx) {
  return String(ctx.from?.id || '');
}

function isAllowed(ctx, config) {
  return config.allowedUserIds.has(userId(ctx));
}

function isHttpUrl(value) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
}

async function answerCallback(ctx, text) {
  await ctx.answerCallbackQuery({ text }).catch(() => undefined);
}

export function createBot({
  config,
  providers,
  searchSessions,
  ingestionService,
  ingestionSessions,
  downloadService,
  logger = console,
}) {
  const bot = new Bot(config.telegramToken);
  const providersByName = new Map(providers.map((provider) => [provider.name, provider]));

  bot.use(async (ctx, next) => {
    if (!ctx.from || isAllowed(ctx, config)) return next();
    if (ctx.callbackQuery) {
      await ctx.answerCallbackQuery({ text: 'У вас нет доступа к этому боту.', show_alert: true });
    } else {
      await ctx.reply('У вас нет доступа к этому боту.');
    }
  });

  async function promptForAlbum(ctx, session) {
    session.stage = 'album-choice';
    const prompt = albumPrompt(session);
    await ctx.reply(prompt.text, { reply_markup: prompt.replyMarkup });
  }

  async function promptForCover(ctx, session) {
    session.stage = 'cover-choice';
    const prompt = coverPrompt(session);
    await ctx.reply(prompt.text, { reply_markup: prompt.replyMarkup });
  }

  async function beginIngestion(ctx, filePath, originalFilename, seedMetadata = {}) {
    const session = await ingestionService.start({
      userId: userId(ctx),
      chatId: ctx.chat.id,
      filePath,
      originalFilename,
      seedMetadata,
    });

    if (!session.metadata.artist || !session.metadata.title) {
      session.stage = 'artist-title';
      await ctx.reply('Не удалось определить артиста и название. Пришлите их в формате «Исполнитель - Название».');
      return;
    }
    await promptForAlbum(ctx, session);
  }

  async function finishIngestion(ctx, session) {
    await ctx.reply('Сохраняю трек и записываю метаданные…');
    const { destination, converted } = await ingestionService.complete(session);
    const filename = path.basename(destination);
    await ctx.reply(`${converted ? 'Трек был конвертирован в MP3. ' : ''}Сохранено: ${filename}`);
  }

  async function search(ctx, query) {
    const { tracks, failures } = await searchProviders(providers, query);
    if (tracks.length === 0) {
      logger.warn('All providers failed or returned no tracks', { query, failures });
      await ctx.reply('Ничего не найдено. Попробуйте изменить запрос.');
      return;
    }
    const session = searchSessions.create({ userId: userId(ctx), chatId: ctx.chat.id, tracks });
    const view = createSearchPage(session, 0, config.searchPageSize);
    await ctx.reply(view.text, { reply_markup: view.replyMarkup });
    if (failures.length > 0) {
      await ctx.reply(`Не удалось получить результаты из: ${failures.map(({ provider }) => provider).join(', ')}.`);
    }
  }

  async function downloadSelectedTrack(ctx, track) {
    await ctx.reply('Скачиваю выбранный трек…');
    const { filePath, track: downloadedTrack } = await downloadService.download(track);
    const originalFilename = `${downloadedTrack.artist || 'Unknown'} - ${downloadedTrack.title || 'Track'}${extensionFromFilename(filePath)}`;
    await beginIngestion(ctx, filePath, originalFilename, downloadedTrack);
  }

  async function downloadTelegramAudio(ctx) {
    const audio = ctx.message.audio;
    const originalFilename = audio.file_name || `audio${extensionFromFilename(audio.mime_type === 'audio/mpeg' ? '.mp3' : '')}`;
    const destination = temporaryPath(config.tempDir, extensionFromFilename(originalFilename));
    await ctx.reply('Загружаю аудиофайл…');
    try {
      const file = await ctx.api.getFile(audio.file_id);
      if (!file.file_path) throw new Error('Telegram did not return a file path');
      const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
      await downloadUrl(url, destination, { timeoutMs: config.downloadTimeoutMs });
      await beginIngestion(ctx, destination, originalFilename);
    } catch (error) {
      await removeIfExists(destination);
      throw error;
    }
  }

  async function downloadTelegramCover(ctx, session) {
    const photo = ctx.message.photo.at(-1);
    const destination = temporaryPath(config.tempDir, '.jpg');
    const file = await ctx.api.getFile(photo.file_id);
    if (!file.file_path) throw new Error('Telegram did not return a cover path');
    const url = `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`;
    await downloadUrl(url, destination, { timeoutMs: config.downloadTimeoutMs });
    await removeIfExists(session.coverPath);
    session.coverPath = destination;
    session.stage = 'cover-choice';
    await ctx.reply('Обложка добавлена.');
    await finishIngestion(ctx, session);
  }

  async function handleIngestionText(ctx, session, text) {
    if (session.stage === 'artist-title') {
      const parsed = splitArtistTitle(text);
      if (!parsed) {
        await ctx.reply('Неверный формат. Используйте «Исполнитель - Название».');
        return true;
      }
      await ingestionService.setArtistAndTitle(session, parsed);
      await promptForAlbum(ctx, session);
      return true;
    }

    if (session.stage === 'album') {
      ingestionService.setAlbum(session, text);
      await promptForCover(ctx, session);
      return true;
    }

    if (session.stage === 'cover') {
      if (!isHttpUrl(text)) {
        await ctx.reply('Пришлите фотографию или корректную HTTP(S)-ссылку на обложку.');
        return true;
      }
      const coverPath = temporaryPath(config.tempDir, '.img');
      try {
        await downloadUrl(text, coverPath, { timeoutMs: config.downloadTimeoutMs });
        await removeIfExists(session.coverPath);
        session.coverPath = coverPath;
        await ctx.reply('Обложка загружена.');
        await finishIngestion(ctx, session);
      } catch (error) {
        await removeIfExists(coverPath);
        throw error;
      }
      return true;
    }
    return false;
  }

  bot.command('start', async (ctx) => {
    await ctx.reply('Отправьте аудиофайл, YouTube-ссылку или обычный текст для поиска в SkySound и YouTube.');
  });

  bot.command('cancel', async (ctx) => {
    await ingestionService.cancel(userId(ctx));
    await ctx.reply('Текущая операция отменена.');
  });

  bot.on('callback_query:data', async (ctx) => {
    const searchAction = parseSearchCallback(ctx.callbackQuery.data);
    if (searchAction) {
      const session = searchSessions.get(searchAction.sessionId, userId(ctx));
      if (!session) {
        await answerCallback(ctx, 'Результаты поиска устарели. Выполните поиск ещё раз.');
        return;
      }
      if (searchAction.action === 'cancel') {
        searchSessions.delete(session.id);
        await answerCallback(ctx, 'Поиск отменён.');
        await ctx.editMessageText('Поиск отменён.').catch(() => undefined);
        return;
      }
      if (searchAction.action === 'page') {
        const view = createSearchPage(session, searchAction.value, config.searchPageSize);
        await answerCallback(ctx);
        await ctx.editMessageText(view.text, { reply_markup: view.replyMarkup });
        return;
      }
      const track = session.tracks[searchAction.value];
      if (!track) {
        await answerCallback(ctx, 'Трек не найден.');
        return;
      }
      searchSessions.delete(session.id);
      await answerCallback(ctx);
      await ctx.editMessageText(`Выбрано: ${track.artist} — ${track.title}`).catch(() => undefined);
      await downloadSelectedTrack(ctx, track);
      return;
    }

    const metadataAction = parseIngestionCallback(ctx.callbackQuery.data);
    if (!metadataAction) return;
    const session = ingestionSessions.get(metadataAction.sessionId, userId(ctx));
    if (!session) {
      await answerCallback(ctx, 'Эта операция уже завершена или отменена.');
      return;
    }
    await answerCallback(ctx);

    if (metadataAction.field === 'flow' && metadataAction.action === 'cancel') {
      await ingestionService.cancel(userId(ctx));
      await ctx.editMessageText('Операция отменена.').catch(() => undefined);
      return;
    }
    if (metadataAction.field === 'album') {
      if (metadataAction.action === 'change') {
        session.stage = 'album';
        await ctx.reply('Пришлите название альбома.');
      } else {
        await promptForCover(ctx, session);
      }
      return;
    }
    if (metadataAction.field === 'cover') {
      if (metadataAction.action === 'change') {
        session.stage = 'cover';
        await ctx.reply('Пришлите фотографию или HTTP(S)-ссылку на обложку.');
      } else {
        await finishIngestion(ctx, session);
      }
    }
  });

  bot.on('message:audio', downloadTelegramAudio);

  bot.on('message:photo', async (ctx) => {
    const session = ingestionSessions.getByUser(userId(ctx));
    if (!session || session.stage !== 'cover') {
      await ctx.reply('Сначала отправьте аудиофайл или начните поиск текста.');
      return;
    }
    await downloadTelegramCover(ctx, session);
  });

  bot.on('message:text', async (ctx) => {
    const text = ctx.message.text.trim();
    const session = ingestionSessions.getByUser(userId(ctx));
    if (session && await handleIngestionText(ctx, session, text)) return;
    if (session) {
      await ctx.reply('Сначала завершите текущий шаг кнопками или отмените его командой /cancel.');
      return;
    }

    if (isYouTubeUrl(text)) {
      const provider = providersByName.get('youtube');
      const track = await provider.inspectUrl(text);
      await downloadSelectedTrack(ctx, track);
      return;
    }
    if (isHttpUrl(text)) {
      await ctx.reply('Поддерживаются только прямые ссылки YouTube.');
      return;
    }
    await search(ctx, text);
  });

  bot.catch(async (error) => {
    logger.error('Bot update failed', error);
    const ctx = error.ctx;
    if (ctx?.chat) await ctx.reply('Не удалось обработать запрос. Попробуйте ещё раз.').catch(() => undefined);
  });

  return bot;
}
