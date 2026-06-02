import { interpolate } from './interpolate';
import { NAMESPACE_DELIMITER, type I18nConfig, type KeyValue, type Translation } from './types';

/**
 * Stateless translation engine. Safe to share between concurrent
 * requests in a server context.
 *
 * Internally each locale is held in two shapes:
 *   - the original nested tree, used by `getKeys` / `getKeyValues`
 *     which need subtree access;
 *   - a flattened `Map<fullKey, value>` built once at construction so
 *     `translate` and `hasTranslation` are a single map probe per
 *     locale tried — no string splitting, no tree walk.
 *
 * `mergeTranslations` rebuilds the flat map for the affected locale so
 * subsequent lookups see the merged result.
 */
export class I18n {
	private readonly config: I18nConfig;
	private readonly flat: Map<string, Map<string, string>>;

	constructor(config: I18nConfig) {
		this.config = {
			defaultLanguage: config.defaultLanguage,
			fallbackLanguage: config.fallbackLanguage,
			translations: { ...config.translations },
		};
		this.flat = new Map();
		for (const [locale, tree] of Object.entries(this.config.translations)) {
			this.flat.set(locale, flatten(tree));
		}
	}

	/**
	 * Resolve `key` for `locale`, falling back to the base language
	 * (e.g. `en` for `en_US`) and then the configured fallback. When
	 * no translation is found the key is returned unchanged.
	 */
	translate(locale: string, key: string, params?: Record<string, string>): string {
		let value = this.lookup(locale, key);
		if (value === undefined && locale !== this.config.fallbackLanguage) {
			value = this.lookup(this.config.fallbackLanguage, key);
		}
		if (value === undefined) value = key;
		return params ? interpolate(value, params) : value;
	}

	getDefaultLanguage(): string {
		return this.config.defaultLanguage;
	}

	getFallbackLanguage(): string {
		return this.config.fallbackLanguage;
	}

	getAvailableLanguages(): string[] {
		return Object.keys(this.config.translations).sort();
	}

	hasTranslation(locale: string, key: string): boolean {
		return this.lookup(locale, key) !== undefined;
	}

	/**
	 * Merge `legacyTranslations` into the loaded translations for a
	 * locale. Existing keys win — for layering an external source
	 * underneath the canonical set. Rebuilds the flat index for the
	 * affected locale.
	 *
	 * Note: this mutates internal state. Don't call it concurrently
	 * with `translate` from another async context.
	 */
	mergeTranslations(locale: string, legacyTranslations: Translation): void {
		const current = this.config.translations[locale] ?? {};
		const merged = deepMerge(legacyTranslations, current);
		this.config.translations[locale] = merged;
		this.flat.set(locale, flatten(merged));
	}

	/**
	 * Returns the leaf keys under `parentKey` (with full namespace
	 * preserved) merged across exact locale, base language, and
	 * fallback language. Pass an empty `parentKey` to walk the full
	 * tree.
	 */
	getKeys(locale: string, parentKey: string): string[] {
		const seen = new Set<string>();
		const collect = (lang: string): void => {
			const obj = this.resolveObject(parentKey, lang);
			if (!obj) return;
			collectLeafKeys(obj, parentKey, seen);
		};
		collect(locale);
		const base = baseLanguage(locale);
		if (base !== locale) collect(base);
		if (locale !== this.config.fallbackLanguage && base !== this.config.fallbackLanguage) {
			collect(this.config.fallbackLanguage);
		}
		return Array.from(seen).sort();
	}

