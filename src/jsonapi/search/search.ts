// Framework-agnostic URL query-string assembly for JSON:API requests.
// Replaces the previous Angular-HttpParams implementation. The encoder
// emits raw brackets (filter[field][op]=val, page[limit]=…) because the
// kit-go parser accepts both raw and percent-encoded — raw is more
// readable in logs and curl-pasteable.

import {
	type Filters,
	type IFieldFilter,
	type IPaginationParams,
	type IQuery,
	type Includes,
	PaginationParams,
	Query,
	type QueryOption,
	type Sorts,
	type SparseFieldsets,
} from './query.js';

const DEFAULT_LIMIT = 30;
const DEFAULT_PAGE = 0;

export type SearchOption = (s: Search) => void;

export class Search {
	private _query: IQuery;

	constructor(...opts: SearchOption[]) {
		this._query = new Query();
		for (const opt of opts) {
			opt(this);
		}
	}

	/**
	 * Build a URLSearchParams instance for the configured query.
	 * Brackets in keys (filter[name][op], page[limit]) are written raw so
	 * URLSearchParams.toString() emits them percent-encoded; the wire
	 * representation is unambiguous either way.
	 */
	toURLSearchParams(): URLSearchParams {
		const out = new URLSearchParams();

		this.applyFilters(out, this._query.getFilters());
		this.applyOrGroups(out, this._query.getOrGroups());
		this.applyPagination(out, this._query.getPagination());
		this.applyIncludes(out, this._query.getIncludes());
		this.applySorts(out, this._query.getSorts());
		this.applySparseFieldsets(out, this._query.getFields());

		return out;
	}

	/**
	 * Convenience: returns the rendered query string with raw brackets
	 * (not percent-encoded). Useful for logs / curl pasting. Most HTTP
	 * clients accept either form.
	 */
	toString(): string {
		return decodeURIComponent(this.toURLSearchParams().toString());
	}

	static withQuery = (q: IQuery): SearchOption => {
		return (s: Search): void => {
			s._query.merge(q);
		};
	};

	static withQueryOptions = (...opts: QueryOption[]): SearchOption => {
		return (s: Search): void => {
			Search.withQuery(new Query(...opts))(s);
		};
	};

	private applyFilters(out: URLSearchParams, filters: Filters<unknown>): void {
		filters.forEach((filter: IFieldFilter<unknown>) => {
			out.set(
				`filter[${filter.getField().getName()}][${filter.getOperator()}]`,
				String(filter.getField().getValue()),
			);
		});
	}

	private applyOrGroups(out: URLSearchParams, groups: Filters<unknown>[]): void {
		groups.forEach((group, i) => {
			group.forEach((f: IFieldFilter<unknown>) => {
				out.set(
					`filter[or][${i}][${f.getField().getName()}][${f.getOperator()}]`,
					String(f.getField().getValue()),
				);
			});
		});
	}

	private applyPagination(out: URLSearchParams, pagination: IPaginationParams): void {
		if (!pagination) {
			pagination = new PaginationParams(DEFAULT_LIMIT, DEFAULT_PAGE);
		}
		const params = pagination.toParams();
		for (const [k, v] of Object.entries(params)) {
			out.set(k, String(v));
		}
	}

	private applyIncludes(out: URLSearchParams, includes: Includes): void {
		if (!includes || includes.length === 0) return;
		out.set('include', includes.join(','));
	}

	private applySorts(out: URLSearchParams, sorts: Sorts): void {
		if (!sorts || sorts.length === 0) return;
		out.set('sort', sorts.join(','));
	}

	private applySparseFieldsets(out: URLSearchParams, fields: SparseFieldsets): void {
		if (!fields) return;
		for (const [type, names] of fields) {
			if (!names || names.length === 0) continue;
			out.set(`fields[${type}]`, names.join(','));
		}
	}
}
