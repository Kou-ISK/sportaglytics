import { writeTextFileAtomically } from '../ipc/atomicTextFile';
import { randomUUID } from 'node:crypto';
import * as fs from 'fs/promises';
import { constants, existsSync } from 'fs';
import * as path from 'path';
import type { Playlist } from '../../../src/types/playlist/core';
import { normalizePlaylistDocument } from '../../../src/shared/playlist/playlistDocument';
import {
  PLAYLIST_WINDOW_CHANNELS,
  isPlaylist,
} from '../../../src/types/ipc/playlistWindow';
import { runMediaProcess } from '../ipc/mediaProcessRunner';
import { H264_ENCODER_ARGS } from '../mediaTools';
import { ensureWindowsH264Encoder } from '../windowsH264Capability';
import { resolvePlaylistMediaReferences } from './mediaReferences';
import {
  overlappingEmbeddedAudio,
  validateEmbeddedOutput,
} from './validateEmbeddedOutput';
import { rebaseEmbeddedAnnotation } from './embeddedAnnotationTime';

const extractVideoSegment = async (
  ffmpegPath: string,
  sourcePath: string,
  destPath: string,
  startTime: number,
  endTime: number,
  audioIndices: readonly number[],
): Promise<void> => {
  const duration = endTime - startTime;

  const args = [
    '-seek_timestamp',
    '0',
    '-ss',
    startTime.toString(),
    '-i',
    sourcePath,
    '-t',
    duration.toString(),
    '-map',
    '0:v:0',
    ...audioIndices.flatMap((index) => ['-map', `0:a:${index}`]),
    ...H264_ENCODER_ARGS,
    '-c:a',
    'aac',
    '-n',
    destPath,
  ];

  if (H264_ENCODER_ARGS.includes('h264_mf'))
    await ensureWindowsH264Encoder(ffmpegPath);
  await runMediaProcess(ffmpegPath, args, {
    timeoutMs: 6 * 60 * 60 * 1000,
    maxOutputBytes: 4 * 1024 * 1024,
  });
};

export const savePlaylistToPath = async (
  targetPath: string,
  playlist: Playlist,
  event: Electron.IpcMainInvokeEvent,
  ffmpegPath: string,
  beforeCommit?: () => Promise<void>,
  finalCheck?: () => void,
  reusableAssets: ReadonlyMap<string, string> = new Map(),
  sourceBase: string = targetPath,
): Promise<void> => {
  let document = normalizePlaylistDocument(playlist);
  if (document.type === 'reference') {
    document = {
      ...document,
      items: (await resolvePlaylistMediaReferences(document.items, targetPath))
        .items,
    };
  }
  await fs.mkdir(targetPath, { recursive: true });

  let processedPlaylist = document;

  if (document.type === 'embedded') {
    if (
      document.items.some(
        (item) =>
          !Number.isFinite(item.startTime) ||
          !Number.isFinite(item.endTime) ||
          item.startTime < 0 ||
          item.endTime <= item.startTime,
      )
    )
      throw Error('PLAYLIST_INVALID_EMBEDDED_RANGE');
    const videosDir = path.join(targetPath, 'videos');
    await fs.mkdir(videosDir, { recursive: true });
    const videosStat = await fs.lstat(videosDir);
    if (!videosStat.isDirectory() || videosStat.isSymbolicLink())
      throw Error('PLAYLIST_VIDEO_DIRECTORY_INVALID');

    const copiedVideos = new Map<string, string>();
    const totalItems = document.items.length;
    let processedCount = 0;

    const sendProgress = (current: number, total: number): void => {
      const sender = event.sender;
      if (sender && !sender.isDestroyed()) {
        sender.send(PLAYLIST_WINDOW_CHANNELS.saveProgress, {
          current,
          total,
        });
      }
    };

    const processedItems: Playlist['items'] = [];
    for (const item of document.items) {
      let primaryReused = false;
      const processVideo = async (
        sourcePath: string | undefined,
        isSecondary: boolean,
      ): Promise<string | undefined> => {
        if (!sourcePath) return undefined;
        const reusable = reusableAssets.get(
          `${item.id}:${isSecondary ? 'angle2' : 'angle1'}`,
        );
        if (reusable) {
          const targetVideos = await fs.realpath(videosDir);
          const relative = path.relative(targetVideos, reusable);
          if (
            relative &&
            relative !== '..' &&
            !relative.startsWith(`..${path.sep}`) &&
            !path.isAbsolute(relative)
          ) {
            if (!isSecondary) primaryReused = true;
            return `./videos/${relative.split(path.sep).join('/')}`;
          }
          const instanceDir = await fs.mkdtemp(path.join(videosDir, 'item-'));
          const name = `angle${isSecondary ? 2 : 1}-${randomUUID()}${path.extname(reusable)}`;
          await fs.copyFile(
            reusable,
            path.join(instanceDir, name),
            constants.COPYFILE_EXCL,
          );
          if (!isSecondary) primaryReused = true;
          return `./videos/${path.basename(instanceDir)}/${name}`;
        }

        const cacheKey = `${sourcePath}_${item.startTime}_${item.endTime}`;
        if (copiedVideos.has(cacheKey)) {
          return copiedVideos.get(cacheKey);
        }

        const instanceDir = await fs.mkdtemp(path.join(videosDir, 'item-'));
        const name = `angle${isSecondary ? 2 : 1}-${randomUUID()}.mp4`;
        const destPath = path.join(instanceDir, name);
        const relativePath = `./videos/${path.basename(instanceDir)}/${name}`;
        const absoluteSourcePath = path.isAbsolute(sourcePath)
          ? sourcePath
          : path.resolve(sourceBase, sourcePath);
        if (!existsSync(absoluteSourcePath))
          throw Error('PLAYLIST_MEDIA_SOURCE_MISSING');

        const audioIndices = await overlappingEmbeddedAudio(
          absoluteSourcePath,
          item.startTime,
          item.endTime - item.startTime,
        );
        await extractVideoSegment(
          ffmpegPath,
          absoluteSourcePath,
          destPath,
          item.startTime,
          item.endTime,
          audioIndices,
        );
        await validateEmbeddedOutput(
          absoluteSourcePath,
          destPath,
          item.endTime - item.startTime,
          false,
          item.startTime,
        );

        copiedVideos.set(cacheKey, relativePath);
        return relativePath;
      };

      const newVideoSource = await processVideo(item.videoSource, false);
      const newVideoSource2 = await processVideo(item.videoSource2, true);

      processedCount += 1;
      sendProgress(processedCount, totalItems);

      const isAlreadyProcessed =
        primaryReused || (!newVideoSource && !newVideoSource2);
      const duration = isAlreadyProcessed
        ? item.endTime
        : item.endTime - item.startTime;
      const startTime = isAlreadyProcessed ? item.startTime : 0;

      processedItems.push({
        ...item,
        annotation: isAlreadyProcessed
          ? item.annotation
          : rebaseEmbeddedAnnotation(item.annotation, item.startTime),
        videoSource: newVideoSource,
        videoSource2: newVideoSource2,
        mediaReference: undefined,
        mediaReference2: undefined,
        startTime,
        endTime: isAlreadyProcessed ? item.endTime : duration,
      });
    }

    processedPlaylist = { ...document, items: processedItems };
  }

  const playlistJsonPath = path.join(targetPath, 'playlist.json');
  const content = JSON.stringify(processedPlaylist, null, 2);
  await writeTextFileAtomically(
    playlistJsonPath,
    content,
    beforeCommit,
    finalCheck,
  );

  console.log('[Playlist] Saved package to:', targetPath);
};

