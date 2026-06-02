import { describe, expect, it } from 'vitest';
import { Decoder, JsonApi, Resource } from '../../../jsonapi/index.js';

@JsonApi({ type: 'articles' })
class Article extends Resource {}

// JSON:API §Error Objects. Pre-rewrite the lib left `errors` as raw
// objects so calling .Detail() threw "method not implemented". Now
// each error wraps in jsonapiError implementing IError.
describe('decoder — error documents', () => {
	it('wraps each entry into a class with working accessors', () => {
		const wire = {
			errors: [
				{
					id: 'e1',
					status: '422',
					code: 'validation',
					title: 'Invalid title',
					detail: 'title must be non-empty',
					source: { pointer: '/data/attributes/title' },
				},
			],
		};
		const doc = new Decoder(Article).Decode(wire);
		const errs = doc.Errors();
		expect(errs).toHaveLength(1);
		expect(errs[0].ID()).toBe('e1');
		expect(errs[0].Status()).toBe('422');
		expect(errs[0].Code()).toBe('validation');
		expect(errs[0].Title()).toBe('Invalid title');
		expect(errs[0].Detail()).toBe('title must be non-empty');
		expect(errs[0].Source()!.Pointer()).toBe('/data/attributes/title');
	});
});
