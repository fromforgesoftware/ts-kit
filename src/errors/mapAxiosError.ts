import { ForgeError } from './ForgeError';
import { ValidationError } from './ValidationError';
import type { ErrorCode } from './types';

interface AxiosErrorLike {
	isAxiosError?: boolean;
	code?: string;
	response?: {
		status?: number;
		data?: {
			error?: { message?: string };
			errors?: Record<string, string>;
			metadata?: { operationID?: string };
		};
	};
	config?: { url?: string };
	message: string;
}

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

/**
 * Maps Axios errors to ForgeError instances. Server-provided message
 * keys are passed through as-is on userMessage; the consumer is
 * responsible for any presentation/translation at display time.
 * Use in infrastructure/repositories to convert API errors.
 */
export function mapAxiosError(error: unknown): ForgeError {
	// Handle cancellation
	if (isAxiosError(error) && error.code === 'ERR_CANCELED') {
		return new ForgeError({
			code: 'UNKNOWN_ERROR',
			message: 'Request was cancelled',
			userMessage: '', // Empty = don't show notification
			cause: error,
			meta: { cancelled: true },
		});
	}

	// Handle Axios errors
	if (isAxiosError(error)) {
		const status = error.response?.status;
		const code: ErrorCode = (status !== undefined && STATUS_TO_CODE[status]) || 'NETWORK_ERROR';
		// Server may return a message key in error.message; pass it through
		// unchanged on userMessage for the consumer to render.
		const serverMessage = error.response?.data?.error?.message;
		const operationId = error.response?.data?.metadata?.operationID;

		return new ForgeError({
			code,
			message: serverMessage ?? error.message, // Technical message for logs
			userMessage: serverMessage, // Server-provided key, undefined → default
			status,
			cause: error,
			meta: {
				url: error.config?.url,
				...(operationId && { operationId }),
			},
		});
	}

	// Handle generic errors
	if (error instanceof Error) {
		return new ForgeError({
			code: 'UNKNOWN_ERROR',
			message: error.message,
			cause: error,
		});
	}

	// Handle unknown
	return new ForgeError({
		code: 'UNKNOWN_ERROR',
		message: String(error),
		cause: error,
	});
}

/**
 * Extract validation errors from Axios error response.
 * Use when you need field-level errors for forms.
 */
export function extractValidationErrors<T extends object>(error: unknown): ValidationError<T> {
	if (isAxiosError(error) && error.response?.data) {
		return ValidationError.fromApiResponse<T>(error.response.data);
	}
	return new ValidationError<T>();
}

function isAxiosError(error: unknown): error is AxiosErrorLike {
	return (
		typeof error === 'object' && error !== null && ('isAxiosError' in error || 'response' in error)
	);
}
