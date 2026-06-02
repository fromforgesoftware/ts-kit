/**
 * Field-level validation errors for forms and API responses.
 * Works with any entity type via generics.
 */
export interface IValidationError<T> {
	hasErrors(): boolean;
	getError(field: keyof T): string | undefined;
	getErrors(): Partial<Record<keyof T, string>>;
	setError(field: keyof T, message: string): void;
	removeError(field: keyof T): void;
}

export class ValidationError<T extends object = Record<string, unknown>>
	implements IValidationError<T>
{
	private readonly errors: Map<keyof T, string>;

	constructor(errors?: Partial<Record<keyof T, string>>) {
		this.errors = new Map(errors ? (Object.entries(errors) as [keyof T, string][]) : []);
	}

	hasErrors(): boolean {
		return this.errors.size > 0;
	}

	getError(field: keyof T): string | undefined {
		return this.errors.get(field);
	}

	getErrors(): Partial<Record<keyof T, string>> {
		return Object.fromEntries(this.errors) as Partial<Record<keyof T, string>>;
	}

	setError(field: keyof T, message: string): void {
		this.errors.set(field, message);
	}

	removeError(field: keyof T): void {
		this.errors.delete(field);
	}

	/** Get first error message (useful for general error display) */
	getFirstError(): string | undefined {
		const first = this.errors.values().next();
		return first.done ? undefined : first.value;
	}

	/** Merge with another ValidationError */
	merge(other: ValidationError<T>): ValidationError<T> {
		const merged = new ValidationError<T>(this.getErrors());
		for (const [field, message] of Object.entries(other.getErrors())) {
			merged.setError(field as keyof T, message as string);
		}
		return merged;
	}

	/** Factory: Create from Zod error (supports both Zod v3 .errors and v4 .issues) */
	static fromZodError<T extends object>(error: {
		errors?: Array<{ path: PropertyKey[]; message: string }>;
		issues?: Array<{ path: PropertyKey[]; message: string }>;
	}): ValidationError<T> {
		const validation = new ValidationError<T>();
		const items = error.issues ?? error.errors ?? [];
		for (const err of items) {
			const field = err.path[0] as keyof T;
			if (field && !validation.getError(field)) {
				validation.setError(field, err.message);
			}
		}
		return validation;
	}

	/** Factory: Create from API error response */
	static fromApiResponse<T extends object>(
		data: { errors?: Record<string, string>; error?: { message?: string } } | undefined,
	): ValidationError<T> {
		const validation = new ValidationError<T>();
		if (data?.errors) {
			for (const [field, message] of Object.entries(data.errors)) {
				validation.setError(field as keyof T, message);
			}
		} else if (data?.error?.message) {
			validation.setError('_general' as keyof T, data.error.message);
		}
		return validation;
	}
}
