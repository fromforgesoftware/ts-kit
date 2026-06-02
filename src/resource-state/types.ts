export interface Pagination {
	totalCount: number;
	page: number;
	limit: number;
}

export interface ResourceState<R> {
	items: R[];
	selected: R | null;
	pagination: Pagination;
	loading: boolean;
	error: string | null;
}

export type IdAccessor<R> = (resource: R) => string;
