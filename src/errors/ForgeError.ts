import type { ErrorCode, ForgeErrorOptions } from './types';

/**
 * Default user-facing messages for each error code.
 */
export const DEFAULT_ERROR_KEYS: Record<ErrorCode, string> = {
	NETWORK_ERROR: 'Network error. Please check your connection.',
	UNAUTHORIZED: 'You are not authorized.',
	FORBIDDEN: 'You do not have permission to perform this action.',
	NOT_FOUND: 'The requested resource was not found.',
	VALIDATION_ERROR: 'Validation error.',
	CONFLICT: 'A conflict occurred.',
	SERVER_ERROR: 'An internal error occurred.',
	UNKNOWN_ERROR: 'An internal error occurred.',
};

/**
 * Error monitoring hook type for integrating with Sentry, Rollbar, etc.
 */
export type ErrorMonitorHook = (error: ForgeError) => void;
let errorMonitorHook: ErrorMonitorHook | null = null;

/**
 * Set a global error monitor hook that gets called for every ForgeError created.
 * Use this to integrate with error monitoring services like Sentry.
 *
 * @example
 * ```ts
 * import * as Sentry from '@sentry/browser'
 * setErrorMonitorHook((error) => {
 *   Sentry.captureException(error, {
 *     tags: { errorCode: error.code },
 *     extra: error.toJSON()
 *   })
 * })
 * ```
 */
export function setErrorMonitorHook(hook: ErrorMonitorHook | null): void {
	errorMonitorHook = hook;
}

export class ForgeError extends Error {
	readonly code: ErrorCode;
	readonly userMessage: string;
	readonly userMessageKey: string;
	readonly cause: unknown;
	readonly meta: Record<string, unknown>;
	readonly status?: number;
	readonly retryable: boolean;
	readonly timestamp: number;

	constructor(options: ForgeErrorOptions) {
		super(options.message);
		this.name = 'ForgeError';

		// CRITICAL: Fix prototype chain for instanceof checks (ES5 transpilation)
		Object.setPrototypeOf(this, ForgeError.prototype);

		this.code = options.code;
		this.timestamp = Date.now();

		// Store the original key for reference (debugging/logging)
		this.userMessageKey = options.userMessage ?? DEFAULT_ERROR_KEYS[options.code];

		this.userMessage = this.userMessageKey;

		this.cause = options.cause;
		this.meta = options.meta ?? {};
		this.status = options.status;
		this.retryable = options.retryable ?? this.isRetryableByDefault();

		// Capture stack trace properly (V8 only, not available in all environments)
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, ForgeError);
		}

		// Call error monitor hook if set (Sentry, etc.)
		if (errorMonitorHook) {
			errorMonitorHook(this);
		}
	}

	private isRetryableByDefault(): boolean {
		return this.code === 'NETWORK_ERROR' || this.code === 'SERVER_ERROR';
	}

	/** Type guard for error code matching */
	isType(code: ErrorCode): boolean {
		return this.code === code;
	}

	/** Check if this is a client error (4xx) */
	isClientError(): boolean {
		return this.status !== undefined && this.status >= 400 && this.status < 500;
	}

	/** Check if this is a server error (5xx) */
	isServerError(): boolean {
		return this.status !== undefined && this.status >= 500;
	}

	/** Create a copy with additional context */
	withMeta(additionalMeta: Record<string, unknown>): ForgeError {
		return new ForgeError({
			code: this.code,
			message: this.message,
			userMessage: this.userMessageKey, // Pass the key, not translated message
			cause: this.cause,
			meta: { ...this.meta, ...additionalMeta },
			status: this.status,
			retryable: this.retryable,
		});
	}

	/** Serialize for logging/tracking */
	toJSON(): Record<string, unknown> {
		return {
			name: this.name,
			code: this.code,
			message: this.message,
			userMessage: this.userMessage,
			userMessageKey: this.userMessageKey,
			status: this.status,
			meta: this.meta,
			retryable: this.retryable,
			timestamp: this.timestamp,
			timestampISO: new Date(this.timestamp).toISOString(),
		};
	}
}
