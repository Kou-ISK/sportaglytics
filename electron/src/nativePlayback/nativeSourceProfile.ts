import {
  arrayValue,
  integerValue,
  objectValue,
} from '../../../src/shared/validation/jsonValues';
import type { NativePlaybackPresentation } from '../../../src/types/ipc/nativePlaybackPresentation';

export interface NativeSourceProfile {
  fieldFirst: number;
  fieldStep: 1001;
  timeScale: 120000;
  videoEnd: number;
  pcmStart: number;
  pcmEnd: number;
  presentation: NativePlaybackPresentation;
}

/** Header qualification, not a whole-file timing proof. The decoder checks the
 * format and every delivered timestamp and fails back on a profile change. */
export const parseNativeSourceProfile = (
  raw: unknown,
  allowUnmutedTrial = false,
): NativeSourceProfile => {
  const streams = arrayValue(objectValue(raw).streams, 4, 4).map(objectValue);
  const [video, ...audio] = streams;
  if (
    video.index !== 0 ||
    video.id !== '0x1' ||
    video.codec_type !== 'video' ||
    video.codec_name !== 'h264' ||
    video.width !== 1920 ||
    video.height !== 1080 ||
    video.pix_fmt !== 'yuv420p' ||
    video.sample_aspect_ratio !== '1:1' ||
    video.color_range !== 'tv' ||
    video.color_space !== 'bt709' ||
    video.color_transfer !== 'bt709' ||
    video.color_primaries !== 'bt709' ||
    video.avg_frame_rate !== '60000/1001' ||
    video.r_frame_rate !== '60000/1001' ||
    video.time_base !== '1/60000' ||
    video.start_pts !== 0
  )
    throw Error('NATIVE_UNSUPPORTED_VIDEO_PROFILE');
  const videoEnd = integerValue(video.duration_ts, 1, 86400 * 60000) * 2;
  if (videoEnd % 1001) throw Error('NATIVE_UNSUPPORTED_VIDEO_END');
  const pcmEnd = integerValue(audio[0].duration_ts, 1, 86400 * 48000);
  audio.forEach((track, index) => {
    if (
      track.index !== index + 1 ||
      track.id !== `0x${index + 2}` ||
      track.codec_type !== 'audio' ||
      track.codec_name !== 'aac' ||
      track.sample_rate !== '48000' ||
      track.channels !== 2 ||
      track.channel_layout !== 'stereo' ||
      track.time_base !== '1/48000' ||
      track.start_pts !== 0 ||
      track.duration_ts !== pcmEnd
    )
      throw Error('NATIVE_UNSUPPORTED_AUDIO_PROFILE');
  });
  // Preserve the original tail through the existing player until native EOF
  // and unequal audio/video tails have been qualified. Reserve is source time.
  const sharedEnd = Math.min(videoEnd, Math.floor((pcmEnd * 5) / 2));
  const playEnd = Math.floor((sharedEnd - 24 * 1001) / 1001) * 1001;
  const seekEnd = playEnd - 24 * 1001;
  if (seekEnd <= 0) throw Error('NATIVE_SOURCE_TOO_SHORT');
  return {
    fieldFirst: 0,
    fieldStep: 1001,
    timeScale: 120000,
    videoEnd,
    pcmStart: 0,
    pcmEnd,
    presentation: {
      width: 1920,
      height: 1080,
      start: 0,
      end: videoEnd / 120000,
      seekEnd: seekEnd / 120000,
      playEnd: playEnd / 120000,
      rates: [1],
      audioTracks: 3,
      seekGrid: {
        origin: 0,
        duration: 1001,
        timescale: 120000,
        selection: 'containing',
      },
      // This opt-in belongs to the fixed local development runtime. It permits
      // a listening trial; it does not certify audible synchronization.
      mutedOnly: !allowUnmutedTrial,
      exactFloatVolume: true,
      audioSwitch: false,
    },
  };
};
