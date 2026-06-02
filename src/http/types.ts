import type { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

/**
 * Options for creating an Axios client.
 */
export interface AxiosClientOptions {
	/**
	 * Base URL for all requests.
	 */
	baseURL: string;

	/**
	 * Request timeout in milliseconds.
	 * @default 30000
	 */
	timeout?: number;

	/**
	 * Function to get the current auth token.
	 * Called on each request to add Authorization header.
	 */
	getAuthToken?: () => string | null;

	/**
	 * Callback when an authentication error (401) occurs.
	 * Use this to trigger token refresh or logout.
	 */
	onAuthError?: () => void | Promise<void>;

	/**
	 * Callback when a forbidden error (403) occurs.
	 */
	onForbiddenError?: () => void;

	/**
	 * Function to get the current tenant ID.
	 * Called on each request to add X-Tenant-ID header.
	 */
	getTenantId?: () => string | null;

	/**
	 * Function to get the current locale.
	 * Called on each request to add X-Locale header.
	 */
	getLocale?: () => string | null;

	/**
	 * Whether to log requests and responses.
	 * @default true in development
	 */
	enableLogging?: boolean;
}

/**
 * Extended Axios instance with additional utilities.
 */
export interface WorkairAxiosInstance extends AxiosInstance {
	/**
	 * Set a new auth token getter.
	 */
	setAuthTokenGetter: (getter: () => string | null) => void;
}

/**
 * Request config with additional metadata.
 */
export interface WorkairRequestConfig extends AxiosRequestConfig {
	/**
	 * Skip authentication header for this request.
	 */
	skipAuth?: boolean;

	/**
	 * Custom retry count.
	 */
	retryCount?: number;
}

/**
 * Axios error response shape from our API.
 */
export interface ApiErrorResponse {
	error?: {
		message?: string;
		code?: string;
	};
	metadata?: {
		operationID?: string;
	};
	errors?: Record<string, string>;
}

export type { AxiosInstance, AxiosRequestConfig, AxiosResponse };
