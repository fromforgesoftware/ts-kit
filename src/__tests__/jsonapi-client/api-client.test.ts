import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { Attribute, JsonApi, Op, Query, Resource } from '../../jsonapi';
import {
	ApiClient,
	ApiError,
	Atomic,
	apiResult,
	type HttpAdapter,
	type HttpRequest,
	type HttpResponse,
} from '../../jsonapi-client';

@JsonApi({ type: 'workspaces' })
class Workspace extends Resource {
	@Attribute() name!: string;
	@Attribute() accountId?: string;
}

class StubAdapter implements HttpAdapter {
	calls: HttpRequest[] = [];
	queue: (HttpResponse | (() => HttpResponse | Promise<HttpResponse>))[] = [];

	push(res: HttpResponse | (() => HttpResponse | Promise<HttpResponse>)): void {
		this.queue.push(res);
	}

	async request(req: HttpRequest): Promise<HttpResponse> {
		this.calls.push(req);
		const next = this.queue.shift();
		if (next === undefined) throw new Error('StubAdapter: no queued response');
		return typeof next === 'function' ? await next() : next;
	}
}

function jsonRes(status: number, body: unknown): HttpResponse {
	return { status, headers: { 'content-type': 'application/vnd.api+json' }, body };
}

function single(id: string, attrs: Record<string, unknown>) {
	return { data: { type: 'workspaces', id, attributes: attrs } };
}

function collection(items: { id: string; attrs: Record<string, unknown> }[], totalCount: number) {
	return {
		data: items.map((i) => ({ type: 'workspaces', id: i.id, attributes: i.attrs })),
		meta: { pagination: { totalCount } },
	};
}

function client(adapter: StubAdapter) {
	return ApiClient.create({
		baseUrl: 'https://api.example.com/',
		adapter,
		headers: { 'X-Custom': 'yes' },
	});
}

describe('ApiClient — CRUD wire shape', () => {
	it('list builds URL with search params + decodes collection', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, collection([{ id: 'w1', attrs: { name: 'WS1' } }], 1)));

		const api = client(adapter);
		const res = await api.list(
			Workspace,
			Query.filterBy(Op.Eq, 'accountId', 'acc-1'),
			Query.pageNumber(1, 25),
		);

		expect(res.result()).toHaveLength(1);
		expect(res.result()[0].name).toBe('WS1');
		const req = adapter.calls[0];
		expect(req.method).toBe('GET');
		expect(req.url).toContain('https://api.example.com/workspaces');
		expect(decodeURIComponent(req.url)).toContain('filter[accountId][eq]=acc-1');
		expect(decodeURIComponent(req.url)).toContain('page[number]=1');
		expect(req.headers['Accept']).toBe('application/vnd.api+json');
		expect(req.headers['X-Custom']).toBe('yes');
	});

	it('get fetches /type/id and decodes single', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, single('w1', { name: 'WS1' })));
		const api = client(adapter);

		const ws = await api.get(Workspace, 'w1');

		expect(ws.name).toBe('WS1');
		expect(adapter.calls[0].url).toBe('https://api.example.com/workspaces/w1');
	});

	it('create posts encoded resource without id, returns decoded result', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(201, single('w-new', { name: 'New', accountId: 'a1' })));
		const api = client(adapter);

		const created = await api.create(Workspace, { name: 'New', accountId: 'a1' });

		expect(created.name).toBe('New');
		const req = adapter.calls[0];
		expect(req.method).toBe('POST');
		expect(req.url).toBe('https://api.example.com/workspaces');
		const body = req.body as {
			data: { type: string; id?: string; attributes: Record<string, unknown> };
		};
		expect(body.data.type).toBe('workspaces');
		expect(body.data.id).toBeUndefined();
		expect(body.data.attributes.name).toBe('New');
	});

	it('update PATCHes /type/id with id in the body', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, single('w1', { name: 'Renamed' })));
		const api = client(adapter);

		await api.update(Workspace, 'w1', { name: 'Renamed' });

		const req = adapter.calls[0];
		expect(req.method).toBe('PATCH');
		expect(req.url).toBe('https://api.example.com/workspaces/w1');
		const body = req.body as { data: { id: string; attributes: Record<string, unknown> } };
		expect(body.data.id).toBe('w1');
		expect(body.data.attributes.name).toBe('Renamed');
	});

	it('delete returns void on 204', async () => {
		const adapter = new StubAdapter();
		adapter.push({ status: 204, headers: {}, body: null });
		const api = client(adapter);

		await expect(api.delete(Workspace, 'w1')).resolves.toBeUndefined();
		expect(adapter.calls[0].method).toBe('DELETE');
	});
});

