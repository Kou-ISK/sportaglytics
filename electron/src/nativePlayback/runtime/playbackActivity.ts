type Blocker = {
  start(type: 'prevent-app-suspension'): number;
  stop(id: number): boolean;
  isStarted(id: number): boolean;
};
export type ActivityRecord = {
  id: number;
  registered: boolean;
  stopReturned?: boolean;
};
/** One private diagnostic lease; registration is not an OS assertion ACK. */
export function createPlaybackActivity(api: Blocker): {
  start: () => ActivityRecord;
  stop: () => ActivityRecord | null;
} {
  let attempted = false,
    closed = false,
    id: number | undefined,
    stopError: unknown,
    hasStopError = false;
  return {
    start: () => {
      if (attempted || closed) throw Error('activity already attempted/closed');
      attempted = true;
      const acquired = api.start('prevent-app-suspension');
      if (!Number.isSafeInteger(acquired) || acquired < 0)
        throw Error('invalid activity ID');
      id = acquired;
      return { id, registered: api.isStarted(id) };
    },
    stop: () => {
      if (hasStopError) throw stopError;
      if (closed) return null;
      closed = true;
      if (id === undefined) return null;
      try {
        const stopReturned = api.stop(id),
          registered = api.isStarted(id);
        if (!stopReturned || registered)
          throw Error('activity removal unconfirmed');
        return { id, stopReturned, registered };
      } catch (error) {
        hasStopError = true;
        stopError = error;
        throw error;
      }
    },
  };
}
