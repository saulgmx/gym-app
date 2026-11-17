import path from 'node:path';
import boundariesPlugin from 'eslint-plugin-boundaries';
// Allowed module -> module dependencies (architecture §5.1), shared with .dependency-cruiser.cjs.
import MODULE_GRAPH from '../module-graph.json' with { type: 'json' };

// Module boundary rules (ADR-0008, architecture §5.1 and §5.2). Shared by eslint.config.js and
// the architecture tests, which point `rootPath` and `tsconfig` at their fixtures tree.

const LAYERS = 'domain|application|infrastructure|ui|__tests__';

const sameModule = { module: '{{ from.element.captured.module }}' };
const layer = (name) => ({ element: { type: 'layer', captured: { ...sameModule, layer: name } } });
const shared = (part) => ({ element: { type: 'shared', captured: { part } } });
// picomatch does not expand single-item braces (`{plan}` is literal), so only join several.
const anyOf = (names) => (names.length === 1 ? names[0] : `{${names.join(',')}}`);
const publicApiOf = (modules) => ({
  element: { type: 'module', captured: { module: anyOf(modules) } },
  file: { categories: 'public' },
});

/**
 * @param {{ rootPath: string; tsconfig: string }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function boundariesConfig({ rootPath, tsconfig }) {
  return [
    {
      files: ['src/**/*.{ts,tsx}'],
      plugins: { boundaries: boundariesPlugin },
      settings: {
        'boundaries/root-path': rootPath,
        'import/resolver': { typescript: { project: tsconfig } },
        // Layer first and exclusive: a file in a layer folder also matches `module`, and types
        // accumulate; the layer must win so the layer policies apply.
        'boundaries/elements': [
          {
            type: 'layer',
            pattern: `src/modules/*/+(${LAYERS})`,
            partialMatch: false,
            capture: ['module', 'layer'],
            exclusive: true,
          },
          { type: 'app', pattern: 'src/app', partialMatch: false },
          { type: 'shared', pattern: 'src/shared/*', partialMatch: false, capture: ['part'] },
          { type: 'module', pattern: 'src/modules/*', partialMatch: false, capture: ['module'] },
        ],
        'boundaries/files': [{ pattern: 'src/modules/*/index.ts', category: 'public' }],
      },
      rules: {
        // Every file under src/ belongs to a known element, and every local import resolves to one.
        'boundaries/no-unknown-files': 'error',
        'boundaries/no-unknown-dependencies': 'error',
        'boundaries/dependencies': [
          'error',
          {
            default: 'disallow',
            policies: [
              // app: composition root and pages; modules only through their public API.
              {
                from: { element: { type: 'app' } },
                allow: { to: [{ element: { type: 'shared' } }, publicApiOf(['*'])] },
              },
              // shared never depends on app or modules (AC-8).
              {
                from: { element: { type: 'shared' } },
                allow: { to: { element: { type: 'shared' } } },
              },
              // A module's index.ts wires its own layers; create<Module>(deps) takes kernel types
              // such as Clock (architecture §5.3).
              {
                from: { element: { type: 'module' } },
                allow: {
                  to: [{ element: { type: 'layer', captured: sameModule } }, shared('kernel')],
                },
              },
              // Layers (architecture §5.2).
              {
                from: layer('domain'),
                allow: { to: shared('kernel') },
              },
              {
                from: layer('application'),
                allow: { to: [layer('domain'), shared('kernel'), shared('events')] },
              },
              {
                from: layer('infrastructure'),
                allow: { to: [layer('domain'), layer('application'), shared('kernel')] },
              },
              {
                from: layer('ui'),
                allow: {
                  to: [layer('application'), layer('domain'), shared('kernel'), shared('ui')],
                },
              },
              {
                from: layer('__tests__'),
                allow: {
                  to: [
                    { element: { type: 'layer', captured: sameModule } },
                    { element: { type: 'module', captured: sameModule } },
                    { element: { type: 'shared' } },
                  ],
                },
              },
              // Module graph (architecture §5.1, AC-5): application layers reach other modules only
              // through their index.ts (AC-4).
              ...Object.entries(MODULE_GRAPH)
                .filter(([, to]) => to.length > 0)
                .map(([from, to]) => ({
                  from: {
                    element: { type: 'layer', captured: { module: from, layer: 'application' } },
                  },
                  allow: { to: publicApiOf(to) },
                })),
            ],
          },
        ],
      },
    },
  ];
}

export default boundariesConfig({
  rootPath: path.resolve(import.meta.dirname, '../..'),
  tsconfig: path.resolve(import.meta.dirname, '../../tsconfig.app.json'),
});
