import { ForgeDate } from './ForgeDate.js';

/**
 * Deep-clone a form-state value, preserving `ForgeDate` instances. Use as the
 * `clone` option to `useFormGuard` for forms that bind `ForgeDate` directly
 * (e.g. `<DatePicker v-model="form.startsAt">`). Plain objects, arrays, and
 * primitives are recursed through structurally; everything else (including
 * functions and unknown class instances) is returned as-is.
 */
export function cloneFormStateWithForgeDate<T>(value: T): T {
	if (value === null || value === undefined) return value;
	if (value instanceof ForgeDate) return new ForgeDate(value.toISO()) as unknown as T;
	if (Array.isArray(value)) {
		return value.map(cloneFormStateWithForgeDate) as unknown as T;
	}
	if (typeof value === 'object') {
		const out: Record<string, unknown> = {};
		for (const key of Object.keys(value as Record<string, unknown>)) {
			out[key] = cloneFormStateWithForgeDate((value as Record<string, unknown>)[key]);
		}
		return out as T;
	}
	return value;
}

/**
 * Stable serializer for form state holding `ForgeDate` instances — replaces
 * `ForgeDate` with its ISO string before `JSON.stringify` so the comparison
 * detects date changes rather than identity of the wrapper.
 */
export function serializeFormStateWithForgeDate<T>(value: T): string {
	return JSON.stringify(value, (_key, val) => {
		if (val instanceof ForgeDate) return val.toISO();
		return val;
	});
}
