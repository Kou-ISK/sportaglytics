export const TIMELINE_PERSISTENCE_CHANNELS = {
  register: 'timeline-persistence:register',
  unregister: 'timeline-persistence:unregister',
  flush: 'timeline-persistence:flush',
  ack: 'timeline-persistence:ack',
  resume: 'timeline-persistence:resume',
} as const;

export interface TimelineCloseRequest {
  registrationId: string;
  requestId: string;
}

export interface TimelineCloseAck extends TimelineCloseRequest {
  success: boolean;
}

const isId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,100}$/.test(value);

export const isTimelineCloseRegistration = (
  value: unknown,
): value is { registrationId: string } =>
  typeof value === 'object' &&
  value !== null &&
  'registrationId' in value &&
  isId(value.registrationId);

export const isTimelineCloseRequest = (
  value: unknown,
): value is TimelineCloseRequest =>
  isTimelineCloseRegistration(value) &&
  'requestId' in value &&
  isId(value.requestId);

export const isTimelineCloseAck = (value: unknown): value is TimelineCloseAck =>
  isTimelineCloseRequest(value) &&
  'success' in value &&
  typeof value.success === 'boolean';

export interface ITimelinePersistenceAPI {
  /** Freeze edits synchronously, then resolve true only after the file write completes. */
  registerCloseHandler: (
    flush: () => Promise<boolean>,
    resume: () => void,
  ) => () => void;
}
