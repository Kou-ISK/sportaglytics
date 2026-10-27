'use strict';
// Optional IPC must not hold ChildProcess close open or throw into the required
// protocol callbacks. Destroy only FD3, never stdout/stderr or the control pipe.
function attachAuxiliary(child, recurrence) {
  const stream = child.stdio?.[3];
  if (!stream || !recurrence) return;
  const invoke = (name, ...args) => {
    try {
      recurrence[name](...args);
    } catch {}
  };
  stream.on('data', (bytes) => {
    try {
      if (recurrence.data(bytes) === false) stream.destroy();
    } catch {
      invoke('error');
      stream.destroy();
    }
  });
  stream.once('end', () => invoke('end'));
  stream.once('error', () => {
    invoke('error');
    stream.destroy();
  });
  child.once('exit', (code, signal) => {
    invoke('exit', code, signal);
    stream.destroy();
  });
  child.once('error', () => {
    invoke('error');
    stream.destroy();
  });
}
module.exports = { attachAuxiliary };
