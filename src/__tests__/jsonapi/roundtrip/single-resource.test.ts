import { describe, expect, it } from 'vitest';
import { Attribute, Decoder, Encoder, JsonApi, Relationship, Resource } from '../../../jsonapi/index.js';

// Roundtrip cover: encode a typed Resource, decode it back, assert
// every primitive + structured attribute survives. Mirrors the
// canonical https://jsonapi.org/format/#document-resource-objects example.

@JsonApi({ type: 'authors' })
class Author extends Resource {
	@Attribute() name!: string;
}

@JsonApi({ type: 'articles' })
class Article extends Resource {
	@Attribute() title!: string;
	@Attribute() body?: string;
	@Relationship({ type: Author }) author?: Author;
}

describe('roundtrip — single resource', () => {
	it('decodes a JSON:API document into the typed class with included author', () => {
		const wire = {
			data: {
				type: 'articles',
				id: 'a1',
				attributes: {
					title: 'Hello',
					body: 'World',
					timestamps: {
						createdAt: '2026-01-01T00:00:00Z',
						updatedAt: '2026-01-02T00:00:00Z',
					},
				},
				relationships: {
					author: { data: { type: 'authors', id: 'u1' } },
				},
			},
			included: [{ type: 'authors', id: 'u1', attributes: { name: 'Alice' } }],
		};

		const doc = new Decoder(Article).Decode(wire);
		const article = doc.Data();

		expect(article).toBeInstanceOf(Article);
		expect(article.ID()).toBe('a1');
		expect(article.Type()).toBe('articles');
		expect(article.title).toBe('Hello');
		expect(article.body).toBe('World');
		expect(article.timestamps).toBeDefined();
		expect(article.author).toBeInstanceOf(Author);
		expect(article.author!.name).toBe('Alice');
		expect(article.author!.ID()).toBe('u1');
	});

	it('encodes a typed Resource back to JSON:API wire format (server side)', () => {
		const article = new Article({ id: 'a1' });
		article.title = 'Hello';
		article.body = 'World';
		article.author = new Author({ id: 'u1' });
		article.author.name = 'Alice';

		const doc = new Encoder<Article>().Encode(article, Encoder.encodeAsServer());

		expect(doc).toBeDefined();
		const data = (doc as { data: Record<string, unknown> }).data;
		expect(data['type']).toBe('articles');
		expect(data['id']).toBe('a1');
		const attrs = data['attributes'] as Record<string, unknown>;
		expect(attrs['title']).toBe('Hello');
		expect(attrs['body']).toBe('World');
		const rels = data['relationships'] as Record<string, unknown>;
		expect(rels['author']).toBeDefined();
	});

	it('strips id on POST encoding (client-side new resource)', () => {
		const article = new Article();
		article.title = 'New';
		const doc = new Encoder<Article>().Encode(article, Encoder.encodeAsClient('POST'));
		const data = (doc as { data: Record<string, unknown> }).data;
		expect(data['id']).toBeUndefined();
		expect(data['type']).toBe('articles');
		expect((data['attributes'] as Record<string, unknown>)['title']).toBe('New');
	});

	it('emits lid for POST when the resource carries one (client-side new resource)', () => {
		const article = new Article({ lid: 'tmp-1' });
		article.title = 'Draft';
		const doc = new Encoder<Article>().Encode(article, Encoder.encodeAsClient('POST'));
		const data = (doc as { data: Record<string, unknown> }).data;
		expect(data['id']).toBeUndefined();
		expect(data['lid']).toBe('tmp-1');
	});
});
