/**
 * Error code constants for type-safe error handling.
 */
export const ErrorCodes = {
	NETWORK_ERROR: 'NETWORK_ERROR',
	UNAUTHORIZED: 'UNAUTHORIZED',
	FORBIDDEN: 'FORBIDDEN',
	NOT_FOUND: 'NOT_FOUND',
	VALIDATION_ERROR: 'VALIDATION_ERROR',
	CONFLICT: 'CONFLICT',
	SERVER_ERROR: 'SERVER_ERROR',
	UNKNOWN_ERROR: 'UNKNOWN_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

export interface ForgeErrorOptions {
	code: ErrorCode;
	message: string; // Technical message (logs, debugging)
	userMessage?: string; // Safe for UI display
	cause?: unknown; // Original error for debugging
	meta?: Record<string, unknown>; // Extra context (IDs, field names)
	status?: number; // HTTP status code
	retryable?: boolean; // Can this operation be retried?
}
