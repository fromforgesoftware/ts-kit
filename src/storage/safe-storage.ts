export interface SafeStorage {
	readonly length: number;
	clear(): void;
	getItem(key: string): string | null;
	key(index: number): string | null;
	removeItem(key: string): void;
	setItem(key: string, value: string): void;
}

export class WebStorageAdapter implements SafeStorage {
	constructor(private readonly backing: Storage) {}

	get length(): number {
		try {
			return this.backing.length;
		} catch {
			return 0;
		}
	}

	clear(): void {
		try {
			this.backing.clear();
		} catch {
			// silent — quota / disabled storage
		}
	}

	getItem(key: string): string | null {
		try {
			return this.backing.getItem(key);
		} catch {
			return null;
		}
	}

	key(index: number): string | null {
		try {
			return this.backing.key(index);
		} catch {
			return null;
		}
	}

	removeItem(key: string): void {
		try {
			this.backing.removeItem(key);
		} catch {
			// silent
		}
	}

	setItem(key: string, value: string): void {
		try {
			this.backing.setItem(key, value);
		} catch {
			// silent — quota exceeded / disabled storage
		}
	}
}
