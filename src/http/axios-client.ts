import axios, { isCancel } from 'axios';
import type { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
	AxiosClientOptions,
	WorkairAxiosInstance,
	WorkairRequestConfig,
	ApiErrorResponse,
} from './types';
import { logger } from '../legacy-logger';
import { requestStore } from './requestStore';
import { ForgeError } from '../errors/ForgeError';

type RefreshSubscriber = (token: string | null, error?: ForgeError) => void;

// Profile-picture URLs are exempted because the same employee can be rendered
// concurrently in multiple timeline rows / groups, and the abort-old/run-new
// dedup model would cancel all but the last <img> request — leaving the others
// broken. The timeline-per-group case (different groupID per call) is solved
// separately by including serialized params in the request ID, not by exempting
// the URL.
const DEDUP_EXEMPT_PATTERNS = ['profile-picture'];

function isDedupExempt(url: string | undefined): boolean {
	if (!url) return true;
	return DEDUP_EXEMPT_PATTERNS.some((p) => url.includes(p));
}

function serializeParams(params: unknown): string {
	if (!params || typeof params !== 'object') return '';
	// Stable serialization: sort keys so identical params produce the same string
	// regardless of insertion order.
	const entries = Object.entries(params as Record<string, unknown>)
		.filter(([, v]) => v !== undefined && v !== null)
		.sort(([a], [b]) => a.localeCompare(b));
	return entries.map(([k, v]) => `${k}=${String(v)}`).join('&');
}

function getRequestId(
	config: Pick<InternalAxiosRequestConfig, 'method' | 'url' | 'params'>,
): string {
	// Including serialized params is critical: axios stores query params on
	// `config.params` separately from `config.url`, so parallel requests like
	// `get('/wfm/timeline', { params: { groupID: 'A' } })` and the same call
	// with `groupID: 'B'` would collide on URL alone and the second would
	// cancel the first. Hashing params disambiguates them.
	const method = (config.method ?? 'get').toLowerCase();
	const params = serializeParams(config.params);
	return `${method}-${config.url ?? ''}${params ? `?${params}` : ''}`;
}

/**
 * Create a configured Axios instance with common interceptors.
 *
 * Features:
 * - Automatic auth token injection
 * - 401 error handling with token refresh queue (concurrent 401s trigger one refresh)
 * - Request deduplication via AbortController (duplicate in-flight requests are cancelled)
 * - Request/response logging (in development)
 * - Timeout configuration
 *
 * @example
 * ```ts
 * const client = createAxiosClient({
 *   baseURL: 'http://localhost:8080',
 *   getAuthToken: () => getIdToken(), // Firebase Auth — see apps/web/src/app/core/auth/firebase.ts
 *   onAuthError: () => signOut(),
 * })
 * ```
 */
