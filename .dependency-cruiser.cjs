// Dependency rules checked in CI (ADR-0008). Shared by `npm run lint` and the architecture tests.

/** Allowed module -> module dependencies (architecture §5.1); also read by boundaries.js. */
const MODULE_GRAPH = require('./config/module-graph.json');

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Circular dependencies make modules impossible to reason about in isolation.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Every import resolves to a file or package (catches typos in the @/ alias).',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'shared-no-modules',
      comment: 'shared is the bottom of the graph: it never depends on app or modules (AC-8).',
      severity: 'error',
      from: { path: '^src/shared/' },
      to: { path: '^src/(app|modules)/' },
    },
    {
      name: 'domain-is-pure',
      comment:
        'Domain code is plain TypeScript: no UI, persistence or state libraries (P-5, AC-7).',
      severity: 'error',
      from: { path: '^src/modules/[^/]+/domain/' },
      to: { path: 'node_modules/(react|react-dom|dexie|zustand)(/|$)' },
    },
    ...Object.entries(MODULE_GRAPH).map(([from, allowed]) => ({
      name: 'module-graph',
      comment: `${from} may only depend on: ${allowed.join(', ') || 'no other module'} (architecture §5.1, AC-5).`,
      severity: 'error',
      from: { path: `^src/modules/${from}/` },
      to: { path: `^src/modules/(?!(${[from, ...allowed].join('|')})/)` },
    })),
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.app.json' },
  },
};
