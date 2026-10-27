import type { BrowserWindow } from 'electron';
import { getPackageSessionForWindow } from '../packageSessionRegistry';
import { resolveNativeSource } from './nativeSourceAccess';
import { parseNativeSourceProfile } from './nativeSourceProfile';
import type { NativeSourceProfile } from './nativeSourceProfile';
import type { QualifiedNativeSource } from './nativePlaybackManager';

export interface NativePlaybackRuntime {
  version: 1;
  probe: (source: string) => Promise<unknown>;
  createBackend: (
    window: BrowserWindow,
    source: string,
    profile: NativeSourceProfile,
    assertCurrent: () => Promise<void>,
    ...args: Parameters<QualifiedNativeSource['createBackend']>
  ) => ReturnType<QualifiedNativeSource['createBackend']>;
}

export const createNativeSourceProvider =
  (
    runtime: NativePlaybackRuntime,
  ): ((window: BrowserWindow) => Promise<QualifiedNativeSource | null>) =>
  async (window) => {
    const session = getPackageSessionForWindow(window);
    if (
      !session?.packageBound ||
      session.mainWindow !== window ||
      !session.packagePath
    )
      return null;
    const packagePath = session.packagePath,
      id = session.id;
    const assertSession = (): void => {
      const current = getPackageSessionForWindow(window);
      if (
        !current?.packageBound ||
        current.id !== id ||
        current.packagePath !== packagePath ||
        current.mainWindow !== window
      )
        throw Error('NATIVE_DOCUMENT_CHANGED');
    };
    let source, profile;
    try {
      source = await resolveNativeSource(packagePath);
      profile = parseNativeSourceProfile(await runtime.probe(source.path));
    } catch {
      // Qualification has not launched a playback owner. Unsupported sources
      // retain the existing player; a runtime must drain its bounded probe first.
      return null;
    }
    const assertCurrent = async (): Promise<void> => {
      assertSession();
      await source.assertCurrent();
      assertSession();
    };
    await assertCurrent();
    const { start, end, rates, audioTracks } = profile.presentation;
    return {
      sourceKey: source.key,
      sourceEnd: source.sourceEnd,
      sourceUrl: source.url,
      scope: { start, end, rates, audioTracks },
      presentation: profile.presentation,
      assertCurrent,
      createBackend: (owner, observe) =>
        runtime.createBackend(
          window,
          source.path,
          profile,
          assertCurrent,
          owner,
          observe,
        ),
    };
  };
