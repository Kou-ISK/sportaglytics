import { NativeExportCapacityError } from './nativeExportProcess';

// Application policy, not an OS minimum, disk reservation, or hard quota.
// 2 GiB preserves the prior integration candidate’s operational floor; it
// is new compared with the published app. A 4 GiB stop allowance
// exceeds twice 434 MB/s over 4.25 s (inspection, stop and polling delays),
// based on a measured average, not a worst-case bound. 10% of the job
// budget is a buffer for other activity and uncertainty. The supported job
// maximum of 32 GiB bounds that buffer to about 3.2 GiB.
// None of these values guarantees protection against an unbounded external writer.
export const nativeMinimumFreeBytes = (jobBytes: number): number => {
  if (!Number.isSafeInteger(jobBytes) || jobBytes < 1 || jobBytes > 32 * 1024 ** 3) {
    throw new NativeExportCapacityError('Invalid native capacity budget');
  }
  const operationalFloor = 2 * 1024 ** 3;
  const stopAllowance = 4 * 1024 ** 3;
  const activityBuffer = Math.ceil(jobBytes / 10);
  return operationalFloor + stopAllowance + activityBuffer;
};
