// Public base classes consumers extend for typed JSON:API resources.
// Uses the consolidated @Attribute decorator — no @NestedAttribute or
// @Wrapped — for typed sub-objects. The pre-rewrite split (NestedAttribute
// outside, Wrapped inside) is gone; one decorator does both.

import { Attribute } from '../decorators/attribute.decorator.js';

export interface IIdentifier {
	ID(): string;
	Type(): string;
}

export interface ITimestamps {
	CreatedAt(): Date | null;
	UpdatedAt(): Date | null;
	DeletedAt(): Date | null;
}

export interface IResource extends IIdentifier, ITimestamps {}

export interface TimestampsProps {
	createdAt: Date;
	updatedAt: Date;
	deletedAt?: Date;
}

export class Timestamps implements ITimestamps {
	@Attribute() createdAt!: Date;
	@Attribute() updatedAt!: Date;
	@Attribute() deletedAt?: Date;

	constructor(props?: Partial<TimestampsProps>) {
		if (!props) return;
		if (props.createdAt) this.createdAt = props.createdAt;
		if (props.updatedAt) this.updatedAt = props.updatedAt;
		if (props.deletedAt) this.deletedAt = props.deletedAt;
	}

	CreatedAt(): Date | null {
		return this.createdAt ?? null;
	}
	UpdatedAt(): Date | null {
		return this.updatedAt ?? null;
	}
	DeletedAt(): Date | null {
		return this.deletedAt ?? null;
	}
}

export interface ResourceProps {
	id?: string;
	lid?: string;
	type?: string;
	timestamps?: TimestampsProps;
}

/**
 * Base class for JSON:API resources. Subclasses declare their type via
 * `@Resource({ type })` and their attributes / relationships via the
 * matching decorators.
 *
 *   @Resource({ type: 'articles' })
 *   class Article extends Resource {
 *     @Attribute() title!: string;
 *     @Relationship({ type: Author }) author!: Author;
 *   }
 *
 * Timestamps is wired in as a recursive `@Attribute({ type: Timestamps })`
 * so subclasses get `created/updated/deletedAt` accessors for free
 * without re-declaring the inner fields.
 */
export class Resource implements IResource {
	id!: string;
	lid?: string;
	type!: string;

	@Attribute({ type: Timestamps }) timestamps?: Timestamps;

	constructor(props?: Partial<ResourceProps>) {
		if (!props) return;
		if (props.id !== undefined) this.id = props.id;
		if (props.lid !== undefined) this.lid = props.lid;
		if (props.type !== undefined) this.type = props.type;
		if (props.timestamps) this.timestamps = new Timestamps(props.timestamps);
	}

	ID(): string {
		return this.id;
	}
	Type(): string {
		return this.type;
	}
	CreatedAt(): Date | null {
		return this.timestamps?.CreatedAt() ?? null;
	}
	UpdatedAt(): Date | null {
		return this.timestamps?.UpdatedAt() ?? null;
	}
	DeletedAt(): Date | null {
		return this.timestamps?.DeletedAt() ?? null;
	}
}
