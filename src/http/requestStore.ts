/**
 * Global request tracking store.
 *
 * Registers AbortControllers for active requests and cancels them on demand
 * (e.g., on route navigation). Uses AbortController instead of the deprecated
 * Axios CancelToken API.
 *
 * @example
 * ```ts
 * // In an HTTP interceptor — register each request
 * const controller = requestStore.create(requestId)
 * config.signal = controller.signal
 *
 * // In router beforeEach — cancel all pending requests
 * requestStore.cancelAll()
 *
 * // In response interceptor — clean up completed requests
 * requestStore.remove(requestId)
 * ```
 */

const activeRequests = new Map<string, AbortController>();

export const requestStore = {
	/**
	 * Create and register an AbortController for a request.
	 * If a request with the same ID already exists, it's cancelled first.
	 */
	create(requestId: string): AbortController {
		const existing = activeRequests.get(requestId);
		if (existing) {
			existing.abort();
		}

		const controller = new AbortController();
		activeRequests.set(requestId, controller);
		return controller;
	},

	/**
	 * Remove a completed request from tracking.
	 */
	remove(requestId: string): void {
		activeRequests.delete(requestId);
	},

	/**
	 * Cancel a specific request by ID.
	 */
	cancel(requestId: string): void {
		const controller = activeRequests.get(requestId);
		if (controller) {
			controller.abort();
			activeRequests.delete(requestId);
		}
	},

	/**
	 * Cancel all active requests. Called on route navigation.
	 */
	cancelAll(): void {
		for (const [, controller] of activeRequests) {
			controller.abort();
		}
		activeRequests.clear();
	},

	/**
	 * Number of active requests (useful for loading indicators).
	 */
	get size(): number {
		return activeRequests.size;
	},
};
