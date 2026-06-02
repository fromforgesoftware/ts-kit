import { jsonapiError, type IError } from '../jsonapi/index.js';

export type JsonApiError = IError;

/**
 * Thrown when the server responds with a non-2xx status. Carries the parsed
 * JSON:API errors[] array so callers can branch on status / code / pointer.
 */
export class ApiError extends Error {
	readonly status: number;
	readonly errors: JsonApiError[];

	constructor(status: number, errors: JsonApiError[], message?: string) {
		super(message ?? errors[0]?.Detail() ?? errors[0]?.Title() ?? `HTTP ${status}`);
		this.name = 'ApiError';
		this.status = status;
		this.errors = errors;
	}

	isUnauthorized(): boolean {
		return this.status === 401;
	}

	isForbidden(): boolean {
		return this.status === 403;
	}

	isNotFound(): boolean {
		return this.status === 404;
	}

	isConflict(): boolean {
		return this.status === 409;
	}

	isValidation(): boolean {
		if (this.status === 422 || this.status === 400) return true;
		return this.errors.some((e) => e.Source()?.Pointer() !== undefined);
	}

	isServerError(): boolean {
		return this.status >= 500;
	}

	/**
	 * Group errors by `source.pointer` for direct binding to form fields.
	 * Pointer `/data/attributes/name` → key `name`.
	 */
	fieldErrors(): Record<string, string[]> {
		const out: Record<string, string[]> = {};
		for (const e of this.errors) {
			const ptr = e.Source()?.Pointer();
			if (!ptr) continue;
			const field = ptr.split('/').filter(Boolean).pop();
			if (!field) continue;
			const msg = e.Detail() ?? e.Title() ?? e.Code() ?? 'invalid';
			(out[field] ??= []).push(msg);
		}
		return out;
	}
}

/** Thrown when the network call itself fails (DNS, abort, offline, …). */
export class NetworkError extends Error {
	readonly cause?: unknown;
	constructor(message: string, cause?: unknown) {
		super(message);
		this.name = 'NetworkError';
		this.cause = cause;
	}
}

/** Decode a raw JSON:API error response body into typed JsonApiError[]. */
export function parseJsonApiErrors(body: unknown): JsonApiError[] {
	if (!body || typeof body !== 'object') return [];
	const rawErrors = (body as { errors?: unknown }).errors;
	if (!Array.isArray(rawErrors)) return [];
	return rawErrors.map((raw) => new jsonapiError(raw as Record<string, unknown>));
}