// Check if we're in development mode (Vite sets import.meta.env.DEV)
const isDev =
	typeof import.meta !== 'undefined' &&
	(import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;

export function createAxiosClient(options: AxiosClientOptions): WorkairAxiosInstance {
	const {
		baseURL,
		timeout = 30000,
		getAuthToken,
		getTenantId,
		getLocale,
		onAuthError,
		onForbiddenError,
		enableLogging = isDev,
	} = options;

	let authTokenGetter = getAuthToken;

	// Token refresh queue state — scoped per client instance
	let isRefreshing = false;
	let refreshSubscribers: RefreshSubscriber[] = [];

	function subscribeTokenRefresh(cb: RefreshSubscriber) {
		refreshSubscribers.push(cb);
	}

	function notifySubscribers(token: string) {
		const subs = refreshSubscribers;
		refreshSubscribers = [];
		subs.forEach((cb) => cb(token));
	}

	function failSubscribers(err: ForgeError) {
		const subs = refreshSubscribers;
		refreshSubscribers = [];
		subs.forEach((cb) => cb(null, err));
	}

	const instance = axios.create({
		baseURL,
		timeout,
		headers: {
			'Content-Type': 'application/json',
		},
	}) as WorkairAxiosInstance;

	// Add method to update auth token getter
	instance.setAuthTokenGetter = (getter: () => string | null) => {
		authTokenGetter = getter;
	};

	// Request interceptor: Add auth token + request deduplication
	instance.interceptors.request.use(
		(config: InternalAxiosRequestConfig & WorkairRequestConfig) => {
			// Skip auth if explicitly requested
			if (config.skipAuth) {
				return config;
			}

			// Add auth token if available
			const token = authTokenGetter?.();
			if (token) {
				config.headers.Authorization = `Bearer ${token}`;
			}

			// Add tenant ID header if available
			const tenantId = getTenantId?.();
			if (tenantId) {
				config.headers['X-Tenant-ID'] = tenantId;
			}

			// Add locale header if available
			const locale = getLocale?.();
			if (locale) {
				config.headers['X-Locale'] = locale;
			}

			// Request deduplication via AbortController.
			// Identical concurrent requests cancel any earlier in-flight one (last-call wins).
			// Skipped when the caller passed an explicit signal, or for exempt URLs
			// (see DEDUP_EXEMPT_PATTERNS — currently only profile-picture, where
			// multiple consumers of the same image must each get a successful response).
			if (!config.signal && !isDedupExempt(config.url)) {
				const controller = requestStore.create(getRequestId(config));
				config.signal = controller.signal;
			}

			// Log request in development
			if (enableLogging) {
				logger.debug(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`);
			}

			return config;
		},
		(error: AxiosError) => {
			logger.error('[HTTP] Request error:', error.message);
			return Promise.reject(error);
		},
	);

	// Response interceptor: Handle errors, logging, and token refresh queue
	instance.interceptors.response.use(
		(response) => {
			// Clean up request from dedup store
			if (!isDedupExempt(response.config.url)) {
				requestStore.remove(getRequestId(response.config));
			}

			// Log successful response in development
			if (enableLogging) {
				logger.debug(`[HTTP] ${response.status} ${response.config.url}`);
			}

			return response;
		},
		async (error: AxiosError<ApiErrorResponse>) => {
			const status = error.response?.status;

			// Clean up request from dedup store
			if (error.config && !isDedupExempt(error.config.url)) {
				requestStore.remove(getRequestId(error.config));
			}

			// Cancelled requests (router navigation, dedup) are expected — don't
			// pollute the console. Just propagate so callers can handle the rejection.
			if (isCancel(error)) {
				return Promise.reject(error);
			}

			// Log error
			if (enableLogging) {
				logger.warn(`[HTTP] ${status ?? 'Network'} Error: ${error.config?.url}`, error.message);
			}

			// Handle 401 Unauthorized with token refresh queue
			if (status === 401 && error.config) {
				const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

				if (!originalRequest._retry) {
					originalRequest._retry = true;

					if (!isRefreshing) {
						// First 401 — trigger token refresh
						isRefreshing = true;
						try {
							await onAuthError?.();
							const newToken = authTokenGetter?.() ?? '';
							if (!newToken) {
								const refreshErr = new ForgeError({
									code: 'UNAUTHORIZED',
									status: 401,
									message: 'Token refresh produced no token',
									cause: error,
								});
								failSubscribers(refreshErr);
								return Promise.reject(refreshErr);
							}
							originalRequest.headers.Authorization = `Bearer ${newToken}`;
							notifySubscribers(newToken);
							return instance(originalRequest);
						} catch (refreshErr) {
							const wrapped =
								refreshErr instanceof ForgeError
									? refreshErr
									: new ForgeError({
											code: 'UNAUTHORIZED',
											status: 401,
											message: 'Token refresh failed',
											cause: refreshErr,
										});
							failSubscribers(wrapped);
							return Promise.reject(wrapped);
						} finally {
							isRefreshing = false;
						}
					} else {
						// Another refresh is already in-flight — queue this request
						return new Promise((resolve, reject) => {
							subscribeTokenRefresh((token, refreshErr) => {
								if (token) {
									originalRequest.headers.Authorization = `Bearer ${token}`;
									resolve(instance(originalRequest));
								} else {
									reject(refreshErr ?? error);
								}
							});
						});
					}
				}
			}

			// Handle 403 Forbidden
			if (status === 403) {
				logger.warn('[HTTP] 403 Forbidden');
				onForbiddenError?.();
			}

			return Promise.reject(error);
		},
	);

	return instance;
}
