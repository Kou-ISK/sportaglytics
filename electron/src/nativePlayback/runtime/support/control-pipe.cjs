'use strict';
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
/** Child receives a read-only FIFO. Parent alone owns the write end. */
function createControlPipe(file) {
  execFileSync('/usr/bin/mkfifo', ['-m', '600', file], { timeout: 2000 });
  let readFd = null,
    writeFd = null,
    readCloseError = null,
    closing = false,
    closeWork = null;
  const writes = new Set();
  try {
    readFd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
    writeFd = fs.openSync(
      file,
      fs.constants.O_WRONLY | fs.constants.O_NONBLOCK,
    );
  } catch (error) {
    if (readFd !== null) fs.closeSync(readFd);
    throw error;
  }
  const inputFd = readFd;
  const closeReader = () => {
    if (readFd === null) {
      if (readCloseError) throw readCloseError;
      return;
    }
    const owned = readFd;
    readFd = null;
    try {
      fs.closeSync(owned);
    } catch (error) {
      readCloseError = error;
      throw error;
    }
  };
  return {
    inputFd,
    closeReader,
    write: (value) => {
      if (closing || writeFd === null)
        return Promise.reject(Error('control pipe closed'));
      const bytes = Buffer.from(value);
      if (bytes.length > 4096)
        return Promise.reject(Error('control write bound'));
      const operation = new Promise((resolve, reject) => {
        fs.write(writeFd, bytes, 0, bytes.length, null, (error, written) => {
          if (error) reject(error);
          else if (written !== bytes.length)
            reject(Error('partial control delivery'));
          else resolve();
        });
      });
      writes.add(operation);
      void operation.then(
        () => writes.delete(operation),
        () => writes.delete(operation),
      );
      return operation;
    },
    close: () => {
      if (closeWork) return closeWork;
      closing = true;
      closeWork = (async () => {
        let error = null;
        try {
          closeReader();
        } catch (reason) {
          error = reason;
        }
        await Promise.allSettled([...writes]);
        if (writeFd !== null) {
          const owned = writeFd;
          writeFd = null;
          try {
            await new Promise((resolve, reject) =>
              fs.close(owned, (reason) =>
                reason ? reject(reason) : resolve(),
              ),
            );
          } catch (reason) {
            error = reason;
          }
        }
        if (error) throw error;
      })();
      return closeWork;
    },
  };
}
module.exports = { createControlPipe };
