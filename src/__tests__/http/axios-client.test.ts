import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios';
import { createAxiosClient } from '../../http/index.js';
import { ForgeError } from '../../errors/index.js';
import { logger, LogLevel } from '../../legacy-logger/index.js';

// A controllable mock adapter. By default it resolves 200; tests can override
// `responder` to simulate specific statuses / sequences.
interface MockResult {
	status: number;
	data?: unknown;
}

function buildClient(opts: {
	responder: (config: InternalAxiosRequestConfig) => MockResult | Promise<MockResult>;
	clientOptions?: Partial<Parameters<typeof createAxiosClient>[0]>;
}) {
	const seenConfigs: InternalAxiosRequestConfig[] = [];
	const client = createAxiosClient({
		baseURL: 'https://api.test',
		enableLogging: false,
		...opts.clientOptions,
	} as Parameters<typeof createAxiosClient>[0]);

	const adapter: AxiosAdapter = async (config) => {
		seenConfigs.push(config);
		const result = await opts.responder(config);
		const response = {
			data: result.data,
			status: result.status,
			statusText: String(result.status),
			headers: {},
			config,
		};
		if (result.status >= 400) {
			const err = new Error(`Request failed with status code ${result.status}`) as Error & {
				isAxiosError: boolean;
				config: InternalAxiosRequestConfig;
				response: typeof response;
			};
			err.isAxiosError = true;
			err.config = config;
			err.response = response;
			return Promise.reject(err);
		}
		return response;
	};
	client.defaults.adapter = adapter;
	return { client, seenConfigs };
}

afterEach(() => {
	vi.restoreAllMocks();
});

describe('createAxiosClient request interceptor', () => {
	it('injects the Authorization header from getAuthToken', async () => {
		const { client, seenConfigs } = buildClient({
			responder: () => ({ status: 200, data: {} }),
			clientOptions: { getAuthToken: () => 'tok-123' },
		});
		await client.get('/me');
		expect(seenConfigs[0].headers.Authorization).toBe('Bearer tok-123');
	});

	it('skips auth when skipAuth is set', async () => {
		const { client, seenConfigs } = buildClient({
			responder: () => ({ status: 200 }),
			clientOptions: { getAuthToken: () => 'tok' },
		});
		await client.get('/public', { skipAuth: true } as never);
		expect(seenConfigs[0].headers.Authorization).toBeUndefined();
	});

	it('adds tenant and locale headers when provided', async () => {
		const { client, seenConfigs } = buildClient({
			responder: () => ({ status: 200 }),
			clientOptions: { getTenantId: () => 'tnt', getLocale: () => 'es-ES' },
		});
		await client.get('/x');
		expect(seenConfigs[0].headers['X-Tenant-ID']).toBe('tnt');
		expect(seenConfigs[0].headers['X-Locale']).toBe('es-ES');
	});

	it('attaches an abort signal for dedup-eligible requests', async () => {
		const { client, seenConfigs } = buildClient({ responder: () => ({ status: 200 }) });
		await client.get('/things');
		expect(seenConfigs[0].signal).toBeDefined();
	});

	it('does not attach a dedup signal for exempt urls (profile-picture)', async () => {
		const { client, seenConfigs } = buildClient({ responder: () => ({ status: 200 }) });
		await client.get('/users/1/profile-picture');
		expect(seenConfigs[0].signal).toBeUndefined();
	});

	it('setAuthTokenGetter swaps the token source', async () => {
		const { client, seenConfigs } = buildClient({
			responder: () => ({ status: 200 }),
			clientOptions: { getAuthToken: () => 'old' },
		});
		client.setAuthTokenGetter(() => 'new');
		await client.get('/x');
		expect(seenConfigs[0].headers.Authorization).toBe('Bearer new');
	});
});

describe('createAxiosClient 401 handling', () => {
	it('refreshes the token then retries the original request', async () => {
		let token = 'expired';
		let callCount = 0;
		const onAuthError = vi.fn(async () => {
			token = 'fresh';
		});
		const { client, seenConfigs } = buildClient({
			responder: () => {
				callCount += 1;
				return callCount === 1 ? { status: 401 } : { status: 200, data: { ok: true } };
			},
			clientOptions: { getAuthToken: () => token, onAuthError },
		});

		const res = await client.get('/secure');
		expect(onAuthError).toHaveBeenCalledTimes(1);
		expect(res.status).toBe(200);
		// retried request carries the refreshed token
		expect(seenConfigs[seenConfigs.length - 1].headers.Authorization).toBe('Bearer fresh');
	});

	it('rejects with an UNAUTHORIZED ForgeError when refresh yields no token', async () => {
		const onAuthError = vi.fn(async () => undefined);
		const { client } = buildClient({
			responder: () => ({ status: 401 }),
			clientOptions: { getAuthToken: () => '', onAuthError },
		});
		await expect(client.get('/secure')).rejects.toMatchObject({
			code: 'UNAUTHORIZED',
			status: 401,
		});
	});

	it('wraps a thrown refresh failure into a ForgeError', async () => {
		const onAuthError = vi.fn(async () => {
			throw new Error('refresh down');
		});
		const { client } = buildClient({
			responder: () => ({ status: 401 }),
			clientOptions: { getAuthToken: () => 'x', onAuthError },
		});
		const rejection = await client.get('/secure').catch((e) => e);
		expect(rejection).toBeInstanceOf(ForgeError);
		expect(rejection.code).toBe('UNAUTHORIZED');
	});
});

describe('createAxiosClient 403 handling', () => {
	it('invokes onForbiddenError and rejects', async () => {
		const onForbiddenError = vi.fn();
		const { client } = buildClient({
			responder: () => ({ status: 403 }),
			clientOptions: { onForbiddenError },
		});
		await expect(client.get('/admin')).rejects.toBeTruthy();
		expect(onForbiddenError).toHaveBeenCalledTimes(1);
	});
});

describe('createAxiosClient logging toggle', () => {
	let debugSpy: ReturnType<typeof vi.spyOn>;
	let priorLevel: LogLevel;
	beforeEach(() => {
		// The HTTP client logs via the shared singleton logger at debug level,
		// which is filtered out below DEBUG. Raise it for this assertion.
		priorLevel = logger.getLevel();
		logger.setLevel(LogLevel.DEBUG);
		debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
		vi.spyOn(console, 'info').mockImplementation(() => undefined);
	});

	afterEach(() => {
		logger.setLevel(priorLevel);
	});

	it('logs request/response when enableLogging is true', async () => {
		const { client } = buildClient({
			responder: () => ({ status: 200 }),
			clientOptions: { enableLogging: true },
		});
		await client.get('/logged');
		expect(debugSpy).toHaveBeenCalled();
	});
});