	/**
	 * Returns direct string children of `parentKey` as a
	 * `{localKey: translation}` map — useful for select dropdowns and
	 * other enum-shaped UIs. Nested objects are ignored.
	 */
	getKeyValues(
		locale: string,
		parentKey: string,
		params?: Record<string, string>,
	): Record<string, string> {
		const out: Record<string, string> = {};
		const taken = new Set<string>();
		const merge = (lang: string): void => {
			const obj = this.resolveObject(parentKey, lang);
			if (!obj) return;
			for (const key of Object.keys(obj)) {
				if (taken.has(key)) continue;
				if (typeof obj[key] !== 'string') continue;
				const full = parentKey ? `${parentKey}${NAMESPACE_DELIMITER}${key}` : key;
				out[key] = this.translate(locale, full, params);
				taken.add(key);
			}
		};
		merge(locale);
		const base = baseLanguage(locale);
		if (base !== locale) merge(base);
		if (locale !== this.config.fallbackLanguage && base !== this.config.fallbackLanguage) {
			merge(this.config.fallbackLanguage);
		}
		return out;
	}

	/**
	 * Same data as `getKeyValues` but as an `{id, value}[]` sorted by
	 * id. Convenient for API responses where the map ordering matters.
	 */
	getValues(locale: string, parentKey: string, params?: Record<string, string>): KeyValue[] {
		return Object.entries(this.getKeyValues(locale, parentKey, params))
			.map(([id, value]) => ({ id, value }))
			.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	}

	/**
	 * Hot-path lookup: probe the flat index for `locale` then the base
	 * language. Empty-string values are treated as missing so the
	 * fallback chain can run — matches workair-compatible semantics.
	 */
	private lookup(locale: string, key: string): string | undefined {
		const exact = this.flat.get(locale);
		if (exact) {
			const v = exact.get(key);
			if (v) return v;
		}
		const base = baseLanguage(locale);
		if (base !== locale) {
			const b = this.flat.get(base);
			if (b) {
				const v = b.get(key);
				if (v) return v;
			}
		}
		return undefined;
	}

	private resolveObject(parentKey: string, language: string): Translation | undefined {
		const translations = this.config.translations[language];
		if (!translations) return undefined;
		if (parentKey === '') return translations;
		let current: Translation = translations;
		for (const segment of parentKey.split(NAMESPACE_DELIMITER)) {
			const next: string | Translation | undefined = current[segment];
			if (next === undefined || typeof next === 'string') return undefined;
			current = next;
		}
		return current;
	}
}

export function createI18n(config: I18nConfig): I18n {
	return new I18n(config);
}

function baseLanguage(locale: string): string {
	const idx = locale.indexOf('_');
	return idx > 0 ? locale.slice(0, idx) : locale;
}

/**
 * Walk a nested translation tree and return a flat
 * `Map<"a::b::c", value>` of every string leaf. A `Map` (not a plain
 * object) is chosen because V8 keeps Map lookups O(1) without the
 * polymorphic-IC churn that hits an Object once it holds thousands of
 * keys with mixed shapes.
 */
function flatten(obj: Translation): Map<string, string> {
	const out = new Map<string, string>();
	walk(obj, '', out);
	return out;
}

function walk(obj: Translation, prefix: string, out: Map<string, string>): void {
	for (const key of Object.keys(obj)) {
		const full = prefix ? `${prefix}${NAMESPACE_DELIMITER}${key}` : key;
		const value = obj[key];
		if (typeof value === 'string') {
			out.set(full, value);
		} else if (value && typeof value === 'object') {
			walk(value, full, out);
		}
	}
}

function collectLeafKeys(obj: Translation, prefix: string, out: Set<string>): void {
	for (const key of Object.keys(obj)) {
		const full = prefix ? `${prefix}${NAMESPACE_DELIMITER}${key}` : key;
		const value = obj[key];
		if (typeof value === 'string') {
			out.add(full);
		} else if (value && typeof value === 'object') {
			collectLeafKeys(value, full, out);
		}
	}
}

function deepMerge(source: Translation, target: Translation): Translation {
	const result: Translation = { ...source };
	for (const key of Object.keys(target)) {
		const t = target[key];
		const s = result[key];
		if (
			t &&
			typeof t === 'object' &&
			s &&
			typeof s === 'object' &&
			!Array.isArray(t) &&
			!Array.isArray(s)
		) {
			result[key] = deepMerge(s as Translation, t as Translation);
		} else {
			result[key] = t;
		}
	}
	return result;
}
