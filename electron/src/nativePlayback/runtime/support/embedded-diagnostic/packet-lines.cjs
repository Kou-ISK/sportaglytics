'use strict';
const { StringDecoder } = require('node:string_decoder');
// Bound each protocol message, not all bytes over the owner's lifetime.
exports.packetLines = (consume, limit = 8192) => {
  const decoder = new StringDecoder('utf8');
  let pending = '',
    failed = false;
  return {
    write(bytes) {
      if (failed) throw Error('protocol parser failed');
      try {
        const text = decoder.write(bytes);
        let start = 0;
        for (
          let at = text.indexOf('\n');
          at >= 0;
          at = text.indexOf('\n', start)
        ) {
          const line = pending + text.slice(start, at);
          if (Buffer.byteLength(line) > limit) throw Error('host packet limit');
          pending = '';
          consume(JSON.parse(line));
          start = at + 1;
        }
        pending += text.slice(start);
        if (Buffer.byteLength(pending) > limit)
          throw Error('host packet limit');
      } catch (error) {
        failed = true;
        throw error;
      }
    },
    pending() {
      return pending + decoder.end();
    },
  };
};
