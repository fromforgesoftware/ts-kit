import { describe, expect, it } from 'vitest';
import { Timestamps } from '../../../jsonapi';

// Pre-rewrite resourceTimestamps.UpdatedAt() and DeletedAt() both
// returned createdAt. This test pins the correct accessor mapping.
describe('Timestamps accessors', () => {
	it('returns the right field per accessor', () => {
		const created = new Date('2026-01-01T00:00:00Z');
		const updated = new Date('2026-01-02T00:00:00Z');
		const deleted = new Date('2026-01-03T00:00:00Z');

		const ts = new Timestamps({ createdAt: created, updatedAt: updated, deletedAt: deleted });

		expect(ts.CreatedAt()).toEqual(created);
		expect(ts.UpdatedAt()).toEqual(updated);
		expect(ts.DeletedAt()).toEqual(deleted);
	});

	it('returns null for unset deletedAt', () => {
		const ts = new Timestamps({ createdAt: new Date(), updatedAt: new Date() });
		expect(ts.DeletedAt()).toBeNull();
	});
});
