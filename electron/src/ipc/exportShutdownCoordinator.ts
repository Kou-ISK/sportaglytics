interface QuitEvent {
  preventDefault: () => void;
}

interface QuitApplication {
  on: (name: 'will-quit', listener: (event: QuitEvent) => void) => unknown;
  quit: () => void;
}

export type CancelExportResult =
  | 'accepted'
  | 'already-requested'
  | 'too-late'
  | 'not-found';
interface ExportJob {
  signal: AbortSignal;
  beginCommit: () => void;
  finishCommit: (final: boolean) => void;
  cancelRequested: () => boolean;
  release: () => void;
}
interface ExportShutdownCoordinator {
  start: (id?: string) => ExportJob;
  cancel: (id: string) => CancelExportResult;
  isQuitting: () => boolean;
}

/** Own all export jobs until their child processes and temporary files drain. */
export const createExportShutdownCoordinator = (
  app: QuitApplication,
): ExportShutdownCoordinator => {
  const active = new Set<AbortController>();
  const jobs = new Map<
    string,
    {
      controller: AbortController;
      phase: 'working' | 'committing' | 'completed';
      cancelled: boolean;
    }
  >();
  const usedIds = new Set<string>();
  let quitting = false;
  let resumeScheduled = false;
  app.on('will-quit', (event) => {
    quitting = true;
    if (active.size === 0) return;
    event.preventDefault();
    for (const controller of active) controller.abort();
  });
  return {
    start: (id?: string): ExportJob => {
      if (quitting) throw new Error('Application is quitting');
      if (
        id !== undefined &&
        (!id || id.length > 128 || usedIds.has(id) || usedIds.size >= 10000)
      )
        throw new Error('Invalid, reused, or exhausted export progress ID');
      const controller = new AbortController();
      const state = {
        controller,
        phase: 'working' as 'working' | 'committing' | 'completed',
        cancelled: false,
      };
      if (id !== undefined) {
        jobs.set(id, state);
        usedIds.add(id);
      }
      active.add(controller);
      let released = false;
      return {
        signal: controller.signal,
        beginCommit: () => {
          state.phase = 'committing';
        },
        finishCommit: (final) => {
          state.phase = final ? 'completed' : 'working';
        },
        cancelRequested: () => state.cancelled,
        release: () => {
          if (released) return;
          released = true;
          active.delete(controller);
          if (id !== undefined && jobs.get(id) === state) jobs.delete(id);
          if (quitting && active.size === 0 && !resumeScheduled) {
            resumeScheduled = true;
            queueMicrotask(() => app.quit());
          }
        },
      };
    },
    cancel: (id) => {
      const state = jobs.get(id);
      if (!state) return 'not-found';
      if (state.cancelled) return 'already-requested';
      if (state.phase !== 'working') return 'too-late';
      state.cancelled = true;
      state.controller.abort();
      return 'accepted';
    },
    isQuitting: () => quitting,
  };
};
