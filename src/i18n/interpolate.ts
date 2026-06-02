const PLACEHOLDER = /\{\{(\w+)\}\}/g;

/**
 * Replace `{{name}}` placeholders in `text` using `params`. Missing
 * keys are left untouched so they stay visible to the developer.
 *
 * Fast path: strings without `{{` are returned as-is — no regex
 * compilation, no allocation. The vast majority of UI strings don't
 * interpolate, so this skip is hit on most calls.
 */
export function interpolate(text: string, params: Record<string, string>): string {
	// String.prototype.indexOf is V8-optimised down to a simple memcmp;
	// avoiding `.includes` shaves a couple of nanoseconds and, more
	// importantly, avoids re-running the regex engine on inert strings.
	if (text.indexOf('{{') === -1) return text;
	return text.replace(PLACEHOLDER, (match, key) =>
		Object.prototype.hasOwnProperty.call(params, key) ? params[key] : match,
	);
}
