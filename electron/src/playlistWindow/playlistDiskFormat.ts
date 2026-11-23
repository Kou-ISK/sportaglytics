import type { Playlist } from '../../../src/types/playlist/core';
import { PLAYLIST_DOCUMENT_SCHEMA_VERSION } from '../../../src/types/playlist/core';
import { isPlaylist } from '../../../src/types/ipc/playlistWindow';
import { isPlainObject } from '../../../src/types/ipc/shared';

const SLIDE_FILE_FORMAT = 'sportaglytics/playlist-with-slides';
const SLIDE_FILE_VERSION = 6;

interface SlideFile {
  format: typeof SLIDE_FILE_FORMAT;
  schemaVersion: typeof SLIDE_FILE_VERSION;
  document: Playlist;
}

/** Older readers accept arbitrary numeric versions but require a flat playlist. */
export const encodePlaylistFile = (document: Playlist): Playlist | SlideFile =>
  document.items.some((item) => item.slide !== undefined)
    ? { format: SLIDE_FILE_FORMAT, schemaVersion: SLIDE_FILE_VERSION, document }
    : document;

export const decodePlaylistFile = (value: unknown): Playlist => {
  let document = value;
  if (isPlainObject(value) && 'format' in value) {
    if (value.format !== SLIDE_FILE_FORMAT || value.schemaVersion !== SLIDE_FILE_VERSION || 'items' in value) {
      throw new Error('未対応のプレイリスト形式です。作成に使用した版以降で開いてください。');
    }
    document = value.document;
  }
  if (!isPlaylist(document)) {
    throw new Error('プレイリストファイルの形式が不正です。必須フィールドが欠落しています。');
  }
  if (document.schemaVersion !== undefined && document.schemaVersion > PLAYLIST_DOCUMENT_SCHEMA_VERSION) {
    throw new Error('未対応のプレイリストの版です。作成に使用した版以降で開いてください。');
  }
  return document;
};
