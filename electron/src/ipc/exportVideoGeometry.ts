interface VideoGeometry {
  width: number;
  height: number;
  sampleAspectRatio?: number;
  rotation?: number;
}

/** Match FFmpeg autorotation, then the existing square-pixel dual scale/hstack. */
export const resolveExportVideoSize = (
  sources: VideoGeometry[],
): { width: number; height: number } => {
  const oriented = sources.map((source) => {
    const quarterTurn = Math.abs(source.rotation ?? 0) % 180 === 90;
    return {
      width: quarterTurn ? source.height : source.width,
      height: quarterTurn ? source.width : source.height,
      sar: quarterTurn
        ? 1 / (source.sampleAspectRatio ?? 1)
        : (source.sampleAspectRatio ?? 1),
    };
  });
  const first = oriented[0];
  if (!first) throw new Error('書き出し元の映像がありません');
  if (sources.length === 1) return { width: first.width, height: first.height };
  const height = first.height - (first.height % 2);
  return {
    width: oriented.reduce(
      (sum, size) =>
        sum +
        2 * Math.floor((height * size.width * size.sar) / size.height / 2),
      0,
    ),
    height,
  };
};
