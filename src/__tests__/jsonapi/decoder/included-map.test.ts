import { describe, expect, it } from 'vitest';
import { Attribute, Decoder, JsonApi, Relationship, Resource } from '../../../jsonapi/index.js';

@JsonApi({ type: 'authors' })
class Author extends Resource {
	@Attribute() name!: string;
}

@JsonApi({ type: 'articles' })
class Article extends Resource {
	@Attribute() title!: string;
	@Relationship({ type: Author }) author?: Author;
}

// Pre-rewrite the included dedup key was `${id}${type}` — colliding
// when string concat overlapped (e.g. id='ab'+type='cd' vs id='a'+type='bcd').
// The rewrite uses `${type}:${id}` and exposes the map via IncludedMap().
describe('decoder — Document.IncludedMap()', () => {
	it('keys by `type:id` so neighbouring resources do not collide', () => {
		const wire = {
			data: {
				type: 'articles',
				id: '1',
				relationships: { author: { data: { type: 'authors', id: '1' } } },
			},
			included: [
				{ type: 'authors', id: '1', attributes: { name: 'Alice' } },
				{ type: 'authors', id: '2', attributes: { name: 'Bob' } },
			],
		};
		const doc = new Decoder(Article).Decode(wire);
		const map = doc.IncludedMap();
		expect(map.size).toBe(2);
		expect(map.get('authors:1')).toBeDefined();
		expect(map.get('authors:2')).toBeDefined();
	});
});
