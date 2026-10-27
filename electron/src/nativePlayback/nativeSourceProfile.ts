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
export const parseNativeSourceProfile = (raw: unknown): NativeSourceProfile => {
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
  // A strict document-end seek still uses the existing endpoint adapter. This
  // is a range boundary, not a decoder/preroll reserve or an audio supply window.
  const sharedEnd = Math.min(videoEnd, Math.floor((pcmEnd * 5) / 2));
  const playEnd = sharedEnd / 120000 - 0.000001;
  const seekEnd = playEnd - 0.000001;
  if (seekEnd <= 0) throw Error('NATIVE_SOURCE_TOO_SHORT');
  return {
    presentation: {
      width: 1920,
      height: 1080,
      start: 0,
      end: videoEnd / 120000,
      seekEnd,
      playEnd,
      rates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4, 6],
      audioTracks: 3,
      seekGrid: null,
      mutedOnly: false,
      exactFloatVolume: false,
      audioSwitch: true,
    },
  };
};
