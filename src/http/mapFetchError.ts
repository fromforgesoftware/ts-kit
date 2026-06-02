/**
 * Maps fetch errors to ForgeError instances.
 * Use in repositories that call APIs via fetch instead of Axios.
 */

import { ForgeError } from '../errors/ForgeError.js';
import type { ErrorCode } from '../errors/types.js';

const STATUS_TO_CODE: Record<number, ErrorCode> = {
	400: 'VALIDATION_ERROR',
	401: 'UNAUTHORIZED',
	403: 'FORBIDDEN',
	404: 'NOT_FOUND',
	409: 'CONFLICT',
	422: 'VALIDATION_ERROR',
	500: 'SERVER_ERROR',
	502: 'SERVER_ERROR',
	503: 'SERVER_ERROR',
};

export function mapFetchError(error: unknown, context: string): ForgeError {
	if (error instanceof ForgeError) return error;

	return new ForgeError({
		code: 'NETWORK_ERROR',
		message: `${context}: ${error instanceof Error ? error.message : String(error)}`,
		cause: error,
	});
}

export function mapResponseError(response: Response, context: string): ForgeError {
	const code = STATUS_TO_CODE[response.status] ?? 'UNKNOWN_ERROR';
	return new ForgeError({
		code,
		message: `${context}: ${response.status} ${response.statusText}`,
		status: response.status,
		meta: { url: response.url },
	});
}
