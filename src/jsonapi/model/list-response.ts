import { type IMeta } from '../meta.js';
import { type IResource } from './resource.js';

export interface IListResponse<R extends IResource> {
	result(): R[];
	meta(): IMeta;
}

export class ListResponse<R extends IResource> implements IListResponse<R> {
	private _items: R[];
	private _meta: IMeta;
	private _included: any;

	constructor(items: R[], meta: IMeta, included?: any) {
		this._items = items;
		this._meta = meta;
		this._included = included;
	}

	result(): R[] {
		return this._items;
	}

	meta(): IMeta {
		return this._meta;
	}

	included(): any {
		return this._included;
	}
}
