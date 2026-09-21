import { probeMedia } from './packageMediaCompositionService';
import { planExportSource } from './exportVirtualTimelineSource';
import { findDirectExportSource } from './exportTimelineRange';
import {
  getClipExportSources,
  resolveExportSourceSelection,
} from './exportSourceSelection';
import {
  formatOverlayLines,
  layoutClipExportText,
  CLIP_TEXT_OVERFLOW_MESSAGE,
} from '../../../src/shared/clipExport/clipExportTextLayout';
import type {
  ClipExportPayload,
  ClipExportTextInspection,
} from '../../../src/shared/clipExport/clipExportTypes';

/** Inspect the actual output geometry, including clip boundaries and angle selection. */
export const inspectExportText = async (
  payloads: ClipExportPayload[],
): Promise<ClipExportTextInspection[]> => {
  const plans = new Map<string, ReturnType<typeof planExportSource>>();
  const probes = new Map<string, ReturnType<typeof probeMedia>>();
  const results: ClipExportTextInspection[] = [];
  for (const [angleIndex, payload] of payloads.entries()) {
    const selection = resolveExportSourceSelection(payload);
    for (const [index, clip] of payload.clips.entries()) {
      const sizes = [];
      for (const source of getClipExportSources(clip, selection)) {
        let pending = plans.get(source);
        if (!pending) {
          pending = planExportSource(source);
          plans.set(source, pending);
        }
        const plan = await pending;
        const direct = plan.clips
          ? findDirectExportSource(plan.clips, plan.offsetSeconds ?? 0, {
              start: clip.startTime,
              end: clip.endTime,
            })
          : null;
        const file =
          direct?.sourcePath ?? plan.clips?.[0]?.sourcePath ?? source;
        let probe = probes.get(file);
        if (!probe) {
          probe = probeMedia(file);
          probes.set(file, probe);
        }
        sizes.push(await probe);
      }
      const first = sizes[0];
      if (!first) throw new Error('書き出し元の映像がありません');
      const height = first.height - (first.height % 2);
      const width =
        sizes.length === 1
          ? first.width
          : sizes.reduce(
              (sum, size) =>
                sum + 2 * Math.floor((height * size.width) / size.height / 2),
              0,
            );
      const layout = layoutClipExportText(
        formatOverlayLines(clip, payload.overlay),
        width / height,
      );
      results.push({
        title: `${payloads.length > 1 ? `アングル${angleIndex + 1} — ` : ''}${index + 1}. ${clip.actionName}`,
        width,
        height,
        layout,
      });
    }
  }
  return results;
};

export const assertExportTextFits = async (
  payload: ClipExportPayload,
): Promise<void> => {
  if (
    !payload.overlay.enabled ||
    !payload.clips.some(
      (clip) => formatOverlayLines(clip, payload.overlay).length,
    )
  )
    return;
  const results = await inspectExportText([payload]);
  const problems = results.filter((result) => result.layout.overflow);
  if (problems.length)
    throw new Error(
      `${CLIP_TEXT_OVERFLOW_MESSAGE}\n${problems
        .slice(0, 12)
        .map((result) => result.title)
        .join(
          '\n',
        )}${problems.length > 12 ? `\nほか${problems.length - 12}件` : ''}`,
    );
};
