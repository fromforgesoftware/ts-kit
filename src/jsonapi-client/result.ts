import { ApiError, NetworkError } from './errors.js';

export type ApiResult<T> =
	| { data: T; error: null }
	| { data: null; error: ApiError | NetworkError };

/**
 * Convert a throwing API promise into a tagged-union result, for callers that
 * prefer a workair-style `{ data, error }` flow over try/catch.
 */
export async function apiResult<T>(promise: Promise<T>): Promise<ApiResult<T>> {
	try {
		return { data: await promise, error: null };
	} catch (e) {
		if (e instanceof ApiError || e instanceof NetworkError) {
			return { data: null, error: e };
		}
		throw e;
	}
}
