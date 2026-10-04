module.exports = {
  hooks: {
    readPackage(pkg) {
      if (pkg.name === 'got' && pkg.version === '11.8.6') {
        // The version-pinned Got patch removes the unused HTTP response cache
        // implementation. pnpm 9 needs this matching manifest correction;
        // Electron's checksum-verified file cache does not use this dependency.
        delete pkg.dependencies['cacheable-request'];
      }
      return pkg;
    },
  },
};
