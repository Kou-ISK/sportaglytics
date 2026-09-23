export const LIVE_CAPTURE_CHANNELS = {
  open: 'live-capture:open',
  hide: 'live-capture:hide',
  authorize: 'live-capture:authorize-devices',
  capabilities: 'live-capture:capabilities',
  start: 'live-capture:start',
  append: 'live-capture:append',
  endInput: 'live-capture:end-input',
  retry: 'live-capture:retry',
  stop: 'live-capture:stop',
  request: 'live-capture:request-state',
  state: 'live-capture:state',
  stopRequested: 'live-capture:stop-requested',
} as const;
