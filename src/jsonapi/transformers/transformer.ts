export interface Transformer {
	serialize(value: any): any;
	deserialize(value: any): any;
}
