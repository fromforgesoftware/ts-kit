import { type FieldName } from './fields';

/**
 * Filter operator vocabulary. Values match `forge/go/kit/filter`'s
 * over-the-wire encoding (eq, ne, in, like, …) and the JSON:API
 * recommended `filter[field][op]=value` shape.
 */
export enum Op {
	Eq = 'eq',
	Neq = 'ne',
	GT = 'gt',
	GTEq = 'gte',
	LT = 'lt',
	LTEq = 'lte',
	In = 'in',
	NotIn = 'not-in',
	Like = 'like',
	NotLike = 'not-like',
	Between = 'btw',
	Contain = 'any',
	ContainsLike = 'any-like',
	IsNull = 'is-null',
	NotNull = 'not-null',
}

// ============================================================================
// Pagination — three styles supported, dispatched by the variant tag.
// ============================================================================

export interface IPaginationParams {
	/** Render as `page[*]=…` URL params. Each implementation knows its keys. */
	toParams(): Record<string, string | number>;
	/** Limit / size accessor, kept for symmetric pre-1.1 consumer compat. */
	getLimit?(): number;
	/** Page accessor, kept for symmetric pre-1.1 consumer compat. */
	getPage?(): number;
}

/** Offset-style pagination: `page[limit]=…&page[offset]=…`. */
export class PaginationParams implements IPaginationParams {
	constructor(
		private readonly _limit: number,
		private readonly _page: number,
	) {}

	getLimit(): number {
		return this._limit;
	}
	getPage(): number {
		return this._page;
	}

	toParams(): Record<string, string | number> {
		return {
			'page[limit]': this._limit,
			'page[offset]': this._limit * this._page,
		};
	}
}

/** Page-number style: `page[number]=…&page[size]=…`. */
export class PageNumberPaginationParams implements IPaginationParams {
	constructor(
		private readonly number: number,
		private readonly size: number,
	) {}

	toParams(): Record<string, string | number> {
		return {
			'page[number]': this.number,
			'page[size]': this.size,
		};
	}
}

/** Cursor style: `page[before]?=…&page[after]?=…&page[size]?=…`. */
export class CursorPaginationParams implements IPaginationParams {
	constructor(private readonly opts: { before?: string; after?: string; size?: number }) {}

	toParams(): Record<string, string | number> {
		const out: Record<string, string | number> = {};
		if (this.opts.before !== undefined) out['page[before]'] = this.opts.before;
		if (this.opts.after !== undefined) out['page[after]'] = this.opts.after;
		if (this.opts.size !== undefined) out['page[size]'] = this.opts.size;
		return out;
	}
}

// ============================================================================
// Filter fields
// ============================================================================

interface IField<T> {
	getValue(): T;
	getName(): string;
}

class Field<T> implements IField<T> {
	constructor(
		private readonly _name: string,
		private readonly _val: T,
	) {}
	getValue(): T {
		return this._val;
	}
	getName(): string {
		return this._name;
	}
}

export interface IFieldFilter<T> {
	getField(): IField<T>;
	getOperator(): Op;
}

class FieldFilter<T> implements IFieldFilter<T> {
	private _field: IField<T>;
	constructor(
		private readonly _operator: Op,
		name: FieldName,
		val: T,
	) {
		this._field = new Field(name.toString(), val);
	}
	getField(): IField<T> {
		return this._field;
	}
	getOperator(): Op {
		return this._operator;
	}
}

export type Filters<T> = Map<string, IFieldFilter<T>>;

// ============================================================================
// Sort + Sparse Fieldsets + Includes
// ============================================================================

/** Sort expressions, e.g. ['name', '-createdAt']. Prefix - = descending. */
export type Sorts = string[];

/** Map of resource-type → list of attribute names to include. */
export type SparseFieldsets = Map<string, string[]>;

/** Relationship paths to include, e.g. ['author', 'author.publisher']. */
export type Includes = string[];

// ============================================================================
// Query — composable builder.
// ============================================================================

