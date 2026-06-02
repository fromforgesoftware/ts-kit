import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Regression guard for the "broken standalone Node-ESM package" defect:
// the compiled dist/*.js must use explicit `.js` / `/index.js` relative
// import specifiers so Node's native ESM resolver accepts them. Bundlers
// (vite/vitest) tolerate extensionless + directory imports, so this guard
// deliberately spawns a real `node` process against the built dist/ rather
// than importing through the bundler-backed test runner.

const here = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(here, '../../../dist');

// Entry points to exercise: root + a representative spread of subpath exports.
const entries = [
	'index.js',
	'jsonapi-client/index.js',
	'resource-state/index.js',
	'jsonapi/index.js',
	'http/index.js',
	'storage/index.js',
	'i18n/index.js',
];

const distBuilt = existsSync(resolve(distDir, 'index.js'));

describe.skipIf(!distBuilt)('dist/ native Node ESM resolution', () => {
	for (const entry of entries) {
		// Each case spawns a cold `node` process that loads (and ESM-resolves)
		// a real module graph; the root entry can exceed the default 5s timeout
		// on a cold start, so give the subprocess room.
		it(
			`resolves ${entry} under native ESM`,
			() => {
				const abs = resolve(distDir, entry);
				expect(existsSync(abs), `${abs} should exist (run npm run build)`).toBe(true);
				const url = pathToFileURL(abs).href;
				// Throws (non-zero exit) if Node's native resolver rejects the
				// module graph (e.g. ERR_UNSUPPORTED_DIR_IMPORT /
				// ERR_MODULE_NOT_FOUND from extensionless specifiers).
				const out = execFileSync(
					process.execPath,
					['--input-type=module', '-e', `await import(${JSON.stringify(url)}); console.log('ESM OK');`],
					{ encoding: 'utf8' },
				);
				expect(out).toContain('ESM OK');
			},
			30_000,
		);
	}
});
