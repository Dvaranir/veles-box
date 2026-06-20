import path from 'node:path';
import { inferMetadataFromFilename, readAudioMetadata } from '@veles/music-core/services/audio-metadata';
import { saveTrackToLibrary } from '@veles/music-core/services/library';
import { mergeMetadata } from '@veles/music-core/tracks';
import { removeIfExists } from '@veles/music-core/infrastructure/files';

export class JobService {
  constructor({ jobs, downloads, musicBrainz, covers, config, logger = console }) {
    Object.assign(this, { jobs, downloads, musicBrainz, covers, config, logger });
  }

  create({ userId, track, coverUrl }) {
    const job = this.jobs.create({ userId, track, coverUrl });
    void this.#prepare(job);
    return job;
  }

  async finalize(job, { artist, title, albumAction, album, coverAction, coverFilePath }) {
    if (job.status !== 'awaiting_metadata') throw new Error('The job is not ready for metadata');
    const metadata = {
      artist: artist?.trim() || job.metadata.artist,
      title: title?.trim() || job.metadata.title,
      album: job.metadata.album,
    };
    if (!metadata.artist || !metadata.title) throw new Error('Artist and title are required');
    if (albumAction === 'set') metadata.album = album?.trim() || '';
    if (albumAction === 'skip') metadata.album = '';

    let coverPath = null;
    try {
      if (coverAction === 'yandex') {
        if (!job.coverUrl) throw new Error('No Yandex cover is available for this job');
        coverPath = await this.covers.fromYandex(job.coverUrl);
      } else if (coverAction === 'upload') {
        if (!coverFilePath) throw new Error('A cover file is required');
        coverPath = await this.covers.fromUpload(coverFilePath);
      }
      const result = await saveTrackToLibrary({
        filePath: job.filePath, metadata, coverPath, tempDir: this.config.tempDir, musicDir: this.config.musicDir,
      });
      job.filePath = null;
      job.status = 'completed';
      job.destination = result.destination;
      return result;
    } finally {
      await removeIfExists(coverFilePath);
      if (job.status !== 'completed') await removeIfExists(coverPath);
    }
  }

  async #prepare(job) {
    try {
      const { filePath, track } = await this.downloads.download(job.track);
      if (job.status === 'cancelled') return removeIfExists(filePath);
      job.filePath = filePath;
      const embedded = await readAudioMetadata(filePath);
      const inferred = inferMetadataFromFilename(path.basename(filePath));
      const base = {
        artist: track.artist || embedded.artist || inferred.artist,
        title: track.title || embedded.title || inferred.title,
        album: embedded.album || '',
      };
      const enriched = base.artist && base.title ? await this.musicBrainz.findRecording(base.artist, base.title) : null;
      job.metadata = mergeMetadata(base, enriched);
      job.hasEmbeddedCover = embedded.hasCover;
      job.status = 'awaiting_metadata';
    } catch (error) {
      this.logger.error('Download job failed', { jobId: job.id, message: error.message });
      job.error = 'Не удалось скачать или обработать трек.';
      job.status = 'failed';
    }
  }
}
