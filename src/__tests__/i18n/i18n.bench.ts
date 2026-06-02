import { bench, describe } from 'vitest';
import { createI18n, type Translation } from '../index';

// Representative dataset: 1000 leaf keys per locale across 4 locales +
// one regional variant. Mirrors the Go bench fixture so the numbers
// line up across languages.
function fixture() {
	const build = (): Translation => {
		const common: Record<string, string> = {};
		for (let n = 0; n < 250; n++) common[`key${n}`] = `Value ${n}`;

		const greeting: Record<string, string> = {};
		for (let n = 0; n < 250; n++) greeting[`msg${n}`] = `Hello, {{name}}! You have ${n} messages.`;

		const roles: Record<string, string> = {};
		for (let n = 0; n < 500; n++) roles[`role.${n}`] = `Role ${n}`;

		return {
			common,
			auth: { greeting },
			shared: { enum: { role: roles } },
		};
	};

	return createI18n({
		defaultLanguage: 'en',
		fallbackLanguage: 'en',
		translations: {
			en: build(),
			es: build(),
			fr: build(),
			de: build(),
			es_MX: { common: { key0: 'Override' } },
		},
	});
}

describe('Translate', () => {
	const i = fixture();

	bench('shallow hit', () => {
		i.translate('en', 'common::key123');
	});

	bench('deep hit', () => {
		i.translate('en', 'shared::enum::role::role.250');
	});

	bench('regional fallback (es_MX -> es)', () => {
		i.translate('es_MX', 'common::key50');
	});

	bench('unknown locale -> default fallback', () => {
		i.translate('ja', 'common::key75');
	});

	bench('total miss', () => {
		i.translate('en', 'no::such::key');
	});

	bench('with interpolation', () => {
		i.translate('en', 'auth::greeting::msg42', { name: 'Ada' });
	});

	bench('params but no placeholder (fast path)', () => {
		i.translate('en', 'common::key10', { name: 'Ada' });
	});
});

describe('Subtree ops', () => {
	const i = fixture();

	bench('getKeyValues (500 enum entries)', () => {
		i.getKeyValues('en', 'shared::enum::role');
	});

	bench('getKeys (250 entries)', () => {
		i.getKeys('en', 'common');
	});
});

describe('Realistic page render', () => {
	const i = fixture();
	const params = { name: 'Ada' };
	const keys: string[] = [];
	for (let n = 0; n < 25; n++) keys.push(`common::key${n}`);
	for (let n = 25; n < 49; n++) keys.push(`shared::enum::role::role.${n}`);
	keys.push('auth::greeting::msg10');

	bench('50 string lookups', () => {
		for (const k of keys) i.translate('en', k, params);
	});
});
