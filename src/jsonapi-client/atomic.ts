import { Encoder, HttpMethod, getResourceConfig, type IResource, type ModelType } from '../jsonapi/index.js';
import { instantiate, type AtomicOpInternal } from './api-client.js';

function resourceType<R extends IResource>(modelType: ModelType<R>): string {
	const cfg = getResourceConfig(modelType);
	if (!cfg) throw new Error(`@JsonApi decorator missing on ${modelType.name}`);
	return cfg.type;
}

function encodedData<R extends IResource>(instance: R, method: string): Record<string, unknown> {
	const doc = new Encoder<R>().Encode(instance, Encoder.encodeAsClient(method));
	// Document carries the wire shape via raw fields, but IDocument exposes
	// only Data(). Cast through the runtime shape to read the outgoing JSON.
	return (doc as unknown as { data: Record<string, unknown> }).data;
}

export const Atomic = {
	add<R extends IResource>(
		modelType: ModelType<R>,
		attrs: Partial<R>,
		lid?: string,
	): AtomicOpInternal {
		return {
			modelType,
			toWire() {
				const init = lid
					? ({ ...(attrs as object), id: lid } as unknown as Partial<R>)
					: (attrs as Partial<R>);
				const instance = instantiate(modelType, init);
				const data = encodedData(instance, HttpMethod.Post);
				if (lid) data['lid'] = lid;
				return { op: 'add', data };
			},
		};
	},

	update<R extends IResource>(
		modelType: ModelType<R>,
		id: string,
		attrs: Partial<R>,
	): AtomicOpInternal {
		return {
			modelType,
			toWire() {
				const instance = instantiate(modelType, { ...(attrs as Partial<R>), id } as Partial<R>);
				const data = encodedData(instance, HttpMethod.Patch);
				return {
					op: 'update',
					ref: { type: data['type'], id },
					data,
				};
			},
		};
	},

	remove<R extends IResource>(modelType: ModelType<R>, id: string): AtomicOpInternal {
		return {
			modelType: undefined,
			toWire() {
				return {
					op: 'remove',
					ref: { type: resourceType(modelType), id },
				};
			},
		};
	},
};

export type AtomicOp = AtomicOpInternal;
