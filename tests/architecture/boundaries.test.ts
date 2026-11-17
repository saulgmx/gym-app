import type { IViolation } from 'dependency-cruiser';
import type { Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import boundaries from '../../config/eslint/boundaries.js';
import { cruiseFixtures, lintFixtures } from './harness';

// Spec 000 §4.2 (ADR-0008, QS-07, CA-9): each rule reports its violation and accepts its valid case.

const TRAINING_APP = 'src/modules/training/application';
const HEALTH = 'src/modules/health';
const FIXTURE_FILES = 21; // .ts/.tsx files under fixtures/src

describe('eslint-plugin-boundaries', () => {
  let messages: Map<string, Linter.LintMessage[]>;

  beforeAll(async () => {
    messages = await lintFixtures(boundaries);
  });

  // Guards against a vacuous pass: the valid cases mean nothing if no file was linted.
  it('lints every fixture file', () => {
    expect(messages.size).toBe(FIXTURE_FILES);
  });

  const boundaryRules = (file: string) =>
    (messages.get(file) ?? []).filter((m) => m.ruleId?.startsWith('boundaries/'));

  it.each([
    [
      'AC-4: importing an internal file of another module',
      `${TRAINING_APP}/violates-internal-import.ts`,
    ],
    [
      'AC-5: importing a module outside the allowed graph',
      `${TRAINING_APP}/violates-forbidden-module.ts`,
    ],
    ['AC-9: ui importing infrastructure', `${HEALTH}/ui/violates-ui-to-infrastructure.ts`],
  ])('%s is reported', (_name, file) => {
    expect(messages.has(file)).toBe(true);
    expect(boundaryRules(file)).not.toHaveLength(0);
  });

  it.each([
    [
      'AC-4: importing another module through its index.ts',
      `${TRAINING_APP}/valid-public-import.ts`,
    ],
    ['AC-9: ui importing application', `${HEALTH}/ui/valid-ui-to-application.ts`],
    ['AC-7: domain importing the shared kernel', `${HEALTH}/domain/valid-pure.ts`],
  ])('%s is allowed', (_name, file) => {
    expect(messages.get(file)).toEqual([]);
  });
});

describe('dependency-cruiser', () => {
  let violations: IViolation[];
  let modules: string[];

  beforeAll(async () => {
    ({ violations, modules } = await cruiseFixtures());
  });

  it('cruises every fixture file', () => {
    expect(modules.filter((m) => m.startsWith('src/'))).toHaveLength(FIXTURE_FILES);
  });

  const rulesFrom = (file: string) =>
    violations.filter((v) => v.from === file).map((v) => v.rule.name);

  it.each([
    ['AC-5', 'module-graph', `${TRAINING_APP}/violates-forbidden-module.ts`],
    ['AC-6', 'no-circular', `${HEALTH}/domain/violates-cycle-a.ts`],
    ['AC-7', 'domain-is-pure', `${HEALTH}/domain/violates-impure.ts`],
    ['AC-8', 'shared-no-modules', 'src/shared/kernel/violates-imports-module.ts'],
    ['plan §6.4', 'not-to-unresolvable', `${HEALTH}/application/violates-unresolvable.ts`],
  ])('%s: %s reports %s', (_id, rule, file) => {
    expect(rulesFrom(file)).toContain(rule);
  });

  it('valid fixtures produce no violations', () => {
    const fromValid = violations.filter((v) => basename(v.from).startsWith('valid-'));
    expect(fromValid).toEqual([]);
  });
});

function basename(file: string): string {
  return file.slice(file.lastIndexOf('/') + 1);
}
