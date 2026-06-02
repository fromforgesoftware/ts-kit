import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		setupFiles: ['./src/__tests__/jsonapi-client/setup.ts'],
		include: ['src/__tests__/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['src/__tests__/**'],
			// Ratcheted floor (2026-06): current coverage is statements 51.39%,
			// branches 80.66%, functions 83.18%, lines 51.39%. Thresholds are set
			// just below current to lock a non-regression gate that passes today;
			// raise these as tests are added for date/errors/http/number/features/
			// legacy-logger/types in a later phase.
			thresholds: {
				statements: 51,
				branches: 80,
				functions: 83,
				lines: 51,
			},
		},
	},
});
