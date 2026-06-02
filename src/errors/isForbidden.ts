import { ForgeError } from './ForgeError.js';

/**
 * True when the error represents a backend 403 — operational permission
 * denied. Consumers check this in their service result handlers to render
 * an inline `<ForbiddenState>` in the affected section, instead of letting
 * the failure bubble up as a generic toast or a full-page redirect.
 *
 * ```ts
 * const [data, err] = await service.getX()
 * if (err) {
 *   if (isForbidden(err)) { sectionForbidden.value = true; return }
 *   toast.error(err.message)
 *   return
 * }
 * ```
 */
export function isForbidden(error: unknown): boolean {
	if (error instanceof ForgeError) return error.status === 403;
	if (typeof error === 'object' && error !== null && 'status' in error) {
		return (error as { status?: number }).status === 403;
	}
	return false;
}
