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
			// Raised gate (2026-06): after adding unit tests for date, errors, http,
			// number, features, legacy-logger and types, achieved coverage is
			// statements 84.5%, branches 72.23%, functions 86.13%, lines 87.43%.
			// Thresholds are pinned just below the achieved floor so the gate passes
			// today and guards against regression. Statements/lines/functions are back
			// near the original 90/90/90 target; branches sit lower because a few
			// out-of-scope modules (e.g. jsonapi/transformer.ts at 0%, the axios 401
			// token-refresh queue) drag the global branch average — tighten further as
			// those gain tests.
			thresholds: {
				statements: 84,
				branches: 71,
				functions: 85,
				lines: 87,
			},
		},
	},
});
