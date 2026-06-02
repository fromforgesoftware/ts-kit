// Account domain types for trading-bot. Identity comes from Firebase;
// permissions/workspaces come from the backend's GET /v1/auth/me.

export interface IUserAccount {
	id: string;
	email: string;
	emailVerified: boolean;
	displayName: string;
	photoURL: string;
}

export interface IWorkspaceSummary {
	id: string;
	name: string;
}

export interface ISession {
	account: IUserAccount;
	workspaces: IWorkspaceSummary[];
	// Permission slugs evaluated server-side and cached for the duration
	// of the session. Authoritative per-resource checks always go through
	// the backend Authorizer.
	permissions: string[];
}

export interface IPreference {
	key: string;
	value: string;
}
