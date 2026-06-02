/**
 * Global error handler.
 *
 * Handles errors by logging, showing toast notifications, and optionally
 * propagating to a callback for custom view-level handling.
 *
 * Works with ForgeError (structured) and plain Error (unstructured).
 *
 * @example
 * ```ts
 * // In main.ts — install as Vue error handler
 * import { createErrorHandler } from '@fromforgesoftware/ts-kit'
 * import { toast } from '@fromforgesoftware/vue-kit'
 *
 * const errorHandler = createErrorHandler({ toast: toast.error })
 * app.config.errorHandler = errorHandler.handleError
 *
 * // In a composable or component — with custom callback
 * const { handleError } = createErrorHandler({
 *   toast: toast.error,
 *   onError: (info) => {
 *     errorMessage.value = info.userMessage
 *   },
 * })
 *
 * try {
 *   await doSomething()
 * } catch (error) {
 *   handleError(error)
 * }
 * ```
 */

import { ForgeError } from './ForgeError.js';
import { logger } from '../legacy-logger/index.js';

export interface ErrorInfo {
	/** Error code (e.g., 'NOT_FOUND', 'FORBIDDEN') */
	code: string;
	/** HTTP status code if available */
	status?: number;
	/** Technical message for logs */
	message: string;
	/** User-facing message safe for UI */
	userMessage: string;
	/** Whether the operation can be retried */
	retryable: boolean;
	/** Original error instance */
	original: unknown;
}

export interface ErrorHandlerOptions {
	/** Function to show toast notifications. Pass `toast.error` from @fromforgesoftware/vue-kit. */
	toast?: (message: string) => void;
	/** Callback for custom error handling (e.g., setting error state in a component). */
	onError?: (info: ErrorInfo) => void;
	/** Whether to show toast notifications. Default: true. */
	showToast?: boolean;
	/** Whether to log errors. Default: true. */
	log?: boolean;
}

const STATUS_MESSAGES: Record<number, string> = {
	400: 'Bad request.',
	401: 'You are unauthorized to do this action.',
	403: "You don't have permission to access this resource.",
	404: 'The requested resource does not exist.',
	408: 'Request timed out. Please try again.',
	409: 'A conflict occurred. Please refresh and try again.',
	412: 'Precondition failed.',
	422: 'The provided data is invalid.',
	429: 'Too many requests. Please wait and try again.',
	500: 'Internal server error.',
	502: 'Bad gateway. The server is temporarily unavailable.',
	503: 'The service is temporarily unavailable.',
	504: 'Gateway timeout. Please try again.',
};

function toErrorInfo(error: unknown): ErrorInfo {
	if (error instanceof ForgeError) {
		return {
			code: error.code,
			status: error.status,
			message: error.message,
			userMessage:
				error.userMessage || STATUS_MESSAGES[error.status ?? 0] || 'Something went wrong.',
			retryable: error.retryable,
			original: error,
		};
	}

	if (error instanceof Error) {
		return {
			code: 'UNKNOWN_ERROR',
			message: error.message,
			userMessage: 'Something went wrong.',
			retryable: false,
			original: error,
		};
	}

	return {
		code: 'UNKNOWN_ERROR',
		message: String(error),
		userMessage: 'Something went wrong.',
		retryable: false,
		original: error,
	};
}

export function createErrorHandler(options: ErrorHandlerOptions = {}) {
	const { toast, onError, showToast = true, log = true } = options;

	function handleError(error: unknown): ErrorInfo {
		const info = toErrorInfo(error);

		if (log) {
			logger.error(
				`[${info.code}]${info.status ? ` ${info.status}` : ''}: ${info.message}`,
				info.original,
			);
		}

		if (showToast && toast) {
			toast(info.userMessage);
		}

		if (onError) {
			onError(info);
		}

		return info;
	}

	return { handleError, toErrorInfo };
}

/** Convert any error to ErrorInfo without side effects. */
export { toErrorInfo };
