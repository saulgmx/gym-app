// No literal colors outside src/shared/ui/tokens.css (architecture §7.11, plan §6.10, AC-27).
// Shared by `npm run lint` and the architecture tests.
const colorRules = {
  'scale-unlimited/declaration-strict-value': [
    ['/color$/', 'fill', 'stroke'],
    {
      expandShorthand: true,
      ignoreFunctions: false,
      ignoreValues: ['currentcolor', 'transparent', 'none', 'inherit', 'initial', 'unset'],
    },
  ],
  'color-no-hex': true,
  'color-named': 'never',
};

/** @type {import('stylelint').Config} */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: colorRules,
  overrides: [
    {
      files: ['src/shared/ui/tokens.css'],
      rules: Object.fromEntries(Object.keys(colorRules).map((rule) => [rule, null])),
    },
    {
      // CSS Module classes are read from TypeScript as `styles.backLink`, so camelCase.
      files: ['**/*.module.css'],
      rules: {
        'selector-class-pattern': [
          '^[a-z][a-zA-Z0-9]*$',
          { message: (selector) => `Expected class selector "${selector}" to be camelCase` },
        ],
      },
    },
  ],
};
