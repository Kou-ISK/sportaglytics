import { createHash } from 'node:crypto';
import {
  objectValue,
  integerValue,
  stringValue,
  arrayValue,
  exactKeys,
} from '../../../src/shared/validation/jsonValues';
import { CacheAudioPacketRange } from './cacheTimeRange';
import type { CacheMediaMetadata } from './cacheMediaMetadata';
import {
  canonicalSeconds,
  mediaConfigurationHash,
  rational,
} from './cacheMediaMetadata';
import type { CacheTimingProof } from './cachePolicy';

interface CacheFrame {
  pts: number;
  duration: number;
  width: number;
  height: number;
  pix_fmt: string;
  interlaced_frame: number;
  top_field_first: number;
  repeat_pict: number;
}
const parseFrame = (value: unknown): CacheFrame => {
  const v = objectValue(value);
  return {
    pts: integerValue(v.pts),
    duration: integerValue(v.duration, 1),
    width: integerValue(v.width),
    height: integerValue(v.height),
    pix_fmt: stringValue(v.pix_fmt),
    interlaced_frame: integerValue(v.interlaced_frame, 0, 1),
    top_field_first: integerValue(v.top_field_first, 0, 1),
    repeat_pict: integerValue(v.repeat_pict, 0, 0),
  };
};
interface CacheSkipSamples {
  side_data_type: 'Skip Samples';
  skip_samples: number;
  discard_padding: number;
  skip_reason: number;
  discard_reason: number;
}
const parseSideData = (value: unknown): CacheSkipSamples => {
  const v = objectValue(value);
  exactKeys(v, [
    'side_data_type',
    'skip_samples',
    'discard_padding',
    'skip_reason',
    'discard_reason',
  ]);
  if (v.side_data_type !== 'Skip Samples')
    throw Error('CACHE_UNSUPPORTED_AUDIO_SIDE_DATA');
  return {
    side_data_type: 'Skip Samples',
    skip_samples: integerValue(v.skip_samples, 0),
    discard_padding: integerValue(v.discard_padding, 0),
    skip_reason: integerValue(v.skip_reason),
    discard_reason: integerValue(v.discard_reason),
  };
};
interface CachePacket {
  stream_index: number;
  pts: number;
  dts: number;
  duration: number;
  size: string;
  data_hash: string;
  side_data_list?: CacheSkipSamples[];
}
const parsePacket = (value: unknown): CachePacket => {
  const v = objectValue(value);
  const size = stringValue(v.size);
  const hash = stringValue(v.data_hash);
  if (!/^\d+$/.test(size) || !/^SHA256:[a-f0-9]{64}$/i.test(hash))
    throw Error('CACHE_INVALID_AUDIO_PACKET');
  return {
    stream_index: integerValue(v.stream_index),
    pts: integerValue(v.pts),
    dts: integerValue(v.dts),
    duration: integerValue(v.duration, 1),
    size,
    data_hash: hash,
    side_data_list:
      v.side_data_list === undefined
        ? undefined
        : arrayValue(v.side_data_list, 0, 1).map(parseSideData),
  };
};

/** Build the expected full display sequence from the input. Interlaced input
 * initially requires unambiguous constant-duration, ordered, repeat-free frames.
 * This matches bwdif's adjacent-PTS midpoint and final-frame extrapolation. */
export class CacheTimingAccumulator {
  private readonly intervals = createHash('sha256');
  private frames = 0;
  private previous: CacheFrame | null = null;
  private first: number | null = null;
  private readonly audio;
  constructor(private readonly metadata: CacheMediaMetadata) {
    this.audio = metadata.audio.map((stream) => ({
      stream,
      presentation: new CacheAudioPacketRange(stream),
      packets: 0,
      coversStart: false,
      coversEnd: false,
      previousDts: null as number | null,
      firstPts: null as number | null,
      lastEnd: null as number | null,
      times: createHash('sha256'),
      payload: createHash('sha256'),
    }));
  }

