import { expect, it } from 'vitest';
import { createExportResourceGate } from './exportResourceGate';
it('waits for the active job and releases idempotently', async () => {
 const gate = createExportResourceGate(); const a = await gate.acquire(new AbortController().signal); let entered = false;
 const b = gate.acquire(new AbortController().signal).then((release) => { entered = true; return release; });
 await Promise.resolve(); expect(entered).toBe(false); a(); a(); const release = await b; expect(entered).toBe(true); release();
});
it('cancels only the waiting job and lets a later job start', async () => {
 const gate = createExportResourceGate(); const a = await gate.acquire(new AbortController().signal); const controller = new AbortController();
 const rejected = expect(gate.acquire(controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
 const later = gate.acquire(new AbortController().signal); controller.abort(); await rejected; a(); const release = await later; release();
});
it('allows the next job after an active operation fails and releases', async () => {
 const gate = createExportResourceGate(); const release = await gate.acquire(new AbortController().signal);
 const next = gate.acquire(new AbortController().signal);
 try { throw new Error('active failed'); } catch { release(); }
 const nextRelease = await next; nextRelease();
});
