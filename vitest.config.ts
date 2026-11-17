import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            include: ['src/**/*.test.{ts,tsx}'],
            setupFiles: ['./tests/setup/unit.ts'],
            typecheck: {
              enabled: true,
              include: ['src/**/*.test-d.ts'],
              tsconfig: './tsconfig.app.json',
            },
          },
        },
        {
          extends: true,
          test: {
            name: 'architecture',
            environment: 'node',
            include: ['tests/architecture/**/*.test.ts'],
          },
        },
      ],
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/__tests__/**', 'src/**/*.test-d.ts'],
        // RNF-08: domain logic and the shared kernel stay above 80%.
        thresholds: {
          'src/shared/kernel/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
          'src/modules/*/domain/**': { lines: 80, functions: 80, branches: 80, statements: 80 },
        },
      },
    },
  }),
);
