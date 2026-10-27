import {
  parseNativePlaybackPresentation,
  nativePresentationSupports,
} from '../../../src/types/ipc/nativePlaybackPresentation';
import type { NativePlaybackPresentation } from '../../../src/types/ipc/nativePlaybackPresentation';
import { parseNativePlaybackFailure } from '../../../src/types/ipc/nativePlaybackFailure';
import type { NativePlaybackFailure } from '../../../src/types/ipc/nativePlaybackFailure';
import { randomUUID } from 'node:crypto';
import { NativePlaybackSession } from './nativePlaybackSession';
import type {
  NativePlaybackBackend,
  NativePlaybackScope,
} from './nativePlaybackSession';
import {
  parseNativePlaybackOwner,
  parseNativePlaybackAvailability,
  parseNativePlaybackIntent,
} from '../../../src/types/ipc/nativePlayback';
import type {
  NativePlaybackAvailability,
  NativePlaybackClosed,
  NativePlaybackIntent,
  NativePlaybackOwner,
  NativePlaybackSnapshot,
} from '../../../src/types/ipc/nativePlayback';

/** Supplied only by trusted Main composition. No renderer path/arguments/proof. */
export interface QualifiedNativeSource {
  // Omit when this backend has no embedded presentation contract.
  presentation?: NativePlaybackPresentation;
  sourceKey: string;
  sourceEnd: number | null;
  sourceUrl: string;
  scope: Omit<NativePlaybackScope, 'owner'>;
  assertCurrent: () => Promise<void>;
  // The backend takes ownership synchronously, including a failed launch. Its
  // close promise must drain any started process even if initialization fails.
  createBackend: (
    owner: NativePlaybackOwner,
    observe: (value: unknown) => void,
  ) => NativePlaybackBackend;
}
export interface NativePlaybackEnvironment {
  publish?: (
    owner: NativePlaybackOwner,
    snapshot: NativePlaybackSnapshot,
  ) => void;
  context: () => string | null;
  qualify: (() => Promise<QualifiedNativeSource | null>) | null;
}
/** A single manager owns a document through navigation, IPC rejection and quit. */
export class NativePlaybackManager {
  private failureSink: NativePlaybackBackend['reportFailure'] = undefined;
  private failureReported = false;
  private qualified: QualifiedNativeSource | null = null;
  private owner: NativePlaybackOwner | null = null;
  private context: string | null = null;
  private session: NativePlaybackSession | null = null;
  private lookup: Promise<NativePlaybackAvailability> | null = null;
  private opening: Promise<void> | null = null;
  private invalidated = false;
  private held = false;
  private closing = false;
  private drained = false;
  private closeWork: Promise<NativePlaybackClosed> | null = null;
  constructor(private readonly environment: NativePlaybackEnvironment) {}
  async inspect(): Promise<NativePlaybackAvailability> {
    const disabled: NativePlaybackAvailability = {
      available: false,
      presentation: null,
      sourceEnd: null,
      owner: null,
      sourceUrl: null,
      reason: 'disabled',
    };
    if (!this.environment.qualify) return disabled;
    if (!this.owner && !this.lookup && !this.opening && !this.session)
      this.invalidated = false;
    // Only a confirmed drain permits another generation. Never retry an
    // uncertain close or reuse its source qualification after navigation.
    if (this.drained && !this.held && !this.opening && !this.lookup) {
      this.failureSink = undefined;
      this.failureReported = false;
      this.session = null;
      this.qualified = null;
      this.owner = null;
      this.context = null;
      this.closeWork = null;
      this.closing = false;
      this.invalidated = false;
      this.drained = false;
    }
    if (this.session || this.opening || this.held || this.closing)
      return { ...disabled, reason: 'busy' };
    if (this.lookup) return this.lookup;
    const context = this.environment.context();
    const qualify = this.environment.qualify;
    this.lookup = (async () => {
      if (!context) return { ...disabled, reason: 'unsupported' as const };
      const source = await qualify();
      if (
        !source ||
        context !== this.environment.context() ||
        this.held ||
        this.invalidated ||
        this.session ||
        this.opening ||
        this.closing
      )
        return { ...disabled, reason: 'unsupported' as const };
      await source.assertCurrent();
      if (
        context !== this.environment.context() ||
        this.held ||
        this.invalidated ||
        this.session ||
        this.opening ||
        this.closing
      )
        return { ...disabled, reason: 'busy' as const };
      const owner = parseNativePlaybackOwner({
        generation: randomUUID(),
        sourceKey: source.sourceKey,
      });
      if (new URL(source.sourceUrl).protocol !== 'file:')
        throw Error('NATIVE_UNQUALIFIED_SOURCE');
      const presentation = source.presentation
        ? parseNativePlaybackPresentation(source.presentation)
        : null;
      if (
        presentation &&
        (presentation.start !== source.scope.start ||
          presentation.end !== source.scope.end ||
          presentation.audioTracks !== source.scope.audioTracks ||
          JSON.stringify(presentation.rates) !==
            JSON.stringify(source.scope.rates))
      )
        throw Error('NATIVE_PRESENTATION_SCOPE_MISMATCH');
      const availability = parseNativePlaybackAvailability({
        available: true,
        presentation,
        owner: { ...owner },
        sourceUrl: source.sourceUrl,
        sourceEnd: source.sourceEnd,
        reason: null,
      });
      this.context = context;
      this.qualified = source;
      this.owner = owner;
      return availability;
    })().finally(() => {
      this.lookup = null;
    });
    return this.lookup;
  }
  private authenticate(raw: NativePlaybackOwner): QualifiedNativeSource {
    const value = parseNativePlaybackOwner(raw);
    if (
      !this.qualified ||
      !this.owner ||
      value.generation !== this.owner.generation ||
      value.sourceKey !== this.owner.sourceKey
    )
      throw Error('NATIVE_OWNER_CHANGED');
    if (this.context !== this.environment.context()) this.invalidate();
    if (this.invalidated || this.closing || this.held)
      throw Error('NATIVE_OWNER_CHANGED');
    return this.qualified;
  }
  open(raw: NativePlaybackOwner): Promise<void> {
    const owner = parseNativePlaybackOwner(raw);
    const source = this.authenticate(owner);
    if (this.opening || this.session) throw Error('NATIVE_ALREADY_OPEN');
    this.opening = (async () => {
      await source.assertCurrent();
      this.authenticate(owner);
      let backend: NativePlaybackBackend | null = null;
      // Install the owner and validate scope before the factory can launch.
      // A factory that throws without returning its owner has an uncertain
      // outcome, so its lease must not be silently released by hold().
      let session: NativePlaybackSession | null = null;
      const publish = (): void => {
        if (
          !session ||
          this.session !== session ||
          this.invalidated ||
          this.closing ||
          this.context !== this.environment.context()
        )
          return;
        try {
          this.environment.publish?.({ ...owner }, session.snapshot());
        } catch {
          this.invalidate();
        }
      };
      session = new NativePlaybackSession(
        { ...source.scope, owner },
        {
          write: (intent) => {
            if (!backend)
              return Promise.reject(Error('NATIVE_INITIALIZATION_UNKNOWN'));
            return backend.write(intent);
          },
          close: () => {
            if (!backend)
              return Promise.reject(Error('NATIVE_INITIALIZATION_UNKNOWN'));
            return backend.close();
          },
        },
        publish,
      );
      this.session = session;
      const retainedSession = session;
      backend = source.createBackend(owner, (value) => {
        if (this.session === retainedSession) retainedSession.observe(value);
      });
      this.failureSink = backend.reportFailure;
    })().finally(() => {
      this.opening = null;
    });
    return this.opening;
  }
  async apply(raw: NativePlaybackIntent): Promise<void> {
    const value = parseNativePlaybackIntent(raw);
    const source = this.authenticate({
      generation: value.generation,
      sourceKey: value.sourceKey,
    });
    try {
      await source.assertCurrent();
    } catch (error) {
      this.invalidate();
      throw error;
    }
    this.authenticate({
      generation: value.generation,
      sourceKey: value.sourceKey,
    });
    if (!this.session) throw Error('NATIVE_NOT_OPEN');
    if (
      source.presentation &&
      !nativePresentationSupports(
        source.presentation,
        value,
        this.session.snapshot().intent?.audioTrack ?? value.audioTrack,
      )
    )
      throw Error('NATIVE_UNQUALIFIED_PRESENTATION');
    this.session.apply(value);
  }
  observe(raw: NativePlaybackOwner): NativePlaybackSnapshot {
    this.authenticate(raw);
    if (!this.session) throw Error('NATIVE_NOT_OPEN');
    return this.session.snapshot();
  }
  close(raw: NativePlaybackOwner): Promise<NativePlaybackClosed> {
    const value = parseNativePlaybackOwner(raw);
    if (
      !this.owner ||
      value.generation !== this.owner.generation ||
      value.sourceKey !== this.owner.sourceKey
    )
      throw Error('NATIVE_OWNER_CHANGED');
    if (this.closeWork) return this.closeWork;
    this.closing = true; // Synchronously invalidates a pending, not-yet-created backend.
    this.closeWork = (async () => {
      try {
        await this.opening;
      } catch {
        /* The retained session below owns any factory outcome. */
      }
      if (this.session) {
        const result = await this.session.close();
        this.drained = true;
        return result;
      }
      this.drained = true;
      return {
        generation: value.generation,
        nativeDrained: true,
        processStarted: false,
        processExited: true,
        pipesClosed: true,
        stopped: null,
      };
    })();
    return this.closeWork;
  }

