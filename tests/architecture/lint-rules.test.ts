import type { Linter } from 'eslint';
import { beforeAll, describe, expect, it } from 'vitest';
import security from '../../config/eslint/security.js';
import { lintFixtures } from './harness';

// Spec 000 AC-3 (RNF-10, P-8): security rules report each forbidden construct.

describe('security lint rules', () => {
  let messages: Map<string, Linter.LintMessage[]>;

  beforeAll(async () => {
    messages = await lintFixtures(security);
  });

  it.each([
    ['explicit any', '@typescript-eslint/no-explicit-any'],
    ['eval', 'no-eval'],
    ['new Function', 'no-new-func'],
    ['dangerouslySetInnerHTML', 'no-restricted-syntax'],
  ])('AC-3: %s is reported (%s)', (_name, rule) => {
    const rules = (messages.get('src/app/violates-security.tsx') ?? []).map((m) => m.ruleId);
    expect(rules).toContain(rule);
  });

  it('AC-3: safe code is allowed', () => {
    expect(messages.get('src/app/valid-security.tsx')).toEqual([]);
  });
});
