// A class constructor type. Kept deliberately unconstrained — the
// recursive @Attribute({ type: Foo }) pattern needs ModelType<Foo> for
// arbitrary value-classes like Timestamps that aren't full resources.

export type ModelType<R> = new (...args: unknown[]) => R;

export interface ClassConstructor<T = unknown> {
	new (...args: unknown[]): T;
}
