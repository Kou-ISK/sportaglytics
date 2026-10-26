'use strict';
const { setImmediate: nextTurn } = require('node:timers/promises');
function cancellationGate(cancelled) {
  const check = () => {
    if (cancelled()) throw Error('owner cancelled before native launch');
  };
  return {
    check,
    wait: async (operation) => {
      check();
      const value = await operation();
      check();
      return value;
    },
    beforeSpawn: async () => {
      await nextTurn();
      check();
    },
  };
}
module.exports = { cancellationGate };
