'use strict';
function assertNativeDrain({
  owner,
  receipt,
  actualExit,
  spawned,
  pendingOutput,
  controlClosed,
  launchError,
  childPid,
}) {
  if (
    !spawned &&
    childPid === undefined &&
    launchError instanceof Error &&
    ['ENOENT', 'EACCES', 'EPERM', 'ENOEXEC', 'ENOMEM', 'EAGAIN'].includes(
      launchError.code,
    ) &&
    controlClosed &&
    !pendingOutput &&
    !receipt &&
    !actualExit
  )
    return {
      generation: owner.generation,
      nativeDrained: true,
      processStarted: false,
      processExited: true,
      pipesClosed: true,
      stopped: null,
    };
  if (
    !spawned ||
    !controlClosed ||
    pendingOutput ||
    !receipt ||
    receipt.type !== 'drained' ||
    receipt.generation !== owner.generation ||
    receipt.nativeDrained !== true ||
    receipt.requiresOwnerExitZero !== true ||
    typeof receipt.resultPersisted !== 'boolean' ||
    typeof receipt.success !== 'boolean' ||
    !actualExit ||
    !Number.isInteger(actualExit.code) ||
    actualExit.code < 0 ||
    actualExit.signal !== null
  )
    throw Error('host cleanup unconfirmed');
  return {
    generation: owner.generation,
    nativeDrained: true,
    processStarted: true,
    processExited: true,
    pipesClosed: true,
    stopped: receipt.stoppedClock ?? null,
  };
}
module.exports = { assertNativeDrain };