  frame(value: unknown): void {
    const frame = parseFrame(value);
    const { video, interlaced } = this.metadata;
    if (
      frame.width !== video.width ||
      frame.height !== video.height ||
      frame.pix_fmt !== video.pix_fmt ||
      !!frame.interlaced_frame !== interlaced ||
      frame.pts < 0 ||
      !Number.isSafeInteger(frame.pts + frame.duration) ||
      (interlaced &&
        frame.top_field_first !==
          (this.metadata.displayScan === 'top-first' ? 1 : 0)) ||
      (this.previous &&
        (frame.pts !== this.previous.pts + this.previous.duration ||
          (interlaced && frame.duration !== this.previous.duration)))
    )
      throw Error('CACHE_UNSUPPORTED_FRAME_TIMES');
    if (this.first === null) this.first = frame.pts;
    if (
      this.frames >= 28800 ||
      (frame.pts + frame.duration - this.first) /
        rational(video.time_base).denominator >
        120
    )
      throw Error('CACHE_PROBE_SCOPE_LIMIT');
    const copies = interlaced ? 2 : 1;
    for (let field = 0; field < copies; field++) {
      const pts = frame.pts * copies + field * frame.duration;
      this.intervals.update(
        canonicalSeconds(pts, video.time_base, copies) +
          ',' +
          canonicalSeconds(frame.duration, video.time_base, copies) +
          '\n',
      );
      this.frames++;
    }
    this.previous = frame;
  }

  packet(value: unknown): void {
    const packet = parsePacket(value);
    const track = this.audio.find(
      (candidate) => candidate.stream.index === packet.stream_index,
    );
    if (
      !track ||
      track.packets >= 65536 ||
      (track.previousDts !== null && packet.dts <= track.previousDts) ||
      !Number.isSafeInteger(packet.pts + packet.duration) ||
      packet.pts !== packet.dts ||
      (track.lastEnd !== null && track.lastEnd !== packet.pts)
    )
      throw Error('CACHE_UNSUPPORTED_AUDIO_TIMES');
    track.firstPts ??= packet.pts;
    const side = packet.side_data_list?.[0];
    const range = track.presentation.packet(
      packet.pts,
      packet.duration,
      side?.skip_samples ?? 0,
      side?.discard_padding ?? 0,
    );
    track.coversStart ||= range.first;
    track.coversEnd = range.last;
    track.times.update(
      JSON.stringify([
        canonicalSeconds(packet.pts, track.stream.time_base),
        canonicalSeconds(packet.dts, track.stream.time_base),
        canonicalSeconds(packet.duration, track.stream.time_base),
        packet.side_data_list ?? [],
      ]) + '\n',
    );
    track.payload.update(
      packet.size + ':' + packet.data_hash.toLowerCase() + '\n',
    );
    track.previousDts = packet.dts;
    track.lastEnd = packet.pts + packet.duration;
    track.packets++;
  }

  finish(): CacheTimingProof {
    const { video, outputFps } = this.metadata;
    if (
      !this.previous ||
      this.first !== video.start_pts ||
      this.previous.pts + this.previous.duration !==
        video.start_pts + video.duration_ts ||
      this.audio.some(
        (track) => !track.packets || !track.coversStart || !track.coversEnd,
      )
    )
      throw Error('CACHE_INCOMPLETE_TIMING');
    const end = rational(
      canonicalSeconds(
        this.previous.pts + this.previous.duration,
        video.time_base,
      ),
    );
    const fps = rational(
      canonicalSeconds(outputFps.numerator, '1/' + outputFps.denominator),
    );
    return {
      fpsNumerator: fps.numerator,
      fpsDenominator: fps.denominator,
      displayFrames: this.frames,
      endNumerator: end.numerator,
      endDenominator: end.denominator,
      displayIntervalsSha256: this.intervals.digest('hex'),
      audio: this.audio.map((track) => ({
        streamIndex: track.stream.index,
        codec: track.stream.codec_name,
        packets: track.packets,
        timesSha256: track.times.digest('hex'),
        payloadSha256: track.payload.digest('hex'),
        configurationSha256: mediaConfigurationHash(track.stream),
      })),
    };
  }
}
