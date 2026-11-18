import type { BrowserWindow } from 'electron';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import {
  parseNativePlaybackGroupBinding,
  parseNativePlaybackGroupSelection,
} from '../../../src/types/ipc/nativePlaybackGroup';
import type { NativePlaybackGroupSelection } from '../../../src/types/ipc/nativePlaybackGroup';
import { parseNativePlaybackPresentation } from '../../../src/types/ipc/nativePlaybackPresentation';
import { resolveNativePackageSourcePlan } from './nativePackageSourcePlan';
import { nativeGroupHostConfiguration } from './nativeHostConfiguration';
import { parseNativeSourceProfile } from './nativeSourceProfile';
import type { NativeSourceProfile } from './nativeSourceProfile';
import type { QualifiedNativeSource } from './nativePlaybackManager';
import { createNativeGroupBackend } from './runtime/nativeGroupBackend';
import type { NativeRuntimePaths } from './runtime/nativeRuntime';
import type { NativeGroupCapability } from './runtime/groupCapability';
import { parseNativeGroupCapability } from './runtime/groupCapability';

export interface NativeQualifiedGroupRuntime {
  paths: NativeRuntimePaths;
  capability: NativeGroupCapability;
  probe(source: string): Promise<unknown>;
}
/** Only Main composition supplies verified resources. Each qualification owns
 * its finite probe; there is no shared Renderer signal or executable argument. */
export const createNativeGroupSourceProvider =
  (
    runtime: () => Promise<NativeQualifiedGroupRuntime>,
  ): ((
    window: BrowserWindow,
    selection: NativePlaybackGroupSelection,
  ) => Promise<QualifiedNativeSource | null>) =>
  async (window, rawSelection) => {
    const selection = parseNativePlaybackGroupSelection(rawSelection);
    const session = getPackageSessionForWindow(window);
    if (
      !session?.packageBound ||
      session.mainWindow !== window ||
      !session.packagePath
    )
      return null;
    const packagePath = session.packagePath,
      sessionId = session.id;
    const assertSession = (): void => {
      const current = getPackageSessionForWindow(window);
      if (
        window.isDestroyed() ||
        !current?.packageBound ||
        current.mainWindow !== window ||
        current.id !== sessionId ||
        current.packagePath !== packagePath
      )
        throw Error('NATIVE_DOCUMENT_CHANGED');
    };
    try {
      const plan = await resolveNativePackageSourcePlan(
        packagePath,
        selection.angleIds,
      );
      const assertCurrent = async (): Promise<void> => {
        assertSession();
        await plan.assertCurrent();
        assertSession();
      };
      await assertCurrent();
      const configuration = nativeGroupHostConfiguration(
        plan,
        selection.audioAngleId,
      );
      const verified = await runtime();
      const capability = parseNativeGroupCapability(verified.capability);
      const paths = {
        host: verified.paths.host,
        receiver: verified.paths.receiver,
        state: verified.paths.state,
      };
      await assertCurrent();
      const profiles: NativeSourceProfile[] = [];
      // Serial finite probes avoid doubling probe processes for a single admission.
      for (const source of plan.sources) {
        profiles.push(
          parseNativeSourceProfile(await verified.probe(source.path)),
        );
        await assertCurrent();
      }
      const angles = configuration.sources.map((source, index) => {
        const planned = plan.sources[source.sourceIndex],
          profile = profiles[source.sourceIndex].presentation;
        const sourceEnd = Math.round(profile.end * 120000);
        if (source.globalEnd + source.sourceOffset > sourceEnd)
          throw Error('NATIVE_GROUP_SOURCE_TOO_SHORT');
        return {
          angleId: plan.angleIds[index],
          clipId: planned.clipId,
          sourceUrl: planned.url,
          globalStart: source.globalStart / 120000,
          globalEnd: source.globalEnd / 120000,
          sourceTimeOffset: source.sourceOffset / 120000,
          sourceEnd: sourceEnd / 120000,
          audioTracks: profile.audioTracks,
        };
      });
      const binding = parseNativePlaybackGroupBinding({
        audioAngleId: selection.audioAngleId,
        angles,
      });
      const audio = binding.angles[configuration.audioAngle];
      const start = Math.max(
        ...configuration.sources.map((source) => source.globalStart),
      );
      const end = Math.min(
        ...configuration.sources.map((source) => source.globalEnd),
      );
      const playEnd = Math.min(
        end - 1,
        ...configuration.sources.map(
          (source) =>
            Math.floor(
              profiles[source.sourceIndex].presentation.playEnd * 120000,
            ) - source.sourceOffset,
        ),
      );
      const seekEnd = Math.min(
        playEnd - 1,
        ...configuration.sources.map(
          (source) =>
            Math.floor(
              profiles[source.sourceIndex].presentation.seekEnd * 120000,
            ) - source.sourceOffset,
        ),
      );
      const rates = profiles[0].presentation.rates.filter((rate) =>
        profiles.every((profile) => profile.presentation.rates.includes(rate)),
      );
      const presentation = parseNativePlaybackPresentation({
        ...profiles[0].presentation,
        start: start / 120000,
        end: end / 120000,
        playEnd: playEnd / 120000,
        seekEnd: seekEnd / 120000,
        rates,
        audioTracks: audio.audioTracks,
      });
      await assertCurrent();
      return {
        sourceKey: plan.key,
        sourceUrl: `file:///native-group/${plan.key}`,
        sourceEnd: plan.end,
        presentation,
        group: binding,
        scope: {
          start: presentation.start,
          end: presentation.end,
          rates: presentation.rates,
          audioTracks: audio.audioTracks,
          clockAuthority: 'drawn-pair',
        },
        assertCurrent,
        createBackend: (owner, observe) =>
          createNativeGroupBackend(
            paths,
            capability,
            window,
            plan,
            selection.audioAngleId,
            owner,
            observe,
          ),
      };
    } catch {
      // No playback factory has been called. Unsupported/changed input retains
      // original playback, after each resource/probe promise has settled.
      return null;
    }
  };
