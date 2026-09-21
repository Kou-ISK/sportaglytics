import * as fs from 'fs/promises';
import { existsSync } from 'fs';
import * as path from 'path';
import type { Playlist } from '../../../src/types/playlist/core';
import { normalizePlaylistDocument } from '../../../src/shared/playlist/playlistDocument';
import {
  PLAYLIST_WINDOW_CHANNELS,
  isPlaylist,
} from '../../../src/types/ipc/playlistWindow';
import { runMediaProcess } from '../ipc/mediaProcessRunner';
import { resolvePlaylistMediaReferences } from './mediaReferences';

const extractVideoSegment = async (
  ffmpegPath: string,
  sourcePath: string,
  destPath: string,
  startTime: number,
  endTime: number,
): Promise<void> => {
  const duration = endTime - startTime;

  const args = [
    '-i',
    sourcePath,
    '-ss',
    startTime.toString(),
    '-t',
    duration.toString(),
    '-c',
    'copy',
    '-avoid_negative_ts',
    'make_zero',
    '-y',
    destPath,
  ];

  await runMediaProcess(ffmpegPath, args, {
    timeoutMs: 6 * 60 * 60 * 1000,
    maxOutputBytes: 4 * 1024 * 1024,
  });
};

const sanitizeForFilename = (name: string): string => {
  return name.replace(/[/\\:*?"<>|]/g, '_').trim() || 'item';
};

export const savePlaylistToPath = async (
  targetPath: string,
  playlist: Playlist,
  event: Electron.IpcMainInvokeEvent,
  ffmpegPath: string,
): Promise<void> => {
  let document = normalizePlaylistDocument(playlist);
  if (document.type === 'reference') {
    document = {
      ...document,
      items: (await resolvePlaylistMediaReferences(document.items, targetPath))
        .items,
    };
  }
  const isOverwrite = existsSync(path.join(targetPath, 'playlist.json'));
  await fs.mkdir(targetPath, { recursive: true });

  let processedPlaylist = document;

  if (document.type === 'embedded') {
    const videosDir = path.join(targetPath, 'videos');
    await fs.mkdir(videosDir, { recursive: true });

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

    const processedItems = await Promise.all(
      document.items.map(async (item) => {
        const processVideo = async (
          sourcePath: string | undefined,
          isSecondary: boolean,
        ): Promise<string | undefined> => {
          if (!sourcePath || !existsSync(sourcePath)) return sourcePath;

          const sanitizedActionName = sanitizeForFilename(item.actionName);
          const dirName = `${sanitizedActionName}_${item.id}`;
          const angleNumber = isSecondary ? 2 : 1;
          const instanceDir = path.join(videosDir, dirName);
          const extname = path.extname(sourcePath);
          const newFileName = `angle${angleNumber}${extname}`;
          const destPath = path.join(instanceDir, newFileName);
          const relativePath = `./videos/${dirName}/${newFileName}`;

          if (isOverwrite && existsSync(destPath)) {
            if (sourcePath.startsWith('./videos/')) {
              return sourcePath;
            }
            return relativePath;
          }

          const cacheKey = `${sourcePath}_${item.startTime}_${item.endTime}`;
          if (copiedVideos.has(cacheKey)) {
            return copiedVideos.get(cacheKey);
          }

          await fs.mkdir(instanceDir, { recursive: true });

          let absoluteSourcePath = sourcePath;
          if (sourcePath.startsWith('./')) {
            absoluteSourcePath = path.join(targetPath, sourcePath);
          }

          await extractVideoSegment(
            ffmpegPath,
            absoluteSourcePath,
            destPath,
            item.startTime,
            item.endTime,
          );

          copiedVideos.set(cacheKey, relativePath);
          return relativePath;
        };

        const newVideoSource = await processVideo(item.videoSource, false);
        const newVideoSource2 = await processVideo(item.videoSource2, true);

        processedCount += 1;
        sendProgress(processedCount, totalItems);

        const isAlreadyProcessed = item.videoSource?.startsWith('./videos/');
        const duration = isAlreadyProcessed
          ? item.endTime
          : item.endTime - item.startTime;
        const startTime = isAlreadyProcessed ? item.startTime : 0;

        return {
          ...item,
          videoSource: newVideoSource,
          videoSource2: newVideoSource2,
          mediaReference: undefined,
          mediaReference2: undefined,
          startTime,
          endTime: isAlreadyProcessed ? item.endTime : duration,
        };
      }),
    );

    processedPlaylist = { ...document, items: processedItems };
  }

  const playlistJsonPath = path.join(targetPath, 'playlist.json');
  const content = JSON.stringify(processedPlaylist, null, 2);
  await fs.writeFile(playlistJsonPath, content, 'utf-8');

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
