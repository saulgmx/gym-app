// Security rules (RNF-10, P-8, architecture §7.10). Shared by eslint.config.js and the
// architecture tests. Type-aware checks (e.g. no-implied-eval) come from strictTypeChecked.
/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-eval': 'error',
      'no-new-func': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='dangerouslySetInnerHTML']",
          message: 'dangerouslySetInnerHTML is forbidden (RNF-10).',
        },
      ],
    },
  },
];
