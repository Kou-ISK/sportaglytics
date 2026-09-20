import type { ItemAnnotation } from '../../types/playlist/core';
import { isValidPitchCalibration } from './pitchProjection';
import { isValidTacticalBoard } from './tacticalBoard';
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown): value is { x: number; y: number } =>
  record(value) && finite(value.x) && finite(value.y);
const validMotion = (value: unknown): boolean => {
  if (
    !record(value) ||
    !finite(value.duration) ||
    value.duration <= 0 ||
    value.duration > 600 ||
    !Array.isArray(value.keyframes) ||
    value.keyframes.length < 1 ||
    value.keyframes.length > 256
  )
    return false;
  let previous = -1;
  return value.keyframes.every((key: unknown, index) => {
    if (
      !record(key) ||
      !finite(key.time) ||
      !finite(key.x) ||
      !finite(key.y) ||
      key.time <= previous ||
      key.time < 0 ||
      key.time > Number(value.duration) ||
      (index === 0 && key.time !== 0) ||
      Math.abs(key.x) > 100000 ||
      Math.abs(key.y) > 100000
    )
      return false;
    previous = key.time;
    return true;
  });
};
/** 拡張データが壊れている場合は読込を拒否し、元ファイルを静止注釈で上書きさせない。 */
export const validateTacticsAnnotation = (
  annotation: ItemAnnotation | undefined,
): void => {
  if (!annotation) return;
  if (
    annotation.tacticalBoard !== undefined &&
    (!record(annotation.tacticalBoard) ||
      !Object.entries(annotation.tacticalBoard).every(
        ([target, board]) =>
          ['primary', 'secondary'].includes(target) &&
          (board === undefined || isValidTacticalBoard(board)),
      ))
  )
    throw new Error('戦術盤のデータが不正です。');
  if (
    annotation.objects?.some(
      (object) => object.motion !== undefined && !validMotion(object.motion),
    )
  )
    throw new Error('描画の表示区間またはキーフレームが不正です。');
  if (annotation.pitchCalibration !== undefined) {
    if (
      !record(annotation.pitchCalibration) ||
      !Object.entries(annotation.pitchCalibration).every(([target, value]) => {
        if (value === undefined) return true;
        if (
          !['primary', 'secondary'].includes(target) ||
          !record(value) ||
          !Array.isArray(value.corners) ||
          !value.corners.every(point) ||
          !finite(value.widthMeters) ||
          !finite(value.lengthMeters)
        )
          return false;
        const region = value.region;
        if (
          region !== undefined &&
          (!record(region) ||
            !finite(region.x) ||
            !finite(region.y) ||
            !finite(region.width) ||
            !finite(region.length))
        )
          return false;
        if (value.referenceTime !== undefined && !finite(value.referenceTime))
          return false;
        return isValidPitchCalibration({
          corners: value.corners,
          widthMeters: value.widthMeters,
          lengthMeters: value.lengthMeters,
          ...(record(region) &&
          finite(region.x) &&
          finite(region.y) &&
          finite(region.width) &&
          finite(region.length)
            ? {
                region: {
                  x: region.x,
                  y: region.y,
                  width: region.width,
                  length: region.length,
                },
              }
            : {}),
          ...(finite(value.referenceTime)
            ? { referenceTime: value.referenceTime }
            : {}),
        });
      })
    )
      throw new Error('平面較正データが不正です。');
  }
  if (
    annotation.chromaKey !== undefined &&
    (!record(annotation.chromaKey) ||
      !Object.entries(annotation.chromaKey).every(
        ([target, value]) =>
          value === undefined ||
          (['primary', 'secondary'].includes(target) &&
            record(value) &&
            typeof value.color === 'string' &&
            /^#[a-fA-F0-9]{6}$/.test(value.color) &&
            finite(value.similarity) &&
            value.similarity >= 0.01 &&
            value.similarity <= 0.5 &&
            finite(value.blend) &&
            value.blend >= 0 &&
            value.blend <= 1),
      ))
  )
    throw new Error('芝色処理の設定が不正です。');
};
