import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import * as Dialog from '@radix-ui/react-dialog';
import styles from '../src/style.css?inline';
import { installLikeListener } from '../src/lib/yandex-card.js';

const PAGE_SIZE = 10;
const message = (type, payload) => browser.runtime.sendMessage({ type, payload });
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function filePayload(file) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  return { name: file.name, type: file.type, base64: btoa(binary) };
}

function MusicDialog() {
  const [track, setTrack] = useState(null); const [stage, setStage] = useState('closed'); const [error, setError] = useState('');
  const [search, setSearch] = useState(null); const [page, setPage] = useState(0); const [job, setJob] = useState(null); const [metadata, setMetadata] = useState(null);
  const [albumAction, setAlbumAction] = useState('keep'); const [album, setAlbum] = useState(''); const [coverAction, setCoverAction] = useState('yandex'); const [cover, setCover] = useState(null);

  useEffect(() => installLikeListener(async (likedTrack) => {
    const identity = await message('auth:me');
    setTrack(likedTrack); setError(''); setStage(identity ? 'confirm' : 'auth');
  }), []);

  const results = useMemo(() => search?.results?.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) || [], [search, page]);
  const pageCount = Math.max(1, Math.ceil((search?.results?.length || 0) / PAGE_SIZE));
  const close = async () => { if (job?.status === 'processing') await message('job:cancel', { jobId: job.id }).catch(() => undefined); setStage('closed'); setJob(null); };
  const startSearch = async () => {
    try { setStage('searching'); const result = await message('track:search', track); setSearch(result); setPage(0); setStage(result.results.length ? 'results' : 'error'); if (!result.results.length) setError('Ничего не найдено.'); }
    catch (cause) { setError(cause.message || 'Не удалось выполнить поиск'); setStage('error'); }
  };
  const selectResult = async (resultIndex) => {
    try {
      setStage('processing'); const created = await message('job:create', { searchId: search.id, resultIndex }); setJob(created);
      for (let attempt = 0; attempt < 120; attempt += 1) {
        await sleep(1000); const nextJob = await message('job:get', { jobId: created.id }); setJob(nextJob);
        if (nextJob.status === 'awaiting_metadata') { setMetadata(nextJob.metadata); setAlbum(nextJob.metadata.album || ''); setCoverAction(nextJob.cover.yandexAvailable ? 'yandex' : 'skip'); setStage('metadata'); return; }
        if (nextJob.status === 'failed') throw new Error(nextJob.error);
      }
      throw new Error('Скачивание заняло слишком много времени');
    } catch (cause) { setError(cause.message || 'Не удалось скачать трек'); setStage('error'); }
  };
  const finalize = async (event) => {
    event.preventDefault();
    try {
      setStage('saving');
      if (coverAction === 'upload' && (!cover || cover.size > 10 * 1024 * 1024)) throw new Error('Выберите изображение не больше 10 МБ');
      const coverPayload = coverAction === 'upload' && cover ? await filePayload(cover) : null;
      const result = await message('job:finalize', {
        jobId: job.id,
        fields: { artist: metadata.artist, title: metadata.title, albumAction, album, coverAction }, cover: coverPayload,
      });
      setError(`Сохранено: ${result.filename}`); setStage('done');
    } catch (cause) { setError(cause.message || 'Не удалось сохранить трек'); setStage('error'); }
  };

  return <Dialog.Root open={stage !== 'closed'} onOpenChange={(open) => { if (!open) void close(); }}><Dialog.Overlay className="veles-overlay"/><Dialog.Content className="veles-dialog" aria-describedby={undefined}>
    <Dialog.Title>Veles Music</Dialog.Title>
    {stage === 'auth' && <><p>Для скачивания сначала войдите через popup расширения.</p><button onClick={() => setStage('closed')}>Закрыть</button></>}
    {stage === 'confirm' && <><p>Скачать «{track.title}» — {track.artist} в Navidrome?</p><button onClick={startSearch}>Найти варианты</button><button onClick={close}>Отмена</button></>}
    {(stage === 'searching' || stage === 'processing' || stage === 'saving') && <p>{stage === 'searching' ? 'Ищу варианты…' : stage === 'processing' ? 'Скачиваю и проверяю метаданные…' : 'Сохраняю трек…'}</p>}
    {stage === 'results' && <><p>Выберите источник:</p><div className="veles-results">{results.map((item) => <button key={item.index} onClick={() => selectResult(item.index)}>{item.source} {item.bitrate ? `· ${item.bitrate} кбит/с` : ''}: {item.artist} — {item.title}</button>)}</div><div className="veles-pagination"><button disabled={page === 0} onClick={() => setPage(page - 1)}>Назад</button><span>{page + 1}/{pageCount}</span><button disabled={page + 1 >= pageCount} onClick={() => setPage(page + 1)}>Далее</button></div><button onClick={close}>Отмена</button></>}
    {stage === 'metadata' && <form onSubmit={finalize}><label>Исполнитель<input value={metadata.artist} onChange={(event) => setMetadata({ ...metadata, artist: event.target.value })} required/></label><label>Название<input value={metadata.title} onChange={(event) => setMetadata({ ...metadata, title: event.target.value })} required/></label><label>Альбом<select value={albumAction} onChange={(event) => setAlbumAction(event.target.value)}><option value="keep">Оставить найденный</option><option value="set">Изменить</option><option value="skip">Пропустить</option></select></label>{albumAction === 'set' && <input value={album} onChange={(event) => setAlbum(event.target.value)} placeholder="Название альбома"/>}<label>Обложка<select value={coverAction} onChange={(event) => setCoverAction(event.target.value)}><option value="yandex" disabled={!job.cover.yandexAvailable}>Обложка Яндекс Музыки</option><option value="upload">Загрузить файл</option><option value="skip">Пропустить</option></select></label>{coverAction === 'upload' && <input type="file" accept="image/*" onChange={(event) => setCover(event.target.files?.[0] || null)} required/>}<button>Сохранить</button><button type="button" onClick={close}>Отмена</button></form>}
    {(stage === 'error' || stage === 'done') && <><p role="alert">{error}</p><button onClick={() => setStage('closed')}>Закрыть</button></>}
  </Dialog.Content></Dialog.Root>;
}

export default defineContentScript({
  matches: ['https://music.yandex.ru/*'],
  main() {
    const host = document.createElement('div'); host.id = 'veles-music-extension-root'; document.documentElement.append(host);
    const shadow = host.attachShadow({ mode: 'open' }); const style = document.createElement('style'); style.textContent = styles; shadow.append(style);
    const mount = document.createElement('div'); shadow.append(mount); createRoot(mount).render(<MusicDialog />);
  },
});
