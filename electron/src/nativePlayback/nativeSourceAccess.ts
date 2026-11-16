import {
  arrayValue,
  objectValue,
  stringValue,
  numberValue,
} from '../../../src/shared/validation/jsonValues';
import {
  openNativePackageAccess,
  inspectNativeLocalFile,
  nativeSourceDigest,
} from './nativeSourceFilesystem';

export interface NativeSourceAccess {
  path: string;
  url: string;
  key: string;
  sourceEnd: number | null;
  assertCurrent: () => Promise<void>;
}
/** Called only for the authenticated main window's bound package. The source
 * comes from its current metadata, never from an IPC path supplied by a caller.
 * Existing absolute local references are retained; relative references cannot
 * escape the package. No media bytes or directory inventories are scanned. */
export const resolveNativeSource = async (
  packagePath: string,
): Promise<NativeSourceAccess> => {
  const access = await openNativePackageAccess(packagePath);
  const { root, config } = access;
  const angle = objectValue(arrayValue(config.angles, 1, 1)[0]);
  const clip = objectValue(arrayValue(angle.clips, 1, 1)[0]);
  if (
    angle.sourceKind !== 'local' ||
    clip.sourceKind !== 'local' ||
    (clip.timelineStartSeconds ?? 0) !== 0 ||
    (clip.gapBeforeSeconds ?? 0) !== 0
  )
    throw Error('NATIVE_UNSUPPORTED_PACKAGE');
  const sourceEnd =
    clip.durationSeconds === undefined
      ? null
      : numberValue(clip.durationSeconds, Number.MIN_VALUE, 86400);
  const reference = stringValue(clip.relativePath, 1, 4096);
  const file = await inspectNativeLocalFile(root, reference);
  return {
    sourceEnd,
    path: file.path,
    url: file.url,
    key: nativeSourceDigest(
      JSON.stringify([root, angle.id, clip.id, reference, file.revision]),
    ),
    assertCurrent: async () => {
      await access.assertPackageCurrent();
      await file.assertCurrent();
      await access.assertCurrent();
    },
  };
};