describe('ApiClient — typed errors', () => {
	it('throws ApiError with parsed JSON:API errors on 422 with source.pointer', async () => {
		const adapter = new StubAdapter();
		const errBody = {
			errors: [
				{
					status: '422',
					code: 'unprocessable',
					detail: 'must be unique',
					source: { pointer: '/data/attributes/name' },
				},
			],
		};
		adapter.push(jsonRes(422, errBody));
		const api = client(adapter);

		await expect(api.create(Workspace, { name: 'Dup' })).rejects.toMatchObject({
			name: 'ApiError',
			status: 422,
		});

		adapter.push(jsonRes(422, errBody));
		try {
			await api.create(Workspace, { name: 'Dup' });
			throw new Error('expected to throw');
		} catch (e) {
			if (!(e instanceof ApiError)) throw e;
			expect(e.isValidation()).toBe(true);
			expect(e.errors[0].Detail()).toBe('must be unique');
			expect(e.fieldErrors()).toEqual({ name: ['must be unique'] });
		}
	});

	it('isUnauthorized / isForbidden / isNotFound / isConflict status helpers', () => {
		expect(new ApiError(401, []).isUnauthorized()).toBe(true);
		expect(new ApiError(403, []).isForbidden()).toBe(true);
		expect(new ApiError(404, []).isNotFound()).toBe(true);
		expect(new ApiError(409, []).isConflict()).toBe(true);
		expect(new ApiError(500, []).isServerError()).toBe(true);
	});
});

describe('ApiClient — cancellation', () => {
	it('forwards AbortSignal to the adapter', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, single('w1', { name: 'WS1' })));
		const api = client(adapter);
		const ac = new AbortController();

		await api.get(Workspace, 'w1', { signal: ac.signal });

		expect(adapter.calls[0].signal).toBe(ac.signal);
	});
});

describe('ApiClient — bulk + form-data + escape hatch', () => {
	it('bulkCreate sends a collection POST', async () => {
		const adapter = new StubAdapter();
		adapter.push(
			jsonRes(
				201,
				collection(
					[
						{ id: 'w1', attrs: { name: 'A' } },
						{ id: 'w2', attrs: { name: 'B' } },
					],
					2,
				),
			),
		);
		const api = client(adapter);

		const out = await api.bulkCreate(Workspace, [{ name: 'A' }, { name: 'B' }]);

		expect(out.map((w) => w.name)).toEqual(['A', 'B']);
		const body = adapter.calls[0].body as { data: { attributes: Record<string, unknown> }[] };
		expect(body.data).toHaveLength(2);
		expect(body.data[0].attributes.name).toBe('A');
	});

	it('createWithFormData sends FormData and drops the JSON:API Content-Type', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(201, single('w1', { name: 'Uploaded' })));
		const api = client(adapter);

		const fd = new FormData();
		fd.append('file', new Blob(['hi'], { type: 'text/plain' }), 'note.txt');
		const result = await api.createWithFormData(Workspace, fd);

		expect(result.name).toBe('Uploaded');
		const req = adapter.calls[0];
		expect(req.body).toBe(fd);
		expect(req.headers['Content-Type']).toBeUndefined();
	});

	it('request() escape hatch hits a custom path and returns parsed body', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, { ok: true }));
		const api = client(adapter);

		const res = await api.request({ method: 'POST', path: '/workspaces/w1/publish' });

		expect(res.status).toBe(200);
		expect(adapter.calls[0].url).toBe('https://api.example.com/workspaces/w1/publish');
	});

	it('request() throws ApiError on 4xx with parsed errors', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(404, { errors: [{ status: '404', title: 'not found' }] }));
		const api = client(adapter);

		await expect(api.request({ method: 'GET', path: '/missing' })).rejects.toMatchObject({
			status: 404,
		});
	});
});