  /** The same document may report restoration failure after a clean close.
   * Never open resources, requalify media or mutate playback from this endpoint. */
  reportFailure(
    rawOwner: NativePlaybackOwner,
    raw: NativePlaybackFailure,
  ): void {
    const owner = parseNativePlaybackOwner(rawOwner);
    const failure = parseNativePlaybackFailure(raw);
    if (
      !this.owner ||
      owner.generation !== this.owner.generation ||
      owner.sourceKey !== this.owner.sourceKey ||
      this.invalidated ||
      this.held ||
      this.context !== this.environment.context()
    )
      throw Error('NATIVE_OWNER_CHANGED');
    if (this.failureReported || !this.failureSink) return;
    this.failureReported = true;
    try {
      this.failureSink(failure);
    } catch {
      /* Optional diagnostics only. */
    }
  }

  invalidate(): void {
    this.invalidated = true;
    this.session?.fail('owner');
    if (this.owner) void this.close(this.owner).catch(() => {});
  }
  async hold(): Promise<() => void> {
    this.held = true;
    try {
      if (this.owner && (this.opening || this.session))
        await this.close(this.owner);
      await this.lookup;
      return () => {
        this.held = false;
      };
    } catch (error) {
      // Keep the hold on unknown cleanup; a failed close must not unlock launch.
      throw error;
    }
  }
}
