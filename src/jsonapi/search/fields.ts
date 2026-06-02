export type FieldName = string;

export const merge = (parent: FieldName, ...children: FieldName[]): FieldName => {
	let merged = parent;
	for (const child of children) {
		merged = `${merged}.${child}`;
	}
	return merged;
};