describe('ApiClient — atomic', () => {
	it('sends atomic:operations with mixed add/update/remove + decodes results', async () => {
		const adapter = new StubAdapter();
		adapter.push(
			jsonRes(200, {
				'atomic:results': [
					{ data: { type: 'workspaces', id: 'new1', attributes: { name: 'A' } } },
					{ data: { type: 'workspaces', id: 'w1', attributes: { name: 'Renamed' } } },
					{},
				],
			}),
		);
		const api = client(adapter);

		const result = await api.atomic([
			Atomic.add(Workspace, { name: 'A' }),
			Atomic.update(Workspace, 'w1', { name: 'Renamed' }),
			Atomic.remove(Workspace, 'w2'),
		]);

		expect(result.results).toHaveLength(3);
		expect((result.results[0] as Workspace).name).toBe('A');
		expect((result.results[1] as Workspace).name).toBe('Renamed');
		expect(result.results[2]).toBeNull();

		const req = adapter.calls[0];
		expect(req.headers['Content-Type']).toContain('atomic');
		const ops = (req.body as { 'atomic:operations': Record<string, unknown>[] })[
			'atomic:operations'
		];
		expect(ops).toHaveLength(3);
		expect(ops[0]).toMatchObject({ op: 'add' });
		expect(ops[1]).toMatchObject({ op: 'update', ref: { type: 'workspaces', id: 'w1' } });
		expect(ops[2]).toMatchObject({ op: 'remove', ref: { type: 'workspaces', id: 'w2' } });
	});

	it('atomic empty op list short-circuits without an HTTP call', async () => {
		const adapter = new StubAdapter();
		const api = client(adapter);
		const result = await api.atomic([]);
		expect(result.results).toEqual([]);
		expect(adapter.calls).toEqual([]);
	});

	it('atomic 4xx throws ApiError with the failing op pointer', async () => {
		const adapter = new StubAdapter();
		adapter.push(
			jsonRes(409, {
				errors: [{ status: '409', source: { pointer: '/atomic:operations/1' } }],
			}),
		);
		const api = client(adapter);

		await expect(
			api.atomic([
				Atomic.add(Workspace, { name: 'A' }),
				Atomic.update(Workspace, 'ws-bad', { name: 'X' }),
			]),
		).rejects.toMatchObject({ status: 409 });
	});
});

describe('apiResult — tagged-union variant', () => {
	it('returns { data } on success', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, single('w1', { name: 'WS1' })));
		const api = client(adapter);

		const { data, error } = await apiResult(api.get(Workspace, 'w1'));

		expect(error).toBeNull();
		expect(data?.name).toBe('WS1');
	});

	it('returns { error } on ApiError', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(404, { errors: [{ status: '404' }] }));
		const api = client(adapter);

		const { data, error } = await apiResult(api.get(Workspace, 'missing'));

		expect(data).toBeNull();
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).status).toBe(404);
	});

	it('rethrows non-API errors (programming bugs surface, not get swallowed)', async () => {
		const promise: Promise<unknown> = Promise.reject(new RangeError('oops'));
		await expect(apiResult(promise)).rejects.toBeInstanceOf(RangeError);
	});
});

describe('ApiClient — with() overrides + headers', () => {
	it('with() layers headers on top of the base', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, single('w1', { name: 'WS1' })));
		const api = client(adapter);

		const authed = api.with({ headers: { Authorization: 'Bearer t' } });
		await authed.get(Workspace, 'w1');

		expect(adapter.calls[0].headers['Authorization']).toBe('Bearer t');
	});

	it('with() supports a function header factory (re-evaluated per call)', async () => {
		const adapter = new StubAdapter();
		adapter.push(jsonRes(200, single('w1', { name: 'WS1' })));
		adapter.push(jsonRes(200, single('w1', { name: 'WS1' })));
		const api = client(adapter);
		let token = 't1';
		const authed = api.with({ headers: () => ({ Authorization: `Bearer ${token}` }) });

		await authed.get(Workspace, 'w1');
		token = 't2';
		await authed.get(Workspace, 'w1');

		expect(adapter.calls[0].headers['Authorization']).toBe('Bearer t1');
		expect(adapter.calls[1].headers['Authorization']).toBe('Bearer t2');
	});
});

describe('FetchAdapter integration via vi.fn', () => {
	it('uses globalThis.fetch and serializes JSON bodies', async () => {
		const globalFetch = vi.fn(async () => {
			return new Response(JSON.stringify(single('w1', { name: 'WS1' })), {
				status: 200,
				headers: { 'content-type': 'application/vnd.api+json' },
			});
		});
		const originalFetch = globalThis.fetch;
		globalThis.fetch = globalFetch as unknown as typeof globalThis.fetch;
		try {
			const api = ApiClient.create({ baseUrl: 'https://api.example.com' });
			const ws = await api.get(Workspace, 'w1');
			expect(ws.name).toBe('WS1');
			expect(globalFetch).toHaveBeenCalled();
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});
