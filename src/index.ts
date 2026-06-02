// Flat re-exports — backwards-compatible with the symbols formerly
// exposed via @fromforgesoftware/shared, @fromforgesoftware/ts-jsonapi,
// and @fromforgesoftware/ts-i18n. Consumers can also cherry-pick via
// subpath imports (./jsonapi, ./i18n, ./date, …) — see package.json.

export * from './date';
export * from './errors';
export * from './types';
export * from './enums';
export * from './number';
export * from './http';
export * from './features';
export * from './storage';
export * from './i18n';
export * from './jsonapi';

// Namespaced — both legacy-logger and log expose `LogLevel`/`Logger`
// with different shapes. Use `legacyLogger.X` or `log.X` to disambiguate.
export * as legacyLogger from './legacy-logger';
export * as log from './log';
export * as reactive from './reactive';
export * as resourceState from './resource-state';
export * as jsonapiClient from './jsonapi-client';
