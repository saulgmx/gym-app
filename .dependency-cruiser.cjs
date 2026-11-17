// Dependency rules checked in CI (ADR-0008). Shared by `npm run lint` and the architecture tests.
// Rules arrive in T7.
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
  },
};
