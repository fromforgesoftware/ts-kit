/**
 * Result tuple: [data, error]
 *
 * Encodes success/failure in the return type instead of try/catch.
 * Error-first check, early return, happy path continues.
 *
 * @example
 * ```ts
 * const [user, error] = await getUser('123')
 * if (error) return showError(error)
 *
 * console.log(user.name)
 * ```
 */

import { ForgeError } from '../errors/ForgeError';
import { logger } from '../legacy-logger';

/** Success: [data, null] — Error: [null, error] */
export type Result<T, E = ForgeError> = [T, null] | [null, E];

/** Async version for service methods */
export type AsyncResult<T, E = ForgeError> = Promise<Result<T, E>>;

/** Create a success result */
export function ok<T>(data: T): Result<T, never> {
	return [data, null];
}

/** Create an error result */
export function err<E = ForgeError>(error: E): Result<never, E> {
	return [null, error];
}

/**
 * Global error notification callback.
 * Set via `configureTryCatch` at app startup to wire in toast notifications.
 */
let globalErrorNotifier: ((error: ForgeError) => void) | null = null;

/**
 * Configure the global error notifier for tryCatch.
 * Call once at app startup with the toast function.
 *
 * @example
 * ```ts
 * import { configureTryCatch } from '@fromforgesoftware/ts-kit'
 * import { toast } from '@fromforgesoftware/vue-kit'
 *
 * configureTryCatch({ onError: (err) => toast.error(err.message) })
 * ```
 */
export function configureTryCatch(options: { onError: (error: ForgeError) => void }) {
	globalErrorNotifier = options.onError;
}

/**
 * Wrap an async function into a Result tuple.
 * Converts any thrown error into a ForgeError automatically.
 * Shows a toast notification via the global error notifier (if configured).
 *
 * @example
 * ```ts
 * const [user, error] = await tryCatch(() => repo.getUser(id))
 * if (error) return // error already shown as toast
 * ```
 */
export async function tryCatch<T>(fn: () => Promise<T>): AsyncResult<T> {
	try {
		const data = await fn();
		return ok(data);
	} catch (error) {
		const forgeError =
			error instanceof ForgeError
				? error
				: new ForgeError({
						code: 'UNKNOWN_ERROR',
						message: error instanceof Error ? error.message : String(error),
						cause: error,
					});

		// Cancelled requests (router navigation, dedup) are expected — propagate
		// them silently so callers can early-return without touching the toast or
		// logger pipeline.
		const cancelled = forgeError.meta?.cancelled === true;
		if (!cancelled) {
			logger.error(`[tryCatch] ${forgeError.code}: ${forgeError.message}`);
			if (globalErrorNotifier) {
				globalErrorNotifier(forgeError);
			}
		}

		return err(forgeError);
	}
}