export interface IQuery {
	merge(q: IQuery): void;
	getFilters(): Filters<unknown>;
	getOrGroups(): Filters<unknown>[];
	getPagination(): IPaginationParams | undefined;
	getIncludes(): Includes;
	getSorts(): Sorts;
	getFields(): SparseFieldsets;
}

export type QueryOption = (q: Query) => void;

export class Query implements IQuery {
	private _filters: Filters<unknown> = new Map();
	private _orGroups: Filters<unknown>[] = [];
	private _pagination?: IPaginationParams;
	private _includes: Includes = [];
	private _sorts: Sorts = [];
	private _fields: SparseFieldsets = new Map();

	constructor(...opts: QueryOption[]) {
		for (const opt of opts) {
			opt(this);
		}
	}

	merge(q: IQuery): void {
		if (!q) return;
		q.getFilters().forEach((v, k) => this._filters.set(k, v));
		const ogs = q.getOrGroups();
		if (ogs && ogs.length) this._orGroups = ogs.map((g) => new Map(g));
		const pg = q.getPagination();
		if (pg) this._pagination = pg;
		const incs = q.getIncludes();
		if (incs && incs.length) this._includes = [...incs];
		const sorts = q.getSorts();
		if (sorts && sorts.length) this._sorts = [...sorts];
		const fields = q.getFields();
		if (fields && fields.size) {
			fields.forEach((v, k) => this._fields.set(k, [...v]));
		}
	}

	getFilters(): Filters<unknown> {
		return this._filters;
	}
	getOrGroups(): Filters<unknown>[] {
		return this._orGroups;
	}
	getPagination(): IPaginationParams | undefined {
		return this._pagination;
	}
	getIncludes(): Includes {
		return this._includes;
	}
	getSorts(): Sorts {
		return this._sorts;
	}
	getFields(): SparseFieldsets {
		return this._fields;
	}

	// ──────────────── builder options ─────────────────────────────────

	static filterBy = (op: Op, fieldName: FieldName, val: unknown): QueryOption => {
		return (q: Query) => {
			q._filters.set(fieldName, new FieldFilter(op, fieldName, val));
		};
	};

	static or = (...groups: QueryOption[][]): QueryOption => {
		return (q: Query) => {
			for (const groupOpts of groups) {
				const sub = new Query(...groupOpts);
				if (sub.getFilters().size > 0) {
					q._orGroups.push(new Map(sub.getFilters()));
				}
			}
		};
	};

	/** Offset-style pagination: `page[limit]=size, page[offset]=size*page`. */
	static pagination = (limit: number, page: number): QueryOption => {
		return (q: Query) => {
			q._pagination = new PaginationParams(limit, page);
		};
	};

	/** Page-number style: `page[number]=n, page[size]=s`. */
	static pageNumber = (number: number, size: number): QueryOption => {
		return (q: Query) => {
			q._pagination = new PageNumberPaginationParams(number, size);
		};
	};

	/** Cursor pagination: `page[before|after]=cursor, page[size]?=s`. */
	static cursor = (opts: { before?: string; after?: string; size?: number }): QueryOption => {
		return (q: Query) => {
			q._pagination = new CursorPaginationParams(opts);
		};
	};

	/** Compound `include=…` relationship path list. */
	static include = (...relationshipNames: string[]): QueryOption => {
		return (q: Query) => {
			q._includes = [...relationshipNames];
		};
	};

	/**
	 * Sort expressions. Accepts plain field names (asc), `-name` (desc),
	 * or the explicit `+name` form. Output: `sort=name,-createdAt`.
	 */
	static sort = (...expressions: string[]): QueryOption => {
		return (q: Query) => {
			q._sorts = expressions.map((e) => (e.startsWith('+') ? e.slice(1) : e));
		};
	};

	/**
	 * Sparse fieldsets per JSON:API §Fetching Sparse Fieldsets.
	 * `Query.fields('articles', 'title', 'body')` → `fields[articles]=title,body`.
	 */
	static fields = (type: string, ...names: string[]): QueryOption => {
		return (q: Query) => {
			q._fields.set(type, names);
		};
	};
}
