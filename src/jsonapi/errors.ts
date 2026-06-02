import { type ILinks } from './links';
import { type IMeta } from './meta';

/**
 * JSON:API §Error Objects.
 *
 * An error object MUST contain at least one of id, links, status, code,
 * title, detail, source, or meta. All accessor methods may return
 * undefined/null when the corresponding member is absent.
 */
export interface IError {
	ID(): string | undefined;
	Links(): ILinks | undefined;
	Status(): string | undefined;
	Code(): string | undefined;
	Title(): string | undefined;
	Detail(): string | undefined;
	Source(): ErrorSource | undefined;
	Meta(): IMeta | undefined;
}

export interface ErrorSource {
	Pointer(): string | undefined;
	Parameter(): string | undefined;
	Header(): string | undefined;
}

class errorSource implements ErrorSource {
	private readonly pointer?: string;
	private readonly parameter?: string;
	private readonly header?: string;
	constructor(raw?: Record<string, unknown>) {
		this.pointer = raw?.['pointer'] as string | undefined;
		this.parameter = raw?.['parameter'] as string | undefined;
		this.header = raw?.['header'] as string | undefined;
	}
	Pointer(): string | undefined {
		return this.pointer;
	}
	Parameter(): string | undefined {
		return this.parameter;
	}
	Header(): string | undefined {
		return this.header;
	}
}

/**
 * Concrete IError implementation that wraps a raw `errors[]` entry from
 * a JSON:API document. Used by `Document` to turn raw JSON into a typed
 * accessor surface so callers can do `doc.Errors()[0].Detail()` without
 * an "method not implemented" runtime error.
 */
export class jsonapiError implements IError {
	private readonly raw: Record<string, unknown>;

	constructor(raw: Record<string, unknown> = {}) {
		this.raw = raw;
	}

	ID(): string | undefined {
		return this.raw['id'] as string | undefined;
	}
	Status(): string | undefined {
		return this.raw['status'] as string | undefined;
	}
	Code(): string | undefined {
		return this.raw['code'] as string | undefined;
	}
	Title(): string | undefined {
		return this.raw['title'] as string | undefined;
	}
	Detail(): string | undefined {
		return this.raw['detail'] as string | undefined;
	}

	Links(): ILinks | undefined {
		const raw = this.raw['links'];
		if (!raw) return undefined;
		if (raw instanceof Map) return raw as ILinks;
		return new Map(Object.entries(raw as Record<string, unknown>)) as ILinks;
	}

	Meta(): IMeta | undefined {
		const raw = this.raw['meta'];
		if (!raw) return undefined;
		if (raw instanceof Map) return raw as IMeta;
		return new Map(Object.entries(raw as Record<string, unknown>)) as IMeta;
	}

	Source(): ErrorSource | undefined {
		const raw = this.raw['source'] as Record<string, unknown> | undefined;
		if (!raw) return undefined;
		return new errorSource(raw);
	}
}
