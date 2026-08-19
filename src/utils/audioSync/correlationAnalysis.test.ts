import { describe, expect, it } from 'vitest';
import { analyzePcmSyncByCorrelation } from './correlationAnalysis';

const SAMPLE_RATE = 200;
const AUTO_APPLY_CONFIDENCE_THRESHOLD = 0.35;

const createRandom = (seed: number): (() => number) => {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
};

const createSignal = (
  durationSeconds: number,
  seed: number,
): Float32Array => {
  const random = createRandom(seed);
  const length = Math.round(durationSeconds * SAMPLE_RATE);
  const output = new Float32Array(length);
  const amplitudes: number[] = [];
  const halfSecondBlocks = Math.ceil(durationSeconds * 2);
  for (let block = 0; block < halfSecondBlocks; block += 1) {
    amplitudes.push(0.08 + random() * 0.92);
  }
  const frequency1 = 2.3 + (seed % 7) * 0.17;
  const frequency2 = 5.7 + (seed % 5) * 0.23;

  for (let index = 0; index < length; index += 1) {
    const time = index / SAMPLE_RATE;
    const block = Math.min(amplitudes.length - 1, Math.floor(time * 2));
    const amplitude = amplitudes[block] ?? 0.1;
    const noise = (random() * 2 - 1) * 0.025;
    output[index] =
      amplitude *
        (Math.sin(Math.PI * 2 * frequency1 * time) +
          Math.sin(Math.PI * 2 * frequency2 * time) * 0.35) +
      noise;
  }
  return output;
};

const addIndependentNoise = (
  source: Float32Array,
  amplitude: number,
  seed: number,
): Float32Array => {
  const random = createRandom(seed);
  return Float32Array.from(source, (value) =>
    value + (random() * 2 - 1) * amplitude,
  );
};

const createFiller = (length: number, seed: number): Float32Array => {
  const random = createRandom(seed);
  const filler = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    filler[index] = (random() * 2 - 1) * 0.01;
  }
  return filler;
};

const createShiftedPair = ({
  offsetSeconds,
  signalDurationSeconds = 70,
  gain = 1,
  noiseAmplitude = 0,
  silentIntroSeconds = 0,
}: {
  offsetSeconds: number;
  signalDurationSeconds?: number;
  gain?: number;
  noiseAmplitude?: number;
  silentIntroSeconds?: number;
}): { first: Float32Array; second: Float32Array } => {
  const signal = createSignal(signalDurationSeconds, 42);
  const silentSamples = Math.round(silentIntroSeconds * SAMPLE_RATE);
  for (let index = 0; index < Math.min(silentSamples, signal.length); index += 1) {
    signal[index] = 0;
  }
  const shiftSamples = Math.round(Math.abs(offsetSeconds) * SAMPLE_RATE);
  const transformed = Float32Array.from(signal, (value) => value * gain);
  const noisyTransformed =
    noiseAmplitude > 0
      ? addIndependentNoise(transformed, noiseAmplitude, 912)
      : transformed;

  if (offsetSeconds >= 0) {
    const second = new Float32Array(shiftSamples + noisyTransformed.length);
    second.set(createFiller(shiftSamples, 811), 0);
    second.set(noisyTransformed, shiftSamples);
    return { first: signal, second };
  }

  const first = new Float32Array(shiftSamples + signal.length);
  first.set(createFiller(shiftSamples, 811), 0);
  first.set(signal, shiftSamples);
  return { first, second: noisyTransformed };
};

const expectOffset = async (
  offsetSeconds: number,
  options?: Omit<Parameters<typeof createShiftedPair>[0], 'offsetSeconds'>,
): Promise<void> => {
  const pair = createShiftedPair({ offsetSeconds, ...options });
  const result = await analyzePcmSyncByCorrelation(
    pair.first,
    pair.second,
    SAMPLE_RATE,
  );
  expect(result.offsetSeconds).toBeCloseTo(offsetSeconds, 1);
  expect(result.confidence).toBeGreaterThanOrEqual(
    AUTO_APPLY_CONFIDENCE_THRESHOLD,
  );
};

describe('analyzePcmSyncByCorrelation', () => {
  it('preserves the signed offset contract for nearby clips', async () => {
    await expectOffset(5);
    await expectOffset(-5);
  });

  it('finds offsets beyond the former fixed 30 second search limit', async () => {
    await expectOffset(45);
    await expectOffset(-45);
  });

  it('finds a candidate when clips differ by several minutes', async () => {
    await expectOffset(180, { signalDurationSeconds: 80 });
  });

  it('uses later energetic windows when the first 30 seconds are silent', async () => {
    await expectOffset(45, {
      signalDurationSeconds: 80,
      silentIntroSeconds: 30,
    });
  });

  it('remains stable across gain differences and background noise', async () => {
    await expectOffset(-45, {
      signalDurationSeconds: 80,
      gain: 0.35,
      noiseAmplitude: 0.08,
    });
  });

  it('keeps unrelated audio below the automatic-apply confidence threshold', async () => {
    const first = createSignal(60, 11);
    const second = createSignal(60, 987);
    const result = await analyzePcmSyncByCorrelation(
      first,
      second,
      SAMPLE_RATE,
    );
    expect(result.confidence).toBeLessThan(AUTO_APPLY_CONFIDENCE_THRESHOLD);
  });

  it('reports monotonically increasing progress', async () => {
    const pair = createShiftedPair({ offsetSeconds: 45 });
    const progressValues: number[] = [];
    await analyzePcmSyncByCorrelation(
      pair.first,
      pair.second,
      SAMPLE_RATE,
      (progress) => progressValues.push(progress),
    );
    expect(progressValues.length).toBeGreaterThan(2);
    for (let index = 1; index < progressValues.length; index += 1) {
      expect(progressValues[index]).toBeGreaterThanOrEqual(
        progressValues[index - 1] ?? 0,
      );
    }
    expect(progressValues[progressValues.length - 1]).toBe(1);
  });
});