const resolvePackageVideoPath = (
  targetPath: string,
  videoPath: string | undefined,
): string | undefined => {
  if (!videoPath) return undefined;

  if (videoPath.startsWith('./videos/') || videoPath.startsWith('videos/')) {
    const relativePath = videoPath.replace(/^\.?\//, '');
    const resolved = path.join(targetPath, relativePath);
    if (!existsSync(resolved)) {
      console.warn(`[Playlist] Video file not found: ${resolved}`);
      return resolved;
    }
    return resolved;
  }

  if (path.isAbsolute(videoPath)) {
    if (!existsSync(videoPath)) {
      console.warn(`[Playlist] Referenced video not found: ${videoPath}`);
      return videoPath;
    }
    return videoPath;
  }

  const resolved = path.join(targetPath, videoPath);
  return resolved;
};

export const loadPlaylistFromPath = async (
  targetPath: string,
): Promise<Playlist> => {
  const playlistJsonPath = path.join(targetPath, 'playlist.json');

  if (!existsSync(playlistJsonPath)) {
    throw new Error(
      `プレイリストファイルが見つかりません: ${playlistJsonPath}`,
    );
  }

  const content = await fs.readFile(playlistJsonPath, 'utf-8');
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(
      'プレイリストファイルが破損しています。JSONの解析に失敗しました。',
    );
  }

  if (!isPlaylist(parsed)) {
    throw new Error(
      'プレイリストファイルの形式が不正です。必須フィールドが欠落しています。',
    );
  }

  const playlist = normalizePlaylistDocument(parsed);

  const resolvedItems = playlist.items.map((item) => {
    return {
      ...item,
      videoSource: resolvePackageVideoPath(targetPath, item.videoSource),
      videoSource2: resolvePackageVideoPath(targetPath, item.videoSource2),
    };
  });

  if (playlist.type === 'reference') {
    return {
      ...playlist,
      items: (await resolvePlaylistMediaReferences(resolvedItems, targetPath))
        .items,
    };
  }

  return { ...playlist, items: resolvedItems };
};
