import type { Linter } from 'eslint';
import type stylelint from 'stylelint';
import { beforeAll, describe, expect, it } from 'vitest';
import security from '../../config/eslint/security.js';
import { lintFixtures, stylelintFixtures } from './harness';

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

// Spec 000 AC-27 (architecture §7.11, plan §6.10): no literal colors outside tokens.css.

describe('color literal stylelint rules', () => {
  let warnings: Map<string, stylelint.Warning[]>;

  beforeAll(async () => {
    warnings = await stylelintFixtures();
  });

  it.each([
    ['hex value in color', 'violates-hex-color.css', 'scale-unlimited/declaration-strict-value'],
    [
      'rgb() in background shorthand',
      'violates-function-color.css',
      'scale-unlimited/declaration-strict-value',
    ],
    ['named color in border shorthand', 'violates-named-color.css', 'color-named'],
    ['hex value in box-shadow', 'violates-shadow-color.css', 'color-no-hex'],
  ])('AC-27: %s is reported (%s → %s)', (_name, file, rule) => {
    const rules = (warnings.get(`src/app/${file}`) ?? []).map((w) => w.rule);
    expect(rules).toContain(rule);
  });

  it('AC-27: tokens and allowed keywords pass', () => {
    expect(warnings.get('src/app/valid-tokens-usage.css')).toEqual([]);
  });

  it('AC-27: tokens.css may declare literal colors', () => {
    expect(warnings.get('src/shared/ui/tokens.css')).toEqual([]);
  });
});
