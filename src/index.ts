// Flat re-exports — backwards-compatible with the symbols formerly
// exposed via @fromforgesoftware/shared, @fromforgesoftware/ts-jsonapi,
// and @fromforgesoftware/ts-i18n. Consumers can also cherry-pick via
// subpath imports (./jsonapi, ./i18n, ./date, …) — see package.json.

export * from './date/index.js';
export * from './errors/index.js';
export * from './types/index.js';
export * from './enums/index.js';
export * from './number/index.js';
export * from './http/index.js';
export * from './features/index.js';
export * from './storage/index.js';
export * from './i18n/index.js';
export * from './jsonapi/index.js';

// Namespaced — both legacy-logger and log expose `LogLevel`/`Logger`
// with different shapes. Use `legacyLogger.X` or `log.X` to disambiguate.
export * as legacyLogger from './legacy-logger/index.js';
export * as log from './log/index.js';
export * as reactive from './reactive/index.js';
export * as resourceState from './resource-state/index.js';
export * as jsonapiClient from './jsonapi-client/index.js';
