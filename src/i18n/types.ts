/**
 * Nested map of translations. Leaf values are strings; intermediate
 * nodes are nested Translation maps.
 */
export interface Translation {
	[key: string]: string | Translation;
}

export interface I18nConfig {
	defaultLanguage: string;
	fallbackLanguage: string;
	translations: Record<string, Translation>;
}

export interface KeyValue {
	id: string;
	value: string;
}

/**
 * Namespace delimiter — separates namespaces in a translation key so
 * that key names may contain dots, underscores, or hyphens.
 */
export const NAMESPACE_DELIMITER = '::';
