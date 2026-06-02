import { describe, expect, it } from 'vitest';
import { Op, Query, Search } from '../../../jsonapi';

// Query / Search produce the URL parameter shapes documented by
// JSON:API §Fetching plus the filter/sort vocabulary in
// forge/go/kit/filter. These tests assert the wire encoding.

describe('Query / Search — URL parameter assembly', () => {
	it('emits filter[field][op]=value', () => {
		const s = new Search(Search.withQueryOptions(Query.filterBy(Op.Eq, 'name', 'alice')));
		expect(s.toString()).toContain('filter[name][eq]=alice');
	});

	it('chains every Op variant', () => {
		const cases: [Op, string][] = [
			[Op.Eq, 'eq'],
			[Op.Neq, 'ne'],
			[Op.GT, 'gt'],
			[Op.GTEq, 'gte'],
			[Op.LT, 'lt'],
			[Op.LTEq, 'lte'],
			[Op.In, 'in'],
			[Op.NotIn, 'not-in'],
			[Op.Like, 'like'],
			[Op.NotLike, 'not-like'],
			[Op.Between, 'btw'],
			[Op.Contain, 'any'],
			[Op.ContainsLike, 'any-like'],
			[Op.IsNull, 'is-null'],
			[Op.NotNull, 'not-null'],
		];
		for (const [op, wire] of cases) {
			const s = new Search(Search.withQueryOptions(Query.filterBy(op, 'f', 'v')));
			expect(s.toString()).toContain(`filter[f][${wire}]=v`);
		}
	});

	it('renders offset pagination as page[limit] + page[offset]', () => {
		const s = new Search(Search.withQueryOptions(Query.pagination(20, 2)));
		const out = s.toString();
		expect(out).toContain('page[limit]=20');
		expect(out).toContain('page[offset]=40'); // limit * page
	});

	it('renders page-number pagination as page[number] + page[size]', () => {
		const s = new Search(Search.withQueryOptions(Query.pageNumber(3, 50)));
		const out = s.toString();
		expect(out).toContain('page[number]=3');
		expect(out).toContain('page[size]=50');
	});

	it('renders cursor pagination with the supplied direction', () => {
		const s = new Search(Search.withQueryOptions(Query.cursor({ after: 'abc', size: 25 })));
		const out = s.toString();
		expect(out).toContain('page[after]=abc');
		expect(out).toContain('page[size]=25');
		expect(out).not.toContain('page[before]');
	});

	it('renders include as a comma-joined list', () => {
		const s = new Search(Search.withQueryOptions(Query.include('author', 'comments.author')));
		expect(s.toString()).toContain('include=author,comments.author');
	});

	it('renders sort with +/- prefixes per JSON:API §Sorting', () => {
		const s = new Search(Search.withQueryOptions(Query.sort('+name', '-createdAt', 'title')));
		expect(s.toString()).toContain('sort=name,-createdAt,title');
	});

	it('renders sparse fieldsets as fields[type]=names', () => {
		const s = new Search(
			Search.withQueryOptions(
				Query.fields('articles', 'title', 'body'),
				Query.fields('people', 'name'),
			),
		);
		const out = s.toString();
		expect(out).toContain('fields[articles]=title,body');
		expect(out).toContain('fields[people]=name');
	});

	it('toURLSearchParams() returns a real URLSearchParams', () => {
		const s = new Search(Search.withQueryOptions(Query.filterBy(Op.Eq, 'id', '42')));
		const usp = s.toURLSearchParams();
		expect(usp).toBeInstanceOf(URLSearchParams);
		expect(usp.get('filter[id][eq]')).toBe('42');
	});

	it('Query.or emits filter[or][i][field][op]=val per group', () => {
		const s = new Search(
			Search.withQueryOptions(
				Query.filterBy(Op.Eq, 'status', 'active'),
				Query.or(
					[Query.filterBy(Op.Eq, 'role', 'admin'), Query.filterBy(Op.Eq, 'tenant', 'A')],
					[Query.filterBy(Op.Eq, 'role', 'owner')],
				),
			),
		);
		const out = s.toString();
		expect(out).toContain('filter[status][eq]=active');
		expect(out).toContain('filter[or][0][role][eq]=admin');
		expect(out).toContain('filter[or][0][tenant][eq]=A');
		expect(out).toContain('filter[or][1][role][eq]=owner');
	});

	it('Query.or with empty group drops it', () => {
		const s = new Search(Search.withQueryOptions(Query.or([])));
		expect(s.toString()).not.toContain('filter[or]');
	});

	it('Query.or preserves group order in URL', () => {
		const s = new Search(
			Search.withQueryOptions(
				Query.or([Query.filterBy(Op.Eq, 'a', '1')], [Query.filterBy(Op.Eq, 'b', '2')]),
			),
		);
		const out = s.toString();
		expect(out).toContain('filter[or][0][a][eq]=1');
		expect(out).toContain('filter[or][1][b][eq]=2');
	});
});
