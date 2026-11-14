import { expect, it } from 'vitest';
import { normalizeExportError, rememberRetained, retainedFor, transferRetained } from './exportRetainedRecords';
it('deduplicates a record ID but keeps distinct records even at the same path', () => {
 const error = new Error('test'); const entry = { id: 'a', path: '/tmp/x', purpose: 'native-temp' as const, device: '1', inode: '2', reason: 'retained-after-failure' as const, writerStatus: 'unknown' as const };
 rememberRetained(error, entry); rememberRetained(error, entry); rememberRetained(error, { ...entry, id: 'b' }); rememberRetained(error);
 expect(retainedFor(error).directories.map((item) => item.id)).toEqual(['a', 'b']); expect(retainedFor(error).locationUnknown).toBe(true);
});

it('preserves records and unknown status when errors are wrapped', () => {
 const first = new Error('first'); const next = new Error('next');
 rememberRetained(first, { id: 'a', path: '/tmp/a', purpose: 'native-temp', device: '1', inode: '2', reason: 'retained-after-failure', writerStatus: 'unknown' });
 rememberRetained(first); transferRetained(first, next); transferRetained(first, next);
 expect(retainedFor(next)).toMatchObject({ directories: [expect.objectContaining({ id: 'a' })], locationUnknown: true });
 expect(normalizeExportError('failure')).toMatchObject({ message: 'Export failed', cause: 'failure' });
});
