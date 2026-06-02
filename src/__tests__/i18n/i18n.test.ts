import { describe, expect, it } from 'vitest';
import { type I18n, createI18n, type Translation } from '../../i18n';

function fixture(): I18n {
	const translations: Record<string, Translation> = {
		en: {
			common: { save: 'Save', cancel: 'Cancel', mobile: 'Mobile' },
			shared: {
				enum: {
					role: {
						'org.admin': 'Customer Administrator',
						'tenant.admin': 'Tenant Administrator',
					},
				},
			},
			welcome: { message: 'Welcome, {{name}}!' },
		},
		es: {
			common: { save: 'Guardar', mobile: 'Móvil' },
			welcome: { message: '¡Bienvenido, {{name}}!' },
		},
		es_MX: {
			common: { mobile: 'Celular' },
		},
	};
	return createI18n({
		defaultLanguage: 'en',
		fallbackLanguage: 'en',
		translations,
	});
}

describe('translate', () => {
	it('returns the exact match', () => {
		expect(fixture().translate('en', 'common::save')).toBe('Save');
		expect(fixture().translate('es', 'common::save')).toBe('Guardar');
	});

	it('falls back from regional to base locale', () => {
		expect(fixture().translate('es_MX', 'common::mobile')).toBe('Celular');
		expect(fixture().translate('es_MX', 'common::save')).toBe('Guardar');
	});

	it('falls back to the configured fallback language', () => {
		expect(fixture().translate('es', 'common::cancel')).toBe('Cancel');
	});

	it('returns the key when nothing matches', () => {
		expect(fixture().translate('en', 'missing::key')).toBe('missing::key');
	});

	it('preserves dots inside key names', () => {
		expect(fixture().translate('en', 'shared::enum::role::org.admin')).toBe(
			'Customer Administrator',
		);
	});

	it('interpolates placeholders', () => {
		expect(fixture().translate('en', 'welcome::message', { name: 'John' })).toBe('Welcome, John!');
	});

	it('leaves unknown placeholders untouched', () => {
		expect(fixture().translate('en', 'welcome::message', { other: 'x' })).toBe(
			'Welcome, {{name}}!',
		);
	});
});

describe('hasTranslation', () => {
	it('checks across the fallback chain', () => {
		const i = fixture();
		expect(i.hasTranslation('en', 'common::save')).toBe(true);
		expect(i.hasTranslation('es_MX', 'common::save')).toBe(true);
		expect(i.hasTranslation('en', 'no.such.key')).toBe(false);
	});
});

describe('getAvailableLanguages', () => {
	it('returns the loaded locales sorted', () => {
		expect(fixture().getAvailableLanguages()).toEqual(['en', 'es', 'es_MX']);
	});
});

describe('getKeys', () => {
	it('returns full namespaced keys', () => {
		expect(fixture().getKeys('en', 'common')).toEqual([
			'common::cancel',
			'common::mobile',
			'common::save',
		]);
	});

	it('merges across regional, base, and fallback locales', () => {
		expect(fixture().getKeys('es_MX', 'common')).toEqual([
			'common::cancel',
			'common::mobile',
			'common::save',
		]);
	});

	it('walks the full tree when parentKey is empty', () => {
		const keys = fixture().getKeys('en', '');
		expect(keys).toContain('common::save');
		expect(keys).toContain('shared::enum::role::org.admin');
		expect(keys).toContain('welcome::message');
	});
});

describe('getKeyValues', () => {
	it('returns local keys mapped to translations', () => {
		expect(fixture().getKeyValues('en', 'common')).toEqual({
			save: 'Save',
			cancel: 'Cancel',
			mobile: 'Mobile',
		});
	});

	it('preserves dots in key names', () => {
		expect(fixture().getKeyValues('en', 'shared::enum::role')).toEqual({
			'org.admin': 'Customer Administrator',
			'tenant.admin': 'Tenant Administrator',
		});
	});

	it('ignores nested objects', () => {
		expect(fixture().getKeyValues('en', 'shared::enum')).toEqual({});
	});

	it('applies interpolation', () => {
		expect(fixture().getKeyValues('en', 'welcome', { name: 'Ada' })).toEqual({
			message: 'Welcome, Ada!',
		});
	});
});

describe('getValues', () => {
	it('returns a sorted array of {id, value}', () => {
		expect(fixture().getValues('en', 'shared::enum::role')).toEqual([
			{ id: 'org.admin', value: 'Customer Administrator' },
			{ id: 'tenant.admin', value: 'Tenant Administrator' },
		]);
	});
});

describe('mergeTranslations', () => {
	it('layers legacy translations under existing ones', () => {
		const i = fixture();
		i.mergeTranslations('en', {
			legacy: { hello: 'Hi' },
			common: { save: 'OVERRIDE-IGNORED' },
		});
		expect(i.translate('en', 'legacy::hello')).toBe('Hi');
		// Existing translations win over legacy.
		expect(i.translate('en', 'common::save')).toBe('Save');
	});
});
