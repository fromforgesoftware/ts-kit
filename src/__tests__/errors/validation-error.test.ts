import { describe, expect, it } from 'vitest';
import { ValidationError } from '../../errors/index.js';

interface Form {
	name: string;
	email: string;
	age: number;
}

describe('ValidationError', () => {
	it('starts empty', () => {
		const v = new ValidationError<Form>();
		expect(v.hasErrors()).toBe(false);
		expect(v.getErrors()).toEqual({});
		expect(v.getFirstError()).toBeUndefined();
	});

	it('initializes from a partial record', () => {
		const v = new ValidationError<Form>({ name: 'required' });
		expect(v.hasErrors()).toBe(true);
		expect(v.getError('name')).toBe('required');
		expect(v.getError('email')).toBeUndefined();
	});

	it('sets, reads, and removes field errors', () => {
		const v = new ValidationError<Form>();
		v.setError('email', 'invalid');
		expect(v.getError('email')).toBe('invalid');
		v.removeError('email');
		expect(v.getError('email')).toBeUndefined();
		expect(v.hasErrors()).toBe(false);
	});

	it('getFirstError returns the first inserted error', () => {
		const v = new ValidationError<Form>();
		v.setError('name', 'first');
		v.setError('email', 'second');
		expect(v.getFirstError()).toBe('first');
	});

	it('merge combines two ValidationErrors (other wins on conflict)', () => {
		const a = new ValidationError<Form>({ name: 'a-name' });
		const b = new ValidationError<Form>({ name: 'b-name', email: 'b-email' });
		const merged = a.merge(b);
		expect(merged.getError('name')).toBe('b-name');
		expect(merged.getError('email')).toBe('b-email');
		// original untouched
		expect(a.getError('email')).toBeUndefined();
	});

	it('fromZodError reads .issues (Zod v4)', () => {
		const v = ValidationError.fromZodError<Form>({
			issues: [
				{ path: ['name'], message: 'too short' },
				{ path: ['age'], message: 'must be number' },
			],
		});
		expect(v.getError('name')).toBe('too short');
		expect(v.getError('age')).toBe('must be number');
	});

	it('fromZodError reads .errors (Zod v3) and keeps the first error per field', () => {
		const v = ValidationError.fromZodError<Form>({
			errors: [
				{ path: ['email'], message: 'first' },
				{ path: ['email'], message: 'second' },
			],
		});
		expect(v.getError('email')).toBe('first');
	});

	it('fromZodError ignores entries without a path[0]', () => {
		const v = ValidationError.fromZodError<Form>({
			issues: [{ path: [], message: 'orphan' }],
		});
		expect(v.hasErrors()).toBe(false);
	});

	it('fromApiResponse maps an errors map', () => {
		const v = ValidationError.fromApiResponse<Form>({
			errors: { name: 'taken', email: 'bad' },
		});
		expect(v.getError('name')).toBe('taken');
		expect(v.getError('email')).toBe('bad');
	});

	it('fromApiResponse falls back to a general error message', () => {
		const v = ValidationError.fromApiResponse<Form>({
			error: { message: 'something broke' },
		});
		expect((v.getErrors() as Record<string, string>)._general).toBe('something broke');
	});

	it('fromApiResponse handles undefined data', () => {
		const v = ValidationError.fromApiResponse<Form>(undefined);
		expect(v.hasErrors()).toBe(false);
	});
});
