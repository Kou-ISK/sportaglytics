import type { NativeSourceProfile } from './nativeSourceProfile';

/** One Main-owned configuration shared by the presentation qualification and
 * helper. No source-specific intervals, per-frame references or PCM hashes. */
export const nativeHostConfiguration = (
  source: string,
  profile: NativeSourceProfile,
): {
  version: 1;
  source: string;
  fieldFirst: number;
  fieldStep: number;
  timeScale: number;
  videoEnd: number;
  pcmStart: number;
  pcmEnd: number;
  rollingPCM: true;
  containingField: boolean;
  pcmTracks: { trackID: number }[];
  layoutSHA: string;
  evidenceMode: string;
  handoffTime: number;
} => ({
  version: 1,
  source,
  fieldFirst: profile.fieldFirst,
  fieldStep: profile.fieldStep,
  timeScale: profile.timeScale,
  videoEnd: profile.videoEnd,
  pcmStart: profile.pcmStart,
  pcmEnd: profile.pcmEnd,
  rollingPCM: true,
  containingField: profile.presentation.seekGrid?.selection === 'containing',
  pcmTracks: [2, 3, 4].map((trackID) => ({ trackID })),
  // CoreAudio stereo channel layout (format contract, not media content).
  layoutSHA: 'cba28bfccae0a17b515e9ca21bd60845a2147a85e201c2331515bce6a8b6784a',
  evidenceMode: 'original-observation-v1',
  handoffTime: profile.presentation.playEnd,
});
