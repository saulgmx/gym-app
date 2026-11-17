import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { cruise, type IConfiguration, type IViolation } from 'dependency-cruiser';
import extractTSConfig from 'dependency-cruiser/config-utl/extract-ts-config';
import { ESLint, type Linter } from 'eslint';
import tseslint from 'typescript-eslint';

// Runs the project's real rule sets against the fixtures tree, so the tests prove that the
// configuration used by `npm run lint` reports each violation (spec 000, plan §6.4).

export const FIXTURES = fileURLToPath(new URL('./fixtures', import.meta.url));
export const FIXTURES_TSCONFIG = path.join(FIXTURES, 'tsconfig.json');

const typescriptParsing = {
  files: ['**/*.{ts,tsx}'],
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: { ecmaFeatures: { jsx: true } },
  },
  plugins: { '@typescript-eslint': tseslint.plugin },
} as Linter.Config;

/** Lints every fixture file with the given configs; returns messages keyed by fixture path. */
export async function lintFixtures(
  configs: Linter.Config[],
): Promise<Map<string, Linter.LintMessage[]>> {
  const eslint = new ESLint({
    cwd: FIXTURES,
    overrideConfigFile: true,
    overrideConfig: [typescriptParsing, ...configs],
  });
  const results = await eslint.lintFiles(['src/**/*.{ts,tsx}']);
  return new Map(results.map((r) => [path.relative(FIXTURES, r.filePath), r.messages]));
}

/** Cruises the fixtures with the rules in .dependency-cruiser.cjs. */
export async function cruiseFixtures(): Promise<{ violations: IViolation[]; modules: string[] }> {
  const require = createRequire(import.meta.url);
  const config = require('../../.dependency-cruiser.cjs') as IConfiguration;
  const result = await cruise(
    ['src'],
    {
      ...config.options,
      baseDir: FIXTURES,
      validate: true,
      ruleSet: { forbidden: config.forbidden ?? [] },
      tsConfig: { fileName: FIXTURES_TSCONFIG },
    },
    {},
    { tsConfig: extractTSConfig(FIXTURES_TSCONFIG) },
  );
  if (typeof result.output === 'string') throw new Error('Expected a JSON cruise result');
  return {
    violations: result.output.summary.violations,
    modules: result.output.modules.map((m) => m.source),
  };
}
