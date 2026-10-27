'use strict';
// Transfer completion, draw acknowledgement and GPU release are independent.
exports.createLifetime = (release) => {
  let transferred = false,
    acknowledged = false,
    gpuReleased = false,
    quarantined = false,
    ended = false,
    attempted = false;
  const finish = () => {
    if (
      !attempted &&
      !quarantined &&
      transferred &&
      acknowledged &&
      gpuReleased
    ) {
      attempted = true;
      try {
        release();
        ended = true;
      } catch (error) {
        quarantined = true;
        throw error;
      }
    }
  };
  return {
    transfer: () => {
      transferred = true;
      finish();
    },
    acknowledge: () => {
      acknowledged = true;
      finish();
    },
    gpuRelease: () => {
      gpuReleased = true;
      finish();
    },
    quarantine: () => {
      quarantined = true;
    },
    ended: () => ended,
    uncertain: () => quarantined,
  };
};
exports.createAdmission = () => {
  let expected = null,
    document = null,
    closed = false,
    presented = null;
  const current = (m) =>
    !closed &&
    expected &&
    m.generation === expected.generation &&
    m.seekId === expected.seekId &&
    (!document || m.document === document) &&
    (!presented || m.id > presented.id) &&
    (presented?.seekId !== m.seekId || m.pts >= presented.pts);
  return {
    expect: (generation, seekId) => {
      if (closed) throw Error('closed admission');
      expected = { generation, seekId };
    },
    current,
    commit: (m) => {
      if (!current(m)) return false;
      document = m.document;
      presented = m;
      return true;
    },
    close: () => {
      closed = true;
    },
    presented: () => presented,
  };
};
exports.waitOwned = async (promise, milliseconds) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(Error('owned cleanup pending; ownership retained')),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
