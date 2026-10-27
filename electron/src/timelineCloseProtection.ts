import { randomUUID } from 'node:crypto';
import { app, dialog, ipcMain } from 'electron';
import type { BrowserWindow, Event, IpcMainEvent } from 'electron';
import {
  TIMELINE_PERSISTENCE_CHANNELS as channels,
  isTimelineCloseAck,
  isTimelineCloseRegistration,
  type TimelineCloseRequest,
} from '../../src/types/ipc/timelinePersistence';
import { drainAtomicTextWrites } from './ipc/atomicTextFile';

interface ProtectedWindow {
  window: BrowserWindow;
  registrationId: string | null;
  revision: number;
  allowClose: boolean;
  closing: {
    event: Event | null;
    finish: () => void;
  } | null;
  request: {
    payload: TimelineCloseRequest;
    settle: (success: boolean) => void;
  } | null;
}

interface Options {
  rendererUrl: string;
  requiresPersistence: (window: BrowserWindow) => boolean;
  timeoutMs?: number;
  beforeClose?: (
    windows: readonly BrowserWindow[],
    kind: 'close' | 'quit',
  ) => Promise<() => void>;
}

const withTimeout = async <T>(
  work: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error('保存処理の完了を確認できませんでした。')),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

/** Owns only Timeline preparation; existing Playlist/capture close guards remain. */
export const registerTimelineCloseProtection = (
  options: Options,
): { protect: (window: BrowserWindow) => void } => {
  const windows = new Set<ProtectedWindow>();
  const timeoutMs = options.timeoutMs ?? 15_000;
  let operation: 'close' | 'quit' | null = null;
  let queuedQuit = false;
  // Authorization exists only during this synchronous retry, never after a
  // different window's close handler cancels app.quit().
  let retryingQuit = false;

  const resume = (state: ProtectedWindow): void => {
    state.allowClose = false;
    const request = state.request;
    state.request = null;
    if (!request) return;
    request.settle(false);
    if (!state.window.isDestroyed()) {
      try {
        state.window.webContents.send(channels.resume, request.payload);
      } catch {
        // A renderer can disappear between the liveness check and delivery.
        // Its registration is invalidated on navigation/process loss as well.
      }
    }
  };
  const invalidate = (state: ProtectedWindow): void => {
    state.revision++;
    state.registrationId = null;
    resume(state);
  };
  const getSender = (event: IpcMainEvent): ProtectedWindow | undefined => {
    try {
      // HashRouter can normalize the initial empty hash without changing the
      // document. Auxiliary windows still cannot register: they are not protected.
      const senderDocument = event.sender.getURL().split('#')[0];
      const rendererDocument = options.rendererUrl.split('#')[0];
      if (
        event.senderFrame !== event.sender.mainFrame ||
        senderDocument !== rendererDocument
      )
        return undefined;
      return [...windows].find(
        ({ window }) =>
          !window.isDestroyed() && window.webContents === event.sender,
      );
    } catch {
      // Native sender/frame/window access can throw after destruction. Reject
      // the event without changing registration or authorizing a pending close.
      return undefined;
    }
  };

  ipcMain.on(channels.register, (event, payload: unknown) => {
    const state = getSender(event);
    if (!state || !isTimelineCloseRegistration(payload)) return;
    invalidate(state);
    state.registrationId = payload.registrationId;
  });
  ipcMain.on(channels.unregister, (event, payload: unknown) => {
    const state = getSender(event);
    if (
      state &&
      isTimelineCloseRegistration(payload) &&
      state.registrationId === payload.registrationId
    )
      invalidate(state);
  });
  ipcMain.on(channels.ack, (event, payload: unknown) => {
    const state = getSender(event);
    if (
      !state?.request ||
      !isTimelineCloseAck(payload) ||
      payload.registrationId !== state.registrationId ||
      payload.requestId !== state.request.payload.requestId
    )
      return;
    state.request.settle(payload.success);
  });

  const requestFlush = (state: ProtectedWindow): Promise<boolean> => {
    if (!state.registrationId)
      return Promise.resolve(!options.requiresPersistence(state.window));
    const payload = {
      registrationId: state.registrationId,
      requestId: randomUUID(),
    };
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const timer = setTimeout(() => settle(false), timeoutMs);
      const settle = (success: boolean): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(success);
      };
      state.request = { payload, settle };
      try {
        state.window.webContents.send(channels.flush, payload);
      } catch {
        settle(false);
      }
    });
  };
  const prepare = async (states: ProtectedWindow[]): Promise<void> => {
    const revisions = states.map((state) => state.revision);
    const results = await Promise.all(states.map(requestFlush));
    if (results.some((success) => !success))
      throw new Error('Timeline の保存を確認できませんでした。');
    // ACK covers renderer-owned dirty state, including earlier write failures.
    // Drain also covers writes that had already entered Main's atomic queues.
    await withTimeout(drainAtomicTextWrites(), timeoutMs);
    if (
      states.some(
        (state, index) =>
          state.window.isDestroyed() || state.revision !== revisions[index],
      )
    )
      throw new Error(
        '保存中に画面が切り替わりました。もう一度お試しください。',
      );
  };
  const reportFailure = async (
    states: ProtectedWindow[],
    error: unknown,
  ): Promise<void> => {
    states.forEach(resume);
    const parent = states.find((state) => !state.window.isDestroyed())?.window;
    if (!parent) return;
    console.error('[timeline-close] close cancelled:', error);
    try {
      await dialog.showMessageBox(parent, {
        type: 'error',
        buttons: ['編集を続ける'],
        defaultId: 0,
        cancelId: 0,
        title: '処理の完了を確認できないため終了を中止しました',
        message:
          'バックグラウンド処理とTimelineの変更を保護するため、ウィンドウを閉じませんでした。',
        detail:
          '再生用コピーの片付けと、保存先への接続・空き容量・書込権限・画面の保存状態を確認し、再試行してください。',
      });
    } catch (dialogError) {
      console.error('[timeline-close] could not show save error:', dialogError);
    }
  };
  const closePrepared = async (
    states: ProtectedWindow[],
    close: () => void,
  ): Promise<void> => {
    const completions = states.map(
      (state) =>
        new Promise<void>((resolve) => {
          state.allowClose = true;
          state.closing = { event: null, finish: resolve };
        }),
    );
    try {
      close();
    } catch (error) {
      states.forEach((state) => state.closing?.finish());
      throw error;
    }
    // Electron emits close before running beforeunload asynchronously. A
    // prevented close (or an owner never reached because another window cancelled
    // quit) has no pending destruction. An accepted close must stay frozen until
    // `closed` or `will-prevent-unload`, not merely until close()/quit() returns.
    for (const state of states) {
      if (!state.closing?.event || state.closing.event.defaultPrevented)
        state.closing?.finish();
    }
    await Promise.all(completions);
  };
  const run = async (
    states: ProtectedWindow[],
    kind: 'close' | 'quit',
    close: () => void,
  ): Promise<void> => {
    operation = kind;
    let success = false;
    let release: (() => void) | undefined;
    try {
      if (options.beforeClose)
        release = await options.beforeClose(
          states.map((state) => state.window),
          kind,
        );
      await prepare(states);
      if (
        kind === 'quit' &&
        [...windows].some(
          (state) => !state.window.isDestroyed() && !states.includes(state),
        )
      )
        throw new Error(
          '保存中に新しい画面が開きました。もう一度終了してください。',
        );
      await closePrepared(states, close);
      success = true;
    } catch (error) {
      await reportFailure(states, error);
    } finally {
      release?.();
      // Playlist can prevent its close while showing an asynchronous dialog.
      // Surviving main windows resume and must obtain a fresh ACK next time.
      states.forEach(resume);
      states.forEach((state) => {
        state.closing = null;
      });
      operation = null;
      const retryQueuedQuit = success && queuedQuit;
      queuedQuit = false;
      if (retryQueuedQuit) queueMicrotask(() => app.quit());
    }
  };

  app.on('before-quit', (event) => {
    if (retryingQuit || event.defaultPrevented) return;
    const states = [...windows].filter((state) => !state.window.isDestroyed());
    if (states.length === 0 && !options.beforeClose) return;
    event.preventDefault();
    if (operation) {
      // A user may request Quit while a single-window close is still saving.
      // A failed save cancels both; otherwise the fresh quit prepares survivors.
      if (operation === 'close') queuedQuit = true;
      return;
    }
    void run(states, 'quit', () => {
      retryingQuit = true;
      try {
        app.quit();
      } finally {
        retryingQuit = false;
      }
    });
  });

  return {
    protect: (window) => {
      const state: ProtectedWindow = {
        window,
        registrationId: null,
        revision: 0,
        allowClose: false,
        closing: null,
        request: null,
      };
      windows.add(state);
      window.webContents.on('did-start-navigation', (details) => {
        if (details.isMainFrame && !details.isSameDocument) invalidate(state);
      });
      window.webContents.on('render-process-gone', () => invalidate(state));
      window.webContents.on('will-prevent-unload', () => {
        // Do not override the renderer's cancellation with preventDefault().
        state.closing?.finish();
      });
      window.on('close', (event) => {
        if (state.allowClose) {
          state.allowClose = false;
          if (state.closing) state.closing.event = event;
          return;
        }
        event.preventDefault();
        if (!operation) void run([state], 'close', () => window.close());
      });
      window.once('closed', () => {
        state.closing?.finish();
        invalidate(state);
        windows.delete(state);
      });
    },
  };
};
