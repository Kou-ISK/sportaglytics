// Include Electron's Process augmentation while compiling this production graph.
import type {} from 'electron';
export { layoutClipExportText } from '../../src/shared/clipExport/clipExportTextLayout';
export { createClipTextMeasurer } from '../../electron/src/ipc/exportTextMeasurement';
export { buildOverlayFilters } from '../../electron/src/ipc/exportFfmpegOverlay';
export {
  getJapaneseFontPath,
  escapeDrawtext,
} from '../../electron/src/ipc/exportOptions';

export { escapeFilterOption } from '../../electron/src/ipc/ffmpegFilterEscaping';
