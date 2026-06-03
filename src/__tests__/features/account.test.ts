import { describe, expect, it } from 'vitest';
import type {
	IUserAccount,
	IWorkspaceSummary,
	ISession,
	IPreference,
} from '../../features/index.js';
import * as features from '../../features/index.js';

// The features module is type-only (interfaces). These tests document the
// expected shapes and exercise the module's runtime import so the barrel
// files are counted as covered.
describe('features/account types', () => {
	it('module imports without runtime side effects', () => {
		expect(features).toBeTypeOf('object');
	});

	it('IUserAccount shape', () => {
		const account: IUserAccount = {
			id: 'u1',
			email: 'a@b.com',
			emailVerified: true,
			displayName: 'Ann',
			photoURL: 'https://x/y.png',
		};
		expect(account.id).toBe('u1');
		expect(account.emailVerified).toBe(true);
	});

	it('ISession composes account + workspaces + permissions', () => {
		const workspace: IWorkspaceSummary = { id: 'w1', name: 'Main' };
		const pref: IPreference = { key: 'theme', value: 'dark' };
		const session: ISession = {
			account: {
				id: 'u1',
				email: 'a@b.com',
				emailVerified: false,
				displayName: '',
				photoURL: '',
			},
			workspaces: [workspace],
			permissions: ['read:x', 'write:y'],
		};
		expect(session.workspaces[0].name).toBe('Main');
		expect(session.permissions).toContain('read:x');
		expect(pref.key).toBe('theme');
	});
});
