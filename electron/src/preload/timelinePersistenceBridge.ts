import type { ITimelinePersistenceAPI } from '../../../src/types/ipc/timelinePersistence';
import {
  TIMELINE_PERSISTENCE_CHANNELS as channels,
  isTimelineCloseRequest,
} from '../../../src/types/ipc/timelinePersistence';

interface Transport {
  on: (
    channel: string,
    listener: (event: unknown, payload: unknown) => void,
  ) => unknown;
  send: (channel: string, payload: unknown) => void;
}

export const createTimelinePersistenceBridge = (
  transport: Transport,
): ITimelinePersistenceAPI => {
  let sequence = 0;
  let owner: {
    registrationId: string;
    flush: () => Promise<boolean>;
    resume: () => void;
    requestId: string | null;
  } | null = null;

  transport.on(channels.flush, (_event, request) => {
    if (
      !isTimelineCloseRequest(request) ||
      !owner ||
      owner.registrationId !== request.registrationId ||
      owner.requestId !== null
    )
      return;
    const current = owner;
    current.requestId = request.requestId;
    const acknowledge = (success: boolean): void => {
      if (owner === current && current.requestId === request.requestId)
        transport.send(channels.ack, { ...request, success });
    };
    // Invoke immediately: the handler freezes editing before its first await.
    try {
      void current.flush().then(acknowledge, () => acknowledge(false));
    } catch {
      acknowledge(false);
    }
  });
  transport.on(channels.resume, (_event, request) => {
    if (
      !isTimelineCloseRequest(request) ||
      !owner ||
      owner.registrationId !== request.registrationId ||
      owner.requestId !== request.requestId
    )
      return;
    owner.requestId = null;
    owner.resume();
  });

  return {
    registerCloseHandler: (flush, resume) => {
      const subscription = {
        registrationId: `${Date.now()}-${++sequence}`,
        flush,
        resume,
        requestId: null,
      };
      owner = subscription;
      transport.send(channels.register, {
        registrationId: subscription.registrationId,
      });
      return () => {
        if (owner !== subscription) return;
        owner = null;
        transport.send(channels.unregister, {
          registrationId: subscription.registrationId,
        });
      };
    },
  };
};
