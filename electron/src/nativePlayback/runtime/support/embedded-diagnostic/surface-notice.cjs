'use strict';
exports.parseSurfaceNotice = (value, generation) => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(',') !== 'generation,id,type' ||
    value.type !== 'surface-ready' ||
    value.generation !== generation ||
    !Number.isSafeInteger(value.id) ||
    value.id <= 0
  )
    throw Error('invalid surface notice');
  return value.id;
};
