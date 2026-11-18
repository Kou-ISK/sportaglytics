import {
  arrayValue,
  integerValue,
  objectValue,
} from '../../../src/shared/validation/jsonValues';
import type { NativePlaybackPresentation } from '../../../src/types/ipc/nativePlaybackPresentation';

export interface NativeSourceProfile {
  presentation: NativePlaybackPresentation;
}

/** Header qualification for the current NV12/BT.709 surface bridge. AVPlayer
 * owns decoding, audio and timing; no frame enumeration or PCM windows. */
const parseProfile = (raw: unknown, supports720: boolean): NativeSourceProfile => {
  const streams = arrayValue(objectValue(raw).streams, supports720 ? 2 : 4, 4).map(objectValue);
  const [video, ...audio] = streams;
  const small = supports720 && video.width === 1280 && video.height === 720;
  // Canvas receives the decoded pixels directly. Only accept progressive
  // tracks with no display matrix, rotation tag or other unhandled side data.
  if (small && (
    video.field_order !== 'progressive' ||
    (video.side_data_list !== undefined && arrayValue(video.side_data_list, 0, 64).length > 0) ||
    (video.tags !== undefined && objectValue(video.tags).rotate !== undefined)
  )) throw Error('NATIVE_UNSUPPORTED_DISPLAY_GEOMETRY');
  const timescale = small ? 30000 : 60000;
  if (
    audio.length !== (small ? 1 : 3) ||
    video.index !== 0 ||
    video.id !== '0x1' ||
    video.codec_type !== 'video' ||
    video.codec_name !== 'h264' ||
    (!small && (video.width !== 1920 || video.height !== 1080)) ||
    video.pix_fmt !== 'yuv420p' ||
    video.sample_aspect_ratio !== '1:1' ||
    video.color_range !== 'tv' ||
    video.color_space !== 'bt709' ||
    video.color_transfer !== (small ? 'iec61966-2-4' : 'bt709') ||
    video.color_primaries !== 'bt709' ||
    video.avg_frame_rate !== `${timescale}/1001` ||
    video.r_frame_rate !== `${timescale}/1001` ||
    video.time_base !== `1/${timescale}` ||
    video.start_pts !== 0
  )
    throw Error('NATIVE_UNSUPPORTED_VIDEO_PROFILE');
  const duration = integerValue(video.duration_ts, 1, 86400 * timescale);
  const videoEnd = duration * (120000 / timescale);
  if (duration % 1001) throw Error('NATIVE_UNSUPPORTED_VIDEO_END');
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
  // A strict document-end seek still uses the existing endpoint adapter. This
  // is a range boundary, not a decoder/preroll reserve or an audio supply window.
  const sharedEnd = Math.min(videoEnd, Math.floor((pcmEnd * 5) / 2));
  const playEnd = sharedEnd / 120000 - 0.000001;
  const seekEnd = playEnd - 0.000001;
  if (seekEnd <= 0) throw Error('NATIVE_SOURCE_TOO_SHORT');
  return {
    presentation: {
      width: small ? 1280 : 1920,
      height: small ? 720 : 1080,
      start: 0,
      end: videoEnd / 120000,
      seekEnd,
      playEnd,
      rates: [-0.5, -2, -4, -6, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 6],
      audioTracks: audio.length,
      seekGrid: null,
      mutedOnly: false,
      exactFloatVolume: false,
      audioSwitch: audio.length > 1,
    },
  };
};

export const parseNativeSourceProfile = (raw: unknown): NativeSourceProfile =>
  parseProfile(raw, false);

export const parseNativeGroupSourceProfile = (raw: unknown, supports720: boolean): NativeSourceProfile =>
  parseProfile(raw, supports720);
